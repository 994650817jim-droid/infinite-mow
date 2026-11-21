import { CHARACTERS, getCharacter, type CharacterId } from '../data/characters';
import { QUALITY_ORDER, type ItemQuality } from '../data/items';
import { FOLLOW, FOLLOWER_LEVEL, HERO_TEMPLATE, RANK, RECRUIT, TEMPLATE_ORDER, commonName, followerLevelCapFor, type FollowerTemplate, type RecruitKind } from '../data/recruits';
import { chaptersOpen, clampHeroLevel, hasHeroRecord, heroLevel, type HeroKey } from './HeroProgress';
import { BOUNTY_GENERALS, seasonIndex } from '../world/WorldIntel';
import { MAJOR_FACTIONS, type FactionId } from '../world/WorldCities';
import { loadWorld, spendWorld, townUpgrade, worldUnlocked } from '../world/WorldStore';
import { TOWN_BUILDINGS, levelOf, type TownBuildingId } from '../town/TownData';
import { loadItems, loadout, resetItemCache, unequipSlot, type GearOwner } from './ItemStore';
import { isChapterTestRun } from './ChapterProgress';
import { SURRENDER, recruitableName } from '../data/surrender';
import { activeValue, passiveValue } from '../data/commonerSkills';
import { heroUnlocked } from './HeroUnlocks';
import { STARTER_HEROES, LOCKED_HINT as UNJOINED_HINT } from '../data/heroUnlocks';

/**
 * 人才库与已招武将（RECRUIT_PLAN.md，用户选 A 方案）：独立存档键 im_roster_v1（在 SaveSlots.PROGRESS_KEYS 里，随存档位切换）。
 * 天下开放前不限制选将；开放那一刻出征的武将定为主公，其余可玩名将要在招贤馆招募。
 * 不做内存缓存：每次从 localStorage 读，存档位切换后自然生效。
 */
export const ROSTER_KEY = 'im_roster_v1';
export type RankLine = 'weapon' | 'passive';
/** boss：首领降将的首领 id（招降系统 surrender-spec；同阵营降将在队、已在麾下不再弹劝降窗用）。 */
export interface Recruit { id: string; kind: RecruitKind; hero?: CharacterId; name: string; template: FollowerTemplate; quality: ItemQuality; rank: number; picks: RankLine[]; faction?: FactionId; boss?: string }
export interface Offer { kind: RecruitKind; hero?: CharacterId; name: string; template: FollowerTemplate; quality: ItemQuality; cost: number; faction?: FactionId; expires?: number; boss?: string }
export interface RosterSave {
  version: 1; lord: CharacterId | null; owned: Recruit[]; followers: string[];
  /** 主公已最终确定（开新存档时选定，或老存档在提示里确认 / 改选过一次）。false = 老存档自动指定，还有一次改选机会。 */
  lordFinal: boolean;
  offers: Offer[]; captives: Offer[]; season: number; manual: number; dry: number; seq: number; hall: number;
  /** 开局四人（刘关张赵）已默认招进麾下（新存档一次；之后遣散了也不再补）。 */
  starters?: boolean;
}

const RANDOM_KEY = '__im_roster_random';
/** 测试注入随机数。 */
export function setRosterRandom(f?: () => number): void { (globalThis as Record<string, unknown>)[RANDOM_KEY] = f; }
const rand = (): number => { const f = (globalThis as Record<string, unknown>)[RANDOM_KEY]; return typeof f === 'function' ? (f as () => number)() : Math.random(); };
const pick = <T,>(a: readonly T[]): T => a[Math.min(a.length - 1, Math.floor(rand() * a.length))];

const isHero = (v: unknown): v is CharacterId => typeof v === 'string' && CHARACTERS.some(c => c.id === v);
const isTemplate = (v: unknown): v is FollowerTemplate => typeof v === 'string' && (TEMPLATE_ORDER as readonly string[]).includes(v);
const isQuality = (v: unknown): v is ItemQuality => typeof v === 'string' && (QUALITY_ORDER as readonly string[]).includes(v);
const isKind = (v: unknown): v is RecruitKind => v === 'hero' || v === 'named' || v === 'common';
const isFaction = (v: unknown): v is FactionId => typeof v === 'string' && (MAJOR_FACTIONS as readonly string[]).includes(v);
const int = (v: unknown, max: number, min = 0): number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max ? v as number : min;
const str = (v: unknown, max = 24): string | null => typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;

function heroRecruit(hero: CharacterId): Recruit { return { id: hero, kind: 'hero', hero, name: getCharacter(hero).name, template: HERO_TEMPLATE[hero], quality: 'orange', rank: 1, picks: [] }; }

