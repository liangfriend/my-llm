<script setup>
import { computed } from 'vue';
import MelodyEditor from './MelodyEditor.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: 'Sample melody',
  },
  hint: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue']);

const sentences = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []));

function updateSentence(index, nextSentence) {
  const next = sentences.value.map((sentence, idx) => (idx === index ? nextSentence : sentence));
  emit('update:modelValue', next);
}

function addSentence() {
  emit('update:modelValue', [...sentences.value, [{ midi: '', chronaxie: '', lyrics: '' }]]);
}

function removeSentence(index) {
  const next = sentences.value.filter((_, idx) => idx !== index);
  emit('update:modelValue', next.length ? next : [[{ midi: '', chronaxie: '', lyrics: '' }]]);
}
</script>

<template>
  <div class="panel-section">
    <div class="section-header">
      <div>
        <p class="eyebrow">{{ title }}</p>
        <p v-if="hint" class="muted">{{ hint }}</p>
      </div>
      <div class="section-actions">
        <button type="button" class="ghost" @click="addSentence">添加一句</button>
      </div>
    </div>

    <div
      v-for="(sentence, index) in sentences"
      :key="index"
      class="sentence-block"
    >
      <div class="sentence-header">
        <span class="pill light">第 {{ index + 1 }} 句</span>
        <button
          type="button"
          class="ghost danger"
          :disabled="sentences.length <= 1"
          @click="removeSentence(index)"
        >
          删除该句
        </button>
      </div>
      <MelodyEditor
        :model-value="sentence"
        :title="`句 ${index + 1}`"
        hint="midi=0 表示休止符；每句至少一条 note。"
        @update:model-value="value => updateSentence(index, value)"
      />
    </div>
  </div>
</template>

<style scoped>
.sentence-block {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.sentence-block:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.sentence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
