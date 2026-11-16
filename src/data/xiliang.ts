/**
 * 第二章 · 讨伐董卓 西凉军战法数值（试玩参数，调平衡集中改这里）。
 * 铁骑突阵：每关开打 50 秒后首次，之后 汜水关 / 荥阳 / 虎牢关 每 22 / 18 / 15 秒一次。
 * 飞熊军：荥阳、虎牢关出现，40 秒后每 10 / 8 秒补一名，同屏最多 5 名。
 */
export const XILIANG_RAID = {
  first: 50, interval: [22, 18, 15] as readonly number[],
  riders: 3, spacing: 38, lead: 460, aimJitter: 40, distance: 980, speed: 560, warnMs: 1100,
  damage: 16, knockback: 46, troopRadius: 30, troopDamage: 16,
} as const;
export const FEIXIONG = {
  first: 40, interval: [0, 10, 8] as readonly number[], maxAlive: 5, spawnDistance: 470,
  hp: 140, speed: 46, damage: 11, xp: 5, radius: 19, scale: 1.18, tint: 0x9aa6c4,
  arrowMul: .5, bashRange: 78, bashCooldown: 3600, windupMs: 560, lungeMs: 170, lungeDistance: 96, bashDamage: 14, knockback: 62,
} as const;
/** 第二章西凉骑兵加强（主线三关；攻守城沿用原值）：生命 34 → 42、速度 86 → 92、接触伤害 8 → 9。 */
export const XILIANG_CAVALRY = {hp: 42, speed: 92, damage: 9} as const;
