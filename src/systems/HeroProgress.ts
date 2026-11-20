import { XP_SHIFT, heroXpNeed } from '../data/heroLevels';
import { attributePointsAt } from '../data/attributes';
import type { CharacterId } from '../data/characters';
import { ATTRIBUTE_IDS, ATTRIBUTE_MAX, ATTRIBUTE_POINT_EVERY, attributeCap, xpToNext, type AttributeId } from './RunGrowth';
import { chapterOneCleared } from './ChapterProgress';
import { arcUnlocked } from '../world/WorldStore';

/**
 * 武将等级（跨战斗永久，2026-11-16 用户批准 hero-level-proposal.md 做法 A）：
 * - 每位武将（可玩名将 CharacterId 或招募的 r_ 编号）各记等级、经验、已加的属性点；存档键 im_heroes_v1（SaveSlots.PROGRESS_KEYS）。
 * - 结算时本场经验折进武将经验（主线 100%、攻城 / 军情 / 挑战 50%，测试战斗不记）；经验表与局内相同（xpToNext）。
 * - 属性点：2026-11-19 起 Lv25 前每级 1 点、Lv25–38 每 2 级 1 点、之后每 3 级 1 点（data/attributes.ts attributePointsAt），单项最多 10，分配永久保留。
 * - 等级没有硬上限（2026-11-20 软上限，level-curve-redesign.md）：LEVEL_CAPS 是各章打完的「建议等级」，越过之后每级所需经验 ×1.45（heroXpNeed）。
 *   存档里按本章建议等级（levelCap）算软上限；战斗里按本关建议等级（suggestedLevel，更紧）。
 * - 第一次出战的武将：只开第一章时 Lv1，之后从「当前上限 − 4」（落后一章）起步（避免后期才用的武将打不动）。
 */
export const HEROES_KEY = 'im_heroes_v1';
/** 各章开放时的武将等级上限（第 n 章 = LEVEL_CAPS[n−1]）。2026-11-18 平衡：第六～十二章每章 +4，到 58（属性单项上限 14、共 56 点）。 */
/** 2026-11-19 波数 / 等级重做（wave-progression-redesign.md §3）：上限提高，经验按章节放大，各章打完正好到上限；点数与等级脱钩（attributePointsAt）。 */
export const LEVEL_CAPS: readonly number[] = [10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54]; // 2026-11-19 用户选 B（每章 +4）
export type HeroKey = CharacterId | `r_${number}`;
export interface HeroRecord { level: number; xp: number; attributes: Record<AttributeId, number> }
/**
 * attrSet = 4（2026-11-20 起：四维本色 + 取消单项上限，旧点数全部返还）；3 = 2026-11-17 的四项（力量 / 敏捷 / 智力 / 统御）。旧记录（六项）读档时全部退回、不换算，
 * attrNotice 置位，进游戏提示一次「属性已改版，点数已返还」（takeAttrNotice）。
 */
interface HeroSave { version: 1; heroes: Record<string, HeroRecord>; migrated: boolean; firstClears: string[]; attrSet?: number; attrNotice?: boolean }

const ATTRS: readonly AttributeId[] = ATTRIBUTE_IDS;
const zeroAttrs = (): Record<AttributeId, number> => ({ strength: 0, agility: 0, intellect: 0, command: 0 });
/** 软上限下升下一级要的经验（存档用：按本章建议等级）。 */
const need = (level: number, soft = levelCap()): number => heroXpNeed(level, soft);
const int = (v: unknown, max: number, min = 0) => Number.isSafeInteger(v) ? Math.max(min, Math.min(max, v as number)) : min;
const isKey = (k: string) => /^r_\d{1,9}$/.test(k) || /^[a-z]{2,20}$/.test(k);

