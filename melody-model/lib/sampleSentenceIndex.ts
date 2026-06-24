/**
 * 第 3 步：遍历过滤后的样本，按句建立样本句数组表。
 * 每个非末尾句与下一句组成 [当前句信息, 下一句]。
 * requireStableEnding 为 true 时，排除下一句句尾音级为 2/4/5/7 的配对。
 * 有 preSentence 时，按 FORBIDDEN_PHRASE_START_BY_ENDING 过滤跨句起音。
 */
import { GenerationState, SampleSentenceInfo, SampleSentencePair, SentenceMelody } from '../type';
import { buildSentenceContext, SentenceContext } from './sentenceContext';
import { isForbiddenPhraseConnection, isUnstableEndingDegree } from './midiKey';

function buildSampleSentenceInfo(
  sampleWeight: number,
  current: SentenceContext,
  previous: SentenceContext | null,
  prevSentence: SentenceMelody | null,
): SampleSentenceInfo {
  return {
    sampleWeight,
    melodyLine: current.melodyLine,
    totalChronaxie: current.totalChronaxie,
    noteCount: current.noteCount,
    lastMidi: current.lastMidi,
    lastChronaxie: current.lastChronaxie,
    prevMelodyLine: previous?.melodyLine ?? null,
    prevTotalChronaxie: previous?.totalChronaxie ?? null,
    prevNoteCount: previous?.noteCount ?? null,
    prevLastMidi: previous?.lastMidi ?? null,
    prevLastChronaxie: previous?.lastChronaxie ?? null,
    prevSentence: prevSentence ? prevSentence.map(note => ({ ...note })) : null,
  };
}

/**
 * 第 3 步：将 filteredSamples 中每个非末尾句与下一句配对，写入 state.sampleSentencePairs。
 */
export function buildSampleSentenceIndexStep3(state: GenerationState): void {
  const pairs: SampleSentencePair[] = [];

  state.filteredSamples.forEach((example, sampleIndex) => {
    const sampleWeight = state.sampleWeights[sampleIndex] ?? 1;
    const sentences = example.melody ?? [];
    if (sentences.length < 2) return;

    const contexts = sentences
      .filter(item => item.sentence.length > 0)
      .map(item => ({
        context: buildSentenceContext(item.sentence, item.totalChronaxie),
        sample: item,
      }));

    if (contexts.length < 2) return;

    for (let i = 0; i < contexts.length - 1; i += 1) {
      const current = contexts[i];
      const next = contexts[i + 1];
      const previous = i > 0 ? contexts[i - 1].context : null;
      const prevSentence = i > 0 ? contexts[i - 1].sample.sentence : null;

      if (state.requireStableEnding) {
        const nextSentence = next.sample.sentence;
        const lastNote = nextSentence[nextSentence.length - 1];
        if (
          lastNote &&
          isUnstableEndingDegree(lastNote.midi, example.params?.key, state.params?.key)
        ) {
          continue;
        }
      }

      const preLastNote = state.preSentence?.lastNote;
      if (preLastNote && preLastNote.midi > 0) {
        const nextFirstNote = next.sample.sentence.find(note => note.midi > 0);
        if (
          nextFirstNote &&
          isForbiddenPhraseConnection(
            preLastNote.midi,
            nextFirstNote.midi,
            state.params?.key,
            example.params?.key,
          )
        ) {
          continue;
        }
      }

      pairs.push({
        current: buildSampleSentenceInfo(sampleWeight, current.context, previous, prevSentence),
        next: {
          sentence: next.sample.sentence.map(note => ({ ...note })),
          totalChronaxie: next.sample.totalChronaxie,
        },
      });
    }
  });

  state.sampleSentencePairs = pairs;
}
