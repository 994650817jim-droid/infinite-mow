/**
 * 第五章 · 赤壁之战 虎豹骑（曹操亲军精骑，曹纯统领）：试玩参数，调平衡集中改这里。
 * 数值参照第二章西凉铁骑（XILIANG_RAID / XILIANG_CAVALRY），略重但不超标：
 * - 单骑：生命 = 本关骑兵 ×1.4、接触伤害 +2；
 * - 虎豹突阵：四骑并排（西凉三骑）、撞人 20（西凉 16）、更快的冲锋与更短的预警；
 * - 5-1 长坂突围：35 秒起每 16 秒一次突阵；首领曹纯出场时四骑护驾，护卫少于 2 骑时每 25 秒号令补 2 骑；
 * - 5-2 赤壁鏖兵 / 5-3 江陵夺城：偶尔出现，60 秒起每 30 秒一次突阵，无护驾。
 */
export const HUBAO_RAID = {
  riders: 4, spacing: 36, lead: 480, aimJitter: 40, distance: 1000, speed: 600, warnMs: 1000,
  damage: 20, knockback: 56, troopRadius: 32, troopDamage: 20,
} as const;
export const HUBAO = {
  hpMul: 1.4, damageAdd: 2, scale: 1.08, tint: 0x8d93ab, baseScale: .9127,
  first: [35, 60, 60] as readonly number[], interval: [16, 30, 30] as readonly number[],
  guards: 4, guardRing: 95, guardLeash: 230, regroupMs: 25000, regroupBelow: 2, regroupCount: 2,
} as const;
