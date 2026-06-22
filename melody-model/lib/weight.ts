import { WEIGHT_CONFIG } from './weightConfig';

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

/** 精确匹配维度权重（midi、chronaxie、pinyin 等，供第 4、5 步使用） */
export function calcExactMatchWeight(isMatch: boolean): number {
  return isMatch ? WEIGHT_CONFIG.exactMatch.matchFactor : WEIGHT_CONFIG.exactMatch.mismatchFactor;
}

/** 旋律线相似度（0~1）映射为权重乘数（供第 4 步使用） */
export function calcMelodyLineSimilarityWeight(similarity: number): number {
  const clamped = Math.min(1, Math.max(0, similarity));
  const { minFactor } = WEIGHT_CONFIG.melodyLine;
  return minFactor + clamped * (1 - minFactor);
}
