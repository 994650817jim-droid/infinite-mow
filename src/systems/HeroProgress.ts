import { OVERFLOW_XP_PER_GRAIN } from '../data/heroLevels';
import type { CharacterId } from '../data/characters';
import { ATTRIBUTE_IDS, ATTRIBUTE_MAX, ATTRIBUTE_POINT_EVERY, xpToNext, type AttributeId } from './RunGrowth';
import { chapterOneCleared } from './ChapterProgress';
import { arcUnlocked } from '../world/WorldStore';

/**
 * 武将等级（跨战斗永久，2026-11-16 用户批准 hero-level-proposal.md 做法 A）：
 * - 每位武将（可玩名将 CharacterId 或招募的 r_ 编号）各记等级、经验、已加的属性点；存档键 im_heroes_v1（SaveSlots.PROGRESS_KEYS）。
 * - 结算时本场经验折进武将经验（主线 100%、攻城 / 军情 / 挑战 50%，测试战斗不记）；经验表与局内相同（xpToNext）。
 * - 每级 1 个属性点（Lv.N 共 N−1 点，2026-11-16 改版），单项最多 8，分配永久保留；局内升级不再给属性点（局内只出三选一，见 Player.gainXp「战功」）。
 * - 等级上限随章节开放：一章 10、二章 15、三章 20、四章 25、五章 30；超出的经验先存着，开新章后再升。
 * - 第一次出战的武将：只开第一章时 Lv1，之后从「当前上限 − 5」起步（避免后期才用的武将打不动）。
 */
export const HEROES_KEY = 'im_heroes_v1';
export const LEVEL_CAPS: readonly number[] = [10, 15, 20, 25, 30];
export type HeroKey = CharacterId | `r_${number}`;
export interface HeroRecord { level: number; xp: number; attributes: Record<AttributeId, number> }
/**
 * attrSet = 3：属性已是 2026-11-17 改版的四项（力量 / 敏捷 / 智力 / 统御）。旧记录（六项）读档时全部退回、不换算，
 * attrNotice 置位，进游戏提示一次「属性已改版，点数已返还」（takeAttrNotice）。
 */
interface HeroSave { version: 1; heroes: Record<string, HeroRecord>; migrated: boolean; firstClears: string[]; attrSet?: number; attrNotice?: boolean }

const ATTRS: readonly AttributeId[] = ATTRIBUTE_IDS;
const zeroAttrs = (): Record<AttributeId, number> => ({ strength: 0, agility: 0, intellect: 0, command: 0 });
const int = (v: unknown, max: number, min = 0) => Number.isSafeInteger(v) ? Math.max(min, Math.min(max, v as number)) : min;
const isKey = (k: string) => /^r_\d{1,9}$/.test(k) || /^[a-z]{2,20}$/.test(k);

/** 已开放的章节数（1–5）。 */
export function chaptersOpen(): number {
  try { return !chapterOneCleared() ? 1 : arcUnlocked('chibi') ? 5 : arcUnlocked('guandu') ? 4 : arcUnlocked('qunxiong') ? 3 : 2; } catch { return 1; }
}
export function levelCap(): number { return LEVEL_CAPS[chaptersOpen() - 1]; }
/** 第一次出战的武将的起始等级。 */
export function startLevel(): number { const cap = levelCap(); return cap <= LEVEL_CAPS[0] ? 1 : cap - 5; }
/** 某等级累计可得的属性点。 */
export function pointsAt(level: number): number { return Math.max(0, Math.floor((level - 1) / ATTRIBUTE_POINT_EVERY)); }

