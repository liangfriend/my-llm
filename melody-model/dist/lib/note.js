"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CHRONAXIE = exports.DEFAULT_CHRONAXIE = void 0;
exports.resolveChronaxieRules = resolveChronaxieRules;
exports.getStandardChronaxieValues = getStandardChronaxieValues;
exports.isRestMidi = isRestMidi;
exports.clampMidi = clampMidi;
exports.normalizeChronaxie = normalizeChronaxie;
exports.sanitizeNote = sanitizeNote;
exports.countLyricsInMelody = countLyricsInMelody;
exports.resolveTargetNoteLength = resolveTargetNoteLength;
exports.parsePositiveInt = parsePositiveInt;
exports.parseOptionalMidiBound = parseOptionalMidiBound;
exports.parseOptionalPositiveInt = parseOptionalPositiveInt;
exports.recommendMidiReplace = recommendMidiReplace;
const constants_1 = require("./constants");
exports.DEFAULT_CHRONAXIE = 128;
exports.MAX_CHRONAXIE = 512;
// 标准音符时值表（如 32=16 分，48=16 分附点），用于合法性校验
const BASE_CHRONAXIE_UNITS = [512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
const MAX_DOTS = 4;
function resolveChronaxieRules(minChronaxie, interval) {
    const parsedMin = Math.round(Number(minChronaxie));
    const parsedInterval = Math.round(Number(interval));
    const min = Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : 32;
    const step = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1;
    return {
        minChronaxie: min,
        maxChronaxie: exports.MAX_CHRONAXIE,
        interval: step,
    };
}
// 获取所有允许的时值数组
function getStandardChronaxieValues(rules) {
    const values = new Set();
    BASE_CHRONAXIE_UNITS.forEach(base => {
        for (let dots = 0; dots <= MAX_DOTS; dots += 1) {
            const factor = 2 - 1 / Math.pow(2, dots);
            const raw = base * factor;
            if (Number.isInteger(raw)) {
                values.add(raw);
            }
        }
    });
    const sorted = Array.from(values)
        .filter(v => v >= rules.minChronaxie && v <= rules.maxChronaxie && v % rules.interval === 0)
        .sort((a, b) => a - b);
    return sorted.length ? sorted : [rules.minChronaxie];
}
/** midi 为 0 表示休止符 */
function isRestMidi(midi) {
    const num = Number(midi);
    return Number.isFinite(num) && Math.round(num) === 0;
}
// 约束 midi：0=休止，1~128=音高
function clampMidi(midi) {
    if (isRestMidi(midi))
        return 0;
    const num = Number(midi);
    if (!Number.isFinite(num))
        return null;
    return Math.min(128, Math.max(1, Math.round(num)));
}
// 标准化时值，因为 minChronaxie、minChronaxieInterval 等参数限制，有些时值是不能用的
function normalizeChronaxie(value, rules) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return exports.DEFAULT_CHRONAXIE;
    const clamped = Math.min(rules.maxChronaxie, Math.max(rules.minChronaxie, Math.round(num)));
    const values = getStandardChronaxieValues(rules);
    if (values.includes(clamped))
        return clamped;
    let closest = values[0];
    let smallestDiff = Math.abs(clamped - closest);
    // 获取距离标准时值最近的那个时值
    for (let i = 1; i < values.length; i += 1) {
        const candidate = values[i];
        const diff = Math.abs(clamped - candidate);
        if (diff < smallestDiff) {
            closest = candidate;
            smallestDiff = diff;
        }
    }
    return closest;
}
// 安全的解构 note
function sanitizeNote(note = {}, lyric, rules) {
    var _a;
    const rest = isRestMidi(note.midi);
    const midi = rest ? 0 : (_a = clampMidi(note.midi)) !== null && _a !== void 0 ? _a : 60;
    const effectiveRules = rules !== null && rules !== void 0 ? rules : resolveChronaxieRules(undefined, undefined);
    const chronaxie = normalizeChronaxie(note.chronaxie, effectiveRules);
    const lyrics = rest ? undefined : lyric !== undefined ? lyric : note.lyrics;
    return { midi, chronaxie, lyrics };
}
/** 统计一句旋律中已分配的歌词字符总数 */
function countLyricsInMelody(melody) {
    return melody.reduce((sum, note) => {
        if (!note.lyrics)
            return sum;
        return sum + Array.from(note.lyrics).length;
    }, 0);
}
/**
 * 解析目标音符长度。
 * 有歌词时至少为歌词字数；无歌词无 totalNoteLength 时用 DEFAULT_NOTE_LENGTH（6）。
 */
function resolveTargetNoteLength(textLength, totalNoteLength) {
    const requested = parsePositiveInt(totalNoteLength);
    if (textLength > 0) {
        if (requested === null || requested < textLength) {
            return textLength;
        }
        return requested;
    }
    if (requested !== null) {
        return requested;
    }
    return constants_1.DEFAULT_NOTE_LENGTH;
}
/** 解析正整数；未传或无效时返回 null */
function parsePositiveInt(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const num = Math.round(Number(value));
    if (!Number.isFinite(num) || num <= 0)
        return null;
    return num;
}
/** 解析可选 midi 边界；未传返回 null，0 保留为休止符标识 */
function parseOptionalMidiBound(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const num = Math.round(Number(value));
    if (!Number.isFinite(num))
        return null;
    if (num === 0)
        return 0;
    return Math.min(128, Math.max(1, num));
}
function parseOptionalPositiveInt(value) {
    return parsePositiveInt(value);
}
const pentatonic = [0, 2, 4, 7, 9];
function isInPentatonic(m) {
    return pentatonic.includes(m % 12);
}
/*
 * 推荐音高算法（第 5 步降级时使用）
 */
function recommendMidiReplace(index, notes) {
    var _a, _b;
    const cur = notes[index];
    if (!cur)
        return [];
    const pre = notes[index - 1];
    const next = notes[index + 1];
    const cand = [];
    const pushAround = (m) => {
        cand.push(m, m + 2, m - 2, m + 3, m - 3, m + 4, m - 4, m + 5, m - 5);
    };
    // 前后中值
    if (pre && next) {
        cand.push(Math.round((pre.midi + next.midi) / 2));
    }
    // 靠近前音
    if (pre)
        pushAround(pre.midi);
    // 靠近后音
    if (next)
        pushAround(next.midi);
    cand.push(cur.midi);
    let unique = [...new Set(cand)];
    // 五声音阶过滤
    let pent = unique.filter(isInPentatonic);
    if (pent.length === 0)
        pent = unique;
    const limitRange = 12;
    const limit = (v) => {
        if (pre && Math.abs(v - pre.midi) > limitRange)
            return false;
        if (next && Math.abs(v - next.midi) > limitRange)
            return false;
        return true;
    };
    let filtered = pent.filter(limit);
    if (filtered.length === 0 && pent.length > 0) {
        const target = (_b = (_a = next === null || next === void 0 ? void 0 : next.midi) !== null && _a !== void 0 ? _a : pre === null || pre === void 0 ? void 0 : pre.midi) !== null && _b !== void 0 ? _b : cur.midi;
        filtered = pent.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target)).slice(0, 1);
    }
    filtered.sort((a, b) => {
        const score = (x) => {
            let s = 0;
            if (next)
                s += Math.abs(x - next.midi);
            if (pre)
                s += Math.abs(x - pre.midi);
            return s;
        };
        return score(a) - score(b);
    });
    return filtered;
}