function parseRecruit(v: unknown): Recruit | null {
  const r = v as Record<string, unknown>; if (!r || !isKind(r.kind)) return null;
  if (r.kind === 'hero') { if (!isHero(r.hero)) return null; const h = heroRecruit(r.hero); h.rank = int(r.rank, RANK.max, 1); h.picks = parsePicks(r.picks, h.rank); return h; }
  const id = str(r.id, 16), name = str(r.name); if (!id || !/^r_\d+$/.test(id) || !name || !isTemplate(r.template) || !isQuality(r.quality)) return null;
  const rank = int(r.rank, RANK.max, 1);
  return { id, kind: r.kind, name, template: r.template, quality: r.quality, rank, picks: parsePicks(r.picks, rank), faction: isFaction(r.faction) ? r.faction : undefined, boss: str(r.boss, 24) ?? undefined };
}
function parsePicks(v: unknown, rank: number): RankLine[] { return Array.isArray(v) ? v.filter((x): x is RankLine => x === 'weapon' || x === 'passive').slice(0, rank - 1) : []; }
function parseOffer(v: unknown): Offer | null {
  const o = v as Record<string, unknown>; if (!o || !isKind(o.kind)) return null;
  const name = str(o.name); if (!name || !isTemplate(o.template) || !isQuality(o.quality)) return null;
  if (o.kind === 'hero' && !isHero(o.hero)) return null;
  return { kind: o.kind, hero: o.kind === 'hero' ? o.hero as CharacterId : undefined, name, template: o.template, quality: o.quality, cost: int(o.cost, 100000), faction: isFaction(o.faction) ? o.faction : undefined, expires: Number.isSafeInteger(o.expires) ? o.expires as number : undefined, boss: str(o.boss, 24) ?? undefined };
}

const empty = (): RosterSave => ({ version: 1, lord: null, lordFinal: false, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 });

function read(): RosterSave | null {
  try {
    const raw = localStorage.getItem(ROSTER_KEY); if (!raw) return null;
    const v = JSON.parse(raw); if (!v || v.version !== 1) return null;
    const s = empty();
    s.lord = isHero(v.lord) ? v.lord : null; s.lordFinal = !!s.lord && v.lordFinal === true; s.starters = v.starters === true;
    const seen = new Set<string>();
    for (const r of Array.isArray(v.owned) ? v.owned.slice(0, RECRUIT.maxOwned + 5) : []) { const p = parseRecruit(r); if (p && !seen.has(p.id)) { seen.add(p.id); s.owned.push(p); } }
    if (s.lord && !seen.has(s.lord)) s.owned.unshift(heroRecruit(s.lord));
    // 2026-11-18 用户「主公不应该在这里」：主公不是随行，老存档里被点成随行的去掉
    s.followers = Array.isArray(v.followers) ? [...new Set((v.followers as unknown[]).filter((x): x is string => typeof x === 'string' && seen.has(x) && !(s.lord && s.owned.some(r => r.id === x && r.hero === s.lord))))].slice(0, 3) : [];
    s.offers = (Array.isArray(v.offers) ? v.offers : []).map(parseOffer).filter((o: Offer | null): o is Offer => !!o).slice(0, 6);
    s.captives = (Array.isArray(v.captives) ? v.captives : []).map(parseOffer).filter((o: Offer | null): o is Offer => !!o).slice(0, SURRENDER.captiveSlots);
    s.season = Number.isSafeInteger(v.season) ? v.season : -1; s.manual = int(v.manual, 999); s.dry = int(v.dry, 999); s.seq = int(v.seq, 1e9); s.hall = int(v.hall, 3, 1);
    return s;
  } catch { return null; }
}
function write(s: RosterSave): void {
  try { localStorage.setItem(ROSTER_KEY, JSON.stringify(s)); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用 */ }
}
function lastHero(): CharacterId { try { const v = localStorage.getItem('im_last_hero'); if (isHero(v)) return v; } catch { /* */ } return 'zhaoyun'; }

/** 天下首次开放（WorldStore 结算时调用）：只送主公一人。已有人才库时不动。 */
export function rosterFreshUnlock(): void {
  if (read()) return;
  const s = empty(); s.lord = lastHero(); s.owned = [heroRecruit(s.lord)]; write(s);
}

/** 老存档（天下已开放但还没有人才库）：主公 + 行囊里穿过装备的 + 打赢过仗的武将（用过的不收回）。 */
function migrate(): RosterSave {
  const s = empty(); s.lord = lastHero(); s.owned = [heroRecruit(s.lord)];
  const keep = new Set<CharacterId>();
  try { const items = loadItems(); for (const [hero, slots] of Object.entries(items.loadouts)) if (isHero(hero) && slots && Object.keys(slots).length) keep.add(hero); } catch { /* 行囊不可读 */ }
  // 旧版行囊（im_items_v1，迁移后仍留在本地）：只穿过兵刃 / 坐骑的武将，兵刃转成旧物后新行囊里已看不出来
  try { const old = JSON.parse(localStorage.getItem('im_items_v1') ?? 'null'); for (const [hero, slots] of Object.entries((old?.loadouts ?? {}) as Record<string, unknown>)) if (isHero(hero) && slots && typeof slots === 'object' && Object.keys(slots).length) keep.add(hero); } catch { /* 旧行囊不可读 */ }
  // 用过的武将不收回：成就存档记着每位打赢过一场的武将（im_achievements.heroes）
  try { const a = JSON.parse(localStorage.getItem('im_achievements') ?? 'null'); if (Array.isArray(a?.heroes)) for (const h of a.heroes) if (isHero(h)) keep.add(h); } catch { /* 成就不可读 */ }
  for (const h of CHARACTERS.map(c => c.id)) if (h !== s.lord && keep.has(h)) s.owned.push(heroRecruit(h));
  write(s); return s;
}

