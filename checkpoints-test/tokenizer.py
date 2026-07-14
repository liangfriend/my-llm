"""字符级 Tokenizer：加载词表，做 encode / decode。"""

from __future__ import annotations

import json
from pathlib import Path


DEFAULT_PATH = Path(__file__).resolve().parent / "tokenizer.json"


class CharTokenizer:
    def __init__(self, chars: str) -> None:
        if not chars:
            raise ValueError("词表 chars 不能为空")
        # 稳定去重，防止手工改 json 时混入重复字
        seen: set[str] = set()
        ordered: list[str] = []
        for ch in chars:
            if ch not in seen:
                seen.add(ch)
                ordered.append(ch)
        self.chars = "".join(ordered)
        self.stoi = {ch: i for i, ch in enumerate(self.chars)}
        self.itos = {i: ch for i, ch in enumerate(self.chars)}
        # 未知字符：优先用 '?'，否则退回 id 0
        self.unk_id = self.stoi.get("?", 0)

    @classmethod
    def load(cls, path: str | Path | None = None) -> CharTokenizer:
        path = Path(path) if path is not None else DEFAULT_PATH
        data = json.loads(path.read_text(encoding="utf-8"))
        if "chars" not in data:
            raise KeyError(f"{path} 里缺少 'chars' 字段")
        return cls(data["chars"])

    def save(self, path: str | Path | None = None) -> None:
        path = Path(path) if path is not None else DEFAULT_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"chars": self.chars}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    @property
    def vocab_size(self) -> int:
        return len(self.chars)

    def encode(self, text: str) -> list[int]:
        return [self.stoi.get(ch, self.unk_id) for ch in text]

    def decode(self, ids: list[int]) -> str:
        return "".join(self.itos.get(i, "?") for i in ids)


if __name__ == "__main__":
    tok = CharTokenizer.load()
    print("vocab_size =", tok.vocab_size)
    # 注意：词表里是英文逗号 `,` 和顿号 `、`，没有全角 `，`
    sample = "你好、世界!"
    ids = tok.encode(sample)
    print("encode:", ids)
    print("decode:", tok.decode(ids))
    assert tok.decode(ids) == sample
    # 词表外字符会变成 ?
    print("unk demo:", tok.decode(tok.encode("你好，世界")))
    print("ok")
