"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeTargetSampleSentenceStep5 = mergeTargetSampleSentenceStep5;
const note_1 = require("./note");
function cloneMelody(sentence) {
    return sentence.map(note => ({ ...note }));
}
function sumChronaxie(notes) {
    return notes.reduce((sum, note) => sum + note.chronaxie, 0);
}
/** 切割尾部，使总时值等于目标 */
function trimTailToTotalChronaxie(notes, targetTotal) {
    const result = cloneMelody(notes);
    let total = sumChronaxie(result);
    while (total > targetTotal && result.length > 0) {
        const excess = total - targetTotal;
        const lastIndex = result.length - 1;
        const last = result[lastIndex];
        if (last.chronaxie <= excess) {
            total -= last.chronaxie;
            result.pop();
            continue;
        }
        result[lastIndex] = { ...last, chronaxie: last.chronaxie - excess };
        total = targetTotal;
    }
    return result;
}
/** 找最长音符，以 minChronaxieInterval 为单位对半切割 */
function splitLongestNote(notes, minChronaxie, interval) {
    let maxIndex = -1;
    let maxChronaxie = 0;
    notes.forEach((note, index) => {
        if (note.chronaxie > maxChronaxie) {
            maxChronaxie = note.chronaxie;
            maxIndex = index;
        }
    });
    if (maxIndex < 0)
        return null;
    const target = notes[maxIndex];
    const half = target.chronaxie / 2;
    if (half < minChronaxie)
        return null;
    if ((half - minChronaxie) % interval !== 0)
        return null;
    const first = { ...target, chronaxie: half };
    const second = { ...target, chronaxie: half };
    return [...notes.slice(0, maxIndex), first, second, ...notes.slice(maxIndex + 1)];
}
/** 音符数量不足时反复对半切割最长音 */
function increaseNoteCount(notes, targetCount, minChronaxie, interval) {
    let result = cloneMelody(notes);
    while (result.length < targetCount) {
        const split = splitLongestNote(result, minChronaxie, interval);
        if (!split)
            break;
        result = split;
    }
    return result;
}
/** 音符数量过多时从尾部合并/删除 */
function decreaseNoteCount(notes, targetCount) {
    const result = cloneMelody(notes);
    while (result.length > targetCount && result.length > 1) {
        const last = result.pop();
        if (!last)
            break;
        const prev = result[result.length - 1];
        result[result.length - 1] = {
            ...prev,
            chronaxie: prev.chronaxie + last.chronaxie,
        };
    }
    return result;
}
function matchesTargets(notes, state) {
    if (notes.length !== state.targetNoteLength)
        return false;
    if (state.targetTotalChronaxie === null)
        return true;
    return sumChronaxie(notes) === state.targetTotalChronaxie;
}
/**
 * 第 5 步：拆分融合目标样本句，结果写入 state.generatedMelody。
 */
function mergeTargetSampleSentenceStep5(state) {
    if (!state.targetSampleSentence) {
        state.generatedMelody = [];
        return;
    }
    const rules = (0, note_1.resolveChronaxieRules)(state.minChronaxie, state.minChronaxieInterval);
    let notes = cloneMelody(state.targetSampleSentence.sentence);
    if (matchesTargets(notes, state)) {
        state.generatedMelody = notes;
        return;
    }
    if (state.targetTotalChronaxie !== null && sumChronaxie(notes) !== state.targetTotalChronaxie) {
        notes = trimTailToTotalChronaxie(notes, state.targetTotalChronaxie);
    }
    if (notes.length !== state.targetNoteLength) {
        if (notes.length < state.targetNoteLength) {
            notes = increaseNoteCount(notes, state.targetNoteLength, rules.minChronaxie, rules.interval);
        }
        else {
            notes = decreaseNoteCount(notes, state.targetNoteLength);
        }
    }
    state.generatedMelody = notes;
}
