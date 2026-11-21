import { CHARACTERS, type CharacterId } from '../data/characters';
/** 穿装备的人：可玩武将（CharacterId）或招贤馆招来的武将（r_<数字>，RosterStore）。 */
export type GearOwner = CharacterId | `r_${number}`;
export const isGearOwner = (k: unknown): k is GearOwner => typeof k === 'string' && (/^r_\d{1,9}$/.test(k) || CHARACTERS.some(c => c.id === k));
const isHeroId = (k: GearOwner): k is CharacterId => !k.startsWith('r_');
import { isRelic } from '../data/items';
import { AFFIXES, BAG_CAPACITY, BAG_OVERFLOW, LEGACY_MOUNT_BASES, LEGACY_WEAPON_BASES, QUALITIES, QUALITY_ORDER, SLOT_ORDER, itemDef, itemSlot, type ItemInstance, type ItemQuality, type ItemSlot, type PityState } from '../data/items';
import { HORSES, STARTER_HORSE, horseDef, type HorseDef } from '../data/mounts';
import { addTownMoney, worldChapterCleared } from '../world/WorldStore';
import { chapterOneCleared } from './ChapterProgress';
import { gearPlan } from '../data/gearAuto';

/**
 * 行囊（局外持久）：存档键 im_items_v2，已加入 SaveSlots.PROGRESS_KEYS，随存档位切换。
 * bag 存所有已拥有道具（含已穿戴的）；loadouts 记每位武将 4 槽穿的道具 uid。一件道具同时只属于一位武将。
 * stable 是马厩：拥有的马（每匹一份）和每位武将骑哪匹；第一章通关后开放并送驽马。
 * pity 是掉落保底计数（按掉落件数，跨局累计）。
 * 旧档 im_items_v1 第一次读取时按 migrateV1 转换写入 v2，v1 原样保留作回退备份。
 */
export const ITEMS_KEY = 'im_items_v2';
/** 穿戴位：5 个装备槽 + 第二信物位 token2（2026-11-17 用户：每位武将可带 2 个信物，第二章通关后开放）。 */
export type LoadoutKey = ItemSlot | 'token2';
export const LOADOUT_KEYS: readonly LoadoutKey[] = [...SLOT_ORDER, 'token2'];
/** 穿戴位放哪一栏的道具（token2 放信物）。 */
export const keySlot = (k: LoadoutKey): ItemSlot => k === 'token2' ? 'token' : k;
/** 每位武将可带的信物数：第二章（讨董）通关后 2 个，否则 1 个。 */
export function tokenSlots(): 1 | 2 { try { return worldChapterCleared('hulao') ? 2 : 1; } catch { return 1; } }
export const LEGACY_ITEMS_KEY = 'im_items_v1';
export interface StableSave { owned: string[]; riders: Partial<Record<CharacterId, string>>; announced: boolean }
export interface ItemSave {
  version: 2; bag: ItemInstance[]; loadouts: Partial<Record<GearOwner, Partial<Record<LoadoutKey, string>>>>; salvaged: number;
  stable: StableSave; pity: PityState; autoSalvageWhite: boolean;
  /** 上次打开行囊后新收入的件数（主页行囊角标）。 */
  unseen: number;
  /** 旧物：旧档里已下架的兵刃挂饰、重复的马，原样保留（不能穿），玩家自己决定何时按双倍分解价折钱。不占行囊格。 */
  legacy: ItemInstance[];
  /** 旧档迁移后待显示一次的提示（如「旧兵刃 7 件已折算为 136 钱」）。 */
  notice?: string;
}

let memory: ItemSave | null = null;
const empty = (): ItemSave => ({ version: 2, bag: [], loadouts: {}, salvaged: 0, stable: { owned: [], riders: {}, announced: false }, pity: { sincePurple: 0, sinceOrange: 0 }, autoSalvageWhite: true, unseen: 0, legacy: [] });
const count = (v: unknown, max = 1e6) => Number.isSafeInteger(v) && (v as number) >= 0 ? Math.min(max, v as number) : 0;

function shapeOk(item: unknown): item is ItemInstance {
  const i = item as ItemInstance;
  return !!i && typeof i.uid === 'string' && i.uid.length <= 64 && typeof i.base === 'string' && QUALITY_ORDER.includes(i.quality)
    && Array.isArray(i.affixes) && i.affixes.length <= 6 && i.affixes.every(a => a && a.id in AFFIXES && Number.isFinite(a.value) && a.value >= 0 && a.value < 10);
}
function valid(item: unknown): item is ItemInstance { return shapeOk(item) && !!itemDef((item as ItemInstance).base); }

