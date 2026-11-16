/**
 * 义军营寨（主城）：建筑表、按章节分阶段开放、每场出征后的结算。纯数据与纯函数，不碰存档 / 界面。
 * 2026-11-16 简化（用户批准，见共享笔记 city-simplify-proposal.md）：
 * - 只有一种货币「军粮」（存档字段 provisions）；军功、钱、税收、民户、市集、商队、季度事件全部取消。
 * - 营寨（第一章后）→ 县城（第二章后）→ 州府（第三章后或占领第一座城）逐步开放建筑。
 * - 原医馆 / 铁匠铺 / 校场 / 城墙的出征加成搬进讲武堂科技树（src/data/tech.ts）。
 * 数值为占位初值，由「平衡与数值」会话调整。
 */
import type { CityTier } from '../world/WorldCities';
import { TECH_IDS, type TechId } from '../data/tech';

export type TownBuildingId = 'hall' | 'barracks' | 'farm' | 'academy' | 'stable' | 'granary' | 'pavilion';
/** 占领城池的发展方向：均衡（默认）/ 重农（多产军粮）/ 重军（少产粮，每场送后备兵）。 */
export type CityFocus = 'balanced' | 'farm' | 'military';
/** 花费：一律是军粮。 */
export type Cost = number;
export interface SeasonReport {
  year: number; season: number;
  /** 农田产粮、城池产粮、城池送来的后备兵、后备兵口粮、缺口。 */
  grain: number; cityGrain: number; cityTroops: number; upkeep: number; shortage: number;
  /** 军情：本次流寇未平、产出减半的城池名。 */
  raided?: string[];
}
export interface TownState {
  /** 内部计数：每场出征结算推进一“季”，军情事件按它过期；界面不再显示年份季节。 */
  year: number; season: number;
  /** 每种建筑一座，0 = 未建。主帐等级即营寨规模（1 营寨 / 2 县城 / 3 州府）。 */
  levels: Record<TownBuildingId, number>;
  focus: Record<string, CityFocus>;
  report: SeasonReport | null;
  /** 讲武堂已研究的科技。 */
  tech: TechId[];
  /** 粮仓「开仓募兵」上次使用的季（年-季），每季一次。 */
  levied?: string;
}
/** 主帐升级的章节前提。 */
export interface TownProgress { hulao: boolean; bigCity: boolean }

/** 旧货币折算成军粮：军功 ×a、钱 ×b（旧存档迁移，以及仍按军功 / 钱给出的奖励表）。占位，平衡会话定。 */
export const MERIT_TO_GRAIN = 1.5, MONEY_TO_GRAIN = 1.5;
export const MAX_LEVEL = 3, START_YEAR = 184;
export const CITY_SIZE = ['', '营寨', '县城', '州府'] as const, CITY_TITLE = ['', '义军营寨', '县城', '州府'] as const;
export const SEASONS = ['春', '夏', '秋', '冬'] as const;

export interface BuildingDef {
  name: string; build: Cost; blurb: string;
  effect: (level: number) => string;
  /** 建造需要的营寨规模（主帐等级），默认 1。 */
  minHall?: number;
  /** 最高等级（默认 3；奇观只有 1 级）。 */
  maxLevel?: number;
  /** 升级价（Lv1→2、Lv2→3）。 */
  upgrade?: [Cost, Cost];
}
/** 农田每场产粮；粮仓减口粮；马厩可养马数；开仓募兵人数。 */
export const FARM_GRAIN = [0, 20, 45, 80], GRANARY_CUT = [0, .2, .35, .5], STABLE_HORSES = [0, 2, 4, 6], LEVY_SOLDIERS = [0, 2, 3, 4];
export const LEVY_COST = { base: 100, perSoldier: 25 };
export function levyCost(level: number): Cost { return LEVY_COST.base + LEVY_COST.perSoldier * LEVY_SOLDIERS[level]; }
export const TOWN_BUILDINGS: Record<TownBuildingId, BuildingDef> = {
  hall: { name: '主帐', build: 0, blurb: '义军中枢，决定营寨规模；其它建筑的等级不能高于主帐。', effect: l => `规模：${CITY_TITLE[l]}${l < 3 ? `；可建 Lv${l} 建筑` : '；可建全部 Lv3 建筑'}` },
  barracks: { name: '军营', build: 0, upgrade: [120, 320], blurb: '操练义军，招募后备兵。', effect: l => `招募后备兵；出征开局增援 ${l - 1} 人` },
  farm: { name: '农田', build: 0, upgrade: [100, 280], blurb: '营外良田，每打完一仗收一次粮。', effect: l => `每场出征后产军粮 ${FARM_GRAIN[l]}；战场军粮收益 +${(l - 1) * 8}%` },
  academy: { name: '讲武堂', build: 100, upgrade: [260, 600], blurb: '研习兵法、改良军械：研究科技。', effect: l => `可研究第 ${l} 层科技（军需 / 兵略 / 武备）` },
  stable: { name: '马厩', build: 200, upgrade: [360, 700], minHall: 2, blurb: '养马换马之所；只能在营中休整时换马。', effect: l => `可养马 ${STABLE_HORSES[l]} 匹；在此更换坐骑` },
  granary: { name: '粮仓', build: 160, upgrade: [320, 640], minHall: 2, blurb: '广积粮：后备兵吃得少，荒时可开仓募兵。', effect: l => `后备兵口粮 −${GRANARY_CUT[l] * 100}%；每季可开仓募兵 ${LEVY_SOLDIERS[l]} 人` },
  pavilion: { name: '麒麟阁', build: 2000, maxLevel: 1, minHall: 3, blurb: '奇观：图画功臣、表彰忠义，天下英雄慕名来投。', effect: () => '出征时伤害 +6%、主将生命 +6%、开局属性点 +1' },
};
/** 主帐扩建：花费与章节前提。 */
export const HALL_UPGRADE: Record<number, { cost: Cost; needs: string; ok: (p: TownProgress) => boolean }> = {
  1: { cost: 300, needs: '第二章（讨董）通关', ok: p => p.hulao },
  2: { cost: 800, needs: '第三章通关或占领一座城池', ok: p => p.bigCity },
};

