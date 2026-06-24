/**
 * 训练样本与旋律数据的校验。
 * melody 为句对象数组：{ sentence, totalChronaxie }。
 * 兼容旧版二维数组格式（自动计算 totalChronaxie）。
 */
import {
  isRestMidi,
  parseOptionalMidiBound,
  resolveChronaxieRules,
  sanitizeNote,
} from './note';
import {
  RawNote,
  SampleMelody,
  SampleSentence,
  SanitizedNote,
  TrainingExample,
} from '../type';

export type ValidationResult = { error: string } | { example: TrainingExample };

function sanitizeSentence(notes: RawNote[], rules: ReturnType<typeof resolveChronaxieRules>): SanitizedNote[] {
  return notes.map(note => sanitizeNote(note, rules));
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

/** 将单条 melody 项转为 SampleSentence */
export function normalizeSampleSentenceItem(item: unknown): { error: string } | { sentence: SampleSentence } {
  if (Array.isArray(item)) {
    const validated = validateSentenceMelody(item);
    if ('error' in validated) return validated;
    const totalChronaxie = validated.melody.reduce((sum, note) => sum + note.chronaxie, 0);
    return {
      sentence: {
        sentence: validated.melody,
        totalChronaxie,
      },
    };
  }

  if (item === null || typeof item !== 'object') {
    return { error: 'each item in melody must be a sentence array or { sentence, totalChronaxie }' };
  }

  const record = item as Record<string, unknown>;
  const validated = validateSentenceMelody(record.sentence);
  if ('error' in validated) return validated;

  const parsedTotal = Number(record.totalChronaxie);
  const computedTotal = validated.melody.reduce((sum, note) => sum + note.chronaxie, 0);
  const totalChronaxie =
    Number.isFinite(parsedTotal) && parsedTotal > 0 ? Math.round(parsedTotal) : computedTotal;

  return {
    sentence: {
      sentence: validated.melody,
      totalChronaxie,
    },
  };
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
    return { error: 'melody must be a non-empty array of sentences' };
  }

  const sampleMelody: SampleMelody = [];
  for (const item of melody) {
    const normalized = normalizeSampleSentenceItem(item);
    if ('error' in normalized) {
      return normalized;
    }
    sampleMelody.push(normalized.sentence);
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
