/**
 * 音乐符号分类标签（MUSIC_SYMBOL_S）
 *
 * 设计约定：
 * - 全音符无符干，不区分朝向
 * - 二分音符及更短时值：符干朝上 / 朝下各为一类（用于识别符干方向）
 * - 休止符无符干，按时值区分
 */
export enum MUSIC_SYMBOL {
    // ── 音符（17 类）────────────────────────────────────────────
    /** 全音符（无符干） */
    WHOLE_NOTE = 0,

    /** 二分音符 · 符干朝上 / 朝下 */
    HALF_NOTE_STEM_UP,
    HALF_NOTE_STEM_DOWN,

    /** 四分音符 · 符干朝上 / 朝下 */
    QUARTER_NOTE_STEM_UP,
    QUARTER_NOTE_STEM_DOWN,

    /** 八分音符 · 符干朝上 / 朝下 */
    EIGHTH_NOTE_STEM_UP,
    EIGHTH_NOTE_STEM_DOWN,

    /** 十六分音符 · 符干朝上 / 朝下 */
    SIXTEENTH_NOTE_STEM_UP,
    SIXTEENTH_NOTE_STEM_DOWN,

    /** 三十二分音符 · 符干朝上 / 朝下 */
    THIRTY_SECOND_NOTE_STEM_UP,
    THIRTY_SECOND_NOTE_STEM_DOWN,

    /** 六十四分音符 · 符干朝上 / 朝下 */
    SIXTY_FOURTH_NOTE_STEM_UP,
    SIXTY_FOURTH_NOTE_STEM_DOWN,

    /** 一百二十八分音符 · 符干朝上 / 朝下 */
    ONE_HUNDRED_TWENTY_EIGHTH_NOTE_STEM_UP,
    ONE_HUNDRED_TWENTY_EIGHTH_NOTE_STEM_DOWN,

    /** 二百五十六分音符 · 符干朝上 / 朝下 */
    TWO_HUNDRED_FIFTY_SIXTH_NOTE_STEM_UP,
    TWO_HUNDRED_FIFTY_SIXTH_NOTE_STEM_DOWN,

    // ── 休止符（9 类）──────────────────────────────────────────
    WHOLE_REST,
    HALF_REST,
    QUARTER_REST,
    EIGHTH_REST,
    SIXTEENTH_REST,
    THIRTY_SECOND_REST,
    SIXTY_FOURTH_REST,
    ONE_HUNDRED_TWENTY_EIGHTH_REST,
    TWO_HUNDRED_FIFTY_SIXTH_REST,

    // ── 谱号（3 类）────────────────────────────────────────────
    TREBLE,
    BASS,
    ALTO,

    // ── 变音符号（5 类）────────────────────────────────────────
    NATURAL,
    SHARP,
    FLAT,
    DOUBLE_FLAT,
    DOUBLE_SHARP,
}

export const MUSIC_SYMBOL_ZH: Record<MUSIC_SYMBOL, string> = {
    [MUSIC_SYMBOL.WHOLE_NOTE]: '全音符',

    [MUSIC_SYMBOL.HALF_NOTE_STEM_UP]: '二分音符（符干上）',
    [MUSIC_SYMBOL.HALF_NOTE_STEM_DOWN]: '二分音符（符干下）',

    [MUSIC_SYMBOL.QUARTER_NOTE_STEM_UP]: '四分音符（符干上）',
    [MUSIC_SYMBOL.QUARTER_NOTE_STEM_DOWN]: '四分音符（符干下）',

    [MUSIC_SYMBOL.EIGHTH_NOTE_STEM_UP]: '八分音符（符干上）',
    [MUSIC_SYMBOL.EIGHTH_NOTE_STEM_DOWN]: '八分音符（符干下）',

    [MUSIC_SYMBOL.SIXTEENTH_NOTE_STEM_UP]: '十六分音符（符干上）',
    [MUSIC_SYMBOL.SIXTEENTH_NOTE_STEM_DOWN]: '十六分音符（符干下）',

    [MUSIC_SYMBOL.THIRTY_SECOND_NOTE_STEM_UP]: '三十二分音符（符干上）',
    [MUSIC_SYMBOL.THIRTY_SECOND_NOTE_STEM_DOWN]: '三十二分音符（符干下）',

    [MUSIC_SYMBOL.SIXTY_FOURTH_NOTE_STEM_UP]: '六十四分音符（符干上）',
    [MUSIC_SYMBOL.SIXTY_FOURTH_NOTE_STEM_DOWN]: '六十四分音符（符干下）',

    [MUSIC_SYMBOL.ONE_HUNDRED_TWENTY_EIGHTH_NOTE_STEM_UP]: '一百二十八分音符（符干上）',
    [MUSIC_SYMBOL.ONE_HUNDRED_TWENTY_EIGHTH_NOTE_STEM_DOWN]: '一百二十八分音符（符干下）',

    [MUSIC_SYMBOL.TWO_HUNDRED_FIFTY_SIXTH_NOTE_STEM_UP]: '二百五十六分音符（符干上）',
    [MUSIC_SYMBOL.TWO_HUNDRED_FIFTY_SIXTH_NOTE_STEM_DOWN]: '二百五十六分音符（符干下）',

    [MUSIC_SYMBOL.WHOLE_REST]: '全休止符',
    [MUSIC_SYMBOL.HALF_REST]: '二分休止符',
    [MUSIC_SYMBOL.QUARTER_REST]: '四分休止符',
    [MUSIC_SYMBOL.EIGHTH_REST]: '八分休止符',
    [MUSIC_SYMBOL.SIXTEENTH_REST]: '十六分休止符',
    [MUSIC_SYMBOL.THIRTY_SECOND_REST]: '三十二分休止符',
    [MUSIC_SYMBOL.SIXTY_FOURTH_REST]: '六十四分休止符',
    [MUSIC_SYMBOL.ONE_HUNDRED_TWENTY_EIGHTH_REST]: '一百二十八分休止符',
    [MUSIC_SYMBOL.TWO_HUNDRED_FIFTY_SIXTH_REST]: '二百五十六分休止符',

    [MUSIC_SYMBOL.TREBLE]: '高音谱号',
    [MUSIC_SYMBOL.BASS]: '低音谱号',
    [MUSIC_SYMBOL.ALTO]: '中音谱号',

    [MUSIC_SYMBOL.NATURAL]: '还原号',
    [MUSIC_SYMBOL.SHARP]: '升号',
    [MUSIC_SYMBOL.FLAT]: '降号',
    [MUSIC_SYMBOL.DOUBLE_FLAT]: '重降号',
    [MUSIC_SYMBOL.DOUBLE_SHARP]: '重升号',
};

export type MusicSymbolLabel = {
    name: keyof typeof MUSIC_SYMBOL;
    value: MUSIC_SYMBOL;
    zh: string;
};

/** 从枚举生成全部符号类别（console 唯一数据源） */
export function getMusicSymbolLabels(): MusicSymbolLabel[] {
    return (Object.entries(MUSIC_SYMBOL) as [string, MUSIC_SYMBOL | string][])
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([name, value]) => ({
            name: name as keyof typeof MUSIC_SYMBOL,
            value: value as MUSIC_SYMBOL,
            zh: MUSIC_SYMBOL_ZH[value as MUSIC_SYMBOL],
        }));
}