export function upgradeCostFor(id: TownBuildingId, level: number): Cost | null {
  if (level >= (TOWN_BUILDINGS[id].maxLevel ?? MAX_LEVEL)) return null;
  if (id === 'hall') return HALL_UPGRADE[level]?.cost ?? null;
  return TOWN_BUILDINGS[id].upgrade?.[level - 1] ?? null;
}
/** 下一步（建造或升级）的花费；已满级为 null。 */
export function nextCost(t: TownState, id: TownBuildingId): Cost | null { const l = levelOf(t, id); return l <= 0 ? TOWN_BUILDINGS[id].build : upgradeCostFor(id, l); }
/** 下一步缺少的前提；空数组 = 可以建造 / 升级（不含军粮）。 */
export function buildBlockers(t: TownState, id: TownBuildingId, p: TownProgress): string[] {
  const l = levelOf(t, id), hall = levelOf(t, 'hall'), out: string[] = [];
  if (l >= (TOWN_BUILDINGS[id].maxLevel ?? MAX_LEVEL)) return ['已达最高等级'];
  if (id === 'hall') { const u = HALL_UPGRADE[l]; if (u && !u.ok(p)) out.push(u.needs); return out; }
  const minHall = TOWN_BUILDINGS[id].minHall ?? 1;
  if (l === 0 && hall < minHall) out.push(`扩建为${CITY_SIZE[minHall]}`);
  else if (l + 1 > hall) out.push(`扩建为${CITY_SIZE[l + 1]}`);
  return out;
}
/** 建筑是否已在当前规模开放（未开放的不在营中显示）。 */
export function buildingOpen(t: TownState, id: TownBuildingId): boolean { return levelOf(t, id) > 0 || citySize(t) >= (TOWN_BUILDINGS[id].minHall ?? 1); }
export function citySize(t: TownState): number { return Math.max(1, Math.min(3, levelOf(t, 'hall'))); }
/** 城池发展方向在州府开放。 */
export function focusOpen(t: TownState): boolean { return citySize(t) >= 3; }

export const FOCUS_NAME: Record<CityFocus, string> = { balanced: '均衡', farm: '重农', military: '重军' };
/** 各档城每场结算的产出：军粮与后备兵。 */
export const FOCUS_INCOME: Record<CityTier, Record<CityFocus, { grain: number; troops: number }>> = {
  small: { balanced: { grain: 10, troops: 0 }, farm: { grain: 16, troops: 0 }, military: { grain: 5, troops: 1 } },
  medium: { balanced: { grain: 28, troops: 0 }, farm: { grain: 40, troops: 0 }, military: { grain: 14, troops: 1 } },
  large: { balanced: { grain: 55, troops: 0 }, farm: { grain: 80, troops: 0 }, military: { grain: 28, troops: 2 } },
};
export function incomeText(i: { grain: number; troops: number }): string { return `军粮 +${i.grain}${i.troops ? ` · 后备兵 +${i.troops}` : ''}`; }
/** 改发展方向的花费（军粮）；从“均衡”首次选择免费。 */
export const FOCUS_CHANGE_COST: Record<CityTier, number> = { small: 30, medium: 60, large: 120 };

