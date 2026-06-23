"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGenerateOptions = parseGenerateOptions;
exports.createGenerationState = createGenerationState;
exports.getExpectedAccumulatedChronaxie = getExpectedAccumulatedChronaxie;
exports.getMaxChronaxieForCurrentNote = getMaxChronaxieForCurrentNote;
exports.getTargetChronaxieForCurrentNote = getTargetChronaxieForCurrentNote;
exports.updateChronaxieDrift = updateChronaxieDrift;
exports.getRemainingLyricCount = getRemainingLyricCount;
exports.getRemainingNoteCount = getRemainingNoteCount;
exports.canBeRest = canBeRest;
exports.mustAddLyrics = mustAddLyrics;
exports.getPrevNoteFromGenerated = getPrevNoteFromGenerated;
exports.hasMidiRangeLimit = hasMidiRangeLimit;
exports.hasChronaxieIntervalLimit = hasChronaxieIntervalLimit;
exports.isChronaxieAllowedForState = isChronaxieAllowedForState;
exports.getEffectiveMinChronaxie = getEffectiveMinChronaxie;
exports.hasParamsFilter = hasParamsFilter;
exports.isNoteRest = isNoteRest;
exports.getRemainingUnallocatedChronaxie = getRemainingUnallocatedChronaxie;
const melodyLine_1 = require("./melodyLine");
const note_1 = require("./note");
const pinyin_1 = require("./pinyin");
/** 校验并提取 generate 请求体；空 body 视为全部使用默认值 */
function parseGenerateOptions(body) {
    if (body === null || typeof body !== 'object') {
        return { ok: true, options: {} };
    }
    const input = body;
    const { text, totalNoteLength, preSentence, params, totalChronaxie, minMidi, maxMidi, minChronaxie, minChronaxieInterval, } = input;
    if (text !== undefined && typeof text !== 'string') {
        return { ok: false, error: 'text must be a string when provided' };
    }
    if (preSentence !== undefined && !Array.isArray(preSentence)) {
        return { ok: false, error: 'preSentence must be an array when provided' };
    }
    if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
        return { ok: false, error: 'params must be an object when provided' };
    }
    return {
        ok: true,
        options: {
            text,
            totalNoteLength,
            preSentence: preSentence,
            params: params,
            totalChronaxie,
            minMidi,
            maxMidi,
            minChronaxie,
            minChronaxieInterval,
        },
    };
}
/** 标准化 preSentence 音符数组 */
function sanitizePreSentence(notes) {
    if (!Array.isArray(notes) || !notes.length)
        return [];
    const rules = (0, note_1.resolveChronaxieRules)(undefined, undefined);
    return notes.map(note => (0, note_1.sanitizeNote)(note, undefined, rules));
}
/** 从上一句旋律推导第 4、5 步需要的上下文（旋律线、时值、结尾音拼音等） */
function buildPreSentenceContext(melody) {
    if (!melody.length)
        return null;
    const lastNoteRaw = melody[melody.length - 1];
    const lastNote = lastNoteRaw
        ? {
            midi: lastNoteRaw.midi,
            chronaxie: lastNoteRaw.chronaxie,
            pinyin: (0, pinyin_1.toLyricPinyin)(lastNoteRaw.lyrics),
        }
        : null;
    return {
        melody,
        melodyLine: (0, melodyLine_1.buildMelodyLine)(melody),
        totalChronaxie: melody.reduce((sum, note) => sum + note.chronaxie, 0),
        noteCount: melody.length,
        lyricCount: (0, note_1.countLyricsInMelody)(melody),
        lastNote,
    };
}
/**
 * 归一化 midi 范围。
 * 若 min/max 均未传则返回 null；只传一侧时用 1 或 128 补全另一侧。
 */
function normalizeMidiRange(minMidi, maxMidi) {
    let min = (0, note_1.parseOptionalMidiBound)(minMidi);
    let max = (0, note_1.parseOptionalMidiBound)(maxMidi);
    if (min === null && max === null) {
        return { min: null, max: null };
    }
    if (min === null)
        min = 1;
    if (max === null)
        max = 128;
    if (min === 0)
        min = 1;
    if (max === 0)
        max = 128;
    if (min > max) {
        [min, max] = [max, min];
    }
    return { min, max };
}
/**
 * 第 1 步：根据请求参数创建全流程状态。
 * 规则：任一参数未传 → 该维度为 null，后续不做对应限制。
 */