/** 人才库是否生效：天下开放后；开发测试（?dev=1）默认不限制，带 ?roster=1 时照常限制。 */
export function rosterEnforced(): boolean {
  if (!worldUnlocked()) return false;
  if (!isChapterTestRun()) return true;
  try { return new URLSearchParams(window.location.search).get('roster') === '1'; } catch { return false; }
}

/** 读人才库（天下开放后才有意义）；换季时自动刷新招贤馆、清掉过期降将。 */
export function loadRoster(): RosterSave {
  if (!worldUnlocked()) return empty();
  let s = read() ?? migrate();
  clampFollowerLevels(s);
  // 可玩武将改在「名将」页直接招募：席位里不再挂可玩武将（老档挂着的一并撤牌）
  { const n = s.offers.length; s.offers = s.offers.filter(o => !o.hero); if (s.offers.length !== n) write(s); }
  // 开局四人（刘关张赵）新存档默认已招、互为随从（随行名额内）
  if (!s.starters) { s.starters = true; for (const h of STARTER_HEROES) if (!s.owned.some(r => r.hero === h)) s.owned.push(heroRecruit(h)); const cap = followerCap(s); for (const r of s.owned) if (r.hero && r.hero !== s.lord && (STARTER_HEROES as readonly string[]).includes(r.hero) && s.followers.length < cap && !s.followers.includes(r.id)) s.followers.push(r.id); write(s); }
  const now = currentSeason();
  if (s.season !== now) {
    s.captives = s.captives.filter(o => (o.expires ?? now) > now);
    rollOffers(s); s.season = now; s.manual = 0; write(s);
  }
  return s;
}
function currentSeason(): number { try { return seasonIndex(loadWorld().town); } catch { return 0; } }

/** 能不能当主将出战：主公规则生效且已有主公时只有主公；新存档还没选时都能选（这一步就是择主公）。 */
export function heroOwned(hero: CharacterId): boolean { if (!heroUnlocked(hero)) return false; /* 还没来投（systems/HeroUnlocks） */ if (!lordRules()) return true; const lord = lordHero(); return !lord || lord === hero; }
/** 可选作主将的武将（天下开放前为全部）。 */
export function ownedHeroes(): CharacterId[] { return CHARACTERS.map(c => c.id).filter(id => heroOwned(id)); }
/** 选将面板的默认武将：上次出战的若未拥有，换成主公。 */
export function defaultHero(saved: string | null | undefined): CharacterId {
  const lord = lordRules() ? lordHero() : null; if (lord) return lord;
  return isHero(saved) ? saved : 'zhaoyun';
}
export const LOCKED_HINT = '主将已定，本存档不可更换';

// ———— 随行等级上限（用户 2026-11-17「随从等级一开始不要这么高，随着章节解锁提升」） ————

/** 主公的等级只随征战（自己出战的经验）提升，不能在招贤馆 / 随行系统里升级。 */
export const LORD_LEVEL_HINT = '主公等级随征战提升';
const isLordRecruit = (s: RosterSave, r: Recruit): boolean => !!r.hero && r.hero === s.lord;
/** 麾下（招贤馆「麾下」页、讲武堂「随从操练」、随行候选）：不含主公本人（2026-11-18 用户「主公不应该在这里」）。 */
export function rosterFollowers(s: RosterSave = loadRoster()): Recruit[] { return s.owned.filter(r => !isLordRecruit(s, r)); }
/** 当前章节下随行的等级上限（第一章 5 级，每开一章 +5，见 FOLLOWER_LEVEL）。 */
export function followerLevelCap(): number { return followerLevelCapFor(chaptersOpen()); }
/** 随行的实际等级（不超过随行上限；主公返回自己的武将等级）。 */
export function followerLevel(r: Recruit, s: RosterSave | null = null): number {
  const lv = heroLevel((r.hero ?? r.id) as HeroKey); if (r.hero && r.hero === (s ?? read())?.lord) return lv;
  return Math.min(lv, followerLevelCap());
}
/** 读档时把超上限的随行压到上限（开发期不兼容旧档，直接压；主公不压）。 */
function clampFollowerLevels(s: RosterSave): void {
  const cap = followerLevelCap();
  for (const r of s.owned) { if (isLordRecruit(s, r)) continue; const key = (r.hero ?? r.id) as HeroKey; if (heroLevel(key) > cap) clampHeroLevel(key, cap); }
}

// ———— 主公（用户规则 2026-11-16：每个存档开局选定主公，之后整个存档不能更换） ————

