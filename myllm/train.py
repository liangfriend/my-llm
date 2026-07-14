"""训练入口：uv run train / POST /train"""

from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Any

import torch
from tqdm import tqdm

from myllm.config import (
    CHECKPOINT_DIR,
    ModelConfig,
    TrainConfig,
    resolve_device,
    to_dict,
)
from myllm.data import build_dataloaders
from myllm.model import LanguageModel, count_parameters


def _estimate_loss(
    model: LanguageModel,
    loader: torch.utils.data.DataLoader,
    device: str,
    eval_iters: int,
) -> float:
    model.eval()
    losses: list[float] = []
    with torch.no_grad():
        for i, (x, y) in enumerate(loader):
            if i >= eval_iters:
                break
            x, y = x.to(device), y.to(device)
            _, loss = model(x, y)
            losses.append(loss.item())
    model.train()
    return sum(losses) / max(len(losses), 1)


def save_checkpoint(
    path: Path,
    model: LanguageModel,
    model_cfg: ModelConfig,
    train_cfg: TrainConfig,
    tokenizer_chars: str,
    iter_num: int,
    best_val_loss: float,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model": model.state_dict(),
            "model_config": to_dict(model_cfg),
            "train_config": to_dict(train_cfg),
            "tokenizer_chars": tokenizer_chars,
            "iter_num": iter_num,
            "best_val_loss": best_val_loss,
        },
        path,
    )


def train(
    model_cfg: ModelConfig | None = None,
    train_cfg: TrainConfig | None = None,
) -> dict[str, Any]:
    """训练循环。返回最终指标，可供 HTTP / CLI 调用。"""
    model_cfg = model_cfg or ModelConfig()
    train_cfg = train_cfg or TrainConfig()

    device = resolve_device(train_cfg.device)
    torch.manual_seed(train_cfg.seed)
    if device == "cuda":
        torch.cuda.manual_seed_all(train_cfg.seed)

    train_loader, val_loader, tokenizer = build_dataloaders(
        model_cfg,
        batch_size=train_cfg.batch_size,
        corpus_path=train_cfg.corpus_path,
        val_ratio=train_cfg.val_ratio,
    )
    model_cfg.vocab_size = tokenizer.vocab_size

    model = LanguageModel(model_cfg).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=train_cfg.learning_rate,
        weight_decay=train_cfg.weight_decay,
    )

    train_cfg.checkpoint_dir.mkdir(parents=True, exist_ok=True)
    best_path = train_cfg.checkpoint_dir / "best.pt"
    last_path = train_cfg.checkpoint_dir / "last.pt"

    n_params = count_parameters(model)
    print(f"device={device}  params={n_params:,}  vocab={tokenizer.vocab_size}")

    best_val = float("inf")
    train_iter = iter(train_loader)
    t0 = time.time()
    history: list[dict[str, float]] = []

    pbar = tqdm(range(1, train_cfg.max_iters + 1), desc="train")
    for it in pbar:
        try:
            x, y = next(train_iter)
        except StopIteration:
            train_iter = iter(train_loader)
            x, y = next(train_iter)

        x, y = x.to(device), y.to(device)
        _, loss = model(x, y)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), train_cfg.grad_clip)
        optimizer.step()

        if it % train_cfg.eval_interval == 0 or it == train_cfg.max_iters:
            train_loss = _estimate_loss(model, train_loader, device, train_cfg.eval_iters)
            val_loss = _estimate_loss(model, val_loader, device, train_cfg.eval_iters)
            history.append({"iter": it, "train_loss": train_loss, "val_loss": val_loss})
            pbar.set_postfix(train=f"{train_loss:.3f}", val=f"{val_loss:.3f}")

            save_checkpoint(
                last_path, model, model_cfg, train_cfg, tokenizer.chars, it, best_val
            )
            if val_loss <= best_val:
                best_val = val_loss
                save_checkpoint(
                    best_path, model, model_cfg, train_cfg, tokenizer.chars, it, best_val
                )

            # 同步保存 tokenizer，方便外部加载
            tokenizer.save(train_cfg.checkpoint_dir / "tokenizer.json")

    elapsed = time.time() - t0
    result = {
        "device": device,
        "params": n_params,
        "vocab_size": tokenizer.vocab_size,
        "best_val_loss": best_val,
        "elapsed_sec": round(elapsed, 2),
        "checkpoint": str(best_path),
        "history": history,
    }
    print(
        f"done  best_val={best_val:.4f}  elapsed={elapsed:.1f}s  saved={best_path}"
    )
    return result


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train a tiny LLM")
    p.add_argument("--max-iters", type=int, default=None)
    p.add_argument("--batch-size", type=int, default=None)
    p.add_argument("--lr", type=float, default=None)
    p.add_argument("--device", type=str, default=None)
    p.add_argument("--corpus", type=str, default=None)
    p.add_argument("--n-layer", type=int, default=None)
    p.add_argument("--n-embd", type=int, default=None)
    p.add_argument("--block-size", type=int, default=None)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    model_cfg = ModelConfig()
    train_cfg = TrainConfig()

    if args.n_layer is not None:
        model_cfg.n_layer = args.n_layer
    if args.n_embd is not None:
        model_cfg.n_embd = args.n_embd
        if model_cfg.n_embd % model_cfg.n_head != 0:
            model_cfg.n_head = 4
    if args.block_size is not None:
        model_cfg.block_size = args.block_size
    if args.max_iters is not None:
        train_cfg.max_iters = args.max_iters
    if args.batch_size is not None:
        train_cfg.batch_size = args.batch_size
    if args.lr is not None:
        train_cfg.learning_rate = args.lr
    if args.device is not None:
        train_cfg.device = args.device
    if args.corpus is not None:
        train_cfg.corpus_path = Path(args.corpus)

    train_cfg.checkpoint_dir = CHECKPOINT_DIR
    train(model_cfg, train_cfg)


if __name__ == "__main__":
    main()
