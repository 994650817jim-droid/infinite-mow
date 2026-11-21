/**
 * 守城重做 · 天下地图规则（共享笔记 defense-redesign.md 第一节；用户 11-20「Approve defaults」）。初值，交平衡会话。
 * - 告急 = 敌军集结：countdown 战后围城（出征别处一场 −1；到 0 = 被围，这时出征别处才失守，先弹确认 ui/SortieGuard）；
 * - 三种应对：迎击（集结期间，一场短野战，赢了解除，奖励 ×interceptMul）/ 守城（奖励 ×rewardMul，守住后该城 moraleBattles 战产粮 +moraleMul）/ 弃城（城归敌，建筑等级保留）；
 * - 频率：同时最多 maxAlerts 座；守住 / 失守 / 弃城 / 迎击胜之后 cooldown 战内不再告急；攻城后反扑概率 retaliation；时代推进最多 eraMax 座。
 */
export const DEFENSE_RULES = {
  muster: 2,
  maxAlerts: 1,
  cooldown: 3,
  eraMax: 1,
  retaliation: { small: .15, medium: .25, large: .35 },
  rewardMul: .8,
  interceptMul: .4,
  moraleBattles: 3,
  moraleMul: .25,
} as const;
