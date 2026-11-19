import { ATTRIBUTE_EFFECT, ATTRIBUTE_INFO, ATTRIBUTE_MAX, PRIMARY_BONUS, PRIMARY_MUL, PRIMARY_PERK_INFO, PRIMARY_TIERS, primaryAttribute, type AttributeId } from '../data/attributes';
import { getCharacter, type CharacterId } from '../data/characters';
import type { InfoTip } from './ItemTooltip';

/**
 * 主属性说明（2026-11-18 用户「关于每个英雄主属性，在加点那里要说出来有什么特殊加成」）：
 * 加点面板主属性一行、行营构筑总览武将卡共用。倍率 / 档位 / 专精全读 data/attributes（平衡会话改数值这里自动跟着变）。
 * 文案顺序：先「主属性：敏捷」，再「每点效果 ×1.5」，最后档位奖励。
 */
export interface PrimaryTier { at: number; name: string; desc: string; on: boolean; left: number }
export interface PrimarySummary {
  attr: AttributeId; name: string;
  /** 「主属性：敏捷 · 每点效果 ×1.5」 */
  head: string;
  /** 「×1.5」 */
  mul: string;
  tiers: PrimaryTier[];
  /** 专精档位小标签：已解锁「◆ 轻骑」，未解锁「◇ 游刃 · 再加 3 点」。 */
  chips: string[];
  /** 一行简写：「专精 1/3 · 下一档「游刃」再加 3 点」。 */
  next: string;
  /** 完整说明（ItemTooltip.showInfo）。 */
  tip: InfoTip;
}

const pct = (v: number): string => `${+(v * 100).toFixed(2)}%`;
const E = ATTRIBUTE_EFFECT;
/** 每点效果拆成「名称 + 数值」，按倍率换算主属性的实际每点效果。 */
const PARTS: Record<AttributeId, Array<[string, number]>> = {
  strength: [['伤害', E.strength.damage], ['生命上限', E.strength.hp]],
  agility: [['攻速', E.agility.attackSpeed], ['移速', E.agility.move], ['暴击', E.agility.crit]],
  intellect: [['法术伤害', E.intellect.skill], ['范围', E.intellect.area]],
  command: [['部曲伤害', E.command.allyDamage], ['部曲生命', E.command.allyHp]],
};
export const primaryMulText = (): string => '×' + +PRIMARY_MUL.toFixed(2);

export function primarySummary(hero: string, points: number): PrimarySummary | null {
  const attr = primaryAttribute(hero); if (!attr) return null;
  const name = ATTRIBUTE_INFO[attr].name, mul = primaryMulText(), info = PRIMARY_PERK_INFO[attr];
  const tiers: PrimaryTier[] = PRIMARY_TIERS.map((at, k) => ({ at, name: info[k]?.name ?? '', desc: info[k]?.desc ?? '', on: points >= at, left: Math.max(0, at - points) }));
  const chips = tiers.map(t => t.on ? `◆ ${t.name}` : `◇ ${t.name} · 再加 ${t.left} 点`);
  const lit = tiers.filter(t => t.on).length, up = tiers.find(t => !t.on);
  const next = `专精 ${lit}/${tiers.length}` + (up ? ` · 下一档「${up.name}」再加 ${up.left} 点` : ' · 三档全开');
  let heroName = '';
  try { heroName = getCharacter(hero as CharacterId).name; } catch { /* 未知武将 */ }
  // 每项单独一行（说明卡窄，写在一行会把「+4.5%」折断）
  const each = PARTS[attr].map(([l, v]) => `· ${l} +${pct(v)} → +${pct(v * PRIMARY_MUL)}`);
  const body = [
    `每点效果 ${mul}：`,
    ...each,
    `另：每点再 +${pct(PRIMARY_BONUS.perPoint)} 全伤害（最多计 ${PRIMARY_BONUS.maxPoints} 点）`,
    '',
    '专精（主属性加到对应点数自动解锁）：',
    ...tiers.map(t => `${t.on ? '◆' : '◇'} 满 ${t.at} 点「${t.name}」${t.desc}${t.on ? '（已解锁）' : `（再加 ${t.left} 点）`}`),
  ].join('\n');
  return {
    attr, name, mul, tiers, chips, next,
    head: `主属性：${name} · 每点效果 ${mul}`,
    tip: { title: `主属性：${name}`, sub: `${heroName ? heroName + ' · ' : ''}已加 ${points}/${ATTRIBUTE_MAX} 点 · 专精 ${lit}/${tiers.length} 档`, body, color: 0xe8c27a },
  };
}
