"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSampleSentenceItem = normalizeSampleSentenceItem;
exports.validateTrainingExample = validateTrainingExample;
exports.validateIncomingMelody = validateIncomingMelody;
/**
 * 训练样本与旋律数据的校验。
 * melody 为句对象数组：{ sentence, totalChronaxie }。
 * 兼容旧版二维数组格式（自动计算 totalChronaxie）。
 */
const note_1 = require("./note");
function sanitizeSentence(notes, rules) {
    return notes.map(note => (0, note_1.sanitizeNote)(note, rules));
}
/** 校验单句旋律 */
function validateSentenceMelody(notes) {
    if (!Array.isArray(notes) || !notes.length) {
        return { error: 'each sentence in melody must be a non-empty array' };
    }
    const rules = (0, note_1.resolveChronaxieRules)(undefined, undefined);
    const sanitized = sanitizeSentence(notes, rules);
    const invalidMidi = sanitized.find(note => !(0, note_1.isRestMidi)(note.midi) && (note.midi < 1 || note.midi > 128));
    if (invalidMidi) {
        return { error: 'midi values must be 0 for rest or between 1 and 128' };
    }
    return { melody: sanitized };
}
/** 将单条 melody 项转为 SampleSentence */
function normalizeSampleSentenceItem(item) {
    if (Array.isArray(item)) {
        const validated = validateSentenceMelody(item);
        if ('error' in validated)
            return validated;
        const totalChronaxie = validated.melody.reduce((sum, note) => sum + note.chronaxie, 0);
        return {
            sentence: {
                sentence: validated.melody,
                totalChronaxie,
            },
        };
    }
    if (item === null || typeof item !== 'object') {
        return { error: 'each item in melody must be a sentence array or { sentence, totalChronaxie }' };
    }
    const record = item;
    const validated = validateSentenceMelody(record.sentence);
    if ('error' in validated)
        return validated;
    const parsedTotal = Number(record.totalChronaxie);
    const computedTotal = validated.melody.reduce((sum, note) => sum + note.chronaxie, 0);
    const totalChronaxie = Number.isFinite(parsedTotal) && parsedTotal > 0 ? Math.round(parsedTotal) : computedTotal;
    return {
        sentence: {
            sentence: validated.melody,
            totalChronaxie,
        },
    };
}
/** 校验 POST /melody/train 请求体并转为 TrainingExample */
function validateTrainingExample(body) {
    if (body === null || typeof body !== 'object') {
        return { error: 'request body must be an object' };
    }
    const input = body;
    const { params, minMidi, maxMidi, melody } = input;
    if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
        return { error: 'params must be an object when provided' };
    }
    if (melody === undefined) {
        return { error: 'melody is required' };
    }
    if (!Array.isArray(melody) || !melody.length) {
        return { error: 'melody must be a non-empty array of sentences' };
    }
    const sampleMelody = [];
    for (const item of melody) {
        const normalized = normalizeSampleSentenceItem(item);
        if ('error' in normalized) {
            return normalized;
        }
        sampleMelody.push(normalized.sentence);
    }
    let min = (0, note_1.parseOptionalMidiBound)(minMidi);
    let max = (0, note_1.parseOptionalMidiBound)(maxMidi);
    if (min !== null && min === 0)
        min = 1;
    if (max !== null && max === 0)
        max = 128;
    if (min !== null && max !== null && min > max) {
        [min, max] = [max, min];
    }
    return {
        example: {
            params: params || {},
            minMidi: min !== null && min !== void 0 ? min : undefined,
            maxMidi: max !== null && max !== void 0 ? max : undefined,
            melody: sampleMelody,
        },
    };
}
/** 校验单句旋律（兼容旧调用方） */
function validateIncomingMelody(melody) {
    return validateSentenceMelody(melody);
}