/** 已开放的章节数（1–12）。 */
export function chaptersOpen(): number {
  try {
    if (!chapterOneCleared()) return 1;
    const later = ['qunxiong', 'guandu', 'chibi', 'jingnan', 'shu', 'hanzhong', 'xiangfan', 'yiling', 'nanzheng', 'beifa'] as const; // 第三～十二章
    let n = 2; for (let i = 0; i < later.length; i++) if (arcUnlocked(later[i])) n = i + 3;
    return n;
  } catch { return 1; }
}
/** 本章建议等级（原「等级上限」，现在只当软上限的参考）。 */
export function levelCap(): number { return LEVEL_CAPS[chaptersOpen() - 1]; }
/** 某关的建议等级（软上限从这里起算）：第一章 4 / 7 / 10；之后按章「上限 − 4」起，三关打完正好到本章上限（+1 / +3 / +4）。 */
export function suggestedLevel(chapter: number, stage: number): number {
  const ch = Math.max(1, Math.min(LEVEL_CAPS.length, Math.floor(chapter))), st = Math.max(1, Math.min(3, Math.floor(stage) || 1));
  return ch === 1 ? [4, 7, 10][st - 1] : LEVEL_CAPS[ch - 1] - 4 + [1, 3, 4][st - 1];
}
/** 第一次出战的武将的起始等级。 */
export function startLevel(): number { const cap = levelCap(); return cap <= LEVEL_CAPS[0] ? 1 : cap - 4; } // 落后一章
/** 某等级累计可得的属性点。 */
export function pointsAt(level: number): number { return attributePointsAt(level); }

let memory: HeroSave | null = null;
function read(): HeroSave {
  if (memory) return memory;
  let s: HeroSave = { version: 1, heroes: {}, migrated: false, firstClears: [], attrSet: 4 };
  try {
    const v = JSON.parse(localStorage.getItem(HEROES_KEY) ?? 'null');
    if (v && v.version === 1 && v.heroes && typeof v.heroes === 'object') {
      s.migrated = v.migrated === true; s.attrSet = v.attrSet === 4 ? 4 : 1; s.attrNotice = v.attrNotice === true;
      // 旧六项：有没有加过点（决定要不要提示）
      if (s.attrSet !== 4) s.attrNotice = Object.values(v.heroes as Record<string, { attributes?: Record<string, unknown> }>).some(r => Object.values(r?.attributes ?? {}).some(n => Number(n) > 0));
      s.firstClears = Array.isArray(v.firstClears) ? [...new Set((v.firstClears as unknown[]).filter((k): k is string => typeof k === 'string' && /^[a-z]+-\d$/.test(k)))].slice(0, 60) : [];
      for (const [k, r] of Object.entries(v.heroes as Record<string, Partial<HeroRecord>>)) {
        if (!isKey(k) || !r) continue;
        const attributes = zeroAttrs(); if (s.attrSet === 4) for (const a of ATTRS) attributes[a] = int(r.attributes?.[a], ATTRIBUTE_MAX);
        s.heroes[k] = { level: int(r.level, 99, 1), xp: int(r.xp, 1e8), attributes };
        // 2026-11-19 点数改版（Lv20 后每 4 级 1 点、单项上限 10）：已加的点超过新规则就全部退回重加（提示一次）
        { const h = s.heroes[k], spent = ATTRS.reduce((n, a) => n + h.attributes[a], 0); if (spent > attributePointsAt(h.level) || ATTRS.some(a => h.attributes[a] > attributeCap(h.level))) { h.attributes = zeroAttrs(); s.attrNotice = true; } }
      }
    }
  } catch { s = { version: 1, heroes: {}, migrated: false, firstClears: [], attrSet: 4 }; }
  memory = s;
  // 属性改版（四项）：旧记录的点数上面已全部退回（不换算），等级不变，可用点按每级 1 点重算
  if (s.attrSet !== 4) { s.attrSet = 4; commit(); }
  if (!s.migrated) migrate(s);
  return s;
}
function commit(): void { try { if (memory) localStorage.setItem(HEROES_KEY, JSON.stringify(memory)); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用：保留在内存 */ } }
export function resetHeroCache(): void { memory = null; }
/** 属性改版提示：老存档第一次读到时返回 true 一次。 */
export function takeAttrNotice(): boolean { const s = read(); if (!s.attrNotice) return false; s.attrNotice = false; commit(); return true; }

