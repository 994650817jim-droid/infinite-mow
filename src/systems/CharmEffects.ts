/**
 * 信物库新信物的战斗效果（2026-11-17，data/charms.ts）。开局 / 换装后调用 applyCharms：
 * - 属性类、传奇类、护心镜：直接加到 player.stats（和原本局遗物一样，武器读这些倍率），并记下加了多少，换装时先撤再加；
 *   征程构筑存档时用 statsWithoutCharms 存不含信物的属性，避免读档后重复叠加。
 * - 同流派 2 件：原套装（无双近战 +8% / 神射箭类 +8% / 烈焰火焰 +10% / 铁壁生命 +10%）。
 * - 机制类：注入 build.treasures（计原构筑标签、参与觉醒），品质写进 build.treasurePower；护心镜计铁壁、虎钮印计统御。
 * - 传奇类的触发（震击 / 残火 / 击杀回复）由 GameScene 读 growth.charmLegend 实现。
 */
import { BASE_TOKEN_TAG, CHARM_LEGEND, CHARM_STAT, HEART_MIRROR, REVIVAL_INVULN, charmDef, legendTier, mechPower, statFactor, type CharmSchool } from '../data/charms';
import type { BuildTag, TreasureId } from '../data/builds';
import type { ItemInstance } from '../data/items';
import type { PlayerStats } from '../types';
import type { Player } from '../entities/Player';
import { loadout, type GearOwner } from './ItemStore';
import { stripStageBuffs } from './StageBuffs';

/** 加到 player.stats 上的量：damageMul / cooldownMul / damageTakenMul 为乘数，其余为加数。 */
export interface CharmStatDelta { damageMul: number; cooldownMul: number; damageTakenMul: number; critChance: number; arrowMul: number; fireMul: number; fireAreaMul: number; meleeMul: number }
const MUL = ['damageMul', 'cooldownMul', 'damageTakenMul'] as const, ADD = ['critChance', 'arrowMul', 'fireMul', 'fireAreaMul', 'meleeMul'] as const;
export const noCharmDelta = (): CharmStatDelta => ({ damageMul: 1, cooldownMul: 1, damageTakenMul: 1, critChance: 0, arrowMul: 0, fireMul: 0, fireAreaMul: 0, meleeMul: 0 });
/** 传奇类信物的档位（0 紫 / 1 橙），没穿为 undefined。 */
export type CharmLegends = Partial<Record<'human_seal' | 'heaven_ember' | 'army_jade', number>>;

export interface CharmState {
  delta: CharmStatDelta; hp: number; legends: CharmLegends; revivalMs: number;
  treasures: TreasureId[]; power: Partial<Record<TreasureId, number>>; tags: BuildTag[]; schools: Record<CharmSchool, number>;
}

/** 武将穿着的信物（两格）。 */
export function wornTokens(hero: GearOwner): ItemInstance[] {
  try { const l = loadout(hero); return [l.token, l.token2].filter((i): i is ItemInstance => !!i); } catch { return []; }
}

export function charmState(items: readonly ItemInstance[]): CharmState {
  const d = noCharmDelta(), out: CharmState = { delta: d, hp: 0, legends: {}, revivalMs: 1000, treasures: [], power: {}, tags: [], schools: { wushuang: 0, shenshe: 0, lieyan: 0, tiebi: 0 } };
  for (const item of items) {
    const tag = BASE_TOKEN_TAG[item.base]; if (tag) out.tags.push(tag);
    const def = charmDef(item.base); if (!def) continue;
    const q = item.quality, f = statFactor(q), t = legendTier(q);
    if (def.school) out.schools[def.school]++;
    switch (def.id) {
      case 'charm_whetstone': d.damageMul *= 1 + CHARM_STAT.charm_whetstone.damage * f; break;
      case 'charm_drum': d.cooldownMul *= 1 - CHARM_STAT.charm_drum.cooldown * f; break;
      case 'charm_ring': d.critChance += CHARM_STAT.charm_ring.crit * f; break;
      case 'charm_quiver': d.arrowMul += CHARM_STAT.charm_quiver.arrow * f; break;
      case 'charm_guard': d.damageTakenMul *= 1 - CHARM_STAT.charm_guard.reduce * f; break;
      case 'charm_oil': d.fireMul += CHARM_STAT.charm_oil.fire * f; d.fireAreaMul += CHARM_STAT.charm_oil.fireArea * f; break;
      case 'charm_human_seal': d.damageMul *= 1 + CHARM_LEGEND.charm_human_seal.damage[t]; out.legends.human_seal = t; break;
      case 'charm_heaven_ember': d.fireMul += CHARM_LEGEND.charm_heaven_ember.fire[t]; out.legends.heaven_ember = t; break;
      case 'charm_army_jade': d.damageTakenMul *= 1 - CHARM_LEGEND.charm_army_jade.reduce[t]; out.legends.army_jade = t; break;
      case 'charm_heart_mirror': d.damageTakenMul *= 1 - HEART_MIRROR[t]; break;
    }
    if (def.tag && !def.treasure) out.tags.push(def.tag);
    if (def.treasure && !out.treasures.includes(def.treasure)) {
      out.treasures.push(def.treasure); out.power[def.treasure] = mechPower(q);
      if (def.treasure === 'revival_jade') out.revivalMs = REVIVAL_INVULN[t];
    }
  }
  // 同流派 2 件套（原数值）
  if (out.schools.wushuang >= 2) d.meleeMul += .08;
  if (out.schools.shenshe >= 2) d.arrowMul += .08;
  if (out.schools.lieyan >= 2) d.fireMul += .1;
  if (out.schools.tiebi >= 2) out.hp += .1;
  return out;
}

function unapply(stats: PlayerStats, d: CharmStatDelta): void {
  for (const k of MUL) stats[k] /= d[k];
  for (const k of ADD) stats[k] -= d[k];
}
function apply(stats: PlayerStats, d: CharmStatDelta): void {
  for (const k of MUL) stats[k] *= d[k];
  for (const k of ADD) stats[k] += d[k];
}

/** 读该武将穿着的信物，换掉上一次加的效果。返回生效状态（测试 / 界面用）。 */
export function applyCharms(player: Player, items: readonly ItemInstance[]): CharmState {
  const g = player.growth, s = charmState(items);
  if (g.charmDelta) unapply(player.stats, g.charmDelta);
  apply(player.stats, s.delta); g.charmDelta = s.delta;
  g.charmHp = s.hp; g.charmLegend = s.legends; g.revivalMs = s.revivalMs;
  g.build.treasures = [...s.treasures]; g.build.treasurePower = { ...s.power }; g.build.extraTags = [...s.tags];
  return s;
}

/** 不含信物加成的属性（征程构筑存档用）。 */
export function statsWithoutCharms(player: Player): PlayerStats {
  const stats = { ...player.stats }; const d = player.growth.charmDelta; if (d) unapply(stats, d); return stripStageBuffs(stats, player); // 战场机缘的本关增益也不带走
}
