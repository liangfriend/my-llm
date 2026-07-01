import type { Notation } from '../notation';
import { MUSIC_SYMBOL_N_COUNT, MUSIC_SYMBOL_S_COUNT } from '../../enum';
import {
  applyDropout,
  applyRelu3D,
  applyReluVec,
  conv2d,
  conv2dBackward,
  dense,
  denseBackward,
  dropoutBackward,
  globalAvgPool,
  globalAvgPoolBackward,
  grayToTensor,
  maxPool2d,
  maxPool2dBackward,
  relu3dBackward,
  reluVecBackward,
  softmax,
} from './layers';
import type {
  BatchSample,
  CnnWeights,
  ConvLayerWeights,
  DenseLayerWeights,
  PredictResult,
  Tensor3D,
  TrainBatchResult,
  TrainStepResult,
} from './types';

const INPUT_SIZE = 96;
const FC_HIDDEN = 128;
const DROPOUT_P = 0.5;
const CONV_SPECS = [
  { inC: 1, outC: 32 },
  { inC: 32, outC: 64 },
  { inC: 64, outC: 128 },
] as const;

function randScale(scale: number): number {
  return (Math.random() * 2 - 1) * scale;
}

function initConv(inC: number, outC: number, k = 3): ConvLayerWeights {
  const fanIn = inC * k * k;
  const scale = Math.sqrt(2 / fanIn);
  const weights = Array.from({ length: outC }, () =>
    Array.from({ length: inC }, () =>
      Array.from({ length: k }, () => Array.from({ length: k }, () => randScale(scale)))
    )
  );
  return { weights, bias: Array(outC).fill(0) };
}

function initDense(inDim: number, outDim: number): DenseLayerWeights {
  const scale = Math.sqrt(2 / inDim);
  return {
    weights: Array.from({ length: outDim }, () =>
      Array.from({ length: inDim }, () => randScale(scale))
    ),
    bias: Array(outDim).fill(0),
  };
}

export function createInitialWeights(notation: Notation, numClasses: number): CnnWeights {
  return {
    version: 1,
    notation,
    numClasses,
    inputSize: INPUT_SIZE,
    conv1: initConv(1, 32),
    conv2: initConv(32, 64),
    conv3: initConv(64, 128),
    fc1: initDense(128, FC_HIDDEN),
    fc2: initDense(FC_HIDDEN, numClasses),
  };
}

interface ConvGrads {
  gradFilters: number[][][][];
  gradBias: number[];
}

interface DenseGrads {
  gradWeights: number[][];
  gradBias: number[];
}

interface StepGrads {
  loss: number;
  predictedLabel: number;
  probs: number[];
  logits: number[];
  conv1: ConvGrads;
  conv2: ConvGrads;
  conv3: ConvGrads;
  fc1: DenseGrads;
  fc2: DenseGrads;
}

interface ForwardCache {
  input: Tensor3D;
  conv1Pre: Tensor3D;
  conv1Out: Tensor3D;
  pool1Mask: number[][][];
  pool1Out: Tensor3D;
  conv2Pre: Tensor3D;
  conv2Out: Tensor3D;
  pool2Mask: number[][][];
  pool2Out: Tensor3D;
  conv3Pre: Tensor3D;
  conv3Out: Tensor3D;
  pool3Mask: number[][][];
  pool3Out: Tensor3D;
  gapOut: number[];
  fc1Pre: number[];
  fc1Out: number[];
  dropoutMask: number[];
  fc1Dropped: number[];
  logits: number[];
  probs: number[];
}

export class SymbolCnn {
  readonly notation: Notation;
  readonly numClasses: number;
  weights: CnnWeights;
  private cache: ForwardCache | null = null;

  constructor(weights: CnnWeights) {
    this.weights = weights;
    this.notation = weights.notation;
    this.numClasses = weights.numClasses;
  }

