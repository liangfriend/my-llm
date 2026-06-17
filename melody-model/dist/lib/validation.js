"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIncomingMelody = validateIncomingMelody;
const note_1 = require("./note");
function validateIncomingMelody(melody) {
    if (!Array.isArray(melody) || !melody.length) {
        return { error: 'melody must be a non-empty array' };
    }
    const sanitized = melody.map(note => (0, note_1.sanitizeNote)(note));
    const outOfRange = sanitized.find(n => !n.rest && (n.midi < 1 || n.midi > 128));
    if (outOfRange) {
        return { error: 'midi values must be between 1 and 128' };
    }
    return { melody: sanitized };
}
