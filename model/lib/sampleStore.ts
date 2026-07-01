import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { MUSIC_SYMBOL_N, MUSIC_SYMBOL_S } from '../enum';
import type { Notation } from './notation';
import type { GrayMatrix } from './preprocess';

const MODEL_DIR = path.resolve(__dirname, '..');

function symbolEnglishName(notation: Notation, label: number): string {
  if (notation === 's') {
    return String(MUSIC_SYMBOL_S[label] ?? `UNKNOWN_${label}`);
  }
  const nName = (MUSIC_SYMBOL_N as unknown as Record<number, string>)[label];
  return nName ?? `N_${label}`;
}

function matrixToRawBuffer(matrix: GrayMatrix): Buffer {
  const n = matrix.length;
  const buf = Buffer.alloc(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      buf[y * n + x] = Math.round(matrix[y][x] * 255);
    }
  }
  return buf;
}

/** 训练后将灰度矩阵存为 PNG：samples/{符号英文名}/{timestamp}.png */
export async function saveTrainingSample(
  notation: Notation,
  label: number,
  matrix: GrayMatrix
): Promise<string> {
  const name = symbolEnglishName(notation, label);
  const dir = path.join(MODEL_DIR, 'samples', name);
  fs.mkdirSync(dir, { recursive: true });

  const n = matrix.length;
  const filename = `${Date.now()}.png`;
  const filePath = path.join(dir, filename);
  const raw = matrixToRawBuffer(matrix);

  await sharp(raw, { raw: { width: n, height: n, channels: 1 } })
    .png()
    .toFile(filePath);

  return path.relative(MODEL_DIR, filePath).replace(/\\/g, '/');
}
