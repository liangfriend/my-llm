"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSentenceContext = buildSentenceContext;
const melodyLine_1 = require("./melodyLine");
/** 从一句旋律推导第 3、4 步所需的句级上下文；totalChronaxie 优先用样本声明值 */
function buildSentenceContext(sentence, declaredTotalChronaxie) {
    var _a, _b;
    const melodyLine = (0, melodyLine_1.buildMelodyLine)(sentence);
    const computedTotal = sentence.reduce((sum, note) => sum + note.chronaxie, 0);
    const totalChronaxie = declaredTotalChronaxie !== undefined && declaredTotalChronaxie > 0
        ? declaredTotalChronaxie
        : computedTotal;
    const noteCount = sentence.length;
    const lastNote = sentence[sentence.length - 1];
    return {
        melodyLine,
        totalChronaxie,
        noteCount,
        lastMidi: (_a = lastNote === null || lastNote === void 0 ? void 0 : lastNote.midi) !== null && _a !== void 0 ? _a : null,
        lastChronaxie: (_b = lastNote === null || lastNote === void 0 ? void 0 : lastNote.chronaxie) !== null && _b !== void 0 ? _b : null,
    };
}
