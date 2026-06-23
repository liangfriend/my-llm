/**
 * 第 6 步：将剩余未分配时值并入最后一个音符，使总时值尽量贴近 targetTotalChronaxie。
 */
import { MAX_LAST_NOTE_CHRONAXIE } from './constants';
import { GenerationState } from '../type';
import {
  getRemainingUnallocatedChronaxie,
  isChronaxieAllowedForState,
} from './generationState';
import { getStandardChronaxieValues, resolveChronaxieRules } from './note';

/** 取不超过 value 且符合时值规则的最大允许时值 */
function snapChronaxieDownToRules(state: GenerationState, chronaxie: number): number {
  if (isChronaxieAllowedForState(state, chronaxie)) return chronaxie;

  const rules = resolveChronaxieRules(state.minChronaxie, state.minChronaxieInterval);
  const allowed = getStandardChronaxieValues(rules).filter(value => value <= chronaxie);
  if (!allowed.length) return rules.minChronaxie;
  return allowed[allowed.length - 1];
}

function syncAccumulatedChronaxie(state: GenerationState): void {
  state.currentAccumulatedChronaxie = state.generatedMelody.reduce(
    (sum: number, note) => sum + note.chronaxie,
    0,
  );
}

/**
 * 第 6 步：剩余时值 > 0 时并入最后一音；< 0 时不处理。
 * 未传 targetTotalChronaxie 或尚无音符时跳过。
 */
export function adjustTotalChronaxieStep6(state: GenerationState): void {
  const remaining = getRemainingUnallocatedChronaxie(state);
  if (remaining === null || remaining <= 0 || !state.generatedMelody.length) {
    return;
  }

  const lastIndex = state.generatedMelody.length - 1;
  const lastNote = state.generatedMelody[lastIndex];
  const merged = lastNote.chronaxie + remaining;

  if (merged >= MAX_LAST_NOTE_CHRONAXIE) {
    return;
  }

  let nextChronaxie = snapChronaxieDownToRules(state, merged);
  state.generatedMelody[lastIndex] = {
    ...lastNote,
    chronaxie: nextChronaxie,
  };
  syncAccumulatedChronaxie(state);
}