/** 主公规则是否生效：正式游玩生效；开发测试（?dev=1）不限制，带 ?roster=1 时照常限制。 */
export function lordRules(): boolean {
  if (!isChapterTestRun()) return true;
  try { return new URLSearchParams(window.location.search).get('roster') === '1'; } catch { return false; }
}
/** 本存档的主公（天下开放前也可读）；没有则为 null（新存档还没选）。 */
export function lordHero(): CharacterId | null { return read()?.lord ?? null; }
export function lordFinal(): boolean { return read()?.lordFinal === true; }
/** 选将界面能不能选这名武将当主公：还没主公、或老存档还有一次改选机会时都能选；主公已定后只有主公本人。 */
export function canPickLord(hero: CharacterId): boolean { if (!heroUnlocked(hero)) return false; if (!lordRules()) return true; const s = read(); return !s?.lord || !s.lordFinal || s.lord === hero; }
/** 定下主公（最终确定）。已最终确定时不能再改（测试模式除外）。 */
export function setLord(hero: CharacterId): RosterResult {
  if (!isHero(hero)) return { ok: false, message: '无效武将' };
  const s = read() ?? empty();
  if (lordRules() && s.lord && s.lordFinal && s.lord !== hero) return { ok: false, message: LOCKED_HINT };
  s.lord = hero; s.lordFinal = true;
  if (!s.owned.some(r => r.hero === hero)) s.owned.unshift(heroRecruit(hero));
  s.followers = s.followers.filter(id => id !== hero);
  write(s); try { localStorage.setItem('im_last_hero', hero); } catch { /* */ }
  return { ok: true, message: `主公定为 ${getCharacter(hero).name}` };
}
/** 老存档保持自动指定的主公（用掉改选机会）。 */
export function confirmLord(): void { const s = read(); if (s?.lord && !s.lordFinal) { s.lordFinal = true; write(s); } }
/** 存档里有没有进度（用来区分「新存档」和「主公规则之前的老存档」）。 */
function hasProgress(): boolean {
  try { return !!(localStorage.getItem('im_last_hero') || localStorage.getItem('im_world_v1') || localStorage.getItem('im_heroes_v1')); } catch { return false; }
}
/** 老存档还没有主公时自动指定：最近一次出战的武将，其次武将等级最高的，再其次赵云；留一次改选机会（lordFinal = false）。返回是否刚指定。 */
export function ensureLegacyLord(): boolean {
  if (!lordRules() || read()?.lord || !hasProgress()) return false;
  if (worldUnlocked()) { loadRoster(); return !!read()?.lord; } // 天下已开：走原来的人才库迁移（保留用过的武将），主公 = 最近出战的武将
  let hero: CharacterId | null = null;
  try { const v = localStorage.getItem('im_last_hero'); if (isHero(v)) hero = v; } catch { /* */ }
  if (!hero) try { const h = JSON.parse(localStorage.getItem('im_heroes_v1') ?? 'null')?.heroes ?? {}; let best = 0; for (const [k, r] of Object.entries(h as Record<string, { level?: number }>)) if (isHero(k) && (r?.level ?? 0) > best) { best = r.level ?? 0; hero = k; } } catch { /* */ }
  const s = read() ?? empty(); s.lord = hero ?? 'zhaoyun'; s.lordFinal = false; if (!s.owned.some(r => r.hero === s.lord)) s.owned.unshift(heroRecruit(s.lord)); write(s);
  return true;
}
/** 行囊里可以换装的人：天下开放前为全部可玩武将；之后为麾下所有武将（含招来的 r_ 编号）。 */
export function gearOwners(): Array<{ id: GearOwner; name: string }> {
  if (!rosterEnforced()) { const lord = lordRules() ? lordHero() : null; return (lord ? CHARACTERS.filter(c => c.id === lord) : CHARACTERS.filter(c => heroUnlocked(c.id))).map(c => ({ id: c.id, name: c.name })); }
  return loadRoster().owned.map(r => ({ id: (r.hero ?? r.id) as GearOwner, name: r.name.replace(/（.*）/, '') }));
}
/** 武将显示名（含招来的人）。 */
export function ownerName(id: string | undefined): string {
  if (!id) return ''; const c = CHARACTERS.find(x => x.id === id); if (c) return c.name;
  const r = read()?.owned.find(x => x.id === id); return r ? r.name.replace(/（.*）/, '') : '';
}

// ———— 招贤馆 ————

/**
 * 招贤馆等级：营寨建筑表里有 'talent'（主城与经济会话）时读营寨等级，0 = 还没建；
 * 没有时用旧的 RosterSave.hall（1–3，在招贤馆界面里花军粮升级）。
 */
function townHall(): number | null {
  try { if (!('talent' in TOWN_BUILDINGS)) return null; return levelOf(loadWorld().town, 'talent' as string as TownBuildingId); } catch { return null; }
}
export function hallInTown(): boolean { return townHall() !== null; }
/** 营寨有招贤馆时与 WorldStore.talentLevel() 一致：限制在 1–3（营寨起就有、Lv1 免费，老存档由营寨读档时从 im_roster_v1.hall 读入一次）。 */
export function hallLevel(s: RosterSave = loadRoster()): number { const t = townHall(); return t === null ? s.hall : Math.max(1, Math.min(RECRUIT.seats.length, t)); }
/** 各表的下标（0 级按 1 级算，用于随行上限等不该归零的项）。 */
const hallIdx = (s: RosterSave): number => Math.max(1, hallLevel(s)) - 1;
/** 旧存档里在招贤馆界面升过的等级（给营寨迁移用：talent 设为 max(1, 它)）。 */
export function legacyHallLevel(): number { return read()?.hall ?? 1; }