  private forwardPass(input: number[][], training: boolean): ForwardCache {
    if (input.length !== INPUT_SIZE || input[0].length !== INPUT_SIZE) {
      throw new Error(`CNN 输入必须为 ${INPUT_SIZE}×${INPUT_SIZE}`);
    }

    const tensor = grayToTensor(input);

    const conv1Raw = conv2d(tensor, this.weights.conv1.weights, this.weights.conv1.bias, 1);
    const conv1 = applyRelu3D(conv1Raw);
    const pool1 = maxPool2d(conv1.output, 2, 2);

    const conv2Raw = conv2d(pool1.output, this.weights.conv2.weights, this.weights.conv2.bias, 1);
    const conv2 = applyRelu3D(conv2Raw);
    const pool2 = maxPool2d(conv2.output, 2, 2);

    const conv3Raw = conv2d(pool2.output, this.weights.conv3.weights, this.weights.conv3.bias, 1);
    const conv3 = applyRelu3D(conv3Raw);
    const pool3 = maxPool2d(conv3.output, 2, 2);

    const gapOut = globalAvgPool(pool3.output);
    const fc1Raw = dense(gapOut, this.weights.fc1.weights, this.weights.fc1.bias);
    const fc1 = applyReluVec(fc1Raw);
    const dropped = applyDropout(fc1.output, DROPOUT_P, training);
    const logits = dense(dropped.output, this.weights.fc2.weights, this.weights.fc2.bias);
    const probs = softmax(logits);

    const cache: ForwardCache = {
      input: tensor,
      conv1Pre: conv1.preActivation,
      conv1Out: conv1.output,
      pool1Mask: pool1.cache.mask,
      pool1Out: pool1.output,
      conv2Pre: conv2.preActivation,
      conv2Out: conv2.output,
      pool2Mask: pool2.cache.mask,
      pool2Out: pool2.output,
      conv3Pre: conv3.preActivation,
      conv3Out: conv3.output,
      pool3Mask: pool3.cache.mask,
      pool3Out: pool3.output,
      gapOut,
      fc1Pre: fc1.preActivation,
      fc1Out: fc1.output,
      dropoutMask: dropped.mask,
      fc1Dropped: dropped.output,
      logits,
      probs,
    };
    this.cache = cache;
    return cache;
  }

  predict(input: number[][]): PredictResult {
    const cache = this.forwardPass(input, false);
    const label = cache.probs.indexOf(Math.max(...cache.probs));
    return { label, probs: cache.probs, logits: cache.logits };
  }

  trainStep(input: number[][], label: number, lr: number): TrainStepResult {
    const grads = this.computeGradients(input, label);
    this.applyGrads(grads, lr);
    return {
      label: grads.predictedLabel,
      probs: grads.probs,
      logits: grads.logits,
      loss: grads.loss,
    };
  }

  trainBatch(samples: BatchSample[], lr: number): TrainBatchResult {
    if (samples.length === 0) {
      throw new Error('batch 不能为空');
    }

    let acc = this.zeroGrads();
    let totalLoss = 0;
    let correct = 0;

    for (const { matrix, label } of samples) {
      const grads = this.computeGradients(matrix, label);
      totalLoss += grads.loss;
      if (grads.predictedLabel === label) correct++;
      this.addGrads(acc, grads);
    }

    const n = samples.length;
    this.scaleGrads(acc, 1 / n);
    this.applyGrads(acc, lr);

    return {
      loss: totalLoss / n,
      accuracy: correct / n,
      correct,
      total: n,
    };
  }

