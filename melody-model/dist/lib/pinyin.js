"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLyricPinyin = toLyricPinyin;
const pinyin_pro_1 = require("pinyin-pro");
/**
 * 将歌词转为无声调拼音，供样本音符对照使用。
 * 只取第一个字符，与「一字一音」的样本格式一致。
 */
function toLyricPinyin(text) {
    if (!text)
        return null;
    const chars = Array.from(text.trim());
    if (!chars.length)
        return null;
    return (0, pinyin_pro_1.pinyin)(chars[0], { toneType: 'none', type: 'array' }).join('') || null;
}
