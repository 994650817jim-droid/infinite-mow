/**
 * P3 第二批可玩武将 · 祝融（共享笔记 p3-heroes-plan.md §三，2026-11-20；初值，交平衡会话）：火神后裔，火攻 + 弓弩。
 * 和孙尚香的近身飞刀错开：祝融是远程穿透 + 火线。
 * - 本命「火焰飞枪」：朝射程内最远处的敌兵掷一支火枪（穿透一线，spearW 宽、spearMul），沿途留火线（fire：每 tickMs 一跳 fire.mul、着火标记）；
 *   每第 fanEvery 掷改为扇形 fan 把飞刀（spread 弧度、knifeRange、knifeMul，不穿透）。
 * - 被动「火神后裔」：着火的敌兵被击杀攒 1 点，满 need 点「烈焰飞刀阵」：orbit.n 把飞刀绕身 orbit.ms（半径 orbit.r，碰到的敌兵挨 orbit.mul），随后朝外射出。
 * - 分支（火攻）「火神祝融」：火线更宽（×huoshen.rMul）、更久（×huoshen.msMul）；着火的敌兵死时火蔓延到身边 huoshen.spreadR 内。进阶：火伤 ×huoshen.finalMul。
 * - 分支（弓弩）「飞刀连环」：每第 feidao.every 掷就扇形飞刀、feidao.fan 把、飞刀穿透。进阶：每一掷都带一扇飞刀。
 * - 武艺「火神」：火伤每级 +huoshenM；「飞刀」：扇形每级多 1 把。
 * 图：首领版 bosses-v2/nz_zhurong（tools/boss-to-hero-sheets.py 拼成，第 8 行是背面，动作只登记待机 / 出招 / 招牌技）；水墨 ink-cast 祝融。
 *   特效：首领战现成的飞刀图 zhurong-fx/knife_fx（帧 0–7 燃火飞刀、8–11 炸开），火线借周瑜火场。
 */
export const ZHURONG = {
  range: 380, spearW: 30, spearSpeed: 900, spearMul: 1.1, spearRange: 420,
  fire: { tickMs: 500, ms: 2500, mul: .2, r: 36, step: 64, burnMarkMs: 1500 },
  fanEvery: 3, fan: 5, spread: .9, knifeRange: 260, knifeSpeed: 760, knifeW: 22, knifeMul: .6,
  need: 12, orbit: { n: 8, r: 90, ms: 1200, mul: .8, out: 300 },
  huoshen: { rMul: 1.4, msMul: 1.5, spreadR: 70, spreadMul: .5, finalMul: 1.5, spreadDelayMs: 130, spreadPerFrame: 6, spreadQueueMax: 40 }, // 蔓延延后、不连锁、每帧上限（平衡会话报的连锁 bug）
  feidao: { every: 2, fan: 7 },
  huoshenM: .15,
  /** 2026-11-20 平衡（P3 复核）：火枪 / 飞刀直击打首领 ×bossMul（首领用时 0.38 倍中位数、整局 DPS 约平均 2 倍；火线叠加已另修）。 */
  bossMul: .7, // 2026-11-21 定稿：蔓延连锁修好后（045049de）平衡会话重测首领用时 0.95 倍中位数，0.7 定下（hero-balance-review.md 16.1）
} as const;
