/**
 * 权重系数统一配置。
 * 各步骤的乘数、阈值集中在此，便于调参。
 */
export const WEIGHT_CONFIG = {
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

  /** 第 4 步：目标样本句选取 */
  targetSampleSentence: {
    /** 中位数反复过滤直到候选数 <= maxCandidates */
    maxCandidates: 10,
    /** 下一句 totalChronaxie 与参数相等 */
    chronaxieExact: 10,
    /** 相差 16 */
    chronaxieDiff16: 4,
    /** 相差 32 */
    chronaxieDiff32: 2,
    /** 其余差值或未传 totalChronaxie 时 */
    chronaxieDefault: 1,
    /** 下一句音符数与 totalNoteLength 相等 */
    noteLengthMatch: 2,
    /** preSentence 句尾 midi 与样本当前句句尾 midi 相同 */
    preSentenceLastMidiMatch: 5,
  },
} as const;
