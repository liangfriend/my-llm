"""TinyLM：token + position + Causal Self-Attention + lm_head。"""

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
    """因果自注意力：位置 t 只能看 0..t，不能看未来。

    先按单头理解；n_head>1 时只是把 n_embd 切开并行算几份再拼回去。
    """

    def __init__(self, n_embd: int, n_head: int, block_size: int) -> None:
        super().__init__()
        assert n_embd % n_head == 0, "n_embd 必须能被 n_head 整除"
        self.n_head = n_head
        self.n_embd = n_embd
        self.head_dim = n_embd // n_head  # 每个头的维度

        # 一次线性层同时得到 Q、K、V，输出长度是 3 * n_embd
        self.c_attn = nn.Linear(n_embd, 3 * n_embd)
        # 注意力输出后再投影回 n_embd
        self.c_proj = nn.Linear(n_embd, n_embd)

        # 下三角 mask：1 表示「可以看」，0 表示「不能看」（未来）
        # 形状 (1, 1, block_size, block_size)，后面按 T 切片
        mask = torch.tril(torch.ones(block_size, block_size))
        # 加两维兼容批量处理和多头
        self.register_buffer("mask", mask.view(1, 1, block_size, block_size))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, C)  C = n_embd
        B, T, C = x.shape

        # 1) 线性得到 QKV，再拆成三份
        qkv = self.c_attn(x)  # (B, T, 3*C)
        q, k, v = qkv.split(self.n_embd, dim=2)  # 各 (B, T, C)

        # 2) 改成多头形状: (B, n_head, T, head_dim)
        q = q.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.n_head, self.head_dim).transpose(1, 2)

        # 3) 注意力分数: QK^T / sqrt(d)
        #    (B, n_head, T, head_dim) @ (B, n_head, head_dim, T)
        #    → (B, n_head, T, T)
        # 这里用矩阵乘法加转置实现了一个 向量的点积
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.head_dim))

        # 4) 因果 mask：未来位置填 -inf，softmax 后变成 0
        att = att.masked_fill(self.mask[:, :, :T, :T] == 0, float("-inf"))
        att = F.softmax(att, dim=-1)  # 对「看谁」那一维做 softmax

        # 5) 用注意力权重对 V 加权求和 → (B, n_head, T, head_dim)
        y = att @ v

        # 6) 拼回 (B, T, C)，再投影
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        # 此时的y的向量： 字：[...语义上的v, ...语法上的v, ...,四个头]， 要经过一个全连接混在一起。但是混在一起不等于白干了。 
        # 可以想象为四个编辑分别写了一段， 隐藏层相当于主编， 经过训练后主编可以完美的组合这四个编辑的片段。
        return self.c_proj(y)


class TinyLM(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        n_embd: int = 64,
        block_size: int = 32,
        n_head: int = 4,
    ) -> None:
        super().__init__()
        self.block_size = block_size
        self.token_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(block_size, n_embd)
        # 注意力前做 LayerNorm，训练更稳
        self.ln = nn.LayerNorm(n_embd)
        self.attn = CausalSelfAttention(n_embd, n_head, block_size)
        self.lm_head = nn.Linear(n_embd, vocab_size)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        # idx: (B, T)
        T = idx.shape[-1]
        if T > self.block_size:
            raise ValueError(
                f"序列长度 T={T} 超过 block_size={self.block_size}"
            )

        pos = torch.arange(T, device=idx.device)
        x = self.token_emb(idx) + self.pos_emb(pos)  # (B, T, n_embd)

        # 残差连接：x + Attention(LayerNorm(x))
        # 位置 t 现在能「看」到前面的上下文了  +x防止自身内容丢失
        x = x + self.attn(self.ln(x))
        # 最后经过一个全连接，输入 当前词及上文信息， 输出 当前词下一个词的概率
        logits = self.lm_head(x)  # (B, T, vocab_size)
        return logits


if __name__ == "__main__":
    tok = CharTokenizer.load()
    model = TinyLM(vocab_size=tok.vocab_size, n_embd=64, block_size=32, n_head=4)
    ids = torch.tensor([tok.encode("你好")], dtype=torch.long)
    print("logits shape:", model(ids).shape)
    print(model)
