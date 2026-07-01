import sharp from 'sharp';

/** CNN 输入边长 */
export const TARGET_SIZE = 96;

/** 灰度 ≥ 此值视为白色背景（裁边用） */
export const WHITE_THRESHOLD = 0.95;

/** 内部统一格式：0=笔画（黑），1=背景（白） */
export type GrayMatrix = number[][];

export interface PreprocessResult {
  matrix: GrayMatrix;
  width: number;
  height: number;
  source: 'file' | 'arr';
  notation: 's' | 'n';
}

export class PreprocessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreprocessError';
  }
}

/** 将 arr 原始值归一化到 [0,1]；支持 0/1 或 0~255 */
export function normalizeArrValue(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new PreprocessError('arr 含有非数字元素');
  }
  if (n <= 1) {
    return Math.min(1, Math.max(0, n));
  }
  return Math.min(1, Math.max(0, n / 255));
}

/**
 * 解析二维 arr
 * 约定：0=背景（白），1=笔画（黑）→ 转为内部 0=笔画、1=背景
 */
export function parseArr(raw: unknown): GrayMatrix {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new PreprocessError('arr 必须是非空二维数组');
  }
  const matrix: GrayMatrix = [];
  const width = Array.isArray(raw[0]) ? raw[0].length : 0;
  if (width === 0) {
    throw new PreprocessError('arr 每行必须是非空数组');
  }

  for (let y = 0; y < raw.length; y++) {
    const row = raw[y];
    if (!Array.isArray(row) || row.length !== width) {
      throw new PreprocessError('arr 必须是规整的矩形二维数组');
    }
    matrix.push(
      row.map(cell => {
        const v = normalizeArrValue(cell);
        // 0=背景 1=笔画 → 内部 0=笔画 1=背景
        return 1 - v;
      })
    );
  }
  return matrix;
}

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const ALLOWED_EXT = /\.(png|jpe?g|webp|svg)$/i;

/** 从上传文件解码为灰度矩阵 */
export async function fileToMatrix(
  buffer: Buffer,
  mimetype: string,
  originalname: string
): Promise<GrayMatrix> {
  const mimeOk = ALLOWED_MIME.has(mimetype);
  const extOk = ALLOWED_EXT.test(originalname || '');
  if (!mimeOk && !extOk) {
    throw new PreprocessError('file 仅支持 png、jpg、svg、webp');
  }

  const isSvg =
    mimetype === 'image/svg+xml' || /\.svg$/i.test(originalname || '');

  let pipeline = sharp(buffer, isSvg ? { density: 192 } : undefined)
    .flatten({ background: '#ffffff' })
    .grayscale();

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });

  const matrix: GrayMatrix = [];
  for (let y = 0; y < info.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < info.width; x++) {
      const idx = y * info.width + x;
      // sharp 灰度：0=黑，255=白 → 内部 0=笔画 1=背景
      row.push(data[idx] / 255);
    }
    matrix.push(row);
  }
  return matrix;
}

function isWhite(value: number): boolean {
  return value >= WHITE_THRESHOLD;
}

/** 从四周向内裁掉全白行/列 */
export function trimWhiteBorders(matrix: GrayMatrix): GrayMatrix {
  if (matrix.length === 0 || matrix[0].length === 0) {
    throw new PreprocessError('图像为空');
  }

  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;

  while (top <= bottom && matrix[top].every(isWhite)) top++;
  while (bottom >= top && matrix[bottom].every(isWhite)) bottom--;
  while (left <= right && matrix.every(row => isWhite(row[left]))) left++;
  while (right >= left && matrix.every(row => isWhite(row[right]))) right--;

  if (top > bottom || left > right) {
    throw new PreprocessError('裁切后无有效内容');
  }

  const cropped: GrayMatrix = [];
  for (let y = top; y <= bottom; y++) {
    cropped.push(matrix[y].slice(left, right + 1));
  }
  return cropped;
}

/** 非正方形时向右或向下补白（1.0）成正方形 */
export function padToSquare(matrix: GrayMatrix): GrayMatrix {
  const h = matrix.length;
  const w = matrix[0].length;
  if (h === w) {
    return matrix;
  }

  if (w > h) {
    const padRows = w - h;
    const padded = matrix.map(row => [...row]);
    for (let i = 0; i < padRows; i++) {
      padded.push(Array(w).fill(1));
    }
    return padded;
  }

  const padCols = h - w;
  return matrix.map(row => [...row, ...Array(padCols).fill(1)]);
}

function matrixToBuffer(matrix: GrayMatrix): Buffer {
  const n = matrix.length;
  const buf = Buffer.alloc(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      buf[y * n + x] = Math.round(matrix[y][x] * 255);
    }
  }
  return buf;
}

/** 正方形矩阵缩放到 TARGET_SIZE×TARGET_SIZE */
export async function resizeSquare(
  matrix: GrayMatrix,
  kernel: 'nearest' | 'lanczos3'
): Promise<GrayMatrix> {
  const n = matrix.length;
  if (n === 0 || matrix[0].length !== n) {
    throw new PreprocessError('resize 输入必须是正方形矩阵');
  }
  if (n === TARGET_SIZE) {
    return matrix;
  }

  const buf = matrixToBuffer(matrix);
  const { data, info } = await sharp(buf, { raw: { width: n, height: n, channels: 1 } })
    .resize(TARGET_SIZE, TARGET_SIZE, { kernel })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const size = info.width;
  const channels = info.channels ?? 1;
  const result: GrayMatrix = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * channels;
      row.push(data[idx] / 255);
    }
    result.push(row);
  }
  return result;
}

/** 裁边 + 补方（保存样本用，保留原分辨率） */
export function cropAndSquare(matrix: GrayMatrix): GrayMatrix {
  return padToSquare(trimWhiteBorders(matrix));
}

/** 完整预处理管线 */
export async function preprocessTo96(
  matrix: GrayMatrix,
  source: 'file' | 'arr'
): Promise<GrayMatrix> {
  const squared = cropAndSquare(matrix);
  const kernel = source === 'arr' ? 'nearest' : 'lanczos3';
  return resizeSquare(squared, kernel);
}

export async function runPreprocess(params: {
  notation: 's' | 'n';
  source: 'file' | 'arr';
  matrix: GrayMatrix;
}): Promise<PreprocessResult> {
  const processed = await preprocessTo96(params.matrix, params.source);
  return {
    matrix: processed,
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    source: params.source,
    notation: params.notation,
  };
}