function unownedHeroes(s: RosterSave): CharacterId[] { return CHARACTERS.map(c => c.id).filter(id => heroUnlocked(id) /* 没来投的不进招贤馆 */ && !s.owned.some(r => r.hero === id) && !s.offers.some(o => o.hero === id) && !s.captives.some(o => o.hero === id)); }
function commonOffer(s: RosterSave): Offer {
  const w = RECRUIT.commonQuality[hallIdx(s)], total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0); let r = rand() * total, q: ItemQuality = 'white';
  for (const k of ['white', 'green', 'blue'] as const) { r -= w[k] ?? 0; if (r < 0) { q = k; break; } }
  return { kind: 'common', name: commonName(rand), template: pick(TEMPLATE_ORDER), quality: q, cost: RECRUIT.cost[q as 'white' | 'green' | 'blue'] };
}
function namedOffer(s: RosterSave): Offer | null {
  const taken = new Set([...s.owned.map(r => r.name), ...s.offers.map(o => o.name), ...s.captives.map(o => o.name)]);
  const pool: Array<[FactionId, string]> = [];
  for (const f of MAJOR_FACTIONS) for (const n of BOUNTY_GENERALS[f] ?? []) if (!taken.has(n) && recruitableName(n)) pool.push([f, n]); // 宁死不降之将不进招贤馆（surrender-rules.md）
  if (!pool.length) return null;
  const [faction, name] = pick(pool);
  return { kind: 'named', name, faction, template: pick(TEMPLATE_ORDER), quality: 'purple', cost: RECRUIT.cost.named };
}
function heroOffer(s: RosterSave): Offer | null { const left = unownedHeroes(s); if (!left.length) return null; const hero = pick(left); return { kind: 'hero', hero, name: getCharacter(hero).name, template: HERO_TEMPLATE[hero], quality: 'orange', cost: RECRUIT.cost.hero }; }

const pityOf = (s: RosterSave): number => RECRUIT.pity[hallIdx(s)];
/** 当前招贤馆等级下的名将出现率（界面用）：每席出名将（史事 + 可玩）的概率、其中可玩名将的概率、保底还差几次（0 = 这一级没有保底）。 */
export function hallOdds(s: RosterSave = loadRoster()): { seat: number; hero: number; pity: number; pityLeft: number } {
  const r = RECRUIT.rates[hallIdx(s)], pity = pityOf(s);
  void pity; return { seat: r.named + r.hero, hero: 0, pity: 0, pityLeft: 0 }; // 可玩武将改在「名将」页直接招募
}
/** 刷新全部席位（自动换季与手动刷新共用），处理保底。 */
function rollOffers(s: RosterSave): void {
  s.offers = [];
  if (hallLevel(s) <= 0) return; // 营寨还没建招贤馆：席位空着
  const seats = RECRUIT.seats[hallIdx(s)], rates = RECRUIT.rates[hallIdx(s)];
  for (let i = 0; i < seats; i++) {
    const r = rand(); let o: Offer | null = null;
    if (r < rates.hero + rates.named) o = namedOffer(s); // 可玩武将不再随机挂牌（改在「名将」页招募），原先那份概率并给史事名将
    s.offers.push(o ?? commonOffer(s));
  }
  const anyLeft = CHARACTERS.some(c => !s.owned.some(r => r.hero === c.id));
  void anyLeft; s.dry = 0; // 可玩武将改为直接招募：不再有「再刷 N 次必出名将」保底
  if (false as boolean) { // 旧保底（保留结构，不再触发）
    s.dry++;
    if (s.dry > pityOf(s)) { const h = heroOffer(s); if (h) { s.offers[s.offers.length - 1] = h; s.dry = 0; } }
  }
}

export interface RosterResult { ok: boolean; message: string }
const NO_HALL: RosterResult = { ok: false, message: '先在营寨建造招贤馆' };
export function refreshCost(s: RosterSave = loadRoster()): number { return RECRUIT.refreshBase + RECRUIT.refreshStep * s.manual; }
export function manualRefresh(): RosterResult {
  if (!worldUnlocked()) return { ok: false, message: '天下开放后才有招贤馆' };
  const s = loadRoster(), cost = refreshCost(s);
  if (hallLevel(s) <= 0) return NO_HALL;
  if (!spendWorld({ provisions: cost })) return { ok: false, message: `军粮不足：刷新需要 ${cost}` };
  s.manual++; rollOffers(s); write(s); return { ok: true, message: `花 ${cost} 军粮，换了一批人才` };
}
export function recruit(index: number, captive = false): RosterResult {
  if (!worldUnlocked()) return { ok: false, message: '天下开放后才有招贤馆' };
  const s = loadRoster(), list = captive ? s.captives : s.offers, o = list[index];
  if (hallLevel(s) <= 0) return NO_HALL;
  if (!o) return { ok: false, message: '这个席位已经空了' };
  if (s.owned.length >= RECRUIT.maxOwned) return { ok: false, message: `麾下已满 ${RECRUIT.maxOwned} 人，先遣散一些` };
  if (o.kind === 'hero' && s.owned.some(r => r.hero === o.hero)) { list.splice(index, 1); write(s); return { ok: false, message: '已在麾下' }; }
  const joinCap = followerLevelCap(), joinLevel = Math.max(1, joinCap - FOLLOWER_LEVEL.joinBelowCap);
  const cost = captive ? Math.ceil(o.cost * RECRUIT.captiveDiscount) : o.cost;
  if (!spendWorld({ provisions: cost })) return { ok: false, message: `军粮不足：招募需要 ${cost}` };
  const r: Recruit = o.kind === 'hero' ? heroRecruit(o.hero!) : { id: 'r_' + (++s.seq), kind: o.kind, name: o.name, template: o.template, quality: o.quality, rank: 1, picks: [], faction: o.faction, boss: o.boss };
  s.owned.push(r); list.splice(index, 1);
  // 新入队的随行定在「随行上限 − 2」级（可玩名将若早有更高的记录，保留但不超过上限）
  { const key = (r.hero ?? r.id) as HeroKey, keep = r.hero && hasHeroRecord(key) ? Math.min(heroLevel(key), joinCap) : 0; clampHeroLevel(key, joinCap, Math.max(joinLevel, keep)); }
  const cap = followerCap(s); if (s.followers.length < cap) s.followers.push(r.id);
  write(s); return { ok: true, message: `${r.name}${captive ? '归降' : '应募'}，花 ${cost} 军粮` };
}
/** 遣散（主公不能遣散）；身上的兵装由行囊在读档时自然失效（loadouts 只认在册的人）。 */
export function dismiss(id: string): RosterResult {
  const s = loadRoster(), i = s.owned.findIndex(r => r.id === id); if (i < 0) return { ok: false, message: '不在麾下' };
  if (s.owned[i].hero && s.owned[i].hero === s.lord) return { ok: false, message: '主公不能遣散' };
  const name = s.owned[i].name, gear = s.owned[i].hero ?? s.owned[i].id;
  // 身上的兵装卸回行囊（道具会话约定用 unequipSlot）
  // 先丢掉行囊的内存缓存，按存档里的实际穿戴来卸（缓存可能比存档旧）
  try { resetItemCache(); for (const slot of Object.keys(loadout(gear as GearOwner))) unequipSlot(gear as GearOwner, slot as never); } catch { /* 行囊不可用 */ }
  s.owned.splice(i, 1); s.followers = s.followers.filter(f => f !== id); write(s); return { ok: true, message: `${name}辞去${gear.startsWith('r_') ? '，兵装已卸回行囊' : ''}` };
}

