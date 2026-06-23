<script setup>
import { ref } from 'vue';
import MelodyEditor from './components/MelodyEditor.vue';
import SampleMelodyEditor from './components/SampleMelodyEditor.vue';
import ParamEditor from './components/ParamEditor.vue';
import {playerManager} from "@jsh/note-player";
import {InstrumentEnum} from "@jsh/note-player/enum";
import {flattenSampleMelody, melodyToToneSeq} from "./utils.js";

const apiBase = ref('/api');

const text = ref('');
const totalNoteLength = ref(null);
const totalChronaxie = ref(null);
const minChronaxie = ref(null);
const minChronaxieInterval = ref(null);
const minMidi = ref(null);
const maxMidi = ref(null);
const preSentence = ref([{ midi: 60, chronaxie: 128, lyrics: '' }]);
const params = ref([
  { key: 'style', value: 'classical' },
  { key: 'mood', value: 'calm' },
]);

const generateResult = ref(null);
const generateError = ref('');
const loadingGenerate = ref(false);

const trainSentences = ref([[{ midi: 62, chronaxie: 128, lyrics: '' }]]);
const trainMinMidi = ref(null);
const trainMaxMidi = ref(null);
const trainParams = ref([{ key: 'style', value: 'classical' }, { key: 'mood', value: 'calm' }]);
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

function normalizeSampleMelody(sentences) {
  return (sentences || [])
    .map(sentence => normalizeMelody(sentence))
    .filter(sentence => sentence.length > 0);
}