/** 老存档：打赢过仗的武将（成就存档 im_achievements.heroes）补到当前上限的一半，其余第一次出战时按 startLevel。 */
function migrate(s: HeroSave): void {
  s.migrated = true;
  try {
    const ach = JSON.parse(localStorage.getItem('im_achievements') ?? 'null'), won: unknown[] = Array.isArray(ach?.heroes) ? ach.heroes : [];
    const level = Math.max(startLevel(), Math.floor(levelCap() / 2));
    for (const h of won) if (typeof h === 'string' && isKey(h) && !s.heroes[h]) s.heroes[h] = { level, xp: 0, attributes: zeroAttrs() };
  } catch { /* 成就存档不可用：都按新武将处理 */ }
  commit();
}

/** 消化存着的经验（软上限：越过本章建议等级后每级 ×1.45，不再卡死）。返回是否有变化。hardCap 只给随行用（招贤馆上限）。 */
function settle(r: HeroRecord, hardCap = Infinity): boolean {
  let changed = false;
  while (r.level < hardCap && r.xp >= need(r.level)) { r.xp -= need(r.level); r.level++; changed = true; }
  return changed;
}
/** 读一位武将（没有记录时按 startLevel 新建；persist=true 才写入存档）。 */
function record(id: HeroKey, persist: boolean): HeroRecord {
  const s = read(); let r = s.heroes[id];
  if (!r) { r = { level: startLevel(), xp: 0, attributes: zeroAttrs() }; if (persist) { s.heroes[id] = r; commit(); } return r; }
  if (settle(r)) commit();
  return r;
}

export function heroLevel(id: HeroKey): number { return record(id, false).level; }
/** 武将谱显示用：等级、当前经验、升下一级所需、本章上限（不写存档）。 */
export function heroInfo(id: HeroKey): { level: number; xp: number; next: number; cap: number } { const r = record(id, false), cap = levelCap(); return { level: r.level, xp: r.xp, next: need(r.level), cap }; }
/** 已加的属性点（副本）。 */
export function heroAttrs(id: HeroKey): Record<AttributeId, number> { return { ...record(id, false).attributes }; }
/** 还没分配的永久属性点（受单项上限 attributeCap(等级) 约束）。 */
export function heroFreePoints(id: HeroKey): number {
  const r = record(id, false), spent = ATTRS.reduce((n, a) => n + r.attributes[a], 0), room = ATTRS.reduce((n, a) => n + attributeCap(r.level) - r.attributes[a], 0);
  return Math.max(0, Math.min(room, pointsAt(r.level) - spent));
}
/** 出战时调用：确保有记录（第一次出战即写入），返回记录副本。 */
export function enlistHero(id: HeroKey): HeroRecord { const r = record(id, true); return { level: r.level, xp: r.xp, attributes: { ...r.attributes } }; }
/** 永久加 1 点属性。 */
/** 洗点：已加的属性点全部退回（等级、经验不变）。花费由武将谱（MasteryStore.respec）处理。 */
export function resetHeroAttrs(id: HeroKey): void { const r = record(id, true); r.attributes = zeroAttrs(); commit(); }
export function allocateHeroAttr(id: HeroKey, attr: AttributeId): boolean {
  if (heroFreePoints(id) <= 0) return false;
  const r = record(id, true); if (r.attributes[attr] >= attributeCap(r.level)) return false;
  r.attributes[attr]++; commit(); return true;
}
/**
 * 主线关首次通关经验（平衡会话实测后提议、用户批准）：一章每关 120、二章 250，之后每章 +130（380 / 510 / 640）。
 * 关卡键同马厩赠马：huangjin-N / hulao-N / third-N / guandu-N / chibi-N。每个存档每关只给一次（任何武将打通都算）。
 */
