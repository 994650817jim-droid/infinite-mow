/**
 * 首领重设计 · 样板 4 人（张角 / 吕布 / 袁术 / 曹仁）的招式数值。
 * 方案见共享笔记 boss-redesign-proposal.md（用户 2026-11-16 选「C 先做样板」）。
 * 全部是初值〔平衡〕：交平衡会话实测。时间单位毫秒，伤害为对主将的原始伤害（部曲另按 BOSS_VS_TROOPS 折算）。
 */
export const BOSS_KIT = {
  /** 二阶段转场：无敌时长、震屏。 */
  shiftMs: 1500, shiftShakeMs: 420, shiftShake: .008,
  /** 收招破绽：暖色闪光的节拍。 */
  recoverPulseMs: 260,
} as const;

/** 张角：太平符雨 / 天雷 / 黄天当立；二阶段「苍天已死」加雷阵。 */
export const ZJ = {
  phase2At: .5,
  gapMs: 1300, gapMs2: 950,
  rain: { windupMs: 600, warnMs: 450, rounds: 2, rounds2: 3, roundGapMs: 320, bolts: 7, spread: .15, damage: 9, speed: 240, recoverMs: 650 },
  thunder: { windupMs: 450, warnMs: 900, radius: 72, damage: 30, troopDamage: 16, recoverMs: 600 },
  /** 黄天当立：能量满（每秒 +energyPerSec，二阶段 ×1.4）后起手。 */
  heaven: { energyPerSec: 3.4, castMs: 6000, pillars: 4, pillarHp: 140, pillarRing: 230, cutMs: 1200, stunMs: 3000, stunTakenMul: 1.5,
    ultWarnMs: 1300, ultDamage: 45, ultTroopDamage: 30, safeRadius: 70 },
  grid: { cell: 110, waves: 3, warnMs: 750, strikeGapMs: 350, damage: 24, troopDamage: 14, recoverMs: 700 },
  /** 召兵（保留，频率降低）。 */
  summonEveryMs: 14000, summonCount: 3, summonCap: 8,
} as const;

import { meleeReach } from './bossReach';

/** 吕布：方天三连 / 赤兔突袭 / 辕门射戟 / 魔神降世（保留）；二阶段「人中吕布」加无双乱舞。 */
export const LB = {
  combo: { cooldown: 2.2, cooldown2: 1.6, range: 175,
    // 方天三连是贴身近战：突刺长度、横扫半径、砸地半径 × BOSS_MELEE_REACH_MUL（data/bossReach.ts）
    thrust: { warnMs: 380, length: meleeReach(230), width: 54, damage: 16 },
    sweep: { warnMs: 380, radius: meleeReach(165), arcDeg: 150, damage: 18 },
    smash: { warnMs: 650, ahead: 95, radius: meleeReach(105), damage: 26 },
    gapMs: 130, recoverMs: 800 },
  zigzag: { cooldown: 5, cooldown2: 3.8, minRange: 140, maxRange: 560, folds: 2, folds2: 3, length: 300, halfWidth: 42, firstWarnMs: 700, foldWarnMs: 320, speed: 900, damage: 22, recoverMs: 700 },
  shot: { cooldown: 9, minRange: 230, hopMs: 300, hop: 150, aimMs: 1200, lockMs: 300, length: 950, width: 30, damage: 30, recoverMs: 750 },
  // 无双乱舞：绕身回旋，近战距离同倍
  spin: { cooldown: 8, range: 210, windupMs: 600, spinMs: 1800, r0: meleeReach(80), r1: meleeReach(195), tickMs: 300, damage: 12, recoverMs: 1000 },
} as const;

/** 袁术：玉玺号令 / 金钱开路 / 亲军护驾；二阶段「蜜水」（30%）逃跑。 */
export const YS = {
  gapMs: 1500, gapMs2: 1100,
  flags: { windupMs: 800, count: 3, ring: 260, hp: 160, spawnEveryMs: 5000, spawnEach: 2, cap: 3, recoverMs: 700 },
  coins: { windupMs: 600, count: 6, min: 80, max: 230, fuseMs: 1500, radius: 50, damage: 14, troopDamage: 10, recoverMs: 650 },
  guards: { windupMs: 600, count: 6, ring: 90, shieldRange: 150, minGuards: 3, takenMul: .4, recoverMs: 700 },
  honey: { at: .3, fleeMs: 25000, speedMul: 1.6, coinEveryMs: 1300, healPct: .15 },
} as const;

/** 曹仁：八门金锁（常驻）/ 铁壁 / 坚守；二阶段「破阵」（40%）。 */
export const CR = {
  gapMs: 1700, gapMs2: 1300,
  gates: { radius: 330, rotateMs: 10000, rotateMs2: 5000, warnMs: 1500, live: 1, dead: 3, dead2: 4, deadTickMs: 1000, deadDamage: 6, liveTakenMul: 1.2 },
  wall: { windupMs: 500, holdMs: 4000, turnPerSec: 1.05, frontDeg: 140, frontTakenMul: .1, recoverMs: 800 },
  hold: { windupMs: 600, count: 4, ahead: 120, spacing: 46, recoverMs: 700 },
  phase2At: .4,
} as const;
