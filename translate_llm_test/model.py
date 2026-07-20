"""最小 Encoder–Decoder 翻译模型（理解 loss 用，不追求效果）。"""

from __future__ import annotations

import torch
import torch.nn as nn


class Encoder(nn.Module):
    """读完整句源文，输出每个源位置的表示。无因果 mask，可互相看见。"""

    def __init__(self, vocab_size: int, n_embd: int, n_head: int, n_layer: int) -> None:
        super().__init__()
        self.tok_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(64, n_embd)
        layer = nn.TransformerEncoderLayer(
            d_model=n_embd,
            nhead=n_head,
            dim_feedforward=4 * n_embd,
            batch_first=True,
            activation="gelu",
        )
        self.enc = nn.TransformerEncoder(layer, num_layers=n_layer)
        self.ln = nn.LayerNorm(n_embd)

    def forward(self, src: torch.Tensor, src_key_padding_mask: torch.Tensor) -> torch.Tensor:
        # src: (B, S)
        S = src.shape[1]
        pos = torch.arange(S, device=src.device)
        x = self.tok_emb(src) + self.pos_emb(pos)
        # src_key_padding_mask: True 表示 pad，要忽略
        x = self.enc(x, src_key_padding_mask=src_key_padding_mask)
        return self.ln(x)


class Decoder(nn.Module):
    """自回归写译文：因果自注意力 + 看 encoder 的交叉注意力。"""

    def __init__(self, vocab_size: int, n_embd: int, n_head: int, n_layer: int) -> None:
        super().__init__()
        self.tok_emb = nn.Embedding(vocab_size, n_embd)
        self.pos_emb = nn.Embedding(64, n_embd)
        layer = nn.TransformerDecoderLayer(
            d_model=n_embd,
            nhead=n_head,
            dim_feedforward=4 * n_embd,
            batch_first=True,
            activation="gelu",
        )
        self.dec = nn.TransformerDecoder(layer, num_layers=n_layer)
        self.ln = nn.LayerNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size, bias=False)

    def forward(
        self,
        tgt: torch.Tensor,
        memory: torch.Tensor,
        tgt_key_padding_mask: torch.Tensor,
        memory_key_padding_mask: torch.Tensor,
    ) -> torch.Tensor:
        # tgt: (B, T)  —— decoder 输入，已含 <bos>，不含最后一个要预测的位置之外的未来
        T = tgt.shape[1]
        pos = torch.arange(T, device=tgt.device)
        x = self.tok_emb(tgt) + self.pos_emb(pos)
        # True = 屏蔽；上三角挡住未来位置，使 t 只能看 0..t
        causal = torch.triu(
            torch.ones(T, T, device=tgt.device, dtype=torch.bool),
            diagonal=1,
        )
        x = self.dec(
            x,
            memory,
            tgt_mask=causal,
            tgt_key_padding_mask=tgt_key_padding_mask,
            memory_key_padding_mask=memory_key_padding_mask,
        )
        return self.lm_head(self.ln(x))


class TinyTranslator(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        n_embd: int = 64,
        n_head: int = 4,
        n_layer: int = 2,
        pad_id: int = 0,
    ) -> None:
        super().__init__()
        self.pad_id = pad_id
        self.encoder = Encoder(vocab_size, n_embd, n_head, n_layer)
        self.decoder = Decoder(vocab_size, n_embd, n_head, n_layer)

    def forward(self, src: torch.Tensor, tgt_in: torch.Tensor) -> torch.Tensor:
        src_pad = src == self.pad_id
        tgt_pad = tgt_in == self.pad_id
        memory = self.encoder(src, src_key_padding_mask=src_pad)
        logits = self.decoder(
            tgt_in,
            memory,
            tgt_key_padding_mask=tgt_pad,
            memory_key_padding_mask=src_pad,
        )
        return logits

    @torch.no_grad()
    def translate(
        self,
        src: torch.Tensor,
        bos_id: int,
        eos_id: int,
        max_new_tokens: int = 8,
    ) -> torch.Tensor:
        """贪心解码：src (1, S) → 生成的目标 id（含 eos，不含 bos）。"""
        self.eval()
        src_pad = src == self.pad_id
        memory = self.encoder(src, src_key_padding_mask=src_pad)
        ys = torch.tensor([[bos_id]], dtype=torch.long, device=src.device)
        for _ in range(max_new_tokens):
            tgt_pad = ys == self.pad_id
            logits = self.decoder(
                ys,
                memory,
                tgt_key_padding_mask=tgt_pad,
                memory_key_padding_mask=src_pad,
            )
            next_id = int(torch.argmax(logits[:, -1, :], dim=-1).item())
            ys = torch.cat(
                [ys, torch.tensor([[next_id]], device=src.device)],
                dim=1,
            )
            if next_id == eos_id:
                break
        return ys[0, 1:]  # 去掉 bos
