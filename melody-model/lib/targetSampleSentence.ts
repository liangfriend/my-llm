/**
 * 第 4 步：按句遍历样本句数组表，对照上下文权重，选取目标样本句（下一句）。
 */
import { GenerationState, SampleSentence } from '../type';
import { medianFilterUntil } from './sampleFilter';
import { calcStep4PairWeight, weightedRandomPick } from './weight';
import { WEIGHT_CONFIG } from './weightConfig';
import logger from "./logger";

interface SampleSentenceCandidate {
  weight: number;
  next: SampleSentence;
}

function collectSampleSentenceCandidates(state: GenerationState): SampleSentenceCandidate[] {
  const candidates: SampleSentenceCandidate[] = [];
  const minTotalChronaxie = state.targetTotalChronaxie;

  state.sampleSentencePairs.forEach(pair => {
    if (minTotalChronaxie !== null && pair.next.totalChronaxie < minTotalChronaxie) {
      return;
    }

    candidates.push({
      weight: calcStep4PairWeight(state, pair),
      next: {
        sentence: pair.next.sentence.map(note => ({ ...note })),
        totalChronaxie: pair.next.totalChronaxie,
      },
    });
  });

  return candidates;
}

/**
 * 第 4 步：中位数过滤候选样本句，再按权重随机选取，写入 state.targetSampleSentence。
 */
export function pickTargetSampleSentenceStep4(state: GenerationState): void {
  const candidates = collectSampleSentenceCandidates(state);
  if (!candidates.length) {
    state.targetSampleSentence = null;
    return;
  }

  const maxCount = WEIGHT_CONFIG.targetSampleSentence.maxCandidates;
  const filtered = medianFilterUntil(candidates, maxCount);
  const picked = weightedRandomPick(filtered);
  logger.debug(JSON.stringify(filtered,null, 2))
  logger.debug(JSON.stringify(picked,null, 2))
  state.targetSampleSentence = picked
    ? {
        sentence: picked.next.sentence.map(note => ({ ...note })),
        totalChronaxie: picked.next.totalChronaxie,
      }
    : null;
}
