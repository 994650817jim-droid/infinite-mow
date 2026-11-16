import { CHARACTERS, getCharacter, type CharacterId } from '../data/characters';
import { QUALITY_ORDER, type ItemQuality } from '../data/items';
import { FOLLOW, HERO_TEMPLATE, RANK, RECRUIT, TEMPLATE_ORDER, commonName, type FollowerTemplate, type RecruitKind } from '../data/recruits';
import { BOUNTY_GENERALS, seasonIndex } from '../world/WorldIntel';
import { MAJOR_FACTIONS, type FactionId } from '../world/WorldCities';
import { loadWorld, spendWorld, worldUnlocked } from '../world/WorldStore';
import { loadItems, loadout, unequipSlot, type GearOwner } from './ItemStore';
import { isChapterTestRun } from './ChapterProgress';

/**
 * 人才库与已招武将（RECRUIT_PLAN.md，用户选 A 方案）：独立存档键 im_roster_v1（在 SaveSlots.PROGRESS_KEYS 里，随存档位切换）。
 * 天下开放前不限制选将；开放那一刻出征的武将定为主公，其余可玩名将要在招贤馆招募。
 * 不做内存缓存：每次从 localStorage 读，存档位切换后自然生效。
 */
export const ROSTER_KEY = 'im_roster_v1';
export type RankLine = 'weapon' | 'passive';
export interface Recruit { id: string; kind: RecruitKind; hero?: CharacterId; name: string; template: FollowerTemplate; quality: ItemQuality; rank: number; picks: RankLine[]; faction?: FactionId }
export interface Offer { kind: RecruitKind; hero?: CharacterId; name: string; template: FollowerTemplate; quality: ItemQuality; cost: number; faction?: FactionId; expires?: number }
export interface RosterSave {
  version: 1; lord: CharacterId | null; owned: Recruit[]; followers: string[];
  offers: Offer[]; captives: Offer[]; season: number; manual: number; dry: number; seq: number; hall: number;
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
  return { id, kind: r.kind, name, template: r.template, quality: r.quality, rank, picks: parsePicks(r.picks, rank), faction: isFaction(r.faction) ? r.faction : undefined };
}
function parsePicks(v: unknown, rank: number): RankLine[] { return Array.isArray(v) ? v.filter((x): x is RankLine => x === 'weapon' || x === 'passive').slice(0, rank - 1) : []; }
function parseOffer(v: unknown): Offer | null {
  const o = v as Record<string, unknown>; if (!o || !isKind(o.kind)) return null;
  const name = str(o.name); if (!name || !isTemplate(o.template) || !isQuality(o.quality)) return null;
  if (o.kind === 'hero' && !isHero(o.hero)) return null;
  return { kind: o.kind, hero: o.kind === 'hero' ? o.hero as CharacterId : undefined, name, template: o.template, quality: o.quality, cost: int(o.cost, 100000), faction: isFaction(o.faction) ? o.faction : undefined, expires: Number.isSafeInteger(o.expires) ? o.expires as number : undefined };
}

const empty = (): RosterSave => ({ version: 1, lord: null, owned: [], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 1 });

