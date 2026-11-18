/**
 * 攻城限时（2026-11-18 用户「攻城战设计一下 推荐」）：时间到不再直接判负。
 *  ① 正常限时（各档城的 limitSeconds 在 data/siegeMedium SIEGE_PROFILES）：剩 warnSeconds 时顶部横幅「敌援将至」，计时变红。
 *  ② 限时到 → 「敌援抵达」阶段（reinforceSeconds 秒）：守军池补充 garrisonRefill、城外两侧各来一队援兵、守将伤害 ×bossDamageMul、
 *     我方随从伤害 ×allyDamageMul（士气受挫）。这段时间里仍可破城 / 占府衙。
 *  ③ 援军阶段结束仍未破城 → 撤军收场：算失败，存档不扣东西，只照常收本季军粮（与原来的失败结算同一条路），结算写「久攻不下，撤军」。
 *  ④ 速攻奖励：破城时剩余时间超过限时的 remainingShare，攻城奖励（军粮 / 战功）×(1 + rewardBonus)。
 * 数值待平衡会话复核。
 */
export interface SiegeTimerTier {
  /** 援军阶段时长（秒）。 */
  reinforceSeconds: number;
  /** 守军池补充（占原守军总数的比例）。 */
  garrisonRefill: number;
  /** 城外两侧援兵：每侧每批人数，批数（阶段开始一批，之后按 waveEverySeconds 再来）。 */
  squadSize: number;
  squadWaves: number;
  waveEverySeconds: number;
  /** 守将伤害倍率。 */
  bossDamageMul: number;
  /** 我方随从伤害倍率（士气受挫）。 */
  allyDamageMul: number;
}

export const SIEGE_TIMER = {
  /** 剩多少秒时预警（横幅 + 计时变红）。 */
  warnSeconds: 60,
  tiers: {
    small: { reinforceSeconds: 45, garrisonRefill: .25, squadSize: 3, squadWaves: 2, waveEverySeconds: 20, bossDamageMul: 1.15, allyDamageMul: .9 },
    medium: { reinforceSeconds: 60, garrisonRefill: .3, squadSize: 4, squadWaves: 2, waveEverySeconds: 25, bossDamageMul: 1.15, allyDamageMul: .9 },
    large: { reinforceSeconds: 75, garrisonRefill: .35, squadSize: 5, squadWaves: 3, waveEverySeconds: 25, bossDamageMul: 1.15, allyDamageMul: .9 },
  } as Record<'small' | 'medium' | 'large', SiegeTimerTier>,
  /** 速攻奖励：剩余时间占限时的比例超过 remainingShare 时，攻城奖励 ×(1 + rewardBonus)。 */
  speed: { remainingShare: .5, rewardBonus: .3 },
} as const;
