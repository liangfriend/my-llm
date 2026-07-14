"""语料加载与字符级 tokenizer。"""

from __future__ import annotations

import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Dataset

from myllm.config import DATA_DIR, ModelConfig


class CharTokenizer:
    """字符级 tokenizer，未知字符映射为 '?' 或首个字符。"""

    def __init__(self, chars: str) -> None:
        if not chars:
            raise ValueError("vocab 不能为空")
        # 去重并保持稳定顺序
        seen: set[str] = set()
        ordered: list[str] = []
        for ch in chars:
            if ch not in seen:
                seen.add(ch)
                ordered.append(ch)
        self.chars = "".join(ordered)
        self.stoi = {ch: i for i, ch in enumerate(self.chars)}
        self.itos = {i: ch for i, ch in enumerate(self.chars)}
        self.unk_id = self.stoi.get("?", 0)

    @classmethod
    def from_text(cls, text: str) -> CharTokenizer:
        return cls("".join(sorted(set(text))))

    @classmethod
    def load(cls, path: Path) -> CharTokenizer:
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(data["chars"])

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"chars": self.chars}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @property
    def vocab_size(self) -> int:
        return len(self.chars)

    def encode(self, text: str) -> list[int]:
        return [self.stoi.get(ch, self.unk_id) for ch in text]

    def decode(self, ids: list[int]) -> str:
        return "".join(self.itos.get(i, "?") for i in ids)


class TextDataset(Dataset):
    """按 block_size 切分的 next-token 数据集。"""

    def __init__(self, data: torch.Tensor, block_size: int) -> None:
        if len(data) <= block_size:
            raise ValueError(
                f"语料过短：需要 > block_size({block_size})，当前 {len(data)} tokens"
            )
        self.data = data
        self.block_size = block_size

    def __len__(self) -> int:
        return len(self.data) - self.block_size

    def __getitem__(self, i: int) -> tuple[torch.Tensor, torch.Tensor]:
        chunk = self.data[i : i + self.block_size + 1]
        x = chunk[:-1]
        y = chunk[1:]
        return x, y


def default_corpus_path() -> Path:
    return DATA_DIR / "raw" / "corpus.txt"


def load_corpus(path: Path | None = None) -> str:
    path = path or default_corpus_path()
    if not path.exists():
        raise FileNotFoundError(f"找不到语料文件: {path}")
    return path.read_text(encoding="utf-8")


def build_dataloaders(
    model_cfg: ModelConfig,
    batch_size: int,
    corpus_path: Path | None = None,
    val_ratio: float = 0.1,
) -> tuple[DataLoader, DataLoader, CharTokenizer]:
    text = load_corpus(corpus_path)
    tokenizer = CharTokenizer.from_text(text)
    ids = torch.tensor(tokenizer.encode(text), dtype=torch.long)

    n = len(ids)
    n_val = max(1, int(n * val_ratio))
    n_train = max(model_cfg.block_size + 1, n - n_val)
    train_ids = ids[:n_train]
    val_ids = ids[n_train:] if n - n_train > model_cfg.block_size else ids[:n_train]

    train_ds = TextDataset(train_ids, model_cfg.block_size)
    val_ds = TextDataset(val_ids, model_cfg.block_size)

    bs = min(batch_size, len(train_ds))
    train_loader = DataLoader(
        train_ds, batch_size=bs, shuffle=True, drop_last=len(train_ds) >= bs
    )
    val_loader = DataLoader(
        val_ds, batch_size=min(batch_size, len(val_ds)), shuffle=False, drop_last=False
    )
    return train_loader, val_loader, tokenizer
