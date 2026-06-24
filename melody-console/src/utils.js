/** 将样本 melody 展平为单句，便于播放预览；兼容二维数组与 { sentence } 格式 */
export function flattenSampleMelody(sampleMelody) {
  if (!Array.isArray(sampleMelody)) return [];
  if (sampleMelody.length && sampleMelody[0]?.sentence) {
    return sampleMelody.flatMap(item => item.sentence || []);
  }
  if (sampleMelody.length && Array.isArray(sampleMelody[0])) {
    return sampleMelody.flat();
  }
  return sampleMelody;
}
