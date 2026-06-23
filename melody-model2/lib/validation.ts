/**
 * 训练样本与旋律数据的校验。
 * melody 为二维数组：外层=样本内各句，内层=该句音符列表。
 */
import {
  countLyricsInMelody,
  isRestMidi,
  parseOptionalMidiBound,
  resolveChronaxieRules,
  sanitizeNote,
} from './note';
import { RawNote, SampleMelody, SanitizedNote, TrainingExample } from '../type';

export type ValidationResult = { error: string } | { example: TrainingExample };

function sanitizeSentence(notes: RawNote[], rules: ReturnType<typeof resolveChronaxieRules>): SanitizedNote[] {
  return notes.map(note => sanitizeNote(note, undefined, rules));
}

/** 校验单句旋律 */
function validateSentenceMelody(notes: unknown): { error: string } | { melody: SanitizedNote[] } {
  if (!Array.isArray(notes) || !notes.length) {
    return { error: 'each sentence in melody must be a non-empty array' };
  }

  const rules = resolveChronaxieRules(undefined, undefined);
  const sanitized = sanitizeSentence(notes as RawNote[], rules);
  const invalidMidi = sanitized.find(
    note => !isRestMidi(note.midi) && (note.midi < 1 || note.midi > 128),
  );
  if (invalidMidi) {
    return { error: 'midi values must be 0 for rest or between 1 and 128' };
  }

  return { melody: sanitized };
}

/** 校验 POST /melody/train 请求体并转为 TrainingExample */
export function validateTrainingExample(body: unknown): ValidationResult {
  if (body === null || typeof body !== 'object') {
    return { error: 'request body must be an object' };
  }

  const input = body as Record<string, unknown>;
  const { params, minMidi, maxMidi, melody } = input;

  if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
    return { error: 'params must be an object when provided' };
  }
  if (melody === undefined) {
    return { error: 'melody is required' };
  }
  if (!Array.isArray(melody) || !melody.length) {
    return { error: 'melody must be a non-empty 2D array' };
  }

  const sampleMelody: SampleMelody = [];
  for (const sentence of melody) {
    const validated = validateSentenceMelody(sentence);
    if ('error' in validated) {
      return validated;
    }
    sampleMelody.push(validated.melody);
  }

  let min = parseOptionalMidiBound(minMidi);
  let max = parseOptionalMidiBound(maxMidi);
  if (min !== null && min === 0) min = 1;
  if (max !== null && max === 0) max = 128;
  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
  }

  return {
    example: {
      params: (params as Record<string, unknown>) || {},
      minMidi: min ?? undefined,
      maxMidi: max ?? undefined,
      melody: sampleMelody,
    },
  };
}

/** 校验单句旋律（兼容旧调用方） */
export function validateIncomingMelody(melody: unknown): { error: string } | { melody: SanitizedNote[] } {
  return validateSentenceMelody(melody);
}

/** 统计样本中所有句子的歌词字符总数 */
export function countSampleLyrics(melody: SampleMelody): number {
  return melody.reduce((sum, sentence) => sum + countLyricsInMelody(sentence), 0);
}
