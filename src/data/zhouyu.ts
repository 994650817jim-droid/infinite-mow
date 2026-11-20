/**
 * P2 周瑜（other-factions-design.md §4，2026-11-19；初值，交平衡会话）：
 * 本命「火船令」：朝敌群放出 ships 艘小火船（扇开 spread 弧度）沿直线驶出，撞上敌兵或驶到 range 尽头爆燃（半径 blast），
 *   爆燃处留短火场 fieldMs（半径 = blast × fieldR），每 tickMs 灼烧一次（爆燃伤害 × tickMul）。
 * 被动「英发」：火船 / 火场烧死敌兵攒 1 点，满 need 点刮「东风」windMs：全场火场顺风（主将当时的朝向）推进 windSpeed 像素 / 秒，火场伤害 ×windMul。
 * 分支「火烧赤壁」（火攻）：同一轮火船之间拉火索（每 ropeTickMs 灼烧穿过的敌兵，爆燃伤害 × ropeMul）；一艘爆燃，同轮其余火船连锁爆燃；火场 ×fieldMul 大。
 * 分支「曲有误」（兵阵）：每 qu.everyMs 奏一段琴音，qu.ms 内主将身边 qu.r 的琴音环：敌兵减速 qu.slow，部曲攻速 +qu.haste。
 * 武艺「雅量」：英发每级少攒 yaliang；「连环」：每级火船 +1 艘。
 */
export const ZHOUYU = {
  range: 380, speed: 280, shipR: 26, spread: .1, ships: 2,
  blast: [68, 72, 76, 82, 90], fieldR: .8, fieldMs: 2500, tickMs: 500, tickMul: .25,
  need: 20, windMs: 6000, windSpeed: 70, windMul: 2,
  chibi: { ropeTickMs: 250, ropeW: 26, ropeMul: .2, fieldMul: 1.3, finalExtraMs: 1500 },
  qu: { everyMs: 6000, ms: 3000, r: 200, slow: .3, haste: .15, finalBurn: .15, finalTickMs: 500 },
  yaliang: .15,
  /** 2026-11-20 平衡第一轮：首领体型大，两艘火船爆燃 + 叠着的 3～4 片火场全打在首领身上，首领用时只有中位数的 0.15～0.3 倍（清杂输出与关羽相当；
   *  实测首领掉血 81～93% 来自火船令）。火船 / 火场打首领 ×0.25（先试 ×0.4 + 不叠加仍约 0.43 倍），且叠着的火场打首领不叠加（每 tickMs 只烧一次，zhouyuWeapon.updateFields）；清杂不变。 */
  bossMul: .25,
} as const;
