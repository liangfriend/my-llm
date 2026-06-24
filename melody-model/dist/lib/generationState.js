"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGenerateOptions = parseGenerateOptions;
exports.validateGenerationParams = validateGenerationParams;
exports.createGenerationState = createGenerationState;
exports.hasParamsFilter = hasParamsFilter;
const melodyLine_1 = require("./melodyLine");
const note_1 = require("./note");
function parseBooleanParam(value) {
    if (value === true || value === 1)
        return true;
    if (value === false || value === 0 || value === null || value === undefined || value === '') {
        return false;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}
/** 校验并提取 generate 请求体；空 body 视为全部使用默认值 */
function parseGenerateOptions(body) {
    if (body === null || typeof body !== 'object') {
        return { ok: true, options: {} };
    }
    const input = body;
    const { totalNoteLength, preSentence, params, totalChronaxie, minMidi, maxMidi, minChronaxie, minChronaxieInterval, stableEnding, } = input;
    if (preSentence !== undefined && !Array.isArray(preSentence)) {
        return { ok: false, error: 'preSentence must be an array when provided' };
    }
    if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
        return { ok: false, error: 'params must be an object when provided' };
    }
    if (stableEnding !== undefined &&
        typeof stableEnding !== 'boolean' &&
        typeof stableEnding !== 'string' &&
        typeof stableEnding !== 'number') {
        return { ok: false, error: 'stableEnding must be a boolean when provided' };
    }
    return {
        ok: true,
        options: {
            totalNoteLength,
            preSentence: preSentence,
            params: params,
            totalChronaxie,
            minMidi,
            maxMidi,
            minChronaxie,
            minChronaxieInterval,
            stableEnding,
        },
    };
}
/** 标准化 preSentence 音符数组 */
function sanitizePreSentence(notes) {
    if (!Array.isArray(notes) || !notes.length)
        return [];
    const rules = (0, note_1.resolveChronaxieRules)(undefined, undefined);
    return notes.map(note => (0, note_1.sanitizeNote)(note, rules));
}
/** 从上一句旋律推导第 4 步需要的上下文（旋律线、时值、结尾音等） */
function buildPreSentenceContext(melody) {
    if (!melody.length)
        return null;
    const lastNoteRaw = melody[melody.length - 1];
    const lastNote = lastNoteRaw
        ? {
            midi: lastNoteRaw.midi,
            chronaxie: lastNoteRaw.chronaxie,
        }
        : null;
    return {
        melody,
        melodyLine: (0, melodyLine_1.buildMelodyLine)(melody),
        totalChronaxie: melody.reduce((sum, note) => sum + note.chronaxie, 0),
        noteCount: melody.length,
        lastNote,
    };
}
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
 * 第 1 步：参数合法性校验（26.6.23 规则）。
 * 不合法时返回错误信息，供接口 message 使用。
 */
function validateGenerationParams(state) {
    if (state.targetTotalChronaxie === null) {
        return null;
    }
    const rules = (0, note_1.resolveChronaxieRules)(state.minChronaxie, state.minChronaxieInterval);
    const { targetNoteLength, targetTotalChronaxie } = state;
    if (targetTotalChronaxie / rules.interval < targetNoteLength) {
        return `参数不合法：totalChronaxie/minChronaxieInterval (${targetTotalChronaxie}/${rules.interval}) < totalNoteLength (${targetNoteLength})`;
    }
    if (targetTotalChronaxie / rules.minChronaxie < targetNoteLength) {
        return `参数不合法：totalChronaxie/minChronaxie (${targetTotalChronaxie}/${rules.minChronaxie}) < totalNoteLength (${targetNoteLength})`;
    }
    return null;
}
/**
 * 第 1 步：根据请求参数创建全流程状态。
 * 规则：任一参数未传 → 该维度为 null，后续不做对应限制。
 */
function createGenerationState(options) {
    const targetNoteLength = (0, note_1.resolveTargetNoteLength)(options.totalNoteLength);
    const targetTotalChronaxie = (0, note_1.parseOptionalPositiveInt)(options.totalChronaxie);
    const midiRange = normalizeMidiRange(options.minMidi, options.maxMidi);
    const minChronaxie = (0, note_1.parseOptionalPositiveInt)(options.minChronaxie);
    const minChronaxieInterval = (0, note_1.parseOptionalPositiveInt)(options.minChronaxieInterval);
    const params = options.params && Object.keys(options.params).length > 0 ? options.params : null;
    const preSentenceMelody = sanitizePreSentence(options.preSentence);
    return {
        params,
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
        generatedMelody: [],
        preSentence: buildPreSentenceContext(preSentenceMelody),
        filteredSamples: [],
        sampleWeights: [],
        sampleSentencePairs: [],
        targetSampleSentence: null,
        requireStableEnding: parseBooleanParam(options.stableEnding),
    };
}
function hasParamsFilter(state) {
    return state.params !== null;
}
