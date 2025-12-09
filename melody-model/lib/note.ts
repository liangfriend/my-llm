import { DEFAULT_LENGTH } from './constants';

export interface RawNote {
  midi?: unknown;
  chronaxie?: unknown;
  lyrics?: string;
}

export interface SanitizedNote {
  midi: number;
  chronaxie: number;
  lyrics?: string;
}
export type Melody = SanitizedNote[];
// 约束midi
export function clampMidi(midi: unknown): number | null {
  const num = Number(midi);
  if (!Number.isFinite(num)) return null;
  return Math.min(128, Math.max(1, Math.round(num)));
}
// 标准化Chronaxie
export function normalizeChronaxie(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 4;
  return Math.min(64, Math.max(1, Math.round(num)));
}
// 安全的解构note
export function sanitizeNote(note: RawNote = {}, lyric?: string): SanitizedNote {
  const midi = clampMidi(note.midi) ?? 60;
  const chronaxie = normalizeChronaxie(note.chronaxie);
  const lyrics = lyric !== undefined ? lyric : note.lyrics;
  return { midi, chronaxie, lyrics };
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
