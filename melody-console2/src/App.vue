<script setup>
import { ref } from 'vue';
import { playMelody, stopMelody } from './jPlayerPlay.js';

const apiBase = ref('/api');
const noteLength = ref(8);

const generateResult = ref(null);
const generateError = ref('');
const loadingGenerate = ref(false);
const playing = ref(false);

function buildUrl(path) {
  const base = (apiBase.value || '').trim().replace(/\/$/, '');
  return `${base}${path}`;
}

async function postJson(path, payload) {
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const textBody = await response.text();
  let data = null;
  try {
    data = textBody ? JSON.parse(textBody) : null;
  } catch (err) {
    data = null;
  }
  if (!response.ok) {
    const message = (data && data.error) || response.statusText || 'Request failed';
    throw new Error(message);
  }
  return data;
}

async function runGenerate() {
  loadingGenerate.value = true;
  generateError.value = '';
  generateResult.value = null;
  try {
    const length = Number(noteLength.value);
    const payload = {
      noteLength: Number.isFinite(length) && length > 0 ? Math.round(length) : 8,
    };
    const data = await postJson('/melody/generate', payload);
    if (data?.state === 'error') {
      throw new Error('生成失败（state: error）');
    }
    generateResult.value = data;
  } catch (err) {
    generateError.value = err.message || '无法生成';
  } finally {
    loadingGenerate.value = false;
  }
}

function sumMelodyChronaxie(melody) {
  return (melody || []).reduce((sum, note) => sum + Number(note.chronaxie || 0), 0);
}

async function play() {
  if (!generateResult.value?.melody?.length) return;
  playing.value = true;
  generateError.value = '';
  try {
    await playMelody(generateResult.value.melody);
  } catch (err) {
    generateError.value = err.message || '播放失败';
  } finally {
    playing.value = false;
  }
}

async function stop() {
  await stopMelody();
  playing.value = false;
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
        <p class="eyebrow">melody-console2</p>
        <h1>连接 melody-model2</h1>
        <p class="muted">
          输入 <code>noteLength</code>，调用生成接口并用 j-player 播放结果。
        </p>
        <div class="chip-row">
          <span class="pill">POST /melody/generate</span>
        </div>
      </div>
      <div class="api-box">
        <label>API base</label>
        <input v-model="apiBase" placeholder="/api 或 http://localhost:3001" />
        <p class="muted">默认为 /api，开发模式通过 Vite 代理到 3001 端口。</p>
      </div>
    </header>

    <section class="grid two">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">生成</p>
            <h2>POST /melody/generate</h2>
          </div>
          <button type="button" class="primary" :disabled="loadingGenerate" @click="runGenerate">
            {{ loadingGenerate ? '生成中...' : '生成' }}
          </button>
        </div>

        <p class="muted">
          第 1 步占位实现：返回固定 midi=60、chronaxie=64 的数组。
        </p>

        <div class="form-grid">
          <label>
            noteLength
            <input
              v-model.number="noteLength"
              type="number"
              min="1"
              placeholder="8"
            />
          </label>
        </div>

        <p v-if="generateError" class="error">{{ generateError }}</p>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">返回</p>
            <h2>生成结果</h2>
          </div>
          <button
            type="button"
            class="ghost"
            :disabled="!generateResult?.melody?.length || playing"
            @click="play"
          >
            {{ playing ? '播放中...' : '播放' }}
          </button>
          <button type="button" class="ghost" :disabled="!playing" @click="stop">停止</button>
          <button type="button" class="ghost" @click="generateResult = null">清空</button>
        </div>

        <div v-if="!generateResult" class="placeholder">
          <p class="muted">等待请求完成后展示 melody 与 state。</p>
        </div>
        <div v-else class="result">
          <div class="meta-row">
            <span class="pill light">state: {{ generateResult.state }}</span>
            <span class="pill light">notes: {{ generateResult.melody?.length ?? 0 }}</span>
            <span class="pill light">Σ chronaxie: {{ sumMelodyChronaxie(generateResult.melody) }}</span>
          </div>
          <div class="note-grid note-grid-head note-grid-compact">
            <span>midi</span>
            <span>chronaxie</span>
          </div>
          <div
            v-for="(note, idx) in generateResult.melody"
            :key="idx"
            class="note-grid note-grid-compact"
          >
            <span>{{ note.midi }}</span>
            <span>{{ note.chronaxie }}</span>
          </div>
          <pre class="code-block">{{ JSON.stringify(generateResult, null, 2) }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.note-grid-compact {
  grid-template-columns: 1fr 1fr;
}
</style>
