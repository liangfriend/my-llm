"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORBIDDEN_PHRASE_START_BY_ENDING = exports.UNSTABLE_ENDING_DEGREES = void 0;
exports.parseKeyParam = parseKeyParam;
exports.getScaleDegree = getScaleDegree;
exports.isUnstableEndingDegree = isUnstableEndingDegree;
exports.isForbiddenPhraseConnection = isForbiddenPhraseConnection;
/** 大调 / 自然小调主音（本音区 1 的 MIDI），见 doc/midi对照.md */
const MAJOR_TONIC = {
    c: 60,
    g: 67,
    d: 62,
    a: 69,
    e: 64,
    b: 71,
    'f#': 66,
    fs: 66,
    'gb': 66,
    f: 65,
    bb: 70,
    'a#': 70,
    eb: 63,
    'd#': 63,
    ab: 68,
    'g#': 68,
    db: 61,
    'c#': 61,
    cs: 61,
};
/** 自然小调主音（本音区 1）；未列出的按关系小调推算 */
const MINOR_TONIC = {
    a: 69,
    e: 64,
    b: 71,
    'f#': 66,
    fs: 66,
    'c#': 61,
    cs: 61,
    'g#': 68,
    d: 62,
    g: 67,
    c: 60,
    f: 65,
    bb: 70,
    eb: 63,
};
const MAJOR_SEMITONE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SEMITONE_OFFSETS = [0, 2, 3, 5, 7, 8, 10];
/** 尾音为 true 时需排除的下一句句尾音级（大调 / 自然小调通用） */
exports.UNSTABLE_ENDING_DEGREES = new Set([2, 4, 5, 7]);
/**
 * 前句尾音音级 → 禁止作为下一句起音的音级（大调 / 自然小调通用）。
 * 有 preSentence 时第 3 步据此过滤样本句对，避免跨句衔接不和谐。
 */
exports.FORBIDDEN_PHRASE_START_BY_ENDING = {
    /** 主音收句，起句直跳导音显突兀 */
    1: new Set([7]),
    /** 上主音未解决，避免跳进下属 / 下中 / 导音 */
    2: new Set([4, 6, 7]),
    /** 中音收句，避免直跳导音 */
    3: new Set([7]),
    /** 下属音悬停，避免主音起句断层及大跳 */
    4: new Set([1, 6, 7]),
    /** 属音半终止，避免回下属或导音起句 */
    5: new Set([4, 7]),
    /** 下中音收句，避免回下属或导音起句 */
    6: new Set([4, 7]),
    /** 导音须解决到主音，其余起音均禁止 */
    7: new Set([2, 3, 4, 5, 6, 7]),
};
function resolveKeyContext(keyRaw, fallbackKeyRaw) {
    var _a, _b, _c;
    return ((_c = (_b = (_a = parseKeyParam(keyRaw)) !== null && _a !== void 0 ? _a : parseKeyParam(fallbackKeyRaw)) !== null && _b !== void 0 ? _b : parseKeyParam('C')) !== null && _c !== void 0 ? _c : { tonic: 60, minor: false });
}
function normalizePitchClass(midi) {
    return ((Math.round(midi) % 12) + 12) % 12;
}
function normalizeKeyToken(raw) {
    if (raw === undefined || raw === null)
        return null;
    const token = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    return token || null;
}
/** 解析 params.key，如 C / G / Am / a */
function parseKeyParam(raw) {
    const token = normalizeKeyToken(raw);
    if (!token)
        return null;
    const minorMatch = token.match(/^([a-g](?:#|b)?)m$/);
    if (minorMatch) {
        const name = minorMatch[1];
        const tonic = MINOR_TONIC[name];
        return tonic !== undefined ? { tonic, minor: true } : null;
    }
    const majorTonic = MAJOR_TONIC[token];
    if (majorTonic !== undefined) {
        return { tonic: majorTonic, minor: false };
    }
    return null;
}
/** 求 midi 相对调性的简谱音级 1–7；非调内音返回 null */
function getScaleDegree(midi, tonicMidi, minor) {
    if (!Number.isFinite(midi) || midi <= 0)
        return null;
    const offsets = minor ? MINOR_SEMITONE_OFFSETS : MAJOR_SEMITONE_OFFSETS;
    const interval = (normalizePitchClass(midi) - normalizePitchClass(tonicMidi) + 12) % 12;
    const index = offsets.indexOf(interval);
    return index >= 0 ? index + 1 : null;
}
/** 下一句句尾是否为不稳定的 2 / 4 / 5 / 7 级 */
function isUnstableEndingDegree(lastMidi, keyRaw, fallbackKeyRaw) {
    var _a, _b;
    const key = (_b = (_a = parseKeyParam(keyRaw)) !== null && _a !== void 0 ? _a : parseKeyParam(fallbackKeyRaw)) !== null && _b !== void 0 ? _b : parseKeyParam('C');
    if (!key)
        return false;
    const degree = getScaleDegree(lastMidi, key.tonic, key.minor);
    if (degree === null)
        return false;
    return exports.UNSTABLE_ENDING_DEGREES.has(degree);
}
/** 前句尾音与下一句起音是否属于禁止的跨句衔接 */
function isForbiddenPhraseConnection(prevLastMidi, nextFirstMidi, keyRaw, fallbackKeyRaw) {
    const key = resolveKeyContext(keyRaw, fallbackKeyRaw);
    const endingDegree = getScaleDegree(prevLastMidi, key.tonic, key.minor);
    const startingDegree = getScaleDegree(nextFirstMidi, key.tonic, key.minor);
    if (endingDegree === null || startingDegree === null) {
        return false;
    }
    const forbiddenStarts = exports.FORBIDDEN_PHRASE_START_BY_ENDING[endingDegree];
    if (!forbiddenStarts) {
        return false;
    }
    return forbiddenStarts.has(startingDegree);
}
