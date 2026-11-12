import type { CharacterId } from '../data/characters';
import type { PlayerStats, WeaponState } from '../types';
import type { Player } from '../entities/Player';
import type { Legion, LegionState } from './Legion';
export interface CampaignTransfer {
  character: CharacterId; chapter: 'hulao' | 'huangjin'; stage?:1|2|3; army: LegionState;
  player: { stats: PlayerStats; level: number; xp: number; xpNext: number; relics: string[]; weapons: WeaponState[] };
}
export function packCampaign(character: CharacterId, player: Player, army: Legion): CampaignTransfer {
  return { character, chapter: 'hulao', army: army.exportState(), player: { stats: { ...player.stats }, level: player.level, xp: player.xp, xpNext: player.xpNext, relics: [...player.relics], weapons: player.weapons.map(w => ({ ...w, cooldownLeft: 0 })) } };
}
export function restoreCampaign(state: CampaignTransfer, player: Player, army: Legion): void {
  // Rebuild relic-set bookkeeping, then restore the saved final stats exactly once.
  for (const relic of state.player.relics) player.addRelic(relic);
  Object.assign(player.stats, state.player.stats); player.level = state.player.level; player.xp = state.player.xp; player.xpNext = state.player.xpNext;
  player.weapons = state.player.weapons.map(w => ({ ...w, cooldownLeft: 0 })); player.hp = player.maxHp;
  army.restore(state.army);
}
