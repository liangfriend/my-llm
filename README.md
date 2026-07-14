# my-llm

从零实现的小型字符级 LLM，提供 **训练** 与 **对话** 接口（CLI + HTTP）。

## 快速开始

```powershell
uv sync

# 训练
uv run train --max-iters 500

# 命令行对话
uv run chat

# 启动 HTTP 服务（默认 http://127.0.0.1:8005）
uv run serve
```

## HTTP 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `POST` | `/train` | 触发训练 |
| `GET` | `/train/status` | 查询训练状态 |
| `POST` | `/chat` | 多轮对话 |
| `POST` | `/reset` | 清空会话历史 |

### 训练

```powershell
# 同步训练（等结束后返回）
curl -X POST http://127.0.0.1:8005/train -H "Content-Type: application/json" -d "{\"max_iters\": 300}"

# 后台训练
curl -X POST http://127.0.0.1:8005/train -H "Content-Type: application/json" -d "{\"max_iters\": 2000, \"async_mode\": true}"
```

### 对话

```powershell
curl -X POST http://127.0.0.1:8005/chat -H "Content-Type: application/json" -d "{\"message\": \"你好\"}"
```

返回示例：

```json
{
  "session_id": "...",
  "reply": "你好！...",
  "history": [
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！..."}
  ]
}
```

带上同一 `session_id` 即可多轮续聊；`POST /reset` 清空历史。

## Python 调用

```python
from myllm import train, get_engine

train()  # 训练并写出 checkpoints/best.pt

engine = get_engine()
print(engine.chat("你好"))
```

## 目录

```
myllm/
  model.py      # Transformer LM
  data.py       # CharTokenizer + Dataset
  train.py      # 训练
  generate.py   # 续写
  chat.py       # 多轮对话
  server.py     # FastAPI
data/raw/corpus.txt
checkpoints/    # 训练产物
```

语料默认是 `User:` / `Assistant:` 对话格式，可自行往 `data/raw/corpus.txt` 追加。
