import { SentenceMelody } from '../type';
import { buildMelodyLine } from './melodyLine';
import { countLyricsInMelody } from './note';
import { toLyricPinyin } from './pinyin';

/** 单句旋律的汇总上下文 */
export interface SentenceContext {
  melodyLine: number[];
  totalChronaxie: number;
  noteCount: number;
  lyricCount: number;
  lastMidi: number | null;
  lastChronaxie: number | null;
  lastPinyin: string | null;
}

/** 从一句旋律推导第 3、4 步所需的句级上下文 */
export function buildSentenceContext(sentence: SentenceMelody): SentenceContext {
  const melodyLine = buildMelodyLine(sentence);
  const totalChronaxie = sentence.reduce((sum, note) => sum + note.chronaxie, 0);
  const noteCount = sentence.length;
  const lyricCount = countLyricsInMelody(sentence);
  const lastNote = sentence[sentence.length - 1];
  return {
    melodyLine,
    totalChronaxie,
    noteCount,
    lyricCount,
    lastMidi: lastNote?.midi ?? null,
    lastChronaxie: lastNote?.chronaxie ?? null,
    lastPinyin: lastNote ? toLyricPinyin(lastNote.lyrics) : null,
  };
}
