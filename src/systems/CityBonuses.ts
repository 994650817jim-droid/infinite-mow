import type {Player} from '../entities/Player';
import type {permanentEffects} from '../world/WorldStore';
import type {Legion} from './Legion';
import {POUCH_MAX, type BattlefieldSupplies} from './BattlefieldSupplies';

/**
 * 营寨与大城特产在战斗开局生效：武器伤害（每关都设）；最大生命与属性点只在一次出征的首关发放
 * （跨关继承时已包含，避免重复叠加）。后备兵名额由调用方传给 takeExpeditionReserve。
 * 讲武堂科技：回血药每关开局放进药囊（不超过药囊上限）；兵种开局等级只在首关设定（跨关时随军团状态继承）。
 * 调用方须在招募开局增援之前调用，增援兵才会按科技等级入列。
 */
export function applyCitySpecialties(player: Player, effects: ReturnType<typeof permanentEffects>, firstStage: boolean, extra?: {legion?: Legion; supplies?: BattlefieldSupplies | null}): void {
  player.growth.permanentDamage = effects.damageBonus;
  if (firstStage) {
    if (extra?.legion) for (const [kind, level] of Object.entries(effects.troopLevels) as Array<[keyof Legion['levels'], number]>) extra.legion.levels[kind] = Math.max(extra.legion.levels[kind] ?? 1, level);
    if (effects.maxHpBonus !== 0) { player.stats.maxHpBonus += Math.round(player.maxHp * effects.maxHpBonus); player.hp = player.maxHp; }
    if (effects.attributePoints > 0) player.growth.addAttributePoints(effects.attributePoints);
  }
  const pouch = extra?.supplies?.pouch, potions = effects.potions;
  if (pouch && potions) for (let i = 0; i < potions.count && pouch.length < POUCH_MAX; i++) pouch.push({amount: Math.round(player.maxHp * potions.ratio), texture: 'healing_potion', name: '回血药'});
}
