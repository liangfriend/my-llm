"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustTotalChronaxieStep6 = exports.generateNotesStep5 = exports.pickTargetMelodyLineStep4 = exports.buildSampleNoteIndexStep3 = exports.filterSamplesStep2 = exports.parseGenerateOptions = exports.createGenerationState = void 0;
exports.generateMelody = generateMelody;
/**
 * 旋律生成入口（第 1～6 步完整流程）。
 */
const generationState_1 = require("./generationState");
const sampleFilter_1 = require("./sampleFilter");
const sampleNoteIndex_1 = require("./sampleNoteIndex");
const noteGenerator_1 = require("./noteGenerator");
const chronaxieAdjust_1 = require("./chronaxieAdjust");
const targetMelodyLine_1 = require("./targetMelodyLine");
const storage_1 = require("./storage");
function generateMelody(body) {
    const parsed = (0, generationState_1.parseGenerateOptions)(body);
    if (!parsed.ok) {
        return { melody: [], state: 'error' };
    }
    const state = (0, generationState_1.createGenerationState)(parsed.options);
    const trainingData = (0, storage_1.loadTrainingData)();
    const examples = (0, storage_1.augmentTrainingExamples2x)(trainingData.examples);
    (0, sampleFilter_1.filterSamplesStep2)(state, examples);
    (0, sampleNoteIndex_1.buildSampleNoteIndexStep3)(state);
    (0, targetMelodyLine_1.pickTargetMelodyLineStep4)(state);
    (0, noteGenerator_1.generateNotesStep5)(state);
    (0, chronaxieAdjust_1.adjustTotalChronaxieStep6)(state);
    return { melody: state.generatedMelody, state: 'success' };
}
var generationState_2 = require("./generationState");
Object.defineProperty(exports, "createGenerationState", { enumerable: true, get: function () { return generationState_2.createGenerationState; } });
Object.defineProperty(exports, "parseGenerateOptions", { enumerable: true, get: function () { return generationState_2.parseGenerateOptions; } });
var sampleFilter_2 = require("./sampleFilter");
Object.defineProperty(exports, "filterSamplesStep2", { enumerable: true, get: function () { return sampleFilter_2.filterSamplesStep2; } });
var sampleNoteIndex_2 = require("./sampleNoteIndex");
Object.defineProperty(exports, "buildSampleNoteIndexStep3", { enumerable: true, get: function () { return sampleNoteIndex_2.buildSampleNoteIndexStep3; } });
var targetMelodyLine_2 = require("./targetMelodyLine");
Object.defineProperty(exports, "pickTargetMelodyLineStep4", { enumerable: true, get: function () { return targetMelodyLine_2.pickTargetMelodyLineStep4; } });
var noteGenerator_2 = require("./noteGenerator");
Object.defineProperty(exports, "generateNotesStep5", { enumerable: true, get: function () { return noteGenerator_2.generateNotesStep5; } });
var chronaxieAdjust_2 = require("./chronaxieAdjust");
Object.defineProperty(exports, "adjustTotalChronaxieStep6", { enumerable: true, get: function () { return chronaxieAdjust_2.adjustTotalChronaxieStep6; } });
