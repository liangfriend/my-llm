"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSampleNoteIndexStep3 = buildSampleNoteIndexStep3;
const sentenceContext_1 = require("./sentenceContext");
const pinyin_1 = require("./pinyin");
function appendSentenceNotes(entries, sentence, sampleWeight, current, previous) {
    sentence.forEach((note, noteIndex) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const prevNote = noteIndex > 0 ? sentence[noteIndex - 1] : null;
        entries.push({
            sampleWeight,
            midi: note.midi,
            chronaxie: note.chronaxie,
            pinyin: (0, pinyin_1.toLyricPinyin)(note.lyrics),
            sentenceMelodyLine: current.melodyLine,
            sentenceTotalChronaxie: current.totalChronaxie,
            sentenceNoteCount: current.noteCount,
            sentenceLyricCount: current.lyricCount,
            prevMidi: (_a = prevNote === null || prevNote === void 0 ? void 0 : prevNote.midi) !== null && _a !== void 0 ? _a : null,
            prevChronaxie: (_b = prevNote === null || prevNote === void 0 ? void 0 : prevNote.chronaxie) !== null && _b !== void 0 ? _b : null,
            prevPinyin: prevNote ? (0, pinyin_1.toLyricPinyin)(prevNote.lyrics) : null,
            prevSentenceMelodyLine: (_c = previous === null || previous === void 0 ? void 0 : previous.melodyLine) !== null && _c !== void 0 ? _c : null,
            prevSentenceTotalChronaxie: (_d = previous === null || previous === void 0 ? void 0 : previous.totalChronaxie) !== null && _d !== void 0 ? _d : null,
            prevSentenceNoteCount: (_e = previous === null || previous === void 0 ? void 0 : previous.noteCount) !== null && _e !== void 0 ? _e : null,
            prevSentenceLyricCount: (_f = previous === null || previous === void 0 ? void 0 : previous.lyricCount) !== null && _f !== void 0 ? _f : null,
            prevSentenceLastMidi: (_g = previous === null || previous === void 0 ? void 0 : previous.lastMidi) !== null && _g !== void 0 ? _g : null,
            prevSentenceLastChronaxie: (_h = previous === null || previous === void 0 ? void 0 : previous.lastChronaxie) !== null && _h !== void 0 ? _h : null,
            prevSentenceLastPinyin: (_j = previous === null || previous === void 0 ? void 0 : previous.lastPinyin) !== null && _j !== void 0 ? _j : null,
        });
    });
}
/**
 * 第 3 步：将 filteredSamples 中每个音符平铺写入 state.sampleNoteEntries，
 * 并建立等长的 sampleNoteWeights（初始全 0）。
 */
function buildSampleNoteIndexStep3(state) {
    const entries = [];
    state.filteredSamples.forEach((example, sampleIndex) => {
        var _a, _b;
        const sampleWeight = (_a = state.sampleWeights[sampleIndex]) !== null && _a !== void 0 ? _a : 1;
        const sentences = (_b = example.melody) !== null && _b !== void 0 ? _b : [];
        let prevSentenceContext = null;
        sentences.forEach(sentence => {
            if (!sentence.length)
                return;
            const currentContext = (0, sentenceContext_1.buildSentenceContext)(sentence);
            appendSentenceNotes(entries, sentence, sampleWeight, currentContext, prevSentenceContext);
            prevSentenceContext = currentContext;
        });
    });
    state.sampleNoteEntries = entries;
    state.sampleNoteWeights = new Array(entries.length).fill(0);
}