  private computeGradients(input: number[][], label: number): StepGrads {
    if (!Number.isInteger(label) || label < 0 || label >= this.numClasses) {
      throw new Error(`label 必须是 0~${this.numClasses - 1} 的整数`);
    }

    const cache = this.forwardPass(input, true);
    const loss = -Math.log(Math.max(cache.probs[label], 1e-8));
    const gradLogits = cache.probs.map((p, i) => p - (i === label ? 1 : 0));

    const fc2Bw = denseBackward(gradLogits, cache.fc1Dropped, this.weights.fc2.weights);
    const gradFc1Drop = dropoutBackward(fc2Bw.gradInput, cache.dropoutMask, DROPOUT_P);
    const gradFc1 = reluVecBackward(gradFc1Drop, cache.fc1Pre);
    const fc1Bw = denseBackward(gradFc1, cache.gapOut, this.weights.fc1.weights);

    const gradGap = globalAvgPoolBackward(fc1Bw.gradInput, 12, 12);
    const gradPool3 = maxPool2dBackward(gradGap, { mask: cache.pool3Mask }, 24, 24, 128, 2, 2);
    const gradConv3 = relu3dBackward(gradPool3, cache.conv3Pre);
    const conv3Bw = conv2dBackward(gradConv3, cache.pool2Out, this.weights.conv3.weights, 1);

    const gradPool2 = maxPool2dBackward(conv3Bw.gradInput, { mask: cache.pool2Mask }, 48, 48, 64, 2, 2);
    const gradConv2 = relu3dBackward(gradPool2, cache.conv2Pre);
    const conv2Bw = conv2dBackward(gradConv2, cache.pool1Out, this.weights.conv2.weights, 1);

    const gradPool1 = maxPool2dBackward(conv2Bw.gradInput, { mask: cache.pool1Mask }, 96, 96, 32, 2, 2);
    const gradConv1 = relu3dBackward(gradPool1, cache.conv1Pre);
    const conv1Bw = conv2dBackward(gradConv1, cache.input, this.weights.conv1.weights, 1);

    return {
      loss,
      predictedLabel: cache.probs.indexOf(Math.max(...cache.probs)),
      probs: cache.probs,
      logits: cache.logits,
      conv1: { gradFilters: conv1Bw.gradFilters, gradBias: conv1Bw.gradBias },
      conv2: { gradFilters: conv2Bw.gradFilters, gradBias: conv2Bw.gradBias },
      conv3: { gradFilters: conv3Bw.gradFilters, gradBias: conv3Bw.gradBias },
      fc1: { gradWeights: fc1Bw.gradWeights, gradBias: fc1Bw.gradBias },
      fc2: { gradWeights: fc2Bw.gradWeights, gradBias: fc2Bw.gradBias },
    };
  }

  private zeroGrads(): StepGrads {
    const zConv = (layer: ConvLayerWeights): ConvGrads => ({
      gradFilters: layer.weights.map((oc) =>
        oc.map((ic) => ic.map((row) => row.map(() => 0)))
      ),
      gradBias: layer.bias.map(() => 0),
    });
    const zDense = (layer: DenseLayerWeights): DenseGrads => ({
      gradWeights: layer.weights.map((row) => row.map(() => 0)),
      gradBias: layer.bias.map(() => 0),
    });

    return {
      loss: 0,
      predictedLabel: 0,
      probs: [],
      logits: [],
      conv1: zConv(this.weights.conv1),
      conv2: zConv(this.weights.conv2),
      conv3: zConv(this.weights.conv3),
      fc1: zDense(this.weights.fc1),
      fc2: zDense(this.weights.fc2),
    };
  }

  private addGrads(target: StepGrads, source: StepGrads) {
    this.addConvGrads(target.conv1, source.conv1);
    this.addConvGrads(target.conv2, source.conv2);
    this.addConvGrads(target.conv3, source.conv3);
    this.addDenseGrads(target.fc1, source.fc1);
    this.addDenseGrads(target.fc2, source.fc2);
  }

  private scaleGrads(grads: StepGrads, scale: number) {
    this.scaleConvGrads(grads.conv1, scale);
    this.scaleConvGrads(grads.conv2, scale);
    this.scaleConvGrads(grads.conv3, scale);
    this.scaleDenseGrads(grads.fc1, scale);
    this.scaleDenseGrads(grads.fc2, scale);
  }

