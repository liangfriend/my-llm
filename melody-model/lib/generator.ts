/**
 * 旋律生成入口（第 1～5 步完整流程，26.6.23 句级重构）。
 */
import {
  createGenerationState,
  parseGenerateOptions,
  validateGenerationParams,
} from './generationState';
import { filterSamplesStep2 } from './sampleFilter';
import { buildSampleSentenceIndexStep3 } from './sampleSentenceIndex';
import { pickTargetSampleSentenceStep4 } from './targetSampleSentence';
import { mergeTargetSampleSentenceStep5 } from './sentenceMerge';
import { loadTrainingData, augmentTrainingExamples2x } from './storage';
import { GenerateResult } from '../type';

export function generateMelody(body: unknown): GenerateResult {
  // 检验参数是否合法
  const parsed = parseGenerateOptions(body);
  if (!parsed.ok) {
    return { melody: [], state: 'error', message: parsed.error };
  }
  // 获取当前状态信息
  const state = createGenerationState(parsed.options);
  // 验证状态信息
  const paramError = validateGenerationParams(state);
  if (paramError) {
    return { melody: [], state: 'error', message: paramError };
  }
  // 加载样本数据
  const trainingData = loadTrainingData();
  // 将样本数据扩展时值填充
  const examples = augmentTrainingExamples2x(trainingData.examples);
  //
  filterSamplesStep2(state, examples);
  buildSampleSentenceIndexStep3(state);
  pickTargetSampleSentenceStep4(state);
  mergeTargetSampleSentenceStep5(state);

  if (!state.generatedMelody.length && !state.targetSampleSentence) {
    return {
      melody: [],
      state: 'error',
      message: '未找到匹配的样本句，请检查 params 或训练数据',
    };
  }

  return { melody: state.generatedMelody, state: 'success' };
}

export { createGenerationState, parseGenerateOptions } from './generationState';
export { filterSamplesStep2 } from './sampleFilter';
export { buildSampleSentenceIndexStep3 } from './sampleSentenceIndex';
export { pickTargetSampleSentenceStep4 } from './targetSampleSentence';
export { mergeTargetSampleSentenceStep5 } from './sentenceMerge';
