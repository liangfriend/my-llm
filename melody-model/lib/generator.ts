import { buildProbabilityModel, ProbabilityModel } from './probabilityModel';
import { loadTrainingData } from './storage';
import {
  clampMidi,
  normalizeChronaxie,
  resolveTargetLength,
  sanitizeNote,
  Melody,
  RawNote,
  SanitizedNote,
} from './note';
import {GenerateOptions, GenerateResult} from "../type";


// 填充音符
export function fillNote(
  seedNote: RawNote,
  lyric: string | undefined,
  model: ProbabilityModel,
  prevMidi: number | null,
): SanitizedNote {
  const note: RawNote = { ...seedNote };
  if (lyric !== undefined) note.lyrics = lyric;
  const sampledMidi = model.sampleMidi(prevMidi);
  const midi = clampMidi(note.midi);
  note.midi = midi ?? sampledMidi;
  const chronaxie =
    note.chronaxie !== undefined
      ? normalizeChronaxie(note.chronaxie)
      : model.sampleChronaxie(prevMidi);
  note.chronaxie = chronaxie;

  return sanitizeNote(note);
}
// 旋律生成入口函数
export function generateMelody({
  text,
  seedMelody,
  length,
  params,
}: GenerateOptions): GenerateResult {
  const data = loadTrainingData();
  const model = buildProbabilityModel(data.examples, params || {});
  const chars = typeof text === 'string' ? Array.from(text) : [];
  const seed = Array.isArray(seedMelody) ? seedMelody : [];
  const targetLength = resolveTargetLength(length, chars.length, seed.length);
  const melody: Melody = [];
  let prevMidi: number | null = null;

  for (let i = 0; i < targetLength; i += 1) {
    const lyric = chars[i];
    const seedNote: RawNote = seed[i] || {};
    const filled = fillNote(seedNote, lyric, model, prevMidi);
    melody.push(filled);
    prevMidi = filled.midi;
  }
  return { melody, usedExamples: model.usedExamples, targetLength };
}

