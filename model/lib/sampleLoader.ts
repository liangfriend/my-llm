import fs from 'fs';
import path from 'path';
import { MUSIC_SYMBOL_N, MUSIC_SYMBOL_S } from '../enum';
import { fileToMatrix, GrayMatrix, preprocessTo96 } from './preprocess';
import type { Notation } from './notation';
import type { BatchSample } from './cnn/types';

const MODEL_DIR = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.join(MODEL_DIR, 'samples');

export interface LoadedSample extends BatchSample {
  filePath: string;
  className: string;
}

export interface LoadSamplesResult {
  samples: LoadedSample[];
  skipped: { className: string; count: number; reason: string }[];
  classCounts: Record<string, number>;
}

function labelFromClassName(className: string, notation: Notation): number | null {
  if (notation === 's') {
    const label = (MUSIC_SYMBOL_S as Record<string, number | string>)[className];
    return typeof label === 'number' ? label : null;
  }
  const label = (MUSIC_SYMBOL_N as Record<string, number | string>)[className];
  return typeof label === 'number' ? label : null;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  className: string;
  fileName: string;
}

async function loadPngToInput96(filePath: string): Promise<GrayMatrix> {
  const buffer = fs.readFileSync(filePath);
  const matrix = await fileToMatrix(buffer, 'image/png', path.basename(filePath));
  return preprocessTo96(matrix, 'file');
}

/** 从 samples/{类名}/*.png 加载并预处理为 96×96 */
export async function loadSamplesFromDisk(
  notation: Notation = 's',
  onProgress?: (progress: LoadProgress) => void
): Promise<LoadSamplesResult> {
  if (!fs.existsSync(SAMPLES_DIR)) {
    throw new Error(`samples 目录不存在: ${SAMPLES_DIR}`);
  }

  const samples: LoadedSample[] = [];
  const skipped: LoadSamplesResult['skipped'] = [];
  const classCounts: Record<string, number> = {};

  const tasks: { filePath: string; className: string; label: number }[] = [];

  for (const className of fs.readdirSync(SAMPLES_DIR)) {
    const classDir = path.join(SAMPLES_DIR, className);
    if (!fs.statSync(classDir).isDirectory()) continue;

    const pngFiles = fs
      .readdirSync(classDir)
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => path.join(classDir, f));

    if (pngFiles.length === 0) continue;

    const label = labelFromClassName(className, notation);
    if (label === null) {
      skipped.push({ className, count: pngFiles.length, reason: '无法映射到 label' });
      continue;
    }

    classCounts[className] = 0;
    for (const filePath of pngFiles) {
      tasks.push({ filePath, className, label });
    }
  }

  const total = tasks.length;
  for (let i = 0; i < tasks.length; i++) {
    const { filePath, className, label } = tasks[i];
    onProgress?.({
      loaded: i,
      total,
      className,
      fileName: path.basename(filePath),
    });
    try {
      const matrix = await loadPngToInput96(filePath);
      samples.push({ matrix, label, filePath, className });
      classCounts[className]++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push({ className, count: 1, reason: `${path.basename(filePath)}: ${msg}` });
    }
  }

  onProgress?.({
    loaded: total,
    total,
    className: '',
    fileName: '',
  });

  if (samples.length === 0) {
    throw new Error('samples 目录下没有可用的训练样本');
  }

  return { samples, skipped, classCounts };
}

/** Fisher-Yates 原地打乱 */
export function shuffleSamples<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 按 batchSize 切分 */
export function chunkSamples<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
