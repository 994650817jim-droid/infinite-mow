/**
 * 城镇建设与运营（TOWN_PLAN.md · T1）：建筑表、地块、季度结算、占领城池的发展方向。纯数据与纯函数，不碰存档 / 界面。
 * 数值为第一版初值，T5 再统一平衡。
 */
import type { CityTier } from '../world/WorldCities';

export type TownBuildingId = 'barracks' | 'farm' | 'clinic' | 'house' | 'market' | 'post' | 'smithy' | 'drill' | 'granary' | 'wall' | 'tavern';
export type TaxRate = 'low' | 'mid' | 'high';
/** 占领城池发展方向：均衡（未选择，产出与旧版一致）/ 重农 / 重商 / 重军。 */
export type CityFocus = 'balanced' | 'farm' | 'trade' | 'military';
export interface Cost { merits: number; provisions: number; money: number }
export interface PlotBuilding { id: TownBuildingId; level: number }
export interface SeasonReport {
  year: number; season: number;
  /** 农田产粮、民户、税收（钱）、军粮开销、开销不足的缺口。 */
  grain: number; households: number; tax: number; upkeep: number; shortage: number;
  /** 城池按发展方向的产出。 */
  cityMerits: number; cityProvisions: number; cityMoney: number;
}
export interface TownState {
  money: number; year: number; season: number; tax: TaxRate;
  plots: Array<PlotBuilding | null>;
  focus: Record<string, CityFocus>;
  report: SeasonReport | null;
}

export const PLOT_COUNT = 12, BASE_PLOTS = 6, MAX_LEVEL = 3, START_YEAR = 184;
export const SEASONS = ['春', '夏', '秋', '冬'] as const;
/** 季节对农田产粮、军粮开销的系数（秋收、冬耗）。 */
export const SEASON_GRAIN = [1, 1, 1.5, .5], SEASON_UPKEEP = [1, 1, 1, 1.5];
export const TAX_NAME: Record<TaxRate, string> = { low: '轻税', mid: '常税', high: '重税' };
/** 每户每季的税（钱）。无市集时只能收到三成。 */
export const TAX_PER_HOUSEHOLD: Record<TaxRate, number> = { low: .3, mid: .5, high: .75 };
export const BASE_HOUSEHOLDS = 10;

export interface BuildingDef {
  name: string; max: number; build: Cost;
  /** 每级效果说明（Lv1–3）。 */
  effect: (level: number) => string;
}
const C = (merits: number, provisions: number, money = 0): Cost => ({ merits, provisions, money });
export const TOWN_BUILDINGS: Record<TownBuildingId, BuildingDef> = {
  barracks: { name: '军营', max: 1, build: C(0, 0), effect: l => `出征开局增援 ${l - 1} 人` },
  farm: { name: '农田', max: 3, build: C(10, 40), effect: l => `每季产粮 ${FARM_GRAIN[l - 1]}（秋收 ×1.5、冬 ×0.5）；最高一块农田使战后粮草 +${(l - 1) * 8}%` },
  clinic: { name: '医馆', max: 1, build: C(20, 40), effect: l => `军医治疗量 +${(l - 1) * 6}%` },
  house: { name: '民居', max: 4, build: C(0, 30), effect: l => `民户 +${HOUSE_HOUSEHOLDS[l - 1]}（税收的基础）` },
  market: { name: '市集', max: 1, build: C(30, 60), effect: l => `按民户收税 ×${MARKET_MULT[l]}（无市集只收三成）` },
  post: { name: '驿站', max: 1, build: C(40, 60, 40), effect: l => `开放商队（第 ${l} 级：每季 ${l} 支）` },
  smithy: { name: '铁匠铺', max: 1, build: C(40, 40, 60), effect: l => `打造兵器：出征开局武器升级（第 ${l} 级）` },
  drill: { name: '校场', max: 1, build: C(50, 60, 40), effect: l => `出征开局属性点 +${[1, 1, 2][l - 1]}` },
  granary: { name: '粮仓', max: 1, build: C(20, 80), effect: l => `季度军粮开销 −${GRANARY_CUT[l - 1] * 100}%；旱灾损失减半` },
  wall: { name: '城墙', max: 1, build: C(60, 100, 60), effect: l => `扩地 +${l * 2} 块；守城加成（第 ${l} 级）` },
  tavern: { name: '酒肆', max: 1, build: C(30, 40, 50), effect: l => `名士、商队等好事件更常出现（第 ${l} 级）` },
};
export const FARM_GRAIN = [20, 35, 55], HOUSE_HOUSEHOLDS = [20, 35, 55], GRANARY_CUT = [.15, .3, .45];
export const MARKET_MULT = [.3, 1, 1.3, 1.6];

