import fs from 'fs';
import path from 'path';
import type { Notation } from '../lib/notation';
import { getModel, saveWeights, weightsFilePath } from '../lib/cnn/weightsStore';
import { createInitialWeights, getNumClasses } from '../lib/cnn/model';
import { chunkSamples, loadSamplesFromDisk, shuffleSamples } from '../lib/sampleLoader';

interface TrainOptions {
  notation: Notation;
  epochs: number;
  batchSize: number;
  lr: number;
  reset: boolean;
}

function parseArgs(argv: string[]): TrainOptions {
  const opts: TrainOptions = {
    notation: 's',
    epochs: 20,
    batchSize: 16,
    lr: 0.001,
    reset: false,
  };

  if (process.env.TRAIN_EPOCHS) opts.epochs = Number(process.env.TRAIN_EPOCHS);
  if (process.env.TRAIN_BATCH_SIZE) opts.batchSize = Number(process.env.TRAIN_BATCH_SIZE);
  if (process.env.TRAIN_LR) opts.lr = Number(process.env.TRAIN_LR);
  if (process.env.TRAIN_NOTATION) {
    opts.notation = String(process.env.TRAIN_NOTATION).trim().toLowerCase() as Notation;
  }
  if (process.env.TRAIN_RESET === '1' || process.env.TRAIN_RESET === 'true') {
    opts.reset = true;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--notation' || arg === '-n') {
      opts.notation = String(argv[++i]).trim().toLowerCase() as Notation;
    } else if (arg === '--epochs' || arg === '-e') {
      opts.epochs = Number(argv[++i]);
    } else if (arg.startsWith('--epochs=')) {
      opts.epochs = Number(arg.slice('--epochs='.length));
    } else if (arg === '--batch-size' || arg === '-b') {
      opts.batchSize = Number(argv[++i]);
    } else if (arg.startsWith('--batch-size=')) {
      opts.batchSize = Number(arg.slice('--batch-size='.length));
    } else if (arg === '--lr') {
      opts.lr = Number(argv[++i]);
    } else if (arg.startsWith('--lr=')) {
      opts.lr = Number(arg.slice('--lr='.length));
    } else if (arg === '--reset' || arg === '-r') {
      opts.reset = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (/^\d+$/.test(arg)) {
      // Windows PowerShell 下 npm 常把 --epochs 吞掉，只剩孤立数字 "2"
      opts.epochs = Number(arg);
    }
  }

  if (opts.notation !== 's' && opts.notation !== 'n') {
    throw new Error('notation 必须是 s 或 n');
  }
  if (!Number.isInteger(opts.epochs) || opts.epochs < 1) {
    throw new Error('epochs 必须是正整数');
  }
  if (!Number.isInteger(opts.batchSize) || opts.batchSize < 1) {
    throw new Error('batch-size 必须是正整数');
  }
  if (!Number.isFinite(opts.lr) || opts.lr <= 0 || opts.lr > 1) {
    throw new Error('lr 必须是 (0, 1] 范围内的数字');
  }

  return opts;
}

