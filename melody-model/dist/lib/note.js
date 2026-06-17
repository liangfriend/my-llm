"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_CHRONAXIE_VALUES = exports.DEFAULT_CHRONAXIE_INTERVAL = exports.DEFAULT_MIN_CHRONAXIE = exports.MAX_CHRONAXIE = exports.DEFAULT_CHRONAXIE = void 0;
exports.resolveChronaxieRules = resolveChronaxieRules;
exports.getStandardChronaxieValues = getStandardChronaxieValues;
exports.clampMidi = clampMidi;
exports.normalizeChronaxie = normalizeChronaxie;
exports.sanitizeNote = sanitizeNote;
exports.resolveTargetLength = resolveTargetLength;
exports.recommendMidiReplace = recommendMidiReplace;
const constants_1 = require("./constants");
exports.DEFAULT_CHRONAXIE = 128;
exports.MAX_CHRONAXIE = 512;
exports.DEFAULT_MIN_CHRONAXIE = 32;
exports.DEFAULT_CHRONAXIE_INTERVAL = 1;
// 标准音符时值表（如 32=16 分，48=16 分附点），用于合法性校验
const BASE_CHRONAXIE_UNITS = [512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
const MAX_DOTS = 4;
function resolveChronaxieRules(minChronaxie, interval) {
    const parsedMin = Math.round(Number(minChronaxie));
    const parsedInterval = Math.round(Number(interval));
    const min = Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : exports.DEFAULT_MIN_CHRONAXIE;
    const step = Number.isFinite(parsedInterval) && parsedInterval > 0
        ? parsedInterval
        : exports.DEFAULT_CHRONAXIE_INTERVAL;
    return {
        minChronaxie: min,
        maxChronaxie: exports.MAX_CHRONAXIE,
        interval: step,
    };
}
function buildStandardChronaxieValues(rules) {
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
exports.STANDARD_CHRONAXIE_VALUES = buildStandardChronaxieValues(resolveChronaxieRules(undefined, undefined));
function getStandardChronaxieValues(rules) {
    return buildStandardChronaxieValues(rules);
}
// 防止不标准音符出现，如果出现了，则修改为最近的标准音符
function snapChronaxieToStandard(value, rules) {
    const values = getStandardChronaxieValues(rules);
    if (values.includes(value))
        return value;
    let closest = values[0];
    let smallestDiff = Math.abs(value - closest);
    for (let i = 1; i < values.length; i += 1) {
        const candidate = values[i];
        const diff = Math.abs(value - candidate);
        if (diff < smallestDiff) {
            closest = candidate;
            smallestDiff = diff;
        }
    }
    return closest;
}
// 约束midi
function clampMidi(midi) {
    const num = Number(midi);
    if (!Number.isFinite(num))
        return null;
    return Math.min(128, Math.max(1, Math.round(num)));
}
// 标准化Chronaxie
function normalizeChronaxie(value, rules = resolveChronaxieRules(undefined, undefined)) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return exports.DEFAULT_CHRONAXIE;
    const clamped = Math.min(rules.maxChronaxie, Math.max(rules.minChronaxie, Math.round(num)));
    return snapChronaxieToStandard(clamped, rules);
}
// 安全的解构note
function sanitizeNote(note = {}, lyric, rules = resolveChronaxieRules(undefined, undefined)) {
    var _a;
    const rest = note.rest === true;
    const midi = rest ? 0 : (_a = clampMidi(note.midi)) !== null && _a !== void 0 ? _a : 60;
    const chronaxie = normalizeChronaxie(note.chronaxie, rules);
    const lyrics = rest ? undefined : (lyric !== undefined ? lyric : note.lyrics);
    return { midi, chronaxie, lyrics, rest };
}
// 在传入的数据长度，种子数据长度，歌词长度中选出最长的作为生成数据长度
function resolveTargetLength(requestedLength, textLength, seedLength) {
    var _a;
    const numericLength = Number(requestedLength);
    const requested = Number.isFinite(numericLength) && numericLength > 0 ? Math.round(numericLength) : 0;
    // 如果长度为0，使用默认长度
    return (_a = Math.max(requested, textLength, seedLength)) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_LENGTH;
}
const pentatonic = [0, 2, 4, 7, 9];
function isInPentatonic(m) {
    return pentatonic.includes(m % 12);
}
/*
* 推荐音高算法
* */
function recommendMidiReplace(index, notes) {
    var _a, _b;
    const cur = notes[index];
    if (!cur)
        return [];
    const pre = notes[index - 1];
    const next = notes[index + 1];
    const cand = [];
    // 允许更丰富音程
    const pushAround = (m) => {
        cand.push(m, m + 2, m - 2, m + 3, m - 3, m + 4, m - 4, m + 5, m - 5);
    };
    // 1. 前后中值
    if (pre && next) {
        cand.push(Math.round((pre.midi + next.midi) / 2));
    }
    // 2. 靠近前音
    if (pre)
        pushAround(pre.midi);
    // 3. 靠近后音
    if (next)
        pushAround(next.midi);
    // 4. 加入当前音作为兜底
    cand.push(cur.midi);
    // 去重
    let unique = [...new Set(cand)];
    // 5. 五声音阶过滤（放宽）
    let pent = unique.filter(isInPentatonic);
    // 如果全部被过滤掉了，fallback 到全部候选
    if (pent.length === 0)
        pent = unique;
    // 6. 跳跃过滤（放宽到 12 半音）
    const limitRange = 12;
    const limit = (v) => {
        if (pre && Math.abs(v - pre.midi) > limitRange)
            return false;
        if (next && Math.abs(v - next.midi) > limitRange)
            return false;
        return true;
    };
    let filtered = pent.filter(limit);
    // 7. 如果又被过滤完了，fallback 一个最接近 pre 或 next 的
    if (filtered.length === 0 && pent.length > 0) {
        const target = (_b = (_a = next === null || next === void 0 ? void 0 : next.midi) !== null && _a !== void 0 ? _a : pre === null || pre === void 0 ? void 0 : pre.midi) !== null && _b !== void 0 ? _b : cur.midi;
        filtered = pent.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target)).slice(0, 1);
    }
    // 8. 排序：综合靠近 pre/next
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
    // 去掉当前音（如果你不希望把原音作为推荐）
    // filtered = filtered.filter(v => v !== cur.midi)
    return filtered;
}
