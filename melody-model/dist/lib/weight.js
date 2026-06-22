"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.combineDimensionWeights = combineDimensionWeights;
exports.calcParamsSimilarityWeight = calcParamsSimilarityWeight;
exports.calcExactMatchWeight = calcExactMatchWeight;
exports.calcMelodyLineSimilarityWeight = calcMelodyLineSimilarityWeight;
const weightConfig_1 = require("./weightConfig");
/**
 * 多维度权重合成：各维度系数相乘。
 * 某维度未参与计算时不要放入数组；第 2 步目前仅含 params 一维。
 */
function combineDimensionWeights(dimensions) {
    if (!dimensions.length)
        return 1;
    return dimensions.reduce((acc, value) => acc * value, 1);
}
/**
 * params 标签相似度权重（旧版 similarityScore 逻辑）。
 * 请求 params 为空对象或未传时返回 neutralWhenNoRequestParams。
 */
function calcParamsSimilarityWeight(exampleParams = {}, requestParams = {}) {
    const keys = Object.keys(requestParams || {});
    if (!keys.length) {
        return weightConfig_1.WEIGHT_CONFIG.params.neutralWhenNoRequestParams;
    }
    const cfg = weightConfig_1.WEIGHT_CONFIG.params;
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
function calcExactMatchWeight(isMatch) {
    return isMatch ? weightConfig_1.WEIGHT_CONFIG.exactMatch.matchFactor : weightConfig_1.WEIGHT_CONFIG.exactMatch.mismatchFactor;
}
/** 旋律线相似度（0~1）映射为权重乘数（供第 4 步使用） */
function calcMelodyLineSimilarityWeight(similarity) {
    const clamped = Math.min(1, Math.max(0, similarity));
    const { minFactor } = weightConfig_1.WEIGHT_CONFIG.melodyLine;
    return minFactor + clamped * (1 - minFactor);
}
