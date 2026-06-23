/**
 * 第 5 步：逐音从样本音符数组加权选取 midi 和时值，填满目标音符长度。
 */
import { GenerationState, SampleNoteEntry, SanitizedNote } from '../type';
import {
  canBeRest,
  getEffectiveMinChronaxie,
  getMaxChronaxieForCurrentNote,
  getPrevNoteFromGenerated,
  getTargetChronaxieForCurrentNote,
  hasChronaxieIntervalLimit,
  isChronaxieAllowedForState,
  mustAddLyrics,
  updateChronaxieDrift,
} from './generationState';
import { melodyLineSimilarity } from './melodyLine';
import {
  countLyricsInMelody,
  isRestMidi,
  normalizeChronaxie,
  recommendMidiReplace,
  resolveChronaxieRules,
} from './note';
import { medianFilterUntil } from './sampleFilter';
import {
  calcChronaxieProximityWeight,
  calcExactMatchWeight,
  calcMelodyLineSimilarityWeight,
  combineDimensionWeights,
  weightedRandomPick,
} from './weight';
import { WEIGHT_CONFIG } from './weightConfig';

interface WeightedNoteCandidate {
  weight: number;
  entry: SampleNoteEntry;
}

function nullableEqual(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

function passesMidiRange(state: GenerationState, midi: number): boolean {
  if (isRestMidi(midi)) return true;
  if (state.minMidi !== null && midi < state.minMidi) return false;
  if (state.maxMidi !== null && midi > state.maxMidi) return false;
  return true;
}

/** 硬过滤：休止符、音域、最大时值、时值间距 */
function filterEntryIndices(
  state: GenerationState,
  noteIndex: number,
  enforceInterval: boolean,
): number[] {
  const maxChronaxie = getMaxChronaxieForCurrentNote(state, noteIndex);
  const allowRest = canBeRest(state);

  return state.sampleNoteEntries.reduce<number[]>((indices, entry, index) => {
    if (!allowRest && isRestMidi(entry.midi)) return indices;
    if (!passesMidiRange(state, entry.midi)) return indices;
    if (maxChronaxie !== null && entry.chronaxie > maxChronaxie) return indices;
    if (enforceInterval && !isChronaxieAllowedForState(state, entry.chronaxie)) return indices;
    indices.push(index);
    return indices;
  }, []);
}

function calcNoteEntryWeight(
  state: GenerationState,
  entry: SampleNoteEntry,
  noteIndex: number,
  targetChronaxie: number | null,
): number {
  const prev = getPrevNoteFromGenerated(state);
  const dimensions: number[] = [entry.sampleWeight];

  if (state.targetMelodyLine) {
    dimensions.push(
      calcMelodyLineSimilarityWeight(
        melodyLineSimilarity(state.targetMelodyLine, entry.sentenceMelodyLine),
      ),
    );
  }

  dimensions.push(calcExactMatchWeight(entry.sentenceNoteCount === state.targetNoteLength));
  dimensions.push(calcExactMatchWeight(entry.sentenceLyricCount === state.text.length));
  dimensions.push(calcExactMatchWeight(nullableEqual(entry.prevMidi, prev.midi)));
  dimensions.push(calcExactMatchWeight(nullableEqual(entry.prevChronaxie, prev.chronaxie)));
  dimensions.push(calcExactMatchWeight(nullableEqual(entry.prevPinyin, prev.pinyin)));

  if (state.preSentence) {
    const ps = state.preSentence;
    dimensions.push(
      calcMelodyLineSimilarityWeight(
        melodyLineSimilarity(ps.melodyLine, entry.prevSentenceMelodyLine ?? []),
      ),
    );
    dimensions.push(calcExactMatchWeight(entry.prevSentenceTotalChronaxie === ps.totalChronaxie));
    dimensions.push(calcExactMatchWeight(entry.prevSentenceNoteCount === ps.noteCount));
    dimensions.push(calcExactMatchWeight(entry.prevSentenceLyricCount === ps.lyricCount));
    dimensions.push(calcExactMatchWeight(nullableEqual(entry.prevSentenceLastMidi, ps.lastNote?.midi)));
    dimensions.push(
      calcExactMatchWeight(nullableEqual(entry.prevSentenceLastChronaxie, ps.lastNote?.chronaxie)),
    );
    dimensions.push(calcExactMatchWeight(nullableEqual(entry.prevSentenceLastPinyin, ps.lastNote?.pinyin)));
  }

  if (targetChronaxie !== null) {
    dimensions.push(calcChronaxieProximityWeight(entry.chronaxie, targetChronaxie));
  }

  return combineDimensionWeights(dimensions);
}

function resolveLyrics(state: GenerationState, sampleHasLyrics: boolean): string | undefined {
  const lyricIndex = countLyricsInMelody(state.generatedMelody);
  if (mustAddLyrics(state)) {
    return state.text[lyricIndex];
  }
  if (sampleHasLyrics && lyricIndex < state.text.length) {
    return state.text[lyricIndex];
  }
  return undefined;
}

function buildRecommendContext(state: GenerationState): { midi: number }[] {
  const notes: { midi: number }[] = [];
  if (state.preSentence) {
    state.preSentence.melody.forEach(note => {
      if (!isRestMidi(note.midi)) notes.push({ midi: note.midi });
    });
  }
  state.generatedMelody.forEach(note => {
    if (!isRestMidi(note.midi)) notes.push({ midi: note.midi });
  });
  return notes;
}

/** 过滤后仍无候选时，用推荐音高 + 最小时值降级 */
function pickFallbackNote(state: GenerationState, noteIndex: number): SanitizedNote {
  const rules = resolveChronaxieRules(state.minChronaxie, state.minChronaxieInterval);
  const minChronaxie = getEffectiveMinChronaxie(state);
  const maxChronaxie = getMaxChronaxieForCurrentNote(state, noteIndex);
  let chronaxie = normalizeChronaxie(minChronaxie, rules);
  if (maxChronaxie !== null) {
    chronaxie = normalizeChronaxie(Math.min(chronaxie, maxChronaxie), rules);
  }

  const contextNotes = buildRecommendContext(state);
  const index = contextNotes.length;
  contextNotes.push({ midi: state.minMidi ?? 60 });
  const recommended = recommendMidiReplace(index, contextNotes);

  let midi = recommended[0] ?? state.minMidi ?? 60;
  if (state.minMidi !== null) midi = Math.max(state.minMidi, midi);
  if (state.maxMidi !== null) midi = Math.min(state.maxMidi, midi);

  return {
    midi,
    chronaxie,
    lyrics: resolveLyrics(state, false),
  };
}

function pickNoteFromSamples(state: GenerationState, noteIndex: number): SanitizedNote {
  let indices = filterEntryIndices(state, noteIndex, hasChronaxieIntervalLimit(state));
  if (!indices.length && hasChronaxieIntervalLimit(state)) {
    indices = filterEntryIndices(state, noteIndex, false);
  }

  if (!indices.length) {
    return pickFallbackNote(state, noteIndex);
  }

  const targetChronaxie = getTargetChronaxieForCurrentNote(state, noteIndex);
  console.log('chicken',targetChronaxie)
  const candidates: WeightedNoteCandidate[] = indices.map(index => ({
    weight: calcNoteEntryWeight(state, state.sampleNoteEntries[index], noteIndex, targetChronaxie),
    entry: state.sampleNoteEntries[index],
  }));

  const maxCount = WEIGHT_CONFIG.noteGeneration.maxCandidates;
  const filtered = medianFilterUntil(candidates, maxCount);
  const picked = weightedRandomPick(filtered);
  if (!picked) {
    return pickFallbackNote(state, noteIndex);
  }

  const entryIndex = state.sampleNoteEntries.indexOf(picked.entry);
  if (entryIndex >= 0) {
    state.sampleNoteWeights[entryIndex] = picked.weight;
  }

  const sampleHasLyrics = picked.entry.pinyin !== null;
  const lyrics = isRestMidi(picked.entry.midi) ? undefined : resolveLyrics(state, sampleHasLyrics);

  return {
    midi: picked.entry.midi,
    chronaxie: picked.entry.chronaxie,
    lyrics,
  };
}

function appendGeneratedNote(state: GenerationState, note: SanitizedNote): void {
  state.generatedMelody.push(note);
  state.generatedNoteCount += 1;
  state.currentAccumulatedChronaxie += note.chronaxie;
  updateChronaxieDrift(state);
}

/**
 * 第 5 步：循环选取音符直到达到 targetNoteLength。
 * 结果写入 state.generatedMelody。
 */
export function generateNotesStep5(state: GenerationState): void {
  while (state.generatedNoteCount < state.targetNoteLength) {
    const noteIndex = state.generatedNoteCount;
    const note = pickNoteFromSamples(state, noteIndex);
    appendGeneratedNote(state, note);
  }
}
