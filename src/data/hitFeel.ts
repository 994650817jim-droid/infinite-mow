/**
 * 打击感参数（2026-11-17 用户：「现在想办法增强打击感和我感觉boss打击感也很弱」）。
 * 全部是初值，平衡以后再调。时间单位：毫秒（顿帧 / 慢动作按真实时间计，期间整场战斗统一放慢，战斗时钟、刷兵、补间一起慢）。
 */
export const HIT_FEEL = {
  /** 顿帧期间的时间倍率（接近定格，不完全停住，避免看着像卡死） */
  stopScale: .06,
  /** 两次顿帧之间至少隔多久（割草命中太密，不能每下都顿） */
  stopCooldownMs: 300,
  /** 暴击顿帧：时长与暴击专用冷却（暴击率高时每 0.3 秒一顿会发抖，单独再放宽） */
  critStopMs: 32, critStopCooldownMs: 650,
  /** 精英被击杀 */
  eliteKillStopMs: 50,
  /** 武将技能 / 大招：同一帧内主将武器命中这么多名敌人算「大招命中」 */
  bigHitTargets: 6, bigHitStopMs: 45,
  /** 同一帧命中这么多名算「技能命中」：小震屏 */
  skillHitTargets: 3,
  /** 震屏：[时长, 强度]（「强」档；「弱」档 ×0.5，「关」不震） */
  shake: { small: [90, .0022], medium: [170, .0045], big: [280, .008] } as Record<'small' | 'medium' | 'big', [number, number]>,
  /** 普通敌人受击：后仰压扁时长、击退像素 */
  recoilMs: 90, knockbackPx: 3, critKnockbackPx: 6,
  /** 暴击伤害数字 */
  critFontPx: 24, critColor: '#ffd04a', critStroke: '#a3240c',
} as const;

/** 首领打击感：破势（硬直值）、半血转阶段、击杀慢动作。 */
export const BOSS_FEEL = {
  /** 硬直值上限；每次受击按「伤害 / 最大生命 × gainPerHpPct × 100」累积，暴击另加 critBonus */
  staggerMax: 100, gainPerHpPct: 6, critBonus: 3, minGain: .6,
  /** 每秒自然回落 */
  decayPerSec: 4,
  /** 破势后下一轮累积速度 ×afterMul（最低 floorMul） */
  afterMul: .65, floorMul: .35,
  /** 破势：硬直时长、后退像素、顿帧 */
  breakMs: 800, pushPx: 28, breakStopMs: 70,
  /** 白色残血条：受击后停多久再开始缩、每秒缩掉多少（占满条比例） */
  trailHoldMs: 380, trailDrainPerSec: .45,
  /** 半血转阶段：顿帧 + 慢动作 */
  phaseStopMs: 120, phaseSlowMs: 300, phaseSlowScale: .35,
  /** 击杀：慢动作 */
  deathSlowMs: 500, deathSlowScale: .3,
} as const;

export type ShakeLevel = 'strong' | 'weak' | 'off';
const SHAKE_KEY = 'im_shake';
export const SHAKE_LABEL: Record<ShakeLevel, string> = { strong: '强', weak: '弱', off: '关' };
export function shakeLevel(): ShakeLevel { try { const v = localStorage.getItem(SHAKE_KEY); if (v === 'weak' || v === 'off' || v === 'strong') return v; } catch { /* 无存储时用默认 */ } return 'strong'; }
export function setShakeLevel(v: ShakeLevel): void { try { localStorage.setItem(SHAKE_KEY, v); } catch { /* 忽略 */ } }
export const shakeMul = (v: ShakeLevel = shakeLevel()): number => v === 'strong' ? 1 : v === 'weak' ? .5 : 0;

/** 命中火花的攻击类型：斩击 / 穿刺 / 钝击 / 箭矢 / 法术。 */
export type HitType = 'slash' | 'pierce' | 'blunt' | 'arrow' | 'spell';
/** 本命武器 → 近战命中的火花类型（箭矢 / 火焰命中按来源判定，不看这里）。 */
export const WEAPON_HIT_TYPE: Record<string, HitType> = {
  guandao: 'slash', zhenbei_blade: 'slash', shuanggu_swords: 'slash', diaochan_fans: 'slash',
  spear_orbit: 'pierce', zhanjin_lance: 'pierce', sun_knives: 'pierce',
  dangyang_roar: 'blunt',
  crossbow: 'arrow', baodiao_bow: 'arrow',
  flame_banner: 'spell', lianhuan_mines: 'spell',
};