  private applyGrads(grads: StepGrads, lr: number) {
    this.updateConv(this.weights.conv1, grads.conv1.gradFilters, grads.conv1.gradBias, lr);
    this.updateConv(this.weights.conv2, grads.conv2.gradFilters, grads.conv2.gradBias, lr);
    this.updateConv(this.weights.conv3, grads.conv3.gradFilters, grads.conv3.gradBias, lr);
    this.updateDense(this.weights.fc1, grads.fc1.gradWeights, grads.fc1.gradBias, lr);
    this.updateDense(this.weights.fc2, grads.fc2.gradWeights, grads.fc2.gradBias, lr);
  }

  private addConvGrads(target: ConvGrads, source: ConvGrads) {
    for (let oc = 0; oc < target.gradFilters.length; oc++) {
      target.gradBias[oc] += source.gradBias[oc];
      for (let ic = 0; ic < target.gradFilters[oc].length; ic++) {
        for (let ky = 0; ky < target.gradFilters[oc][ic].length; ky++) {
          for (let kx = 0; kx < target.gradFilters[oc][ic][ky].length; kx++) {
            target.gradFilters[oc][ic][ky][kx] += source.gradFilters[oc][ic][ky][kx];
          }
        }
      }
    }
  }

  private addDenseGrads(target: DenseGrads, source: DenseGrads) {
    for (let i = 0; i < target.gradWeights.length; i++) {
      target.gradBias[i] += source.gradBias[i];
      for (let j = 0; j < target.gradWeights[i].length; j++) {
        target.gradWeights[i][j] += source.gradWeights[i][j];
      }
    }
  }

  private scaleConvGrads(grads: ConvGrads, scale: number) {
    for (let oc = 0; oc < grads.gradFilters.length; oc++) {
      grads.gradBias[oc] *= scale;
      for (let ic = 0; ic < grads.gradFilters[oc].length; ic++) {
        for (let ky = 0; ky < grads.gradFilters[oc][ic].length; ky++) {
          for (let kx = 0; kx < grads.gradFilters[oc][ic][ky].length; kx++) {
            grads.gradFilters[oc][ic][ky][kx] *= scale;
          }
        }
      }
    }
  }

  private scaleDenseGrads(grads: DenseGrads, scale: number) {
    for (let i = 0; i < grads.gradWeights.length; i++) {
      grads.gradBias[i] *= scale;
      for (let j = 0; j < grads.gradWeights[i].length; j++) {
        grads.gradWeights[i][j] *= scale;
      }
    }
  }

  private updateConv(
    layer: ConvLayerWeights,
    gradFilters: number[][][][],
    gradBias: number[],
    lr: number
  ) {
    for (let oc = 0; oc < layer.weights.length; oc++) {
      layer.bias[oc] -= lr * gradBias[oc];
      for (let ic = 0; ic < layer.weights[oc].length; ic++) {
        for (let ky = 0; ky < layer.weights[oc][ic].length; ky++) {
          for (let kx = 0; kx < layer.weights[oc][ic][ky].length; kx++) {
            layer.weights[oc][ic][ky][kx] -= lr * gradFilters[oc][ic][ky][kx];
          }
        }
      }
    }
  }

  private updateDense(
    layer: DenseLayerWeights,
    gradWeights: number[][],
    gradBias: number[],
    lr: number
  ) {
    for (let i = 0; i < layer.weights.length; i++) {
      layer.bias[i] -= lr * gradBias[i];
      for (let j = 0; j < layer.weights[i].length; j++) {
        layer.weights[i][j] -= lr * gradWeights[i][j];
      }
    }
  }
}

export function getNumClasses(notation: Notation): number {
  return notation === 's' ? MUSIC_SYMBOL_S_COUNT : MUSIC_SYMBOL_N_COUNT;
}
