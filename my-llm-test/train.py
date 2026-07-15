"""最小训练循环：带位置编码的 TinyLM。

取数改为：每次随机截一段长度为 block_size 的窗口。
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
    corpus = (
        "你好，我是一个小型语言模型。\n"
        "学习使人进步，练习使人精通。\n"
        "User: 你好\n"
        "Assistant: 你好！很高兴认识你。\n"
        "User: 你是谁\n"
        "Assistant: 我是 TinyLM，正在学习下一个字。\n"
    )
    print("语料长度（字符）:", len(corpus))

    tok = CharTokenizer.load()
    data = torch.tensor(tok.encode(corpus), dtype=torch.long)
    print("token 数:", len(data), " vocab_size:", tok.vocab_size)

    block_size = 32
    model = TinyLM(vocab_size=tok.vocab_size, n_embd=64, block_size=block_size)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-2)

    # 语料太短时补一点，保证能切出 block_size+1
    if len(data) <= block_size:
        raise ValueError("语料太短，需要 > block_size 个 token")

    model.train()
    # 这里的窗口使用了随机， 但是其实步进也可以
    for step in range(1, 301):
        # 随机起点，取连续 block_size+1 个 token，再拆成 x / y 
        # randint生成一个(1,)的tensor，.item()转换为python的int
        i = torch.randint(0, len(data) - block_size, (1,)).item()
        chunk = data[i : i + block_size + 1]
        x = chunk[:-1].unsqueeze(0)  # (1, block_size)
        y = chunk[1:].unsqueeze(0)  # (1, block_size)

        logits = model(x)
        loss = F.cross_entropy(
            logits.view(-1, tok.vocab_size),
            y.view(-1),
        )

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()

        if step == 1 or step % 50 == 0:
            print(f"step {step:4d}  loss = {loss.item():.4f}")

    model.eval()
    prompt = "User: 你好\nAssistant:"
    ctx = torch.tensor([tok.encode(prompt)], dtype=torch.long)
    with torch.no_grad():
        for _ in range(20):
            # 生成时上下文也不能超过 block_size
            idx_cond = ctx[:, -block_size:]
            logits = model(idx_cond)[:, -1, :]
            next_id = int(torch.argmax(logits, dim=-1).item())
            ctx = torch.cat([ctx, torch.tensor([[next_id]])], dim=1)

    print("prompt :", repr(prompt))
    print("gen    :", repr(tok.decode(ctx[0].tolist())))


if __name__ == "__main__":
    main()
