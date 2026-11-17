import { TACTICS, type TacticId } from '../data/builds';
import { MERIT } from '../data/merit';
import { loadWorld, spendWorld } from '../world/WorldStore';
import { chaptersOpen, heroLevel, resetHeroAttrs, type HeroKey } from './HeroProgress';

/**
 * 武将谱（2026-11-16 用户批准 hero-management-proposal.md 方案 B，并新增「武学残卷」）第一批：
 * - 武学残卷：首领每次击杀 3、主线首通 5、精锐 5% 掉 1、宝箱 20% 掉 1（战斗结算时收入，测试战斗不收）；
 * - 本命淬炼：每位武将 0–5 级，每级本命武器伤害 +4%，花军粮；
 * - 洗点：花军粮（100 × 武将等级），每开放一章第一次免费；
 * - 战法心得：出征前从已解锁的战法里选 2 个，局内出现概率 ×2、开局第一次升级保证一张。
 *   一开始每个流派解锁 1 个，其余花残卷解锁；没解锁的战法局内照样会出，只是不能选为心得（不缩小局内卡池）。
 * 存档键 im_mastery_v1（SaveSlots.PROGRESS_KEYS）。老存档按已通关章节补发残卷。数值为初值，交平衡会话。
 */
export const MASTERY_KEY = 'im_mastery_v1';
export const SCROLL = { boss: 3, firstClear: 5, eliteChance: .05, chestChance: .2, perClearedChapter: 15 } as const;
export const TEMPER = { max: 5, step: .04, cost: [200, 400, 700, 1000, 1500] as readonly number[] } as const;
export const TACTIC_UNLOCK_SCROLLS = 6;
export const RESPEC_GRAIN_PER_LEVEL = 100;
export const XINDE_SLOTS = 2;

interface MasterySave { version: 1; scrolls: number; /** 战功（击杀精英 / 首领获得，讲武堂换残卷）。 */ merit: number; temper: Record<string, number>; xinde: Record<string, TacticId[]>; tactics: TacticId[]; respecFree: Record<string, number>; migrated: boolean }
const TACTIC_IDS = Object.keys(TACTICS) as TacticId[];
/** 起始解锁：每个流派在 TACTICS 里排第一个的战法。 */
export const STARTER_TACTICS: readonly TacticId[] = (() => { const seen = new Set<string>(), out: TacticId[] = []; for (const id of TACTIC_IDS) { const t = TACTICS[id].tag; if (!seen.has(t)) { seen.add(t); out.push(id); } } return out; })();
const int = (v: unknown, max: number) => Number.isSafeInteger(v) ? Math.max(0, Math.min(max, v as number)) : 0;
const isHeroKey = (k: string) => /^r_\d{1,9}$/.test(k) || /^[a-z]{2,20}$/.test(k);

let memory: MasterySave | null = null;
function read(): MasterySave {
  if (memory) return memory;
  let s: MasterySave = { version: 1, scrolls: 0, merit: 0, temper: {}, xinde: {}, tactics: [...STARTER_TACTICS], respecFree: {}, migrated: false };
  try {
    const v = JSON.parse(localStorage.getItem(MASTERY_KEY) ?? 'null');
    if (v && v.version === 1) {
      s.scrolls = int(v.scrolls, 1e6); s.merit = int(v.merit, 1e7); s.migrated = v.migrated === true;
      for (const [k, n] of Object.entries(v.temper ?? {})) if (isHeroKey(k)) s.temper[k] = int(n, TEMPER.max);
      s.tactics = [...new Set([...STARTER_TACTICS, ...(Array.isArray(v.tactics) ? v.tactics : []).filter((t: unknown): t is TacticId => typeof t === 'string' && t in TACTICS)])];
      for (const [k, ids] of Object.entries(v.xinde ?? {})) if (isHeroKey(k) && Array.isArray(ids)) s.xinde[k] = [...new Set(ids.filter((t: unknown): t is TacticId => typeof t === 'string' && s.tactics.includes(t as TacticId)))].slice(0, XINDE_SLOTS);
      for (const [k, n] of Object.entries(v.respecFree ?? {})) if (isHeroKey(k)) s.respecFree[k] = int(n, 9);
    }
  } catch { /* 读不出：按新档 */ }
  memory = s;
  if (!s.migrated) { s.migrated = true; s.scrolls += SCROLL.perClearedChapter * Math.max(0, chaptersOpen() - 1); commit(); }
  return s;
}
function commit(): void { try { if (memory) localStorage.setItem(MASTERY_KEY, JSON.stringify(memory)); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用 */ } }
export function resetMasteryCache(): void { memory = null; }

