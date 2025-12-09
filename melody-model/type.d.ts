import {Melody, RawNote} from "./lib/note";
// 512一分 256二分 128四分 64八分 32十六分 16三十二分 8六十四分 4 2 1
export type Chronaxie = number
// 生成选项
export interface GenerateOptions {
    text?: string;
    seedMelody?: RawNote[];
    length?: unknown;
    params?: Record<string, unknown>;
}
// 生成结果
export interface GenerateResult {
    melody: Melody;
    usedExamples: number;
    targetLength: number;
}
// 训练样本
export interface TrainingExample {
    input?: string;
    output?: RawNote[];
    melody?: RawNote[];
    params?: Record<string, unknown>;
}
// 训练数据
export interface TrainingData {
    examples: TrainingExample[];
}