import type {CharacterId} from './characters';

/**
 * 骑马系统（试玩参数，调平衡集中改这里）：武将在行囊「坐骑」槽穿上马，出征即骑马。
 * 骑马：移速 ×1.35、冲进小兵堆把普通兵撞开并造成少量践踏伤害、受到的伤害 ×0.85（马替人挡一部分）。
 * 马有耐力：被打中会掉耐力（单次伤害 ≥ 12 视为重击，按 ×3 扣；轻伤按 ×1 扣），掉光就落马；落马后约 15 秒重新上马、耐力回满。
 */
export const MOUNT = {
  speedMul: 1.35, damageTakenMul: .85,
  stamina: 100, heavyHit: 12, heavyMul: 3, lightMul: 1, remountMs: 15000,
  trampleRadius: 30, trampleDamage: 6, tramplePush: 26, trampleCooldownMs: 600, trampleMinSpeed: 60,
  /** 马与骑者的显示：骑者抬高（像素）、骑者下半身裁掉的比例、马的显示宽度。 */
  riderRise: 36, riderCrop: .7, horseSize: 124,
} as const;

/** 马上名将：耐力 +40、践踏伤害 ×1.3。 */
export const CAVALRY_HEROES: readonly CharacterId[] = ['machao', 'zhaoyun', 'zhangfei', 'guanyu'];
export const CAVALRY_BONUS = {stamina: 40, trample: 1.3} as const;

export interface MountStyle {
  /** 马的毛色（乘色；基础马图为浅灰白）。 */
  tint: number;
  speedMul?: number; trampleMul?: number; noTrample?: boolean; stamina?: number;
  /** 骑乘特效说明（行囊 / 结算显示用）。 */
  ride?: string;
  /** 的卢：落马那一下免伤并向前跃出。 */
  leap?: boolean;
}
/** 各坐骑的毛色与骑乘特色（键为道具基础 id）。 */
export const MOUNT_STYLES: Record<string, MountStyle> = {
  nag: {tint: 0xb59a7a},
  grey_horse: {tint: 0x9aa7ad},
  yellow_horse: {tint: 0xe2c06a},
  black_horse: {tint: 0x4a4650, trampleMul: 1.3, ride: '乌骓：践踏伤害 +30%'},
  white_horse: {tint: 0xffffff, stamina: 30, ride: '白马：耐力 +30'},
  red_horse: {tint: 0xc9743e},
  west_horse: {tint: 0xd8a66a, speedMul: 1.45, ride: '大宛马：骑乘移速 ×1.45'},
  mule: {tint: 0x8c8274, speedMul: 1.15, noTrample: true, stamina: 60, ride: '骡车：走得慢、不践踏，但耐力 +60'},
  chitu: {tint: 0xe0462e, speedMul: 1.45, trampleMul: 2, ride: '赤兔：骑乘移速 ×1.45、践踏伤害 ×2'},
  dilu: {tint: 0xf2ede2, leap: true, ride: '的卢：落马那一下免伤并向前跃出'},
  jueying: {tint: 0x2e2c34, stamina: 50, ride: '绝影：耐力 +50'},
};
export function mountStyle(base: string): MountStyle { return MOUNT_STYLES[base] ?? {tint: 0xc8b090}; }
