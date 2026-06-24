"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustTotalChronaxieStep6 = adjustTotalChronaxieStep6;
/**
 * 第 6 步：将剩余未分配时值并入最后一个音符，使总时值尽量贴近 targetTotalChronaxie。
 */
const constants_1 = require("./constants");
const generationState_1 = require("./generationState");
const note_1 = require("./note");
/** 取不超过 value 且符合时值规则的最大允许时值 */
function snapChronaxieDownToRules(state, chronaxie) {
    if ((0, generationState_1.isChronaxieAllowedForState)(state, chronaxie))
        return chronaxie;
    const rules = (0, note_1.resolveChronaxieRules)(state.minChronaxie, state.minChronaxieInterval);
    const allowed = (0, note_1.getStandardChronaxieValues)(rules).filter(value => value <= chronaxie);
    if (!allowed.length)
        return rules.minChronaxie;
    return allowed[allowed.length - 1];
}
function syncAccumulatedChronaxie(state) {
    state.currentAccumulatedChronaxie = state.generatedMelody.reduce((sum, note) => sum + note.chronaxie, 0);
}
/**
 * 第 6 步：剩余时值 > 0 时并入最后一音；< 0 时不处理。
 * 未传 targetTotalChronaxie 或尚无音符时跳过。
 */
function adjustTotalChronaxieStep6(state) {
    const remaining = (0, generationState_1.getRemainingUnallocatedChronaxie)(state);
    if (remaining === null || remaining <= 0 || !state.generatedMelody.length) {
        return;
    }
    const lastIndex = state.generatedMelody.length - 1;
    const lastNote = state.generatedMelody[lastIndex];
    const merged = lastNote.chronaxie + remaining;
    if (merged >= constants_1.MAX_LAST_NOTE_CHRONAXIE) {
        return;
    }
    let nextChronaxie = snapChronaxieDownToRules(state, merged);
    state.generatedMelody[lastIndex] = {
        ...lastNote,
        chronaxie: nextChronaxie,
    };
    syncAccumulatedChronaxie(state);
}