export interface Result { ok: boolean; message: string }
export function scrolls(): number { return read().scrolls; }
/** 战功（存档货币）。 */
export function merit(): number { return read().merit; }
/** 战斗结算收入战功（测试战斗不调用）。返回现有战功。 */
export function addMerit(n: number): number { const s = read(); const k = Math.max(0, Math.floor(n)); if (k) { s.merit = Math.min(1e7, s.merit + k); commit(); } return s.merit; }
/** 讲武堂：用战功换 count 张武学残卷（每张 MERIT.perScroll 战功）。 */
export function exchangeMerit(count: number): Result {
  const s = read(), n = Math.max(0, Math.floor(count)), cost = n * MERIT.perScroll;
  if (!n) return { ok: false, message: '请选择兑换数量' };
  if (s.merit < cost) return { ok: false, message: `战功不足：需要 ${cost}，现有 ${s.merit}` };
  s.merit -= cost; s.scrolls = Math.min(1e6, s.scrolls + n); commit();
  return { ok: true, message: `兑换武学残卷 ×${n}（战功 −${cost}）` };
}
/** 战斗结算收入残卷（测试战斗不调用）。 */
export function addScrolls(n: number): number { const s = read(); const k = Math.max(0, Math.floor(n)); if (k) { s.scrolls = Math.min(1e6, s.scrolls + k); commit(); } return s.scrolls; }
export function grain(): number { try { return loadWorld().provisions; } catch { return 0; } }

// —— 本命淬炼 ——
export function temperLevel(id: HeroKey): number { return read().temper[id] ?? 0; }
export function temperBonus(id: HeroKey): number { return temperLevel(id) * TEMPER.step; }
export function temperCost(id: HeroKey): number | null { const lv = temperLevel(id); return lv >= TEMPER.max ? null : TEMPER.cost[lv]; }
export function temperUp(id: HeroKey): Result {
  const cost = temperCost(id); if (cost === null) return { ok: false, message: '本命已淬炼至满级' };
  if (!spendWorld({ provisions: cost })) return { ok: false, message: `军粮不足（需要 ${cost}）` };
  const s = read(); s.temper[id] = temperLevel(id) + 1; commit();
  return { ok: true, message: `本命淬炼至 ${s.temper[id]} 级 · 本命伤害 +${Math.round(s.temper[id] * TEMPER.step * 100)}%` };
}

// —— 洗点 ——
/** 洗点花费：本章（按已开放章节数）第一次免费，否则 100 × 等级。 */
export function respecCost(id: HeroKey): number { return read().respecFree[id] === chaptersOpen() ? RESPEC_GRAIN_PER_LEVEL * heroLevel(id) : 0; }
export function respec(id: HeroKey): Result {
  const cost = respecCost(id);
  if (cost > 0 && !spendWorld({ provisions: cost })) return { ok: false, message: `军粮不足（需要 ${cost}）` };
  const s = read(); if (cost === 0) { s.respecFree[id] = chaptersOpen(); commit(); }
  resetHeroAttrs(id);
  return { ok: true, message: cost ? `已洗点 · 花费军粮 ${cost}` : '已洗点（本章首次免费）' };
}

// —— 战法心得 ——
export function tacticUnlocked(t: TacticId): boolean { return read().tactics.includes(t); }
export function unlockTactic(t: TacticId): Result {
  const s = read(); if (s.tactics.includes(t)) return { ok: false, message: '已解锁' };
  if (s.scrolls < TACTIC_UNLOCK_SCROLLS) return { ok: false, message: `武学残卷不足（需要 ${TACTIC_UNLOCK_SCROLLS}）` };
  s.scrolls -= TACTIC_UNLOCK_SCROLLS; s.tactics.push(t); commit();
  return { ok: true, message: `解锁战法「${TACTICS[t].name}」，可选为心得` };
}
export function getXinde(id: HeroKey): TacticId[] { return [...(read().xinde[id] ?? [])]; }
/** 选 / 取消一个心得（最多 2 个，必须已解锁）。 */
export function toggleXinde(id: HeroKey, t: TacticId): Result {
  const s = read(), cur = s.xinde[id] ?? [];
  if (cur.includes(t)) { s.xinde[id] = cur.filter(x => x !== t); commit(); return { ok: true, message: `取消心得「${TACTICS[t].name}」` }; }
  if (!s.tactics.includes(t)) return { ok: false, message: '先解锁这个战法' };
  if (cur.length >= XINDE_SLOTS) return { ok: false, message: `心得最多 ${XINDE_SLOTS} 个，先取消一个` };
  s.xinde[id] = [...cur, t]; commit(); return { ok: true, message: `心得「${TACTICS[t].name}」：局内出现概率 ×2，开局第一次升级必出` };
}
