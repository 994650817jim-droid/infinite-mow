import { CHARACTERS, type CharacterId } from '../data/characters';
import { STARTER_HEROES } from '../data/heroUnlocks';
import { isChapterTestRun, chapterOneCleared } from './ChapterProgress';
import { arcStages, arcUnlocked, lubuClears, type WarlordArc } from '../world/WorldStore';
import { surrenderedIds } from './SurrenderStore';

/**
 * 可玩武将解锁（设计稿 hero-unlock-design.md，用户 2026-11-19 批准）：
 * - 账号解锁（跨存档，键 im_hero_unlocks_v1，不在存档位里，同成就）：解锁后新存档可选作主公、武将谱完整显示、招贤馆可出。
 * - 本档来投：同一节点，若天下已开放（人才库生效）就免费直接进本档麾下（RosterStore.grantHero，一档一次，旗标 hero_joined_<id>）。
 * - 判定只看存档进度（通关几关 / 挑战胜场 / 剧情旗标），不看卷轴是否播放：剧情关掉、跳过、直接出征都照样解锁，老存档走过的节点自动补上。
 * - 开发测试（?dev=1）默认全解锁；?unlock=real 看真实锁定。
 * 以后支线势力 / 新武将：在 UNLOCK_RULES 里加一条（进度里可再接 攻下势力 / 招降首领），HERO_JOIN 写揭幕文案即可。
 */
export const HERO_UNLOCK_KEY = 'im_hero_unlocks_v1';
interface UnlockSave { version: 1; unlocked: CharacterId[]; seen: CharacterId[] }

/** 判定用的存档进度（测试可整份注入）。 */
export interface UnlockProgress {
  /** 第一章通关。 */ ch1: boolean;
  /** 篇章已通关几关。 */ arc: (a: WarlordArc) => number;
  /** 篇章是否已开放。 */ arcOpen: (a: WarlordArc) => boolean;
  /** 天下地图挑战「三英战吕布」胜场。 */ lubu: number;
  /** 剧情旗标（本存档）。 */ flag: (k: string) => unknown;
  /** 其他势力支线（other-factions-design §1.3）：这位首领本存档劝降过没（支线各关 / 三英战吕布挑战关都算）。P2 新可玩武将（吕布、张辽、周瑜、太史慈、曹操）的来投条件读它。 */
  persuaded?: (bossId: string) => boolean;
}
const isHero = (v: unknown): v is CharacterId => typeof v === 'string' && CHARACTERS.some(c => c.id === v);
const readJson = <T,>(k: string, fb: T): T => { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return v ?? fb; } catch { return fb; } };
const storyFlagOf = (k: string): unknown => readJson<{ flags?: Record<string, unknown> }>('im_story_v1', {}).flags?.[k];
export function realProgress(): UnlockProgress {
  return { ch1: chapterOneCleared(), arc: a => arcStages(a), arcOpen: a => arcUnlocked(a), lubu: lubuClears(), flag: storyFlagOf, persuaded: id => surrenderedIds().includes(id) };
}

/** 每位锁定武将的来投条件（主节点 || 保底）；没列的就是开局可玩。 */
export const UNLOCK_RULES: Readonly<Partial<Record<CharacterId, (p: UnlockProgress) => boolean>>> = {
  zhuge: p => p.ch1,                                                          // 第一章通关：卧龙书信
  diaochan: p => p.arc('qunxiong') >= 3 || p.lubu > 0,                         // 打完吕布：第三章白门楼 / 三英战吕布，先到先来
  huangyueying: p => p.arc('chibi') >= 2,                                     // 5-2 赤壁之后
  sunshangxiang: p => p.arc('chibi') >= 3,                                    // 5-3 江陵后孙刘联姻
  weiyan: p => p.arc('jingnan') >= 3,                                         // 6-3 魏延献城（去留两个选项都留下）
  huangzhong: p => (p.arc('jingnan') >= 3 && !!p.flag('spared_huangzhong')) || p.arcOpen('hanzhong') || p.arc('hanzhong') >= 1, // 长沙放过 → 当场；打死 → 负伤遁去，第八章开放前伤愈来投
  pangtong: p => p.arc('shu') >= 1,                                           // 7-1 葭萌关（落凤坡之前）
  machao: p => p.arc('shu') >= 3 || p.arc('hanzhong') >= 1,
  lvbu: p => !!p.persuaded?.('lubu'),                                         // P2：劝降吕布（下邳支线白门楼，或三英战吕布挑战）                   // 7-3 成都；保底第八章
  zhangliao: p => !!p.persuaded?.('zhangliao'),                               // P2：劝降张辽（下邳支线白门楼）
};
/** 黄忠走的是不是保底（长沙没放过）——揭幕换文案。 */
export function joinedByFallback(id: CharacterId, p: UnlockProgress = realProgress()): boolean { return id === 'huangzhong' && !p.flag('spared_huangzhong'); }

/** 开发测试默认全解锁（?unlock=real 看真实锁定）。 */
export function unlockDev(): boolean {
  if (!isChapterTestRun()) return false;
  try { return new URLSearchParams(window.location.search).get('unlock') !== 'real'; } catch { return true; }
}
/** 测试 / 开发面板：强制全解锁（不写存档）。 */
export function setUnlockAll(on: boolean): void { (globalThis as Record<string, unknown>).__IM_UNLOCK_ALL = on; }
const forcedAll = (): boolean => !!(globalThis as Record<string, unknown>).__IM_UNLOCK_ALL;

