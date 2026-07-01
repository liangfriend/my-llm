import fs from 'fs';
import path from 'path';
import type { Notation } from '../notation';
import { createInitialWeights, getNumClasses, SymbolCnn } from './model';
import type { CnnWeights } from './types';

const MODEL_DIR = path.resolve(__dirname, '../..');

export function weightsFilePath(notation: Notation): string {
  return path.join(MODEL_DIR, `weights-${notation}.json`);
}

function isValidWeights(data: unknown): data is CnnWeights {
  if (!data || typeof data !== 'object') return false;
  const w = data as CnnWeights;
  return (
    w.version === 1 &&
    (w.notation === 's' || w.notation === 'n') &&
    typeof w.numClasses === 'number' &&
    w.conv1?.weights != null &&
    w.fc2?.weights != null
  );
}

export function loadWeights(notation: Notation): CnnWeights {
  const filePath = weightsFilePath(notation);
  if (fs.existsSync(filePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (isValidWeights(raw) && raw.notation === notation) {
        return raw;
      }
      console.warn(`[weights] ${filePath} 格式无效，将重新初始化`);
    } catch {
      console.warn(`[weights] ${filePath} 读取失败，将重新初始化`);
    }
  }

  const weights = createInitialWeights(notation, getNumClasses(notation));
  saveWeights(weights);
  return weights;
}

export function saveWeights(weights: CnnWeights): void {
  const filePath = weightsFilePath(weights.notation);
  fs.writeFileSync(filePath, JSON.stringify(weights, null, 2), 'utf-8');
}

const modelCache = new Map<Notation, SymbolCnn>();

export function getModel(notation: Notation): SymbolCnn {
  let model = modelCache.get(notation);
  if (!model) {
    model = new SymbolCnn(loadWeights(notation));
    modelCache.set(notation, model);
  }
  return model;
}

export function trainAndSave(
  notation: Notation,
  matrix: number[][],
  label: number,
  lr: number
) {
  const model = getModel(notation);
  const result = model.trainStep(matrix, label, lr);
  saveWeights(model.weights);
  return result;
}

export function predict(notation: Notation, matrix: number[][]) {
  const model = getModel(notation);
  return model.predict(matrix);
}
