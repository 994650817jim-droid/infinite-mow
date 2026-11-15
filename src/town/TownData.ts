/**
 * 城镇建设与运营（TOWN_PLAN.md · T1）：建筑表、地块、季度结算、占领城池的发展方向。纯数据与纯函数，不碰存档 / 界面。
 * 数值为第一版初值，T5 再统一平衡。
 */
import type { CityTier } from '../world/WorldCities';

export type TownBuildingId = 'hall' | 'barracks' | 'farm' | 'clinic' | 'house' | 'market' | 'post' | 'smithy' | 'drill' | 'granary' | 'wall' | 'tavern' | 'pavilion';
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
  /** T3：商队带回的钱、被劫的商队数、本季抽到的事件 id。 */
  caravanMoney?: number; caravanLost?: number; event?: string | null;
}
export interface TownState {
  money: number; year: number; season: number; tax: TaxRate;
  /** 城池建造（英雄无敌式）：每种建筑一座，0 = 未建。府衙等级即城池规模（1 小城 / 2 中城 / 3 大城）。 */
  levels: Record<TownBuildingId, number>;
  focus: Record<string, CityFocus>;
  report: SeasonReport | null;
  /** T3：下季修正、下一场出征加成、待处理事件、在途商队。 */
  mods: SeasonMods; boon: BattleBoon; pendingEvent: string | null; caravans: Caravan[];
}

export const MAX_LEVEL = 3, START_YEAR = 184;
/** 城池规模：府衙等级 1–3。 */
export const CITY_SIZE = ['', '小城', '中城', '大城'] as const, CITY_TITLE = ['', '县城', '郡城', '州府'] as const;
export const SEASONS = ['春', '夏', '秋', '冬'] as const;
/** 季节对农田产粮、军粮开销的系数（秋收、冬耗）。 */
export const SEASON_GRAIN = [1, 1, 1.5, .5], SEASON_UPKEEP = [1, 1, 1, 1.5];
export const TAX_NAME: Record<TaxRate, string> = { low: '轻税', mid: '常税', high: '重税' };
/** 每户每季的税（钱）。无市集时只能收到三成。 */
export const TAX_PER_HOUSEHOLD: Record<TaxRate, number> = { low: .3, mid: .5, high: .75 };
/** 府衙（城池规模）带来的基础民户。 */
export const HALL_HOUSEHOLDS = [10, 10, 20, 35];
export const BASE_HOUSEHOLDS = 10;

