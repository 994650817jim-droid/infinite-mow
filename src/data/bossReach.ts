/**
 * 首领体型与近身招式距离（主管理 2026-11-17 定：首领放大 1.4 倍后，贴身近战招式的距离 ×1.15，避免「大个子挥空」；
 * 地面范围、冲锋、箭雨、地裂、召兵等远程招式不变——它们的预警圈本来就画得清楚，躲避手感与难度不变）。
 * 交平衡会话调；?presence=0 时体型与近战距离都回到原值（对比用）。
 */
export const PRESENCE_ON: boolean = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('presence') !== '0'; } catch { return true; } })();

/** 首领显示体型倍数（判定半径同倍）。 */
export const BOSS_SCALE = 1.4;
/** 精锐显示体型倍数（判定半径同倍）。 */
export const ELITE_SCALE = 1.15;
/** 首领贴身近战招式（横扫、近身劈砍、回旋、贴身突刺）的距离倍数，预警同倍。〔平衡〕 */
export const BOSS_MELEE_REACH_MUL = 1.15;

/** 首领近战招式距离：原值 × BOSS_MELEE_REACH_MUL（?presence=0 时原值）。 */
export function meleeReach(r: number): number { return PRESENCE_ON ? r * BOSS_MELEE_REACH_MUL : r; }
