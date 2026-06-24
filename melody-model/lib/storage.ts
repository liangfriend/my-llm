import fs from 'fs';
import { DATA_FILE } from './constants';
import { SampleMelody, TrainingData, TrainingExample } from '../type';
import { normalizeSampleSentenceItem } from './validation';
import logger from './logger';

/** 加载时将 melody 统一为 { sentence, totalChronaxie } 格式 */
export function normalizeExampleMelody(example: TrainingExample): TrainingExample {
  if (!example.melody?.length) return example;
  const melody: SampleMelody = [];
  for (const item of example.melody as unknown[]) {
    const normalized = normalizeSampleSentenceItem(item);
    if ('error' in normalized) continue;
    melody.push(normalized.sentence);
  }
  return { ...example, melody };
}

/**
 * 将样本中每句旋律 chronaxie×2 的副本追加到 melody 尾部，实现 2x 数据扩增。
 * 仅用于生成流程，不写回 training-data.json。
 */
export function augmentSampleMelody2x(melody: SampleMelody): SampleMelody {
  const doubled = melody.map(item => {
    const sentence = item.sentence.map(note => ({
      ...note,
      chronaxie: note.chronaxie * 2,
    }));
    return {
      sentence,
      totalChronaxie: item.totalChronaxie * 2,
    };
  });
  return [...melody, ...doubled];
}

export function augmentTrainingExamples2x(examples: TrainingExample[]): TrainingExample[] {
  return examples.map(example => {
    const normalized = normalizeExampleMelody(example);
    if (!normalized.melody?.length) return normalized;
    return {
      ...normalized,
      melody: augmentSampleMelody2x(normalized.melody),
    };
  });
}

// 读取训练数据
export function loadTrainingData(): TrainingData {
  try {
    console.log('样本路径', DATA_FILE);
    logger.log('样本路径', DATA_FILE);
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const data: unknown = JSON.parse(content);
    console.log('样本数据', data);
    logger.log('样本数据', data);
    if (!data || !Array.isArray((data as TrainingData).examples)) {
      return { examples: [] };
    }
    const examples = (data as TrainingData).examples.map(normalizeExampleMelody);
    return { examples };
  } catch (err) {
    console.log('样本数据获取不到', err);
    logger.error('样本数据获取不到', err);
    return { examples: [] };
  }
}

export function saveTrainingData(data: TrainingData): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
