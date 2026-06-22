// 512一分 256二分 128四分 64八分 32十六分 16三十二分 8六十四分 4 2 1
export type Chronaxie = number
// 生成选项
export interface GenerateOptions {
    text?: string;
    seedMelody?: RawNote[];
    length?: unknown;
    params?: Record<string, unknown>;
    totalChronaxie?: unknown;
    minMidi?: unknown;
    maxMidi?: unknown;
    minChronaxie?: unknown;
    minChronaxieInterval?: unknown;
}
// 生成结果
export interface GenerateResult {
    melody: Melody;
    usedExamples: number;
    targetLength: number;
    warnings?: string[];
}
// 训练样本
export interface TrainingExample {
  // 输入歌词
    input?: string;
    // 输出旋律
    melody?: RawNote[];
    // 标签
    params?: Record<string, unknown>;
}
// 训练数据
export interface TrainingData {
    examples: TrainingExample[];
}
export interface RawNote {
  midi?: unknown;
  chronaxie?: unknown;
  lyrics?: string;
  rest?: unknown;
}

export interface SanitizedNote {
  midi: number;
  chronaxie: number;
  lyrics?: string;
  rest?: boolean;
}
export type Melody = SanitizedNote[];