/** 军营 / 农田 / 医馆沿用旧版升级价；其它建筑按建造价 ×2.2（Lv2）/ ×4.5（Lv3），且至少要 20 / 60 钱。 */
export function upgradeCostFor(id: TownBuildingId, level: number): Cost | null {
  if (level >= MAX_LEVEL) return null;
  if (id === 'barracks' || id === 'farm' || id === 'clinic') return level === 1 ? C(35, 50) : C(90, 140);
  const b = TOWN_BUILDINGS[id].build, k = level === 1 ? 2.2 : 4.5;
  return C(Math.round(b.merits * k), Math.round(b.provisions * k), Math.max(level === 1 ? 20 : 60, Math.round(b.money * k)));
}
/** 拆除返还：已投入总价的一半（向下取整）。 */
export function demolishRefund(p: PlotBuilding): Cost {
  const total = C(0, 0); const add = (c: Cost | null) => { if (c) { total.merits += c.merits; total.provisions += c.provisions; total.money += c.money; } };
  add(TOWN_BUILDINGS[p.id].build); for (let l = 1; l < p.level; l++) add(upgradeCostFor(p.id, l));
  return C(Math.floor(total.merits / 2), Math.floor(total.provisions / 2), Math.floor(total.money / 2));
}

/** 城池发展方向：各档城每次结算的产出。均衡 = 旧版固定收益。 */
export const FOCUS_NAME: Record<CityFocus, string> = { balanced: '均衡', farm: '重农', trade: '重商', military: '重军' };
export const FOCUS_INCOME: Record<CityTier, Record<CityFocus, Cost>> = {
  small: { balanced: C(0, 10), farm: C(0, 15), trade: C(0, 5, 8), military: C(4, 5) },
  medium: { balanced: C(5, 20), farm: C(3, 30), trade: C(3, 10, 16), military: C(9, 10) },
  large: { balanced: C(10, 40), farm: C(6, 60), trade: C(6, 20, 32), military: C(16, 20) },
};
/** 改发展方向的花费（钱）；从“均衡”首次选择免费。 */
export const FOCUS_CHANGE_COST: Record<CityTier, number> = { small: 20, medium: 40, large: 80 };

export function emptyTown(): TownState {
  return { money: 0, year: START_YEAR, season: 0, tax: 'mid', plots: new Array(PLOT_COUNT).fill(null), focus: {}, report: null };
}
/** 旧存档迁移：原有军营 / 农田 / 医馆按原等级放在前三块地。 */
export function migrateTown(levels: { barracks: number; farm: number; clinic: number }): TownState {
  const t = emptyTown();
  t.plots[0] = { id: 'barracks', level: levels.barracks }; t.plots[1] = { id: 'farm', level: levels.farm }; t.plots[2] = { id: 'clinic', level: levels.clinic };
  return t;
}
const IDS = Object.keys(TOWN_BUILDINGS) as TownBuildingId[];
const int = (v: unknown, max: number, min = 0): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min;
/** 读档清洗：非法内容丢弃，等级 / 数量越界夹紧。 */
export function parseTown(v: unknown, levels: { barracks: number; farm: number; clinic: number }): TownState {
  if (!v || typeof v !== 'object') return migrateTown(levels);
  const o = v as Record<string, unknown>, t = emptyTown();
  t.money = int(o.money, 1_000_000); t.year = int(o.year, 400, START_YEAR); t.season = int(o.season, 3);
  t.tax = o.tax === 'low' || o.tax === 'high' ? o.tax : 'mid';
  const counts: Partial<Record<TownBuildingId, number>> = {};
  if (Array.isArray(o.plots)) o.plots.slice(0, PLOT_COUNT).forEach((p, i) => {
    const b = p as PlotBuilding | null;
    if (!b || !IDS.includes(b.id) || (counts[b.id] ?? 0) >= TOWN_BUILDINGS[b.id].max) return;
    counts[b.id] = (counts[b.id] ?? 0) + 1; t.plots[i] = { id: b.id, level: int(b.level, MAX_LEVEL, 1) };
  });
  if (o.focus && typeof o.focus === 'object') for (const [k, f] of Object.entries(o.focus as Record<string, unknown>).slice(0, 64)) if (k.length <= 32 && (f === 'farm' || f === 'trade' || f === 'military' || f === 'balanced')) t.focus[k] = f;
  const r = o.report as SeasonReport | null;
  t.report = r && typeof r === 'object' && typeof r.grain === 'number' ? r : null;
  if (!t.plots.some(p => p?.id === 'barracks')) { const free = t.plots.findIndex(p => !p); if (free >= 0) t.plots[free] = { id: 'barracks', level: 1 }; }
  return t;
}

