import { WEIGHT_CONFIG } from './weightConfig';
import { Melody } from '../type';

/**
 * 多维度权重合成：各维度系数相乘。
 * 某维度未参与计算时不要放入数组；第 2 步目前仅含 params 一维。
 */
export function combineDimensionWeights(dimensions: number[]): number {
  if (!dimensions.length) return 1;
  return dimensions.reduce((acc, value) => acc * value, 1);
}

/**
 * params 标签相似度权重（旧版 similarityScore 逻辑）。
 * 请求 params 为空对象或未传时返回 neutralWhenNoRequestParams。
 */
export function calcParamsSimilarityWeight(
  exampleParams: Record<string, unknown> = {},
  requestParams: Record<string, unknown> = {},
): number {
  const keys = Object.keys(requestParams || {});
  if (!keys.length) {
    return WEIGHT_CONFIG.params.neutralWhenNoRequestParams;
  }

  const cfg = WEIGHT_CONFIG.params;
  let score = 1;

  keys.forEach(key => {
    const expected = requestParams[key];
    const actual = exampleParams[key];

    if (actual === undefined) {
      score *= cfg.missingKeyFactor;
      return;
    }
    if (typeof expected === 'number' && typeof actual === 'number') {
      const distance = Math.abs(expected - actual);
      score *= 1 / (1 + distance);
      return;
    }
    if (typeof expected === 'string' && typeof actual === 'string') {
      score *= expected === actual ? cfg.stringMatchFactor : cfg.stringMismatchFactor;
      return;
    }
    score *= expected === actual ? cfg.genericMatchFactor : cfg.genericMismatchFactor;
  });

  return score;
}

/** 精确匹配维度权重（midi、chronaxie 等，供第 4 步使用） */
export function calcExactMatchWeight(isMatch: boolean): number {
  return isMatch ? WEIGHT_CONFIG.exactMatch.matchFactor : WEIGHT_CONFIG.exactMatch.mismatchFactor;
}

/** 旋律线相似度（0~1）映射为权重乘数（供第 4 步使用） */
export function calcMelodyLineSimilarityWeight(similarity: number): number {
  const clamped = Math.min(1, Math.max(0, similarity));
  const { minFactor } = WEIGHT_CONFIG.melodyLine;
  return minFactor + clamped * (1 - minFactor);
}

/** 目标时值接近度权重：离目标越远权重越低 */
export function calcChronaxieProximityWeight(
  sampleChronaxie: number,
  targetChronaxie: number,
): number {
  return 1 / (1 + Math.abs(sampleChronaxie - targetChronaxie));
}

/** 从句尾向前逐音比对 midi，每相同一个累加 bonus（用于 preSentence 与样本上一句） */
export function calcReverseMidiMatchBonus(
  requestMelody: Melody,
  sampleMelody: Melody,
  perMatch: number,
): number {
  if (!requestMelody.length || !sampleMelody.length || perMatch <= 0) {
    return 0;
  }

  let bonus = 0;
  let reqIdx = requestMelody.length - 1;
  let sampleIdx = sampleMelody.length - 1;

  while (reqIdx >= 0 && sampleIdx >= 0) {
    if (requestMelody[reqIdx].midi !== sampleMelody[sampleIdx].midi) {
      break;
    }
    bonus += perMatch;
    reqIdx -= 1;
    sampleIdx -= 1;
  }

  return bonus;
}

/** 按权重加权随机选取一项 */
export function weightedRandomPick<T extends { weight: number }>(items: T[]): T | null {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return items[0];

  let random = Math.random() * total;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}
