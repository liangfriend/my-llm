import { buildProbabilityModel, ProbabilityModel, MidiRange } from './probabilityModel';
import { loadTrainingData } from './storage';
import {
  clampMidi,
  normalizeChronaxie,
  resolveTargetLength,
  sanitizeNote,
  Melody,
  RawNote,
  SanitizedNote,
  recommendMidiReplace,
  ChronaxieRules,
  resolveChronaxieRules,
} from './note';
import { GenerateOptions, GenerateResult } from '../type';

interface FillNoteOptions {
  targetChronaxie?: number;
  overExpected?: boolean;
  midiRange?: MidiRange;
  chronaxieRules?: ChronaxieRules;
}
// 是否是正数
function isPositiveNumber(value: unknown): value is number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function normalizeMidiBound(value: unknown): number | null {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return null;
  return Math.min(128, Math.max(1, num));
}

function resolveMidiRange(minMidi: unknown, maxMidi: unknown): MidiRange {
  let min = normalizeMidiBound(minMidi) ?? 1;
  let max = normalizeMidiBound(maxMidi) ?? 128;
  if (min > max) {
    [min, max] = [max, min];
  }
  return { min, max };
}
// 检索note,使其保持在midi范围内
function keepMidiInRange(note: SanitizedNote, melody: Melody, range: MidiRange): SanitizedNote {
  if (note.rest) return note;
  const { min, max } = range;
  const inRange = note.midi >= min && note.midi <= max;
  if (inRange) return note;

  const tempNotes = [...melody, { midi: note.midi }];
  const recommended = recommendMidiReplace(melody.length, tempNotes) || [];
  const boundedCandidate = recommended.find(m => m >= min && m <= max);

  if (boundedCandidate !== undefined) {
    return { ...note, midi: boundedCandidate };
  }

  const prev = melody[melody.length - 1];
  if (prev && !prev.rest) {
    const snappedPrev = Math.min(max, Math.max(min, prev.midi));
    return { ...note, midi: snappedPrev };
  }

  const clamped = Math.min(max, Math.max(min, note.midi));
  return { ...note, midi: clamped };
}

// 填充音符
export function fillNote(
  seedNote: RawNote,
  lyric: string | undefined,
  model: ProbabilityModel,
  prevMidi: number | null,
  options: FillNoteOptions = {},
): SanitizedNote {
  const rules = options.chronaxieRules || resolveChronaxieRules(undefined, undefined);
  const note: RawNote = { ...seedNote };
  if (lyric !== undefined) note.lyrics = lyric;
  const sampledMidi = model.sampleMidi(prevMidi, options.midiRange);
  const midi = clampMidi(note.midi);
  note.midi = midi ?? sampledMidi;
    // 是否有时值
  const hasChronaxieOverride = note.chronaxie !== undefined;
  // 有时值使用时值，没有时值获取时值
  const sampledChronaxie = hasChronaxieOverride
    ? normalizeChronaxie(note.chronaxie, rules)
    : model.sampleChronaxie(prevMidi);
    // 约束时值
  let chronaxie = normalizeChronaxie(sampledChronaxie, rules);
  // 传入数据没有时值且标准时值存在的情况下，对生成的时值和目标时值相比进行误差缩小
  if (!hasChronaxieOverride && options.targetChronaxie !== undefined && isPositiveNumber(options.targetChronaxie)) {
    const target = normalizeChronaxie(options.targetChronaxie, rules);
    chronaxie = normalizeChronaxie(
      target + Math.round((chronaxie - target) / 2),
      rules,
    );
  }
    // 传入数据没有时值且当前时值超出累加器的时候的情况下，对目标时值和获取的时值取最小值
  if (!hasChronaxieOverride && options.overExpected !== undefined ) {
    // TODO 目前，即使没有剩余时值，也会返回128
    const boundedTarget = normalizeChronaxie(options.targetChronaxie, rules);
    chronaxie = Math.min(chronaxie, boundedTarget);
  }

  note.chronaxie = chronaxie;
  return sanitizeNote(note, undefined, rules);
}
// 添加休止符
function addRestDuration(duration: number, melody: Melody, rules: ChronaxieRules): number {
  let remaining = Math.round(duration);
  let added = 0;
  while (remaining >= rules.minChronaxie) {
    const chunk = Math.min(remaining, rules.maxChronaxie);
    const restNote = sanitizeNote({ rest: true, chronaxie: chunk }, undefined, rules);
    melody.push(restNote);
    added += restNote.chronaxie;
    remaining -= restNote.chronaxie;
    if (restNote.chronaxie <= 0) break;
  }
  return added;
}
// 如果当前时值还是大于总时值，将剩余时值并入最后一个音符
function adjustMelodyToTotalChronaxie(
  melody: Melody,
  targetTotal: number,
  rules: ChronaxieRules,
): Melody {
  if (!Number.isFinite(targetTotal) || !melody.length) {
    return melody;
  }

  const currentTotal = melody.reduce((sum, note) => sum + note.chronaxie, 0);
  const diff = targetTotal - currentTotal;
  if (diff === 0) return melody;
    const lastIdx = melody.length - 1;
  const mergedChronaxie = normalizeChronaxie(melody[lastIdx].chronaxie + diff, rules);
  const adjusted = melody.slice(0, lastIdx).concat({
    ...melody[lastIdx],
    chronaxie: mergedChronaxie,
  });
  return adjusted;
}

