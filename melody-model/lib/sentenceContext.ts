import { SentenceMelody } from '../type';
import { buildMelodyLine } from './melodyLine';

/** 单句旋律的汇总上下文 */
export interface SentenceContext {
  melodyLine: number[];
  totalChronaxie: number;
  noteCount: number;
  lastMidi: number | null;
  lastChronaxie: number | null;
}

/** 从一句旋律推导第 3、4 步所需的句级上下文；totalChronaxie 优先用样本声明值 */
export function buildSentenceContext(
  sentence: SentenceMelody,
  declaredTotalChronaxie?: number,
): SentenceContext {
  const melodyLine = buildMelodyLine(sentence);
  const computedTotal = sentence.reduce((sum, note) => sum + note.chronaxie, 0);
  const totalChronaxie =
    declaredTotalChronaxie !== undefined && declaredTotalChronaxie > 0
      ? declaredTotalChronaxie
      : computedTotal;
  const noteCount = sentence.length;
  const lastNote = sentence[sentence.length - 1];
  return {
    melodyLine,
    totalChronaxie,
    noteCount,
    lastMidi: lastNote?.midi ?? null,
    lastChronaxie: lastNote?.chronaxie ?? null,
  };
}