/** 读一份 v2 形状的数据并清洗（v1 迁移后也走这里）。 */
function sanitize(v: Record<string, unknown>): ItemSave {
  const s = empty(), seen = new Set<string>();
  const bag = Array.isArray(v.bag) ? v.bag : [];
  s.bag = bag.filter((i: unknown) => valid(i) && !seen.has((i as ItemInstance).uid) && !!seen.add((i as ItemInstance).uid)).slice(0, 400) as ItemInstance[];
  const owned = new Map(s.bag.map(i => [i.uid, i])), used = new Set<string>();
  for (const [hero, slots] of Object.entries((v.loadouts ?? {}) as Record<string, unknown>)) {
    if (!isGearOwner(hero)) continue;
    const out: Partial<Record<LoadoutKey, string>> = {};
    for (const slot of LOADOUT_KEYS) {
      const uid = (slots as Record<string, unknown>)?.[slot], item = typeof uid === 'string' && !used.has(uid) ? owned.get(uid) : undefined;
      if (item && itemSlot(item) === keySlot(slot)) { out[slot] = item.uid; used.add(item.uid); }
    }
    // 2026-11-17「Boss遗物」槽：旧档穿在头盔 / 信物槽的遗珍挪进遗物槽（只能 1 件，留品质高的，另一件留在行囊）
    if (!out.relic) {
      const old = ['helm', 'token'].map(k => (slots as Record<string, unknown>)?.[k]).map(u => typeof u === 'string' && !used.has(u) ? owned.get(u) : undefined)
        .filter((i): i is ItemInstance => !!i && itemSlot(i) === 'relic').sort((a, b) => QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality));
      if (old[0]) { out.relic = old[0].uid; used.add(old[0].uid); }
    }
    if (Object.keys(out).length) s.loadouts[hero] = out;
  }
  s.salvaged = count(v.salvaged, 1e9);
  const st = (v.stable ?? {}) as Partial<StableSave>;
  s.stable.owned = [...new Set((Array.isArray(st.owned) ? st.owned : []).filter((id): id is string => typeof id === 'string' && !!horseDef(id)))];
  const ridden = new Set<string>();
  for (const [hero, id] of Object.entries(st.riders ?? {})) if (typeof id === 'string' && s.stable.owned.includes(id) && !ridden.has(id)) { s.stable.riders[hero as CharacterId] = id; ridden.add(id); }
  s.stable.announced = st.announced === true;
  const p = (v.pity ?? {}) as Partial<PityState>;
  s.pity = { sincePurple: count(p.sincePurple, 999), sinceOrange: count(p.sinceOrange, 999) };
  s.autoSalvageWhite = v.autoSalvageWhite !== false;
  s.unseen = count(v.unseen, 999);
  const lseen = new Set<string>();
  s.legacy = (Array.isArray(v.legacy) ? v.legacy : []).filter((i: unknown) => shapeOk(i) && (LEGACY_WEAPON_BASES.includes((i as ItemInstance).base) || LEGACY_MOUNT_BASES.includes((i as ItemInstance).base)) && !lseen.has((i as ItemInstance).uid) && !!lseen.add((i as ItemInstance).uid)).slice(0, 200) as ItemInstance[];
  if (typeof v.notice === 'string' && v.notice.length < 200) s.notice = v.notice;
  return s;
}

/**
 * 旧档 v1 → v2（纯函数，测试直接调用）。规则（用户批准；兵刃要无损迁移）：
 * - 8 种普通兵刃挂饰原样收进「旧物」（不能穿，玩家可随时按双倍分解价折钱）；
 * - 三把名剑 / 名刀（青釭、倚天、古锭刀）原样转为信物：穿着的转到信物槽，信物槽已有东西就退回行囊；
 * - 坐骑道具转为马厩里的马（同种只留一匹，多余的也收进「旧物」），原来穿着的继续由该武将骑；
 * - 其余道具、穿戴、计数原样保留。
 */