export const FIRST_CLEAR_XP: Record<string, number> = { huangjin: 120, hulao: 250, third: 380, guandu: 510, chibi: 640, jingnan: 770, shu: 900, hanzhong: 1030, xiangfan: 1160, yiling: 1290, nanzheng: 1420, beifa: 1550 };
/** 这一关是否已首次通关过（征程构筑：重打旧关用空构筑）。 */
export function stageCleared(stageKey: string | null): boolean { return !!stageKey && read().firstClears.includes(stageKey); }
export function claimFirstClear(stageKey: string | null): number {
  const chapter = stageKey?.match(/^([a-z]+)-\d$/)?.[1], xp = chapter ? Math.round((FIRST_CLEAR_XP[chapter] ?? 0) * XP_SHIFT.firstClear) : 0; // 2026-11-20：首通经验大半挪进关内（XP_SHIFT）
  if (!xp || !stageKey) return 0;
  const s = read(); if (s.firstClears.includes(stageKey)) return 0;
  s.firstClears.push(stageKey); commit(); return xp;
}
/** grain 恒为 0（软上限后不再「满级折军粮」，字段留着给旧调用）；capped = 随行到了招贤馆上限。 */
export interface XpResult { from: number; to: number; gained: number; capped: boolean; cap: number; grain: number }
/** 结算记经验（已按来源折算好的数值）。主将没有硬上限（软上限）；随行给 capLevel = 招贤馆上限（硬）。 */
export function creditHeroXp(id: HeroKey, amount: number, capLevel?: number): XpResult {
  const r = record(id, true), from = r.level, cap = capLevel ?? levelCap();
  r.xp = Math.min(1e8, r.xp + Math.max(0, Math.round(amount)));
  settle(r, capLevel ?? Infinity);
  // 随行（招贤馆）的上限比主将低：到顶时经验压到「差 1 点升级」，读档时不会自动补升
  if (capLevel !== undefined && r.level >= cap) { r.level = cap; r.xp = Math.min(r.xp, need(r.level) - 1); }
  commit();
  return { from, to: r.level, gained: Math.max(0, Math.round(amount)), capped: capLevel !== undefined && r.level >= cap, cap, grain: 0 };
}
/**
 * 随行等级上限（招贤馆，用户 2026-11-17「随从等级一开始不要这么高，随着章节解锁提升」）：
 * 把某武将的等级压到 maxLevel 以内，经验不超过「差 1 点升级」（读档时不会按主将上限自动补升）；给 setLevel 时直接设成该级（新入队）。返回是否有变化。
 */
export function clampHeroLevel(id: HeroKey, maxLevel: number, setLevel?: number): boolean {
  const s = read(), had = !!s.heroes[id], r = record(id, true), lv0 = r.level, xp0 = r.xp, top = Math.max(1, Math.floor(maxLevel));
  r.level = Math.max(1, Math.min(top, setLevel !== undefined ? Math.floor(setLevel) : r.level));
  if (setLevel !== undefined) r.xp = 0;
  if (r.level >= top) r.xp = Math.min(r.xp, need(r.level) - 1);
  const changed = !had || r.level !== lv0 || r.xp !== xp0; if (changed) commit();
  return changed;
}
/** 有没有这位武将的等级记录（没有时 heroLevel 按 startLevel 给）。 */
export function hasHeroRecord(id: HeroKey): boolean { return !!read().heroes[id]; }
/** 战斗中升级：直接写入武将等级与当前经验（软上限：不封顶；经验压到「差 1 点升级」以内，读档时不会按存档的软上限自动补升）。 */
export function setHeroProgress(id: HeroKey, level: number, xp: number): void {
  const r = record(id, true); r.level = Math.max(r.level, Math.floor(level)); r.xp = Math.max(0, Math.min(need(r.level) - 1, Math.round(xp))); commit();
}
