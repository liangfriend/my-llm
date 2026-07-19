"""训练循环：多层 Block(Attn+MLP) 的 TinyLM。"""

from __future__ import annotations

import sys
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checkpoints-test"))

from tokenizer import CharTokenizer  # noqa: E402

from my_llm_test.model import TinyLM

CHECKPOINT_DIR = ROOT / "checkpoints-test"


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
    model = TinyLM(
        vocab_size=tok.vocab_size,
        n_embd=64,
        block_size=block_size,
        n_head=4,
        n_layer=4,
        dropout=0.1,
    )
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"params: {n_params:,}")

    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3)

    if len(data) <= block_size:
        raise ValueError("语料太短，需要 > block_size 个 token")

    model.train()
    for step in range(1, 501):
        i = torch.randint(0, len(data) - block_size, (1,)).item()
        chunk = data[i : i + block_size + 1]
        x = chunk[:-1].unsqueeze(0)  # (1, block_size)
        y = chunk[1:].unsqueeze(0)  # (1, block_size)

        logits = model(x) # (B, T, vocab_size)
        loss = F.cross_entropy(
            logits.view(-1, tok.vocab_size),
            y.view(-1),
        )

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        # 限制梯度不要太大，超过1的直接设置为1
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        if step == 1 or step % 50 == 0:
            print(f"step {step:4d}  loss = {loss.item():.4f}")

    # 保存 checkpoint
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    ckpt_path = CHECKPOINT_DIR / "tinylm.pt"
    torch.save(
        {
            "model": model.state_dict(),
            "config": {
                "vocab_size": tok.vocab_size,
                "n_embd": 64,
                "block_size": block_size,
                "n_head": 4,
                "n_layer": 4,
                "dropout": 0.1,
            },
            "tokenizer_chars": tok.chars,
        },
        ckpt_path,
    )
    print(f"saved: {ckpt_path}")

    # temperature + top-k 采样生成
    model.eval()
    prompt = "User: 你好\nAssistant:"
    ctx = torch.tensor([tok.encode(prompt)], dtype=torch.long)
    out = model.generate(ctx, max_new_tokens=40, temperature=0.8, top_k=40)
    print("prompt :", repr(prompt))
    print("gen    :", repr(tok.decode(out[0].tolist())))


if __name__ == "__main__":
    main()
