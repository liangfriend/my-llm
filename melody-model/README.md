Melody 概率生成器
-----------------

基于 1~128 的 MIDI 音高和简单概率模型生成旋律，可接受几十个参数（风格、上下文等）作为条件。从零生成、根据歌词生成、或在已有旋律上补全，返回统一的 `{ midi, chronaxie, lyrics? }[]` 序列。

快速开始
--------

- 安装依赖：`npm install`
- 运行服务：`npm start`（默认端口 `3000`）
- 健康检查：`curl http://localhost:3000/`

数据格式
--------

- `midi`：1~128 间的整数音高，超出会自动夹紧。
- `chronaxie`：时值，正整数（默认 4，表示 1/4 音符，可按需解释）。
- `lyrics`：可选，对应该音符的歌词字符。

生成旋律（POST /melody/generate）
--------------------------------

请求体示例：

```json
{
  "text": "床前明月光",
  "seedMelody": [{ "midi": 60, "chronaxie": 4, "lyrics": "床" }],
  "length": 16,
  "params": { "style": "classical", "context": "tang-poem", "mood": "calm" }
}
```

- `text`：可选字符串，按字符对齐生成歌词旋律。
- `seedMelody`：可选部分或完整旋律，缺失的 midi/chronaxie 会用概率模型补全。
- `length`：可选目标长度，最终长度会取 `text` 长度、`seedMelody` 长度、`length`、默认值 8 的最大值。
- `params`：可选条件参数，支持任意键值（数值或字符串）；会用于加权训练样本。

无文本从零生成：

```bash
curl -X POST http://localhost:3000/melody/generate \
  -H "Content-Type: application/json" \
  -d "{\"length\":12,\"params\":{\"style\":\"pop\",\"mood\":\"bright\"}}"
```

仅从歌词生成：

```bash
curl -X POST http://localhost:3000/melody/generate \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"床前明月光\"}"
```

补全已有旋律（带歌词）：

```bash
curl -X POST http://localhost:3000/melody/generate \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"床前明月光\",\"seedMelody\":[{\"midi\":60,\"chronaxie\":4,\"lyrics\":\"床\"}]}"
```

补充已有旋律（无歌词）：

```bash
curl -X POST http://localhost:3000/melody/generate \
  -H "Content-Type: application/json" \
  -d "{\"seedMelody\":[{\"midi\":64,\"chronaxie\":2},{\"midi\":67,\"chronaxie\":2}],\"length\":8}"
```

响应示例：

```json
{
  "melody": [
    { "midi": 64, "chronaxie": 4, "lyrics": "床" },
    { "midi": 67, "chronaxie": 4, "lyrics": "前" }
  ],
  "meta": {
    "usedExamples": 3,
    "targetLength": 8,
    "paramsUsed": { "style": "classical" }
  }
}
```

新增训练样本（POST /train/example）
----------------------------------

```bash
curl -X POST http://localhost:3000/train/example \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"自定义歌词\",\"params\":{\"style\":\"folk\"},\"melody\":[{\"midi\":62,\"chronaxie\":4,\"lyrics\":\"自\"},{\"midi\":64,\"chronaxie\":4,\"lyrics\":\"定\"}]}"
```

- `melody` 为必填数组；`text`、`params` 可选。
- 服务会自动校验并夹紧 midi 到 1~128，chronaxie 到正整数。

