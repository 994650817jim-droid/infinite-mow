/**
 * P3 第二批可玩武将 · 甘宁（共享笔记 p3-heroes-plan.md §三，2026-11-20；初值，交平衡会话）：锦帆贼，火攻 + 骑突。
 * - 本命「锦帆铁索钩」：朝敌群甩钩（长 reach、宽 width），钩线上的敌兵吃 hookMul 并被拉到身边（首领 / 不受控的不拉），
 *   pullMs 后原地横扫（半径 sweepR，sweepMul）；每第 hotEvery 钩铁索烧红，沿索留火（fire）。
 * - 被动「锦帆」：被钩过的敌兵（hookMarkMs 内）被击杀攒 1 点，满 need 点「百骑劫营」raidMs：移速 ×raidSpeed、每钩都烧红。
 * - 分支（火攻）「夜袭点火」：每钩都烧红；着火的敌兵被拉到身边时爆燃（半径 yexi.r，伤害 yexi.mul）。进阶：火更久、爆燃更大。
 * - 分支（骑突）「百骑劫魏营」：不再拉敌兵，改为甘宁顺着铁索飞身扑过去（jieying.dashMs，期间无敌），落地横扫（半径 ×jieying.rMul）。进阶：落地后再扫一次。
 * - 武艺「铃响」：持续移动 lingMoveMs 以上，下一钩与横扫伤害 +ling / 级；「铁索」：钩长每级 +tiesuo。
 * 图：首领版 bosses-v2/side_ganning（tools/boss-to-hero-sheets.py 拼成可玩武将图集）；铁索借庞统 pangtong_chain / pangtong_chain_hot，火借周瑜火场，横扫借吕布横扫。
 */
export const GANNING = {
  range: 300, reach: [250, 262, 274, 288, 304] as readonly number[], width: 40, hookMul: .8,
  pullMs: 220, pullStop: 46, sweepR: [92, 96, 100, 106, 112] as readonly number[], sweepMul: 1, hookMarkMs: 3000,
  hotEvery: 3, fire: { ms: 3000, tickMs: 500, mul: .25, r: 42, step: 70, burnMarkMs: 1500 },
  need: 12, raidMs: 6000, raidSpeed: 1.3,
  yexi: { r: 72, mul: 1.2, finalFireMul: 1.5, finalRMul: 1.3 },
  jieying: { dashMs: 200, invulnMs: 320, rMul: 1.25, secondDelayMs: 260 },
  lingMoveMs: 800, ling: .15, tiesuo: .1,
} as const;