export interface BuildingDef {
  name: string; max: number; build: Cost;
  /** 每级效果说明（Lv1–3）。 */
  effect: (level: number) => string;
  /** 建造需要的城池规模（府衙等级），默认 1。 */
  minHall?: number;
  /** 一句话简介（建造面板）。 */
  blurb: string;
  /** 最高等级（默认 3；奇观只有 1 级）。 */
  maxLevel?: number;
}
const C = (merits: number, provisions: number, money = 0): Cost => ({ merits, provisions, money });
export const TOWN_BUILDINGS: Record<TownBuildingId, BuildingDef> = {
  hall: { name: '府衙', max: 1, build: C(0, 0), blurb: '一城之主，决定城池规模；其它建筑的等级不能高于府衙。', effect: l => `城池规模：${CITY_SIZE[l]}（${CITY_TITLE[l]}）；基础民户 ${HALL_HOUSEHOLDS[l]}${l < 3 ? `；可建 Lv${l} 建筑` : '；可建全部 Lv3 建筑'}` },
  barracks: { name: '军营', max: 1, build: C(0, 0), blurb: '操练义军。', effect: l => `出征开局增援 ${l - 1} 人` },
  farm: { name: '农田', max: 1, build: C(10, 40), blurb: '城外良田，四季产粮。', effect: l => `每季产粮 ${FARM_GRAIN[l - 1]}（秋收 ×1.5、冬 ×0.5）；战后粮草 +${(l - 1) * 8}%` },
  clinic: { name: '医馆', max: 1, build: C(20, 40), blurb: '延请名医，救治伤兵。', effect: l => `军医治疗量 +${(l - 1) * 6}%` },
  house: { name: '民居', max: 1, build: C(0, 30), blurb: '百姓安居，税收之本。', effect: l => `民户 +${HOUSE_HOUSEHOLDS[l - 1]}（税收的基础）` },
  market: { name: '市集', max: 1, build: C(30, 60), blurb: '商贾云集，收税与买卖粮草。', effect: l => `按民户收税 ×${MARKET_MULT[l]}（无市集只收三成）；可买卖粮草` },
  post: { name: '驿站', max: 1, build: C(40, 60, 40), minHall: 2, blurb: '驿马往来，商队通达诸城。', effect: l => `派商队载粮去己方城池换钱（每季 ${l} 支）` },
  smithy: { name: '铁匠铺', max: 1, build: C(40, 40, 60), minHall: 2, blurb: '百炼精钢，打造兵刃。', effect: l => `打造兵器：出征时本命武器伤害 +${l * 4}%` },
  drill: { name: '校场', max: 1, build: C(50, 60, 40), minHall: 2, blurb: '演武操练，将士精进。', effect: l => `出征开局属性点 +${[1, 1, 2][l - 1]}` },
  granary: { name: '粮仓', max: 1, build: C(20, 80), blurb: '广积粮，备荒年。', effect: l => `季度军粮开销 −${GRANARY_CUT[l - 1] * 100}%；旱灾损失减半` },
  wall: { name: '城墙', max: 1, build: C(60, 100, 60), blurb: '高墙深池，扩城的前提。', effect: l => `府衙升级的前提；出征时主将生命 +${l * 3}%` },
  pavilion: { name: '麒麟阁', max: 1, maxLevel: 1, build: C(400, 1200, 800), minHall: 3, blurb: '奇观：图画功臣、表彰忠义，天下英雄慕名来投。', effect: () => '出征时伤害 +6%、主将生命 +6%、开局属性点 +1' },
  tavern: { name: '酒肆', max: 1, build: C(30, 40, 50), minHall: 2, blurb: '四方豪杰汇聚之所。', effect: l => `季度好事件（名士、商队、祥瑞…）出现率 +${l * 35}%` },
};
/** 每种建筑一座：农田 / 民居的产出按等级放大（旧版最多 3 块农田、4 片民居）。 */
export const FARM_GRAIN = [30, 65, 110], HOUSE_HOUSEHOLDS = [30, 75, 140], GRANARY_CUT = [.15, .3, .45];
export const MARKET_MULT = [.3, 1, 1.3, 1.6];
/** 府衙升级：花费与前提建筑（英雄无敌式建造树）。 */
export const HALL_UPGRADE: Record<number, { cost: Cost; needs: Partial<Record<TownBuildingId, number>> }> = {
  1: { cost: C(80, 160, 120), needs: { wall: 1, house: 1, market: 1 } },
  2: { cost: C(220, 360, 360), needs: { wall: 2, house: 2, market: 2, granary: 1 } },
};

/** 军营 / 农田 / 医馆沿用旧版升级价；其它建筑按建造价 ×2.2（Lv2）/ ×4.5（Lv3），且至少要 20 / 60 钱。 */
export function upgradeCostFor(id: TownBuildingId, level: number): Cost | null {
  if (level >= (TOWN_BUILDINGS[id].maxLevel ?? MAX_LEVEL)) return null;
  if (id === 'hall') return HALL_UPGRADE[level]?.cost ?? null;
  if (id === 'barracks' || id === 'farm' || id === 'clinic') return level === 1 ? C(35, 50) : C(90, 140);
  const b = TOWN_BUILDINGS[id].build, k = level === 1 ? 2.2 : 4.5;
  return C(Math.round(b.merits * k), Math.round(b.provisions * k), Math.max(level === 1 ? 20 : 60, Math.round(b.money * k)));
}
/** 下一步（建造或升级）的花费；已满级为 null。 */
export function nextCost(t: TownState, id: TownBuildingId): Cost | null { const l = levelOf(t, id); return l <= 0 ? TOWN_BUILDINGS[id].build : upgradeCostFor(id, l); }
/** 下一步缺少的前提（城池规模、府衙前提建筑）；空数组 = 可以建造 / 升级（不含资源）。 */
export function buildBlockers(t: TownState, id: TownBuildingId): string[] {
  const l = levelOf(t, id), hall = levelOf(t, 'hall'), out: string[] = [];
  if (l >= (TOWN_BUILDINGS[id].maxLevel ?? MAX_LEVEL)) return ['已达最高等级'];
  if (id === 'hall') { for (const [b, need] of Object.entries(HALL_UPGRADE[l]?.needs ?? {}) as Array<[TownBuildingId, number]>) if (levelOf(t, b) < need) out.push(`${TOWN_BUILDINGS[b].name} Lv${need}`); return out; }
  const minHall = TOWN_BUILDINGS[id].minHall ?? 1;
  if (l === 0 && hall < minHall) out.push(`城池规模达到${CITY_SIZE[minHall]}（府衙 Lv${minHall}）`);
  else if (l + 1 > hall) out.push(`城池规模达到${CITY_SIZE[l + 1]}（府衙 Lv${l + 1}）`);
  return out;
}
/** 城池规模（府衙等级 1–3）。 */
export function citySize(t: TownState): number { return Math.max(1, Math.min(3, levelOf(t, 'hall'))); }

