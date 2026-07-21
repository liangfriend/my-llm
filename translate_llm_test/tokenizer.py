"""极小双语词表：几个汉字 + 几个英文词，整词当一个 token。"""

from __future__ import annotations


class TinyBilingualTokenizer:
    """固定小词表，方便盯着 id 看 loss。"""

    SPECIAL = ["<pad>", "<bos>", "<eos>"]
    # 汉字按字；英文按词（不是字母）
    CHARS = ["你", "好", "吗", "我", "是"]
    WORDS = ["hello", "hi", "how", "are", "you", "I", "am"]

    def __init__(self) -> None:
        self.itos = self.SPECIAL + self.CHARS + self.WORDS
        self.stoi = {t: i for i, t in enumerate(self.itos)}
        # 用于补齐不同长度的句子，本身没语义
        self.pad_id = self.stoi["<pad>"]
        # 用于表示句子的开始，输入的第一个词是bos
        self.bos_id = self.stoi["<bos>"]
        # 用于表示句子的结束，模型遇到它就停止生成
        self.eos_id = self.stoi["<eos>"]

    @property
    def vocab_size(self) -> int:
        return len(self.itos)

    def encode_src(self, text: str) -> list[int]:
        """源语言：按字切。'你好吗' → [你, 好, 吗]"""
        ids: list[int] = []
        for ch in text:
            if ch not in self.stoi:
                raise KeyError(f"源端未知字: {ch!r}")
            ids.append(self.stoi[ch])
        return ids

    def encode_tgt(self, text: str) -> list[int]:
        """目标语言：按空格切词。'how are you' → [how, are, you]"""
        ids: list[int] = []
        for w in text.split():
            if w not in self.stoi:
                raise KeyError(f"目标端未知词: {w!r}")
            ids.append(self.stoi[w])
        return ids

    def decode(self, ids: list[int]) -> str:
        toks = [self.itos[i] for i in ids if i != self.pad_id]
        # 汉字直接拼，英文词用空格
        out: list[str] = []
        for t in toks:
            if t in self.SPECIAL:
                out.append(t)
            elif t in self.CHARS:
                if out and out[-1] not in self.SPECIAL and out[-1] in self.CHARS:
                    out[-1] = out[-1] + t
                else:
                    out.append(t)
            else:
                out.append(t)
        return " ".join(out)
