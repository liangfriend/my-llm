# symbol-console

线谱符号 CNN 前端控制台。

## 快速开始

```bash
npm install
npm run dev
```

默认接口前缀：`http://localhost:3000`（页面顶部可修改）。

开发时也可填 `/api`，通过 Vite 代理到 3000 端口。

## 功能

- **POST /msd/detect** — 符号识别（前向传播）
- **POST /msd/train** — 训练一步（反向传播，更新 `weights-s.json` / `weights-n.json`）

公共输入：`notation`（s/n）、`file` 或 `arr`（同时存在优先 arr）。

训练额外参数：`label`（类别索引）、`lr`（可选）。
