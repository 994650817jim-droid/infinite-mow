/**
 * P2 太史慈（other-factions-design.md §4，2026-11-19；初值，交平衡会话）：
 * 本命「东莱双戟」：近身双戟交叉斩（扇形 reach）；每第 throwEvery 击改为朝远处射出一支短戟（射程 throwRange），
 *   钉住第一个碰到的敌兵 pinMs（首领只受伤不定），钉住处留 slowMs 毫秒的减速圈（半径 slowR，减速 slow）。
 * 被动「信义」：身边 allyR 内的部曲每挨一次打攒 1 点，满 need 点「单骑突围」：朝最密的敌群冲出 dashLen 像素（dashMs），
 *   沿途敌兵受 dashMul 倍伤害，沿途 shieldR 内的部曲得护盾（最大生命 × shield，shieldMs 内先扣护盾）。
 * 分支「神亭酣战」（弓弩）：每次射 2 支，钉住的敌兵 burstMs 后爆裂（半径 burstR，伤害 × burstMul）。
 * 分支「北海突围」（兵阵）：信义少攒（beihai.need），护盾 ×beihai.shieldMul，突围路线留阵地 zoneMs（宽 zoneW，敌兵减速 zoneSlow）。
 * 武艺「神射」：射戟射程 +15%/级；「七尺之剑」：双戟伤害 +8%/级。
 */
export const TAISHICI = {
  range: 140, reach: [88, 92, 96, 100, 106], arc: 1.1,
  throwEvery: 4, throwRange: 400, throwW: 30, throwMul: 1.4, pinMs: 1000, slowR: 60, slowMs: 3000, slow: .4, speed: 950,
  allyR: 260, need: 15, dashLen: 260, dashMs: 340, dashW: 70, dashMul: 1.5, shieldR: 130, shield: .3, shieldMs: 5000,
  shenting: { throws: 2, spread: .18, burstMs: 3000, burstR: 70, burstMul: 1.2 },
  beihai: { need: 10, shieldMul: 1.5, zoneMs: 4000, zoneW: 90, zoneSlow: .35 },
  shenshe: .15, qichi: .08,
} as const;
