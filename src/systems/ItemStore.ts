import type { CharacterId } from '../data/characters';
import { AFFIXES, BAG_CAPACITY, QUALITIES, QUALITY_ORDER, SLOT_ORDER, itemDef, itemSlot, type ItemInstance, type ItemQuality, type ItemSlot } from '../data/items';
import { addTownMoney } from '../world/WorldStore';

/**
 * 行囊（局外持久）：独立存档键 im_items_v1，已加入 SaveSlots.PROGRESS_KEYS，随存档位切换。
 * bag 存所有已拥有道具（含已穿戴的）；loadouts 记每位武将 6 槽穿的道具 uid。一件道具同时只属于一位武将。
 */
export const ITEMS_KEY = 'im_items_v1';
export interface ItemSave { version: 1; bag: ItemInstance[]; loadouts: Partial<Record<CharacterId, Partial<Record<ItemSlot, string>>>>; salvaged: number }

let memory: ItemSave | null = null;
const empty = (): ItemSave => ({ version: 1, bag: [], loadouts: {}, salvaged: 0 });

function valid(item: unknown): item is ItemInstance {
  const i = item as ItemInstance;
  return !!i && typeof i.uid === 'string' && i.uid.length <= 64 && typeof i.base === 'string' && !!itemDef(i.base) && QUALITY_ORDER.includes(i.quality)
    && Array.isArray(i.affixes) && i.affixes.length <= 6 && i.affixes.every(a => a && a.id in AFFIXES && Number.isFinite(a.value) && a.value >= 0 && a.value < 10);
}

export function loadItems(): ItemSave {
  if (memory) return structuredClone(memory);
  let s = empty();
  try {
    const raw = localStorage.getItem(ITEMS_KEY), v = raw ? JSON.parse(raw) : null;
    if (v && v.version === 1 && Array.isArray(v.bag)) {
      const seen = new Set<string>();
      s.bag = v.bag.filter((i: unknown) => valid(i) && !seen.has((i as ItemInstance).uid) && seen.add((i as ItemInstance).uid)).slice(0, BAG_CAPACITY + 40);
      const owned = new Set(s.bag.map(i => i.uid)), used = new Set<string>();
      for (const [hero, slots] of Object.entries(v.loadouts ?? {})) {
        const out: Partial<Record<ItemSlot, string>> = {};
        for (const slot of SLOT_ORDER) { const uid = (slots as Record<string, unknown>)?.[slot]; const item = typeof uid === 'string' && owned.has(uid) && !used.has(uid) ? s.bag.find(i => i.uid === uid) : undefined; if (item && itemSlot(item) === slot) { out[slot] = uid as string; used.add(uid as string); } }
        if (Object.keys(out).length) s.loadouts[hero as CharacterId] = out;
      }
      s.salvaged = Number.isSafeInteger(v.salvaged) && v.salvaged >= 0 ? v.salvaged : 0;
    }
  } catch { s = empty(); }
  memory = s;
  return structuredClone(s);
}

function commit(s: ItemSave): void {
  memory = structuredClone(s);
  try { localStorage.setItem(ITEMS_KEY, JSON.stringify(s)); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用：保留在内存 */ }
}
/** 存档位切换 / 测试后清掉缓存，下次从 localStorage 重读。 */
export function resetItemCache(): void { memory = null; }

export function equippedBy(s: ItemSave, uid: string): CharacterId | undefined {
  for (const [hero, slots] of Object.entries(s.loadouts)) if (slots && Object.values(slots).includes(uid)) return hero as CharacterId;
  return undefined;
}
export function loadout(hero: CharacterId, s: ItemSave = loadItems()): Partial<Record<ItemSlot, ItemInstance>> {
  const out: Partial<Record<ItemSlot, ItemInstance>> = {}, slots = s.loadouts[hero] ?? {};
  for (const slot of SLOT_ORDER) { const item = slots[slot] ? s.bag.find(i => i.uid === slots[slot]) : undefined; if (item) out[slot] = item; }
  return out;
}

const qIndex = (q: ItemQuality) => QUALITY_ORDER.indexOf(q);
/** 放入行囊；超出上限时分解最低品质的未穿戴道具（返还钱）。返回被自动分解的道具。 */
function addToBag(s: ItemSave, items: ItemInstance[]): ItemInstance[] {
  s.bag.push(...items.filter(valid).map(i => structuredClone(i)));
  const auto: ItemInstance[] = [];
  while (s.bag.length > BAG_CAPACITY) {
    const loose = s.bag.filter(i => !equippedBy(s, i.uid)).sort((a, b) => qIndex(a.quality) - qIndex(b.quality));
    if (!loose.length) break;
    const victim = loose[0]; s.bag.splice(s.bag.indexOf(victim), 1); auto.push(victim);
  }
  if (auto.length) { const money = auto.reduce((n, i) => n + QUALITIES[i.quality].salvage, 0); s.salvaged += money; addTownMoney(money); }
  return auto;
}

export interface DepositResult { kept: ItemInstance[]; lost: number; autoSalvaged: number }
/**
 * 战斗结算：胜利或坚持 60 秒以上带回全部；阵亡且不足 60 秒只带回一半（按品质从高到低）。测试 / 调试战斗不入库。
 */
export function depositRunLoot(loot: ItemInstance[], o: { victory: boolean; elapsed: number; debug: boolean }): DepositResult {
  if (o.debug || !loot.length) return { kept: [], lost: o.debug ? 0 : 0, autoSalvaged: 0 };
  const sorted = [...loot].sort((a, b) => qIndex(b.quality) - qIndex(a.quality));
  const kept = o.victory || o.elapsed >= 60 ? sorted : sorted.slice(0, Math.ceil(sorted.length / 2));
  const s = loadItems(), auto = addToBag(s, kept); commit(s);
  return { kept, lost: loot.length - kept.length, autoSalvaged: auto.length };
}

export function addItems(items: ItemInstance[]): void { const s = loadItems(); addToBag(s, items); commit(s); }

export function equipItem(hero: CharacterId, uid: string): boolean {
  const s = loadItems(), item = s.bag.find(i => i.uid === uid); if (!item) return false;
  for (const slots of Object.values(s.loadouts)) if (slots) for (const slot of SLOT_ORDER) if (slots[slot] === uid) delete slots[slot];
  (s.loadouts[hero] ??= {})[itemSlot(item)] = uid; commit(s); return true;
}
export function unequipSlot(hero: CharacterId, slot: ItemSlot): boolean {
  const s = loadItems(), slots = s.loadouts[hero]; if (!slots?.[slot]) return false;
  delete slots[slot]; commit(s); return true;
}
/** 分解未穿戴的道具，返还钱。 */
export function salvageItems(uids: string[]): number {
  const s = loadItems(); let money = 0;
  for (const uid of uids) { const i = s.bag.findIndex(x => x.uid === uid); if (i < 0 || equippedBy(s, uid)) continue; money += QUALITIES[s.bag[i].quality].salvage; s.bag.splice(i, 1); }
  if (money) { s.salvaged += money; commit(s); addTownMoney(money); }
  return money;
}
/** 一键分解：品质不高于 maxQuality 的未穿戴道具。 */
export function salvageUpTo(maxQuality: ItemQuality): number {
  const s = loadItems(); return salvageItems(s.bag.filter(i => qIndex(i.quality) <= qIndex(maxQuality) && !equippedBy(s, i.uid)).map(i => i.uid));
}