function createGenerationState(options) {
    const text = typeof options.text === 'string' ? Array.from(options.text) : [];
    const targetNoteLength = (0, note_1.resolveTargetNoteLength)(text.length, options.totalNoteLength);
    const targetTotalChronaxie = (0, note_1.parseOptionalPositiveInt)(options.totalChronaxie);
    const expectedAverageChronaxie = targetTotalChronaxie !== null && targetNoteLength > 0
        ? targetTotalChronaxie / targetNoteLength
        : null;
    const midiRange = normalizeMidiRange(options.minMidi, options.maxMidi);
    const minChronaxie = (0, note_1.parseOptionalPositiveInt)(options.minChronaxie);
    const minChronaxieInterval = (0, note_1.parseOptionalPositiveInt)(options.minChronaxieInterval);
    const params = options.params && Object.keys(options.params).length > 0 ? options.params : null;
    const preSentenceMelody = sanitizePreSentence(options.preSentence);
    return {
        text,
        params,
        // 仅当请求体显式传入 minMidi/maxMidi 时才启用音高限制
        minMidi: options.minMidi === undefined || options.minMidi === null || options.minMidi === ''
            ? null
            : midiRange.min,
        maxMidi: options.maxMidi === undefined || options.maxMidi === null || options.maxMidi === ''
            ? null
            : midiRange.max,
        minChronaxie,
        minChronaxieInterval,
        targetTotalChronaxie,
        targetNoteLength,
        currentAccumulatedChronaxie: 0,
        expectedAverageChronaxie,
        chronaxieDrift: 0,
        generatedMelody: [],
        generatedNoteCount: 0,
        preSentence: buildPreSentenceContext(preSentenceMelody),
        // 以下字段在第 2～4 步填充
        filteredSamples: [],
        sampleWeights: [],
        sampleNoteEntries: [],
        sampleNoteWeights: [],
        targetMelodyLine: null,
    };
}
/** 预期累加时值 = 平均时值 × 已生成音符下标 */
function getExpectedAccumulatedChronaxie(state, noteIndex) {
    if (state.expectedAverageChronaxie === null)
        return null;
    return state.expectedAverageChronaxie * noteIndex;
}
/**
 * 当前音符允许的最大时值。
 * 需为后续音符预留 minChronaxie；未设 minChronaxie 时仅受剩余总时值约束。
 */
function getMaxChronaxieForCurrentNote(state, noteIndex) {
    if (state.targetTotalChronaxie === null)
        return null;
    const remainingChronaxie = state.targetTotalChronaxie - state.currentAccumulatedChronaxie;
    const remainingNotes = state.targetNoteLength - noteIndex;
    if (remainingNotes <= 0)
        return remainingChronaxie;
    if (state.minChronaxie === null) {
        return remainingChronaxie;
    }
    return remainingChronaxie - state.minChronaxie * (remainingNotes - 1);
}
/** 第 5 步选时值时的目标时值（含差值权重纠正） */
function getTargetChronaxieForCurrentNote(state, noteIndex) {
    if (state.expectedAverageChronaxie === null)
        return null;
    if (noteIndex === 0)
        return state.expectedAverageChronaxie;
    return state.expectedAverageChronaxie + state.chronaxieDrift;
}
/** 每生成一个音符后更新差值权重 */
function updateChronaxieDrift(state) {
    if (state.expectedAverageChronaxie === null) {
        state.chronaxieDrift = 0;
        return;
    }
    const expectedAccumulated = state.expectedAverageChronaxie * state.generatedNoteCount;
    state.chronaxieDrift = expectedAccumulated - state.currentAccumulatedChronaxie;
}
/** 尚未分配的歌词字符数 */
function getRemainingLyricCount(state) {
    const assigned = (0, note_1.countLyricsInMelody)(state.generatedMelody);
    return Math.max(0, state.text.length - assigned);
}
/** 尚未生成的音符数 */
function getRemainingNoteCount(state) {
    return Math.max(0, state.targetNoteLength - state.generatedNoteCount);
}
/** 剩余歌词少于剩余音符时，当前音可以是休止符 */
function canBeRest(state) {
    return getRemainingLyricCount(state) < getRemainingNoteCount(state);
}
/** 剩余歌词等于剩余音符时，当前音必须带歌词 */
function mustAddLyrics(state) {
    return getRemainingLyricCount(state) === getRemainingNoteCount(state);
}
/** 获取「上一音」信息：优先已生成句末，否则取 preSentence 句末 */
function getPrevNoteFromGenerated(state) {
    var _a;
    const last = state.generatedMelody[state.generatedMelody.length - 1];
    if (last) {
        return {
            midi: last.midi,
            chronaxie: last.chronaxie,
            pinyin: (0, pinyin_1.toLyricPinyin)(last.lyrics),
        };
    }
    if ((_a = state.preSentence) === null || _a === void 0 ? void 0 : _a.lastNote) {
        return {
            midi: state.preSentence.lastNote.midi,
            chronaxie: state.preSentence.lastNote.chronaxie,
            pinyin: state.preSentence.lastNote.pinyin,
        };
    }
    return { midi: null, chronaxie: null, pinyin: null };
}
function hasMidiRangeLimit(state) {
    return state.minMidi !== null || state.maxMidi !== null;
}
function hasChronaxieIntervalLimit(state) {
    return state.minChronaxie !== null || state.minChronaxieInterval !== null;
}
/** 第 5 步：时值是否符合 minChronaxie / minChronaxieInterval 约束 */
function isChronaxieAllowedForState(state, chronaxie) {
    if (state.minChronaxie === null && state.minChronaxieInterval === null)
        return true;
    const rules = (0, note_1.resolveChronaxieRules)(state.minChronaxie, state.minChronaxieInterval);
    if (chronaxie < rules.minChronaxie)
        return false;
    if (state.minChronaxieInterval !== null) {
        return (chronaxie - rules.minChronaxie) % rules.interval === 0;
    }
    return true;
}
function getEffectiveMinChronaxie(state) {
    if (state.minChronaxie !== null)
        return state.minChronaxie;
    return (0, note_1.resolveChronaxieRules)(undefined, undefined).minChronaxie;
}
function hasParamsFilter(state) {
    return state.params !== null;
}
function isNoteRest(note) {
    return (0, note_1.isRestMidi)(note.midi);
}
/** 第 6 步总时值调整用的剩余未分配时值 */
function getRemainingUnallocatedChronaxie(state) {
    if (state.targetTotalChronaxie === null)
        return null;
    return state.targetTotalChronaxie - state.currentAccumulatedChronaxie;
}
