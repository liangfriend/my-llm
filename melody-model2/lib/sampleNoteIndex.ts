/**
 * 第 3 步：遍历过滤后的样本，平铺为样本音符数组并初始化权重表。
 * 权重表在本步全部为 0，具体权重在第 5 步对照上下文时再赋值。
 */
import { GenerationState, SampleNoteEntry, SentenceMelody } from '../type';
import { buildSentenceContext, SentenceContext } from './sentenceContext';
import { toLyricPinyin } from './pinyin';

function appendSentenceNotes(
  entries: SampleNoteEntry[],
  sentence: SentenceMelody,
  sampleWeight: number,
  current: SentenceContext,
  previous: SentenceContext | null,
): void {
  sentence.forEach((note, noteIndex) => {
    const prevNote = noteIndex > 0 ? sentence[noteIndex - 1] : null;

    entries.push({
      sampleWeight,
      midi: note.midi,
      chronaxie: note.chronaxie,
      pinyin: toLyricPinyin(note.lyrics),
      sentenceMelodyLine: current.melodyLine,
      sentenceTotalChronaxie: current.totalChronaxie,
      sentenceNoteCount: current.noteCount,
      sentenceLyricCount: current.lyricCount,
      prevMidi: prevNote?.midi ?? null,
      prevChronaxie: prevNote?.chronaxie ?? null,
      prevPinyin: prevNote ? toLyricPinyin(prevNote.lyrics) : null,
      prevSentenceMelodyLine: previous?.melodyLine ?? null,
      prevSentenceTotalChronaxie: previous?.totalChronaxie ?? null,
      prevSentenceNoteCount: previous?.noteCount ?? null,
      prevSentenceLyricCount: previous?.lyricCount ?? null,
      prevSentenceLastMidi: previous?.lastMidi ?? null,
      prevSentenceLastChronaxie: previous?.lastChronaxie ?? null,
      prevSentenceLastPinyin: previous?.lastPinyin ?? null,
    });
  });
}

/**
 * 第 3 步：将 filteredSamples 中每个音符平铺写入 state.sampleNoteEntries，
 * 并建立等长的 sampleNoteWeights（初始全 0）。
 */
export function buildSampleNoteIndexStep3(state: GenerationState): void {
  const entries: SampleNoteEntry[] = [];

  state.filteredSamples.forEach((example, sampleIndex) => {
    const sampleWeight = state.sampleWeights[sampleIndex] ?? 1;
    const sentences = example.melody ?? [];
    let prevSentenceContext: SentenceContext | null = null;

    sentences.forEach(sentence => {
      if (!sentence.length) return;

      const currentContext = buildSentenceContext(sentence);
      appendSentenceNotes(entries, sentence, sampleWeight, currentContext, prevSentenceContext);
      prevSentenceContext = currentContext;
    });
  });

  state.sampleNoteEntries = entries;
  state.sampleNoteWeights = new Array(entries.length).fill(0);
}
