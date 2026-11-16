import type { CharacterId } from '../data/characters';
import { ATTRIBUTE_MAX, ATTRIBUTE_POINT_EVERY, xpToNext, type AttributeId } from './RunGrowth';
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
/** attrScale = 2：属性点已按「每级 1 点、效果减半」换算（旧记录的已加点 ×2）。 */
interface HeroSave { version: 1; heroes: Record<string, HeroRecord>; migrated: boolean; firstClears: string[]; attrScale?: number }

const ATTRS: readonly AttributeId[] = ['might', 'quickness', 'critical', 'constitution', 'agility', 'command'];
const zeroAttrs = (): Record<AttributeId, number> => ({ might: 0, quickness: 0, critical: 0, constitution: 0, agility: 0, command: 0 });
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
  let s: HeroSave = { version: 1, heroes: {}, migrated: false, firstClears: [], attrScale: 2 };
  try {
    const v = JSON.parse(localStorage.getItem(HEROES_KEY) ?? 'null');
    if (v && v.version === 1 && v.heroes && typeof v.heroes === 'object') {
      s.migrated = v.migrated === true; s.attrScale = v.attrScale === 2 ? 2 : 1;
      s.firstClears = Array.isArray(v.firstClears) ? [...new Set((v.firstClears as unknown[]).filter((k): k is string => typeof k === 'string' && /^[a-z]+-\d$/.test(k)))].slice(0, 60) : [];
      for (const [k, r] of Object.entries(v.heroes as Record<string, Partial<HeroRecord>>)) {
        if (!isKey(k) || !r) continue;
        const attributes = zeroAttrs(); for (const a of ATTRS) attributes[a] = int(r.attributes?.[a], ATTRIBUTE_MAX);
        s.heroes[k] = { level: int(r.level, LEVEL_CAPS[LEVEL_CAPS.length - 1], 1), xp: int(r.xp, 1e8), attributes };
      }
    }
  } catch { s = { version: 1, heroes: {}, migrated: false, firstClears: [], attrScale: 2 }; }
  memory = s;
  // 属性点改版：旧记录已加的点 ×2（每点效果减半，换算后强度不变），单项最多 8；可用点按新规则（每级 1 点）重算
  if (s.attrScale !== 2) { for (const r of Object.values(s.heroes)) for (const a of ATTRS) r.attributes[a] = Math.min(ATTRIBUTE_MAX, r.attributes[a] * 2); s.attrScale = 2; commit(); }
  if (!s.migrated) migrate(s);
  return s;
}
function commit(): void { try { if (memory) localStorage.setItem(HEROES_KEY, JSON.stringify(memory)); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用：保留在内存 */ } }
export function resetHeroCache(): void { memory = null; }

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

/** 按当前上限消化存着的经验（开新章后补升）。返回是否有变化。 */
function settle(r: HeroRecord): boolean {
  const cap = levelCap(); let changed = false;
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
export function allocateHeroAttr(id: HeroKey, attr: AttributeId): boolean {
  if (heroFreePoints(id) <= 0) return false;
  const r = record(id, true); if (r.attributes[attr] >= ATTRIBUTE_MAX) return false;
  r.attributes[attr]++; commit(); return true;
}
/**
 * 主线关首次通关经验（平衡会话实测后提议、用户批准）：一章每关 120、二章 250，之后每章 +130（380 / 510 / 640）。
 * 关卡键同马厩赠马：huangjin-N / hulao-N / third-N / guandu-N / chibi-N。每个存档每关只给一次（任何武将打通都算）。
 */
export const FIRST_CLEAR_XP: Record<string, number> = { huangjin: 120, hulao: 250, third: 380, guandu: 510, chibi: 640 };
export function claimFirstClear(stageKey: string | null): number {
  const chapter = stageKey?.match(/^([a-z]+)-\d$/)?.[1], xp = chapter ? FIRST_CLEAR_XP[chapter] ?? 0 : 0;
  if (!xp || !stageKey) return 0;
  const s = read(); if (s.firstClears.includes(stageKey)) return 0;
  s.firstClears.push(stageKey); commit(); return xp;
}
export interface XpResult { from: number; to: number; gained: number; capped: boolean; cap: number }
/** 结算记经验（已按来源折算好的数值）。到上限后经验存着。 */
export function creditHeroXp(id: HeroKey, amount: number): XpResult {
  const r = record(id, true), from = r.level, cap = levelCap();
  r.xp = Math.min(1e8, r.xp + Math.max(0, Math.round(amount)));
  settle(r); commit();
  return { from, to: r.level, gained: Math.max(0, Math.round(amount)), capped: r.level >= cap, cap };
}
