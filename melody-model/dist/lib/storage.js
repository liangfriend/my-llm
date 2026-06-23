"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentSampleMelody2x = augmentSampleMelody2x;
exports.augmentTrainingExamples2x = augmentTrainingExamples2x;
exports.loadTrainingData = loadTrainingData;
exports.saveTrainingData = saveTrainingData;
const fs_1 = __importDefault(require("fs"));
const constants_1 = require("./constants");
const logger_1 = __importDefault(require("./logger"));
/**
 * 将样本中每句旋律 chronaxie×2 的副本追加到 melody 尾部，实现 2x 数据扩增。
 * 仅用于生成流程，不写回 training-data.json。
 */
function augmentSampleMelody2x(melody) {
    const doubled = melody.map(sentence => sentence.map(note => ({
        ...note,
        chronaxie: note.chronaxie * 2,
    })));
    return [...melody, ...doubled];
}
function augmentTrainingExamples2x(examples) {
    return examples.map(example => {
        var _a;
        if (!((_a = example.melody) === null || _a === void 0 ? void 0 : _a.length))
            return example;
        return {
            ...example,
            melody: augmentSampleMelody2x(example.melody),
        };
    });
}
// 读取训练数据
function loadTrainingData() {
    try {
        console.log('样本路径', constants_1.DATA_FILE);
        logger_1.default.log('样本路径', constants_1.DATA_FILE);
        const content = fs_1.default.readFileSync(constants_1.DATA_FILE, 'utf8');
        const data = JSON.parse(content);
        console.log('样本数据', data);
        logger_1.default.log('样本数据', data);
        if (!data || !Array.isArray(data.examples)) {
            return { examples: [] };
        }
        return data;
    }
    catch (err) {
        console.log('样本数据获取不到', err);
        logger_1.default.error('样本数据获取不到', err);
        return { examples: [] };
    }
}
function saveTrainingData(data) {
    fs_1.default.writeFileSync(constants_1.DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
