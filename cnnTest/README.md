## 训练

```powershell
uv run train
# 或（uv 联网失败时）
.\.venv\Scripts\train.exe
```

## 启动 HTTP 服务

默认地址：`http://127.0.0.1:8005`

```powershell
.\serve.ps1
# 或
.\.venv\Scripts\serve.exe
# 或
uv run serve
```

注意：命令是 **`serve`**，不是 `server`。

### `uv run` 报 PyPI / 代理连接错误

若出现 `Failed to fetch setuptools` 或 `tcp connect error (10061)`，说明 uv 在构建包时无法访问 PyPI（常见于代理配置问题）。可任选其一：

```powershell
# 方式 1：直接用 venv（推荐）
.\serve.ps1

# 方式 2：离线模式（依赖本地 uv 缓存）
$env:UV_OFFLINE=1; uv run serve
```

## 测试

```powershell
uv run python scripts/test_model.py
```
