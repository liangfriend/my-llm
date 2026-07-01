import type { Notation } from '../notation';

export type Tensor3D = number[][][];

export interface ConvLayerWeights {
  /** [outChannels][inChannels][kh][kw] */
  weights: number[][][][];
  bias: number[];
}

export interface DenseLayerWeights {
  /** [outDim][inDim] */
  weights: number[][];
  bias: number[];
}

export interface CnnWeights {
  version: 1;
  notation: Notation;
  numClasses: number;
  inputSize: number;
  conv1: ConvLayerWeights;
  conv2: ConvLayerWeights;
  conv3: ConvLayerWeights;
  fc1: DenseLayerWeights;
  fc2: DenseLayerWeights;
}

export interface PredictResult {
  label: number;
  probs: number[];
  logits: number[];
}

export interface TrainStepResult extends PredictResult {
  loss: number;
}

export interface BatchSample {
  matrix: number[][];
  label: number;
}

export interface TrainBatchResult {
  loss: number;
  accuracy: number;
  correct: number;
  total: number;
}
