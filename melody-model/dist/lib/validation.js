"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTrainingExample = validateTrainingExample;
exports.validateIncomingMelody = validateIncomingMelody;
exports.countSampleLyrics = countSampleLyrics;
/**
 * 训练样本与旋律数据的校验。
 * melody 为二维数组：外层=样本内各句，内层=该句音符列表。
 */
const note_1 = require("./note");
function sanitizeSentence(notes, rules) {
    return notes.map(note => (0, note_1.sanitizeNote)(note, undefined, rules));
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
        return { error: 'melody must be a non-empty 2D array' };
    }
    const sampleMelody = [];
    for (const sentence of melody) {
        const validated = validateSentenceMelody(sentence);
        if ('error' in validated) {
            return validated;
        }
        sampleMelody.push(validated.melody);
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
/** 统计样本中所有句子的歌词字符总数 */
function countSampleLyrics(melody) {
    return melody.reduce((sum, sentence) => sum + (0, note_1.countLyricsInMelody)(sentence), 0);
}