// ———— 招降 ————

/** 某势力随机一名部将（攻城 / 守城的守将）。 */
export function factionGeneral(faction: FactionId | undefined): string | null { const list = faction ? BOUNTY_GENERALS[faction] : undefined; return list?.length ? pick(list) : null; }
/** 结算面板的一行：俘获提示。 */
export const captureLine = (name: string | null): string => name ? `\n俘获敌将${name} · 两季内可在招贤馆招降` : '';
/** 击败敌将后按概率进入降将栏；返回被俘者名字。测试 / 调试战斗不调用。 */
export function tryCapture(source: keyof typeof RECRUIT.capture, name: string, faction: FactionId | undefined): string | null {
  if (!worldUnlocked() || !name || name === '敌将' || !recruitableName(name)) return null;
  if (rand() >= RECRUIT.capture[source]) return null;
  const s = loadRoster();
  if (s.owned.some(r => r.name === name) || s.captives.some(o => o.name === name)) return null;
  s.captives.push({ kind: 'named', name, faction: isFaction(faction) ? faction : undefined, template: pick(TEMPLATE_ORDER), quality: 'purple', cost: RECRUIT.cost.named, expires: currentSeason() + RECRUIT.captiveSeasons });
  evictCaptives(s); write(s); return name;
}
/**
 * 降将栏 8 格（surrender-spec §7）：栏满时先挤掉最早的普通俘虏；全是首领降将时挤掉最早的首领降将。返回被挤掉的首领降将名字。
 */
function evictCaptives(s: RosterSave): string[] {
  const gone: string[] = [];
  while (s.captives.length > SURRENDER.captiveSlots) {
    const i = s.captives.findIndex(o => !o.boss), k = i >= 0 ? i : 0;
    const [o] = s.captives.splice(k, 1); if (o?.boss) gone.push(o.name);
  }
  return gone;
}
/** 降将还能留几季（降将栏卡片「剩 N 季」）。 */
export function captiveSeasonsLeft(o: Offer): number | null { return o.expires === undefined ? null : Math.max(0, o.expires - currentSeason()); }
/** 这名首领是否已在麾下或降将栏（不再弹劝降窗、不重复招到同一人）。 */
export function bossInRoster(id: string, name: string, hero?: CharacterId): boolean {
  const s = read(); if (!s) return false;
  if (hero) return s.owned.some(r => r.hero === hero);
  return s.owned.some(r => r.boss === id || (!r.hero && r.name === name)) || s.captives.some(o => o.boss === id || o.name === name);
}
/**
 * 首领降将进降将栏：留 4 季、名将价 500（六折招降 = 300 军粮）、橙色、模板按招降表固定。
 * 已在麾下 / 栏里返回 null；evicted = 栏满被挤走的首领降将（结算里提示「久候不至，已离去」）。
 */
export function captureBoss(b: { id: string; name: string; template: FollowerTemplate }): { name: string; evicted: string[] } | null {
  if (!worldUnlocked()) return null; // 招贤馆随天下地图开放（第二章起）；未开放时 loadRoster 是空的，写回会冲掉名册
  const s = loadRoster();
  if (s.owned.some(r => r.boss === b.id || (!r.hero && r.name === b.name)) || s.captives.some(o => o.boss === b.id || o.name === b.name)) return null;
  s.captives.push({ kind: 'named', name: b.name, template: b.template, quality: 'orange', cost: RECRUIT.cost.named, expires: currentSeason() + SURRENDER.bossCaptiveSeasons, boss: b.id });
  const evicted = evictCaptives(s); write(s); return { name: b.name, evicted };
}

