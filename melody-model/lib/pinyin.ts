import { pinyin } from 'pinyin-pro';

/**
 * 将歌词转为无声调拼音，供样本音符对照使用。
 * 只取第一个字符，与「一字一音」的样本格式一致。
 */
export function toLyricPinyin(text: string | undefined): string | null {
  if (!text) return null;
  const chars = Array.from(text.trim());
  if (!chars.length) return null;
  return pinyin(chars[0], { toneType: 'none', type: 'array' }).join('') || null;
}
