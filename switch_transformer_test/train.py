"""训练 TinySwitchLM：看清 CE loss + MoE 负载均衡 aux loss。

观察点：
1. total_loss = ce_loss + α * aux_loss
2. 打印每层专家被选中的次数（是否一头独大）
3. 总参数多，但每个 token 只激活 1/E 的 FFN
"""

from __future__ import annotations

import sys
from pathlib import Path

import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checkpoints-test"))

from tokenizer import CharTokenizer  # noqa: E402

from switch_transformer_test.model import TinySwitchLM

CHECKPOINT_DIR = ROOT / "checkpoints-test"

# aux loss 权重（Switch 论文常用较小系数，如 0.01）
AUX_COEF = 0.01


def expert_histogram(expert_id: torch.Tensor, n_expert: int) -> list[int]:
    """统计每个专家被选了多少次。expert_id: (B, T)"""
    flat = expert_id.reshape(-1)
    counts = [int((flat == e).sum().item()) for e in range(n_expert)]
    return counts


def main() -> None:
    corpus = (
        "你好，我是一个小型语言模型。\n"
        "学习使人进步，练习使人精通。\n"
        "User: 你好\n"
        "Assistant: 你好！很高兴认识你。\n"
        "User: 你是谁\n"
        "Assistant: 我是 TinySwitchLM，用 MoE 学下一个字。\n"
        "User: MoE 是什么\n"
        "Assistant: 混合专家，每个字只进一个专家网络。\n"
    )
    print("语料长度（字符）:", len(corpus))

    tok = CharTokenizer.load()
    data = torch.tensor(tok.encode(corpus), dtype=torch.long)
    print("token 数:", len(data), " vocab_size:", tok.vocab_size)

    block_size = 32
    n_expert = 4
    model = TinySwitchLM(
        vocab_size=tok.vocab_size,
        n_embd=64,
        block_size=block_size,
        n_head=4,
        n_layer=2,
        n_expert=n_expert,
        dropout=0.1,
    )
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"params: {n_params:,}  (experts={n_expert}, top-1 激活约 1/{n_expert})")

    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3)

    if len(data) <= block_size:
        raise ValueError("语料太短，需要 > block_size 个 token")

    model.train()
    for step in range(1, 501):
        i = torch.randint(0, len(data) - block_size, (1,)).item()
        chunk = data[i : i + block_size + 1]
        x = chunk[:-1].unsqueeze(0)
        y = chunk[1:].unsqueeze(0)

        logits, aux_loss, aux_list = model(x)
        ce_loss = F.cross_entropy(
            logits.view(-1, tok.vocab_size),
            y.view(-1),
        )
        # 总损失 = 语言模型 CE + 负载均衡辅助项
        loss = ce_loss + AUX_COEF * aux_loss

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        if step == 1 or step % 50 == 0:
            hist = expert_histogram(aux_list[0]["expert_id"], n_expert)
            print(
                f"step {step:4d}  "
                f"ce={ce_loss.item():.4f}  "
                f"aux={aux_loss.item():.4f}  "
                f"total={loss.item():.4f}  "
                f"L0 experts={hist}"
            )

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    ckpt_path = CHECKPOINT_DIR / "tiny_switch_lm.pt"
    torch.save(
        {
            "model": model.state_dict(),
            "config": {
                "vocab_size": tok.vocab_size,
                "n_embd": 64,
                "block_size": block_size,
                "n_head": 4,
                "n_layer": 2,
                "n_expert": n_expert,
                "dropout": 0.1,
            },
            "tokenizer_chars": tok.chars,
        },
        ckpt_path,
    )
    print(f"saved: {ckpt_path}")

    model.eval()
    prompt = "User: 你好\nAssistant:"
    ctx = torch.tensor([tok.encode(prompt)], dtype=torch.long)
    out = model.generate(ctx, max_new_tokens=40, temperature=0.8, top_k=40)
    print("prompt :", repr(prompt))
    print("gen    :", repr(tok.decode(out[0].tolist())))


if __name__ == "__main__":
    main()