export function migrateV1(raw: unknown): { save: ItemSave; weapons: number; horses: number; legacy: number } {
  const v = (raw ?? {}) as { bag?: unknown; loadouts?: Record<string, Record<string, unknown>>; salvaged?: unknown };
  const bag: ItemInstance[] = [], byUid = new Map<string, ItemInstance>(), horseOfUid = new Map<string, string>(), owned: string[] = [];
  const legacy: ItemInstance[] = []; let weapons = 0, extraHorses = 0;
  for (const i of Array.isArray(v.bag) ? v.bag : []) {
    if (!shapeOk(i) || byUid.has(i.uid)) continue;
    byUid.set(i.uid, i);
    if (LEGACY_WEAPON_BASES.includes(i.base)) { legacy.push(i); weapons++; continue; }
    if (LEGACY_MOUNT_BASES.includes(i.base)) {
      horseOfUid.set(i.uid, i.base);
      if (owned.includes(i.base)) { legacy.push(i); extraHorses++; } else owned.push(i.base);
      continue;
    }
    if (itemDef(i.base)) bag.push(i);
  }
  const kept = new Set(bag.map(i => i.uid)), loadouts: Record<string, Record<string, string>> = {}, riders: Record<string, string> = {}, ridden = new Set<string>();
  for (const [hero, slots] of Object.entries(v.loadouts ?? {})) {
    const out: Record<string, string> = {};
    for (const slot of ['armor', 'helm', 'boots', 'token'] as const) { const uid = slots?.[slot]; if (typeof uid === 'string' && kept.has(uid)) out[slot] = uid; }
    const w = slots?.weapon; // 名剑：信物槽空着就转过去
    if (typeof w === 'string' && kept.has(w) && !out.token) out.token = w;
    const m = slots?.mount, horse = typeof m === 'string' ? horseOfUid.get(m) : undefined;
    if (horse && !ridden.has(horse)) { riders[hero] = horse; ridden.add(horse); }
    if (Object.keys(out).length) loadouts[hero] = out;
  }
  const save = sanitize({ bag, loadouts, salvaged: count(v.salvaged, 1e9), stable: { owned, riders, announced: false }, legacy });
  const parts: string[] = [];
  if (weapons) parts.push(`旧兵刃 ${weapons} 件收进「旧物」`);
  if (owned.length) parts.push(`${owned.length} 匹马已转入马厩` + (extraHorses ? `（重复的 ${extraHorses} 匹也在「旧物」）` : ''));
  if (legacy.length) parts.push('「旧物」可随时按双倍价分解');
  if (parts.length) save.notice = '兵装改版 · ' + parts.join('，');
  return { save, weapons, horses: owned.length, legacy: legacy.length };
}

export function loadItems(): ItemSave {
  if (!memory) {
    let s = empty();
    try {
      const raw = localStorage.getItem(ITEMS_KEY), v = raw ? JSON.parse(raw) : null;
      if (v && v.version === 2) s = sanitize(v);
      else {
        const old = localStorage.getItem(LEGACY_ITEMS_KEY), ov = old ? JSON.parse(old) : null;
        if (ov && ov.version === 1) { s = migrateV1(ov).save; memory = s; commit(s); }
      }
    } catch { s = empty(); }
    memory = s;
  }
  // 第一章通关：马厩开放，送驽马（读档时补发，老档也一样）
  if (!memory.stable.owned.includes(STARTER_HORSE) && chapterOneCleared()) { memory.stable.owned.unshift(STARTER_HORSE); commit(memory); }
  return structuredClone(memory);
}

function commit(s: ItemSave): void {
  memory = structuredClone(s);
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify(s)); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用：保留在内存 */ }
}
/** 存档位切换 / 测试后清掉缓存，下次从 localStorage 重读。 */
export function resetItemCache(): void { memory = null; }

/** 旧档迁移提示：取一次后清掉。 */
/** 追加一条行囊提示（下次打开行囊显示一次）。 */
export function pushItemNotice(text: string): void { const s = loadItems(); s.notice = (s.notice ? s.notice + '；' : '') + text; if (s.notice.length > 190) s.notice = s.notice.slice(0, 190); commit(s); }
export function takeItemNotice(): string | undefined { const s = loadItems(); if (!s.notice) return undefined; const n = s.notice; delete s.notice; commit(s); return n; }