/**
 * 第六章「劝降」：敌将当场归降，直接入招贤馆（不花军粮、不占降将栏）；hero = 以可玩武将身份加入（黄忠）。
 * 麾下已满时不加，返回提示。新增内容会话 2026-11-17。
 */
export function joinByPersuasion(name: string, hero?: CharacterId, opts: { boss?: string; template?: FollowerTemplate; quality?: ItemQuality } = {}): RosterResult {
  // 可玩武将（黄忠）劝降成功：只算「解锁可玩」，要当随从得去招贤馆「名将」页招募（2026-11-20）
  if (hero) return { ok: true, message: name + '归附 · 可选为主将；往招贤馆「名将」页招募后才随行' };
  const s = loadRoster();
  if (hero ? s.owned.some(r => r.hero === hero) : s.owned.some(r => r.name === name || (opts.boss && r.boss === opts.boss))) return { ok: true, message: `${name}已在麾下` };
  if (s.owned.length >= RECRUIT.maxOwned) return { ok: false, message: `麾下已满 ${RECRUIT.maxOwned} 人，${name}暂回乡里（遣散一些后再来）` };
  const r: Recruit = hero ? heroRecruit(hero) : { id: 'r_' + (++s.seq), kind: 'named', name, template: opts.template ?? pick(TEMPLATE_ORDER), quality: opts.quality ?? 'purple', rank: 1, picks: [], boss: opts.boss };
  if (opts.boss) s.captives = s.captives.filter(o => o.boss !== opts.boss);
  s.owned.push(r); const cap = followerCap(s); if (s.followers.length < cap) s.followers.push(r.id);
  write(s); return { ok: true, message: `${name}归降 · 已入招贤馆` };
}

// ———— 随行 ————

export function followerCap(s: RosterSave = loadRoster()): number { return RECRUIT.followerCap[hallIdx(s)]; }
/** 设置随行（不含出战主将，按上限截断）。 */
export function setFollowers(ids: string[]): void {
  const s = loadRoster(); s.followers = [...new Set(ids)].filter(id => s.owned.some(r => r.id === id)).slice(0, followerCap(s)); write(s);
}
export function toggleFollower(id: string): RosterResult {
  const s = loadRoster(), r = s.owned.find(x => x.id === id); if (!r) return { ok: false, message: '不在麾下' };
  if (isLordRecruit(s, r)) return { ok: false, message: '主公亲自出征，不作随行' };
  if (s.followers.includes(id)) { s.followers = s.followers.filter(f => f !== id); write(s); return { ok: true, message: `${r.name}留守` }; }
  if (s.followers.length >= followerCap(s)) return { ok: false, message: `随行已满 ${followerCap(s)} 人（升级招贤馆可多带）` };
  s.followers.push(id); write(s); return { ok: true, message: `${r.name}随行` };
}
/** 本局出战的随行武将：去掉主将本人，最多 cap 人。 */
/**
 * 武将来投（systems/HeroUnlocks）：免费直接进本档麾下（不进降将栏、不花军粮），顺手撤掉招贤馆里同一人的挂牌。
 * 天下还没开放（没有人才库）时返回 false——等开放后下次补查再入。已在麾下也算 true。
 */
/** 这位可玩武将在不在本档麾下（主公算在）。 */
export function heroHired(hero: CharacterId, s: RosterSave = loadRoster()): boolean { return s.lord === hero || s.owned.some(r => r.hero === hero); }
/** 招为随从的价（按档次，data/recruits RECRUIT.heroHire；开局四人 0）。 */
export function heroHireCost(hero: CharacterId): number { if ((STARTER_HEROES as readonly string[]).includes(hero)) return 0; const H = RECRUIT.heroHire; return H.highIds.includes(hero) ? H.high : H.base; }
/**
 * 招贤馆「名将」页：把已解锁（可玩）的武将招进麾下当随从（2026-11-20 用户「解锁了不是就能跟随，要去招贤那里招」）。
 * 没解锁 / 已在麾下 / 军粮不够都不招；招到后随行名额有空就直接随行。
 */
