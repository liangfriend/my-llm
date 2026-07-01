import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { loadWeights } from './lib/cnn/weightsStore';
import { handleMsdRequest } from './lib/msdHandler';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// 启动时加载/初始化线谱、简谱两套权重
loadWeights('s');
loadWeights('n');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/symbol/test', (_req: Request, res: Response) => {
  res.json({ text: '接口访问成功' });
});

app.post('/msd/detect', upload.single('file'), (req, res) => {
  void handleMsdRequest(req, res, 'detect');
});

app.post('/msd/train', upload.single('file'), (req, res) => {
  void handleMsdRequest(req, res, 'train');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务启动，监听端口：${PORT}`);
});
