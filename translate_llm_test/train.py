"""中英翻译最小训练：重点看清 loss 不是「源第 i 字 → 目标第 i 词」。"""

from __future__ import annotations

import torch
import torch.nn.functional as F

from translate_llm_test.model import TinyTranslator
from translate_llm_test.tokenizer import TinyBilingualTokenizer

# 几条平行句对就够演示
PAIRS = [
    ("你好", "hello"),
    ("你好", "hi"),
    ("你好吗", "how are you"),
    ("我是", "I am"),
    ("我好", "I am"),
]


def explain_one_pair(tok: TinyBilingualTokenizer, src_text: str, tgt_text: str) -> None:
    """把「输入 / 标签」打印出来，对照常见误解。"""
    src = tok.encode_src(src_text)
    tgt = tok.encode_tgt(tgt_text)

    # decoder 输入：<bos> + 译文（不含最后一个之后的未来；训练时教师强制）
    tgt_in = [tok.bos_id] + tgt
    # loss 标签：译文 + <eos>  —— 与 tgt_in 等长，一一错位
    tgt_out = tgt + [tok.eos_id]

    print("=" * 60)
    print(f"句对:  {src_text!r}  →  {tgt_text!r}")
    print(f"源端 id (只进 Encoder，不算 loss 标签):")
    print(f"  {[tok.itos[i] for i in src]}  =  {src}")
    print(f"Decoder 输入 tgt_in:")
    print(f"  {[tok.itos[i] for i in tgt_in]}  =  {tgt_in}")
    print(f"Loss 标签 tgt_out（每个位置预测「下一个目标词」）:")
    print(f"  {[tok.itos[i] for i in tgt_out]}  =  {tgt_out}")
    print()
    print("逐位置监督（注意：不是 你→how）:")
    for i, (inp, lab) in enumerate(zip(tgt_in, tgt_out)):
        seen = " ".join(tok.itos[x] for x in tgt_in[: i + 1])
        print(f"  条件 = 整句源文 + [{seen}]  →  预测 {tok.itos[lab]!r}")
    print()
    print("错误对齐（我们绝对不会这样算 loss）:")
    # 故意演示错误做法，方便对照
    bad = list(zip([tok.itos[i] for i in src], [tok.itos[i] for i in tgt]))
    if len(src) == len(tgt):
        print(f"  {bad}  ← 字对词、位置对齐，语序不同就会训歪")
    else:
        print(
            f"  源长={len(src)} 目标长={len(tgt)}，根本无法位置对齐；"
            f"若硬配也会是错的"
        )
    print("=" * 60)


def main() -> None:
    tok = TinyBilingualTokenizer()
    print("词表:", tok.itos)
    print("vocab_size:", tok.vocab_size)
    print()

    # 先用一条最容易误解的句子讲清楚 loss
    explain_one_pair(tok, "你好吗", "how are you")

    model = TinyTranslator(
        vocab_size=tok.vocab_size,
        n_embd=64,
        n_head=4,
        n_layer=2,
        pad_id=tok.pad_id,
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-3)

    # 预编码所有句对
    src_list = [tok.encode_src(s) for s, _ in PAIRS]
    tgt_list = [tok.encode_tgt(t) for _, t in PAIRS]

    model.train()
    for step in range(1, 401):
        # 每次随机抽一条（batch=1，方便对照）
        i = torch.randint(0, len(PAIRS), (1,)).item()
        src = torch.tensor([src_list[i]], dtype=torch.long)
        tgt = tgt_list[i]
        tgt_in = torch.tensor([[tok.bos_id] + tgt], dtype=torch.long)
        tgt_out = torch.tensor([tgt + [tok.eos_id]], dtype=torch.long)

        logits = model(src, tgt_in)  # (1, T, V)
        # ★ 只对目标侧做 CE；pad 忽略（本 demo 单条无 pad，仍写上 ignore_index）
        loss = F.cross_entropy(
            logits.view(-1, tok.vocab_size),
            tgt_out.view(-1),
            ignore_index=tok.pad_id,
        )

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()

        if step == 1 or step % 50 == 0:
            print(f"step {step:4d}  loss = {loss.item():.4f}")

    # 试译
    model.eval()
    print("\n生成试译:")
    for src_text, ref in PAIRS:
        src = torch.tensor([tok.encode_src(src_text)], dtype=torch.long)
        out_ids = model.translate(src, tok.bos_id, tok.eos_id).tolist()
        # 去掉 eos
        if out_ids and out_ids[-1] == tok.eos_id:
            out_ids = out_ids[:-1]
        gen = " ".join(tok.itos[i] for i in out_ids)
        print(f"  {src_text!r}  →  {gen!r}   (参考 {ref!r})")


if __name__ == "__main__":
    main()