export function equippedBy(s: ItemSave, uid: string): GearOwner | undefined {
  for (const [hero, slots] of Object.entries(s.loadouts)) if (slots && Object.values(slots).includes(uid)) return hero as GearOwner;
  return undefined;
}
/** 武将正穿着的道具（第二信物位未开放时不算，存档里照旧保留）。 */
export function loadout(hero: GearOwner, s: ItemSave = loadItems()): Partial<Record<LoadoutKey, ItemInstance>> {
  const out: Partial<Record<LoadoutKey, ItemInstance>> = {}, slots = s.loadouts[hero] ?? {}, two = tokenSlots() > 1;
  for (const slot of LOADOUT_KEYS) { if (slot === 'token2' && !two) continue; const item = slots[slot] ? s.bag.find(i => i.uid === slots[slot]) : undefined; if (item) out[slot] = item; }
  return out;
}
/** 这件道具在该武将身上穿在哪个位（没穿为 undefined）。 */
export function wornKey(hero: GearOwner, uid: string, s: ItemSave = loadItems()): LoadoutKey | undefined {
  const l = loadout(hero, s); return LOADOUT_KEYS.find(k => l[k]?.uid === uid);
}
/**
 * 穿上这件道具会放到哪个位：信物先放空着的位；两位都满时换掉同名的那件，否则换第一位。
 * 已穿在身上的返回它所在的位。
 */
export function equipTarget(hero: GearOwner, item: ItemInstance, s: ItemSave = loadItems()): LoadoutKey {
  const slot = itemSlot(item); if (slot !== 'token') return slot;
  const here = wornKey(hero, item.uid, s); if (here) return here;
  if (tokenSlots() < 2) return 'token';
  const l = loadout(hero, s);
  if (l.token && l.token2) return l.token2.base === item.base && l.token.base !== item.base ? 'token2' : 'token';
  if (l.token) return l.token.base === item.base ? 'token' : 'token2';
  if (l.token2) return l.token2.base === item.base ? 'token2' : 'token';
  return 'token';
}
/** 未穿戴的道具数（行囊上限只算这些）。 */
export function looseCount(s: ItemSave = loadItems()): number { const worn = new Set(Object.values(s.loadouts).flatMap(l => Object.values(l ?? {}))); return s.bag.filter(i => !worn.has(i.uid)).length; }

const qIndex = (q: ItemQuality) => QUALITY_ORDER.indexOf(q);
/**
 * 放入行囊。未穿戴超过 BAG_CAPACITY 时，最低品质的白 / 绿 / 蓝自动折成营寨军粮（行囊满了的保护；平时卖装备去军需商人「出售兵装」）；
 * 紫 / 橙不自动折，超出 BAG_CAPACITY + BAG_OVERFLOW 时才折最低的那件。返回被自动折掉的道具。
 * 2026-11-19 行囊去掉「分解」后，「自动分解白」开关没了，旧档里开着的也不再生效（白色照常入囊）。
 */
function addToBag(s: ItemSave, items: ItemInstance[]): ItemInstance[] {
  const auto: ItemInstance[] = [];
  for (const i of items.filter(valid)) s.bag.push(structuredClone(i));
  const loose = () => { const worn = new Set(Object.values(s.loadouts).flatMap(l => Object.values(l ?? {}))); return s.bag.filter(i => !worn.has(i.uid)).sort((a, b) => qIndex(a.quality) - qIndex(b.quality)); };
  for (let l = loose(); l.length > BAG_CAPACITY; l = loose()) {
    // 首领遗珍永不分解（超出上限也不动）
    const victim = l.find(i => qIndex(i.quality) < qIndex('purple') && !isRelic(i)) ?? (l.length > BAG_CAPACITY + BAG_OVERFLOW ? l.find(i => !isRelic(i)) : undefined);
    if (!victim) break;
    s.bag.splice(s.bag.indexOf(victim), 1); auto.push(victim);
  }
  s.unseen = Math.min(999, s.unseen + items.length - auto.filter(a => items.includes(a)).length);
  if (auto.length) { const money = auto.reduce((n, i) => n + QUALITIES[i.quality].salvage, 0); s.salvaged += money; addTownMoney(money); }
  return auto;
}

export interface DepositResult { kept: ItemInstance[]; lost: number; autoSalvaged: number }
/**
 * 战斗结算：胜利或坚持 60 秒以上带回全部；阵亡且不足 60 秒只带回一半（按品质从高到低）。测试 / 调试战斗不入库、不计保底。
 * 战斗中已经穿上的缴获在穿戴时就收入了行囊（claimRunLoot），不在 loot 里，不会因败退遗失。
 */
