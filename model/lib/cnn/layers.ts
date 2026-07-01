import type { Tensor3D } from './types';

export function relu(x: number): number {
  return x > 0 ? x : 0;
}

export function reluDerivative(x: number): number {
  return x > 0 ? 1 : 0;
}

export function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exp = logits.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(v => v / sum);
}

export function createTensor3D(h: number, w: number, c: number, fill = 0): Tensor3D {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => Array(c).fill(fill))
  );
}

export function grayToTensor(input: number[][]): Tensor3D {
  const h = input.length;
  const w = input[0].length;
  const tensor = createTensor3D(h, w, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      tensor[y][x][0] = input[y][x];
    }
  }
  return tensor;
}

export interface PoolCache {
  /** 每个输出位置记录 2×2 窗口内最大值索引 0~3 */
  mask: number[][][];
}

export function conv2d(
  input: Tensor3D,
  filters: number[][][][],
  bias: number[],
  pad = 1
): Tensor3D {
  const h = input.length;
  const w = input[0].length;
  const inC = input[0][0].length;
  const outC = filters.length;
  const k = filters[0][0].length;
  const out = createTensor3D(h, w, outC);

  for (let oc = 0; oc < outC; oc++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = bias[oc];
        for (let ic = 0; ic < inC; ic++) {
          for (let ky = 0; ky < k; ky++) {
            for (let kx = 0; kx < k; kx++) {
              const iy = y + ky - pad;
              const ix = x + kx - pad;
              if (iy >= 0 && iy < h && ix >= 0 && ix < w) {
                sum += input[iy][ix][ic] * filters[oc][ic][ky][kx];
              }
            }
          }
        }
        out[y][x][oc] = sum;
      }
    }
  }
  return out;
}

export function applyRelu3D(input: Tensor3D): { output: Tensor3D; preActivation: Tensor3D } {
  const h = input.length;
  const w = input[0].length;
  const c = input[0][0].length;
  const output = createTensor3D(h, w, c);
  const preActivation = createTensor3D(h, w, c);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        preActivation[y][x][ch] = input[y][x][ch];
        output[y][x][ch] = relu(input[y][x][ch]);
      }
    }
  }
  return { output, preActivation };
}

export function maxPool2d(input: Tensor3D, size = 2, stride = 2): { output: Tensor3D; cache: PoolCache } {
  const inH = input.length;
  const inW = input[0].length;
  const channels = input[0][0].length;
  const outH = Math.floor((inH - size) / stride) + 1;
  const outW = Math.floor((inW - size) / stride) + 1;
  const output = createTensor3D(outH, outW, channels);
  const mask = createTensor3D(outH, outW, channels);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      for (let ch = 0; ch < channels; ch++) {
        let maxVal = -Infinity;
        let maxIdx = 0;
        let idx = 0;
        for (let py = 0; py < size; py++) {
          for (let px = 0; px < size; px++) {
            const val = input[y * stride + py][x * stride + px][ch];
            if (val > maxVal) {
              maxVal = val;
              maxIdx = idx;
            }
            idx++;
          }
        }
        output[y][x][ch] = maxVal;
        mask[y][x][ch] = maxIdx;
      }
    }
  }
  return { output, cache: { mask } };
}

export function globalAvgPool(input: Tensor3D): number[] {
  const h = input.length;
  const w = input[0].length;
  const c = input[0][0].length;
  const area = h * w;
  const out = Array(c).fill(0);
  for (let ch = 0; ch < c; ch++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        sum += input[y][x][ch];
      }
    }
    out[ch] = sum / area;
  }
  return out;
}

export function dense(input: number[], weights: number[][], bias: number[]): number[] {
  return weights.map((row, i) => row.reduce((sum, w, j) => sum + w * input[j], 0) );//+ bias[i]
}

export function applyReluVec(input: number[]): { output: number[]; preActivation: number[] } {
  const preActivation = [...input];
  const output = input.map(relu);
  return { output, preActivation };
}

export function applyDropout(input: number[], p: number, training: boolean): { output: number[]; mask: number[] } {
  if (!training || p <= 0) {
    return { output: [...input], mask: Array(input.length).fill(1) };
  }
  const scale = 1 / (1 - p);
  const mask = input.map(() => (Math.random() < p ? 0 : 1));
  const output = input.map((v, i) => v * mask[i] * scale);
  return { output, mask };
}

