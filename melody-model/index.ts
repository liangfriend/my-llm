import express, { Request, Response } from 'express';
const cors = require('cors');
import { generateMelody } from './lib/generator';
import { validateIncomingMelody, ValidationResult } from './lib/validation';
import { loadTrainingData, saveTrainingData } from './lib/storage';
import { RawNote } from './lib/note';
import {GenerateOptions, GenerateResult} from "./type";
import logger from "./lib/logger";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
// {
//     origin: 'http://localhost:9080'  // 明确指定前端地址
// }
app.use(cors()); // 不设置跨域限制
app.use(express.json({ limit: '1mb' }));
// 连接测试接口
app.get('/melody/test', (_req: Request, res: Response) => {
    logger.info(`Server listening on port ${PORT}`);
    console.log('打印',res)
  res.json({text:'接口访问成功'});
});

// 旋律生成接口
app.post(
  '/melody/generate',
  (req: Request<unknown, unknown, GenerateOptions>, res: Response) => {
    const {
      text,
      seedMelody,
      length,
      params,
      totalChronaxie,
      minMidi,
      maxMidi,
      minChronaxie,
      minChronaxieInterval,
    } = req.body || {};
    if (text !== undefined && typeof text !== 'string') {
      return res.status(400).json({ error: 'text must be a string when provided' });
    }
    if (seedMelody !== undefined && !Array.isArray(seedMelody)) {
      return res.status(400).json({ error: 'seedMelody must be an array when provided' });
    }
    const result: GenerateResult = generateMelody({
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
  },
);
// 训练接口
app.post(
  '/melody/train',
  (
    req: Request<unknown, unknown, { text?: string; melody?: RawNote[]; params?: Record<string, unknown> }>,
    res: Response,
  ) => {
    const { text, melody, params } = req.body || {};
    const validation: ValidationResult = validateIncomingMelody(melody);
    if ('error' in validation) {
      return res.status(400).json({ error: validation.error });
    }

    const data = loadTrainingData();
    data.examples.push({
      input: typeof text === 'string' ? text : undefined,
      params: params || {},
      melody: validation.melody,
    });
    saveTrainingData(data);

    return res.json({
      message: 'example added',
      totalExamples: data.examples.length,
    });
  },
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
