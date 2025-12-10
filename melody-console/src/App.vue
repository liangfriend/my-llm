<script setup>
import { ref } from 'vue';
import MelodyEditor from './components/MelodyEditor.vue';
import ParamEditor from './components/ParamEditor.vue';
import {playerManager} from "@jsh/note-player";
import {InstrumentEnum} from "@jsh/note-player/enum";
import {melodyToToneSeq} from "./utils.js";

const apiBase = ref('/api');

const text = ref('');
const length = ref(8);
const totalChronaxieNumber = ref(null);
const seedMelody = ref([{ midi: 60, chronaxie: 4, lyrics: '' }]);
const params = ref([
  { key: 'style', value: 'classical' },
  { key: 'mood', value: 'calm' },
]);

const generateResult = ref(null);
const generateError = ref('');
const loadingGenerate = ref(false);

const trainText = ref('');
const trainMelody = ref([{ midi: 62, chronaxie: 4, lyrics: '' }]);
const trainParams = ref([{ key: 'style', value: 'folk' }]);
const trainError = ref('');
const trainMessage = ref('');
const loadingTrain = ref(false);

function buildUrl(path) {
  const base = (apiBase.value || '').trim().replace(/\/$/, '');
  return `${base}${path}`;
}

function normalizeMelody(list) {
  return (list || [])
    .map(note => {
      const midiRaw = Number(note.midi);
      const midi =
        note.midi === '' || note.midi === undefined || note.midi === null || !Number.isFinite(midiRaw)
          ? undefined
          : midiRaw;
      const chronaxieRaw = Number(note.chronaxie);
      const chronaxie =
        note.chronaxie === '' ||
        note.chronaxie === undefined ||
        note.chronaxie === null ||
        !Number.isFinite(chronaxieRaw)
          ? undefined
          : chronaxieRaw;
      const lyrics = note.lyrics === '' || note.lyrics === undefined ? undefined : note.lyrics;
      return { midi, chronaxie, lyrics };
    })
    .filter(
      n =>
        n.midi !== undefined ||
        n.chronaxie !== undefined ||
        (n.lyrics !== undefined && n.lyrics !== ''),
    );
}

function paramsToObject(list) {
  const out = {};
  (list || []).forEach(row => {
    const key = (row.key || '').trim();
    const rawValue = row.value;
    if (!key || rawValue === '' || rawValue === undefined) return;
    const num = Number(rawValue);
    out[key] = Number.isFinite(num) && `${num}` === `${rawValue}` ? num : rawValue;
  });
  return out;
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
  try {
    const payload = {};
    const paramsObj = paramsToObject(params.value);
    const notes = normalizeMelody(seedMelody.value);
    if (text.value.trim()) payload.text = text.value;
    if (notes.length) payload.seedMelody = notes;
    if (Number(length.value) > 0) payload.length = Number(length.value);
    const totalChronaxie = Number(totalChronaxieNumber.value);
    if (Number.isFinite(totalChronaxie) && totalChronaxie > 0) {
      payload.totalChronaxieNumber = totalChronaxie;
      payload.totalChronaxie = totalChronaxie;
    }
    if (Object.keys(paramsObj).length) payload.params = paramsObj;
    generateResult.value = await postJson('/melody/generate', payload);
  } catch (err) {
    generateError.value = err.message || '无法生成';
  } finally {
    loadingGenerate.value = false;
  }
}

function applyLyricsToSeed() {
  const chars = Array.from(text.value || '');
  if (!chars.length) return;
  const next = [...seedMelody.value];
  chars.forEach((char, idx) => {
    const existing = next[idx] || { midi: '', chronaxie: '', lyrics: '' };
    next[idx] = { ...existing, lyrics: char };
  });
  seedMelody.value = next;
}

function copySeedToTraining() {
  trainMelody.value = seedMelody.value.map(note => ({ ...note }));
  trainText.value = text.value;
  trainParams.value = params.value.map(row => ({ ...row }));
}

async function sendTraining() {
  loadingTrain.value = true;
  trainError.value = '';
  trainMessage.value = '';
  try {
    const melody = normalizeMelody(trainMelody.value);
    if (!melody.length) {
      throw new Error('训练数据至少包含一条 note');
    }
    const paramsObj = paramsToObject(trainParams.value);
    const payload = {
      melody,
    };
    if (trainText.value.trim()) payload.text = trainText.value;
    if (Object.keys(paramsObj).length) payload.params = paramsObj;
    const data = await postJson('/train/example', payload);
    trainMessage.value = data?.message || '训练样本已提交';
  } catch (err) {
    trainError.value = err.message || '提交失败';
  } finally {
    loadingTrain.value = false;
  }
}
const generateApiVisible = ref(true)
function switchGenerateApiVisible() {
    generateApiVisible.value = !generateApiVisible.value
}


