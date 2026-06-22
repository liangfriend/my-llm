import { clampMidi, normalizeChronaxie, DEFAULT_CHRONAXIE } from './note';
import {RawNote, TrainingExample} from '../type';

type CountMap = Map<number, number>;

export interface MidiRange {
  min: number;
  max: number;
}

export interface ProbabilityModel {
  sampleMidi: (prevMidi: number | null, range?: MidiRange) => number;
  sampleChronaxie: (prevMidi: number | null) => number;
  usedExamples: number;
}

// 加权
function addCount(map: CountMap, key: number, weight: number): void {
  map.set(key, (map.get(key) || 0) + weight);
}

// 通过概率获取数据
function sampleFromMap(
  countMap: CountMap,
  fallback: number | null = null,
  range?: MidiRange,
): number | null {
  let entries = Array.from(countMap.entries());
  // 对样本进行范围过滤
  if (range) {
    entries = entries.filter(([value]) => value >= range.min && value <= range.max);
  }
  if (!entries.length) return fallback;

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total <= 0) return fallback;

  let r = Math.random() * total;
  // TODO 这里后续可能要优化，概率低的就不要了，根据countMap的长度，要对countMap进行过滤
  for (const [value, count] of entries) {
    r -= count;
    if (r <= 0) return Number(value);
  }
  return fallback;
}

// 计算标签权重
export function similarityScore(
  exampleParams: Record<string, unknown> = {},
  requestParams: Record<string, unknown> = {},
): number {
  const keys = Object.keys(requestParams || {});
  if (!keys.length) return 1;
  let score = 1;
  keys.forEach(key => {
    const expected = requestParams[key];
    const actual = exampleParams[key];
    if (actual === undefined) {
      score *= 0.7;
      return;
    }
    if (typeof expected === 'number' && typeof actual === 'number') {
      const distance = Math.abs((expected as number) - (actual as number));
      score *= 1 / (1 + distance);
      return;
    }
    if (typeof expected === 'string' && typeof actual === 'string') {
      score *= expected === actual ? 1.6 : 0.5;
      return;
    }
    score *= expected === actual ? 1.2 : 0.8;
  });
  return score;
}

// 创建概率模型
export function buildProbabilityModel(
  examples: TrainingExample[] = [],
  requestParams: Record<string, unknown> = {},
): ProbabilityModel {
  // 音符的midi权重表：midi:weight  这个是备选方案，正常音符使用transitionMidiCounts判断midi,如果没有perv音符或其他情况才用这个
  const midiCounts: CountMap = new Map();
  // 音符的下一个音符midi权重， midi:CountMap 这个还有点意义，利用了上文
  const transitionMidiCounts: Map<number, CountMap> = new Map();
  // 音符的下一个音符时值权重， chronaxie:CountMap 同上，备选方案
  const transitionChronaxieCounts: Map<number, CountMap> = new Map();
  // 音符的时值权重表，chronaxie：weight
  const chronaxieCounts: CountMap = new Map();

  // 遍历所有样本数据
  examples.forEach(example => {
    const melody: RawNote[] = Array.isArray(example.melody)
      ? (example.melody as RawNote[])
      : [];
    // 标签权重
    const weight = similarityScore(example.params || {}, requestParams);
    let prevMidi: number | null = null;

    // 遍历所有旋律
    melody.forEach(note => {
      if (note.rest === true) {
        // 时值要经过标准化
        const restChronaxie = normalizeChronaxie(note.chronaxie);
        // 给该midi加权
        addCount(chronaxieCounts, restChronaxie, weight);
        return;
      }

      const midi = clampMidi(note.midi);
      const chronaxie = normalizeChronaxie(note.chronaxie);
      if (midi === null) return;

      // midi加权
      addCount(midiCounts, midi, weight);
      // chronaxie加权
      addCount(chronaxieCounts, chronaxie, weight);
      // 上一个音符加权
      if (prevMidi !== null) {
        if (!transitionMidiCounts.has(prevMidi)) {
          transitionMidiCounts.set(prevMidi, new Map());
        }
        addCount(transitionMidiCounts.get(prevMidi)!, midi, weight);

        if (!transitionChronaxieCounts.has(prevMidi)) {
          transitionChronaxieCounts.set(prevMidi, new Map());
        }
        addCount(transitionChronaxieCounts.get(prevMidi)!, chronaxie, weight);
      }
      prevMidi = midi;
    });
  });

  const fallbackMidi = midiCounts.size ? sampleFromMap(midiCounts, 60) ?? 60 : 60;
  // 通过上一个音符进行概率计算拿到现在的音符
  function sampleMidi(prevMidi: number | null, range?: MidiRange): number {
    const transitions = prevMidi !== null ? transitionMidiCounts.get(prevMidi) : undefined;
    const fallbackInRange = range
      ? Math.min(range.max, Math.max(range.min, fallbackMidi))
      : fallbackMidi;

    const trySample = (map?: CountMap): number | null => {
      if (!map || !map.size) return null;
      return sampleFromMap(map, fallbackInRange, range);
    };

    let sampled = trySample(transitions);
    if (sampled === null) sampled = trySample(midiCounts);
    return sampled ?? fallbackInRange;
  }

  const fallbackChronaxie = chronaxieCounts.size
    ? sampleFromMap(chronaxieCounts, DEFAULT_CHRONAXIE) ?? DEFAULT_CHRONAXIE
    : DEFAULT_CHRONAXIE;
  // 通过概率计算拿到时值
  function sampleChronaxie(prevMidi: number | null): number {
    const transitions = prevMidi !== null ? transitionChronaxieCounts.get(prevMidi) : undefined;
    if (transitions && transitions.size) return sampleFromMap(transitions, fallbackChronaxie) ?? fallbackChronaxie;
    if (chronaxieCounts.size) return sampleFromMap(chronaxieCounts, fallbackChronaxie) ?? fallbackChronaxie;

    return DEFAULT_CHRONAXIE;
  }

  return { sampleMidi, sampleChronaxie, usedExamples: examples.length };
}
