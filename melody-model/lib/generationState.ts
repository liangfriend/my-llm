/**
 * 生成流程状态管理（第 1 步）。
 * 负责解析请求参数、初始化贯穿全流程的状态，并提供后续步骤所需的计算 helper。
 */
import {
  GenerateOptions,
  GenerationState,
  Melody,
  PreSentenceContext,
  RawNote,
  SampleNoteEntry,
  TrainingExample,
} from '../type';
import { buildMelodyLine } from './melodyLine';
import {
  countLyricsInMelody,
  isRestMidi,
  parseOptionalMidiBound,
  parseOptionalPositiveInt,
  resolveChronaxieRules,
  resolveTargetNoteLength,
  sanitizeNote,
} from './note';
import { toLyricPinyin } from './pinyin';

export type ParseOptionsResult =
  | { ok: true; options: GenerateOptions }
  | { ok: false; error: string };

/** 校验并提取 generate 请求体；空 body 视为全部使用默认值 */
export function parseGenerateOptions(body: unknown): ParseOptionsResult {
  if (body === null || typeof body !== 'object') {
    return { ok: true, options: {} };
  }

  const input = body as Record<string, unknown>;
  const {
    text,
    totalNoteLength,
    preSentence,
    params,
    totalChronaxie,
    minMidi,
    maxMidi,
    minChronaxie,
    minChronaxieInterval,
  } = input;

  if (text !== undefined && typeof text !== 'string') {
    return { ok: false, error: 'text must be a string when provided' };
  }
  if (preSentence !== undefined && !Array.isArray(preSentence)) {
    return { ok: false, error: 'preSentence must be an array when provided' };
  }
  if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
    return { ok: false, error: 'params must be an object when provided' };
  }

  return {
    ok: true,
    options: {
      text,
      totalNoteLength,
      preSentence: preSentence as RawNote[] | undefined,
      params: params as Record<string, unknown> | undefined,
      totalChronaxie,
      minMidi,
      maxMidi,
      minChronaxie,
      minChronaxieInterval,
    },
  };
}

/** 标准化 preSentence 音符数组 */
function sanitizePreSentence(notes: RawNote[] | undefined): Melody {
  if (!Array.isArray(notes) || !notes.length) return [];
  const rules = resolveChronaxieRules(undefined, undefined);
  return notes.map(note => sanitizeNote(note, undefined, rules));
}

/** 从上一句旋律推导第 4、5 步需要的上下文（旋律线、时值、结尾音拼音等） */
function buildPreSentenceContext(melody: Melody): PreSentenceContext | null {
  if (!melody.length) return null;

  const lastNoteRaw = melody[melody.length - 1];
  const lastNote = lastNoteRaw
    ? {
        midi: lastNoteRaw.midi,
        chronaxie: lastNoteRaw.chronaxie,
        pinyin: toLyricPinyin(lastNoteRaw.lyrics),
      }
    : null;

  return {
    melody,
    melodyLine: buildMelodyLine(melody),
    totalChronaxie: melody.reduce((sum, note) => sum + note.chronaxie, 0),
    noteCount: melody.length,
    lyricCount: countLyricsInMelody(melody),
    lastNote,
  };
}

/**
 * 归一化 midi 范围。
 * 若 min/max 均未传则返回 null；只传一侧时用 1 或 128 补全另一侧。
 */
function normalizeMidiRange(minMidi: unknown, maxMidi: unknown): { min: number | null; max: number | null } {
  let min = parseOptionalMidiBound(minMidi);
  let max = parseOptionalMidiBound(maxMidi);
  if (min === null && max === null) {
    return { min: null, max: null };
  }
  if (min === null) min = 1;
  if (max === null) max = 128;
  if (min === 0) min = 1;
  if (max === 0) max = 128;
  if (min > max) {
    [min, max] = [max, min];
  }
  return { min, max };
}

/**
 * 第 1 步：根据请求参数创建全流程状态。
 * 规则：任一参数未传 → 该维度为 null，后续不做对应限制。
 */
export function createGenerationState(options: GenerateOptions): GenerationState {
  const text = typeof options.text === 'string' ? Array.from(options.text) : [];
  const targetNoteLength = resolveTargetNoteLength(text.length, options.totalNoteLength);
  const targetTotalChronaxie = parseOptionalPositiveInt(options.totalChronaxie);
  const expectedAverageChronaxie =
    targetTotalChronaxie !== null && targetNoteLength > 0
      ? targetTotalChronaxie / targetNoteLength
      : null;
  const midiRange = normalizeMidiRange(options.minMidi, options.maxMidi);
  const minChronaxie = parseOptionalPositiveInt(options.minChronaxie);
  const minChronaxieInterval = parseOptionalPositiveInt(options.minChronaxieInterval);
  const params =
    options.params && Object.keys(options.params).length > 0 ? options.params : null;
  const preSentenceMelody = sanitizePreSentence(options.preSentence);

  return {
    text,
    params,
    // 仅当请求体显式传入 minMidi/maxMidi 时才启用音高限制
    minMidi: options.minMidi === undefined || options.minMidi === null || options.minMidi === ''
      ? null
      : midiRange.min,
    maxMidi: options.maxMidi === undefined || options.maxMidi === null || options.maxMidi === ''
      ? null
      : midiRange.max,
    minChronaxie,
    minChronaxieInterval,
    targetTotalChronaxie,
    targetNoteLength,
    currentAccumulatedChronaxie: 0,
    expectedAverageChronaxie,
    chronaxieDrift: 0,
    generatedMelody: [],
    generatedNoteCount: 0,
    preSentence: buildPreSentenceContext(preSentenceMelody),
    // 以下字段在第 2～4 步填充
    filteredSamples: [] as TrainingExample[],
    sampleWeights: [] as number[],
    sampleNoteEntries: [] as SampleNoteEntry[],
    sampleNoteWeights: [] as number[],
    targetMelodyLine: null,
  };
}