export function emptyLevels(): Record<TownBuildingId, number> {
  return { hall: 1, barracks: 1, farm: 1, academy: 0, stable: 0, granary: 0, pavilion: 0 };
}
export function emptyTown(): TownState {
  return { year: START_YEAR, season: 0, levels: emptyLevels(), focus: {}, report: null, tech: [] };
}
/** 很早的旧存档（只有军营 / 农田 / 医馆）：保留军营、农田等级，医馆 Lv2+ 换成科技「医术」。 */
export function migrateTown(levels: { barracks: number; farm: number; clinic: number }): TownState {
  const t = emptyTown();
  t.levels.barracks = Math.max(1, Math.min(MAX_LEVEL, levels.barracks || 1)); t.levels.farm = Math.max(1, Math.min(MAX_LEVEL, levels.farm || 1));
  if (levels.clinic >= 2) { t.tech.push('medicine'); t.levels.academy = 1; }
  return t;
}

/**
 * v8 → v9：功能整体删除的建筑（民居、市集、驿站、酒肆）按 v8 价目 100% 退还（平衡会话建议，统筹要求迁移无损）。
 * 医馆、铁匠铺、校场、城墙已换成对应科技，不另退。v8 价目：建造价；Lv2 = 建造价 ×2.2、Lv3 = ×4.5，钱至少 20 / 60。
 */
export const REMOVED_REFUND_RATE = 1;
const V8_BUILD: Record<'house' | 'market' | 'post' | 'tavern', [number, number, number]> = { house: [0, 30, 0], market: [30, 60, 0], post: [40, 60, 40], tavern: [30, 40, 50] };
/** 某座已删建筑升到 level 一共花过多少（折成军粮）。 */
export function v8Spent(id: keyof typeof V8_BUILD, level: number): number {
  const [m, p, $] = V8_BUILD[id]; let total = 0;
  for (let l = 1; l <= Math.min(MAX_LEVEL, level); l++) {
    const k = l === 1 ? 1 : l === 2 ? 2.2 : 4.5, money = l === 1 ? $ : Math.max(l === 2 ? 20 : 60, Math.round($ * k));
    total += Math.round(m * k) * MERIT_TO_GRAIN + Math.round(p * k) + money * MONEY_TO_GRAIN;
  }
  return Math.round(total * REMOVED_REFUND_RATE);
}
const IDS = Object.keys(TOWN_BUILDINGS) as TownBuildingId[];
const int = (v: unknown, max: number, min = 0): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min;
/** 旧版 12 块地（plots）：每种建筑取最高等级，多座再 +1 级。 */
function levelsFromPlots(plots: unknown[]): Record<string, number> {
  const lv: Record<string, number> = {}, count: Record<string, number> = {};
  for (const p of plots.slice(0, 12)) {
    const b = p as { id?: string; level?: number } | null;
    if (!b || typeof b.id !== 'string' || b.id === 'hall') continue;
    count[b.id] = (count[b.id] ?? 0) + 1; lv[b.id] = Math.max(lv[b.id] ?? 0, int(b.level, MAX_LEVEL, 1));
  }
  for (const id of Object.keys(count)) if (count[id] > 1) lv[id] = Math.min(MAX_LEVEL, lv[id] + count[id] - 1);
  lv.hall = Math.min(MAX_LEVEL, 1 + (lv.wall ?? 0));
  return lv;
}
/**
 * 读档清洗。v9 读入照常；v8 及更早的城镇换算成新结构，并返回要折成军粮的旧钱（money）与删掉建筑的退还（refund）。
 */