export function depositRunLoot(loot: ItemInstance[], o: { victory: boolean; elapsed: number; debug: boolean; pity?: PityState }): DepositResult {
  if (o.debug) return { kept: [], lost: 0, autoSalvaged: 0 };
  const s = loadItems();
  if (o.pity) s.pity = { sincePurple: count(o.pity.sincePurple, 999), sinceOrange: count(o.pity.sinceOrange, 999) };
  if (!loot.length) { if (o.pity) commit(s); return { kept: [], lost: 0, autoSalvaged: 0 }; }
  const sorted = [...loot].sort((a, b) => qIndex(b.quality) - qIndex(a.quality));
  const kept = o.victory || o.elapsed >= 60 ? sorted : sorted.slice(0, Math.ceil(sorted.length / 2));
  const auto = addToBag(s, kept); commit(s);
  return { kept, lost: loot.length - kept.length, autoSalvaged: auto.length };
}
/** 当前保底计数（开局读入 ItemDrops，结算时随 depositRunLoot 写回）。 */
export function loadPity(): PityState { return { ...loadItems().pity }; }

export function addItems(items: ItemInstance[]): void { const s = loadItems(); addToBag(s, items); commit(s); }

/** 穿上；slot 指定穿到哪一位（一键穿戴给信物第二位用；须与道具的位相符），不指定按 equipTarget。 */
export function equipItem(hero: GearOwner, uid: string, slot?: LoadoutKey): boolean {
  const s = loadItems(), item = s.bag.find(i => i.uid === uid); if (!item) return false;
  if (wornKey(hero, uid, s)) return true;
  const fits = slot && (slot === itemSlot(item) || (slot === 'token2' && itemSlot(item) === 'token' && tokenSlots() > 1));
  const target = fits ? slot : equipTarget(hero, item, s);
  for (const slots of Object.values(s.loadouts)) if (slots) for (const slot of LOADOUT_KEYS) if (slots[slot] === uid) delete slots[slot];
  (s.loadouts[hero] ??= {})[target] = uid; commit(s); return true;
}
/**
 * 一键穿戴 / 小红点（data/gearAuto.ts）：这位武将该换上的兵装。extra = 战斗中还没带回的缴获（runLoot），一并比较。
 * 只挑没被任何武将穿着的；身上已是最好的返回空。
 */
export function gearUpgrades(hero: GearOwner, extra: readonly ItemInstance[] = [], s: ItemSave = loadItems()): Array<{ slot: LoadoutKey; item: ItemInstance }> {
  const worn = new Set(Object.values(s.loadouts).flatMap(l => Object.values(l ?? {})));
  return gearPlan(loadout(hero, s), [...s.bag.filter(i => !worn.has(i.uid)), ...extra.filter(valid)], tokenSlots());
}
/** 第一次缴获兵装后的行营引导（只一次）：看过没有。 */
const GEAR_GUIDE_KEY = 'im_gear_guide_v1';
export function gearGuideSeen(): boolean { try { return localStorage.getItem(GEAR_GUIDE_KEY) === '1'; } catch { return true; } }
export function markGearGuideSeen(): void { try { localStorage.setItem(GEAR_GUIDE_KEY, '1'); } catch { /* 存储不可用 */ } }
/** 战斗中穿上本局缴获：立刻收入行囊并穿上（算作已带回，败退不丢）。调用方负责把它从 runLoot 移除。 */
export function claimRunLoot(hero: GearOwner, item: ItemInstance): boolean {
  if (!valid(item)) return false;
  const s = loadItems();
  if (!s.bag.some(i => i.uid === item.uid)) s.bag.push(structuredClone(item));
  commit(s); return equipItem(hero, item.uid);
}
export function unequipSlot(hero: GearOwner, slot: LoadoutKey): boolean {
  const s = loadItems(), slots = s.loadouts[hero]; if (!slots?.[slot]) return false;
  delete slots[slot]; commit(s); return true;
}
/** 分解未穿戴的道具，返还钱。 */
export function salvageItems(uids: string[]): number {
  const s = loadItems(); let money = 0;
  for (const uid of uids) { const i = s.bag.findIndex(x => x.uid === uid); if (i < 0 || equippedBy(s, uid) || isRelic(s.bag[i])) continue; money += QUALITIES[s.bag[i].quality].salvage; s.bag.splice(i, 1); }
  if (money) { s.salvaged += money; commit(s); addTownMoney(money); }
  return money;
}
/** 旧物（旧兵刃、重复的马）全部按双倍分解价折钱。 */
export function legacyValue(s: ItemSave = loadItems()): number { return s.legacy.reduce((n, i) => n + QUALITIES[i.quality].salvage * 2, 0); }
export function salvageLegacy(): number {
  const s = loadItems(), money = legacyValue(s); if (!money) return 0;
  s.legacy = []; s.salvaged += money; commit(s); addTownMoney(money); return money;
}
/**
 * 卖给军需商人（data/items sellPrice）：只收未穿戴、非首领遗珍的；返回真卖掉的道具（钱由商人那边的钱包发：行营随军粮 / 营寨军粮）。
 * 行囊里已不再有「分解」按钮（2026-11-19）。
 */
