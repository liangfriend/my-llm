"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.similarityScore = similarityScore;
exports.buildProbabilityModel = buildProbabilityModel;
const note_1 = require("./note");
// 加权
function addCount(map, key, weight) {
    map.set(key, (map.get(key) || 0) + weight);
}
// 通过概率获取数据
function sampleFromMap(countMap, fallback = null, range) {
    let entries = Array.from(countMap.entries());
    // 对样本进行范围过滤
    if (range) {
        entries = entries.filter(([value]) => value >= range.min && value <= range.max);
    }
    if (!entries.length)
        return fallback;
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total <= 0)
        return fallback;
    let r = Math.random() * total;
    // TODO 这里后续可能要优化，概率低的就不要了，根据countMap的长度，要对countMap进行过滤
    for (const [value, count] of entries) {
        r -= count;
        if (r <= 0)
            return Number(value);
    }
    return fallback;
}
// 计算权重
function similarityScore(exampleParams = {}, requestParams = {}) {
    const keys = Object.keys(requestParams || {});
    if (!keys.length)
        return 1;
    let score = 1;
    keys.forEach(key => {
        const expected = requestParams[key];
        const actual = exampleParams[key];
        if (actual === undefined) {
            score *= 0.7;
            return;
        }
        if (typeof expected === 'number' && typeof actual === 'number') {
            const distance = Math.abs(expected - actual);
            score *= 1 / (1 + distance);
            return;
        }
        if (typeof expected === 'string' && typeof actual === 'string') {
            score *= expected === actual ? 1.6 : 0.5;
            return;
        }
        score *= expected === actual ? 1.2 : 0.8;
    });
    return score;
}
// 创建概率模型
function buildProbabilityModel(examples = [], requestParams = {}) {
    var _a, _b;
    const midiCounts = new Map();
    const transitionMidiCounts = new Map();
    const transitionChronaxieCounts = new Map();
    const chronaxieCounts = new Map();
    // 遍历所有样本数据
    examples.forEach(example => {
        const melody = Array.isArray(example.melody)
            ? example.melody
            : Array.isArray(example.output)
                ? example.output
                : [];
        const weight = similarityScore(example.params || {}, requestParams);
        let prevMidi = null;
        // 遍历所有旋律
        melody.forEach(note => {
            if (note.rest === true) {
                const restChronaxie = (0, note_1.normalizeChronaxie)(note.chronaxie);
                addCount(chronaxieCounts, restChronaxie, weight);
                return;
            }
            const midi = (0, note_1.clampMidi)(note.midi);
            const chronaxie = (0, note_1.normalizeChronaxie)(note.chronaxie);
            if (midi === null)
                return;
            // midi加权
            addCount(midiCounts, midi, weight);
            // chronaxie加权
            addCount(chronaxieCounts, chronaxie, weight);
            // 上一个音符加权
            if (prevMidi !== null) {
                if (!transitionMidiCounts.has(prevMidi)) {
                    transitionMidiCounts.set(prevMidi, new Map());
                }
                addCount(transitionMidiCounts.get(prevMidi), midi, weight);
                if (!transitionChronaxieCounts.has(prevMidi)) {
                    transitionChronaxieCounts.set(prevMidi, new Map());
                }
                addCount(transitionChronaxieCounts.get(prevMidi), chronaxie, weight);
            }
            prevMidi = midi;
        });
    });
    const fallbackMidi = midiCounts.size ? (_a = sampleFromMap(midiCounts, 60)) !== null && _a !== void 0 ? _a : 60 : 60;
    // 通过上一个音符进行概率计算拿到现在的音符
    function sampleMidi(prevMidi, range) {
        const transitions = prevMidi !== null ? transitionMidiCounts.get(prevMidi) : undefined;
        const fallbackInRange = range
            ? Math.min(range.max, Math.max(range.min, fallbackMidi))
            : fallbackMidi;
        const trySample = (map) => {
            if (!map || !map.size)
                return null;
            return sampleFromMap(map, fallbackInRange, range);
        };
        let sampled = trySample(transitions);
        if (sampled === null)
            sampled = trySample(midiCounts);
        return sampled !== null && sampled !== void 0 ? sampled : fallbackInRange;
    }
    const fallbackChronaxie = chronaxieCounts.size
        ? (_b = sampleFromMap(chronaxieCounts, note_1.DEFAULT_CHRONAXIE)) !== null && _b !== void 0 ? _b : note_1.DEFAULT_CHRONAXIE
        : note_1.DEFAULT_CHRONAXIE;
    // 通过概率计算拿到时值
    function sampleChronaxie(prevMidi) {
        var _a, _b;
        const transitions = prevMidi !== null ? transitionChronaxieCounts.get(prevMidi) : undefined;
        if (transitions && transitions.size)
            return (_a = sampleFromMap(transitions, fallbackChronaxie)) !== null && _a !== void 0 ? _a : fallbackChronaxie;
        if (chronaxieCounts.size)
            return (_b = sampleFromMap(chronaxieCounts, fallbackChronaxie)) !== null && _b !== void 0 ? _b : fallbackChronaxie;
        return note_1.DEFAULT_CHRONAXIE;
    }
    return { sampleMidi, sampleChronaxie, usedExamples: examples.length };
}