/** MaxPool 反向传播 */
export function maxPool2dBackward(
  gradOut: Tensor3D,
  cache: PoolCache,
  inH: number,
  inW: number,
  channels: number,
  size = 2,
  stride = 2
): Tensor3D {
  const gradIn = createTensor3D(inH, inW, channels);
  const outH = gradOut.length;
  const outW = gradOut[0].length;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      for (let ch = 0; ch < channels; ch++) {
        const maxIdx = cache.mask[y][x][ch];
        const py = Math.floor(maxIdx / size);
        const px = maxIdx % size;
        const iy = y * stride + py;
        const ix = x * stride + px;
        gradIn[iy][ix][ch] += gradOut[y][x][ch];
      }
    }
  }
  return gradIn;
}

/** GAP 反向传播 */
export function globalAvgPoolBackward(gradOut: number[], h: number, w: number): Tensor3D {
  const c = gradOut.length;
  const gradIn = createTensor3D(h, w, c);
  const scale = 1 / (h * w);
  for (let ch = 0; ch < c; ch++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        gradIn[y][x][ch] = gradOut[ch] * scale;
      }
    }
  }
  return gradIn;
}

export function conv2dBackward(
  gradOut: Tensor3D,
  input: Tensor3D,
  filters: number[][][][],
  pad = 1
): { gradInput: Tensor3D; gradFilters: number[][][][]; gradBias: number[] } {
  const h = input.length;
  const w = input[0].length;
  const inC = input[0][0].length;
  const outC = filters.length;
  const k = filters[0][0].length;

  const gradInput = createTensor3D(h, w, inC);
  const gradFilters = filters.map(oc =>
    oc.map(ic => ic.map(row => row.map(() => 0)))
  );
  const gradBias = Array(outC).fill(0);

  for (let oc = 0; oc < outC; oc++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const upstream = gradOut[y][x][oc];
        if (upstream === 0) continue;
        gradBias[oc] += upstream;
        for (let ic = 0; ic < inC; ic++) {
          for (let ky = 0; ky < k; ky++) {
            for (let kx = 0; kx < k; kx++) {
              const iy = y + ky - pad;
              const ix = x + kx - pad;
              if (iy >= 0 && iy < h && ix >= 0 && ix < w) {
                gradFilters[oc][ic][ky][kx] += upstream * input[iy][ix][ic];
                gradInput[iy][ix][ic] += upstream * filters[oc][ic][ky][kx];
              }
            }
          }
        }
      }
    }
  }
  return { gradInput, gradFilters, gradBias };
}

export function relu3dBackward(gradOut: Tensor3D, preActivation: Tensor3D): Tensor3D {
  const h = gradOut.length;
  const w = gradOut[0].length;
  const c = gradOut[0][0].length;
  const gradIn = createTensor3D(h, w, c);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < c; ch++) {
        gradIn[y][x][ch] = gradOut[y][x][ch] * reluDerivative(preActivation[y][x][ch]);
      }
    }
  }
  return gradIn;
}

export function denseBackward(
  gradOut: number[],
  input: number[],
  weights: number[][]
): { gradInput: number[]; gradWeights: number[][]; gradBias: number[] } {
  const inDim = input.length;
  const outDim = gradOut.length;
  const gradInput = Array(inDim).fill(0);
  const gradWeights = weights.map(row => row.map(() => 0));
  const gradBias = [...gradOut];

  for (let i = 0; i < outDim; i++) {
    for (let j = 0; j < inDim; j++) {
      gradWeights[i][j] += gradOut[i] * input[j];
      gradInput[j] += gradOut[i] * weights[i][j];
    }
  }
  return { gradInput, gradWeights, gradBias };
}

export function reluVecBackward(gradOut: number[], preActivation: number[]): number[] {
  return gradOut.map((g, i) => g * reluDerivative(preActivation[i]));
}

export function dropoutBackward(gradOut: number[], mask: number[], p: number): number[] {
  const scale = 1 / (1 - p);
  return gradOut.map((g, i) => g * mask[i] * scale);
}
