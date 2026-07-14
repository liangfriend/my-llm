"""对话接口：多轮历史 + 续写。

CLI:  uv run chat
API:  POST /chat
"""

from __future__ import annotations

import argparse
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from myllm.config import CHECKPOINT_DIR, ChatConfig
from myllm.generate import LoadedModel, generate_text, load_checkpoint


def format_prompt(history: list[dict[str, str]], user_message: str) -> str:
    """把多轮对话拼成训练语料同款格式。"""
    parts: list[str] = []
    for turn in history:
        role = turn["role"]
        content = turn["content"]
        if role == "user":
            parts.append(f"User: {content}")
        else:
            parts.append(f"Assistant: {content}")
    parts.append(f"User: {user_message}")
    parts.append("Assistant:")
    return "\n".join(parts)


def extract_reply(full_text: str, prompt: str) -> str:
    """从完整生成结果中截取 Assistant 回复（到下一个 User: 为止）。"""
    reply = full_text[len(prompt) :] if full_text.startswith(prompt) else full_text
    for stop in ("\nUser:", "\nuser:"):
        if stop in reply:
            reply = reply.split(stop, 1)[0]
    return reply.strip()


@dataclass
class ChatSession:
    session_id: str
    history: list[dict[str, str]] = field(default_factory=list)

    def clear(self) -> None:
        self.history.clear()


class ChatEngine:
    """可复用的对话引擎（CLI / HTTP 共用）。"""

    def __init__(
        self,
        checkpoint: Path | None = None,
        device: str = "auto",
        max_new_tokens: int = 120,
        temperature: float = 0.8,
        top_k: int | None = 40,
    ) -> None:
        self.loaded: LoadedModel = load_checkpoint(checkpoint, device=device)
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.top_k = top_k
        self.sessions: dict[str, ChatSession] = {}

    def get_or_create(self, session_id: str | None = None) -> ChatSession:
        sid = session_id or str(uuid.uuid4())
        if sid not in self.sessions:
            self.sessions[sid] = ChatSession(session_id=sid)
        return self.sessions[sid]

    def chat(
        self,
        message: str,
        session_id: str | None = None,
        *,
        max_new_tokens: int | None = None,
        temperature: float | None = None,
        top_k: int | None = None,
    ) -> dict:
        session = self.get_or_create(session_id)
        prompt = format_prompt(session.history, message)
        full = generate_text(
            prompt,
            loaded=self.loaded,
            max_new_tokens=max_new_tokens or self.max_new_tokens,
            temperature=temperature if temperature is not None else self.temperature,
            top_k=top_k if top_k is not None else self.top_k,
        )
        reply = extract_reply(full, prompt)
        session.history.append({"role": "user", "content": message})
        session.history.append({"role": "assistant", "content": reply})
        return {
            "session_id": session.session_id,
            "reply": reply,
            "history": list(session.history),
        }

    def reset(self, session_id: str) -> None:
        if session_id in self.sessions:
            self.sessions[session_id].clear()


_engine: ChatEngine | None = None


def get_engine(
    checkpoint: Path | None = None,
    device: str = "auto",
    reload: bool = False,
) -> ChatEngine:
    global _engine
    if _engine is None or reload:
        cfg = ChatConfig()
        _engine = ChatEngine(
            checkpoint=checkpoint or cfg.checkpoint,
            device=device or cfg.device,
            max_new_tokens=cfg.max_new_tokens,
            temperature=cfg.temperature,
            top_k=cfg.top_k,
        )
    return _engine


def interactive_chat(checkpoint: Path, device: str) -> None:
    print(f"加载 {checkpoint} …")
    engine = get_engine(checkpoint=checkpoint, device=device, reload=True)
    session = engine.get_or_create()
    print(f"对话已开始 (session={session.session_id})。输入 /reset 清空，/quit 退出。\n")
    while True:
        try:
            msg = input("You> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not msg:
            continue
        if msg in {"/quit", "/exit", "quit", "exit"}:
            break
        if msg == "/reset":
            engine.reset(session.session_id)
            print("(历史已清空)\n")
            continue
        result = engine.chat(msg, session_id=session.session_id)
        print(f"Bot> {result['reply']}\n")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Interactive chat with the LLM")
    p.add_argument("--checkpoint", type=Path, default=CHECKPOINT_DIR / "best.pt")
    p.add_argument("--device", type=str, default="auto")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    interactive_chat(args.checkpoint, args.device)


if __name__ == "__main__":
    main()
