"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNotesStep5 = generateNotesStep5;
const generationState_1 = require("./generationState");
const melodyLine_1 = require("./melodyLine");
const note_1 = require("./note");
const sampleFilter_1 = require("./sampleFilter");
const weight_1 = require("./weight");
const weightConfig_1 = require("./weightConfig");
function nullableEqual(a, b) {
    return (a !== null && a !== void 0 ? a : null) === (b !== null && b !== void 0 ? b : null);
}
function passesMidiRange(state, midi) {
    if ((0, note_1.isRestMidi)(midi))
        return true;
    if (state.minMidi !== null && midi < state.minMidi)
        return false;
    if (state.maxMidi !== null && midi > state.maxMidi)
        return false;
    return true;
}
/** 硬过滤：休止符、音域、最大时值、时值间距 */
function filterEntryIndices(state, noteIndex, enforceInterval) {
    const maxChronaxie = (0, generationState_1.getMaxChronaxieForCurrentNote)(state, noteIndex);
    const allowRest = (0, generationState_1.canBeRest)(state);
    return state.sampleNoteEntries.reduce((indices, entry, index) => {
        if (!allowRest && (0, note_1.isRestMidi)(entry.midi))
            return indices;
        if (!passesMidiRange(state, entry.midi))
            return indices;
        if (maxChronaxie !== null && entry.chronaxie > maxChronaxie)
            return indices;
        if (enforceInterval && !(0, generationState_1.isChronaxieAllowedForState)(state, entry.chronaxie))
            return indices;
        indices.push(index);
        return indices;
    }, []);
}
function calcNoteEntryWeight(state, entry, noteIndex, targetChronaxie) {
    var _a, _b, _c, _d;
    const prev = (0, generationState_1.getPrevNoteFromGenerated)(state);
    const dimensions = [entry.sampleWeight];
    if (state.targetMelodyLine) {
        dimensions.push((0, weight_1.calcMelodyLineSimilarityWeight)((0, melodyLine_1.melodyLineSimilarity)(state.targetMelodyLine, entry.sentenceMelodyLine)));
    }
    dimensions.push((0, weight_1.calcExactMatchWeight)(entry.sentenceNoteCount === state.targetNoteLength));
    dimensions.push((0, weight_1.calcExactMatchWeight)(entry.sentenceLyricCount === state.text.length));
    dimensions.push((0, weight_1.calcExactMatchWeight)(nullableEqual(entry.prevMidi, prev.midi)));
    dimensions.push((0, weight_1.calcExactMatchWeight)(nullableEqual(entry.prevChronaxie, prev.chronaxie)));
    dimensions.push((0, weight_1.calcExactMatchWeight)(nullableEqual(entry.prevPinyin, prev.pinyin)));
    if (state.preSentence) {
        const ps = state.preSentence;
        dimensions.push((0, weight_1.calcMelodyLineSimilarityWeight)((0, melodyLine_1.melodyLineSimilarity)(ps.melodyLine, (_a = entry.prevSentenceMelodyLine) !== null && _a !== void 0 ? _a : [])));
        dimensions.push((0, weight_1.calcExactMatchWeight)(entry.prevSentenceTotalChronaxie === ps.totalChronaxie));
        dimensions.push((0, weight_1.calcExactMatchWeight)(entry.prevSentenceNoteCount === ps.noteCount));
        dimensions.push((0, weight_1.calcExactMatchWeight)(entry.prevSentenceLyricCount === ps.lyricCount));
        dimensions.push((0, weight_1.calcExactMatchWeight)(nullableEqual(entry.prevSentenceLastMidi, (_b = ps.lastNote) === null || _b === void 0 ? void 0 : _b.midi)));
        dimensions.push((0, weight_1.calcExactMatchWeight)(nullableEqual(entry.prevSentenceLastChronaxie, (_c = ps.lastNote) === null || _c === void 0 ? void 0 : _c.chronaxie)));
        dimensions.push((0, weight_1.calcExactMatchWeight)(nullableEqual(entry.prevSentenceLastPinyin, (_d = ps.lastNote) === null || _d === void 0 ? void 0 : _d.pinyin)));
    }
    if (targetChronaxie !== null) {
        dimensions.push((0, weight_1.calcChronaxieProximityWeight)(entry.chronaxie, targetChronaxie));
    }
    return (0, weight_1.combineDimensionWeights)(dimensions);
}
function resolveLyrics(state, sampleHasLyrics) {
    const lyricIndex = (0, note_1.countLyricsInMelody)(state.generatedMelody);
    if ((0, generationState_1.mustAddLyrics)(state)) {
        return state.text[lyricIndex];
    }
    if (sampleHasLyrics && lyricIndex < state.text.length) {
        return state.text[lyricIndex];
    }
    return undefined;
}
function buildRecommendContext(state) {
    const notes = [];
    if (state.preSentence) {
        state.preSentence.melody.forEach(note => {
            if (!(0, note_1.isRestMidi)(note.midi))
                notes.push({ midi: note.midi });
        });
    }
    state.generatedMelody.forEach(note => {
        if (!(0, note_1.isRestMidi)(note.midi))
            notes.push({ midi: note.midi });
    });
    return notes;
}
/** 过滤后仍无候选时，用推荐音高 + 最小时值降级 */
function pickFallbackNote(state, noteIndex) {
    var _a, _b, _c;
    const rules = (0, note_1.resolveChronaxieRules)(state.minChronaxie, state.minChronaxieInterval);
    const minChronaxie = (0, generationState_1.getEffectiveMinChronaxie)(state);
    const maxChronaxie = (0, generationState_1.getMaxChronaxieForCurrentNote)(state, noteIndex);
    let chronaxie = (0, note_1.normalizeChronaxie)(minChronaxie, rules);
    if (maxChronaxie !== null) {
        chronaxie = (0, note_1.normalizeChronaxie)(Math.min(chronaxie, maxChronaxie), rules);
    }
    const contextNotes = buildRecommendContext(state);
    const index = contextNotes.length;
    contextNotes.push({ midi: (_a = state.minMidi) !== null && _a !== void 0 ? _a : 60 });
    const recommended = (0, note_1.recommendMidiReplace)(index, contextNotes);
    let midi = (_c = (_b = recommended[0]) !== null && _b !== void 0 ? _b : state.minMidi) !== null && _c !== void 0 ? _c : 60;
    if (state.minMidi !== null)
        midi = Math.max(state.minMidi, midi);
    if (state.maxMidi !== null)
        midi = Math.min(state.maxMidi, midi);
    return {
        midi,
        chronaxie,
        lyrics: resolveLyrics(state, false),
    };
}
function pickNoteFromSamples(state, noteIndex) {
    let indices = filterEntryIndices(state, noteIndex, (0, generationState_1.hasChronaxieIntervalLimit)(state));
    if (!indices.length && (0, generationState_1.hasChronaxieIntervalLimit)(state)) {
        indices = filterEntryIndices(state, noteIndex, false);
    }
    if (!indices.length) {
        return pickFallbackNote(state, noteIndex);
    }
    const targetChronaxie = (0, generationState_1.getTargetChronaxieForCurrentNote)(state, noteIndex);
    const candidates = indices.map(index => ({
        weight: calcNoteEntryWeight(state, state.sampleNoteEntries[index], noteIndex, targetChronaxie),
        entry: state.sampleNoteEntries[index],
    }));
    const maxCount = weightConfig_1.WEIGHT_CONFIG.noteGeneration.maxCandidates;
    const filtered = (0, sampleFilter_1.medianFilterUntil)(candidates, maxCount);
    const picked = (0, weight_1.weightedRandomPick)(filtered);
    if (!picked) {
        return pickFallbackNote(state, noteIndex);
    }
    const entryIndex = state.sampleNoteEntries.indexOf(picked.entry);
    if (entryIndex >= 0) {
        state.sampleNoteWeights[entryIndex] = picked.weight;
    }
    const sampleHasLyrics = picked.entry.pinyin !== null;
    const lyrics = (0, note_1.isRestMidi)(picked.entry.midi) ? undefined : resolveLyrics(state, sampleHasLyrics);
    return {
        midi: picked.entry.midi,
        chronaxie: picked.entry.chronaxie,
        lyrics,
    };
}
function appendGeneratedNote(state, note) {
    state.generatedMelody.push(note);
    state.generatedNoteCount += 1;
    state.currentAccumulatedChronaxie += note.chronaxie;
    (0, generationState_1.updateChronaxieDrift)(state);
}
/**
 * 第 5 步：循环选取音符直到达到 targetNoteLength。
 * 结果写入 state.generatedMelody。
 */
function generateNotesStep5(state) {
    while (state.generatedNoteCount < state.targetNoteLength) {
        const noteIndex = state.generatedNoteCount;
        const note = pickNoteFromSamples(state, noteIndex);
        appendGeneratedNote(state, note);
    }
}
