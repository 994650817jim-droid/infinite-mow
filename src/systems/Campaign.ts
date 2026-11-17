import type {BuildSnapshot} from '../data/builds';
import { RunGrowth } from './RunGrowth';
import type { CharacterId } from '../data/characters';
import type { PlayerStats, WeaponState } from '../types';
import type { Player } from '../entities/Player';
import type { Legion, LegionState } from './Legion';
export interface CampaignTransfer {
  character: CharacterId; chapter: 'hulao' | 'huangjin'; stage?:1|2|3; army: LegionState;
  player: { build?: BuildSnapshot; growth?: Pick<RunGrowth,'attributes'|'masteries'|'trinkets'|'unallocated'> & {heroFree?: number}; stats: PlayerStats; level: number; xp: number; xpNext: number; relics: string[]; weapons: WeaponState[] };
}
export function packCampaign(character: CharacterId, player: Player, army: Legion): CampaignTransfer {
  return { character, chapter: 'hulao', army: army.exportState(), player: { build:player.growth.build.snapshot(), growth: {attributes:{...player.growth.attributes},masteries:{...player.growth.masteries},trinkets:[...player.growth.trinkets],unallocated:player.growth.unallocated,heroFree:player.growth.heroFree}, stats: { ...player.stats }, level: player.level, xp: player.xp, xpNext: player.xpNext, relics: [...player.relics], weapons: player.weapons.map(w => ({ ...w, cooldownLeft: 0 })) } };
}
export function restoreCampaign(state: CampaignTransfer, player: Player, army: Legion): void {
  // Rebuild relic-set bookkeeping, then restore the saved final stats exactly once.
  for (const relic of state.player.relics) player.addRelic(relic);
  Object.assign(player.stats, state.player.stats); player.level = state.player.level; player.xp = state.player.xp; player.xpNext = state.player.xpNext;
  // Restore values, never reapply reward callbacks. Timers/counters start fresh.
  player.growth = new RunGrowth(state.character);
  player.growth.build.restore(state.player.build);
  const growth=state.player.growth;
  if(growth){Object.assign(player.growth.attributes,growth.attributes);Object.assign(player.growth.masteries,growth.masteries);player.growth.trinkets.push(...growth.trinkets);player.growth.unallocated=growth.unallocated;player.growth.heroFree=growth.heroFree??0;}
  player.weapons = state.player.weapons.map(w => ({ ...w, cooldownLeft: 0 })); player.hp = player.maxHp;
  army.restore(state.army);
}

/**
 * 征程构筑（2026-11-17 用户批准 skill-carryover-proposal.md）：每位武将存一份，存进存档（im_campaign_v1），
 * 主线每赢一关（首次通关那一关）就更新，相当于「关卡存档点」。从天下地图 / 营寨 / 章节选关 / 结算「下一关」出征、
 * 关游戏重开时都从这里恢复；重打已通关的旧关、攻城、军情、挑战用空构筑，不读也不改它。失败 / 放弃不保存（退回开打前）。
 * 本局遗物不继承（存档时去掉），血量每关回满。
 */
export const CAMPAIGN_KEY = 'im_campaign_v1';
function readBuilds(): Record<string, CampaignTransfer> {
  try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null'); return v && v.version === 1 && v.heroes && typeof v.heroes === 'object' ? v.heroes : {}; } catch { return {}; }
}
export function saveCampaignBuild(hero: CharacterId, state: CampaignTransfer): void {
  const heroes = readBuilds(); heroes[hero] = { ...structuredClone(state), character: hero, player: { ...structuredClone(state.player), relics: [] } };
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ version: 1, heroes })); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用：本次不保存 */ }
}
export function loadCampaignBuild(hero: CharacterId): CampaignTransfer | undefined {
  const s = readBuilds()[hero];
  return s && s.player && Array.isArray(s.player.weapons) && s.army ? { ...s, character: hero } : undefined;
}
