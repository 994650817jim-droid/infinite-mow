/**
 * 义军营寨的旅商（2026-11-18 用户「营寨增加个旅商就是军需商人」）：营中也能找军需商人买兵装。
 * 货色与行营军需商人同一套规则（data/items rollMerchantGear：甲胄 / 头盔 / 战靴 / 信物各 1 件，价格 MERCHANT_PRICE），
 * 只是用营寨军粮（世界存档 provisions）付钱，买下直接进行囊。营中不卖战法——战法只在一局之内有效，营里没有在打的这一局。
 *
 * 刷新规则：每打完一仗（胜负都算，世界存档 receipts 末条换了）换一批货；同一仗之间反复进出营寨、刷新页面都是同一批，卖掉的不会补回。
 * 存在独立的 localStorage 键，不动世界存档的格式。
 */
import { MERCHANT_PRICE, rollMerchantGear, type ItemInstance } from '../data/items';
import { addItems } from '../systems/ItemStore';
import { loadWorld, spendProvisions, type WorldSave } from '../world/WorldStore';

export const CAMP_MERCHANT_KEY = 'im_camp_merchant_v1';
export interface CampMerchantStock { stamp: string; tier: number; offers: ItemInstance[]; sold: boolean[] }

/** 换货凭据：最近一次结算的出征 id（每仗一条 receipt）；还没打过仗为 'none'。 */
export function campMerchantStamp(s: WorldSave = loadWorld()): string { return s.receipts.at(-1)?.id ?? 'none'; }
/** 品质档：按已打通的最高章节（同行营的 itemTier：一章 0、虎牢关 1、群雄起 2）。 */
export function campMerchantTier(s: WorldSave = loadWorld()): number { return s.warlordStages >= 3 ? 2 : s.cleared.hulao ? 1 : 0; }
export const campPrice = (item: ItemInstance): number => MERCHANT_PRICE[item.quality] ?? 120;

let memory: CampMerchantStock | null = null;
function read(): CampMerchantStock | null {
  try {
    const v = JSON.parse(localStorage.getItem(CAMP_MERCHANT_KEY) ?? 'null');
    if (v && typeof v.stamp === 'string' && Array.isArray(v.offers) && Array.isArray(v.sold) && v.offers.length === v.sold.length) return v as CampMerchantStock;
  } catch { /* 存储不可用：退回内存 */ }
  return memory;
}
function write(s: CampMerchantStock): void { memory = structuredClone(s); try { localStorage.setItem(CAMP_MERCHANT_KEY, JSON.stringify(s)); } catch { /* 只留内存 */ } }

/** 当前货架：凭据变了（打过一仗）才重摆，否则原样返回。 */
export function campMerchantStock(rng: () => number = Math.random): CampMerchantStock {
  const w = loadWorld(), stamp = campMerchantStamp(w), cur = read();
  if (cur && cur.stamp === stamp) return cur;
  const tier = campMerchantTier(w), offers = rollMerchantGear(tier, rng), next = { stamp, tier, offers, sold: offers.map(() => false) };
  write(next); return next;
}

/** 买第 i 件：扣营寨军粮、标记售出、放进行囊。 */
export function buyCampItem(i: number): { ok: boolean; message: string; item?: ItemInstance } {
  const s = campMerchantStock(), item = s.offers[i];
  if (!item) return { ok: false, message: '没有这件货' };
  if (s.sold[i]) return { ok: false, message: '这件已卖出；打完下一仗商人换新货' };
  const price = campPrice(item);
  if (!spendProvisions(price)) return { ok: false, message: '军粮不足：需要 ' + price };
  s.sold[i] = true; write(s); addItems([item]);
  return { ok: true, message: '已购入，收入行囊', item };
}
