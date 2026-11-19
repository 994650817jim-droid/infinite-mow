/**
 * 攻城战重做 · 中城样板（共享笔记 siege-redesign-plan.md，用户 2026-11-17 批准「可以 同意」）。
 * 三段推进：城外（城头箭雨、箭楼、护送冲车撞门、城外敌营）→ 巷战（窄街、屋顶伏兵、2 个据点占领后守 20 秒）→ 府衙（守将两阶段、亲卫给守将加护盾）。
 * 世界坐标：y 越小越靠北（城里）。每段一块固定场地，由 SishuiObstacles 的碰撞框围起来；段与段之间黑场推进转场。
 * 所有数值为试玩初值，**待平衡会话复核**。
 */
import { meleeReach } from './bossReach';

export const MID_SIEGE = {
  /** 第一段 · 城外：场地、城墙、城门、箭楼、冲车 */
  outside: {
    // 场地（用户 11-19「攻城场地好小」）：往南加深 560（我方营地、冲车来路拉长，能绕着冲车周旋）；左右实际宽度跟城内段同宽（SiegeMidCity.oa，城内段在 siegeCity 里整体加宽）
    arena: { left: -640, right: 640, top: -600, bottom: 900 },
    wallY: -580, // 城墙中线（城墙碰撞框 y ∈ [wallY-30, wallY+20]）
    gate: { x: 0, halfW: 86, hp: 1400 }, // 待平衡会话复核
    towers: [{ x: -330 }, { x: 330 }], // 城头两座箭楼（可摧毁，HP 用 SIEGE_GOALS.towerHp × hpScale）
    start: { x: 0, y: 560 },
    camp: { x: 0, y: 700, radius: 95 }, // 我方营地：冲车在此领取
    /** 城头箭雨：每轮落 N 处，按箭楼存活数取（2 / 1 / 0 座）；有落点预警 */
    volley: { everyMs: [3600, 4400, 6000], zones: [3, 2, 1], warnMs: 1100, radius: 62, damage: 9, allyDamage: 6, ramDamage: 30 }, // 待平衡会话复核
    /** 城外敌营每座存活时刷兵量的加成（全毁时为 1 − bonus×座数 的折扣） */
    campSpawnBonus: .22, // 待平衡会话复核
  },
  /** 冲车（用户 2026-11-17：「冲车开局送就够了后面可以升级科技」）：每场开局送一台；主将在护送半径内才前进；被敌兵围攻、被箭雨波及；
   *  毁了回营地重领，有冷却。耐久 / 撞门速度 / 撞门伤害 / 冷却 / 备用台数按「攻城器械等级」加成（SIEGE_ENGINE_LEVELS，现在默认 0 级）。 */
  ram: {
    hp: 800, speed: 34, escortRadius: 200, hitEveryMs: 1500, gateDamage: 95, // 2026-11-18 平衡：hp 520 → 800（tools/probe-siege-ram.mjs：大城挂机 / 护送都要毁 1～2 台，九成伤害来自敌兵近身）
    respawnMs: 8000, // 毁后重领冷却（营地显示倒计时）· 待平衡会话复核
    enemyAggroRadius: 230, contactDamageMul: 1, contactCdMs: 800, // 敌兵优先打冲车（一半敌兵）；原 1.6 → 1.3 → 1（2026-11-18 平衡：配合 hp 800，大城 6 局冲车 0 台被毁、到门时只剩 60～130 血）
    /** 蒙皮顶棚（用户 11-17「敌方弓手射我方冲车，感觉冲车一下被射烂」）：普通箭（城头箭雨）对冲车只吃 25%；每次受击后 0.5 秒免伤，齐射不会瞬间打爆。 */
    arrowMul: .25, guardMs: 500,
    /** 火箭：冲车掉到 hpGate 以下后，瞄冲车的那一处箭雨有 chance 换成火箭（地面火焰预警）；中了起火 burnMs 持续掉血，主将站到旁边 putOutRadius 内扑灭。 */
    fire: { hpGate: .85, chance: .5, burnMs: 4000, burnDps: 9, putOutRadius: 120 },
    /** 受击提示：冲车名牌闪红；顶部目标行「冲车受击」最多每 alertCdMs 提示一次 */
    alertCdMs: 3000,
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
    ambush: { everyMs: 9000, count: [2, 3], warnMs: 950, roofX: 228 }, // 屋顶伏兵（11-19：预警 700 → 950ms，看得清再跳）
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
    sweep: { everyMs: 4200, warnMs: 900, radius: meleeReach(150), arc: Math.PI * .9, damage: 14 }, // 一阶段：横扫（贴身近战，距离 × BOSS_MELEE_REACH_MUL）
    charge: { everyMs: 6500, warnMs: 1000, length: 380, width: 70, speed: 900, damage: 18 }, // 二阶段加：冲锋 · 待平衡会话复核
    flagMs: 1600, // 击败守将后插旗占领的动画时长
  },
  transitionMs: 1400,
  limitSeconds: 520, // 中城限时（11-19 场地加大、冲车路拉长 +40）（原 210 秒是一段式，三段推进约 5 分钟）· 待平衡会话复核
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

export type MidSiegePhase = 'outside' | 'barbican' | 'street' | 'hall' | 'done';

/**
 * 攻城战重做 · 扩展到三档城（siege-redesign-plan.md 推荐顺序第二步）。中城样板的控制器 SiegeMidCity 按档位读这里的配置：
 * - 小城：城外 + 府衙（去掉巷战）。土墙木门、1 座箭楼；没有冲车，木门主将直接砍；守将是县尉（只有横扫，不进二阶段），亲卫少。
 * - 中城：城外 + 巷战 + 府衙（样板，数值见 MID_SIEGE）。
 * - 大城：城外（护城河 + 吊桥：砍断两根吊桥绳索放下吊桥，或守军到时自己放桥出城）→ 瓮城（四面城墙放箭、滚木礌石，砍破瓮城内门）→ 巷战 → 内城（势力名将两阶段，用第四章首领招式组）。
 * 数值全部 **待平衡会话复核**。
 */
export type SiegePhaseName = 'outside' | 'barbican' | 'street' | 'hall';
export interface SiegeProfile {
  phases: readonly SiegePhaseName[];
  towers: ReadonlyArray<{ x: number }>;
  gateHp: number;
  /** 有冲车（中城 / 大城）；没有冲车时城门是可砍的木门（小城） */
  ram: boolean;
  /** 箭雨每轮落点数倍率（按档） */
  volleyMul: number;
  hall: { name: string; guardsEveryMs: number; guardCount: number; phase2: boolean; bossName?: string };
  limitSeconds: number;
  /** 府衙一段的守将血量倍率（相对 siege.ts 档位守将） */
  bossHpMul: number;
}
export const SIEGE_PROFILES: Record<'small' | 'medium' | 'large', SiegeProfile> = {
  small: { phases: ['outside', 'street', 'hall'], /* 攻城城内段改造（用户 11-18）：小城也加城内段（丁字街） */ towers: [{ x: 300 }], gateHp: 520, ram: false, volleyMul: .6, hall: { name: '县衙', guardsEveryMs: 20000, guardCount: 2, phase2: false }, limitSeconds: 270, bossHpMul: 1.4 },
  medium: { phases: ['outside', 'street', 'hall'], towers: MID_SIEGE.outside.towers, gateHp: MID_SIEGE.outside.gate.hp, ram: true, volleyMul: 1, hall: { name: '府衙', guardsEveryMs: MID_SIEGE.hall.guardsEveryMs, guardCount: MID_SIEGE.hall.guardCount, phase2: true }, limitSeconds: MID_SIEGE.limitSeconds, bossHpMul: 1 },
  large: { phases: ['outside', 'barbican', 'street', 'hall'], towers: [{ x: -440 }, { x: -250 }, { x: 330 }], gateHp: 2100, ram: true, volleyMul: 1.35, hall: { name: '内城', guardsEveryMs: 13000, guardCount: 4, phase2: true }, limitSeconds: 650, bossHpMul: 1.25 },
};

/** 大城：护城河、吊桥、瓮城（待平衡会话复核）。 */
export const LARGE_SIEGE = {
  moat: {
    top: MID_SIEGE.outside.wallY + 70, bottom: MID_SIEGE.outside.wallY + 160, // 护城河南北边（城墙以南）
    bridgeHalfW: 80,
    ropes: [{ x: -150 }, { x: 150 }], ropeHp: 240, // 吊桥两根绳索（绞索桩在我方这一岸，主将去砍）
    autoLowerSeconds: 120, // 一直不砍：守军到时自己放桥出城（同时多出一波出城兵）
    sally: 6,
  },
  barbican: {
    // 瓮城：单独一块场地（转场过去，坐标在 x≈3000 一带，和城外 / 巷战 / 府衙互不相邻）
    cx: 3000, arena: { left: 2620, right: 3380, top: -520, bottom: 300 },
    start: { x: 3000, y: 40 }, // 场景审查 P3：南面补了瓮城城墙（图高约 250），出生点往北挪，免得站在南墙的图上
    innerGate: { x: 3000, y: -500, hp: 1300 },
    doors: [{ x: 2640, y: -150 }, { x: 3360, y: -150 }, { x: 2640, y: 120 }, { x: 3360, y: 120 }], // 两侧藏兵洞
    volley: { everyMs: 3400, zones: 3, warnMs: 1000, radius: 64, damage: 10, allyDamage: 6 },
    logs: { everyMs: 5200, warnMs: 1100, speed: 560, width: 90, damage: 20, enemyDamage: 140, count: 2 }, // 滚木礌石：从城头沿南北向滚下
  },
} as const;

/**
 * 攻城守军有限（用户 2026-11-17「关于攻城是没有波数的，这个要设计不可以无限刷等级」）：
 * - 每座城一池守军（按档位，时代越后越多），普通刷兵、敌营增援、城内反扑都从池里出；池空后不再来人。
 * - 各段（城外 / 瓮城 / 巷战 / 府衙）按份额分池：进到该段才放出该段的份额（前段没用完的留给后段）。
 * - 剧情 / 目标必刷的兵（吊桥出城、据点反扑、屋顶伏兵、守将亲卫）池空后照样出，但不给经验、不掉落、不记战功。
 * - 敌营每营最多增援 campBatches 批；拆掉敌营，剩下没出的批次从守军池里扣掉。
 * 数值为开发期初值 · 待平衡会话复核。
 */
export const SIEGE_GARRISON = {
  total: { small: 120, medium: 200, large: 300 } as Record<'small' | 'medium' | 'large', number>,
  /** 时代加成：第 n 时代 ×(1 + eraStep×(n−1)) */
  eraStep: .15,
  share: { outside: .5, barbican: .15, street: .25, hall: .1 } as Record<SiegePhaseName, number>,
  campBatches: 3,
} as const;

/** 攻城刷兵方向：城门出城占比；场地下方 rearCut 比例是我方后方（营地 / 冲车来路），不刷兵。敌营挪到左右两翼上半段。 */
export const SIEGE_SPAWN = {
  gateShare: .6, rearCut: .3, flankCamps: [{ x: -650, y: -80 }, { x: 650, y: -260 }],
  /** 用户 11-19「小怪生成在我脸上」：普通刷兵离主将至少 minDist，且在镜头外（或镜头边缘外 offPad）；找不到这样的点就从离主将最远的来路出，再不行这次不刷。 */
  minDist: 450, offPad: 40, tries: 8,
  /** 屋顶伏兵只挑离主将 [roofMin, roofMax] 之间的房檐（不跳到脸上，也不在屏幕外白等）；守点小队从要点建筑门口出。 */
  roofMin: 240, roofMax: 720,
} as const;

/**
 * 攻城我方义军（用户 11-19「也需要点我方小兵一起进攻」）：复用 2-3 的友军攻势（systems/AllyPush）。
 * 城外：小队跟着冲车推进（集结点 = 冲车前方），路上打敌兵；小城没冲车 → 集结在木门前。破门后：涌进城、集结到最近一处没拿下的要点帮着占 / 守
 * （主将不在圈里时，圈里有义军也能占，速度 × pointRate；守点时圈里有义军不算失守）；府衙：跟着主将打亲卫。
 * 场上最多 cap 人；军营等级（城建 reinforcements）每级多 perLevel 人 / 队，上限 maxSquad。初值，交平衡会话。
 */
export const SIEGE_ALLIES = {
  firstMs: 4000, everyMs: 16000, squad: 4, perLevel: 1, maxSquad: 6, cap: 20,
  sheets: ['shu_spearman_walk_sheet', 'shu_swordsman_walk_sheet'], speed: 80, hp: 170, dmg: 16, campDmg: 10, hitMs: 900, engage: 200, reach: 46, campReach: 40, enemyDps: 6, rearPad: 90,
  /** 集结点：冲车前方多远；城内要点圈里算几成主将。 */
  ramLead: 90, pointRate: .5,
} as const;
