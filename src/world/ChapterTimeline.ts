/**
 * 天下地图 · 章节时间线：按历史顺序排列的五章战役，及其解锁 / 通关状态。
 * 只读存档字段（纯函数），不写存档；解锁规则与 WorldStore.arcUnlocked / ChapterProgress.chapterUnlocked 一致：
 *   黄巾之乱（始终开放）→ 讨伐董卓（通关黄巾）→ 群雄割据（通关讨董）→ 官渡之战（群雄三关）→ 赤壁之战（官渡三关）。
 */
import { CHRONICLE, type ChronicleStage } from '../data/chronicle';
export type TimelineChapterId = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi' | 'jingnan' | 'hanzhong';
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
  { id: 'jingnan', numeral: '陆', title: '平定荆南', short: '荆南', year: 209, era: '建安十四年', hint: '通关第五章「赤壁之战」后解锁' },
  // 第七章「入蜀」由走路动画会话做，合并后插在这里
  { id: 'hanzhong', numeral: '捌', title: '汉中之战', short: '汉中', year: 219, era: '建安二十四年', hint: '通关第七章「入蜀」后解锁' },
];

/** 计算章节状态所需的存档字段（WorldSave 的子集，便于单测与迁移时调用）。 */
export interface TimelineProgress {
  yellowStages: number; dongzhuoStages: number; warlordStages: number; guanduStages: number; chibiStages: number; jingnanStages?: number; hanzhongStages?: number;
  cleared: { huangjin: boolean; hulao: boolean }; legacyHulaoAccess: boolean;
}

/** 各章已通关的关数（0–3）。 */
export function chapterStagesDone(id: TimelineChapterId, s: TimelineProgress): number {
  const v = id === 'huangjin' ? (s.cleared.huangjin || s.legacyHulaoAccess ? 3 : s.yellowStages)
    : id === 'hulao' ? (s.cleared.hulao ? 3 : s.dongzhuoStages)
    : id === 'qunxiong' ? s.warlordStages : id === 'guandu' ? s.guanduStages : id === 'jingnan' ? (s.jingnanStages ?? 0) : id === 'hanzhong' ? (s.hanzhongStages ?? 0) : s.chibiStages;
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

// ———— 三关路线（地图像素坐标，strategy-map 1536×1024）与史事 ————
const ARC_OF: Record<TimelineChapterId, string> = { huangjin: 'huangjin', hulao: 'dongzhuo', qunxiong: 'qunxiong', guandu: 'guandu', chibi: 'chibi', jingnan: 'jingnan', hanzhong: 'hanzhong' };
/** 各章三关在地图上的位置（按史事地名大致方位，避开城池徽标）。 */
export const STAGE_POINTS: Record<TimelineChapterId, ReadonlyArray<{ x: number; y: number }>> = {
  huangjin: [{ x: 822, y: 212 }, { x: 738, y: 158 }, { x: 905, y: 262 }],   // 广宗外围 · 下曲阳 · 广宗决战
  hulao: [{ x: 795, y: 280 }, { x: 858, y: 405 }, { x: 612, y: 372 }],      // 汜水关 · 荥阳 · 洛阳（虎牢关吕布改为地图挑战关）
  qunxiong: [{ x: 305, y: 365 }, { x: 605, y: 525 }, { x: 1022, y: 590 }],  // 长安 · 宛城 · 寿春
  guandu: [{ x: 975, y: 200 }, { x: 1010, y: 300 }, { x: 1052, y: 400 }],  // 白马 · 延津 · 乌巢
  chibi: [{ x: 420, y: 598 }, { x: 800, y: 790 }, { x: 360, y: 742 }],      // 长坂 · 赤壁 · 江陵
  jingnan: [{ x: 760, y: 960 }, { x: 520, y: 950 }, { x: 650, y: 880 }],    // 桂阳 · 零陵武陵 · 长沙
  hanzhong: [{ x: 250, y: 440 }, { x: 300, y: 470 }, { x: 330, y: 430 }],    // 阳平关 · 定军山 · 汉水
};
export function chapterStages(id: TimelineChapterId): readonly ChronicleStage[] {
  return CHRONICLE.find(c => c.arc === ARC_OF[id])?.stages ?? [];
}
export function chapterIntro(id: TimelineChapterId): string {
  return CHRONICLE.find(c => c.arc === ARC_OF[id])?.intro ?? '';
}
/** 第 n 关是否可出征：本章已开放，且前一关已告捷（讨董旧存档保留全关权限）。 */
export function stageOpen(id: TimelineChapterId, stage: number, s: TimelineProgress): boolean {
  if (chapterState(id, s) === 'locked') return false;
  if (id === 'hulao' && s.legacyHulaoAccess) return true;
  return stage <= chapterStagesDone(id, s) + 1;
}

// ———— 地图揭开：每章开放时揭去该地区的「天下未定」纸雾 ————
/** 各章地区的揭开圆（地图像素）。 */
export const CHAPTER_REGIONS: Record<TimelineChapterId, ReadonlyArray<{ x: number; y: number; r: number }>> = {
  huangjin: [{ x: 800, y: 230, r: 280 }, { x: 1160, y: 300, r: 210 }, { x: 799, y: 573, r: 210 }],
  hulao: [{ x: 650, y: 390, r: 250 }, { x: 920, y: 420, r: 160 }],
  qunxiong: [{ x: 290, y: 400, r: 250 }, { x: 560, y: 590, r: 210 }, { x: 1060, y: 620, r: 220 }, { x: 1240, y: 560, r: 180 }],
  guandu: [{ x: 960, y: 200, r: 260 }, { x: 470, y: 130, r: 220 }, { x: 1200, y: 90, r: 230 }, { x: 1300, y: 400, r: 200 }],
  chibi: [{ x: 460, y: 700, r: 260 }, { x: 950, y: 820, r: 260 }, { x: 1340, y: 690, r: 230 }, { x: 150, y: 520, r: 200 }],
  jingnan: [{ x: 640, y: 930, r: 260 }],
  hanzhong: [{ x: 290, y: 450, r: 200 }],
};

// ———— 攻城分区：某城在其所属章节通关后才可攻打 ————
export const CITY_CHAPTER: Readonly<Record<string, TimelineChapterId>> = {
  luoyang: 'hulao', sishui: 'hulao', hongnong: 'hulao', hangu: 'hulao', xuchang: 'hulao', chenliu: 'hulao', runan: 'hulao', guandu: 'hulao',
  changan: 'qunxiong', tianshui: 'qunxiong', wancheng: 'qunxiong', xinye: 'qunxiong', shouchun: 'qunxiong', xiapi: 'qunxiong', lujiang: 'qunxiong', hanzhong: 'qunxiong',
  ye: 'guandu', nanpi: 'guandu', baima: 'guandu', wuchao: 'guandu', jinyang: 'guandu', shangdang: 'guandu', ji: 'guandu', pingyuan: 'guandu', linzi: 'guandu', beihai: 'guandu', donglai: 'guandu',
  xiangyang: 'chibi', jiangxia: 'chibi', wujun: 'chibi',
};
/** 城池所属章节已通关（可攻打）；未列出的城默认随讨董开放。 */
export function citySiegeOpen(cityId: string, s: TimelineProgress): boolean {
  return chapterState(CITY_CHAPTER[cityId] ?? 'hulao', s) === 'cleared';
}
export function chapterById(id: TimelineChapterId): TimelineChapter { return CHAPTER_TIMELINE.find(c => c.id === id)!; }
