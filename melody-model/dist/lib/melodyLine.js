"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMelodyLine = buildMelodyLine;
exports.melodyLineKey = melodyLineKey;
exports.melodyLineSimilarity = melodyLineSimilarity;
const constants_1 = require("./constants");
const note_1 = require("./note");
/**
 * 将一句旋律转为旋律线（见 doc/重构算法规则.md）。
 * 以 8 为 chronaxie 单位，取句内最小 midi 作为基准，休止符记为 0。
 */
function buildMelodyLine(melody) {
    if (!melody.length)
        return [];
    const pitched = melody.filter(note => !(0, note_1.isRestMidi)(note.midi));
    const minMidi = pitched.length ? Math.min(...pitched.map(note => note.midi)) : 0;
    const line = [];
    melody.forEach(note => {
        const units = Math.max(1, Math.round(note.chronaxie / constants_1.MELODY_LINE_UNIT));
        const value = (0, note_1.isRestMidi)(note.midi) ? 0 : note.midi - minMidi;
        for (let i = 0; i < units; i += 1) {
            line.push(value);
        }
    });
    return line;
}
/** 旋律线序列化，用作第 4 步权重表的 key */
function melodyLineKey(line) {
    return JSON.stringify(line);
}
/**
 * 两条旋律线的相似度，返回 0~1（供第 4 步权重计算使用）。
 * 按较短长度逐格比较相等占比，再除以较长长度 penalize 长度差异。
 */
function melodyLineSimilarity(lineA, lineB) {
    if (!lineA.length && !lineB.length)
        return 1;
    if (!lineA.length || !lineB.length)
        return 0;
    const minLen = Math.min(lineA.length, lineB.length);
    const maxLen = Math.max(lineA.length, lineB.length);
    let matches = 0;
    for (let i = 0; i < minLen; i += 1) {
        if (lineA[i] === lineB[i])
            matches += 1;
    }
    return matches / maxLen;
}