function read(): UnlockSave | null {
  const v = readJson<Partial<UnlockSave> | null>(HERO_UNLOCK_KEY, null); if (!v) return null;
  return { version: 1, unlocked: (Array.isArray(v.unlocked) ? v.unlocked : []).filter(isHero), seen: (Array.isArray(v.seen) ? v.seen : []).filter(isHero) };
}
function write(s: UnlockSave): void { try { localStorage.setItem(HERO_UNLOCK_KEY, JSON.stringify(s)); } catch { /* 存储被禁：本次会话里照常判定 */ } }

/**
 * 老存档补齐（第一次读到没有解锁存档时）：本档主公、人才库里已在麾下的、练过级的、成就里用过的武将，以及按进度已满足条件的，都算已解锁且已看过揭幕
 * （不弹一串揭幕）。保证当前主公永远是解锁的。
 */
function backfill(): UnlockSave {
  const have = new Set<CharacterId>(STARTER_HEROES);
  const roster = readJson<{ lord?: unknown; owned?: Array<{ hero?: unknown }> }>('im_roster_v1', {});
  if (isHero(roster.lord)) have.add(roster.lord);
  for (const r of roster.owned ?? []) if (isHero(r?.hero)) have.add(r.hero);
  const heroes = readJson<{ heroes?: Record<string, { level?: number; xp?: number }> }>('im_heroes_v1', {}).heroes ?? {};
  for (const [k, r] of Object.entries(heroes)) if (isHero(k) && ((r?.level ?? 1) > 1 || (r?.xp ?? 0) > 0)) have.add(k);
  const ach = readJson<{ heroes?: unknown[] }>('im_achievements', {}).heroes ?? [];
  for (const h of ach) if (isHero(h)) have.add(h);
  try { const last = localStorage.getItem('im_last_hero'); if (isHero(last)) have.add(last); } catch { /* */ }
  const p = realProgress();
  for (const [id, rule] of Object.entries(UNLOCK_RULES)) if (isHero(id) && rule?.(p)) have.add(id);
  const s: UnlockSave = { version: 1, unlocked: [...have], seen: [...have] }; write(s); return s;
}
const load = (): UnlockSave => read() ?? backfill();

/** 这位武将可玩了没（开局四人、账号已解锁、开发全解锁）。 */
export function heroUnlocked(id: CharacterId | string): boolean {
  if ((STARTER_HEROES as readonly string[]).includes(id) || unlockDev() || forcedAll()) return true;
  return isHero(id) && load().unlocked.includes(id);
}
export function lockedHeroes(): CharacterId[] { return CHARACTERS.map(c => c.id).filter(id => !heroUnlocked(id)); }

/**
 * 按进度补查（每次关卡告捷、进天下地图 / 主菜单 / 营寨时调）：新满足条件的写进账号解锁、待揭幕；本档没来投的按 grant 免费入麾下。
 * 返回这次新解锁（账号第一次）的武将。grant 由调用方给（RosterStore.grantHero，免得互相引用）。
 */
export function refreshUnlocks(p: UnlockProgress = realProgress(), grant?: (id: CharacterId) => boolean): CharacterId[] {
  if (unlockDev() || forcedAll()) return [];
  const s = load(), fresh: CharacterId[] = [];
  for (const [id, rule] of Object.entries(UNLOCK_RULES)) {
    if (!isHero(id) || !rule?.(p)) continue;
    if (!s.unlocked.includes(id)) { s.unlocked.push(id); fresh.push(id); }
    if (grant && !p.flag('hero_joined_' + id) && grant(id)) markJoined(id);
  }
  if (fresh.length) write(s);
  return fresh;
}
/** 本档已来投（剧情旗标 hero_joined_<id>，存档位内；直接写 im_story_v1，免得引用剧情系统）。 */
function markJoined(id: CharacterId): void {
  try { const v = readJson<{ version?: number; flags?: Record<string, unknown> }>('im_story_v1', {}); const flags = v.flags && typeof v.flags === 'object' ? v.flags : {}; flags['hero_joined_' + id] = true; localStorage.setItem('im_story_v1', JSON.stringify({ version: 1, flags })); } catch { /* */ }
}
/** 还没看过揭幕的（账号层面）。 */
export function pendingReveals(): CharacterId[] { const s = load(); return s.unlocked.filter(id => !s.seen.includes(id) && !(STARTER_HEROES as readonly string[]).includes(id)); }
export function markRevealSeen(id: CharacterId): void { const s = load(); if (!s.seen.includes(id)) { s.seen.push(id); write(s); } }
/** 测试 / 开发：清掉解锁存档（下次读时重新补齐）。 */
export function resetUnlocks(toStarters = false): void {
  try { if (toStarters) localStorage.setItem(HERO_UNLOCK_KEY, JSON.stringify({ version: 1, unlocked: [...STARTER_HEROES], seen: [...STARTER_HEROES] })); else localStorage.removeItem(HERO_UNLOCK_KEY); } catch { /* */ }
}
