"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterSamplesStep2 = exports.parseGenerateOptions = exports.createGenerationState = void 0;
exports.generateMelody = generateMelody;
/**
 * 旋律生成入口。
 * 当前完成第 1 步（状态初始化）与第 2 步（样本过滤），melody 仍返回空数组。
 */
const generationState_1 = require("./generationState");
const sampleFilter_1 = require("./sampleFilter");
const storage_1 = require("./storage");
function generateMelody(body) {
    const parsed = (0, generationState_1.parseGenerateOptions)(body);
    if (!parsed.ok) {
        return { melody: [], state: 'error' };
    }
    const state = (0, generationState_1.createGenerationState)(parsed.options);
    const trainingData = (0, storage_1.loadTrainingData)();
    (0, sampleFilter_1.filterSamplesStep2)(state, trainingData.examples);
    return { melody: [], state: 'success' };
}
var generationState_2 = require("./generationState");
Object.defineProperty(exports, "createGenerationState", { enumerable: true, get: function () { return generationState_2.createGenerationState; } });
Object.defineProperty(exports, "parseGenerateOptions", { enumerable: true, get: function () { return generationState_2.parseGenerateOptions; } });
var sampleFilter_2 = require("./sampleFilter");
Object.defineProperty(exports, "filterSamplesStep2", { enumerable: true, get: function () { return sampleFilter_2.filterSamplesStep2; } });
