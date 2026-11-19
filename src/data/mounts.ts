import type {CharacterId} from './characters';

/**
 * 骑马系统（试玩参数，调平衡集中改这里）：武将在行囊「坐骑」槽穿上马，出征即骑马。
 * 骑马：移速 ×1.35、冲进小兵堆把普通兵撞开并造成少量践踏伤害、受到的伤害 ×0.85（马替人挡一部分）。
 * 马有耐力：被打中会掉耐力（单次伤害 ≥ 主将最大生命 12% 视为重击，按 ×3 扣；轻伤按 ×1 扣），掉光就落马（耐力与重击门槛随主将最大生命，见 MOUNT.staminaPerHp / heavyHitHpRatio）；落马后本战不能再上马（马受惊奔走，11-18 用户定）——只有遗珍「虎豹铁面」每战可在 RELIC.hubaoRemountMs 后重新上马一次。
 */
/**
 * 骑马整体比例与移速（用户 11-18「我觉得骑马整体的比例可以小点，和移速慢点」）：
 * visualScale：马、骑乘姿态图与骑者抬高 / 马镫高度一起乘（主将、骑马首领、敌方骑兵同一个数），步兵不变；
 * enemyCavalrySpeedMul：敌方骑兵（不含象兵）移速倍率，冲锋速度随之；主将骑乘移速倍率见下面 speedMul / MOUNT_STYLES。
 * 初值 · 待平衡会话复核。
 */
/**
 * 人马比例（11-19 用户「请注意人和马的比例要正常」，tools/mount-proportions.mjs 量过）：
 * - 骑者与步战同大：英雄骑乘图（格 256）与行走图（格 176 显示 88）同像素密度，骑者按 0.5 画，不再跟着缩。
 * - horseScale：只缩马（11-18「骑马整体小点」的 .85 改为只作用于马）；马身长约为骑者站高 1.16–1.35 倍，马背约在胸口下。
 * - bossRideK：首领步战图（格 288）比骑乘图（格 256）画得大约 1.48 倍，骑乘图、马、马镫高一起乘它，骑在马上才与步战同大。
 * - 敌方骑兵是人马一张图，人与步兵同密度：不缩（缩了骑手就比步兵小）。
 */
export const MOUNT_VISUAL = { horseScale: .85, bossRideK: 1.48, enemyCavalrySpeedMul: .82 } as const;
/** 骑马的敌兵：kind 为 cavalry 且不是象兵（第十一章象兵另有体型，不在「骑马」之列）。 */
export function isHorseCavalry(def: { kind: string; texture?: string; walkVisual?: { texture: string } }): boolean { return def.kind === 'cavalry' && !/elephant/.test(def.walkVisual?.texture ?? def.texture ?? ''); }
export const MOUNT = {
  /** 骑乘移速倍率：1.35 → 1.2（11-18 调慢）→ 1.1（11-19 用户「骑马还是太快」）；名马另见 MOUNT_STYLES.speedMul */
  speedMul: 1.1, damageTakenMul: .85,
  /** 耐力 = stamina + staminaPerHp × 主将最大生命（上马时算；名将 / 名马加成另叠）；单次伤害 ≥ 主将最大生命 × heavyHitHpRatio 算重击、按 heavyMul 扣。
   *  11-18 平衡会话：落马不能再上后，固定 100 耐力 + 固定重击门槛 12 让五章以后只能骑十几秒；改随生命走，各章约能骑 50～100 秒。 */
  stamina: 100, staminaPerHp: .25, heavyHitHpRatio: .12, heavyMul: 3, lightMul: 1,
  trampleRadius: 30, trampleDamage: 6, tramplePush: 26, trampleCooldownMs: 600, trampleMinSpeed: 60,
  /** 马与骑者的显示：骑者抬高（像素）、骑者下半身裁掉的比例、马的显示宽度。 */
  riderRise: Math.round(36 * MOUNT_VISUAL.horseScale), riderCrop: .7, horseSize: Math.round(124 * MOUNT_VISUAL.horseScale),
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
  west_horse: {tint: 0xd8a66a, speedMul: 1.18, ride: '大宛马：骑乘移速 ×1.18'},
  mule: {tint: 0x8c8274, speedMul: 1.03, noTrample: true, stamina: 60, ride: '骡车：走得慢、不践踏，但耐力 +60'},
  chitu: {tint: 0xe0462e, speedMul: 1.18, trampleMul: 2, ride: '赤兔：骑乘移速 ×1.18、践踏伤害 ×2'},
  dilu: {tint: 0xf2ede2, leap: true, ride: '的卢：落马那一下免伤并向前跃出'},
  jueying: {tint: 0x2e2c34, stamina: 50, ride: '绝影：耐力 +50'},
};
export function mountStyle(base: string): MountStyle { return MOUNT_STYLES[base] ?? {tint: 0xc8b090}; }

