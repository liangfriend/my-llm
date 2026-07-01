import { Request, Response } from 'express';
import { MUSIC_SYMBOL_S } from '../enum';
import { predict, trainAndSave } from './cnn';
import { getNumClasses } from './cnn/model';
import type { Notation } from './notation';
import {
  cropAndSquare,
  fileToMatrix,
  GrayMatrix,
  parseArr,
  PreprocessError,
  runPreprocess,
} from './preprocess';
import { saveTrainingSample } from './sampleStore';

export type { Notation } from './notation';

const DEFAULT_LR = 0.001;

function parseNotation(raw: unknown): Notation {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 's' || v === 'n') {
    return v;
  }
  throw new PreprocessError('notation 必填，取值为 s（线谱）或 n（简谱）');
}

function parseLabel(raw: unknown, notation: Notation): number {
  if (raw === undefined || raw === null || raw === '') {
    throw new PreprocessError('train 必须提供 label（类别索引）');
  }
  const n = Number(raw);
  const max = getNumClasses(notation) - 1;
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new PreprocessError(`label 必须是 0~${max} 的整数`);
  }
  return n;
}

function parseLearningRate(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_LR;
  }
  const lr = Number(raw);
  if (!Number.isFinite(lr) || lr <= 0 || lr > 1) {
    throw new PreprocessError('lr 必须是 (0, 1] 范围内的数字');
  }
  return lr;
}

function labelName(notation: Notation, label: number): string {
  if (notation === 's') {
    return MUSIC_SYMBOL_S[label] ?? `UNKNOWN_${label}`;
  }
  return `N_${label}`;
}

async function resolveMatrix(req: Request): Promise<{ matrix: GrayMatrix; source: 'file' | 'arr' }> {
  const arrField = req.body?.arr;
  if (arrField !== undefined && arrField !== null && String(arrField).trim() !== '') {
    let parsed: unknown;
    try {
      parsed = typeof arrField === 'string' ? JSON.parse(arrField) : arrField;
    } catch {
      throw new PreprocessError('arr 不是合法 JSON');
    }
    return { matrix: parseArr(parsed), source: 'arr' };
  }

  const file = req.file;
  if (file?.buffer) {
    const matrix = await fileToMatrix(file.buffer, file.mimetype, file.originalname);
    return { matrix, source: 'file' };
  }

  throw new PreprocessError('请提供 file 或 arr');
}

export async function handleMsdRequest(req: Request, res: Response, mode: 'detect' | 'train') {
  try {
    const notation = parseNotation(req.body?.notation);
    const { matrix, source } = await resolveMatrix(req);
    const { matrix: input96 } = await runPreprocess({ notation, source, matrix });

    if (mode === 'detect') {
      const result = predict(notation, input96);
      res.json({
        ok: true,
        notation,
        label: result.label,
        labelName: labelName(notation, result.label),
        probs: result.probs,
      });
      return;
    }

    const label = parseLabel(req.body?.label, notation);
    const lr = parseLearningRate(req.body?.lr);
    const result = trainAndSave(notation, input96, label, lr);

    let sampleFile: string | undefined;
    try {
      const sampleMatrix = cropAndSquare(matrix);
      sampleFile = await saveTrainingSample(notation, label, sampleMatrix);
    } catch (saveErr) {
      console.error('[samples] 保存训练样本失败:', saveErr);
    }

    res.json({
      ok: true,
      notation,
      label: result.label,
      labelName: labelName(notation, result.label),
      expectedLabel: label,
      loss: result.loss,
      probs: result.probs,
      weightsFile: `weights-${notation}.json`,
      sampleFile,
    });
  } catch (err) {
    if (err instanceof PreprocessError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    console.error(`POST /msd/${mode} failed:`, err);
    res.status(500).json({ ok: false, error: 'internal server error' });
  }
}
