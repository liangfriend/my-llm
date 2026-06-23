import fs from 'fs';
import { DATA_FILE } from './constants';
import { SampleMelody, TrainingData, TrainingExample } from '../type';
import logger from './logger';

/**
 * 将样本中每句旋律 chronaxie×2 的副本追加到 melody 尾部，实现 2x 数据扩增。
 * 仅用于生成流程，不写回 training-data.json。
 */
export function augmentSampleMelody2x(melody: SampleMelody): SampleMelody {
  const doubled = melody.map(sentence =>
    sentence.map(note => ({
      ...note,
      chronaxie: note.chronaxie * 2,
    })),
  );
  return [...melody, ...doubled];
}

export function augmentTrainingExamples2x(examples: TrainingExample[]): TrainingExample[] {
  return examples.map(example => {
    if (!example.melody?.length) return example;
    return {
      ...example,
      melody: augmentSampleMelody2x(example.melody),
    };
  });
}

// 读取训练数据
export function loadTrainingData(): TrainingData {
  try {
      console.log('样本路径',DATA_FILE)
      logger.log('样本路径',DATA_FILE)
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const data: unknown = JSON.parse(content);
      console.log('样本数据',data)
      logger.log('样本数据',data)
    if (!data || !Array.isArray((data as any).examples)) {

      return { examples: [] };
    }
    return data as TrainingData;
  } catch (err) {
      console.log('样本数据获取不到',err)
      logger.error('样本数据获取不到',err)
    return { examples: [] };
  }
}

export function saveTrainingData(data: TrainingData): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
