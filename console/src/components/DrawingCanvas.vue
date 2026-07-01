<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  size: { type: Number, default: 280 },
});

const emit = defineEmits(['sync-arr', 'sync-file']);

const canvasRef = ref(null);
const brushSize = ref(8);
const syncHint = ref('');
const isDrawing = ref(false);

let ctx = null;

function initCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  resetCanvas();
}

function resetCanvas() {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  syncHint.value = '';
}

function getPos(event) {
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function startDraw(event) {
  event.preventDefault();
  isDrawing.value = true;
  canvasRef.value?.setPointerCapture(event.pointerId);
  const { x, y } = getPos(event);
  ctx.lineWidth = brushSize.value;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function draw(event) {
  if (!isDrawing.value) return;
  event.preventDefault();
  const { x, y } = getPos(event);
  ctx.lineWidth = brushSize.value;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function endDraw(event) {
  isDrawing.value = false;
  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId);
  }
  ctx?.beginPath();
}

function canvasToArr() {
  const canvas = canvasRef.value;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const { data } = c.getImageData(0, 0, width, height);
  const arr = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      row.push(alpha > 0 && gray < 250 ? 1 : 0);
    }
    arr.push(row);
  }
  return arr;
}

function syncToArr() {
  const arr = canvasToArr();
  if (!arr.some(row => row.some(v => v === 1))) {
    syncHint.value = '画布为空，请先绘制内容';
    return;
  }
  emit('sync-arr', JSON.stringify(arr));
  syncHint.value = `已同步为 arr（${arr[0].length}×${arr.length}）`;
}

function syncToFile() {
  const canvas = canvasRef.value;
  canvas.toBlob((blob) => {
    if (!blob) {
      syncHint.value = '导出图片失败';
      return;
    }
    const arr = canvasToArr();
    if (!arr.some(row => row.some(v => v === 1))) {
      syncHint.value = '画布为空，请先绘制内容';
      return;
    }
    emit('sync-file', new File([blob], 'drawing.png', { type: 'image/png' }));
    syncHint.value = `已同步为 PNG 图片（${canvas.width}×${canvas.height}）`;
  }, 'image/png');
}

onMounted(initCanvas);
</script>

<template>
  <div class="draw-board">
    <div class="draw-toolbar">
      <label class="brush-field">
        笔触大小 {{ brushSize }}px
        <input v-model.number="brushSize" type="range" min="1" max="24" step="1" />
      </label>
      <div class="draw-actions">
        <button type="button" class="ghost" @click="resetCanvas">重置画布</button>
        <button type="button" class="ghost" @click="syncToArr">同步到 arr</button>
        <button type="button" class="ghost" @click="syncToFile">同步到 file</button>
      </div>
    </div>

    <div class="canvas-wrap">
      <canvas
        ref="canvasRef"
        class="draw-canvas"
        :width="size"
        :height="size"
        @pointerdown="startDraw"
        @pointermove="draw"
        @pointerup="endDraw"
        @pointercancel="endDraw"
        @pointerleave="endDraw"
      />
    </div>

    <p v-if="syncHint" class="sync-hint" :class="{ warn: syncHint.includes('空') || syncHint.includes('失败') }">
      {{ syncHint }}
    </p>
    <p v-else class="muted draw-tip">在白色画布上绘制黑色符号，再同步到 arr 或 file 后调用识别/训练。</p>
  </div>
</template>

<style scoped>
.draw-board {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.draw-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  justify-content: space-between;
}

.brush-field {
  flex: 1;
  min-width: 180px;
  font-size: 14px;
  color: #0f172a;
}

.brush-field input[type='range'] {
  width: 100%;
  padding: 0;
  margin-top: 4px;
  accent-color: #0ea5e9;
}

.draw-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.canvas-wrap {
  display: flex;
  justify-content: center;
  padding: 12px;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}

.draw-canvas {
  display: block;
  width: min(100%, 280px);
  height: auto;
  aspect-ratio: 1;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: crosshair;
  touch-action: none;
}

.draw-tip {
  font-size: 13px;
}

.sync-hint {
  font-size: 13px;
  color: #0369a1;
}

.sync-hint.warn {
  color: #b45309;
}
</style>