// 旋律生成入口函数
export function generateMelody({
  text,
  seedMelody,
  length,
  params,
  totalChronaxie,
  minMidi,
  maxMidi,
  minChronaxie,
  minChronaxieInterval,
}: GenerateOptions): GenerateResult {
    // 加载训练样本数据
  const data = loadTrainingData();
  // 创建模型
  const model = buildProbabilityModel(data.examples, params || {});
  // 歌词数组
  const chars = typeof text === 'string' ? Array.from(text) : [];
  // 种子数据
  const seed = Array.isArray(seedMelody) ? seedMelody : [];
  // 目标长度
  const targetLength = resolveTargetLength(length, chars.length, seed.length);
  const melody: Melody = [];
  let prevMidi: number | null = null;
  const warnings: string[] = [];
    // 约束总时值
  const totalChronaxieNumber = isPositiveNumber(totalChronaxie)
    ? Math.round(Number(totalChronaxie))
    : null;
  // 时值范围
  const midiRange = resolveMidiRange(minMidi, maxMidi);
  const chronaxieRules = resolveChronaxieRules(minChronaxie, minChronaxieInterval);
  // 每个音符的标准时值
  const standardChronaxie =
    totalChronaxieNumber !== null && targetLength > 0
      ? totalChronaxieNumber / targetLength
      : null;
    // 累加时值
  let accumulatedChronaxie = 0;

  if (totalChronaxieNumber !== null && targetLength > seed.length && seed.length) {
    const seedChronaxieTotal = seed.reduce((sum, note) => {
      const val = Number(note.chronaxie);
      return Number.isFinite(val) ? sum + normalizeChronaxie(val, chronaxieRules) : sum;
    }, 0);
    if (seedChronaxieTotal > totalChronaxieNumber) {
      warnings.push('种子数据时值比总时值还多，老弟，你这不对');
    }
  }

  for (let i = 0; i < targetLength; i += 1) {
    const lyric = chars[i];
    const seedNote: RawNote = seed[i] || {};
    const insideSeed = i < seed.length;
    // 预期当前总时值
    const expectedBefore = standardChronaxie !== null ? standardChronaxie * i : null;
    // 是否超出预期
    const overExpected = expectedBefore !== null && accumulatedChronaxie > expectedBefore;
    // 填充音符，内部会对midi范围进行一次过滤
    const filled = fillNote(seedNote, lyric, model, prevMidi, {
      targetChronaxie: standardChronaxie !== null ? standardChronaxie : undefined,
      overExpected: overExpected && standardChronaxie !== null,
      midiRange,
      chronaxieRules,
    });
    // 如果fillNote对范围过滤失败（样本中不存在范围内midi），改为生成范围内推荐音符
    const bounded = keepMidiInRange(filled, melody, midiRange);
    melody.push(bounded);
    // 对时值进行累加
    accumulatedChronaxie += bounded.chronaxie;
    // 赋值prevMidi
    if (!bounded.rest) prevMidi = bounded.midi;
    // 当设定了均分的目标时值时，如果当前累计时值落后，尝试在预算内插入休止符补齐节奏
    // 种子数据区间不插入休止符，避免修改用户给定的音符
    if (standardChronaxie !== null && !insideSeed) {
      const totalBudget = totalChronaxieNumber!;
        // 理想情况下加完当前音符后的总时值
      const expectedAfterCurrent = standardChronaxie * (i + 1);
      // 和理想情况的偏差
      const deficit = expectedAfterCurrent - accumulatedChronaxie;
      // 剩余长度
      const remainingLyricNotes = targetLength - (i + 1);
      //最小情况下所需时值
      const minBudgetForLyrics = remainingLyricNotes * chronaxieRules.minChronaxie;
      // 剩余时值
      const remainingBudget = totalBudget - accumulatedChronaxie;
        // 如果剩余时值-最小情况下所需时值>最小音符时值，说明可以添加休止符
      const canInsertRest = remainingBudget - minBudgetForLyrics >= chronaxieRules.minChronaxie;
      // 如果当前时值不够，且不够的偏差超出了标准音符的1/4
      // TODO 如果是种子数据之内，不应该穿插休止符
      if (deficit > standardChronaxie * 0.25 && canInsertRest) {
        const maxRest = remainingBudget - minBudgetForLyrics;
        const restDuration = Math.min(deficit, maxRest);
        if (restDuration >= chronaxieRules.minChronaxie) {
          const added = addRestDuration(restDuration, melody, chronaxieRules);
          accumulatedChronaxie += added;
        }
      }
    }
  }
  // 收尾时，如果时值不够，添加休止符（也有可能添加不上，如果剩余时值 < 最小时值）
  if (totalChronaxieNumber !== null && accumulatedChronaxie < totalChronaxieNumber) {
    const added = addRestDuration(
      totalChronaxieNumber - accumulatedChronaxie,
      melody,
      chronaxieRules,
    );
    accumulatedChronaxie += added;
  }
    // 如果休止符添加不了，说明还剩下很小的时值，并入最后一个音符
  const finalMelody =
    totalChronaxieNumber !== null && melody.length
      ? adjustMelodyToTotalChronaxie(melody, totalChronaxieNumber, chronaxieRules)
      : melody;

  return { melody: finalMelody, usedExamples: model.usedExamples, targetLength, warnings };
}
