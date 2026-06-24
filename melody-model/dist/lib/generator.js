"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeTargetSampleSentenceStep5 = exports.pickTargetSampleSentenceStep4 = exports.buildSampleSentenceIndexStep3 = exports.filterSamplesStep2 = exports.parseGenerateOptions = exports.createGenerationState = void 0;
exports.generateMelody = generateMelody;
/**
 * 旋律生成入口（第 1～5 步完整流程，26.6.23 句级重构）。
 */
const generationState_1 = require("./generationState");
const sampleFilter_1 = require("./sampleFilter");
const sampleSentenceIndex_1 = require("./sampleSentenceIndex");
const targetSampleSentence_1 = require("./targetSampleSentence");
const sentenceMerge_1 = require("./sentenceMerge");
const storage_1 = require("./storage");
function generateMelody(body) {
    // 检验参数是否合法
    const parsed = (0, generationState_1.parseGenerateOptions)(body);
    if (!parsed.ok) {
        return { melody: [], state: 'error', message: parsed.error };
    }
    // 获取当前状态信息
    const state = (0, generationState_1.createGenerationState)(parsed.options);
    // 验证状态信息
    const paramError = (0, generationState_1.validateGenerationParams)(state);
    if (paramError) {
        return { melody: [], state: 'error', message: paramError };
    }
    // 加载样本数据
    const trainingData = (0, storage_1.loadTrainingData)();
    // 将样本数据扩展时值填充
    const examples = (0, storage_1.augmentTrainingExamples2x)(trainingData.examples);
    //
    (0, sampleFilter_1.filterSamplesStep2)(state, examples);
    (0, sampleSentenceIndex_1.buildSampleSentenceIndexStep3)(state);
    (0, targetSampleSentence_1.pickTargetSampleSentenceStep4)(state);
    (0, sentenceMerge_1.mergeTargetSampleSentenceStep5)(state);
    if (!state.generatedMelody.length && !state.targetSampleSentence) {
        return {
            melody: [],
            state: 'error',
            message: '未找到匹配的样本句，请检查 params 或训练数据',
        };
    }
    return { melody: state.generatedMelody, state: 'success' };
}
var generationState_2 = require("./generationState");
Object.defineProperty(exports, "createGenerationState", { enumerable: true, get: function () { return generationState_2.createGenerationState; } });
Object.defineProperty(exports, "parseGenerateOptions", { enumerable: true, get: function () { return generationState_2.parseGenerateOptions; } });
var sampleFilter_2 = require("./sampleFilter");
Object.defineProperty(exports, "filterSamplesStep2", { enumerable: true, get: function () { return sampleFilter_2.filterSamplesStep2; } });
var sampleSentenceIndex_2 = require("./sampleSentenceIndex");
Object.defineProperty(exports, "buildSampleSentenceIndexStep3", { enumerable: true, get: function () { return sampleSentenceIndex_2.buildSampleSentenceIndexStep3; } });
var targetSampleSentence_2 = require("./targetSampleSentence");
Object.defineProperty(exports, "pickTargetSampleSentenceStep4", { enumerable: true, get: function () { return targetSampleSentence_2.pickTargetSampleSentenceStep4; } });
var sentenceMerge_2 = require("./sentenceMerge");
Object.defineProperty(exports, "mergeTargetSampleSentenceStep5", { enumerable: true, get: function () { return sentenceMerge_2.mergeTargetSampleSentenceStep5; } });
