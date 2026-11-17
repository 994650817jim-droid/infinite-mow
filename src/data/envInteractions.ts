/**
 * 场地环境互动第一批（用户 2026-11-17 批准：火油桶连爆 / 敌军军旗 / 可破坏营帐；方案见共享笔记 env-interaction-proposal.md）。
 * 下面所有数值都是方案里的初值，**待平衡会话复核**。
 */

/** 势力：决定军旗与营帐用哪一面 / 哪一顶（env_props 图集列序）。 */
export type Faction = 0 | 1 | 2 | 3; // 0 黄巾 · 1 董卓（西凉）· 2 袁绍 · 3 曹军

export const ENV_BARREL = {
  /** 任何命中都会点燃。 */
  hp: 1,
  /** 引信（毫秒）：桶口着火、桶缝透红光后爆炸；被别的爆炸波及时更快。 */
  fuseMs: 1200, chainFuseMs: 260,
  /** 爆炸半径（世界像素）与对敌伤害（首领减半）。待平衡会话复核。 */
  radius: 110, damage: 60, bossMul: .5,
  /** 炸到主将：最大生命比例；炸到我方部曲：按对敌伤害的比例。 */
  playerRatio: .12, allyMul: .5,
  /** 爆炸后留下的地火：持续、半径、每跳间隔、对敌每跳伤害、主将每跳最大生命比例。 */
  fireMs: 3000, fireRadius: 42, fireTickMs: 500, fireDamage: 8, firePlayerRatio: .035,
  /** 同时存在的地火上限（对象池）。 */
  maxFires: 12,
  /** 生成：每 640 格子哈希命中率（1/every），每处 1～3 桶；附近同时最多几处。 */
  every: 8, maxGroups: 3,
} as const;

export const ENV_BANNER = {
  hp: 300,
  /** 旗在时：半径内敌人移速与伤害加成。待平衡会话复核。 */
  auraRadius: 220, auraSpeed: 1.1, auraDamage: 1.1,
  /** 砍倒后：半径内敌人「动摇」减速（与其他减速取最强），持续毫秒。 */
  shakenRadius: 260, shakenSlow: .85, shakenMs: 6000,
  /** 生成：格子哈希命中率与附近同时最多几面。 */
  every: 14, maxActive: 2,
} as const;

export const ENV_TENT = {
  hp: 200,
  /** 打塌后的掉落：经验宝石个数与每个的经验值、回血道具概率、兵装宝箱概率。待平衡会话复核。 */
  gems: 6, gemXp: 2, healChance: .5, chestChance: .03,
  /** 伏兵：概率与人数（小兵，按本关难度）。 */
  ambushChance: .3, ambushMin: 2, ambushMax: 3,
  every: 10, maxActive: 3,
} as const;

/** 各战斗场景开哪些互动、用哪个势力。 */
export interface EnvConfig { faction: Faction; barrels: boolean; banners: boolean; tents: boolean }
export function envConfigFor(sceneKey: string, chapterId: string, guanduStage?: number): EnvConfig | null {
  switch (sceneKey) {
    case 'GameScene': return chapterId === 'huangjin' ? { faction: 0, barrels: true, banners: true, tents: true } : { faction: 1, barrels: false, banners: true, tents: false };
    case 'ThirdGameScene': return { faction: 1, barrels: false, banners: true, tents: true };
    case 'GuanduGameScene': return { faction: 2, barrels: guanduStage === 3, banners: true, tents: true };
    case 'ChibiGameScene': return { faction: 3, barrels: false, banners: true, tents: false };
    case 'SiegeGameScene': return { faction: 2, barrels: false, banners: true, tents: false };
    case 'IntelGameScene': return { faction: 1, barrels: false, banners: true, tents: false };
    default: return null; // 吕布等首领专场不放
  }
}
