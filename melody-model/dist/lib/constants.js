"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LAST_NOTE_CHRONAXIE = exports.MELODY_LINE_UNIT = exports.DEFAULT_NOTE_LENGTH = exports.DATA_FILE = void 0;
const path_1 = __importDefault(require("path"));
/** 训练样本 JSON 文件路径 */
exports.DATA_FILE = path_1.default.join(__dirname, '..', 'training-data.json');
/** 无 totalNoteLength 时的默认目标音符数 */
exports.DEFAULT_NOTE_LENGTH = 6;
/** 旋律线计算单位：chronaxie / MELODY_LINE_UNIT 为旋律线上的格数 */
exports.MELODY_LINE_UNIT = 8;
/** 第 6 步：最后一个音符可扩展到的最大时值（文档约定 256 = 全音符） */
exports.MAX_LAST_NOTE_CHRONAXIE = 256;
