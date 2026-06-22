import { DEFAULT_LENGTH } from './constants';
import {RawNote, SanitizedNote} from "../type";


export const DEFAULT_CHRONAXIE = 128;
export const MAX_CHRONAXIE = 512;
export const DEFAULT_MIN_CHRONAXIE = 32;
export const DEFAULT_CHRONAXIE_INTERVAL = 1;

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
  const min =
    Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : DEFAULT_MIN_CHRONAXIE;
  const step =
    Number.isFinite(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : DEFAULT_CHRONAXIE_INTERVAL;
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
  .filter(
    v => v >= rules.minChronaxie && v <= rules.maxChronaxie && v % rules.interval === 0,
  )
  .sort((a, b) => a - b);
  return sorted.length ? sorted : [rules.minChronaxie];
}




// 约束midi
export function clampMidi(midi: unknown): number | null {
  const num = Number(midi);
  if (!Number.isFinite(num)) return null;
  return Math.min(128, Math.max(1, Math.round(num)));
}
// 标准化时值，因为minChronaxie,minChronaxieInterval等参数限制，有些时值是不能用的
export function normalizeChronaxie(
  value: unknown,
  rules: ChronaxieRules = resolveChronaxieRules(undefined, undefined),
): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_CHRONAXIE;
  //
  const clamped = Math.min(rules.maxChronaxie, Math.max(rules.minChronaxie, Math.round(num)));
  // 获取距离标准时值最近的时值

  // 获取所有允许的音符时值
  const values = getStandardChronaxieValues(rules);
  // 如果包含了当前时值，直接返回
  if (values.includes(clamped)) return clamped;
  let closest = values[0];
  // 防止不标准音符出现，如果出现了，则修改为最近的标准音符
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
// 安全的解构note
export function sanitizeNote(
  note: RawNote = {},
  lyric?: string,
  rules: ChronaxieRules = resolveChronaxieRules(undefined, undefined),
): SanitizedNote {
  const rest = note.rest === true;
  const midi = rest ? 0 : clampMidi(note.midi) ?? 60;
  const chronaxie = normalizeChronaxie(note.chronaxie, rules);
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

const pentatonic = [0, 2, 4, 7, 9]

function isInPentatonic(m: number) {
    return pentatonic.includes(m % 12)
}
/*
* 推荐音高算法
* */
export function recommendMidiReplace(
    index: number,
    notes: { midi: number }[],
): number[] {

    const cur = notes[index]
    if (!cur) return []

    const pre = notes[index - 1]
    const next = notes[index + 1]

    const cand: number[] = []

    // 允许更丰富音程
    const pushAround = (m: number) => {
        cand.push(
            m,
            m + 2, m - 2,
            m + 3, m - 3,
            m + 4, m - 4,
            m + 5, m - 5
        )
    }

    // 1. 前后中值
    if (pre && next) {
        cand.push(Math.round((pre.midi + next.midi) / 2))
    }

    // 2. 靠近前音
    if (pre) pushAround(pre.midi)

    // 3. 靠近后音
    if (next) pushAround(next.midi)

    // 4. 加入当前音作为兜底
    cand.push(cur.midi)

    // 去重
    let unique = [...new Set(cand)]

    // 5. 五声音阶过滤（放宽）
    let pent = unique.filter(isInPentatonic)

    // 如果全部被过滤掉了，fallback 到全部候选
    if (pent.length === 0) pent = unique

    // 6. 跳跃过滤（放宽到 12 半音）
    const limitRange = 12

    const limit = (v: number) => {
        if (pre && Math.abs(v - pre.midi) > limitRange) return false
        if (next && Math.abs(v - next.midi) > limitRange) return false
        return true
    }

    let filtered = pent.filter(limit)

    // 7. 如果又被过滤完了，fallback 一个最接近 pre 或 next 的
    if (filtered.length === 0 && pent.length > 0) {
        const target = next?.midi ?? pre?.midi ?? cur.midi
        filtered = pent.slice().sort((a, b) =>
            Math.abs(a - target) - Math.abs(b - target)
        ).slice(0, 1)
    }

    // 8. 排序：综合靠近 pre/next
    filtered.sort((a, b) => {
        const score = (x: number) => {
            let s = 0
            if (next) s += Math.abs(x - next.midi)
            if (pre) s += Math.abs(x - pre.midi)
            return s
        }
        return score(a) - score(b)
    })

    // 去掉当前音（如果你不希望把原音作为推荐）
    // filtered = filtered.filter(v => v !== cur.midi)

    return filtered
}
