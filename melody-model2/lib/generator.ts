/**
 * 旋律生成入口（第 1～6 步完整流程）。
 */
import { createGenerationState, parseGenerateOptions } from './generationState';
import { filterSamplesStep2 } from './sampleFilter';
import { buildSampleNoteIndexStep3 } from './sampleNoteIndex';
import { generateNotesStep5 } from './noteGenerator';
import { adjustTotalChronaxieStep6 } from './chronaxieAdjust';
import { pickTargetMelodyLineStep4 } from './targetMelodyLine';
import { loadTrainingData, augmentTrainingExamples2x } from './storage';
import { GenerateResult } from '../type';

export function generateMelody(body: unknown): GenerateResult {
  const parsed = parseGenerateOptions(body);
  if (!parsed.ok) {
    return { melody: [], state: 'error' };
  }

  const state = createGenerationState(parsed.options);
  const trainingData = loadTrainingData();
  const examples = augmentTrainingExamples2x(trainingData.examples);
  filterSamplesStep2(state, examples);
  buildSampleNoteIndexStep3(state);
  pickTargetMelodyLineStep4(state);
  generateNotesStep5(state);
  adjustTotalChronaxieStep6(state);

  return { melody: state.generatedMelody, state: 'success' };
}

export { createGenerationState, parseGenerateOptions } from './generationState';
export { filterSamplesStep2 } from './sampleFilter';
export { buildSampleNoteIndexStep3 } from './sampleNoteIndex';
export { pickTargetMelodyLineStep4 } from './targetMelodyLine';
export { generateNotesStep5 } from './noteGenerator';
export { adjustTotalChronaxieStep6 } from './chronaxieAdjust';