export function sellItems(uids: readonly string[]): ItemInstance[] {
  const s = loadItems(), sold: ItemInstance[] = [];
  for (const uid of uids) { const i = s.bag.findIndex(x => x.uid === uid); if (i < 0 || equippedBy(s, uid) || isRelic(s.bag[i])) continue; sold.push(s.bag[i]); s.bag.splice(i, 1); }
  if (sold.length) commit(s);
  return sold;
}
/** 可出售的：行囊里未穿戴、非首领遗珍的兵装。 */
export function sellableItems(s: ItemSave = loadItems()): ItemInstance[] { return s.bag.filter(i => !equippedBy(s, i.uid) && !isRelic(i)); }
/** 旧物（旧档的兵刃挂饰、重复的马）整批卖给军需商人；返回卖掉的件。 */
export function sellLegacy(): ItemInstance[] { const s = loadItems(), sold = [...s.legacy]; if (sold.length) { s.legacy = []; commit(s); } return sold; }
/** 一键分解：品质不高于 maxQuality 的未穿戴道具。 */
export function salvageUpTo(maxQuality: ItemQuality): number {
  const s = loadItems(); return salvageItems(s.bag.filter(i => qIndex(i.quality) <= qIndex(maxQuality) && !equippedBy(s, i.uid)).map(i => i.uid));
}
/** 主页行囊角标：新收入件数 + 待显示的改版 / 马厩提示。 */
export function bagBadgeCount(): number { const s = loadItems(); return s.unseen + (s.notice ? 1 : 0) + (stableUnlocked() && !s.stable.announced ? 1 : 0); }
export function markBagSeen(): void { const s = loadItems(); if (s.unseen) { s.unseen = 0; commit(s); } }
export function setAutoSalvageWhite(on: boolean): void { const s = loadItems(); s.autoSalvageWhite = on; commit(s); }

// —— 马厩 ——
/** 马厩开放 = 第一章通关。 */
export function stableUnlocked(): boolean { return chapterOneCleared(); }
/** 马厩开放后首次调用返回 true（主页弹一次「马厩已开放 · 获赠驽马」）。 */
export function takeStableAnnouncement(): boolean {
  if (!stableUnlocked()) return false;
  const s = loadItems(); if (s.stable.announced) return false;
  s.stable.announced = true; commit(s); return true;
}
export function ownedHorses(s: ItemSave = loadItems()): HorseDef[] { return HORSES.filter(h => s.stable.owned.includes(h.id)); }
/** 该武将出征骑的马（马厩未开放或没分配时为空）。 */
export function heroHorse(hero: GearOwner, s: ItemSave = loadItems()): HorseDef | undefined {
  if (!stableUnlocked() || !isHeroId(hero)) return undefined;
  const id = s.stable.riders[hero]; return id && s.stable.owned.includes(id) ? horseDef(id) : undefined;
}
export function horseRider(id: string, s: ItemSave = loadItems()): CharacterId | undefined { return (Object.entries(s.stable.riders) as [CharacterId, string][]).find(([, h]) => h === id)?.[0]; }
/** 给武将换马（null = 下马）。一匹马同一时间只归一名武将，换给别人时原骑者自动下马。只应在休整时调用（界面负责限制）。 */
export function rideHorse(hero: GearOwner, id: string | null): boolean {
  if (!isHeroId(hero)) return false; // 招来的 r_ 武将暂不骑马（道具会话约定）
  const s = loadItems();
  if (id && !s.stable.owned.includes(id)) return false;
  for (const [h, x] of Object.entries(s.stable.riders)) if (x === id) delete s.stable.riders[h as CharacterId];
  if (id) s.stable.riders[hero] = id; else delete s.stable.riders[hero];
  commit(s); return true;
}
/** 首领首次击杀赠马；已有则返回 false。 */
export function grantHorse(id: string): boolean {
  const s = loadItems(); if (!horseDef(id) || s.stable.owned.includes(id)) return false;
  s.stable.owned.push(id); commit(s); return true;
}
