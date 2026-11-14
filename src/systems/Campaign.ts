import type {BuildSnapshot} from '../data/builds';
import { RunGrowth } from './RunGrowth';
import type { CharacterId } from '../data/characters';
import type { PlayerStats, WeaponState } from '../types';
import type { Player } from '../entities/Player';
import type { Legion, LegionState } from './Legion';
export interface CampaignTransfer {
  character: CharacterId; chapter: 'hulao' | 'huangjin'; stage?:1|2|3; army: LegionState;
  player: { build?: BuildSnapshot; growth?: Pick<RunGrowth,'attributes'|'masteries'|'trinkets'|'unallocated'>; stats: PlayerStats; level: number; xp: number; xpNext: number; relics: string[]; weapons: WeaponState[] };
}
export function packCampaign(character: CharacterId, player: Player, army: Legion): CampaignTransfer {
  return { character, chapter: 'hulao', army: army.exportState(), player: { build:player.growth.build.snapshot(), growth: {attributes:{...player.growth.attributes},masteries:{...player.growth.masteries},trinkets:[...player.growth.trinkets],unallocated:player.growth.unallocated}, stats: { ...player.stats }, level: player.level, xp: player.xp, xpNext: player.xpNext, relics: [...player.relics], weapons: player.weapons.map(w => ({ ...w, cooldownLeft: 0 })) } };
}
export function restoreCampaign(state: CampaignTransfer, player: Player, army: Legion): void {
  // Rebuild relic-set bookkeeping, then restore the saved final stats exactly once.
  for (const relic of state.player.relics) player.addRelic(relic);
  Object.assign(player.stats, state.player.stats); player.level = state.player.level; player.xp = state.player.xp; player.xpNext = state.player.xpNext;
  // Restore values, never reapply reward callbacks. Timers/counters start fresh.
  player.growth = new RunGrowth(state.character);
  player.growth.build.restore(state.player.build);
  const growth=state.player.growth;
  if(growth){Object.assign(player.growth.attributes,growth.attributes);Object.assign(player.growth.masteries,growth.masteries);player.growth.trinkets.push(...growth.trinkets);player.growth.unallocated=growth.unallocated;}
  player.weapons = state.player.weapons.map(w => ({ ...w, cooldownLeft: 0 })); player.hp = player.maxHp;
  army.restore(state.army);
}