/** 城池发展方向：各档城每次结算的产出。均衡 = 旧版固定收益。 */
export const FOCUS_NAME: Record<CityFocus, string> = { balanced: '均衡', farm: '重农', trade: '重商', military: '重军' };
export const FOCUS_INCOME: Record<CityTier, Record<CityFocus, Cost>> = {
  small: { balanced: C(0, 10), farm: C(0, 15), trade: C(0, 5, 8), military: C(4, 5) },
  medium: { balanced: C(5, 20), farm: C(3, 30), trade: C(3, 10, 16), military: C(9, 10) },
  large: { balanced: C(10, 40), farm: C(6, 60), trade: C(6, 20, 32), military: C(16, 20) },
};
/** 改发展方向的花费（钱）；从“均衡”首次选择免费。 */
export const FOCUS_CHANGE_COST: Record<CityTier, number> = { small: 20, medium: 40, large: 80 };

export function emptyLevels(): Record<TownBuildingId, number> {
  return { hall: 1, barracks: 0, farm: 0, clinic: 0, house: 0, market: 0, post: 0, smithy: 0, drill: 0, granary: 0, wall: 0, tavern: 0, pavilion: 0 };
}
export function emptyTown(): TownState {
  return { money: 0, year: START_YEAR, season: 0, tax: 'mid', levels: emptyLevels(), focus: {}, report: null, mods: noMods(), boon: noBoon(), pendingEvent: null, caravans: [] };
}
/** 旧存档迁移：原有军营 / 农田 / 医馆保留原等级，小城起步。 */
export function migrateTown(levels: { barracks: number; farm: number; clinic: number }): TownState {
  const t = emptyTown();
  t.levels.barracks = levels.barracks; t.levels.farm = levels.farm; t.levels.clinic = levels.clinic;
  return t;
}
/**
 * 由旧版 12 块地小镇（plots）转换：每种建筑取最高等级，多座农田 / 民居每多一座再 +1 级（最高 3）；
 * 府衙 = 1 + 城墙等级（有城墙的老玩家直接是中城 / 大城）。已有建筑等级可以高于府衙，只是不能再往上升。
 */
