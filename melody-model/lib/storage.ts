import fs from 'fs';
import { DATA_FILE } from './constants';
import { RawNote } from './note';
import {TrainingData} from "../type";


// 保存训练数据
export function loadTrainingData(): TrainingData {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const data: unknown = JSON.parse(content);
    if (!data || !Array.isArray((data as any).examples)) {
      return { examples: [] };
    }
    return data as TrainingData;
  } catch (err) {
    return { examples: [] };
  }
}

export function saveTrainingData(data: TrainingData): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
