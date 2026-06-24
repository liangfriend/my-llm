"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickTargetMelodyLineStep4 = pickTargetMelodyLineStep4;
const melodyLine_1 = require("./melodyLine");
const sampleFilter_1 = require("./sampleFilter");
const sentenceContext_1 = require("./sentenceContext");
const weight_1 = require("./weight");
const weightConfig_1 = require("./weightConfig");
function nullableEqual(a, b) {
    return (a !== null && a !== void 0 ? a : null) === (b !== null && b !== void 0 ? b : null);
}
/** 对照当前句音符数、歌词数 */
function calcCurrentSentenceMatchWeight(sampleSentence, targetNoteLength, targetLyricCount) {
    return (0, weight_1.combineDimensionWeights)([
        (0, weight_1.calcExactMatchWeight)(sampleSentence.noteCount === targetNoteLength),
        (0, weight_1.calcExactMatchWeight)(sampleSentence.lyricCount === targetLyricCount),
    ]);
}
/** 对照请求 preSentence 与样本上一句 */
function calcPreSentenceMatchWeight(request, samplePrev) {
    const last = request.lastNote;
    return (0, weight_1.combineDimensionWeights)([
        (0, weight_1.calcMelodyLineSimilarityWeight)((0, melodyLine_1.melodyLineSimilarity)(request.melodyLine, samplePrev.melodyLine)),
        (0, weight_1.calcExactMatchWeight)(request.totalChronaxie === samplePrev.totalChronaxie),
        (0, weight_1.calcExactMatchWeight)(request.noteCount === samplePrev.noteCount),
        (0, weight_1.calcExactMatchWeight)(request.lyricCount === samplePrev.lyricCount),
        (0, weight_1.calcExactMatchWeight)(nullableEqual(last === null || last === void 0 ? void 0 : last.midi, samplePrev.lastMidi)),
        (0, weight_1.calcExactMatchWeight)(nullableEqual(last === null || last === void 0 ? void 0 : last.chronaxie, samplePrev.lastChronaxie)),
        (0, weight_1.calcExactMatchWeight)(nullableEqual(last === null || last === void 0 ? void 0 : last.pinyin, samplePrev.lastPinyin)),
    ]);
}
function collectMelodyLineCandidates(state) {
    const candidates = [];
    const targetNoteLength = state.targetNoteLength;
    const targetLyricCount = state.text.length;
    const hasPreSentence = state.preSentence !== null;
    state.filteredSamples.forEach((example, sampleIndex) => {
        var _a, _b;
        const sampleWeight = (_a = state.sampleWeights[sampleIndex]) !== null && _a !== void 0 ? _a : 1;
        const sentences = (_b = example.melody) !== null && _b !== void 0 ? _b : [];
        if (sentences.length < 2)
            return;
        const sentenceContexts = sentences
            .filter(sentence => sentence.length > 0)
            .map(sentence => (0, sentenceContext_1.buildSentenceContext)(sentence));
        if (sentenceContexts.length < 2)
            return;
        for (let i = 0; i < sentenceContexts.length - 1; i += 1) {
            const currentSentence = sentenceContexts[i];
            const nextSentence = sentenceContexts[i + 1];
            const samplePrev = i > 0 ? sentenceContexts[i - 1] : null;
            if (hasPreSentence) {
                if (!samplePrev)
                    continue;
                const preWeight = calcPreSentenceMatchWeight(state.preSentence, samplePrev);
                const currentWeight = calcCurrentSentenceMatchWeight(currentSentence, targetNoteLength, targetLyricCount);
                candidates.push({
                    weight: (0, weight_1.combineDimensionWeights)([sampleWeight, preWeight, currentWeight]),
                    melodyLine: [...nextSentence.melodyLine],
                });
                continue;
            }
            const currentWeight = calcCurrentSentenceMatchWeight(currentSentence, targetNoteLength, targetLyricCount);
            candidates.push({
                weight: (0, weight_1.combineDimensionWeights)([sampleWeight, currentWeight]),
                melodyLine: [...nextSentence.melodyLine],
            });
        }
    });
    return candidates;
}
/**
 * 第 4 步：中位数过滤候选旋律线，再按权重随机选取，写入 state.targetMelodyLine。
 */
function pickTargetMelodyLineStep4(state) {
    const candidates = collectMelodyLineCandidates(state);
    if (!candidates.length) {
        state.targetMelodyLine = null;
        return;
    }
    const maxCount = weightConfig_1.WEIGHT_CONFIG.targetMelodyLine.maxCandidates;
    const filtered = (0, sampleFilter_1.medianFilterUntil)(candidates, maxCount);
    const picked = (0, weight_1.weightedRandomPick)(filtered);
    state.targetMelodyLine = picked ? [...picked.melodyLine] : null;
}
