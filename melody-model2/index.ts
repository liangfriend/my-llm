import express, { Request, Response } from 'express';
const cors = require('cors');

/** POST /melody/generate 请求体（第 1 步：仅 noteLength） */
interface GenerateOptions {
  noteLength?: unknown;
}

const DEFAULT_NOTE_LENGTH = 8;
const DEFAULT_MIDI = 60;
const DEFAULT_CHRONAXIE = 64;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
};

const parseNoteLength = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return DEFAULT_NOTE_LENGTH;
  }
  return Math.min(Math.round(num), 512);
};

const buildPlaceholderMelody = (noteLength: number) =>
  Array.from({ length: noteLength }, () => ({
    midi: DEFAULT_MIDI,
    chronaxie: DEFAULT_CHRONAXIE,
  }));

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 连接测试接口
app.get('/melody/test', (_req: Request, res: Response) => {
  try {
    console.log(`melody-model2 listening on port ${PORT}`);
    res.json({ text: '接口访问成功' });
  } catch (error) {
    console.error(`GET /melody/test failed: ${getErrorMessage(error)}`);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 旋律生成接口（第 1 步：固定 midi/chronaxie 占位）
app.post('/melody/generate', (req: Request<unknown, unknown, GenerateOptions>, res: Response) => {
  try {
    const noteLength = parseNoteLength(req.body?.noteLength);
    const melody = buildPlaceholderMelody(noteLength);
    return res.json({ melody, state: 'success' });
  } catch (error) {
    console.error(`POST /melody/generate failed: ${getErrorMessage(error)}`);
    return res.status(500).json({ melody: [], state: 'error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`melody-model2 服务启动，监听端口： ${PORT}`);
});
