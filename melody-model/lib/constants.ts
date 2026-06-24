import path from 'path';

/** 训练样本 JSON 文件路径 */
export const DATA_FILE = path.join(__dirname, '..', 'training-data.json');
/** 无 totalNoteLength 时的默认目标音符数 */
export const DEFAULT_NOTE_LENGTH = 6;
/** 旋律线计算单位：chronaxie / MELODY_LINE_UNIT 为旋律线上的格数 */
export const MELODY_LINE_UNIT = 8;
/** 第 6 步：最后一个音符可扩展到的最大时值（文档约定 256 = 全音符） */
export const MAX_LAST_NOTE_CHRONAXIE = 256;
