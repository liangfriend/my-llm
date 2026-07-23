"""TinySwitchLM：把稠密 MLP 换成 Switch MoE（Top-1 路由）。

对照普通 Transformer：
  Block = Attn + MLP          ← 每个 token 都过同一套 FFN
  Block = Attn + SwitchFFN    ← 每个 token 只进 1 个 Expert

核心概念：
1. Expert：就是一个普通小 FFN（和原来的 MLP 同类）
2. Router：给每个 token 打出「选哪个专家」的分数
3. Top-1（Switch 论文）：每个 token 只走分数最高的那个专家
4. 负载均衡 aux loss：防止所有 token 都挤进同一个专家

参数多、算力省：总参数 ≈ E × expert_size，但每个 token 只激活 1 个专家。
"""

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
    """因果自注意力（与 my_llm_test 同思路，便于对照）。"""

    def __init__(
        self,
        n_embd: int,
        n_head: int,
        block_size: int,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        assert n_embd % n_head == 0
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


class Expert(nn.Module):
    """单个专家 = 一个位置级 FFN（和稠密 MLP 结构相同）。"""

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


class SwitchFFN(nn.Module):
    """Switch MoE：Router Top-1 + 多个 Expert。

    前向大致步骤：
      x (B,T,C)
        → router logits (B,T,E)
        → softmax 得到 probs
        → 每个 token 选 argmax 专家 + 对应 gate 权重
        → 只把该 token 喂给选中的专家
        → 输出 = gate * expert(x)

    为了好读，这里按「专家循环」实现（教学友好，非生产最优）。
    """

    def __init__(
        self,
        n_embd: int,
        n_expert: int = 4,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        assert n_expert >= 2
        self.n_expert = n_expert
        # Router：把 token 向量映射成 E 个专家分数
        self.router = nn.Linear(n_embd, n_expert, bias=False)
        self.experts = nn.ModuleList(
            [Expert(n_embd, dropout) for _ in range(n_expert)]
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
        B, T, C = x.shape
        flat = x.reshape(B * T, C)  # (N, C)，N = B*T

        # 1) 路由分数 → 概率
        logits = self.router(flat)  # (N, E)
        probs = F.softmax(logits, dim=-1)  # (N, E)

        # 2) Top-1：每个 token 只进一个专家
        gate, expert_id = probs.max(dim=-1)  # (N,), (N,)

        # 3) 分发到各专家（教学版：循环；生产会用 gather/scatter 向量化）
        out = torch.zeros_like(flat)
        for e in range(self.n_expert):
            mask = expert_id == e
            if not mask.any():
                continue
            # 只计算被选中的 token；未选中的专家这次不算 FFN
            expert_out = self.experts[e](flat[mask])
            out[mask] = gate[mask].unsqueeze(-1) * expert_out

        # 4) 负载均衡统计（给 aux loss / 打印用）
        #    importance: 路由概率在 batch 上的均值（希望均匀）
        #    load:       实际被选中的频率（希望均匀）
        importance = probs.mean(dim=0)  # (E,)
        load = F.one_hot(expert_id, self.n_expert).float().mean(dim=0)  # (E,)

        aux = {
            "importance": importance,
            "load": load,
            "expert_id": expert_id.view(B, T),
            "probs": probs.view(B, T, self.n_expert),
        }
        return out.view(B, T, C), aux


def switch_load_balancing_loss(
    importance: torch.Tensor,
    load: torch.Tensor,
) -> torch.Tensor:
    """Switch 论文里的辅助损失：鼓励专家被均匀使用。

    loss = E * sum_i (importance_i * load_i)
    两者都均匀（各 1/E）时最小。
    """
    n_expert = importance.numel()
    return n_expert * (importance * load).sum()


class Block(nn.Module):
    """一层：Attn + SwitchFFN（MoE 替换了原来的稠密 MLP）。"""

    def __init__(
        self,
        n_embd: int,
        n_head: int,
        block_size: int,
        n_expert: int = 4,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        self.ln1 = nn.LayerNorm(n_embd)
        self.attn = CausalSelfAttention(n_embd, n_head, block_size, dropout)
        self.ln2 = nn.LayerNorm(n_embd)
        self.ffn = SwitchFFN(n_embd, n_expert=n_expert, dropout=dropout)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, dict[str, torch.Tensor]]:
        x = x + self.attn(self.ln1(x))
        ffn_out, aux = self.ffn(self.ln2(x))
        x = x + ffn_out
        return x, aux


class TinySwitchLM(nn.Module):
    """教学用 Switch Transformer：Embedding + N × (Attn+MoE) + lm_head。"""

    def __init__(
        self,
        vocab_size: int,
        n_embd: int = 64,
        block_size: int = 32,
        n_head: int = 4,
        n_layer: int = 2,
        n_expert: int = 4,
        dropout: float = 0.0,
    ) -> None:
        super().__init__()
        self.block_size = block_size
        self.n_expert = n_expert
        self.token_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(block_size, n_embd)
        self.drop = nn.Dropout(dropout)
        self.blocks = nn.ModuleList(
            [
                Block(n_embd, n_head, block_size, n_expert, dropout)
                for _ in range(n_layer)
            ]
        )
        self.ln_f = nn.LayerNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size, bias=False)
        self.lm_head.weight = self.token_emb.weight

    def forward(
        self,
        idx: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor, list[dict[str, torch.Tensor]]]:
        """返回 logits、aux_loss、每层路由信息。"""
        T = idx.shape[-1]
        if T > self.block_size:
            raise ValueError(f"序列长度 T={T} 超过 block_size={self.block_size}")

        pos = torch.arange(T, device=idx.device)
        x = self.drop(self.token_emb(idx) + self.pos_emb(pos))

        aux_list: list[dict[str, torch.Tensor]] = []
        aux_losses: list[torch.Tensor] = []
        for block in self.blocks:
            x, aux = block(x)
            aux_list.append(aux)
            aux_losses.append(
                switch_load_balancing_loss(aux["importance"], aux["load"])
            )

        logits = self.lm_head(self.ln_f(x))
        aux_loss = torch.stack(aux_losses).mean()
        return logits, aux_loss, aux_list

    @torch.no_grad()
    def generate(
        self,
        idx: torch.Tensor,
        max_new_tokens: int,
        temperature: float = 1.0,
        top_k: int | None = None,
    ) -> torch.Tensor:
        for _ in range(max_new_tokens):
            idx_cond = idx[:, -self.block_size :]
            logits, _, _ = self(idx_cond)
            logits = logits[:, -1, :] / max(temperature, 1e-8)
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = float("-inf")
            probs = F.softmax(logits, dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            idx = torch.cat([idx, next_id], dim=1)
        return idx


if __name__ == "__main__":
    tok = CharTokenizer.load()
    model = TinySwitchLM(
        vocab_size=tok.vocab_size,
        n_embd=64,
        block_size=32,
        n_head=4,
        n_layer=2,
        n_expert=4,
    )
    ids = torch.tensor([tok.encode("你好")], dtype=torch.long)
    logits, aux_loss, aux_list = model(ids)
    print("logits shape:", tuple(logits.shape))
    print("aux_loss:", float(aux_loss))
    print("layer0 expert_id:", aux_list[0]["expert_id"][0].tolist())
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"params: {n_params:,}")
