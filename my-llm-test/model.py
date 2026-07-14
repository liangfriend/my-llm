"""最小 TinyLM：Embedding + lm_head。"""

from __future__ import annotations

import sys
from pathlib import Path

import torch
import torch.nn as nn

# 让同仓库里的 checkpoints-test 可被导入
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checkpoints-test"))

from tokenizer import CharTokenizer  # noqa: E402


class TinyLM(nn.Module):
    def __init__(self, vocab_size: int, n_embd: int = 64) -> None:
        super().__init__()
        self.token_emb = nn.Embedding(vocab_size, n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        # idx: (B, T) 整数 id
        x = self.token_emb(idx)  # (B, T, n_embd)
        logits = self.lm_head(x)  # (B, T, vocab_size)
        return logits


if __name__ == "__main__":
    tok = CharTokenizer.load()
    model = TinyLM(vocab_size=tok.vocab_size, n_embd=64)
    ids = torch.tensor([tok.encode("你好")], dtype=torch.long)
    print("logits shape:", model(ids).shape)
    print(model)
