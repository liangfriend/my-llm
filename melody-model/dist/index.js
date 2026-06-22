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
app.use(cors());
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
// 旋律生成接口（当前第 1 步：初始化状态，melody 为空）
app.post('/melody/generate', (req, res) => {
    try {
        const result = (0, generator_1.generateMelody)(req.body || {});
        if (result.state === 'error') {
            return res.status(400).json(result);
        }
        return res.json(result);
    }
    catch (error) {
        logger_1.default.error(`POST /melody/generate failed: ${getErrorMessage(error)}`);
        return res.status(500).json({ melody: [], state: 'error' });
    }
});
// 训练接口：写入二维 melody 样本
app.post('/melody/train', (req, res) => {
    try {
        const validation = (0, validation_1.validateTrainingExample)(req.body);
        if ('error' in validation) {
            return res.status(400).json({ error: validation.error });
        }
        const data = (0, storage_1.loadTrainingData)();
        data.examples.push(validation.example);
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
