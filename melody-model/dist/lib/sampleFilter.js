"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.median = median;
exports.filterByMedianWeight = filterByMedianWeight;
exports.medianFilterUntil = medianFilterUntil;
exports.isSampleWithinRequestMidiRange = isSampleWithinRequestMidiRange;
exports.calcSampleParamsWeight = calcSampleParamsWeight;
exports.filterSamplesStep2 = filterSamplesStep2;
const weight_1 = require("./weight");
/** 计算数组中位数，用于权重阈值过滤 */
function median(values) {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}
/** 保留 weight >= 中位数的项 */
function filterByMedianWeight(items) {
    if (!items.length)
        return [];
    const threshold = median(items.map(item => item.weight));
    return items.filter(item => item.weight >= threshold);
}
/**
 * 反复按中位数过滤，直到数量 <= maxCount 或本轮无法继续减少。
 * 防止权重全相等时死循环。
 */
function medianFilterUntil(items, maxCount) {
    let current = [...items];
    while (current.length > maxCount) {
        const next = filterByMedianWeight(current);
        if (next.length === current.length)
            break;
        current = next;
    }
    return current;
}
/**
 * 请求音高范围是否包裹样本声明的 minMidi/maxMidi。
 * 仅检查请求中显式传入的边界；样本未声明范围时不排除。
 */
function isSampleWithinRequestMidiRange(example, state) {
    const hasRequestMin = state.minMidi !== null;
    const hasRequestMax = state.maxMidi !== null;
    if (!hasRequestMin && !hasRequestMax)
        return true;
    const sampleMin = example.minMidi;
    const sampleMax = example.maxMidi;
    if (sampleMin === undefined && sampleMax === undefined)
        return true;
    const resolvedSampleMin = sampleMin !== null && sampleMin !== void 0 ? sampleMin : 1;
    const resolvedSampleMax = sampleMax !== null && sampleMax !== void 0 ? sampleMax : 128;
    if (hasRequestMin && state.minMidi > resolvedSampleMin)
        return false;
    if (hasRequestMax && state.maxMidi < resolvedSampleMax)
        return false;
    return true;
}
/** 第 2 步：单个样本的 params 权重（当前唯一权重维度） */
function calcSampleParamsWeight(example, state) {
    if (!state.params) {
        return 1;
    }
    return (0, weight_1.calcParamsSimilarityWeight)(example.params || {}, state.params);
}
/**
 * 第 2 步：过滤样本。
 * 1. minMidi/maxMidi 硬过滤（请求范围须包裹样本范围）
 * 2. params 权重计算 + 中位数过滤（未传 params 时跳过中位数过滤，全部保留）
 */
function filterSamplesStep2(state, examples) {
    // 在样本范围内
    const midiFiltered = examples.filter(example => isSampleWithinRequestMidiRange(example, state));
    if (!state.params) {
        state.filteredSamples = midiFiltered;
        state.sampleWeights = midiFiltered.map(() => 1);
        return;
    }
    // 标签相似权重
    const weights = midiFiltered.map(example => calcSampleParamsWeight(example, state));
    const threshold = median(weights);
    const filteredSamples = [];
    const sampleWeights = [];
    midiFiltered.forEach((example, index) => {
        // 过滤出来权重达标的样本
        if (weights[index] >= threshold) {
            filteredSamples.push(example);
            sampleWeights.push(weights[index]);
        }
    });
    state.filteredSamples = filteredSamples;
    state.sampleWeights = sampleWeights;
}
