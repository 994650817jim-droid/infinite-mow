/**
 * 城池建设（用户 2026-11-17 批准，方案见共享笔记 city-build-proposal.md）：每座占领的城池有自己的建筑，
 * 营寨管人和兵，城池管粮和兵源。第一批三种建筑：府衙、屯田、募兵所。
 * 用户 2026-11-17：「其他城市也不需要这么多建筑，城墙箭楼感觉没用，之后再说」——城墙箭楼不做，城池建筑保持精简。
 * 所有数值为初值，待「平衡与数值」会话复核。
 */
import type { CityTier } from '../world/WorldCities';

export type CityBuildingId = 'office' | 'tuntian' | 'muster';
export const CITY_BUILDING_IDS: CityBuildingId[] = ['office', 'tuntian', 'muster'];
export type CityLevels = Record<CityBuildingId, number>;

export interface CityBuildingDef {
  name: string; blurb: string;
  /** 各档城池的最高等级（0 = 该档不能建）。 */
  max: Record<CityTier, number>;
  /** 第 1–3 级的基础价（军粮），再乘档次系数 TIER_COST。府衙 1 级占领即得，价格 0。 */
  cost: [number, number, number];
  effect: (level: number, tier: CityTier) => string;
}

/** 档次系数：同一座建筑，大城更贵。 */
export const TIER_COST: Record<CityTier, number> = { small: 1, medium: 1.5, large: 2 };
/** 档次基础产粮（每战），即原「均衡」产出。 */
export const CITY_BASE_GRAIN: Record<CityTier, number> = { small: 10, medium: 28, large: 55 };
/** 府衙每级（1 级以上）基础产粮 +25%。 */
export const OFFICE_BONUS = 0.25;
/** 屯田每级每战产粮。 */
export const TUNTIAN_GRAIN: Record<CityTier, number> = { small: 10, medium: 15, large: 25 };
/** 募兵所每级每战送后备兵人数（大城每级 2 人，保证原「重军」大城不吃亏）。 */
export const MUSTER_TROOPS: Record<CityTier, number> = { small: 1, medium: 1, large: 2 };

export const CITY_BUILDINGS: Record<CityBuildingId, CityBuildingDef> = {
  office: { name: '府衙', blurb: '一城之治所。城池等级，其它建筑的等级不能高于府衙。', max: { small: 2, medium: 3, large: 3 }, cost: [0, 200, 500],
    effect: l => `城池等级 ${l}；基础产粮 +${Math.round(OFFICE_BONUS * (l - 1) * 100)}%` },
  tuntian: { name: '屯田', blurb: '兵农合一，开荒屯田。每打完一仗收一次粮。', max: { small: 2, medium: 3, large: 3 }, cost: [80, 200, 450],
    effect: (l, t) => `每战产军粮 +${TUNTIAN_GRAIN[t] * l}` },
  muster: { name: '募兵所', blurb: '招募本地子弟，补充后备。', max: { small: 1, medium: 2, large: 3 }, cost: [100, 260, 520],
    effect: (l, t) => `每战送后备兵 ${MUSTER_TROOPS[t] * l} 人（军营已解锁的基础兵种）` },
};

export const emptyCityLevels = (): CityLevels => ({ office: 1, tuntian: 0, muster: 0 });

/** 下一级的价格（军粮）；满级或该档不能建为 null。 */
export function cityBuildCost(id: CityBuildingId, tier: CityTier, level: number): number | null {
  const def = CITY_BUILDINGS[id]; if (level >= def.max[tier]) return null;
  return Math.round(def.cost[level] * TIER_COST[tier]);
}
/** 下一级还缺的前提（空 = 可以建，不含军粮）。 */
export function cityBuildBlockers(id: CityBuildingId, tier: CityTier, levels: CityLevels): string[] {
  const def = CITY_BUILDINGS[id], l = levels[id] ?? 0;
  if (def.max[tier] <= 0) return ['此档城池不能建'];
  if (l >= def.max[tier]) return ['已达最高等级'];
  if (id !== 'office' && l + 1 > (levels.office ?? 1)) return [`府衙 Lv${l + 1}`];
  return [];
}
/** 一座城每战的产出：军粮 = 基础 × (1 + 府衙加成) + 屯田；后备兵 = 募兵所。 */
export function cityIncome(tier: CityTier, levels: CityLevels): { grain: number; troops: number } {
  const office = Math.max(1, levels.office ?? 1);
  return { grain: Math.round(CITY_BASE_GRAIN[tier] * (1 + OFFICE_BONUS * (office - 1)) + TUNTIAN_GRAIN[tier] * (levels.tuntian ?? 0)), troops: MUSTER_TROOPS[tier] * (levels.muster ?? 0) };
}

/** 读档清洗：非法等级夹紧到该档上限；府衙至少 1 级；其它建筑不高于府衙。 */
export function parseCityLevels(v: unknown, tier: CityTier): CityLevels {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>, out = emptyCityLevels();
  for (const id of CITY_BUILDING_IDS) { const n = typeof o[id] === 'number' && Number.isFinite(o[id]) ? Math.floor(o[id] as number) : (id === 'office' ? 1 : 0); out[id] = Math.max(id === 'office' ? 1 : 0, Math.min(CITY_BUILDINGS[id].max[tier], n)); }
  for (const id of CITY_BUILDING_IDS) if (id !== 'office') out[id] = Math.min(out[id], out.office);
  return out;
}
