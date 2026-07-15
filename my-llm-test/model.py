"""TinyLM：token embedding + position embedding + lm_head。"""

from __future__ import annotations

import sys
from pathlib import Path

import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checkpoints-test"))

from tokenizer import CharTokenizer  # noqa: E402


class TinyLM(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        n_embd: int = 64,
        block_size: int = 32,
    ) -> None:
        super().__init__()
        self.block_size = block_size
        self.token_emb = nn.Embedding(vocab_size, n_embd)
        # 位置 0 .. block_size-1 各有一个向量
        self.pos_emb = nn.Embedding(block_size, n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        # idx: (B, T) 整数 id
        #
        # 1) 取最后一维长度 T
        #    shape[-1] 就是「最后一维」，对 (B, T) 来说就是 T
        #    等价写法: B, T = idx.shape
        T = idx.shape[-1]
        if T > self.block_size:
            raise ValueError(
                f"序列长度 T={T} 超过 block_size={self.block_size}"
            )

        # 2) arange(T) = [0, 1, 2, ..., T-1]，表示每个字的位置下标
        #    放在和 idx 同一个 device 上（cpu/cuda）， 第二个参数表示在哪里算， idx是什么设备这里就传什么设别就好了
        # 这里的pos是固定的，不仅形状，连值都不会变
        pos = torch.arange(T, device=idx.device)  # (T,)

        # 3) 两个 (B, T, n_embd) 张量按元素相加（不是 JS 的 map，直接 +）
        #    token_emb(idx): (B, T, n_embd)  —— 每个字的向量
        #    pos_emb(pos):   (T, n_embd)     —— 广播成 (B, T, n_embd) 再加
        tok = self.token_emb(idx)
        pos_vec = self.pos_emb(pos)
        # 张量加法，内部重载
        x = tok + pos_vec  # (B, T, n_embd)

        logits = self.lm_head(x)  # (B, T, vocab_size)
        return logits


if __name__ == "__main__":
    tok = CharTokenizer.load()
    model = TinyLM(vocab_size=tok.vocab_size, n_embd=64, block_size=32)
    ids = torch.tensor([tok.encode("你好")], dtype=torch.long)
    print("logits shape:", model(ids).shape)
    print(model)
