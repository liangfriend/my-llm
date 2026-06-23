/**
 * 第 4 步：按句遍历过滤样本，对照上下文权重，选取目标旋律线。
 */
import { GenerationState, PreSentenceContext } from '../type';
import { melodyLineSimilarity } from './melodyLine';
import { medianFilterUntil } from './sampleFilter';
import { buildSentenceContext, SentenceContext } from './sentenceContext';
import {
  calcExactMatchWeight,
  calcMelodyLineSimilarityWeight,
  combineDimensionWeights,
  weightedRandomPick,
} from './weight';
import { WEIGHT_CONFIG } from './weightConfig';

interface MelodyLineCandidate {
  weight: number;
  melodyLine: number[];
}

function nullableEqual(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

/** 对照当前句音符数、歌词数 */
function calcCurrentSentenceMatchWeight(
  sampleSentence: SentenceContext,
  targetNoteLength: number,
  targetLyricCount: number,
): number {
  return combineDimensionWeights([
    calcExactMatchWeight(sampleSentence.noteCount === targetNoteLength),
    calcExactMatchWeight(sampleSentence.lyricCount === targetLyricCount),
  ]);
}

/** 对照请求 preSentence 与样本上一句 */
function calcPreSentenceMatchWeight(
  request: PreSentenceContext,
  samplePrev: SentenceContext,
): number {
  const last = request.lastNote;
  return combineDimensionWeights([
    calcMelodyLineSimilarityWeight(melodyLineSimilarity(request.melodyLine, samplePrev.melodyLine)),
    calcExactMatchWeight(request.totalChronaxie === samplePrev.totalChronaxie),
    calcExactMatchWeight(request.noteCount === samplePrev.noteCount),
    calcExactMatchWeight(request.lyricCount === samplePrev.lyricCount),
    calcExactMatchWeight(nullableEqual(last?.midi, samplePrev.lastMidi)),
    calcExactMatchWeight(nullableEqual(last?.chronaxie, samplePrev.lastChronaxie)),
    calcExactMatchWeight(nullableEqual(last?.pinyin, samplePrev.lastPinyin)),
  ]);
}

function collectMelodyLineCandidates(state: GenerationState): MelodyLineCandidate[] {
  const candidates: MelodyLineCandidate[] = [];
  const targetNoteLength = state.targetNoteLength;
  const targetLyricCount = state.text.length;
  const hasPreSentence = state.preSentence !== null;

  state.filteredSamples.forEach((example, sampleIndex) => {
    const sampleWeight = state.sampleWeights[sampleIndex] ?? 1;
    const sentences = example.melody ?? [];
    if (sentences.length < 2) return;

    const sentenceContexts = sentences
      .filter(sentence => sentence.length > 0)
      .map(sentence => buildSentenceContext(sentence));

    if (sentenceContexts.length < 2) return;

    for (let i = 0; i < sentenceContexts.length - 1; i += 1) {
      const currentSentence = sentenceContexts[i];
      const nextSentence = sentenceContexts[i + 1];
      const samplePrev = i > 0 ? sentenceContexts[i - 1] : null;

      if (hasPreSentence) {
        if (!samplePrev) continue;
        const preWeight = calcPreSentenceMatchWeight(state.preSentence!, samplePrev);
        const currentWeight = calcCurrentSentenceMatchWeight(
          currentSentence,
          targetNoteLength,
          targetLyricCount,
        );
        candidates.push({
          weight: combineDimensionWeights([sampleWeight, preWeight, currentWeight]),
          melodyLine: [...nextSentence.melodyLine],
        });
        continue;
      }

      const currentWeight = calcCurrentSentenceMatchWeight(
        currentSentence,
        targetNoteLength,
        targetLyricCount,
      );
      candidates.push({
        weight: combineDimensionWeights([sampleWeight, currentWeight]),
        melodyLine: [...nextSentence.melodyLine],
      });
    }
  });

  return candidates;
}

/**
 * 第 4 步：中位数过滤候选旋律线，再按权重随机选取，写入 state.targetMelodyLine。
 */
export function pickTargetMelodyLineStep4(state: GenerationState): void {
  const candidates = collectMelodyLineCandidates(state);
  if (!candidates.length) {
    state.targetMelodyLine = null;
    return;
  }
  const maxCount = WEIGHT_CONFIG.targetMelodyLine.maxCandidates;
  const filtered = medianFilterUntil(candidates, maxCount);
  const picked = weightedRandomPick(filtered);
  state.targetMelodyLine = picked ? [...picked.melodyLine] : null;
}
