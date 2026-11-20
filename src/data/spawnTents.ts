/**
 * 刷兵帐篷统一规则（用户 2026-11-19「关于生成兵的帐篷应该会多刷新兵直到被摧毁」）：
 * 帐篷没被摧毁就一直出兵（不再刷几批就停），玩家必须去拆营。三套刷兵帐篷都按这里：
 * EnemyCamps（官渡 / 第三章起各营寨关 / 攻城 / 情报关的「敌营」）、LuoyangCamps（2-3 五座营寨）、
 * SishuiPass 关前营帐（2-1 汜水关、2-2 徐荣伏营、4-1 / 4-2 袁军营帐）。数值是初值，交平衡会话复核。
 */
export const SPAWN_TENT = {
  /** 出兵间隔（毫秒）：第 1 章 10 秒，每章快 0.36 秒，最快 6 秒。 */
  intervalMs: (chapter: number): number => Math.round(Math.max(6000, 10000 - (Math.max(1, chapter) - 1) * 360)),
  /** 一队几人：第 1–3 章 2、第 4–8 章 3、第 9 章起 4。 */
  squad: (chapter: number): number => (chapter <= 3 ? 2 : chapter <= 8 ? 3 : 4),
  /** 每顶帐篷自己刷出的兵同时最多活几个（到上限暂停，被杀了再补）：第 1–4 章 6、第 5–8 章 7、之后 8。 */
  live: (chapter: number): number => (chapter <= 4 ? 6 : chapter <= 8 ? 7 : 8),
  /** 帐篷血量低于一半：出兵更急（间隔 ×0.6）。 */
  hurryBelow: .5, hurryMul: .6,
  /** 首领出场后照刷，但间隔 ×2（速度减半），免得首领战被小兵淹没。 */
  bossMul: 2,
  /** 同屏敌兵到这个数先不刷（性能红线 150）。 */
  crowdCap: 140,
  /** 出兵前帐篷口扬尘的提前量（毫秒）。 */
  musterMs: 900,
  /** 拆营奖励：随军粮 + 一定概率掉干粮（回血，data/battleHeal）。 */
  grain: 8, foodChance: .5,
} as const;

/** 下一队要等多久：按章节、帐篷剩余血量、首领是否已出场。 */
export function tentIntervalMs(chapter: number, hpFrac: number, bossOn: boolean): number {
  let ms = SPAWN_TENT.intervalMs(chapter);
  if (hpFrac < SPAWN_TENT.hurryBelow) ms *= SPAWN_TENT.hurryMul;
  if (bossOn) ms *= SPAWN_TENT.bossMul;
  return Math.round(ms);
}