export function parseTown(v: unknown, legacy: { barracks: number; farm: number; clinic: number }): { town: TownState; money: number; refund: number } {
  if (!v || typeof v !== 'object') return { town: migrateTown(legacy), money: 0, refund: 0 };
  const o = v as Record<string, unknown>, t = emptyTown();
  t.year = int(o.year, 400, START_YEAR); t.season = int(o.season, 3);
  const old: Record<string, number> = o.levels && typeof o.levels === 'object' ? Object.fromEntries(Object.entries(o.levels as Record<string, unknown>).map(([k, x]) => [k, int(x, MAX_LEVEL)])) : Array.isArray(o.plots) ? levelsFromPlots(o.plots) : {};
  for (const id of IDS) if (id in old) t.levels[id] = Math.min(TOWN_BUILDINGS[id].maxLevel ?? MAX_LEVEL, old[id]);
  t.levels.hall = Math.max(1, t.levels.hall); t.levels.barracks = Math.max(1, t.levels.barracks); t.levels.farm = Math.max(1, t.levels.farm);
  if (o.focus && typeof o.focus === 'object') for (const [k, f] of Object.entries(o.focus as Record<string, unknown>).slice(0, 64)) if (k.length <= 32 && (f === 'farm' || f === 'military')) t.focus[k] = f;
  const r = o.report as SeasonReport | null;
  t.report = r && typeof r === 'object' && typeof r.grain === 'number' && typeof r.cityGrain === 'number' ? r : null;
  t.levied = typeof o.levied === 'string' && o.levied.length <= 16 ? o.levied : undefined;
  let money = 0, refund = 0;
  if (Array.isArray(o.tech)) t.tech = [...new Set(o.tech.filter((x): x is TechId => TECH_IDS.includes(x as TechId)))];
  else {
    // v8 及更早：旧加成建筑 → 科技（免费点亮），删掉的建筑按等级退军粮，旧钱与在途商队折算。
    const lv = (id: string) => old[id] ?? 0, tech = new Set<TechId>();
    if (lv('clinic') >= 2) tech.add('medicine');
    if (lv('smithy') >= 1) tech.add('forge'); if (lv('smithy') >= 3) tech.add('forge2');
    if (lv('wall') >= 1) tech.add('armor');
    if (lv('drill') >= 1) { tech.add('forge'); tech.add('drill_points'); }
    t.tech = [...tech];
    if (t.tech.length) t.levels.academy = Math.max(1, Math.min(t.levels.hall, Math.max(lv('smithy'), lv('drill'), lv('wall'), lv('clinic') - 1)));
    for (const id of Object.keys(V8_BUILD) as Array<keyof typeof V8_BUILD>) refund += v8Spent(id, lv(id));
    money = int(o.money, 9_999_999);
    if (Array.isArray(o.caravans)) for (const c of o.caravans.slice(0, 3) as Array<{ value?: unknown }>) money += int(c?.value, 10000);
  }
  return { town: t, money, refund };
}

export function levelOf(t: TownState, id: TownBuildingId): number { return t.levels?.[id] ?? 0; }
/** 战斗加成仍按旧的 军营 / 农田 / 医馆 等级计算；医馆已并入科技，固定为 1（无加成）。 */
export function legacyLevels(t: TownState): { barracks: number; farm: number; clinic: number } {
  return { barracks: Math.max(1, levelOf(t, 'barracks')), farm: Math.max(1, levelOf(t, 'farm')), clinic: 1 };
}
export function costText(c: Cost): string { return c ? `军粮 ${c}` : '免费'; }

/**
 * 每场出征结算一次（胜利或坚持 60 秒以上）：农田产粮、城池产出、扣后备兵口粮，然后推进内部季度计数。
 * 返回报告；调用方把 grain + cityGrain − upkeep 计入军粮，cityTroops 加进后备兵。
 */
export function settleSeason(t: TownState, input: { troops: number; cities: Array<{ tier: CityTier; focus: CityFocus; mult?: number }>; provisionsHave: number; provisionsMultiplier?: number }): SeasonReport {
  const s = t.season, grain = FARM_GRAIN[Math.max(1, levelOf(t, 'farm'))];
  let cityGrain = 0, cityTroops = 0;
  for (const c of input.cities) { const inc = FOCUS_INCOME[c.tier][c.focus], m = c.mult ?? 1; cityGrain += Math.round(inc.grain * m); cityTroops += m < 1 ? 0 : inc.troops; }
  cityGrain = Math.round(cityGrain * (input.provisionsMultiplier ?? 1));
  const need = Math.round(Math.max(0, input.troops) * (1 - GRANARY_CUT[levelOf(t, 'granary')]));
  const available = input.provisionsHave + grain + cityGrain, upkeep = Math.min(need, available), shortage = need - upkeep;
  const report: SeasonReport = { year: t.year, season: s, grain, cityGrain, cityTroops, upkeep, shortage };
  t.season = (s + 1) % 4; if (t.season === 0) t.year++;
  t.report = report;
  return report;
}
export function seasonLabel(year: number, season: number): string { return `${year} 年 · ${SEASONS[season]}`; }

/** 主将加成：麒麟阁（其余加成来自科技）。 */
export interface BattleBoon { attributePoints: number; damage: number; maxHp: number }
export function buildingBattleEffects(t: TownState): BattleBoon {
  const pav = levelOf(t, 'pavilion') > 0 ? 1 : 0;
  return { attributePoints: pav, damage: pav * .06, maxHp: pav * .06 };
}

/** 已导入的小镇建筑美术等级（public/assets/town/<建筑>_<等级>.webp）。缺某级时用不高于它的最高已有等级。 */
export const TOWN_ART_LEVELS: number[] = [1, 2, 3];
export function townArtLevel(level: number): number { let best = 0; for (const l of TOWN_ART_LEVELS) if (l <= level && l > best) best = l; return best; }