function play(mdelody) {
    const seq = melodyToToneSeq(mdelody);
    const toneSeq = playerManager.generateToneSequence(seq)
    const player = playerManager.add('test', toneSeq, {
        instrument: InstrumentEnum.acoustic_grand_piano,
    })
    playerManager.play()
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <div>
          <p class="eyebrow">melody-console</p>

        <h1>连接 melody-model</h1>
        <p class="muted">
          编辑 <code>{ midi, chronaxie, lyrics }</code>[]，一键调用生成与训练接口。
        </p>
        <div class="chip-row">
          <span class="pill">POST /melody/generate</span>
          <span class="pill">POST /train/example</span>
            <button @click="switchGenerateApiVisible">{{ generateApiVisible?'隐藏生成接口':'显示生成接口' }}</button>
        </div>
      </div>
      <div class="api-box">
        <label>API base</label>
        <input v-model="apiBase" placeholder="/api 或 http://localhost:3000" />
        <p class="muted">默认为 /api，开发模式通过 Vite 代理到 3000 端口。</p>
      </div>
    </header>

    <section class="grid two" v-show="generateApiVisible">
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

        <div class="form-grid three-cols">
          <label>
            Lyrics / 文本（可选）
            <textarea
              v-model="text"
              rows="3"
              placeholder="填写歌词文本或留空"
            ></textarea>
          </label>
          <label>
            目标长度（可选）
            <input v-model.number="length" type="number" min="1" placeholder="8" />
          </label>
          <label>
            totalChronaxieNumber (optional)
            <input
              v-model.number="totalChronaxieNumber"
              type="number"
              min="1"
              placeholder="64"
            />
          </label>
        </div>

        <ParamEditor
          v-model="params"
          title="条件参数 params（可选）"
          hint="键值对将转成对象，数字会自动转 number。"
        />

        <MelodyEditor
          v-model="seedMelody"
          title="Seed melody（可选）"
          hint="可填部分或完整旋律，缺失字段由模型自动补足。"
        />

        <div class="inline-actions">
          <button type="button" class="ghost" @click="applyLyricsToSeed">用文本填充歌词</button>
          <button type="button" class="ghost" @click="copySeedToTraining">复制到训练区</button>
        </div>

        <p v-if="generateError" class="error">{{ generateError }}</p>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">返回</p>
            <h2>生成结果</h2>
          </div>
            <button type="button" class="ghost" @click="play(generateResult.melody)">播放</button>
            <button type="button" class="ghost" @click="generateResult = null">清空</button>
        </div>

        <div v-if="!generateResult" class="placeholder">
          <p class="muted">等待请求完成后展示 melody 和 meta。</p>
        </div>
        <div v-else class="result">
          <div class="meta-row">
            <span class="pill light">usedExamples: {{ generateResult.meta?.usedExamples }}</span>
            <span class="pill light">targetLength: {{ generateResult.meta?.targetLength }}</span>
          </div>
          <div class="note-grid note-grid-head">
            <span>midi</span>
            <span>chronaxie</span>
            <span>lyrics</span>
          </div>
          <div
            v-for="(note, idx) in generateResult.melody"
            :key="idx"
            class="note-grid"
          >
            <span>{{ note.midi }}</span>
            <span>{{ note.chronaxie }}</span>
            <span>{{ note.lyrics || '-' }}</span>
          </div>
          <pre class="code-block">{{ JSON.stringify(generateResult, null, 2) }}</pre>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">训练</p>
          <h2>POST /train/example</h2>
        </div>
          <button type="button" class="ghost" @click="play(trainMelody)">播放</button>
        <button type="button" class="primary" :disabled="loadingTrain" @click="sendTraining">
          {{ loadingTrain ? '提交中...' : '提交样本' }}
        </button>
      </div>

      <div class="form-grid">
        <label>
          文本（可选）
          <textarea
            v-model="trainText"
            rows="2"
            placeholder="训练样本关联的文本"
          ></textarea>
        </label>
      </div>

      <ParamEditor
        v-model="trainParams"
        title="训练参数（可选）"
        hint="与生成参数格式一致。"
      />

      <MelodyEditor
        v-model="trainMelody"
        title="训练 melody（必填至少一条）"
        hint="会直接写入 melody-model 的训练集。"
      />

      <p v-if="trainError" class="error">{{ trainError }}</p>
      <p v-if="trainMessage" class="success">{{ trainMessage }}</p>
    </section>
  </div>
</template>
