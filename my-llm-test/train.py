"""最小训练循环：让 TinyLM 学「下一个字符」。

五步：
1. 准备一小段语料
2. encode 成一长串 id
3. x = ids[:-1]，y = ids[1:]
4. forward + cross_entropy
5. backward + optimizer.step，看 loss 下降
"""

from __future__ import annotations

import sys
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checkpoints-test"))

from tokenizer import CharTokenizer  # noqa: E402

from model import TinyLM


def main() -> None:
    # ---------- 1) 准备一小段语料 ----------
    corpus = (
        "你好，我是一个小型语言模型。\n"
        "学习使人进步，练习使人精通。\n"
        "User: 你好\n"
        "Assistant: 你好！很高兴认识你。\n"
        "User: 你是谁\n"
        "Assistant: 我是 TinyLM，正在学习下一个字。\n"
    )
    print("语料长度（字符）:", len(corpus))

    # ---------- 2) encode 成一长串 id ----------
    tok = CharTokenizer.load()
    ids = torch.tensor(tok.encode(corpus), dtype=torch.long)
    print("token 数:", len(ids), " vocab_size:", tok.vocab_size)

    # ---------- 3) 输入 x / 目标 y（右移一位）----------
    # 例如 ids = [a, b, c, d]
    #      x   = [a, b, c]
    #      y   = [b, c, d]   ← 每个位置预测「下一个」
    # 这里加一维度，是为了方便批量处理，batch_size = 1。虽然这个例子只有 1 个样本，但这个技巧很常用。
    x = ids[:-1].unsqueeze(0)  # (1, T)
    y = ids[1:].unsqueeze(0)  # (1, T)
    print("x shape:", tuple(x.shape), " y shape:", tuple(y.shape))

    # ---------- 4) 模型 + loss ----------
    model = TinyLM(vocab_size=tok.vocab_size, n_embd=64)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-2)

    # ---------- 5) 训练若干步，观察 loss ----------
    model.train()
    for step in range(1, 301):
        logits = model(x)  # (1, T, vocab)
        loss = F.cross_entropy(
            logits.view(-1, tok.vocab_size),
            y.view(-1),
        )

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()

        if step == 1 or step % 50 == 0:
            print(f"step {step:4d}  loss = {loss.item():.4f}")

    # 简单看一眼：给一个开头，贪心续写几个字
    model.eval()
    prompt = "User: 你好\nAssistant:"
    ctx = torch.tensor([tok.encode(prompt)], dtype=torch.long)
    with torch.no_grad():
        for _ in range(20):
            logits = model(ctx)[:, -1, :]  # 最后一个位置的分布
            next_id = int(torch.argmax(logits, dim=-1).item())
            ctx = torch.cat([ctx, torch.tensor([[next_id]])], dim=1)

    print("prompt :", repr(prompt))
    print("gen    :", repr(tok.decode(ctx[0].tolist())))


if __name__ == "__main__":
    main()