export function hireHero(hero: CharacterId): RosterResult {
  if (!worldUnlocked()) return { ok: false, message: '天下尚未开放' };
  const name = getCharacter(hero).name;
  if (!heroUnlocked(hero)) return { ok: false, message: name + ' · ' + UNJOINED_HINT };
  const s = loadRoster(); if (heroHired(hero, s)) return { ok: false, message: name + '已在麾下' };
  if (s.owned.length >= RECRUIT.maxOwned) return { ok: false, message: '麾下已满 ' + RECRUIT.maxOwned + ' 人（遣散一些后再招）' };
  const cost = heroHireCost(hero); if (cost > 0 && !spendWorld({ provisions: cost })) return { ok: false, message: '军粮不足：招募' + name + '需要 ' + cost };
  const s2 = loadRoster(), r = heroRecruit(hero); s2.owned.push(r); if (s2.followers.length < followerCap(s2)) s2.followers.push(r.id);
  // 同 recruit()：新入队定在「随行上限 − 2」级（早有更高的武将等级记录就保留，但不超过上限）
  { const joinCap = followerLevelCap(), joinLevel = Math.max(1, joinCap - FOLLOWER_LEVEL.joinBelowCap), key = hero as HeroKey, keep = hasHeroRecord(key) ? Math.min(heroLevel(key), joinCap) : 0; clampHeroLevel(key, joinCap, Math.max(joinLevel, keep)); }
  write(s2); return { ok: true, message: name + '应募入麾下' + (s2.followers.includes(r.id) ? ' · 已随行' : ' · 可在「麾下」设为随行') + (cost ? ' · 花费 ' + cost + ' 军粮' : '') };
}
export function grantHero(hero: CharacterId): boolean {
  if (!worldUnlocked()) return false;
  const s = loadRoster();
  if (!s.owned.some(r => r.hero === hero)) s.owned.push(heroRecruit(hero));
  s.offers = s.offers.filter(o => o.hero !== hero); s.captives = s.captives.filter(o => o.hero !== hero);
  write(s); return true;
}
export function followersFor(lead: CharacterId): Recruit[] {
  if (!worldUnlocked()) return [];
  const s = loadRoster(); return s.followers.map(id => s.owned.find(r => r.id === id)).filter((r): r is Recruit => !!r && r.hero !== lead).slice(0, followerCap(s));
}

// ———— 招贤馆升级与将阶 ————

export function upgradeHall(): RosterResult {
  // 营寨建筑：转调营寨升级（扣军粮，价目即 RECRUIT.hallUpgrade），只有一套等级
  if (hallInTown()) { if (hallLevel() >= 3) return { ok: false, message: '招贤馆已满级' }; return townUpgrade('talent' as string as TownBuildingId); }
  const s = loadRoster(); if (s.hall >= 3) return { ok: false, message: '招贤馆已满级' };
  const c = RECRUIT.hallUpgrade[s.hall - 1];
  if (!spendWorld({ provisions: c.provisions })) return { ok: false, message: `军粮不足：升级需要 ${c.provisions}` };
  s.hall++; write(s); return { ok: true, message: `招贤馆升到 Lv.${s.hall}：席位 ${RECRUIT.seats[s.hall - 1]}，随行 ${RECRUIT.followerCap[s.hall - 1]} 人` };
}
export function rankCap(s: RosterSave = loadRoster()): number { return RANK.capByHall[hallIdx(s)]; }
export function rankUp(id: string, line: RankLine): RosterResult {
  const s = loadRoster(), r = s.owned.find(x => x.id === id); if (!r) return { ok: false, message: '不在麾下' };
  if (isLordRecruit(s, r)) return { ok: false, message: LORD_LEVEL_HINT }; // 主公不能在随行系统里升级
  if (r.rank >= rankCap(s)) return { ok: false, message: r.rank >= RANK.max ? '将阶已满' : '将阶已到招贤馆上限，升级招贤馆后可继续' };
  const c = RANK.cost(r.rank + 1);
  if (!spendWorld(c)) return { ok: false, message: `军粮不足：升阶需要 ${c.provisions}` };
  r.rank++; r.picks.push(line); write(s); return { ok: true, message: `${r.name}升到将阶 ${r.rank}（${line === 'weapon' ? '兵器' : '被动'}）` };
}
/** 将阶带来的加成：兵器线伤害、被动线生命与攻速；当主将时的开局加成。 */
export function rankBonus(r: Pick<Recruit, 'rank' | 'picks'>): { damage: number; hp: number; haste: number } {
  const w = r.picks.filter(p => p === 'weapon').length, p = r.picks.filter(x => x === 'passive').length;
  return { damage: w * RANK.weaponStep, hp: p * RANK.passiveHp, haste: p * RANK.passiveHaste };
}
/** 讲武堂「随从操练」按钮与说明用（用户 2026-11-17「升级兵器和被动要看到需要多少钱」）：这一线下一阶的花费、是否买得起 / 已满 / 主公，以及升级前后的数值。 */
export interface RankPreview { cost: number; afford: boolean; full: boolean; lord: boolean; capByHall: boolean; before: string; after: string }
export function rankPreview(r: Recruit, line: RankLine, s: RosterSave = loadRoster()): RankPreview {
  const cap = rankCap(s), full = r.rank >= cap, cost = RANK.cost(r.rank + 1).provisions, lord = isLordRecruit(s, r);
  const w = r.picks.filter(p => p === 'weapon').length, p = r.picks.length - w, tpl = !r.hero;
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const text = (w2: number, p2: number) => line === 'weapon'
    ? `伤害 +${pc(w2 * RANK.weaponStep)}${tpl ? ' · ' + activeValue(r.template, w2) : ''}`
    : `生命 +${pc(p2 * RANK.passiveHp)} 攻速 +${pc(p2 * RANK.passiveHaste)}${tpl ? ' · ' + passiveValue(r.template, p2) : ''}`;
  let afford = false; try { afford = loadWorld().provisions >= cost; } catch { /* 存档不可用 */ }
  return { cost, afford, full, lord, capByHall: full && r.rank < RANK.max, before: text(w, p), after: line === 'weapon' ? text(w + 1, p) : text(w, p + 1) };
}
/** 主将的将阶开局加成（未拥有记录时为 0）。 */
export { FOLLOW };
