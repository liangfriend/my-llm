import { DEFAULT_NOTE_LENGTH } from './constants';
import { RawNote, SanitizedNote } from '../type';

export const DEFAULT_CHRONAXIE = 128;
export const MAX_CHRONAXIE = 512;

export interface ChronaxieRules {
  minChronaxie: number;
  maxChronaxie: number;
  interval: number;
}

// 标准音符时值表（如 32=16 分，48=16 分附点），用于合法性校验
const BASE_CHRONAXIE_UNITS = [512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
const MAX_DOTS = 4;

export function resolveChronaxieRules(
  minChronaxie: unknown,
  interval: unknown,
): ChronaxieRules {
  const parsedMin = Math.round(Number(minChronaxie));
  const parsedInterval = Math.round(Number(interval));
  const min = Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : 32;
  const step = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1;
  return {
    minChronaxie: min,
    maxChronaxie: MAX_CHRONAXIE,
    interval: step,
  };
}

// 获取所有允许的时值数组
export function getStandardChronaxieValues(rules: ChronaxieRules): number[] {
  const values = new Set<number>();
  BASE_CHRONAXIE_UNITS.forEach(base => {
    for (let dots = 0; dots <= MAX_DOTS; dots += 1) {
      const factor = 2 - 1 / Math.pow(2, dots);
      const raw = base * factor;
      if (Number.isInteger(raw)) {
        values.add(raw);
      }
    }
  });
  const sorted = Array.from(values)
    .filter(v => v >= rules.minChronaxie && v <= rules.maxChronaxie && v % rules.interval === 0)
    .sort((a, b) => a - b);
  return sorted.length ? sorted : [rules.minChronaxie];
}

/** midi 为 0 表示休止符 */
export function isRestMidi(midi: unknown): boolean {
  const num = Number(midi);
  return Number.isFinite(num) && Math.round(num) === 0;
}

// 约束 midi：0=休止，1~128=音高
export function clampMidi(midi: unknown): number | null {
  if (isRestMidi(midi)) return 0;
  const num = Number(midi);
  if (!Number.isFinite(num)) return null;
  return Math.min(128, Math.max(1, Math.round(num)));
}

// 标准化时值，因为 minChronaxie、minChronaxieInterval 等参数限制，有些时值是不能用的
export function normalizeChronaxie(value: unknown, rules: ChronaxieRules): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_CHRONAXIE;
  const clamped = Math.min(rules.maxChronaxie, Math.max(rules.minChronaxie, Math.round(num)));
  const values = getStandardChronaxieValues(rules);
  if (values.includes(clamped)) return clamped;
  let closest = values[0];
  let smallestDiff = Math.abs(clamped - closest);
  // 获取距离标准时值最近的那个时值
  for (let i = 1; i < values.length; i += 1) {
    const candidate = values[i];
    const diff = Math.abs(clamped - candidate);
    if (diff < smallestDiff) {
      closest = candidate;
      smallestDiff = diff;
    }
  }
  return closest;
}

// 安全的解构 note
export function sanitizeNote(
  note: RawNote = {},
  rules?: ChronaxieRules,
): SanitizedNote {
  const rest = isRestMidi(note.midi);
  const midi = rest ? 0 : clampMidi(note.midi) ?? 60;
  const effectiveRules = rules ?? resolveChronaxieRules(undefined, undefined);
  const chronaxie = normalizeChronaxie(note.chronaxie, effectiveRules);
  return { midi, chronaxie };
}

/**
 * 解析目标音符长度。
 * 未传 totalNoteLength 时使用 DEFAULT_NOTE_LENGTH（6）。
 */
export function resolveTargetNoteLength(totalNoteLength: unknown): number {
  const requested = parsePositiveInt(totalNoteLength);
  if (requested !== null) {
    return requested;
  }
  return DEFAULT_NOTE_LENGTH;
}

/** 解析正整数；未传或无效时返回 null */
export function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/** 解析可选 midi 边界；未传返回 null，0 保留为休止符标识 */
export function parseOptionalMidiBound(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return null;
  if (num === 0) return 0;
  return Math.min(128, Math.max(1, num));
}

export function parseOptionalPositiveInt(value: unknown): number | null {
  return parsePositiveInt(value);
}

const pentatonic = [0, 2, 4, 7, 9];

function isInPentatonic(m: number) {
  return pentatonic.includes(m % 12);
}

/*
 * 推荐音高算法（第 5 步降级时使用）
 */
export function recommendMidiReplace(index: number, notes: { midi: number }[]): number[] {
  const cur = notes[index];
  if (!cur) return [];

  const pre = notes[index - 1];
  const next = notes[index + 1];
  const cand: number[] = [];

  const pushAround = (m: number) => {
    cand.push(m, m + 2, m - 2, m + 3, m - 3, m + 4, m - 4, m + 5, m - 5);
  };

  // 前后中值
  if (pre && next) {
    cand.push(Math.round((pre.midi + next.midi) / 2));
  }
  // 靠近前音
  if (pre) pushAround(pre.midi);
  // 靠近后音
  if (next) pushAround(next.midi);
  cand.push(cur.midi);

  let unique = [...new Set(cand)];
  // 五声音阶过滤
  let pent = unique.filter(isInPentatonic);
  if (pent.length === 0) pent = unique;

  const limitRange = 12;
  const limit = (v: number) => {
    if (pre && Math.abs(v - pre.midi) > limitRange) return false;
    if (next && Math.abs(v - next.midi) > limitRange) return false;
    return true;
  };

  let filtered = pent.filter(limit);
  if (filtered.length === 0 && pent.length > 0) {
    const target = next?.midi ?? pre?.midi ?? cur.midi;
    filtered = pent.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target)).slice(0, 1);
  }

  filtered.sort((a, b) => {
    const score = (x: number) => {
      let s = 0;
      if (next) s += Math.abs(x - next.midi);
      if (pre) s += Math.abs(x - pre.midi);
      return s;
    };
    return score(a) - score(b);
  });

  return filtered;
}