/** 预期累加时值 = 平均时值 × 已生成音符下标 */
export function getExpectedAccumulatedChronaxie(state: GenerationState, noteIndex: number): number | null {
  if (state.expectedAverageChronaxie === null) return null;
  return state.expectedAverageChronaxie * noteIndex;
}

/**
 * 当前音符允许的最大时值。
 * 需为后续音符预留 minChronaxie；未设 minChronaxie 时仅受剩余总时值约束。
 */
export function getMaxChronaxieForCurrentNote(state: GenerationState, noteIndex: number): number | null {
  if (state.targetTotalChronaxie === null) return null;

  const remainingChronaxie = state.targetTotalChronaxie - state.currentAccumulatedChronaxie;
  const remainingNotes = state.targetNoteLength - noteIndex;
  if (remainingNotes <= 0) return remainingChronaxie;

  if (state.minChronaxie === null) {
    return remainingChronaxie;
  }

  return remainingChronaxie - state.minChronaxie * (remainingNotes - 1);
}

/** 第 5 步选时值时的目标时值（含差值权重纠正） */
export function getTargetChronaxieForCurrentNote(state: GenerationState, noteIndex: number): number | null {
  if (state.expectedAverageChronaxie === null) return null;
  if (noteIndex === 0) return state.expectedAverageChronaxie;
  return state.expectedAverageChronaxie + state.chronaxieDrift;
}

/** 每生成一个音符后更新差值权重 */
export function updateChronaxieDrift(state: GenerationState): void {
  if (state.expectedAverageChronaxie === null) {
    state.chronaxieDrift = 0;
    return;
  }

  const expectedAccumulated = state.expectedAverageChronaxie * state.generatedNoteCount;
  state.chronaxieDrift = expectedAccumulated - state.currentAccumulatedChronaxie;
}

/** 尚未分配的歌词字符数 */
export function getRemainingLyricCount(state: GenerationState): number {
  const assigned = countLyricsInMelody(state.generatedMelody);
  return Math.max(0, state.text.length - assigned);
}

/** 尚未生成的音符数 */
export function getRemainingNoteCount(state: GenerationState): number {
  return Math.max(0, state.targetNoteLength - state.generatedNoteCount);
}

/** 剩余歌词少于剩余音符时，当前音可以是休止符 */
export function canBeRest(state: GenerationState): boolean {
  return getRemainingLyricCount(state) < getRemainingNoteCount(state);
}

/** 剩余歌词等于剩余音符时，当前音必须带歌词 */
export function mustAddLyrics(state: GenerationState): boolean {
  return getRemainingLyricCount(state) === getRemainingNoteCount(state);
}

/** 获取「上一音」信息：优先已生成句末，否则取 preSentence 句末 */
export function getPrevNoteFromGenerated(state: GenerationState): {
  midi: number | null;
  chronaxie: number | null;
  pinyin: string | null;
} {
  const last = state.generatedMelody[state.generatedMelody.length - 1];
  if (last) {
    return {
      midi: last.midi,
      chronaxie: last.chronaxie,
      pinyin: toLyricPinyin(last.lyrics),
    };
  }

  if (state.preSentence?.lastNote) {
    return {
      midi: state.preSentence.lastNote.midi,
      chronaxie: state.preSentence.lastNote.chronaxie,
      pinyin: state.preSentence.lastNote.pinyin,
    };
  }

  return { midi: null, chronaxie: null, pinyin: null };
}

export function hasMidiRangeLimit(state: GenerationState): boolean {
  return state.minMidi !== null || state.maxMidi !== null;
}

export function hasChronaxieIntervalLimit(state: GenerationState): boolean {
  return state.minChronaxie !== null || state.minChronaxieInterval !== null;
}

export function hasParamsFilter(state: GenerationState): boolean {
  return state.params !== null;
}

export function isNoteRest(note: { midi: number }): boolean {
  return isRestMidi(note.midi);
}

/** 第 6 步总时值调整用的剩余未分配时值 */
export function getRemainingUnallocatedChronaxie(state: GenerationState): number | null {
  if (state.targetTotalChronaxie === null) return null;
  return state.targetTotalChronaxie - state.currentAccumulatedChronaxie;
}
