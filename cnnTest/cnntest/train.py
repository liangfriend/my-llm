import argparse
import copy
import shutil
import sys
import time
from pathlib import Path

import torch
import torch.nn as nn

from cnntest.data import dataset, loader
from cnntest.models import SimpleCNN
from cnntest.paths import DEFAULT_MODEL_PATH


def parse_args():
    parser = argparse.ArgumentParser(description="Train SimpleCNN on samples/")
    parser.add_argument("--epochs", type=int, default=10, help="训练轮数")
    parser.add_argument("--lr", type=float, default=0.01, help="学习率")
    parser.add_argument(
        "--log-interval",
        type=int,
        default=1,
        help="每隔多少个 batch 打印一次进度",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(DEFAULT_MODEL_PATH),
        help="模型保存路径",
    )
    parser.add_argument(
        "--plain-log",
        action="store_true",
        help="每行单独输出，不覆盖上一行（适合保存日志）",
    )
    return parser.parse_args()


def print_progress(message, plain_log=False):
    if plain_log:
        print(message)
        return

    width = shutil.get_terminal_size(fallback=(120, 20)).columns
    padded = message.ljust(width)[:width]
    sys.stdout.write(f"\r{padded}")
    sys.stdout.flush()


def finish_progress_line(plain_log=False):
    if not plain_log:
        sys.stdout.write("\n")
        sys.stdout.flush()


def run_epoch(model, criterion, optimizer, device, epoch, epochs, log_interval, plain_log):
    epoch_loss = 0.0
    correct = 0
    total = 0
    total_batches = len(loader)
    epoch_start = time.perf_counter()

    for batch_idx, (images, labels) in enumerate(loader, start=1):
        images = images.to(device)
        labels = labels.to(device)

        outputs = model(images)
        loss = criterion(outputs, labels)
        model.backward(loss, optimizer)

        batch_loss = loss.item()
        batch_correct = (outputs.argmax(dim=1) == labels).sum().item()
        batch_size = labels.size(0)

        epoch_loss += batch_loss
        correct += batch_correct
        total += batch_size

        if batch_idx % log_interval == 0 or batch_idx == total_batches:
            batch_acc = 100.0 * batch_correct / batch_size
            running_loss = epoch_loss / batch_idx
            running_acc = 100.0 * correct / total
            elapsed = time.perf_counter() - epoch_start

            print_progress(
                f"[Epoch {epoch}/{epochs}] "
                f"Batch {batch_idx}/{total_batches} | "
                f"loss: {batch_loss:.4f} (avg {running_loss:.4f}) | "
                f"acc: {batch_acc:.1f}% (avg {running_acc:.1f}%) | "
                f"samples: {total}/{len(dataset)} | "
                f"time: {elapsed:.1f}s",
                plain_log=plain_log,
            )

    finish_progress_line(plain_log)

    epoch_time = time.perf_counter() - epoch_start
    return {
        "loss": epoch_loss / total_batches,
        "acc": 100.0 * correct / total,
        "time": epoch_time,
    }


def train(epochs, lr, output, log_interval, plain_log):
    device = torch.device("cpu")
    model = SimpleCNN(num_classes=len(dataset.classes)).to(device)
    model.train()

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.SGD(model.parameters(), lr=lr)
    total_batches = len(loader)

    print("=== Training ===")
    print(f"classes:       {dataset.classes}")
    print(f"samples:       {len(dataset)}")
    print(f"batch_size:    {loader.batch_size}")
    print(f"batches/epoch: {total_batches}")
    print(f"device:        {device}")
    print(f"epochs:        {epochs}")
    print(f"lr:            {lr}")
    print(f"log_interval:  {log_interval}")
    print(f"plain_log:     {plain_log}")
    print()

    train_start = time.perf_counter()
    best_acc = -1.0
    best_epoch = 0
    best_state = None

    for epoch in range(1, epochs + 1):
        metrics = run_epoch(
            model, criterion, optimizer, device, epoch, epochs, log_interval, plain_log
        )
        print(
            f"--> Epoch {epoch}/{epochs} finished | "
            f"loss: {metrics['loss']:.4f} | "
            f"acc: {metrics['acc']:.1f}% | "
            f"time: {metrics['time']:.1f}s"
        )
        if metrics["acc"] > best_acc:
            best_acc = metrics["acc"]
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
            print(f"    new best acc: {best_acc:.1f}% at epoch {best_epoch}")
        print()

    total_time = time.perf_counter() - train_start
    save_path = Path(output)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    if best_state is not None:
        model.load_state_dict(best_state)
    model.save(save_path, classes=dataset.classes)

    print("=== Done ===")
    print(f"total time: {total_time:.1f}s")
    print(f"best acc: {best_acc:.1f}% at epoch {best_epoch}")
    print(f"model saved to {save_path}")


def main():
    args = parse_args()
    train(args.epochs, args.lr, args.output, args.log_interval, args.plain_log)


if __name__ == "__main__":
    main()
