/**
 * 旋律生成入口。
 * 当前完成第 1 步（状态初始化）与第 2 步（样本过滤），melody 仍返回空数组。
 */
import { createGenerationState, parseGenerateOptions } from './generationState';
import { filterSamplesStep2 } from './sampleFilter';
import { loadTrainingData } from './storage';
import { GenerateResult } from '../type';

export function generateMelody(body: unknown): GenerateResult {
  const parsed = parseGenerateOptions(body);
  if (!parsed.ok) {
    return { melody: [], state: 'error' };
  }

  const state = createGenerationState(parsed.options);
  const trainingData = loadTrainingData();
  filterSamplesStep2(state, trainingData.examples);

  return { melody: [], state: 'success' };
}

export { createGenerationState, parseGenerateOptions } from './generationState';
export { filterSamplesStep2 } from './sampleFilter';