function printHelp() {
  console.log(`用法: npm run train -- [选项]

从 samples/{类名}/*.png 加载样本，打乱后批量多轮训练。

选项:
  -n, --notation <s|n>   谱式，默认 s
  -e, --epochs <n>       训练轮数，默认 20
  -b, --batch-size <n>   批大小，默认 16
      --lr <n>           学习率，默认 0.001
  -r, --reset            重置权重后从头训练
  -h, --help             显示帮助

PowerShell 注意: npm 可能吞掉 --epochs 等参数，任选其一:
  npm run train --% --reset --epochs 2
  npm run train -- -r -e 2
  npm run train -- 2              (仅数字时视为 epochs)
  npx ts-node scripts/train-samples.ts --reset --epochs 2
  $env:TRAIN_RESET="1"; npm run train -- 2

环境变量: TRAIN_EPOCHS TRAIN_BATCH_SIZE TRAIN_LR TRAIN_RESET TRAIN_NOTATION
`);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${String(s).padStart(2, '0')}s`;
}

function writeProgressLine(text: string) {
  process.stdout.write(`\r${text.padEnd(100)}`);
}

function finishProgressLine() {
  process.stdout.write('\n');
}

function printLoadProgress(loaded: number, total: number, className: string, fileName: string) {
  if (total === 0) return;
  const pct = total > 0 ? ((loaded / total) * 100).toFixed(1) : '0.0';
  const name = fileName ? `${className}/${fileName}` : '完成';
  writeProgressLine(`[加载样本] ${loaded}/${total} (${pct}%) ${name}`);
  if (loaded >= total) finishProgressLine();
}

function printTrainProgress(params: {
  epoch: number;
  totalEpochs: number;
  batch: number;
  batchesInEpoch: number;
  globalStep: number;
  totalSteps: number;
  batchLoss: number;
  batchAcc: number;
  elapsedMs: number;
}) {
  const {
    epoch,
    totalEpochs,
    batch,
    batchesInEpoch,
    globalStep,
    totalSteps,
    batchLoss,
    batchAcc,
    elapsedMs,
  } = params;

  const overallPct = totalSteps > 0 ? (globalStep / totalSteps) * 100 : 0;
  const elapsedSec = elapsedMs / 1000;
  const etaSec = globalStep > 0 ? (elapsedSec / globalStep) * (totalSteps - globalStep) : 0;

  writeProgressLine(
    `[训练] Epoch ${epoch}/${totalEpochs} | batch ${batch}/${batchesInEpoch} | 总进度 ${overallPct.toFixed(1)}% (${globalStep}/${totalSteps}) | loss ${batchLoss.toFixed(4)} acc ${formatPct(batchAcc)} | 已用 ${formatDuration(elapsedSec)} 剩余 ${formatDuration(etaSec)}`
  );
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const opts = parseArgs(rawArgv);
  const t0 = Date.now();

  console.log('=== 批量训练 samples ===');
  if (rawArgv.length > 0) {
    console.log(`参数: ${rawArgv.join(' ')}`);
  }
  console.log(`谱式: ${opts.notation}  epochs: ${opts.epochs}  batch: ${opts.batchSize}  lr: ${opts.lr}${opts.reset ? '  [reset]' : ''}`);

  if (opts.reset) {
    const filePath = weightsFilePath(opts.notation);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`已删除旧权重: ${filePath}`);
    }
  }

  console.log('\n加载样本...');
  const { samples, skipped, classCounts } = await loadSamplesFromDisk(opts.notation, (p) => {
    printLoadProgress(p.loaded, p.total, p.className, p.fileName);
  });
  const classNum = Object.keys(classCounts).length;
  const batchesPerEpoch = Math.ceil(samples.length / opts.batchSize);
  const totalSteps = opts.epochs * batchesPerEpoch;

  console.log(`共 ${samples.length} 张，${classNum} 个类，每轮 ${batchesPerEpoch} 批，合计 ${totalSteps} 步:`);
  for (const [name, count] of Object.entries(classCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
  if (skipped.length > 0) {
    console.log('\n跳过:');
    for (const item of skipped) {
      console.log(`  ${item.className} (${item.count}): ${item.reason}`);
    }
  }

  const model = getModel(opts.notation);
  if (opts.reset) {
    model.weights = createInitialWeights(opts.notation, getNumClasses(opts.notation));
  }

  console.log('\n开始训练...\n');

  let globalStep = 0;

  for (let epoch = 1; epoch <= opts.epochs; epoch++) {
    const shuffled = shuffleSamples(samples);
    const batches = chunkSamples(shuffled, opts.batchSize);

    let epochLoss = 0;
    let epochCorrect = 0;
    let epochTotal = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const result = model.trainBatch(
        batch.map(({ matrix, label }) => ({ matrix, label })),
        opts.lr
      );

      globalStep++;
      epochLoss += result.loss * result.total;
      epochCorrect += result.correct;
      epochTotal += result.total;

      printTrainProgress({
        epoch,
        totalEpochs: opts.epochs,
        batch: batchIdx + 1,
        batchesInEpoch: batches.length,
        globalStep,
        totalSteps,
        batchLoss: result.loss,
        batchAcc: result.accuracy,
        elapsedMs: Date.now() - t0,
      });
    }

    finishProgressLine();
    const avgLoss = epochLoss / epochTotal;
    const acc = epochCorrect / epochTotal;
    console.log(
      `✓ Epoch ${String(epoch).padStart(2)}/${opts.epochs} 完成  loss=${avgLoss.toFixed(4)}  acc=${formatPct(acc)}  (${epochCorrect}/${epochTotal})`
    );
  }

  saveWeights(model.weights);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n训练完成，权重已保存: ${weightsFilePath(opts.notation)}`);
  console.log(`总耗时 ${formatDuration(Number(elapsed))}`);
}

main().catch((err) => {
  finishProgressLine();
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
