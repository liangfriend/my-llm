import { DEFAULT_LENGTH } from './constants';

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
export const DEFAULT_CHRONAXIE = 128;
export const MIN_CHRONAXIE = 32;
export const MAX_CHRONAXIE = 512;

// 标准音符时值表（如 32=16 分，48=16 分附点），用于合法性校验
const BASE_CHRONAXIE_UNITS = [512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
const MAX_DOTS = 4;

function buildStandardChronaxieValues(): number[] {
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
  const sorted = Array.from(values).filter(v => v >= MIN_CHRONAXIE && v <= MAX_CHRONAXIE);
  return sorted.sort((a, b) => a - b);
}

export const STANDARD_CHRONAXIE_VALUES = buildStandardChronaxieValues();

function snapChronaxieToStandard(value: number): number {
  if (STANDARD_CHRONAXIE_VALUES.includes(value)) return value;
  let closest = STANDARD_CHRONAXIE_VALUES[0];
  let smallestDiff = Math.abs(value - closest);
  for (let i = 1; i < STANDARD_CHRONAXIE_VALUES.length; i += 1) {
    const candidate = STANDARD_CHRONAXIE_VALUES[i];
    const diff = Math.abs(value - candidate);
    if (diff < smallestDiff) {
      closest = candidate;
      smallestDiff = diff;
    }
  }
  return closest;
}

// 约束midi
export function clampMidi(midi: unknown): number | null {
  const num = Number(midi);
  if (!Number.isFinite(num)) return null;
  return Math.min(128, Math.max(1, Math.round(num)));
}
// 标准化Chronaxie
export function normalizeChronaxie(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_CHRONAXIE;
  const clamped = Math.min(MAX_CHRONAXIE, Math.max(MIN_CHRONAXIE, Math.round(num)));
  return snapChronaxieToStandard(clamped);
}
// 安全的解构note
export function sanitizeNote(note: RawNote = {}, lyric?: string): SanitizedNote {
  const rest = note.rest === true;
  const midi = rest ? 0 : clampMidi(note.midi) ?? 60;
  const chronaxie = normalizeChronaxie(note.chronaxie);
  const lyrics = rest ? undefined : (lyric !== undefined ? lyric : note.lyrics);
  return { midi, chronaxie, lyrics, rest };
}
// 在传入的数据长度，种子数据长度，歌词长度中选出最长的作为生成数据长度
export function resolveTargetLength(
  requestedLength: unknown,
  textLength: number,
  seedLength: number,
): number {
  const numericLength = Number(requestedLength);
  const requested =
    Number.isFinite(numericLength) && numericLength > 0 ? Math.round(numericLength) : 0;
  // 如果长度为0，使用默认长度
  return Math.max(requested, textLength, seedLength) ?? DEFAULT_LENGTH;
}
