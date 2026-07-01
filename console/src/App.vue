<script setup>
import { computed, ref, watch } from 'vue';
import { postMsd } from './api.js';
import DrawingCanvas from './components/DrawingCanvas.vue';
import { getLabelZh, getLabels } from './symbols.js';

const apiBase = ref('http://localhost:3001');
const notation = ref('s');
const arrText = ref('');
const file = ref(null);
const label = ref(0);
const lr = ref('0.001');

const detectLoading = ref(false);
const trainLoading = ref(false);
const detectError = ref('');
const trainError = ref('');
const detectResult = ref(null);
const trainResult = ref(null);

const labelOptions = computed(() => getLabels(notation.value));

watch(notation, () => {
  label.value = labelOptions.value[0]?.value ?? 0;
});

function onFileChange(event) {
  file.value = event.target.files?.[0] ?? null;
}

function clearFile() {
  file.value = null;
}

function onCanvasSyncArr(json) {
  arrText.value = json;
  file.value = null;
}

function onCanvasSyncFile(nextFile) {
  file.value = nextFile;
  arrText.value = '';
}

async function runDetect() {
  detectLoading.value = true;
  detectError.value = '';
  detectResult.value = null;
  try {
    detectResult.value = await postMsd(apiBase.value, 'detect', {
      notation: notation.value,
      file: file.value,
      arrText: arrText.value,
    });
  } catch (err) {
    detectError.value = err.message || '识别失败';
  } finally {
    detectLoading.value = false;
  }
}

async function runTrain() {
  trainLoading.value = true;
  trainError.value = '';
  trainResult.value = null;
  try {
    trainResult.value = await postMsd(apiBase.value, 'train', {
      notation: notation.value,
      file: file.value,
      arrText: arrText.value,
      label: label.value,
      lr: lr.value,
    });
  } catch (err) {
    trainError.value = err.message || '训练失败';
  } finally {
    trainLoading.value = false;
  }
}

function topProbs(probs, n = 5) {
  if (!probs?.length) return [];
  return probs
    .map((p, i) => ({
      index: i,
      prob: p,
      zh: getLabelZh(notation.value, i),
    }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, n);
}

function labelZh(value) {
  return getLabelZh(notation.value, value);
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">symbol-console</p>
        <h1>线谱符号 CNN 控制台</h1>
        <p class="muted">调用 <code>/msd/detect</code> 与 <code>/msd/train</code>，支持 file 或 arr 输入。</p>
        <div class="chip-row">
          <span class="pill">POST /msd/detect</span>
          <span class="pill">POST /msd/train</span>
        </div>
      </div>
      <div class="api-box">
        <label>接口前缀</label>
        <input v-model="apiBase" placeholder="http://localhost:3000" />
        <p class="muted">默认直连后端；开发时也可填 <code>/api</code> 走 Vite 代理。</p>
      </div>
    </header>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">输入</p>
          <h2>公共参数</h2>
        </div>
      </div>
      <p class="muted hint">file 与 arr 同时存在时，<strong>优先使用 arr</strong>。</p>

      <div class="form-grid">
        <label class="field">
          谱式 notation
          <select v-model="notation">
            <option value="s">s — 线谱</option>
            <option value="n">n — 简谱</option>
          </select>
        </label>
        <label class="field">
          上传 file
          <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/*" @change="onFileChange" />
        </label>
      </div>

      <div class="inline-actions">
        <button type="button" class="ghost" :disabled="!file" @click="clearFile">清空文件</button>
        <span v-if="file" class="muted">已选：{{ file.name }}</span>
      </div>

      <label class="field">
        arr（JSON 二维数组，0=背景 1=笔画）
        <textarea
          v-model="arrText"
          rows="6"
          placeholder='[[0,1,0],[1,1,1],[0,1,0]]'
        />
      </label>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">画板</p>
          <h2>手绘输入</h2>
        </div>
      </div>
      <DrawingCanvas @sync-arr="onCanvasSyncArr" @sync-file="onCanvasSyncFile" />
    </section>

    <section class="grid two">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">识别</p>
            <h2>POST /msd/detect</h2>
          </div>
          <button type="button" class="primary" :disabled="detectLoading" @click="runDetect">
            {{ detectLoading ? '识别中...' : '识别' }}
          </button>
        </div>

        <p v-if="detectError" class="error">{{ detectError }}</p>

        <div v-if="detectResult" class="result">
          <div class="meta-row">
            <span class="pill light result-name">{{ labelZh(detectResult.label) }}</span>
          </div>
          <p class="muted section-title">Top 5 概率</p>
          <div
            v-for="item in topProbs(detectResult.probs)"
            :key="item.index"
            class="prob-row"
          >
            <span class="prob-name">{{ item.zh }}</span>
            <span class="prob-bar-wrap">
              <span class="prob-bar" :style="{ width: `${item.prob * 100}%` }" />
            </span>
            <span>{{ (item.prob * 100).toFixed(2) }}%</span>
          </div>
          <pre class="code-block">{{ JSON.stringify(detectResult, null, 2) }}</pre>
        </div>
        <div v-else class="placeholder">
          <p class="muted">前向传播，返回预测类别与概率。</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">训练</p>
            <h2>POST /msd/train</h2>
          </div>
          <button type="button" class="primary" :disabled="trainLoading" @click="runTrain">
            {{ trainLoading ? '训练中...' : '训练一步' }}
          </button>
        </div>

        <div class="form-grid">
          <label class="field">
            训练符号 label
            <select v-model.number="label">
              <option v-for="opt in labelOptions" :key="opt.value" :value="opt.value">
                {{ opt.zh }}
              </option>
            </select>
          </label>
          <label class="field">
            lr（可选，默认 0.001）
            <input v-model="lr" type="number" step="0.0001" min="0.0001" max="1" />
          </label>
        </div>

        <p v-if="trainError" class="error">{{ trainError }}</p>

        <div v-if="trainResult" class="result">
          <div class="meta-row">
            <span class="pill light">预测：{{ labelZh(trainResult.label) }}</span>
            <span class="pill light">期望：{{ labelZh(trainResult.expectedLabel) }}</span>
            <span class="pill light">loss：{{ trainResult.loss?.toFixed(4) }}</span>
            <span class="pill light">{{ trainResult.weightsFile }}</span>
          </div>
          <pre class="code-block">{{ JSON.stringify(trainResult, null, 2) }}</pre>
        </div>
        <div v-else class="placeholder">
          <p class="muted">反向传播一步，更新 weights-{{ notation }}.json。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hint {
  margin-bottom: 12px;
}
.field {
  color: #0f172a;
}
.section-title {
  margin: 10px 0 6px;
  font-size: 13px;
}
.prob-row {
  display: grid;
  grid-template-columns: minmax(120px, 1.4fr) 1fr 64px;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 4px;
}
.prob-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-name {
  font-size: 15px;
  font-weight: 600;
}
.prob-bar-wrap {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.prob-bar {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #0ea5e9, #0284c7);
  border-radius: 4px;
}
</style>
