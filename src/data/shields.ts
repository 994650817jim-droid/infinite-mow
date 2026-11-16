/**
 * 盾牌兵两段血（用户 2026-11-16「先打掉他的盾牌才可以打到兵」）：试玩初值，交平衡会话测。
 * 刀盾兵（含各章换色、飞熊军）出场带一面盾：盾值 = 本体生命 × ratio。盾没破时，伤害先打盾，本体只吃 bodyMul；
 * 火攻对盾 ×fireMul。盾破后丢盾，换成同章步兵造型，之后照常受伤。城墙、粮草等借用刀盾兵类型的物件不带盾。
 */
export const SHIELD = {
  ratio: .8, feixiongRatio: .7, bodyMul: .1, fireMul: 2,
  /** 盾条：宽、离头顶高度、显示阈值（满盾也显示，便于辨认）。 */
  barWidth: 26, barOffset: 10,
} as const;
