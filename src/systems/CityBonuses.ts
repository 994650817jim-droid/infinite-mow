import type {Player} from '../entities/Player';
import type {permanentEffects} from '../world/WorldStore';

/**
 * W3 大城特产在战斗开局生效：武器伤害（每关都设）；最大生命与属性点只在一次出征的首关发放
 * （跨关继承时已包含，避免重复叠加）。后备兵名额由调用方传给 takeExpeditionReserve。
 */
export function applyCitySpecialties(player: Player, effects: ReturnType<typeof permanentEffects>, firstStage: boolean): void {
  player.growth.permanentDamage = effects.damageBonus;
  if (!firstStage) return;
  if (effects.maxHpBonus > 0) { player.stats.maxHpBonus += Math.round(player.maxHp * effects.maxHpBonus); player.hp = player.maxHp; }
  if (effects.attributePoints > 0) player.growth.addAttributePoints(effects.attributePoints);
}
