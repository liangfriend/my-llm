// 512一分 256二分 128四分 64八分 32十六分 16三十二分 8六十四分 4 2 1
export type Chronaxie = number;

/** POST /melody/generate 请求体，所有字段均可选；未传表示该维度不做限制 */
export interface GenerateOptions {
  totalNoteLength?: unknown;
  preSentence?: RawNote[];
  params?: Record<string, unknown>;
  totalChronaxie?: unknown;
  minMidi?: unknown;
  maxMidi?: unknown;
  minChronaxie?: unknown;
  minChronaxieInterval?: unknown;
  /** 为 true 时第 3 步排除下一句句尾音级为 2/4/5/7 的样本句对 */
  stableEnding?: unknown;
}

/** 生成接口响应 */
export interface GenerateResult {
  melody: Melody;
  state: 'success' | 'error';
  message?: string;
}

/** 原始音符；midi 为 0 表示休止符 */
export interface RawNote {
  midi?: unknown;
  chronaxie?: unknown;
}

/** 校验/标准化后的音符 */
export interface SanitizedNote {
  midi: number;
  chronaxie: number;
}

export type Melody = SanitizedNote[];
/** 一句旋律 */
export type SentenceMelody = Melody;

/** 样本中按句存储：每句含 sentence 与 totalChronaxie（26.6.23 起） */
export interface SampleSentence {
  sentence: SentenceMelody;
  totalChronaxie: number;
}

/** 样本 melody：句对象数组 */
export type SampleMelody = SampleSentence[];

/** 训练样本 */
export interface TrainingExample {
  params?: Record<string, unknown>;
  minMidi?: number;
  maxMidi?: number;
  melody?: SampleMelody;
}

export interface TrainingData {
  examples: TrainingExample[];
}

/** 上一句结尾音符，供第 4 步对照样本使用 */
export interface PreSentenceLastNote {
  midi: number;
  chronaxie: number;
}

/** 从 preSentence 参数推导出的上一句上下文 */
export interface PreSentenceContext {
  melody: Melody;
  melodyLine: number[];
  totalChronaxie: number;
  noteCount: number;
  lastNote: PreSentenceLastNote | null;
}

/** 第 3 步：样本句信息（当前句） */
export interface SampleSentenceInfo {
  sampleWeight: number;
  melodyLine: number[];
  totalChronaxie: number;
  noteCount: number;
  /** 样本当前句结尾音，供第 4 步与 preSentence 对照 */
  lastMidi: number | null;
  lastChronaxie: number | null;
  prevMelodyLine: number[] | null;
  prevTotalChronaxie: number | null;
  prevNoteCount: number | null;
  prevLastMidi: number | null;
  prevLastChronaxie: number | null;
  /** 样本上一句完整旋律，供第 4 步句尾反向 midi 对照 */
  prevSentence: SentenceMelody | null;
}

/** 第 3 步：样本句数组表项 [当前句信息, 下一句] */
export interface SampleSentencePair {
  current: SampleSentenceInfo;
  next: SampleSentence;
}

/**
 * 贯穿生成全流程的状态对象。
 * 第 1 步完成输入归一化与计数初始化；第 2～5 步逐步填充中间结果。
 */
export interface GenerationState {
  /** 标签；null 表示不做标签过滤 */
  params: Record<string, unknown> | null;
  /** 音高下限；null 表示不限制 */
  minMidi: number | null;
  /** 音高上限；null 表示不限制 */
  maxMidi: number | null;
  /** 单音最小时值；null 表示不限制 */
  minChronaxie: number | null;
  /** 时值间距；null 表示不限制 */
  minChronaxieInterval: number | null;
  /** 目标总时值；null 表示不做时值预算 */
  targetTotalChronaxie: number | null;
  /** 目标音符个数 */
  targetNoteLength: number;
  /** 已生成的当前句旋律 */
  generatedMelody: Melody;
  /** 上一句上下文；无 preSentence 时为 null */
  preSentence: PreSentenceContext | null;
  /** 第 2 步：标签过滤后的样本 */
  filteredSamples: TrainingExample[];
  /** 第 2 步：与 filteredSamples 等长的样本权重 */
  sampleWeights: number[];
  /** 第 3 步：样本句数组表 */
  sampleSentencePairs: SampleSentencePair[];
  /** 第 4 步：选中的目标样本句（下一句） */
  targetSampleSentence: SampleSentence | null;
  /** 尾音：为 true 时第 3 步过滤下一句句尾为 2/4/5/7 级的样本句对 */
  requireStableEnding: boolean;
}
