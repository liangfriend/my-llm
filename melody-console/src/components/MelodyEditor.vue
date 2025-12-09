<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: 'Melody editor',
  },
  hint: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['update:modelValue']);

const notes = computed(() => props.modelValue || []);

function updateNote(index, field, raw) {
  const isNumeric = field !== 'lyrics';
  const value = isNumeric ? (raw === '' ? '' : Number(raw)) : raw;
  const next = notes.value.map((note, idx) =>
    idx === index ? { ...note, [field]: value } : { ...note },
  );
  emit('update:modelValue', next);
}

function addRow() {
  emit('update:modelValue', [...notes.value, { midi: '', chronaxie: '', lyrics: '' }]);
}

function removeRow(index) {
  const next = notes.value.filter((_, idx) => idx !== index);
  emit('update:modelValue', next);
}

function clearAll() {
  emit('update:modelValue', []);
}

function noteState(note) {
  const warnings = [];
  if (note.midi !== '' && Number.isNaN(Number(note.midi))) {
    warnings.push('midi number');
  } else if (note.midi !== '' && (Number(note.midi) < 1 || Number(note.midi) > 128)) {
    warnings.push('midi 1-128');
  }
  if (note.chronaxie !== '' && Number.isNaN(Number(note.chronaxie))) {
    warnings.push('chron number');
  } else if (note.chronaxie !== '' && Number(note.chronaxie) <= 0) {
    warnings.push('chronaxie > 0');
  }
  return warnings.join(', ');
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
        <button type="button" class="ghost" @click="addRow">Add note</button>
        <button type="button" class="ghost" :disabled="!notes.length" @click="clearAll">
          Clear
        </button>
      </div>
    </div>
    <div class="note-grid note-grid-head">
      <span>midi</span>
      <span>chronaxie</span>
      <span>lyrics</span>
      <span class="muted right">actions</span>
    </div>
    <div v-if="!notes.length" class="empty-row">
      <p class="muted">No notes yet. Add rows to describe your melody.</p>
    </div>
    <div v-for="(note, index) in notes" :key="index" class="note-grid">
      <input
        type="number"
        inputmode="numeric"
        min="1"
        max="128"
        :value="note.midi"
        @input="updateNote(index, 'midi', $event.target.value)"
      />
      <input
        type="number"
        inputmode="numeric"
        min="1"
        :value="note.chronaxie"
        @input="updateNote(index, 'chronaxie', $event.target.value)"
      />
      <input
        type="text"
        :value="note.lyrics"
        placeholder="lyrics (optional)"
        @input="updateNote(index, 'lyrics', $event.target.value)"
      />
      <div class="note-actions">
        <span v-if="noteState(note)" class="pill warn">{{ noteState(note) }}</span>
        <button type="button" class="ghost danger" @click="removeRow(index)">Remove</button>
      </div>
    </div>
  </div>
</template>
