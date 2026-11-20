/**
 * 场景里的火盆 / 篝火（用户 11-19「场景很多火盘也要做那种燃烧的动画，然后被打烂之后地上会有火」；清单见共享笔记 brazier-audit.md）。
 * 战斗里的火盆、篝火都是可打的物件（BattlefieldSupplies）：燃烧循环（手绘序列帧，屏幕外不换帧），打烂后播碎裂、地上留火 fireMs 毫秒，
 * 每 tickMs 烧一次圈内的人：敌兵掉 enemyShare 最大生命（走 hitEnemy 'fire'，带灼烧标记），主将 / 部曲只轻微烫伤。
 * 营寨 / 城池等非战斗场景里的只放燃烧动画（systems/FireProps.burningDecor）。数值为初值，交平衡会话。
 */
export const BRAZIER_FIRE = { fireMs: 8000, radius: 34, tickMs: 500, enemyShare: .035, playerShare: .01, allyShare: .015, minDamage: 1 } as const;
/** 燃烧循环每帧时长（毫秒）。 */
export const FIRE_FRAME_MS = 110;
/** 篝火（石圈火塘）燃烧序列帧：营寨图集里那张 8 帧（camp_firepit，256 格）。 */
export const FIREPIT_ART = { key: 'camp_firepit', file: 'assets/props-v2/camp-firepit.png', cell: 256 } as const;
