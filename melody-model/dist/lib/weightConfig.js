"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEIGHT_CONFIG = void 0;
/**
 * 权重系数统一配置。
 * 各步骤的乘数、阈值集中在此，便于调参。
 */
exports.WEIGHT_CONFIG = {
    /** 第 2 步：params 标签相似度（沿用旧版概率模型规则） */
    params: {
        /** 请求未传 params 时，样本权重中性值 */
        neutralWhenNoRequestParams: 1,
        /** 样本缺少某个请求 param 键 */
        missingKeyFactor: 0.7,
        /** 字符串 param 相等 / 不等 */
        stringMatchFactor: 1.6,
        stringMismatchFactor: 0.5,
        /** 其他类型 param 相等 / 不等 */
        genericMatchFactor: 1.2,
        genericMismatchFactor: 0.8,
    },
    /** 第 4 步：midi、chronaxie 等精确相等时的权重 */
    exactMatch: {
        matchFactor: 2,
        mismatchFactor: 0.5,
    },
    /** 第 4 步：旋律线相似度映射权重（similarity 为 0~1，待后续步骤使用） */
    melodyLine: {
        /** 最终权重 = minFactor + similarity * (1 - minFactor) */
        minFactor: 0.1,
    },
    /** 第 4 步：目标样本句候选过滤 */
    targetSampleSentence: {
        /** 中位数反复过滤直到候选数 <= maxCandidates */
        maxCandidates: 1000,
        /** 有 preSentence 时，从句尾向前每匹配一个 midi 累加的权重 */
        reverseMidiMatchBonus: 5,
    },
};
