"""TinyLM：Embedding + N × Block(Attn+MLP) + lm_head。"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checkpoints-test"))

from tokenizer import CharTokenizer  # noqa: E402


class CausalSelfAttention(nn.Module):
    """因果自注意力：位置 t 只能看 0..t。"""

    def __init__(
        self,
        n_embd: int,
        n_head: int,
        block_size: int,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        assert n_embd % n_head == 0, "n_embd 必须能被 n_head 整除"
        self.n_head = n_head
        self.n_embd = n_embd
        self.head_dim = n_embd // n_head

        self.c_attn = nn.Linear(n_embd, 3 * n_embd)
        self.c_proj = nn.Linear(n_embd, n_embd)
        self.attn_drop = nn.Dropout(dropout)
        self.resid_drop = nn.Dropout(dropout)

        mask = torch.tril(torch.ones(block_size, block_size))
        self.register_buffer("mask", mask.view(1, 1, block_size, block_size))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape

        qkv = self.c_attn(x)
        q, k, v = qkv.split(self.n_embd, dim=2)
        q = q.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.n_head, self.head_dim).transpose(1, 2)

        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.head_dim))
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)
        att = self.attn_drop(att)

        y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.resid_drop(self.c_proj(y))


class MLP(nn.Module):
    """位置级前馈网络：每个字的向量独立过同一套 Linear→GELU→Linear。

    Attention 负责「和谁交互」；MLP 负责「在当前位置上做非线性变换」。
    中间通常扩到 4 * n_embd。
    """

    def __init__(self, n_embd: int, dropout: float = 0.0) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_embd, 4 * n_embd),
            nn.GELU(),
            nn.Linear(4 * n_embd, n_embd),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class Block(nn.Module):
    """一层 Transformer：Pre-LN + Attn 残差 + Pre-LN + MLP 残差。"""

    def __init__(
        self,
        n_embd: int,
        n_head: int,
        block_size: int,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        self.ln1 = nn.LayerNorm(n_embd)
        self.attn = CausalSelfAttention(n_embd, n_head, block_size, dropout)
        self.ln2 = nn.LayerNorm(n_embd)
        self.mlp = MLP(n_embd, dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 残差连接让参数获取上文信息
        x = x + self.attn(self.ln1(x))
        # 再次残差连接增强非线性能力，这是transformer的常见做法
        x = x + self.mlp(self.ln2(x))
        return x


class TinyLM(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        n_embd: int = 64,
        block_size: int = 32,
        n_head: int = 4,
        n_layer: int = 4,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        self.block_size = block_size
        self.token_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(block_size, n_embd)
        self.drop = nn.Dropout(dropout)
        self.blocks = nn.ModuleList(
            [
                Block(n_embd, n_head, block_size, dropout)
                for _ in range(n_layer)
            ]
        )
        self.ln_f = nn.LayerNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size, bias=False)
        # 词嵌入与输出层共用权重（常见小技巧）
        self.lm_head.weight = self.token_emb.weight

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        T = idx.shape[-1]
        if T > self.block_size:
            raise ValueError(
                f"序列长度 T={T} 超过 block_size={self.block_size}"
            )

        pos = torch.arange(T, device=idx.device)
        x = self.drop(self.token_emb(idx) + self.pos_emb(pos))

        for block in self.blocks:
            x = block(x)

        x = self.ln_f(x)
        logits = self.lm_head(x)
        return logits

    @torch.no_grad()
    def generate(
        self,
        idx: torch.Tensor,
        max_new_tokens: int,
        temperature: float = 1.0,
        top_k: int | None = None,
    ) -> torch.Tensor:
        """自回归生成。idx: (B, T) → (B, T + max_new_tokens)。"""
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -self.block_size :]
            logits = self(idx_cond)[:, -1, :] / max(temperature, 1e-8)
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = float("-inf")
            probs = F.softmax(logits, dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            idx = torch.cat([idx, next_id], dim=1)
        return idx


if __name__ == "__main__":
    tok = CharTokenizer.load()
    model = TinyLM(
        vocab_size=tok.vocab_size,
        n_embd=64,
        block_size=32,
        n_head=4,
        n_layer=4,
    )
    ids = torch.tensor([tok.encode("你好")], dtype=torch.long)
    print("logits shape:", model(ids).shape)
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"params: {n_params:,}")
    print(model)
