/**
 * 攻城战重做 · 中城样板（共享笔记 siege-redesign-plan.md，用户 2026-11-17 批准「可以 同意」）。
 * 三段推进：城外（城头箭雨、箭楼、护送冲车撞门、城外敌营）→ 巷战（窄街、屋顶伏兵、2 个据点占领后守 20 秒）→ 府衙（守将两阶段、亲卫给守将加护盾）。
 * 世界坐标：y 越小越靠北（城里）。每段一块固定场地，由 SishuiObstacles 的碰撞框围起来；段与段之间黑场推进转场。
 * 所有数值为试玩初值，**待平衡会话复核**。
 */
export const MID_SIEGE = {
  /** 第一段 · 城外：场地、城墙、城门、箭楼、冲车 */
  outside: {
    arena: { left: -640, right: 640, top: -600, bottom: 340 },
    wallY: -580, // 城墙中线（城墙碰撞框 y ∈ [wallY-30, wallY+20]）
    gate: { x: 0, halfW: 86, hp: 1400 }, // 待平衡会话复核
    towers: [{ x: -330 }, { x: 330 }], // 城头两座箭楼（可摧毁，HP 用 SIEGE_GOALS.towerHp × hpScale）
    start: { x: 0, y: 120 },
    camp: { x: 0, y: 250, radius: 95 }, // 我方营地：冲车在此领取
    /** 城头箭雨：每轮落 N 处，按箭楼存活数取（2 / 1 / 0 座）；有落点预警 */
    volley: { everyMs: [3600, 4400, 6000], zones: [3, 2, 1], warnMs: 1100, radius: 62, damage: 9, allyDamage: 6, ramDamage: 30 }, // 待平衡会话复核
    /** 城外敌营每座存活时刷兵量的加成（全毁时为 1 − bonus×座数 的折扣） */
    campSpawnBonus: .22, // 待平衡会话复核
  },
  /** 冲车（用户 2026-11-17：「冲车开局送就够了后面可以升级科技」）：每场开局送一台；主将在护送半径内才前进；被敌兵围攻、被箭雨波及；
   *  毁了回营地重领，有冷却。耐久 / 撞门速度 / 撞门伤害 / 冷却 / 备用台数按「攻城器械等级」加成（SIEGE_ENGINE_LEVELS，现在默认 0 级）。 */
  ram: {
    hp: 520, speed: 34, escortRadius: 200, hitEveryMs: 1500, gateDamage: 95, // 待平衡会话复核
    respawnMs: 8000, // 毁后重领冷却（营地显示倒计时）· 待平衡会话复核
    enemyAggroRadius: 230, contactDamageMul: 1.6, contactCdMs: 800, // 敌兵优先打冲车（一半敌兵）
    size: 150,
  },
  /** 第二段 · 巷战：窄街两侧民房，2 个据点 */
  street: {
    arena: { left: -240, right: 240, top: -1660, bottom: -600 },
    start: { x: 0, y: -700 },
    points: [
      { name: '粮仓', x: -95, y: -960, radius: 100 },
      { name: '兵营', x: 105, y: -1360, radius: 100 },
    ],
    captureSeconds: 4, contestedMul: .35, holdSeconds: 20, loseSeconds: 5, // 占下后守军反扑：守 20 秒；主将离开、敌兵占点累计 5 秒则失守 · 待平衡会话复核
    counterEveryMs: 2600, counterBurst: 4, // 反扑刷兵
    reinforce: 2, secureReinforce: 2, secureHeal: .15, // 插旗补员 2 名，守住后再补 2 名并回 15% 生命 · 待平衡会话复核
    ambush: { everyMs: 9000, count: [2, 3], warnMs: 700, roofX: 228 }, // 屋顶伏兵
    barrels: [{ x: -150, y: -820 }, { x: 160, y: -1090 }, { x: -150, y: -1210 }, { x: 150, y: -1520 }],
    innerGateY: -1640,
  },
  /** 第三段 · 府衙：守将两阶段，亲卫定时从回廊杀出，亲卫在场时守将有护盾 */
  hall: {
    arena: { left: -560, right: 560, top: -2320, bottom: -1640 },
    start: { x: 0, y: -1740 },
    boss: { x: 0, y: -2120 },
    guardsEveryMs: 15000, guardCount: 3, guardKind: 'shield' as const, shieldMul: .35, // 亲卫在场时守将只受 35% 伤害 · 待平衡会话复核
    corridors: [{ x: -510, y: -1980 }, { x: 510, y: -1980 }],
    phase2At: .5,
    sweep: { everyMs: 4200, warnMs: 900, radius: 150, arc: Math.PI * .9, damage: 14 }, // 一阶段：横扫
    charge: { everyMs: 6500, warnMs: 1000, length: 380, width: 70, speed: 900, damage: 18 }, // 二阶段加：冲锋 · 待平衡会话复核
    flagMs: 1600, // 击败守将后插旗占领的动画时长
  },
  transitionMs: 1400,
  limitSeconds: 480, // 中城限时（原 210 秒是一段式，三段推进约 5 分钟）· 待平衡会话复核
} as const;

/**
 * 攻城器械等级（预留给讲武堂科技升级，这次只留接口、不做科技 UI）：每级相对 0 级的加成。
 * hpMul 冲车耐久倍率、hitSpeedMul 撞门速度倍率（撞门间隔 ÷ 此值）、gateDamageMul 撞门伤害倍率、respawnMul 重领冷却倍率、spare 备用台数（被毁后不用等冷却直接领）。
 * 数值待平衡会话复核；0 级为当前默认。
 */
export const SIEGE_ENGINE_LEVELS: ReadonlyArray<{ hpMul: number; hitSpeedMul: number; gateDamageMul: number; respawnMul: number; spare: number }> = [
  { hpMul: 1, hitSpeedMul: 1, gateDamageMul: 1, respawnMul: 1, spare: 0 },
  { hpMul: 1.25, hitSpeedMul: 1.1, gateDamageMul: 1.1, respawnMul: .85, spare: 0 },
  { hpMul: 1.5, hitSpeedMul: 1.2, gateDamageMul: 1.2, respawnMul: .7, spare: 1 },
  { hpMul: 1.8, hitSpeedMul: 1.35, gateDamageMul: 1.35, respawnMul: .55, spare: 1 },
];
export interface RamStats { hp: number; hitEveryMs: number; gateDamage: number; respawnMs: number; spare: number; level: number }
/** 按攻城器械等级算冲车属性（等级越界时夹到表内）。 */
export function ramStats(level = 0): RamStats {
  const lv = Math.max(0, Math.min(SIEGE_ENGINE_LEVELS.length - 1, Math.floor(level || 0))), b = SIEGE_ENGINE_LEVELS[lv], R = MID_SIEGE.ram;
  return { hp: Math.round(R.hp * b.hpMul), hitEveryMs: Math.round(R.hitEveryMs / b.hitSpeedMul), gateDamage: Math.round(R.gateDamage * b.gateDamageMul), respawnMs: Math.round(R.respawnMs * b.respawnMul), spare: b.spare, level: lv };
}

export type MidSiegePhase = 'outside' | 'street' | 'hall' | 'done';
