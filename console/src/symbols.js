/** 线谱符号类别（与 model/enum.ts MUSIC_SYMBOL_S 一致） */
export const STAFF_LABELS = [
  { value: 0, name: 'WHOLE_NOTE', zh: '全音符' },

  { value: 1, name: 'HALF_NOTE_STEM_UP', zh: '二分音符（符干上）' },
  { value: 2, name: 'HALF_NOTE_STEM_DOWN', zh: '二分音符（符干下）' },

  { value: 3, name: 'QUARTER_NOTE_STEM_UP', zh: '四分音符（符干上）' },
  { value: 4, name: 'QUARTER_NOTE_STEM_DOWN', zh: '四分音符（符干下）' },

  { value: 5, name: 'EIGHTH_NOTE_STEM_UP', zh: '八分音符（符干上）' },
  { value: 6, name: 'EIGHTH_NOTE_STEM_DOWN', zh: '八分音符（符干下）' },

  { value: 7, name: 'SIXTEENTH_NOTE_STEM_UP', zh: '十六分音符（符干上）' },
  { value: 8, name: 'SIXTEENTH_NOTE_STEM_DOWN', zh: '十六分音符（符干下）' },

  { value: 9, name: 'THIRTY_SECOND_NOTE_STEM_UP', zh: '三十二分音符（符干上）' },
  { value: 10, name: 'THIRTY_SECOND_NOTE_STEM_DOWN', zh: '三十二分音符（符干下）' },

  { value: 11, name: 'SIXTY_FOURTH_NOTE_STEM_UP', zh: '六十四分音符（符干上）' },
  { value: 12, name: 'SIXTY_FOURTH_NOTE_STEM_DOWN', zh: '六十四分音符（符干下）' },

  { value: 13, name: 'ONE_HUNDRED_TWENTY_EIGHTH_NOTE_STEM_UP', zh: '一百二十八分音符（符干上）' },
  { value: 14, name: 'ONE_HUNDRED_TWENTY_EIGHTH_NOTE_STEM_DOWN', zh: '一百二十八分音符（符干下）' },

  { value: 15, name: 'TWO_HUNDRED_FIFTY_SIXTH_NOTE_STEM_UP', zh: '二百五十六分音符（符干上）' },
  { value: 16, name: 'TWO_HUNDRED_FIFTY_SIXTH_NOTE_STEM_DOWN', zh: '二百五十六分音符（符干下）' },

  { value: 17, name: 'WHOLE_REST', zh: '全休止符' },
  { value: 18, name: 'HALF_REST', zh: '二分休止符' },
  { value: 19, name: 'QUARTER_REST', zh: '四分休止符' },
  { value: 20, name: 'EIGHTH_REST', zh: '八分休止符' },
  { value: 21, name: 'SIXTEENTH_REST', zh: '十六分休止符' },
  { value: 22, name: 'THIRTY_SECOND_REST', zh: '三十二分休止符' },
  { value: 23, name: 'SIXTY_FOURTH_REST', zh: '六十四分休止符' },
  { value: 24, name: 'ONE_HUNDRED_TWENTY_EIGHTH_REST', zh: '一百二十八分休止符' },
  { value: 25, name: 'TWO_HUNDRED_FIFTY_SIXTH_REST', zh: '二百五十六分休止符' },

  { value: 26, name: 'TREBLE', zh: '高音谱号' },
  { value: 27, name: 'BASS', zh: '低音谱号' },
  { value: 28, name: 'ALTO', zh: '中音谱号' },

  { value: 29, name: 'NATURAL', zh: '还原号' },
  { value: 30, name: 'SHARP', zh: '升号' },
  { value: 31, name: 'FLAT', zh: '降号' },
  { value: 32, name: 'DOUBLE_FLAT', zh: '重降号' },
  { value: 33, name: 'DOUBLE_SHARP', zh: '重升号' },
];

/** 简谱符号类别（占位，待 model 补全） */
export const NUMBER_LABELS = [{ value: 0, name: 'PLACEHOLDER', zh: '占位' }];

export function getLabels(notation) {
  return notation === 'n' ? NUMBER_LABELS : STAFF_LABELS;
}

/** 根据索引取中文名称 */
export function getLabelZh(notation, value) {
  const item = getLabels(notation).find(l => l.value === value);
  return item?.zh ?? `未知符号`;
}