function levelsFromPlots(plots: unknown[]): Record<TownBuildingId, number> {
  const lv = emptyLevels(), count: Partial<Record<TownBuildingId, number>> = {};
  for (const p of plots.slice(0, 12)) {
    const b = p as { id?: string; level?: number } | null;
    if (!b || !IDS.includes(b.id as TownBuildingId) || b.id === 'hall') continue;
    const id = b.id as TownBuildingId; count[id] = (count[id] ?? 0) + 1; lv[id] = Math.max(lv[id], int(b.level, MAX_LEVEL, 1));
  }
  for (const id of IDS) if ((count[id] ?? 0) > 1) lv[id] = Math.min(MAX_LEVEL, lv[id] + (count[id]! - 1));
  lv.hall = Math.min(MAX_LEVEL, 1 + lv.wall);
  return lv;
}
const IDS = Object.keys(TOWN_BUILDINGS) as TownBuildingId[];
const int = (v: unknown, max: number, min = 0): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min;
/** 读档清洗：非法内容丢弃，等级 / 数量越界夹紧。 */
export function parseTown(v: unknown, levels: { barracks: number; farm: number; clinic: number }): TownState {
  if (!v || typeof v !== 'object') return migrateTown(levels);
  const o = v as Record<string, unknown>, t = emptyTown();
  t.money = int(o.money, 1_000_000); t.year = int(o.year, 400, START_YEAR); t.season = int(o.season, 3);
  t.tax = o.tax === 'low' || o.tax === 'high' ? o.tax : 'mid';
  if (o.levels && typeof o.levels === 'object') { const l = o.levels as Record<string, unknown>; for (const id of IDS) t.levels[id] = int(l[id], MAX_LEVEL, id === 'hall' ? 1 : 0); }
  else if (Array.isArray(o.plots)) t.levels = levelsFromPlots(o.plots);
  if (o.focus && typeof o.focus === 'object') for (const [k, f] of Object.entries(o.focus as Record<string, unknown>).slice(0, 64)) if (k.length <= 32 && (f === 'farm' || f === 'trade' || f === 'military' || f === 'balanced')) t.focus[k] = f;
  const r = o.report as SeasonReport | null;
  t.report = r && typeof r === 'object' && typeof r.grain === 'number' ? r : null;
  const num = (v: unknown, lo: number, hi: number, d: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  const m = (o.mods ?? {}) as Partial<SeasonMods>, bo = (o.boon ?? {}) as Partial<BattleBoon>;
  t.mods = { taxMul: num(m.taxMul, .2, 3, 1), grainMul: num(m.grainMul, .2, 3, 1), badRisk: num(m.badRisk, -1, 3, 0) };
  t.boon = { attributePoints: int(bo.attributePoints, 5), damage: num(bo.damage, -.3, .5, 0), maxHp: num(bo.maxHp, -.3, .5, 0) };
  t.pendingEvent = typeof o.pendingEvent === 'string' && eventById(o.pendingEvent) ? o.pendingEvent : null;
  t.caravans = Array.isArray(o.caravans) ? (o.caravans as Caravan[]).filter(c => c && typeof c.to === 'string' && c.to.length <= 32).slice(0, 3).map(c => ({ to: c.to, cargo: int(c.cargo, 1000), value: int(c.value, 10000) })) : [];
  if (!t.levels.barracks) t.levels.barracks = 1;
  return t;
}

/** 某种建筑的等级（没有为 0）。 */
export function levelOf(t: TownState, id: TownBuildingId): number { return t.levels?.[id] ?? 0; }
export function households(t: TownState): number { const h = levelOf(t, 'house'); return HALL_HOUSEHOLDS[citySize(t)] + (h ? HOUSE_HOUSEHOLDS[h - 1] : 0); }
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
export function settleSeason(t: TownState, input: { troops: number; cities: Array<{ tier: CityTier; focus: CityFocus }>; provisionsHave: number; provisionsMultiplier?: number; rng?: () => number }): SeasonReport {
  const s = t.season, rng = input.rng ?? Math.random, mods = t.mods ?? noMods();
  const farm = levelOf(t, 'farm'), grain = Math.round((farm ? FARM_GRAIN[farm - 1] : 0) * SEASON_GRAIN[s] * mods.grainMul);
  const hh = households(t), market = levelOf(t, 'market');
  const tax = Math.round(hh * TAX_PER_HOUSEHOLD[t.tax] * MARKET_MULT[market] * mods.taxMul);
  // 在途商队回城（坏事件风险越高越易被劫）
  let caravanMoney = 0, caravanLost = 0;
  for (const c of t.caravans ?? []) { if (rng() < CARAVAN_LOSS * (1 + Math.max(0, mods.badRisk))) caravanLost++; else caravanMoney += c.value; }
  t.caravans = [];
  // 本季事件（已有未处理的事件时不再抽新的）
  const event = t.pendingEvent ? null : rollTownEvent(t, s, rng);
  if (event) t.pendingEvent = event.id;
  t.mods = noMods();
  let cityMerits = 0, cityProvisions = 0, cityMoney = 0;
  for (const c of input.cities) { const inc = FOCUS_INCOME[c.tier][c.focus]; cityMerits += inc.merits; cityProvisions += inc.provisions; cityMoney += inc.money; }
  cityProvisions = Math.round(cityProvisions * (input.provisionsMultiplier ?? 1));
  const need = Math.round(Math.max(0, input.troops) * SEASON_UPKEEP[s] * (1 - (GRANARY_CUT[levelOf(t, 'granary') - 1] ?? 0)));
  const available = input.provisionsHave + grain + cityProvisions, upkeep = Math.min(need, available), shortage = need - upkeep;
  const report: SeasonReport = { year: t.year, season: s, grain, households: hh, tax, upkeep, shortage, cityMerits, cityProvisions, cityMoney, caravanMoney, caravanLost, event: event?.id ?? null };
  t.money = Math.min(1_000_000, t.money + tax + cityMoney + caravanMoney);
  t.season = (s + 1) % 4; if (t.season === 0) t.year++;
  t.report = report;
  return report;
}
export function seasonLabel(year: number, season: number): string { return `${year} 年 · ${SEASONS[season]}`; }

// ———————————————— T3：随机事件、商贸、战斗加成 ————————————————
/** 下一季生效的修正（结算时用掉）。 */
export interface SeasonMods { taxMul: number; grainMul: number; badRisk: number }
/** 下一场出征的加成 / 减益（下一次有资格结算时用掉）。 */
export interface BattleBoon { attributePoints: number; damage: number; maxHp: number }
export interface Caravan { to: string; cargo: number; value: number }
export interface EventEffect { money?: number; provisions?: number; merits?: number; taxMul?: number; grainMul?: number; badRisk?: number; attributePoints?: number; damage?: number; maxHp?: number; reserve?: Record<string, number> }
export interface EventOption { label: string; note: string; effect: EventEffect }
export type EventKind = 'good' | 'bad' | 'neutral';
export interface TownEventDef { id: string; title: string; text: string; kind: EventKind; weight: number; seasons?: number[]; requires?: TownBuildingId; minTax?: TaxRate; options: [EventOption, EventOption] }

const O = (label: string, note: string, effect: EventEffect): EventOption => ({ label, note, effect });
/** 约 20 种季度事件。note 为给玩家看的效果说明。 */
export const TOWN_EVENTS: TownEventDef[] = [
  { id: 'drought', title: '旱魃为虐', text: '入夏无雨，田垄龟裂，乡民望天兴叹。', kind: 'bad', weight: 10, seasons: [1, 2], options: [O('开仓赈济', '粮草 −40；百姓感恩，下季税收 +20%', { provisions: -40, taxMul: 1.2 }), O('听天由命', '下季税收 −30%', { taxMul: .7 })] },
  { id: 'refugees', title: '流民投奔', text: '数百流民扶老携幼来到营寨外，请求收留。', kind: 'neutral', weight: 10, options: [O('开门收留', '粮草 −30；民户增多，下季税收 +25%', { provisions: -30, taxMul: 1.25 }), O('好言劝走', '无事；但流民落草，下季坏事件更易发生', { badRisk: .5 })] },
  { id: 'western_caravan', title: '西域商队', text: '一支西域驼队途经营寨，愿以重金收购本地土产。', kind: 'good', weight: 8, options: [O('出售土产', '钱 +40', { money: 40 }), O('换取精铁', '下一场出征本命武器伤害 +5%', { damage: .05 })] },
  { id: 'scholar', title: '名士来访', text: '一位游学名士途经此地，愿留营中参赞军机数日。', kind: 'good', weight: 7, options: [O('厚礼相待', '钱 −30；下一场出征开局属性点 +1', { money: -30, attributePoints: 1 }), O('以礼送别', '军功 +5', { merits: 5 })] },
  { id: 'bandits', title: '盗匪劫掠', text: '山中盗匪趁夜劫掠了城外村落。', kind: 'bad', weight: 10, options: [O('发兵清剿', '军功 +15、粮草 −20', { merits: 15, provisions: -20 }), O('暂且忍耐', '钱 −20（损失财物）', { money: -20 })] },
  { id: 'harvest_festival', title: '丰年祭', text: '秋收在望，乡老请求举办丰年祭祀。', kind: 'good', weight: 8, seasons: [1, 2], options: [O('隆重举办', '钱 −20；下季产粮 +30%', { money: -20, grainMul: 1.3 }), O('一切从简', '钱 +5', { money: 5 })] },
  { id: 'plague', title: '疫病流行', text: '营中出现时疫，不少士卒发热卧床。', kind: 'bad', weight: 7, options: [O('延医施药', '钱 −30', { money: -30 }), O('静待自愈', '下一场出征主将生命 −5%', { maxHp: -.05 })] },
  { id: 'gentry_grain', title: '豪强献粮', text: '本地豪强遣人送来粮车，言辞恭顺。', kind: 'good', weight: 8, options: [O('收下粮车', '粮草 +50', { provisions: 50 }), O('婉言谢绝', '清名远播，军功 +10', { merits: 10 })] },
  { id: 'yellow_remnants', title: '黄巾余党', text: '一股黄巾余党盘踞附近山谷，时出时没。', kind: 'bad', weight: 7, options: [O('招安收编', '粮草 −20；后备刀盾兵 +2', { provisions: -20, reserve: { swordsman: 2 } }), O('出兵剿灭', '粮草 −10；下一场出征伤害 +3%', { provisions: -10, damage: .03 })] },
  { id: 'smith_master', title: '铁匠求师', text: '铁匠铺的学徒想拜访名匠，求一笔盘缠。', kind: 'good', weight: 6, requires: 'smithy', options: [O('资助学艺', '钱 −25；下一场出征伤害 +6%', { money: -25, damage: .06 }), O('不必远行', '钱 +5', { money: 5 })] },
  { id: 'merchant_loan', title: '商贾借贷', text: '大商贾愿借钱给营寨，约定下季以税抵债。', kind: 'neutral', weight: 6, options: [O('借钱', '钱 +60；下季税收 −20%', { money: 60, taxMul: .8 }), O('不借', '无事', {})] },
  { id: 'locusts', title: '蝗灾', text: '蝗群自西而来，遮天蔽日。', kind: 'bad', weight: 7, seasons: [1, 2], options: [O('组织扑蝗', '粮草 −15', { provisions: -15 }), O('听天由命', '下季产粮 −50%', { grainMul: .5 })] },
  { id: 'deserters', title: '降卒来投', text: '一队溃散的官军前来投靠，愿效犬马之劳。', kind: 'good', weight: 6, options: [O('收编入营', '粮草 −20；后备长枪兵 +2', { provisions: -20, reserve: { spearman: 2 } }), O('发放路费', '钱 −10；军功 +8', { money: -10, merits: 8 })] },
  { id: 'omen', title: '天降祥瑞', text: '营寨后山现出五彩祥云，军民议论纷纷。', kind: 'good', weight: 5, options: [O('设坛祭天', '钱 −20；下一场出征开局属性点 +1', { money: -20, attributePoints: 1 }), O('不以为意', '军功 +5', { merits: 5 })] },
  { id: 'flood_road', title: '暴雨毁路', text: '连日暴雨冲毁了通往城外的道路。', kind: 'bad', weight: 7, seasons: [0, 1], options: [O('拨钱修路', '钱 −25', { money: -25 }), O('暂不修缮', '商旅不通，下季税收 −20%', { taxMul: .8 })] },
  { id: 'school', title: '学子求学', text: '乡里学子请求在营中开设学堂。', kind: 'neutral', weight: 6, options: [O('开设学堂', '钱 −30；下季税收 +15%', { money: -30, taxMul: 1.15 }), O('军务繁忙', '无事', {})] },
  { id: 'brawl', title: '军中斗殴', text: '两营士卒因琐事斗殴，各有损伤。', kind: 'bad', weight: 6, options: [O('严明军纪', '下一场出征伤害 +3%（军纪严明）', { damage: .03 }), O('从轻发落', '军功 −5', { merits: -5 })] },
  { id: 'passing_caravan', title: '远方商旅', text: '经驿站来往的商旅想收购一批粮草。', kind: 'good', weight: 7, requires: 'post', options: [O('卖粮', '粮草 −30、钱 +35', { provisions: -30, money: 35 }), O('留粮自用', '无事', {})] },
  { id: 'elders_tax', title: '乡老请命', text: '乡老联名上书，言重税之下民不聊生。', kind: 'bad', weight: 12, minTax: 'high', options: [O('暂缓征收', '下季税收 −10%，坏事件减少', { taxMul: .9, badRisk: -.5 }), O('置之不理', '民怨渐起，下季坏事件更易发生', { badRisk: .8 })] },
  { id: 'cold_wave', title: '寒潮来袭', text: '朔风骤起，大雪封路，士卒衣单。', kind: 'bad', weight: 9, seasons: [3], options: [O('发放寒衣', '钱 −20', { money: -20 }), O('咬牙坚持', '下一场出征主将生命 −5%', { maxHp: -.05 })] },
  { id: 'wine_feast', title: '犒赏三军', text: '酒肆掌柜献上美酒，请为将士庆功。', kind: 'good', weight: 6, requires: 'tavern', options: [O('设宴犒军', '钱 −15；下一场出征伤害 +4%', { money: -15, damage: .04 }), O('留待凯旋', '钱 +10', { money: 10 })] },
];
export const EVENT_CHANCE = .75;
const TAX_RANK: Record<TaxRate, number> = { low: 0, mid: 1, high: 2 };
const TAX_BAD: Record<TaxRate, number> = { low: .6, mid: 1, high: 1.6 };

/** 按季节、建筑、税率、酒肆与坏事件风险加权抽取一个事件（可能为空）。 */
export function rollTownEvent(t: TownState, season: number, rng: () => number = Math.random): TownEventDef | null {
  if (rng() >= EVENT_CHANCE) return null;
  const tavern = levelOf(t, 'tavern'), risk = Math.max(0, 1 + (t.mods?.badRisk ?? 0));
  const pool = TOWN_EVENTS.filter(e => (!e.seasons || e.seasons.includes(season)) && (!e.requires || levelOf(t, e.requires) > 0) && (!e.minTax || TAX_RANK[t.tax] >= TAX_RANK[e.minTax]))
    .map(e => ({ e, w: e.weight * (e.kind === 'bad' ? TAX_BAD[t.tax] * risk : e.kind === 'good' ? 1 + tavern * .35 : 1) }));
  const total = pool.reduce((n, x) => n + x.w, 0); let r = rng() * total;
  for (const x of pool) { r -= x.w; if (r <= 0) return x.e; }
  return pool.at(-1)?.e ?? null;
}
export function eventById(id: string): TownEventDef | undefined { return TOWN_EVENTS.find(e => e.id === id); }

// —— 商贸 ——
/** 市集卖粮 / 买粮价（每 1 粮的钱）；市集等级越高越划算。 */
export function grainSellPrice(t: TownState): number { return [0, .35, .42, .5][levelOf(t, 'market')]; }
export function grainBuyPrice(t: TownState): number { return [0, .7, .62, .55][levelOf(t, 'market')]; }
/** 商队：带粮去己方城池，下季带钱回来。去重商城池 ×1.3，大城 ×1.2、中城 ×1.1。 */
export function caravanValue(cargo: number, tier: CityTier, focus: CityFocus): number { return Math.round(cargo * .6 * (focus === 'trade' ? 1.3 : 1) * (tier === 'large' ? 1.2 : tier === 'medium' ? 1.1 : 1)); }
export const CARAVAN_CARGO = [30, 60], CARAVAN_LOSS = .08;
export function caravanSlots(t: TownState): number { return levelOf(t, 'post'); }

// —— 建筑的出征加成 ——
/** 校场：开局属性点；铁匠铺：本命武器伤害；城墙：主将生命。 */
export function buildingBattleEffects(t: TownState): BattleBoon {
  const pav = levelOf(t, 'pavilion') > 0 ? 1 : 0;
  return { attributePoints: [0, 1, 1, 2][levelOf(t, 'drill')] + pav, damage: [0, .04, .08, .12][levelOf(t, 'smithy')] + pav * .06, maxHp: [0, .03, .06, .09][levelOf(t, 'wall')] + pav * .06 };
}

export function noMods(): SeasonMods { return { taxMul: 1, grainMul: 1, badRisk: 0 }; }
export function noBoon(): BattleBoon { return { attributePoints: 0, damage: 0, maxHp: 0 }; }

/** 已导入的小镇建筑美术等级（public/assets/town/<建筑>_<等级>.webp，tools/prepare-town-art.mjs 切图）。缺某级时用不高于它的最高已有等级。 */
export const TOWN_ART_LEVELS: number[] = [1, 2, 3];
export function townArtLevel(level: number): number { let best = 0; for (const l of TOWN_ART_LEVELS) if (l <= level && l > best) best = l; return best; }