function read(): RosterSave | null {
  try {
    const raw = localStorage.getItem(ROSTER_KEY); if (!raw) return null;
    const v = JSON.parse(raw); if (!v || v.version !== 1) return null;
    const s = empty();
    s.lord = isHero(v.lord) ? v.lord : null;
    const seen = new Set<string>();
    for (const r of Array.isArray(v.owned) ? v.owned.slice(0, RECRUIT.maxOwned + 5) : []) { const p = parseRecruit(r); if (p && !seen.has(p.id)) { seen.add(p.id); s.owned.push(p); } }
    if (s.lord && !seen.has(s.lord)) s.owned.unshift(heroRecruit(s.lord));
    s.followers = Array.isArray(v.followers) ? [...new Set((v.followers as unknown[]).filter((x): x is string => typeof x === 'string' && seen.has(x)))].slice(0, 3) : [];
    s.offers = (Array.isArray(v.offers) ? v.offers : []).map(parseOffer).filter((o: Offer | null): o is Offer => !!o).slice(0, 6);
    s.captives = (Array.isArray(v.captives) ? v.captives : []).map(parseOffer).filter((o: Offer | null): o is Offer => !!o).slice(0, 6);
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
  const now = currentSeason();
  if (s.season !== now) {
    s.captives = s.captives.filter(o => (o.expires ?? now) > now);
    rollOffers(s); s.season = now; s.manual = 0; write(s);
  }
  return s;
}
function currentSeason(): number { try { return seasonIndex(loadWorld().town); } catch { return 0; } }

export function heroOwned(hero: CharacterId): boolean { return !rosterEnforced() || loadRoster().owned.some(r => r.kind === 'hero' && r.hero === hero); }
/** 可选作主将的武将（天下开放前为全部）。 */
export function ownedHeroes(): CharacterId[] { if (!rosterEnforced()) return CHARACTERS.map(c => c.id); const s = loadRoster(); return CHARACTERS.map(c => c.id).filter(id => s.owned.some(r => r.hero === id)); }
/** 选将面板的默认武将：上次出战的若未拥有，换成主公。 */
export function defaultHero(saved: string | null | undefined): CharacterId {
  const owned = ownedHeroes(); if (isHero(saved) && owned.includes(saved)) return saved;
  const s = rosterEnforced() ? loadRoster() : null; return s?.lord && owned.includes(s.lord) ? s.lord : owned[0] ?? 'zhaoyun';
}
export const LOCKED_HINT = '招贤馆可招';
/** 行囊里可以换装的人：天下开放前为全部可玩武将；之后为麾下所有武将（含招来的 r_ 编号）。 */
export function gearOwners(): Array<{ id: GearOwner; name: string }> {
  if (!rosterEnforced()) return CHARACTERS.map(c => ({ id: c.id, name: c.name }));
  return loadRoster().owned.map(r => ({ id: (r.hero ?? r.id) as GearOwner, name: r.name.replace(/（.*）/, '') }));
}
/** 武将显示名（含招来的人）。 */
export function ownerName(id: string | undefined): string {
  if (!id) return ''; const c = CHARACTERS.find(x => x.id === id); if (c) return c.name;
  const r = read()?.owned.find(x => x.id === id); return r ? r.name.replace(/（.*）/, '') : '';
}

// ———— 招贤馆 ————

function unownedHeroes(s: RosterSave): CharacterId[] { return CHARACTERS.map(c => c.id).filter(id => !s.owned.some(r => r.hero === id) && !s.offers.some(o => o.hero === id) && !s.captives.some(o => o.hero === id)); }
function commonOffer(): Offer {
  const w = RECRUIT.commonQuality, total = Object.values(w).reduce((a, b) => a + (b ?? 0), 0); let r = rand() * total, q: ItemQuality = 'white';
  for (const k of ['white', 'green', 'blue'] as const) { r -= w[k] ?? 0; if (r < 0) { q = k; break; } }
  return { kind: 'common', name: commonName(rand), template: pick(TEMPLATE_ORDER), quality: q, cost: RECRUIT.cost[q as 'white' | 'green' | 'blue'] };
}
function namedOffer(s: RosterSave): Offer | null {
  const taken = new Set([...s.owned.map(r => r.name), ...s.offers.map(o => o.name), ...s.captives.map(o => o.name)]);
  const pool: Array<[FactionId, string]> = [];
  for (const f of MAJOR_FACTIONS) for (const n of BOUNTY_GENERALS[f] ?? []) if (!taken.has(n)) pool.push([f, n]);
  if (!pool.length) return null;
  const [faction, name] = pick(pool);
  return { kind: 'named', name, faction, template: pick(TEMPLATE_ORDER), quality: 'purple', cost: RECRUIT.cost.named };
}
function heroOffer(s: RosterSave): Offer | null { const left = unownedHeroes(s); if (!left.length) return null; const hero = pick(left); return { kind: 'hero', hero, name: getCharacter(hero).name, template: HERO_TEMPLATE[hero], quality: 'orange', cost: RECRUIT.cost.hero }; }

/** 刷新全部席位（自动换季与手动刷新共用），处理保底。 */
function rollOffers(s: RosterSave): void {
  s.offers = [];
  const seats = RECRUIT.seats[s.hall - 1], rates = RECRUIT.rates[s.hall - 1];
  for (let i = 0; i < seats; i++) {
    const r = rand(); let o: Offer | null = null;
    if (r < rates.hero) o = heroOffer(s); else if (r < rates.hero + rates.named) o = namedOffer(s);
    s.offers.push(o ?? commonOffer());
  }
  const anyLeft = CHARACTERS.some(c => !s.owned.some(r => r.hero === c.id));
  if (s.offers.some(o => o.kind === 'hero')) s.dry = 0;
  else if (anyLeft) {
    s.dry++;
    if (s.dry > RECRUIT.pity) { const h = heroOffer(s); if (h) { s.offers[s.offers.length - 1] = h; s.dry = 0; } }
  }
}

export interface RosterResult { ok: boolean; message: string }
export function refreshCost(s: RosterSave = loadRoster()): number { return RECRUIT.refreshBase + RECRUIT.refreshStep * s.manual; }
export function manualRefresh(): RosterResult {
  if (!worldUnlocked()) return { ok: false, message: '天下开放后才有招贤馆' };
  const s = loadRoster(), cost = refreshCost(s);
  if (!spendWorld({ provisions: cost })) return { ok: false, message: `军粮不足：刷新需要 ${cost}` };
  s.manual++; rollOffers(s); write(s); return { ok: true, message: `花 ${cost} 军粮，换了一批人才` };
}
export function recruit(index: number, captive = false): RosterResult {
  if (!worldUnlocked()) return { ok: false, message: '天下开放后才有招贤馆' };
  const s = loadRoster(), list = captive ? s.captives : s.offers, o = list[index];
  if (!o) return { ok: false, message: '这个席位已经空了' };
  if (s.owned.length >= RECRUIT.maxOwned) return { ok: false, message: `麾下已满 ${RECRUIT.maxOwned} 人，先遣散一些` };
  if (o.kind === 'hero' && s.owned.some(r => r.hero === o.hero)) { list.splice(index, 1); write(s); return { ok: false, message: '已在麾下' }; }
  const cost = captive ? Math.ceil(o.cost * RECRUIT.captiveDiscount) : o.cost;
  if (!spendWorld({ provisions: cost })) return { ok: false, message: `军粮不足：招募需要 ${cost}` };
  const r: Recruit = o.kind === 'hero' ? heroRecruit(o.hero!) : { id: 'r_' + (++s.seq), kind: o.kind, name: o.name, template: o.template, quality: o.quality, rank: 1, picks: [], faction: o.faction };
  s.owned.push(r); list.splice(index, 1);
  const cap = followerCap(s); if (s.followers.length < cap) s.followers.push(r.id);
  write(s); return { ok: true, message: `${r.name}${captive ? '归降' : '应募'}，花 ${cost} 军粮` };
}
/** 遣散（主公不能遣散）；身上的兵装由行囊在读档时自然失效（loadouts 只认在册的人）。 */
export function dismiss(id: string): RosterResult {
  const s = loadRoster(), i = s.owned.findIndex(r => r.id === id); if (i < 0) return { ok: false, message: '不在麾下' };
  if (s.owned[i].hero && s.owned[i].hero === s.lord) return { ok: false, message: '主公不能遣散' };
  const name = s.owned[i].name, gear = s.owned[i].hero ?? s.owned[i].id;
  // 身上的兵装卸回行囊（道具会话约定用 unequipSlot）
  try { for (const slot of Object.keys(loadout(gear as GearOwner))) unequipSlot(gear as GearOwner, slot as never); } catch { /* 行囊不可用 */ }
  s.owned.splice(i, 1); s.followers = s.followers.filter(f => f !== id); write(s); return { ok: true, message: `${name}辞去${gear.startsWith('r_') ? '，兵装已卸回行囊' : ''}` };
}

// ———— 招降 ————

/** 某势力随机一名部将（攻城 / 守城的守将）。 */
export function factionGeneral(faction: FactionId | undefined): string | null { const list = faction ? BOUNTY_GENERALS[faction] : undefined; return list?.length ? pick(list) : null; }
/** 结算面板的一行：俘获提示。 */
export const captureLine = (name: string | null): string => name ? `\n俘获敌将${name} · 两季内可在招贤馆招降` : '';
/** 击败敌将后按概率进入降将栏；返回被俘者名字。测试 / 调试战斗不调用。 */
export function tryCapture(source: keyof typeof RECRUIT.capture, name: string, faction: FactionId | undefined): string | null {
  if (!worldUnlocked() || !name || name === '敌将') return null;
  if (rand() >= RECRUIT.capture[source]) return null;
  const s = loadRoster();
  if (s.owned.some(r => r.name === name) || s.captives.some(o => o.name === name)) return null;
  s.captives.push({ kind: 'named', name, faction: isFaction(faction) ? faction : undefined, template: pick(TEMPLATE_ORDER), quality: 'purple', cost: RECRUIT.cost.named, expires: currentSeason() + RECRUIT.captiveSeasons });
  s.captives = s.captives.slice(-6); write(s); return name;
}

// ———— 随行 ————

export function followerCap(s: RosterSave = loadRoster()): number { return RECRUIT.followerCap[s.hall - 1]; }
/** 设置随行（不含出战主将，按上限截断）。 */
export function setFollowers(ids: string[]): void {
  const s = loadRoster(); s.followers = [...new Set(ids)].filter(id => s.owned.some(r => r.id === id)).slice(0, followerCap(s)); write(s);
}
export function toggleFollower(id: string): RosterResult {
  const s = loadRoster(), r = s.owned.find(x => x.id === id); if (!r) return { ok: false, message: '不在麾下' };
  if (s.followers.includes(id)) { s.followers = s.followers.filter(f => f !== id); write(s); return { ok: true, message: `${r.name}留守` }; }
  if (s.followers.length >= followerCap(s)) return { ok: false, message: `随行已满 ${followerCap(s)} 人（升级招贤馆可多带）` };
  s.followers.push(id); write(s); return { ok: true, message: `${r.name}随行` };
}
/** 本局出战的随行武将：去掉主将本人，最多 cap 人。 */
export function followersFor(lead: CharacterId): Recruit[] {
  if (!worldUnlocked()) return [];
  const s = loadRoster(); return s.followers.map(id => s.owned.find(r => r.id === id)).filter((r): r is Recruit => !!r && r.hero !== lead).slice(0, followerCap(s));
}

// ———— 招贤馆升级与将阶 ————

export function upgradeHall(): RosterResult {
  const s = loadRoster(); if (s.hall >= 3) return { ok: false, message: '招贤馆已满级' };
  const c = RECRUIT.hallUpgrade[s.hall - 1];
  if (!spendWorld({ provisions: c.provisions })) return { ok: false, message: `军粮不足：升级需要 ${c.provisions}` };
  s.hall++; write(s); return { ok: true, message: `招贤馆升到 ${s.hall} 级：席位 ${RECRUIT.seats[s.hall - 1]}，随行 ${RECRUIT.followerCap[s.hall - 1]} 人` };
}
export function rankCap(s: RosterSave = loadRoster()): number { return RANK.capByHall[s.hall - 1]; }
export function rankUp(id: string, line: RankLine): RosterResult {
  const s = loadRoster(), r = s.owned.find(x => x.id === id); if (!r) return { ok: false, message: '不在麾下' };
  if (r.rank >= rankCap(s)) return { ok: false, message: r.rank >= RANK.max ? '将阶已满' : '将阶已到招贤馆上限，升级招贤馆后可继续' };
  const c = RANK.cost(r.rank + 1);
  if (!spendWorld(c)) return { ok: false, message: `军粮不足：升阶需要 ${c.provisions}` };
  r.rank++; r.picks.push(line); write(s); return { ok: true, message: `${r.name}升到将阶 ${r.rank}（${line === 'weapon' ? '兵器' : '被动'}）` };
}
/** 将阶带来的加成：兵器线伤害、被动线生命与攻速；当主将时的开局加成。 */
export function rankBonus(r: Pick<Recruit, 'rank' | 'picks'>): { damage: number; hp: number; haste: number; lead: number } {
  const w = r.picks.filter(p => p === 'weapon').length, p = r.picks.filter(x => x === 'passive').length;
  return { damage: w * RANK.weaponStep, hp: p * RANK.passiveHp, haste: p * RANK.passiveHaste, lead: (r.rank - 1) * RANK.leadPerRank };
}
/** 主将的将阶开局加成（未拥有记录时为 0）。 */
export function leadRankBonus(hero: CharacterId): number { if (!worldUnlocked()) return 0; const r = loadRoster().owned.find(x => x.hero === hero); return r ? rankBonus(r).lead : 0; }
export { FOLLOW };