function inferMidiRangeFromMelody(sampleMelody) {
  const notes = flattenSampleMelody(sampleMelody).filter(note => Number(note.midi) > 0);
  if (!notes.length) return { min: null, max: null };
  const mids = notes.map(note => Number(note.midi));
  return { min: Math.min(...mids), max: Math.max(...mids) };
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
  generateResult.value = null;
  try {
    const payload = {};
    const paramsObj = paramsToObject(params.value);
    const notes = normalizeMelody(preSentence.value);
    if (text.value.trim()) payload.text = text.value;
    if (notes.length) payload.preSentence = notes;
    const noteLength = Number(totalNoteLength.value);
    if (Number.isFinite(noteLength) && noteLength > 0) {
      payload.totalNoteLength = Math.round(noteLength);
    }
    const totalChronaxieValue = Number(totalChronaxie.value);
    if (Number.isFinite(totalChronaxieValue) && totalChronaxieValue > 0) {
      payload.totalChronaxie = Math.round(totalChronaxieValue);
    }
    const minChron = Number(minChronaxie.value);
    if (Number.isFinite(minChron) && minChron > 0) {
      payload.minChronaxie = Math.round(minChron);
    }
    const minChronStep = Number(minChronaxieInterval.value);
    if (Number.isFinite(minChronStep) && minChronStep > 0) {
      payload.minChronaxieInterval = Math.round(minChronStep);
    }
    const minMidiNumber = Number(minMidi.value);
    if (Number.isFinite(minMidiNumber) && minMidiNumber >= 0) {
      payload.minMidi = Math.round(minMidiNumber);
    }
    const maxMidiNumber = Number(maxMidi.value);
    if (Number.isFinite(maxMidiNumber) && maxMidiNumber > 0) {
      payload.maxMidi = Math.round(maxMidiNumber);
    }
    if (Object.keys(paramsObj).length) payload.params = paramsObj;

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

function applyLyricsToPreSentence() {
  const chars = Array.from(text.value || '');
  if (!chars.length) return;
  const next = [...preSentence.value];
  chars.forEach((char, idx) => {
    const existing = next[idx] || { midi: '', chronaxie: '', lyrics: '' };
    next[idx] = { ...existing, lyrics: char };
  });
  preSentence.value = next;
}

function copyPreSentenceToTraining() {
  trainSentences.value = [preSentence.value.map(note => ({ ...note }))];
  trainParams.value = params.value.map(row => ({ ...row }));
  const range = inferMidiRangeFromMelody(trainSentences.value);
  trainMinMidi.value = range.min;
  trainMaxMidi.value = range.max;
}

function sumMelodyChronaxie(melody) {
  return (melody || []).reduce((sum, note) => sum + Number(note.chronaxie || 0), 0);
}

function clearPreSentence() {
  preSentence.value = [];
}

async function sendTraining() {
  loadingTrain.value = true;
  trainError.value = '';
  trainMessage.value = '';
  try {
    const melody = normalizeSampleMelody(trainSentences.value);
    if (!melody.length) {
      throw new Error('训练数据至少包含一句、且每句至少一条 note');
    }
    const paramsObj = paramsToObject(trainParams.value);
    const payload = { melody };
    if (Object.keys(paramsObj).length) payload.params = paramsObj;

    const minMidiNumber = Number(trainMinMidi.value);
    if (Number.isFinite(minMidiNumber) && minMidiNumber >= 0) {
      payload.minMidi = Math.round(minMidiNumber);
    }
    const maxMidiNumber = Number(trainMaxMidi.value);
    if (Number.isFinite(maxMidiNumber) && maxMidiNumber > 0) {
      payload.maxMidi = Math.round(maxMidiNumber);
    }

    const data = await postJson('/melody/train', payload);
    trainMessage.value = `${data?.message || '训练样本已提交'}（共 ${data?.totalExamples ?? '?'} 条）`;
  } catch (err) {
    trainError.value = err.message || '提交失败';
  } finally {
    loadingTrain.value = false;
  }
}

function fillTrainMidiRangeFromMelody() {
  const range = inferMidiRangeFromMelody(trainSentences.value);
  trainMinMidi.value = range.min;
  trainMaxMidi.value = range.max;
}
const generateApiVisible = ref(true)
function switchGenerateApiVisible() {
    generateApiVisible.value = !generateApiVisible.value
}


function play(melodyInput) {
    const flat = flattenSampleMelody(melodyInput);
    const seq = melodyToToneSeq(flat);
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
          <span class="pill">POST /melody/train</span>
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

        <p class="muted">
          所有参数可选；未填表示该维度不做限制。默认生成 6 个音符。
        </p>

        <div class="form-grid multi-cols">
          <label>
            text / 歌词（可选）
            <textarea
              v-model="text"
              rows="3"
              placeholder="填写歌词；长度可决定目标音符数"
            ></textarea>
          </label>
          <label>
            totalNoteLength（可选）
            <input
              v-model.number="totalNoteLength"
              type="number"
              min="1"
              placeholder="默认 6 或歌词字数"
            />
          </label>
          <label>
            totalChronaxie（可选）
            <input
              v-model.number="totalChronaxie"
              type="number"
              min="1"
              placeholder="640"
            />
          </label>
          <label>
            minChronaxie（可选）
            <input
              v-model.number="minChronaxie"
              type="number"
              min="1"
              placeholder="32"
            />
          </label>
          <label>
            minChronaxieInterval（可选）
            <input
              v-model.number="minChronaxieInterval"
              type="number"
              min="1"
              placeholder="16"
            />
          </label>
          <label>
            minMidi（可选）
            <input
              v-model.number="minMidi"
              type="number"
              min="0"
              max="128"
              placeholder="不填则不限制"
            />
          </label>
          <label>
            maxMidi（可选）
            <input
              v-model.number="maxMidi"
              type="number"
              min="1"
              max="128"
              placeholder="不填则不限制"
            />
          </label>
        </div>

        <ParamEditor
          v-model="params"
          title="params 标签（可选）"
          hint="用于样本标签权重过滤，如 style、mood。"
        />

        <MelodyEditor
          v-model="preSentence"
          title="preSentence 上一句（可选）"
          hint="一维数组；有值时按「上一句 → 当前句」生成。midi=0 为休止符。"
        />

        <div class="inline-actions">
          <button type="button" class="ghost" @click="applyLyricsToPreSentence">用 text 填充 preSentence 歌词</button>
          <button type="button" class="ghost" @click="copyPreSentenceToTraining">复制到训练区</button>
          <button type="button" class="ghost" @click="clearPreSentence">清空 preSentence</button>
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
              :disabled="!generateResult?.melody?.length"
              @click="play(generateResult.melody)"
            >
              播放
            </button>
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
          <h2>POST /melody/train</h2>
        </div>
        <button type="button" class="ghost" @click="play(trainSentences)">播放</button>
        <button type="button" class="primary" :disabled="loadingTrain" @click="sendTraining">
          {{ loadingTrain ? '提交中...' : '提交样本' }}
        </button>
      </div>

      <p class="muted">
        melody 为二维数组（按句存储）；midi=0 表示休止符。写入
        <code>training-data.json</code>。
      </p>

      <div class="form-grid multi-cols">
        <label>
          样本 minMidi（可选）
          <input
            v-model.number="trainMinMidi"
            type="number"
            min="0"
            max="128"
            placeholder="自动或手填"
          />
        </label>
        <label>
          样本 maxMidi（可选）
          <input
            v-model.number="trainMaxMidi"
            type="number"
            min="1"
            max="128"
            placeholder="自动或手填"
          />
        </label>
      </div>

      <div class="inline-actions">
        <button type="button" class="ghost" @click="fillTrainMidiRangeFromMelody">
          从 melody 推断 min/maxMidi
        </button>
      </div>

      <ParamEditor
        v-model="trainParams"
        title="样本标签 params（可选）"
        hint="用于第 2 步标签权重过滤，如 style、mood。"
      />

      <SampleMelodyEditor
        v-model="trainSentences"
        title="样本 melody（必填，二维数组）"
        hint="每句一条旋律；多句样本用于「上一句 → 下一句」对照。"
      />

      <p v-if="trainError" class="error">{{ trainError }}</p>
      <p v-if="trainMessage" class="success">{{ trainMessage }}</p>
    </section>
  </div>
</template>
