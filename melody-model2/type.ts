// 512一分 256二分 128四分 64八分 32十六分 16三十二分 8六十四分 4 2 1
export type Chronaxie = number;

/** POST /melody/generate 请求体，所有字段均可选；未传表示该维度不做限制 */
export interface GenerateOptions {
  text?: string;
  totalNoteLength?: unknown;
  preSentence?: RawNote[];
  params?: Record<string, unknown>;
  totalChronaxie?: unknown;
  minMidi?: unknown;
  maxMidi?: unknown;
  minChronaxie?: unknown;
  minChronaxieInterval?: unknown;
}

/** 生成接口响应 */
export interface GenerateResult {
  melody: Melody;
  state: 'success' | 'error';
}

/** 原始音符；midi 为 0 表示休止符 */
export interface RawNote {
  midi?: unknown;
  chronaxie?: unknown;
  lyrics?: string;
}

/** 校验/标准化后的音符 */
export interface SanitizedNote {
  midi: number;
  chronaxie: number;
  lyrics?: string;
}

export type Melody = SanitizedNote[];
/** 一句旋律 */
export type SentenceMelody = Melody;
/** 样本中按句存储的旋律，二维数组 */
export type SampleMelody = SentenceMelody[];

/** 训练样本；melody 为二维数组，每句一条旋律线 */
export interface TrainingExample {
  params?: Record<string, unknown>;
  minMidi?: number;
  maxMidi?: number;
  melody?: SampleMelody;
}

export interface TrainingData {
  examples: TrainingExample[];
}

/** 上一句结尾音符及其拼音，供第 4、5 步对照样本使用 */
export interface PreSentenceLastNote {
  midi: number;
  chronaxie: number;
  pinyin: string | null;
}

/** 从 preSentence 参数推导出的上一句上下文 */
export interface PreSentenceContext {
  melody: Melody;
  melodyLine: number[];
  totalChronaxie: number;
  noteCount: number;
  lyricCount: number;
  lastNote: PreSentenceLastNote | null;
}

/** 第 3 步平铺后的单个样本音符及其上下文，供第 5 步加权选取 */
export interface SampleNoteEntry {
  sampleWeight: number;
  midi: number;
  chronaxie: number;
  pinyin: string | null;
  sentenceMelodyLine: number[];
  sentenceTotalChronaxie: number;
  sentenceNoteCount: number;
  sentenceLyricCount: number;
  prevMidi: number | null;
  prevChronaxie: number | null;
  prevPinyin: string | null;
  prevSentenceMelodyLine: number[] | null;
  prevSentenceTotalChronaxie: number | null;
  prevSentenceNoteCount: number | null;
  prevSentenceLyricCount: number | null;
  prevSentenceLastMidi: number | null;
  prevSentenceLastChronaxie: number | null;
  prevSentenceLastPinyin: string | null;
}

/**
 * 贯穿生成全流程的状态对象。
 * 第 1 步完成输入归一化与计数初始化；第 2～6 步逐步填充中间结果。
 */
export interface GenerationState {
  /** 歌词字符数组 */
  text: string[];
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
  /** 已生成音符的累加时值 */
  currentAccumulatedChronaxie: number;
  /** 预计平均时值 = 目标总时值 / 目标音符数 */
  expectedAverageChronaxie: number | null;
  /** 差值权重：预期累加时值与实际累加时值的偏差，供第 5 步纠正时值 */
  chronaxieDrift: number;
  /** 已生成的当前句旋律 */
  generatedMelody: Melody;
  /** 已生成音符数量 */
  generatedNoteCount: number;
  /** 上一句上下文；无 preSentence 时为 null */
  preSentence: PreSentenceContext | null;
  /** 第 2 步：标签过滤后的样本 */
  filteredSamples: TrainingExample[];
  /** 第 2 步：与 filteredSamples 等长的样本权重 */
  sampleWeights: number[];
  /** 第 3 步：平铺后的样本音符列表 */
  sampleNoteEntries: SampleNoteEntry[];
  /** 第 3 步：与 sampleNoteEntries 等长的音符权重 */
  sampleNoteWeights: number[];
  /** 第 4 步：选中的目标旋律线 */
  targetMelodyLine: number[] | null;
}
