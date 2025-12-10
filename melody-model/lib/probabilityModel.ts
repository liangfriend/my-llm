import { clampMidi, normalizeChronaxie, RawNote, DEFAULT_CHRONAXIE } from './note';
import { TrainingExample } from '../type';

type CountMap = Map<number, number>;

export interface ProbabilityModel {
  sampleMidi: (prevMidi: number | null) => number;
  sampleChronaxie: (prevMidi: number | null) => number;
  usedExamples: number;
}

// 加权
function addCount(map: CountMap, key: number, weight: number): void {
  map.set(key, (map.get(key) || 0) + weight);
}

// 通过概率获取数据
function sampleFromMap(countMap: CountMap, fallback: number | null = null): number | null {
  const total = Array.from(countMap.values()).reduce((sum, count) => sum + count, 0);
  if (total <= 0) return fallback;

  let r = Math.random() * total;
  // TODO 这里后续可能要优化，概率低的就不要了，根据countMap的长度，要对countMap进行过滤
  for (const [value, count] of countMap.entries()) {
    r -= count;
    if (r <= 0) return Number(value);
  }
  return fallback;
}

// 计算权重
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
  const midiCounts: CountMap = new Map();
  const transitionMidiCounts: Map<number, CountMap> = new Map();
  const transitionChronaxieCounts: Map<number, CountMap> = new Map();
  const chronaxieCounts: CountMap = new Map();

  // 遍历所有样本数据
  examples.forEach(example => {
    const melody: RawNote[] = Array.isArray(example.melody)
      ? (example.melody as RawNote[])
      : Array.isArray(example.output)
        ? (example.output as RawNote[])
        : [];
    const weight = similarityScore(example.params || {}, requestParams);
    let prevMidi: number | null = null;

    // 遍历所有旋律
    melody.forEach(note => {
      if (note.rest === true) {
        const restChronaxie = normalizeChronaxie(note.chronaxie);
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
  function sampleMidi(prevMidi: number | null): number {
    const transitions = prevMidi !== null ? transitionMidiCounts.get(prevMidi) : undefined;
    if (transitions && transitions.size) return sampleFromMap(transitions, fallbackMidi) ?? fallbackMidi;
    if (midiCounts.size) return sampleFromMap(midiCounts, fallbackMidi) ?? fallbackMidi;
    return fallbackMidi;
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

