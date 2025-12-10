import { sanitizeNote, SanitizedNote, RawNote } from './note';
// 验证旋律是否合法
export type ValidationResult = { error: string } | { melody: SanitizedNote[] };

export function validateIncomingMelody(melody: unknown): ValidationResult {
  if (!Array.isArray(melody) || !melody.length) {
    return { error: 'melody must be a non-empty array' };
  }
  const sanitized = (melody as RawNote[]).map(note => sanitizeNote(note));
  const outOfRange = sanitized.find(n => !n.rest && (n.midi < 1 || n.midi > 128));
  if (outOfRange) {
    return { error: 'midi values must be between 1 and 128' };
  }
  return { melody: sanitized };
}

