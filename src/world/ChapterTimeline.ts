/**
 * 天下地图 · 章节时间线：按历史顺序排列的五章战役，及其解锁 / 通关状态。
 * 只读存档字段（纯函数），不写存档；解锁规则与 WorldStore.arcUnlocked / ChapterProgress.chapterUnlocked 一致：
 *   黄巾之乱（始终开放）→ 讨伐董卓（通关黄巾）→ 群雄割据（通关讨董）→ 官渡之战（群雄三关）→ 赤壁之战（官渡三关）。
 */
export type TimelineChapterId = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi';
export type ChapterState = 'cleared' | 'open' | 'locked';

export interface TimelineChapter {
  id: TimelineChapterId; numeral: string; title: string; short: string; year: number; era: string;
  /** 解锁条件文案（锁定时显示）。 */
  hint: string;
}

export const CHAPTER_TIMELINE: readonly TimelineChapter[] = [
  { id: 'huangjin', numeral: '壹', title: '黄巾之乱', short: '黄巾', year: 184, era: '中平元年', hint: '' },
  { id: 'hulao', numeral: '贰', title: '讨伐董卓', short: '讨董', year: 190, era: '初平元年', hint: '通关第一章「黄巾之乱」后解锁' },
  { id: 'qunxiong', numeral: '叁', title: '群雄割据', short: '群雄', year: 192, era: '初平三年', hint: '通关第二章「讨伐董卓」后解锁' },
  { id: 'guandu', numeral: '肆', title: '官渡之战', short: '官渡', year: 200, era: '建安五年', hint: '通关第三章「群雄割据」后解锁' },
  { id: 'chibi', numeral: '伍', title: '赤壁之战', short: '赤壁', year: 208, era: '建安十三年', hint: '通关第四章「官渡之战」后解锁' },
];

/** 计算章节状态所需的存档字段（WorldSave 的子集，便于单测与迁移时调用）。 */
export interface TimelineProgress {
  yellowStages: number; dongzhuoStages: number; warlordStages: number; guanduStages: number; chibiStages: number;
  cleared: { huangjin: boolean; hulao: boolean }; legacyHulaoAccess: boolean;
}

/** 各章已通关的关数（0–3）。 */
export function chapterStagesDone(id: TimelineChapterId, s: TimelineProgress): number {
  const v = id === 'huangjin' ? (s.cleared.huangjin || s.legacyHulaoAccess ? 3 : s.yellowStages)
    : id === 'hulao' ? (s.cleared.hulao ? 3 : s.dongzhuoStages)
    : id === 'qunxiong' ? s.warlordStages : id === 'guandu' ? s.guanduStages : s.chibiStages;
  return Math.max(0, Math.min(3, v | 0));
}

export function chapterState(id: TimelineChapterId, s: TimelineProgress): ChapterState {
  if (chapterStagesDone(id, s) >= 3) return 'cleared';
  const index = CHAPTER_TIMELINE.findIndex(c => c.id === id);
  const prev = CHAPTER_TIMELINE[index - 1];
  // 讨董：旧存档（legacyHulaoAccess）保留直接进入的权限
  const open = !prev || chapterStagesDone(prev.id, s) >= 3 || (id === 'hulao' && s.legacyHulaoAccess);
  return open ? 'open' : 'locked';
}

/** 已开放（含已通关）的章节数；用于「新篇解锁」提示。 */
export function openChapterCount(s: TimelineProgress): number {
  return CHAPTER_TIMELINE.filter(c => chapterState(c.id, s) !== 'locked').length;
}

/** 当前最该打的一章：第一个已开放而未通关的章节（全部通关时为最后一章）。 */
export function currentChapter(s: TimelineProgress): TimelineChapter {
  return CHAPTER_TIMELINE.find(c => chapterState(c.id, s) === 'open') ?? CHAPTER_TIMELINE[CHAPTER_TIMELINE.length - 1];
}
