import type { CharacterId } from './characters';

/**
 * 武将属性（2026-11-17 用户批准 attribute-redesign-proposal.md，平衡会话初值）：
 * 力量 / 敏捷 / 智力 + 统御，每级 1 点（Lv.N 共 N−1 点），单项最多 10 点。
 * 每位武将有一个主属性：主属性每点额外 +1% 全伤害（最多 +10%）。
 * 计算在 systems/RunGrowth.ts；数值归平衡会话，改这里即可。
 */
export type AttributeId = 'strength' | 'agility' | 'intellect' | 'command';
/** 法术武器：武器命中也吃智力的法术伤害（诸葛亮火旗、庞统连环火雷、黄月英连弩、貂蝉团扇）；其余主武器是物理。 */
export const SPELL_WEAPONS: ReadonlySet<string> = new Set(['flame_banner', 'lianhuan_mines', 'crossbow', 'diaochan_fans']);
export const ATTRIBUTE_IDS: readonly AttributeId[] = ['strength', 'agility', 'intellect', 'command'];
/**
 * 单项上限（2026-11-18 平衡）：Lv41 以前每项 10 点（四项 40 点正好装下 40 级的点数）；之后随等级放宽到能装下全部点数，Lv58 封顶 15。
 * 这样第五～十章主属性仍是 10 点（主属性 ×1.25 的下调不被「多加 4 点」抵消），第六～十二章新等级的点数也有地方加。
 * ATTRIBUTE_MAX = 绝对上限（读档夹取、格子排版）；实际上限看 attributeCap(武将等级)。主属性专精门槛 4 / 7 / 10 不变。
 */
export const ATTRIBUTE_MAX = 15;
export function attributeCap(level: number): number { return Math.min(ATTRIBUTE_MAX, Math.max(10, Math.ceil((level - 1) / 4))); }
export const ATTRIBUTE_POINT_EVERY = 1;
/** 每点效果。 */
export const ATTRIBUTE_EFFECT = {
  strength: { damage: .015, hp: .03 },
  agility: { attackSpeed: .015, move: .01, crit: .005 },
  /** area：武器 / 技艺 / 地面效果的半径；skill：非普攻伤害（被动满层、灼烧、地火、遗珍、召唤物等）。 */
  // 智力 = 法术伤害 + 少量范围（2026-11-17 attribute-redesign-proposal.md 第 5 节，初值待测量）：skill 即法术系数
  intellect: { area: .008, skill: .025 },
  command: { allyDamage: .03, allyHp: .03 },
} as const;
/** 主属性每点额外全伤害，最多计 10 点。 */
export const PRIMARY_BONUS = { perPoint: .01, maxPoints: 10 } as const;
export const ATTRIBUTE_INFO: Record<AttributeId, { name: string; effect: string; icon: string }> = {
  strength: { name: '力量', effect: '伤害 +1.5%、生命上限 +3% / 点', icon: 'growth_icon_might' },
  agility: { name: '敏捷', effect: '攻速 +1.5%、移速 +1%、暴击 +0.5% / 点', icon: 'growth_icon_agility' },
  intellect: { name: '智力', effect: '法术伤害 +2.5%、范围 +0.8% / 点', icon: 'growth_icon_points' },
  command: { name: '统御', effect: '部曲伤害 +3%、部曲生命 +3% / 点', icon: 'growth_icon_tiger_tally' },
};
/**
 * 主属性加成（2026-11-17 用户：「属性点点武将的主属性，有更多加成或者有特殊加成」；主管理定方案，初值待平衡）：
 * 1. 主属性每点按 1.25 倍计算（2026-11-18 由 1.5 下调）（力量的伤害 / 生命、敏捷的攻速 / 移速 / 暴击、智力的法术 / 范围、统御的部曲伤害 / 生命）。
 * 2. 主属性专精：主属性满 4 / 7 / 10 点各解锁一档（单项上限 10 点，所以门槛按 4 / 7 / 10）。
 */
// 2026-11-18 平衡（hero-balance-review.md 第 5 节，用户「让平衡组决定」）：实测满 10 点 DPS 约翻倍 → 1.5 → 1.25，专精第 3 档减半
export const PRIMARY_MUL = 1.25;
export const PRIMARY_TIERS: readonly number[] = [4, 7, 10];
export const PRIMARY_PERK = {
  /** 力量：千钧（武器命中把小兵推开，同一敌人每 0.5 秒一次）/ 破阵（每 5 次武器命中一次重击：伤害 ×2、定身 0.5 秒）/ 斩将（对精英、首领 +10%）。 */
  strength: { shove: 18, shoveCdMs: 500, crushEvery: 5, crushMul: 2, crushStunMs: 500, eliteMul: .1 },
  /** 敏捷：轻骑（移速 +8%）/ 游刃（暴击 +5%、10% 闪避）/ 疾影（暴击后 2 秒攻速 +10%）。 */
  agility: { move: .08, crit: .05, dodge: .1, hasteMs: 2000, haste: .1 },
  /** 智力：凝神（法术武器冷却 −10%）/ 连珠（法术伤害 15% 几率翻倍）/ 广域（范围再 +6%）。 */
  intellect: { cooldown: .1, echoChance: .15, area: .06 },
  /** 统御：励军（部曲伤害 +15%）/ 募众（每次免费招兵多 1 人）/ 同袍（随从救起快 20%，救起带 55% 生命）。 */
  command: { allyDamage: .15, freeRecruit: 1, reviveFaster: .2, reviveHp: .55 },
} as const;
export const PRIMARY_PERK_INFO: Record<AttributeId, readonly { name: string; desc: string }[]> = {
  strength: [{ name: '千钧', desc: '武器命中把小兵推开' }, { name: '破阵', desc: '每 5 次武器命中一次重击：伤害 ×2，定身 0.5 秒' }, { name: '斩将', desc: '对精英、首领伤害 +10%' }],
  agility: [{ name: '轻骑', desc: '移速 +8%' }, { name: '游刃', desc: '暴击 +5%，10% 几率闪避伤害' }, { name: '疾影', desc: '暴击后 2 秒内攻速 +10%' }],
  intellect: [{ name: '凝神', desc: '法术武器冷却 −10%' }, { name: '连珠', desc: '法术伤害 15% 几率翻倍' }, { name: '广域', desc: '范围再 +6%' }],
  command: [{ name: '励军', desc: '部曲伤害 +15%' }, { name: '募众', desc: '每次免费招兵多 1 人' }, { name: '同袍', desc: '随从救起快 20%，救起带 55% 生命' }],
};
/** 武将主属性。 */
export const PRIMARY_ATTRIBUTE: Record<CharacterId, AttributeId> = {
  guanyu: 'strength', zhangfei: 'strength', weiyan: 'strength',
  zhaoyun: 'agility', machao: 'agility', huangzhong: 'agility', sunshangxiang: 'agility',
  zhuge: 'intellect', pangtong: 'intellect', huangyueying: 'intellect', diaochan: 'intellect',
  liubei: 'command',
};
export function primaryAttribute(hero: string): AttributeId | undefined { return (PRIMARY_ATTRIBUTE as Record<string, AttributeId>)[hero]; }
