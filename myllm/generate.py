"""模型加载与文本生成。"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch

from myllm.config import CHECKPOINT_DIR, ModelConfig, resolve_device
from myllm.data import CharTokenizer
from myllm.model import LanguageModel


@dataclass
class LoadedModel:
    model: LanguageModel
    tokenizer: CharTokenizer
    model_cfg: ModelConfig
    device: str
    checkpoint: Path


def load_checkpoint(
    checkpoint: Path | None = None,
    device: str = "auto",
) -> LoadedModel:
    path = checkpoint or (CHECKPOINT_DIR / "best.pt")
    if not path.exists():
        raise FileNotFoundError(
            f"找不到 checkpoint: {path}。请先运行训练：uv run train"
        )

    device = resolve_device(device)
    ckpt: dict[str, Any] = torch.load(path, map_location=device, weights_only=False)

    cfg_dict = ckpt["model_config"]
    model_cfg = ModelConfig(**{k: v for k, v in cfg_dict.items() if k in ModelConfig.__dataclass_fields__})
    tokenizer = CharTokenizer(ckpt["tokenizer_chars"])
    model_cfg.vocab_size = tokenizer.vocab_size

    model = LanguageModel(model_cfg).to(device)
    model.load_state_dict(ckpt["model"])
    model.eval()
    return LoadedModel(
        model=model,
        tokenizer=tokenizer,
        model_cfg=model_cfg,
        device=device,
        checkpoint=path,
    )


def generate_text(
    prompt: str,
    *,
    loaded: LoadedModel | None = None,
    checkpoint: Path | None = None,
    max_new_tokens: int = 100,
    temperature: float = 1.0,
    top_k: int | None = 40,
    device: str = "auto",
    stop_str: str | None = None,
) -> str:
    """对 prompt 做续写，返回完整文本（含 prompt）。"""
    loaded = loaded or load_checkpoint(checkpoint, device=device)
    ids = loaded.tokenizer.encode(prompt)
    if not ids:
        ids = [0]
    idx = torch.tensor([ids], dtype=torch.long, device=loaded.device)

    stop_ids: set[int] | None = None
    if stop_str:
        # 遇到 stop_str 的首字符则停（简单策略）
        stop_ids = {loaded.tokenizer.encode(stop_str)[0]} if stop_str else None

    out = loaded.model.generate(
        idx,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_k=top_k,
        stop_ids=stop_ids,
    )
    return loaded.tokenizer.decode(out[0].tolist())


def generate(
    prompt: str,
    checkpoint: Path | None = None,
    max_new_tokens: int = 100,
    temperature: float = 1.0,
    top_k: int | None = None,
    device: str = "auto",
) -> str:
    return generate_text(
        prompt,
        checkpoint=checkpoint,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_k=top_k,
        device=device,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate text with a trained LLM")
    p.add_argument("--prompt", type=str, default="User: 你好\nAssistant:")
    p.add_argument("--checkpoint", type=Path, default=CHECKPOINT_DIR / "best.pt")
    p.add_argument("--max-new-tokens", type=int, default=100)
    p.add_argument("--temperature", type=float, default=0.8)
    p.add_argument("--top-k", type=int, default=40)
    p.add_argument("--device", type=str, default="auto")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    text = generate(
        prompt=args.prompt,
        checkpoint=args.checkpoint,
        max_new_tokens=args.max_new_tokens,
        temperature=args.temperature,
        top_k=args.top_k,
        device=args.device,
    )
    print(text)


if __name__ == "__main__":
    main()
