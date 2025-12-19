import fs from 'fs';
import { DATA_FILE } from './constants';
import { RawNote } from './note';
import {TrainingData} from "../type";
import logger from "./logger";


// 保存训练数据
export function loadTrainingData(): TrainingData {
  try {
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