let memory: HeroSave | null = null;
function read(): HeroSave {
  if (memory) return memory;
  let s: HeroSave = { version: 1, heroes: {}, migrated: false, firstClears: [], attrSet: 3 };
  try {
    const v = JSON.parse(localStorage.getItem(HEROES_KEY) ?? 'null');
    if (v && v.version === 1 && v.heroes && typeof v.heroes === 'object') {
      s.migrated = v.migrated === true; s.attrSet = v.attrSet === 3 ? 3 : 1; s.attrNotice = v.attrNotice === true;
      // 旧六项：有没有加过点（决定要不要提示）
      if (s.attrSet !== 3) s.attrNotice = Object.values(v.heroes as Record<string, { attributes?: Record<string, unknown> }>).some(r => Object.values(r?.attributes ?? {}).some(n => Number(n) > 0));
      s.firstClears = Array.isArray(v.firstClears) ? [...new Set((v.firstClears as unknown[]).filter((k): k is string => typeof k === 'string' && /^[a-z]+-\d$/.test(k)))].slice(0, 60) : [];
      for (const [k, r] of Object.entries(v.heroes as Record<string, Partial<HeroRecord>>)) {
        if (!isKey(k) || !r) continue;
        const attributes = zeroAttrs(); if (s.attrSet === 3) for (const a of ATTRS) attributes[a] = int(r.attributes?.[a], ATTRIBUTE_MAX);
        s.heroes[k] = { level: int(r.level, LEVEL_CAPS[LEVEL_CAPS.length - 1], 1), xp: int(r.xp, 1e8), attributes };
      }
    }
  } catch { s = { version: 1, heroes: {}, migrated: false, firstClears: [], attrSet: 3 }; }
  memory = s;
  // 属性改版（四项）：旧记录的点数上面已全部退回（不换算），等级不变，可用点按每级 1 点重算
  if (s.attrSet !== 3) { s.attrSet = 3; commit(); }
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

/** 按当前上限消化存着的经验（开新章后补升）。返回是否有变化。cap 缺省为主将的本章上限。 */
function settle(r: HeroRecord, cap = levelCap()): boolean {
  let changed = false;
  while (r.level < cap && r.xp >= xpToNext(r.level)) { r.xp -= xpToNext(r.level); r.level++; changed = true; }
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
export function heroInfo(id: HeroKey): { level: number; xp: number; next: number; cap: number } { const r = record(id, false), cap = levelCap(); return { level: r.level, xp: r.xp, next: xpToNext(r.level), cap }; }
/** 已加的属性点（副本）。 */
export function heroAttrs(id: HeroKey): Record<AttributeId, number> { return { ...record(id, false).attributes }; }
/** 还没分配的永久属性点（受每项 5 点上限约束）。 */
export function heroFreePoints(id: HeroKey): number {
  const r = record(id, false), spent = ATTRS.reduce((n, a) => n + r.attributes[a], 0), room = ATTRS.reduce((n, a) => n + ATTRIBUTE_MAX - r.attributes[a], 0);
  return Math.max(0, Math.min(room, pointsAt(r.level) - spent));
}
/** 出战时调用：确保有记录（第一次出战即写入），返回记录副本。 */
export function enlistHero(id: HeroKey): HeroRecord { const r = record(id, true); return { level: r.level, xp: r.xp, attributes: { ...r.attributes } }; }
/** 永久加 1 点属性。 */
/** 洗点：已加的属性点全部退回（等级、经验不变）。花费由武将谱（MasteryStore.respec）处理。 */
export function resetHeroAttrs(id: HeroKey): void { const r = record(id, true); r.attributes = zeroAttrs(); commit(); }
export function allocateHeroAttr(id: HeroKey, attr: AttributeId): boolean {
  if (heroFreePoints(id) <= 0) return false;
  const r = record(id, true); if (r.attributes[attr] >= ATTRIBUTE_MAX) return false;
  r.attributes[attr]++; commit(); return true;
}
/**
 * 主线关首次通关经验（平衡会话实测后提议、用户批准）：一章每关 120、二章 250，之后每章 +130（380 / 510 / 640）。
 * 关卡键同马厩赠马：huangjin-N / hulao-N / third-N / guandu-N / chibi-N。每个存档每关只给一次（任何武将打通都算）。
 */
export const FIRST_CLEAR_XP: Record<string, number> = { huangjin: 120, hulao: 250, third: 380, guandu: 510, chibi: 640, jingnan: 770, hanzhong: 1030, yiling: 1290, beifa: 1550 };
/** 这一关是否已首次通关过（征程构筑：重打旧关用空构筑）。 */
export function stageCleared(stageKey: string | null): boolean { return !!stageKey && read().firstClears.includes(stageKey); }
export function claimFirstClear(stageKey: string | null): number {
  const chapter = stageKey?.match(/^([a-z]+)-\d$/)?.[1], xp = chapter ? FIRST_CLEAR_XP[chapter] ?? 0 : 0;
  if (!xp || !stageKey) return 0;
  const s = read(); if (s.firstClears.includes(stageKey)) return 0;
  s.firstClears.push(stageKey); commit(); return xp;
}
export interface XpResult { from: number; to: number; gained: number; capped: boolean; cap: number; /** 到上限后超出「再存 1 级」的经验折的军粮（每 OVERFLOW_XP_PER_GRAIN 经验 1 粮）。 */ grain: number }
/** 结算记经验（已按来源折算好的数值）。到上限后经验存着。 */
export function creditHeroXp(id: HeroKey, amount: number, capLevel?: number): XpResult {
  const r = record(id, true), from = r.level, cap = capLevel ?? levelCap();
  r.xp = Math.min(1e8, r.xp + Math.max(0, Math.round(amount)));
  settle(r, cap);
  let grain = 0; if (r.level >= cap && r.xp > xpToNext(r.level)) { grain = Math.floor((r.xp - xpToNext(r.level)) / OVERFLOW_XP_PER_GRAIN); r.xp = xpToNext(r.level); }
  // 随行（招贤馆）的上限比主将低：到顶时经验压到「差 1 点升级」，读档时不会被按主将上限自动补升
  if (capLevel !== undefined && r.level >= cap) { r.level = cap; r.xp = Math.min(r.xp, xpToNext(r.level) - 1); }
  commit();
  return { from, to: r.level, gained: Math.max(0, Math.round(amount)), capped: r.level >= cap, cap, grain };
}
/**
 * 随行等级上限（招贤馆，用户 2026-11-17「随从等级一开始不要这么高，随着章节解锁提升」）：
 * 把某武将的等级压到 maxLevel 以内，经验不超过「差 1 点升级」（读档时不会按主将上限自动补升）；给 setLevel 时直接设成该级（新入队）。返回是否有变化。
 */
export function clampHeroLevel(id: HeroKey, maxLevel: number, setLevel?: number): boolean {
  const s = read(), had = !!s.heroes[id], r = record(id, true), lv0 = r.level, xp0 = r.xp, top = Math.max(1, Math.floor(maxLevel));
  r.level = Math.max(1, Math.min(top, setLevel !== undefined ? Math.floor(setLevel) : r.level));
  if (setLevel !== undefined) r.xp = 0;
  if (r.level >= top) r.xp = Math.min(r.xp, xpToNext(r.level) - 1);
  const changed = !had || r.level !== lv0 || r.xp !== xp0; if (changed) commit();
  return changed;
}
/** 有没有这位武将的等级记录（没有时 heroLevel 按 startLevel 给）。 */
export function hasHeroRecord(id: HeroKey): boolean { return !!read().heroes[id]; }
/** 战斗中升级：直接写入武将等级与当前经验（不超过本章上限；属性点按等级算）。 */
export function setHeroProgress(id: HeroKey, level: number, xp: number): void {
  const r = record(id, true), cap = levelCap(); r.level = Math.max(r.level, Math.min(cap, Math.floor(level))); r.xp = Math.max(0, Math.min(xpToNext(r.level), Math.round(xp))); commit();
}
