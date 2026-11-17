import type { CharacterId } from './characters';

/**
 * 武将属性（2026-11-17 用户批准 attribute-redesign-proposal.md，平衡会话初值）：
 * 力量 / 敏捷 / 智力 + 统御，每级 1 点（Lv.N 共 N−1 点），单项最多 10 点。
 * 每位武将有一个主属性：主属性每点额外 +1% 全伤害（最多 +10%）。
 * 计算在 systems/RunGrowth.ts；数值归平衡会话，改这里即可。
 */
export type AttributeId = 'strength' | 'agility' | 'intellect' | 'command';
export const ATTRIBUTE_IDS: readonly AttributeId[] = ['strength', 'agility', 'intellect', 'command'];
export const ATTRIBUTE_MAX = 10;
export const ATTRIBUTE_POINT_EVERY = 1;
/** 每点效果。 */
export const ATTRIBUTE_EFFECT = {
  strength: { damage: .015, hp: .03 },
  agility: { attackSpeed: .015, move: .01, crit: .005 },
  /** area：武器 / 技艺 / 地面效果的半径；skill：非普攻伤害（被动满层、灼烧、地火、遗珍、召唤物等）。 */
  intellect: { area: .015, skill: .03 },
  command: { allyDamage: .03, allyHp: .03 },
} as const;
/** 主属性每点额外全伤害，最多计 10 点。 */
export const PRIMARY_BONUS = { perPoint: .01, maxPoints: 10 } as const;
export const ATTRIBUTE_INFO: Record<AttributeId, { name: string; effect: string; icon: string }> = {
  strength: { name: '力量', effect: '伤害 +1.5%、生命上限 +3% / 点', icon: 'growth_icon_might' },
  agility: { name: '敏捷', effect: '攻速 +1.5%、移速 +1%、暴击 +0.5% / 点', icon: 'growth_icon_agility' },
  intellect: { name: '智力', effect: '范围 +1.5%、技艺伤害 +3% / 点', icon: 'growth_icon_points' },
  command: { name: '统御', effect: '部曲伤害 +3%、部曲生命 +3% / 点', icon: 'growth_icon_tiger_tally' },
};
/** 武将主属性。 */
export const PRIMARY_ATTRIBUTE: Record<CharacterId, AttributeId> = {
  guanyu: 'strength', zhangfei: 'strength', weiyan: 'strength',
  zhaoyun: 'agility', machao: 'agility', huangzhong: 'agility', sunshangxiang: 'agility',
  zhuge: 'intellect', pangtong: 'intellect', huangyueying: 'intellect', diaochan: 'intellect',
  liubei: 'command',
};
export function primaryAttribute(hero: string): AttributeId | undefined { return (PRIMARY_ATTRIBUTE as Record<string, AttributeId>)[hero]; }
