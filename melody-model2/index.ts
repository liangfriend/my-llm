import express, { Request, Response } from 'express';
const cors = require('cors');
import { generateMelody } from './lib/generator';
import { validateTrainingExample } from './lib/validation';
import { loadTrainingData, saveTrainingData } from './lib/storage';
import { GenerateOptions } from './type';
import logger from './lib/logger';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 连接测试接口
app.get('/melody/test', (_req: Request, res: Response) => {
  try {
    logger.info(`Server listening on port ${PORT}`);
    res.json({ text: '接口访问成功' });
  } catch (error) {
    logger.error(`GET /melody/test failed: ${getErrorMessage(error)}`);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 旋律生成接口（当前第 1 步：初始化状态，melody 为空）
app.post('/melody/generate', (req: Request<unknown, unknown, GenerateOptions>, res: Response) => {
  try {
    const result = generateMelody(req.body || {});
    if (result.state === 'error') {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    logger.error(`POST /melody/generate failed: ${getErrorMessage(error)}`);
    return res.status(500).json({ melody: [], state: 'error' });
  }
});

// 训练接口：写入二维 melody 样本
app.post('/melody/train', (req: Request, res: Response) => {
  try {
    const validation = validateTrainingExample(req.body);
    if ('error' in validation) {
      return res.status(400).json({ error: validation.error });
    }

    const data = loadTrainingData();
    data.examples.push(validation.example);
    saveTrainingData(data);

    return res.json({
      message: 'example added',
      totalExamples: data.examples.length,
    });
  } catch (error) {
    logger.error(`POST /melody/train failed: ${getErrorMessage(error)}`);
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`服务启动，监听端口： ${PORT}`);
});
