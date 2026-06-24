"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.combineDimensionWeights = combineDimensionWeights;
exports.calcParamsSimilarityWeight = calcParamsSimilarityWeight;
exports.calcExactMatchWeight = calcExactMatchWeight;
exports.calcMelodyLineSimilarityWeight = calcMelodyLineSimilarityWeight;
exports.calcChronaxieProximityWeight = calcChronaxieProximityWeight;
exports.calcStep4TotalChronaxieWeight = calcStep4TotalChronaxieWeight;
exports.calcStep4PairWeight = calcStep4PairWeight;
exports.calcReverseMidiMatchBonus = calcReverseMidiMatchBonus;
exports.weightedRandomPick = weightedRandomPick;
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
/** 精确匹配维度权重（midi、chronaxie 等，供第 4 步使用） */
function calcExactMatchWeight(isMatch) {
    return isMatch ? weightConfig_1.WEIGHT_CONFIG.exactMatch.matchFactor : weightConfig_1.WEIGHT_CONFIG.exactMatch.mismatchFactor;
}
/** 旋律线相似度（0~1）映射为权重乘数（供第 4 步使用） */
function calcMelodyLineSimilarityWeight(similarity) {
    const clamped = Math.min(1, Math.max(0, similarity));
    const { minFactor } = weightConfig_1.WEIGHT_CONFIG.melodyLine;
    return minFactor + clamped * (1 - minFactor);
}
/** 目标时值接近度权重：离目标越远权重越低 */
function calcChronaxieProximityWeight(sampleChronaxie, targetChronaxie) {
    return 1 / (1 + Math.abs(sampleChronaxie - targetChronaxie));
}
/** 第 4 步：下一句 totalChronaxie 与参数对照权重（累加项） */
function calcStep4TotalChronaxieWeight(sampleTotal, targetTotal) {
    const cfg = weightConfig_1.WEIGHT_CONFIG.targetSampleSentence;
    if (targetTotal === null) {
        return cfg.chronaxieDefault;
    }
    const diff = Math.abs(sampleTotal - targetTotal);
    if (diff === 0)
        return cfg.chronaxieExact;
    if (diff === 16)
        return cfg.chronaxieDiff16;
    if (diff === 32)
        return cfg.chronaxieDiff32;
    return cfg.chronaxieDefault;
}
/** 第 4 步：样本句对权重（累加：标签 + 下一句时值 + 音符数 + preSentence 句尾） */
function calcStep4PairWeight(state, pair) {
    var _a;
    const cfg = weightConfig_1.WEIGHT_CONFIG.targetSampleSentence;
    let weight = pair.current.sampleWeight;
    weight += calcStep4TotalChronaxieWeight(pair.next.totalChronaxie, state.targetTotalChronaxie);
    if (pair.next.sentence.length === state.targetNoteLength) {
        weight += cfg.noteLengthMatch;
    }
    const preLast = (_a = state.preSentence) === null || _a === void 0 ? void 0 : _a.lastNote;
    if (preLast && pair.current.lastMidi !== null && preLast.midi === pair.current.lastMidi) {
        weight += cfg.preSentenceLastMidiMatch;
    }
    return weight;
}
/** 从句尾向前逐音比对 midi，每相同一个累加 bonus（遗留，当前第 4 步未使用） */
function calcReverseMidiMatchBonus(requestMelody, sampleMelody, perMatch) {
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
function weightedRandomPick(items) {
    if (!items.length)
        return null;
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0)
        return items[0];
    let random = Math.random() * total;
    for (const item of items) {
        random -= item.weight;
        if (random <= 0)
            return item;
    }
    return items[items.length - 1];
}
