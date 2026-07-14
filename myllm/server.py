"""HTTP 接口：训练 + 对话。

默认地址：http://127.0.0.1:8005

  POST /train   触发训练
  POST /chat    多轮对话
  POST /reset   清空会话
  GET  /health  健康检查
"""

from __future__ import annotations

import argparse
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from myllm.config import CHECKPOINT_DIR, ModelConfig, TrainConfig
from myllm.chat import get_engine
from myllm.train import train

app = FastAPI(title="myllm", version="0.1.0")

_train_lock = threading.Lock()
_train_state: dict[str, Any] = {"running": False, "result": None, "error": None}


class TrainRequest(BaseModel):
    max_iters: int | None = None
    batch_size: int | None = None
    learning_rate: float | None = None
    device: str | None = None
    corpus: str | None = None
    n_layer: int | None = None
    n_embd: int | None = None
    block_size: int | None = None
    async_mode: bool = Field(
        default=False,
        description="true 时后台训练并立即返回；false 时同步等待结束",
    )


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    max_new_tokens: int | None = None
    temperature: float | None = None
    top_k: int | None = None
    device: str = "auto"
    checkpoint: str | None = None


class ResetRequest(BaseModel):
    session_id: str


def _run_train(req: TrainRequest) -> dict[str, Any]:
    model_cfg = ModelConfig()
    train_cfg = TrainConfig()
    if req.n_layer is not None:
        model_cfg.n_layer = req.n_layer
    if req.n_embd is not None:
        model_cfg.n_embd = req.n_embd
    if req.block_size is not None:
        model_cfg.block_size = req.block_size
    if req.max_iters is not None:
        train_cfg.max_iters = req.max_iters
    if req.batch_size is not None:
        train_cfg.batch_size = req.batch_size
    if req.learning_rate is not None:
        train_cfg.learning_rate = req.learning_rate
    if req.device is not None:
        train_cfg.device = req.device
    if req.corpus is not None:
        train_cfg.corpus_path = Path(req.corpus)

    try:
        result = train(model_cfg, train_cfg)
        _train_state["result"] = result
        _train_state["error"] = None
        # 训练结束后强制重载对话引擎
        get_engine(checkpoint=CHECKPOINT_DIR / "best.pt", reload=True)
        return result
    except Exception as e:
        _train_state["error"] = str(e)
        raise
    finally:
        _train_state["running"] = False


@app.get("/health")
def health() -> dict[str, Any]:
    best = CHECKPOINT_DIR / "best.pt"
    return {
        "ok": True,
        "checkpoint_exists": best.exists(),
        "train_running": _train_state["running"],
    }


@app.get("/train/status")
def train_status() -> dict[str, Any]:
    return {
        "running": _train_state["running"],
        "result": _train_state["result"],
        "error": _train_state["error"],
    }


@app.post("/train")
def train_endpoint(req: TrainRequest) -> dict[str, Any]:
    if not _train_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="已有训练任务在进行")

    _train_state["running"] = True
    _train_state["result"] = None
    _train_state["error"] = None

    if req.async_mode:
        def _job() -> None:
            try:
                _run_train(req)
            except Exception:
                pass
            finally:
                _train_lock.release()

        threading.Thread(target=_job, daemon=True).start()
        return {"status": "started", "async": True}

    try:
        result = _run_train(req)
        return {"status": "finished", "async": False, **result}
    finally:
        _train_lock.release()


@app.post("/chat")
def chat_endpoint(req: ChatRequest) -> dict[str, Any]:
    ckpt = Path(req.checkpoint) if req.checkpoint else CHECKPOINT_DIR / "best.pt"
    if not ckpt.exists():
        raise HTTPException(
            status_code=404,
            detail=f"找不到模型 {ckpt}，请先 POST /train 或 uv run train",
        )
    try:
        engine = get_engine(checkpoint=ckpt, device=req.device)
        return engine.chat(
            req.message,
            session_id=req.session_id,
            max_new_tokens=req.max_new_tokens,
            temperature=req.temperature,
            top_k=req.top_k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/reset")
def reset_endpoint(req: ResetRequest) -> dict[str, str]:
    try:
        engine = get_engine()
        engine.reset(req.session_id)
        return {"status": "ok", "session_id": req.session_id}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve myllm HTTP API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8005)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run("myllm.server:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
