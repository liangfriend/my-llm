<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: 'Params',
  },
  hint: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue']);
const rows = computed(() => props.modelValue || []);

function updateRow(index, field, value) {
  const next = rows.value.map((row, idx) =>
    idx === index ? { ...row, [field]: value } : { ...row },
  );
  emit('update:modelValue', next);
}

function addRow() {
  emit('update:modelValue', [...rows.value, { key: '', value: '' }]);
}

function removeRow(index) {
  const next = rows.value.filter((_, idx) => idx !== index);
  emit('update:modelValue', next);
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
        <button type="button" class="ghost" @click="addRow">Add param</button>
      </div>
    </div>

    <div class="note-grid note-grid-head param-grid">
      <span>key</span>
      <span class="wide">value</span>
      <span class="right muted">actions</span>
    </div>

    <div v-if="!rows.length" class="empty-row">
      <p class="muted">Optional key-value pairs that influence sampling.</p>
    </div>
    <div v-for="(row, index) in rows" :key="index" class="note-grid param-grid">
      <input
        type="text"
        :value="row.key"
        placeholder="style"
        @input="updateRow(index, 'key', $event.target.value)"
      />
      <input
        type="text"
        :value="row.value"
        placeholder="classical or 0.4"
        @input="updateRow(index, 'value', $event.target.value)"
      />
      <div class="note-actions">
        <button type="button" class="ghost danger" @click="removeRow(index)">Remove</button>
      </div>
    </div>
  </div>
</template>
