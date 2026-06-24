"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickTargetSampleSentenceStep4 = pickTargetSampleSentenceStep4;
const sampleFilter_1 = require("./sampleFilter");
const weight_1 = require("./weight");
const weightConfig_1 = require("./weightConfig");
function collectSampleSentenceCandidates(state) {
    const candidates = [];
    const minTotalChronaxie = state.targetTotalChronaxie;
    state.sampleSentencePairs.forEach(pair => {
        if (minTotalChronaxie !== null && pair.next.totalChronaxie < minTotalChronaxie) {
            return;
        }
        candidates.push({
            weight: (0, weight_1.calcStep4PairWeight)(state, pair),
            next: {
                sentence: pair.next.sentence.map(note => ({ ...note })),
                totalChronaxie: pair.next.totalChronaxie,
            },
        });
    });
    return candidates;
}
/**
 * 第 4 步：中位数过滤候选样本句，再按权重随机选取，写入 state.targetSampleSentence。
 */
function pickTargetSampleSentenceStep4(state) {
    const candidates = collectSampleSentenceCandidates(state);
    if (!candidates.length) {
        state.targetSampleSentence = null;
        return;
    }
    const maxCount = weightConfig_1.WEIGHT_CONFIG.targetSampleSentence.maxCandidates;
    const filtered = (0, sampleFilter_1.medianFilterUntil)(candidates, maxCount);
    const picked = (0, weight_1.weightedRandomPick)(filtered);
    state.targetSampleSentence = picked
        ? {
            sentence: picked.next.sentence.map(note => ({ ...note })),
            totalChronaxie: picked.next.totalChronaxie,
        }
        : null;
}