export function countOf(t: TownState, id: TownBuildingId): number { return t.plots.filter(p => p?.id === id).length; }
/** 某种建筑的最高等级（没有为 0）。 */
export function levelOf(t: TownState, id: TownBuildingId): number { return Math.max(0, ...t.plots.map(p => p?.id === id ? p.level : 0)); }
/** 已开放地块数：基础 6 块，城墙每级 +2。 */
export function unlockedPlots(t: TownState): number { return Math.min(PLOT_COUNT, BASE_PLOTS + levelOf(t, 'wall') * 2); }
export function households(t: TownState): number { return BASE_HOUSEHOLDS + t.plots.reduce((n, p) => n + (p?.id === 'house' ? HOUSE_HOUSEHOLDS[p.level - 1] : 0), 0); }
/** 旧版建筑等级（战斗加成仍按它计算）：没有该建筑时视为 1 级（无加成）。 */
export function legacyLevels(t: TownState): { barracks: number; farm: number; clinic: number } {
  return { barracks: Math.max(1, levelOf(t, 'barracks')), farm: Math.max(1, levelOf(t, 'farm')), clinic: Math.max(1, levelOf(t, 'clinic')) };
}
export function canAfford(have: Cost, cost: Cost): boolean { return have.merits >= cost.merits && have.provisions >= cost.provisions && have.money >= cost.money; }
export function costText(c: Cost): string { return [c.merits ? `军功 ${c.merits}` : '', c.provisions ? `粮草 ${c.provisions}` : '', c.money ? `钱 ${c.money}` : ''].filter(Boolean).join(' · ') || '免费'; }

/**
 * 季度结算（出征结束、有资格领城池产出时调用一次）：产粮、收税、城池产出、扣军粮，然后推进季节。
 * troops：后备兵总数（用于军粮开销）；cities：已占城池（档次与发展方向）；provisionsHave：开销前可用粮草。
 * 返回本季报告；调用方把 grain + cityProvisions − upkeep 计入粮草、cityMerits 计入军功、tax + cityMoney 计入钱。
 */
export function settleSeason(t: TownState, input: { troops: number; cities: Array<{ tier: CityTier; focus: CityFocus }>; provisionsHave: number; provisionsMultiplier?: number }): SeasonReport {
  const s = t.season;
  const grain = Math.round(t.plots.reduce((n, p) => n + (p?.id === 'farm' ? FARM_GRAIN[p.level - 1] : 0), 0) * SEASON_GRAIN[s]);
  const hh = households(t), market = levelOf(t, 'market');
  const tax = Math.round(hh * TAX_PER_HOUSEHOLD[t.tax] * MARKET_MULT[market]);
  let cityMerits = 0, cityProvisions = 0, cityMoney = 0;
  for (const c of input.cities) { const inc = FOCUS_INCOME[c.tier][c.focus]; cityMerits += inc.merits; cityProvisions += inc.provisions; cityMoney += inc.money; }
  cityProvisions = Math.round(cityProvisions * (input.provisionsMultiplier ?? 1));
  const need = Math.round(Math.max(0, input.troops) * SEASON_UPKEEP[s] * (1 - (GRANARY_CUT[levelOf(t, 'granary') - 1] ?? 0)));
  const available = input.provisionsHave + grain + cityProvisions, upkeep = Math.min(need, available), shortage = need - upkeep;
  const report: SeasonReport = { year: t.year, season: s, grain, households: hh, tax, upkeep, shortage, cityMerits, cityProvisions, cityMoney };
  t.money = Math.min(1_000_000, t.money + tax + cityMoney);
  t.season = (s + 1) % 4; if (t.season === 0) t.year++;
  t.report = report;
  return report;
}
export function seasonLabel(year: number, season: number): string { return `${year} 年 · ${SEASONS[season]}`; }