// —— 马厩（2026-11-16 改版，用户批准 gear-revamp-proposal.md）——
/**
 * 坐骑不再是随机掉落的道具，改为马厩收藏：每匹马只有一份、不带随机词条，骑乘特色见 MOUNT_STYLES，
 * 另有一组固定小加成（并入兵装加成，受 gearCap 约束；初值按蓝色品质，交平衡会话复核）。
 * 第一章通关后马厩开放并送驽马；之后的马靠各章首领首次击杀获得（reward = 关卡键，见 GameScene.stableRewardKey）。
 * 换马只在休整时：主页马厩、行营休整；战斗中不可换。
 */
export interface HorseDef { id: string; name: string; legend?: boolean; /** 品质框颜色（默认普通马为蓝、传说为橙）。 */ quality?: 'white'; bonus: Partial<Record<'move' | 'damage' | 'pickup' | 'ally' | 'hp' | 'elite' | 'attackSpeed', number>>; reward: string; lore: string }
export const HORSES: readonly HorseDef[] = [
  {id: 'nag', name: '驽马', quality: 'white', bonus: {move: .026}, reward: 'huangjin-3', lore: '第一章通关后中山商人张世平、苏双所献'},
  {id: 'grey_horse', name: '青骢', bonus: {move: .026}, reward: 'hulao-1', lore: '汜水关击败华雄'},
  {id: 'yellow_horse', name: '黄骠马', bonus: {pickup: .1}, reward: 'hulao-2', lore: '荥阳击败徐荣'},
  {id: 'chitu', name: '赤兔', legend: true, bonus: {move: .04, damage: .08}, reward: 'lubu', lore: '人中吕布，马中赤兔 · 天下地图挑战关「三英战吕布」首胜'},
  {id: 'black_horse', name: '乌骓', bonus: {damage: .05}, reward: 'third-1', lore: '群雄割据第一关首领'},
  {id: 'mule', name: '骡车', bonus: {ally: .05}, reward: 'third-2', lore: '群雄割据第二关首领'},
  {id: 'white_horse', name: '白马', bonus: {ally: .05}, reward: 'third-3', lore: '群雄割据章末首领'},
  {id: 'red_horse', name: '骅骝', bonus: {damage: .05}, reward: 'guandu-1', lore: '官渡第一关首领'},
  {id: 'jueying', name: '绝影', legend: true, bonus: {move: .04, ally: .08}, reward: 'guandu-3', lore: '宛城舍身救主 · 官渡章末首领'},
  {id: 'west_horse', name: '大宛马', bonus: {move: .026}, reward: 'chibi-1', lore: '赤壁第一关首领'},
  {id: 'dilu', name: '的卢', legend: true, bonus: {move: .04, hp: .1}, reward: 'chibi-3', lore: '一跃三丈过檀溪 · 赤壁章末首领'},
];
export const STARTER_HORSE = 'nag';
/** 马的品质框颜色：传说橙、普通蓝、驽马白。 */
export function horseQuality(h: HorseDef | undefined): 'white' | 'blue' | 'orange' { return h?.legend ? 'orange' : h?.quality ?? 'blue'; }
export function horseDef(id: string | undefined): HorseDef | undefined { return id ? HORSES.find(h => h.id === id) : undefined; }
export function horseForReward(key: string): HorseDef | undefined { return HORSES.find(h => h.reward === key); }
