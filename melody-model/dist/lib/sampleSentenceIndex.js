"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSampleSentenceIndexStep3 = buildSampleSentenceIndexStep3;
const sentenceContext_1 = require("./sentenceContext");
const midiKey_1 = require("./midiKey");
function buildSampleSentenceInfo(sampleWeight, current, previous, prevSentence) {
    var _a, _b, _c, _d, _e;
    return {
        sampleWeight,
        melodyLine: current.melodyLine,
        totalChronaxie: current.totalChronaxie,
        noteCount: current.noteCount,
        lastMidi: current.lastMidi,
        lastChronaxie: current.lastChronaxie,
        prevMelodyLine: (_a = previous === null || previous === void 0 ? void 0 : previous.melodyLine) !== null && _a !== void 0 ? _a : null,
        prevTotalChronaxie: (_b = previous === null || previous === void 0 ? void 0 : previous.totalChronaxie) !== null && _b !== void 0 ? _b : null,
        prevNoteCount: (_c = previous === null || previous === void 0 ? void 0 : previous.noteCount) !== null && _c !== void 0 ? _c : null,
        prevLastMidi: (_d = previous === null || previous === void 0 ? void 0 : previous.lastMidi) !== null && _d !== void 0 ? _d : null,
        prevLastChronaxie: (_e = previous === null || previous === void 0 ? void 0 : previous.lastChronaxie) !== null && _e !== void 0 ? _e : null,
        prevSentence: prevSentence ? prevSentence.map(note => ({ ...note })) : null,
    };
}
/**
 * 第 3 步：将 filteredSamples 中每个非末尾句与下一句配对，写入 state.sampleSentencePairs。
 */
function buildSampleSentenceIndexStep3(state) {
    const pairs = [];
    state.filteredSamples.forEach((example, sampleIndex) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const sampleWeight = (_a = state.sampleWeights[sampleIndex]) !== null && _a !== void 0 ? _a : 1;
        const sentences = (_b = example.melody) !== null && _b !== void 0 ? _b : [];
        if (sentences.length < 2)
            return;
        const contexts = sentences
            .filter(item => item.sentence.length > 0)
            .map(item => ({
            context: (0, sentenceContext_1.buildSentenceContext)(item.sentence, item.totalChronaxie),
            sample: item,
        }));
        if (contexts.length < 2)
            return;
        for (let i = 0; i < contexts.length - 1; i += 1) {
            const current = contexts[i];
            const next = contexts[i + 1];
            const previous = i > 0 ? contexts[i - 1].context : null;
            const prevSentence = i > 0 ? contexts[i - 1].sample.sentence : null;
            if (state.requireStableEnding) {
                const nextSentence = next.sample.sentence;
                const lastNote = nextSentence[nextSentence.length - 1];
                if (lastNote &&
                    (0, midiKey_1.isUnstableEndingDegree)(lastNote.midi, (_c = example.params) === null || _c === void 0 ? void 0 : _c.key, (_d = state.params) === null || _d === void 0 ? void 0 : _d.key)) {
                    continue;
                }
            }
            const preLastNote = (_e = state.preSentence) === null || _e === void 0 ? void 0 : _e.lastNote;
            if (preLastNote && preLastNote.midi > 0) {
                const nextFirstNote = next.sample.sentence.find(note => note.midi > 0);
                if (nextFirstNote &&
                    (0, midiKey_1.isForbiddenPhraseConnection)(preLastNote.midi, nextFirstNote.midi, (_f = state.params) === null || _f === void 0 ? void 0 : _f.key, (_g = example.params) === null || _g === void 0 ? void 0 : _g.key)) {
                    continue;
                }
            }
            pairs.push({
                current: buildSampleSentenceInfo(sampleWeight, current.context, previous, prevSentence),
                next: {
                    sentence: next.sample.sentence.map(note => ({ ...note })),
                    totalChronaxie: next.sample.totalChronaxie,
                },
            });
        }
    });
    state.sampleSentencePairs = pairs;
}
