<script setup>
import { onMounted, ref } from 'vue';
import { fetchClasses, getApiBase, postDetect, postSample } from './api.js';
import DrawingCanvas from './components/DrawingCanvas.vue';
import { STAFF_LABELS } from './symbols.js';

const canvasRef = ref(null);
const className = ref('');
const classOptions = ref([]);

const detectLoading = ref(false);
const sampleLoading = ref(false);
const detectError = ref('');
const sampleError = ref('');
const detectResult = ref(null);
const sampleResult = ref(null);

onMounted(async () => {
  try {
    const classes = await fetchClasses();
    classOptions.value = classes;
    className.value = classes[0] ?? '';
  } catch {
    classOptions.value = [];
  }
});

async function runDetect() {
  detectLoading.value = true;
  detectError.value = '';
  detectResult.value = null;
  sampleResult.value = null;
  try {
    const file = await canvasRef.value.exportFile();
    detectResult.value = await postDetect(file);
  } catch (err) {
    detectError.value = err.message || '识别失败';
  } finally {
    detectLoading.value = false;
  }
}

async function runAddSample() {
  sampleLoading.value = true;
  sampleError.value = '';
  sampleResult.value = null;
  try {
    if (!className.value) {
      throw new Error('请选择符号类别');
    }
    const file = await canvasRef.value.exportFile();
    sampleResult.value = await postSample(file, className.value);
  } catch (err) {
    sampleError.value = err.message || '保存失败';
  } finally {
    sampleLoading.value = false;
  }
}

function labelZh(name) {
  const item = STAFF_LABELS.find(l => l.name === name);
  return item?.zh ?? name;
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">symbol-console</p>
        <h1>线谱符号画板</h1>
        <p class="muted">手绘符号，识别或加入训练样本。</p>
      </div>
    </header>

    <section class="panel">
      <DrawingCanvas ref="canvasRef" />
    </section>

    <section class="grid two">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">识别</p>
            <h2>POST /detect</h2>
          </div>
          <button type="button" class="primary" :disabled="detectLoading" @click="runDetect">
            {{ detectLoading ? '识别中...' : '识别' }}
          </button>
        </div>
        <p class="muted hint">{{ getApiBase() }}/detect</p>

        <p v-if="detectError" class="error">{{ detectError }}</p>

        <div v-if="detectResult" class="result">
          <div class="meta-row">
            <span class="pill light result-name">{{ labelZh(detectResult.class) }}</span>
            <span class="pill light">置信度 {{ (detectResult.confidence * 100).toFixed(2) }}%</span>
          </div>
          <pre class="code-block">{{ JSON.stringify(detectResult, null, 2) }}</pre>
        </div>
        <div v-else class="placeholder">
          <p class="muted">将当前画布发送到识别接口，查看返回结果。</p>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">样本</p>
            <h2>添加到 samples</h2>
          </div>
          <button type="button" class="primary" :disabled="sampleLoading" @click="runAddSample">
            {{ sampleLoading ? '保存中...' : '添加' }}
          </button>
        </div>

        <label class="field">
          符号类别
          <select v-model="className">
            <option v-for="name in classOptions" :key="name" :value="name">
              {{ labelZh(name) }}（{{ name }}）
            </option>
          </select>
        </label>

        <p v-if="sampleError" class="error">{{ sampleError }}</p>

        <div v-if="sampleResult" class="result">
          <pre class="code-block">{{ JSON.stringify(sampleResult, null, 2) }}</pre>
        </div>
        <div v-else class="placeholder">
          <p class="muted">将当前画布保存到 samples/ 对应类别目录。</p>
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
  margin-bottom: 12px;
}
.result-name {
  font-size: 15px;
  font-weight: 600;
}
</style>
