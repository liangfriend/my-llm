"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors = require('cors');
const generator_1 = require("./lib/generator");
const validation_1 = require("./lib/validation");
const storage_1 = require("./lib/storage");
const logger_1 = __importDefault(require("./lib/logger"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3000;
const getErrorMessage = (error) => {
    if (error instanceof Error) {
        return error.stack || error.message;
    }
    return String(error);
};
// {
//     origin: 'http://localhost:9080'  // 明确指定前端地址
// }
app.use(cors()); // 不设置跨域限制
app.use(express_1.default.json({ limit: '1mb' }));
// 连接测试接口
app.get('/melody/test', (_req, res) => {
    try {
        logger_1.default.info(`Server listening on port ${PORT}`);
        res.json({ text: '接口访问成功' });
    }
    catch (error) {
        logger_1.default.error(`GET /melody/test failed: ${getErrorMessage(error)}`);
        res.status(500).json({ error: 'internal server error' });
    }
});
// 旋律生成接口
app.post('/melody/generate', (req, res) => {
    try {
        const { text, seedMelody, length, params, totalChronaxie, minMidi, maxMidi, minChronaxie, minChronaxieInterval, } = req.body || {};
        if (text !== undefined && typeof text !== 'string') {
            return res.status(400).json({ error: 'text must be a string when provided' });
        }
        if (seedMelody !== undefined && !Array.isArray(seedMelody)) {
            return res.status(400).json({ error: 'seedMelody must be an array when provided' });
        }
        const result = (0, generator_1.generateMelody)({
            text,
            seedMelody,
            length,
            params,
            totalChronaxie,
            minMidi,
            maxMidi,
            minChronaxie,
            minChronaxieInterval,
        });
        return res.json({
            melody: result.melody,
            meta: {
                usedExamples: result.usedExamples,
                targetLength: result.targetLength,
                paramsUsed: params || {},
                warnings: result.warnings || [],
            },
        });
    }
    catch (error) {
        logger_1.default.error(`POST /melody/generate failed: ${getErrorMessage(error)}`);
        return res.status(500).json({ error: 'internal server error' });
    }
});
// 训练接口
app.post('/melody/train', (req, res) => {
    try {
        const { text, melody, params } = req.body || {};
        const validation = (0, validation_1.validateIncomingMelody)(melody);
        if ('error' in validation) {
            return res.status(400).json({ error: validation.error });
        }
        const data = (0, storage_1.loadTrainingData)();
        data.examples.push({
            input: typeof text === 'string' ? text : undefined,
            params: params || {},
            melody: validation.melody,
        });
        (0, storage_1.saveTrainingData)(data);
        return res.json({
            message: 'example added',
            totalExamples: data.examples.length,
        });
    }
    catch (error) {
        logger_1.default.error(`POST /melody/train failed: ${getErrorMessage(error)}`);
        return res.status(500).json({ error: 'internal server error' });
    }
});
app.listen(PORT, '0.0.0.0', () => {
    logger_1.default.info(`服务启动，监听端口： ${PORT}`);
});
