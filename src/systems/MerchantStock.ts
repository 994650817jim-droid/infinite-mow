import {rollMerchantGear,type ItemInstance} from '../data/items';
import {TACTICS,type TacticId} from '../data/builds';
import {rollMerchantTactic,type CampOffer} from './CampMarket';
import {SCHOOL_IDS} from '../data/schools';

/**
 * 军需商人的货架（2026-11-18）：行营休整与义军营寨「旅商」是同一个商人、同一份货。
 * 只存一份「当前货架」（localStorage），连同已售标记：
 * - 行营休整用本关的休整键（如 'yellow-2'、'guandu-3'）打开；键变了（又打赢一关）才换新货；
 * - 营寨旅商不换货，只打开当前货架（还没有货时按当前进度摆一份）。
 * 来回切换、关页面重开都不会刷出新货，也不会把卖掉的补回来。
 */
export interface MerchantStock {key: string; items: ItemInstance[]; sold: boolean[]; tactic: CampOffer | null;}
/** 判定战法卷轴用的构筑（本局构筑 RunBuild，或营寨里读出的征程构筑，见 campaignTacticBook）。 */
export interface TacticBook {canLearn(id: TacticId): boolean; level(id: TacticId): number; manualsRead?(): readonly import('../data/schools').SchoolId[];}

const KEY = 'im_merchant_v1';
let memo: MerchantStock | null = null; // 本页内唯一的一份（行营与营寨拿到的是同一个对象，任一边买了另一边立刻看到）；刷新页面后从存储读回

function valid(v: unknown): v is MerchantStock {
  const s = v as MerchantStock;
  return !!s && typeof s.key === 'string' && Array.isArray(s.items) && Array.isArray(s.sold) && s.items.length === s.sold.length
    && (s.tactic === null || (!!s.tactic && Number.isFinite(s.tactic.price) && (s.tactic.kind === 'manual' ? SCHOOL_IDS.includes(s.tactic.school) : s.tactic.id in TACTICS)));
}
function read(): MerchantStock | null {
  if (memo) return memo;
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (valid(v)) memo = v; } catch { /* 存储不可用 */ }
  return memo;
}
/** 买下 / 改动后写回。 */
export function saveMerchantStock(s: MerchantStock): void {
  memo = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 存储不可用：只留内存 */ }
}
function roll(key: string, tier: number, book?: TacticBook, rng: () => number = Math.random, chapter = 1): MerchantStock {
  const items = rollMerchantGear(tier, rng, chapter);
  return {key, items, sold: items.map(() => false), tactic: book ? rollMerchantTactic(book, rng) : null};
}
/** 行营休整：visit 与当前货架的键相同就沿用（含已售），不同就按本关进度换新货。 */
export function merchantStockForVisit(visit: string, tier: number, book?: TacticBook, chapter = 1): MerchantStock {
  const cur = read(); if (cur && cur.key === visit) return cur;
  const s = roll(visit, tier, book, Math.random, chapter); saveMerchantStock(s); return s;
}
/** 营寨旅商：打开当前货架；从没进过行营（还没有货）时摆一份（键 'camp'，下次打赢一关的休整会换掉）。 */
export function currentMerchantStock(tier: number, book?: TacticBook, chapter = 1): MerchantStock {
  const cur = read(); if (cur) return cur;
  const s = roll('camp', tier, book, Math.random, chapter); saveMerchantStock(s); return s;
}
/** 测试用：清空货架。 */
export function resetMerchantStock(): void { memo = null; try { localStorage.removeItem(KEY); } catch { /* */ } }
