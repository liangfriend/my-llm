"""模型与训练超参数。"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CHECKPOINT_DIR = ROOT / "checkpoints"


@dataclass
class ModelConfig:
    vocab_size: int = 256
    n_embd: int = 128
    n_head: int = 4
    n_layer: int = 4
    block_size: int = 128
    dropout: float = 0.1


@dataclass
class TrainConfig:
    batch_size: int = 32
    learning_rate: float = 3e-4
    max_iters: int = 2000
    eval_interval: int = 100
    eval_iters: int = 20
    weight_decay: float = 0.1
    grad_clip: float = 1.0
    seed: int = 42
    device: str = "auto"  # auto | cuda | cpu | mps
    checkpoint_dir: Path = field(default_factory=lambda: CHECKPOINT_DIR)
    corpus_path: Path = field(default_factory=lambda: DATA_DIR / "raw" / "corpus.txt")
    val_ratio: float = 0.1


@dataclass
class ChatConfig:
    max_new_tokens: int = 120
    temperature: float = 0.8
    top_k: int | None = 40
    device: str = "auto"
    checkpoint: Path = field(default_factory=lambda: CHECKPOINT_DIR / "best.pt")


def resolve_device(device: str) -> str:
    import torch

    if device == "auto":
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    return device


def to_dict(cfg: object) -> dict:
    d = asdict(cfg)
    for k, v in list(d.items()):
        if isinstance(v, Path):
            d[k] = str(v)
    return d
