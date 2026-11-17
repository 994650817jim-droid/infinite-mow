import type {BuildSnapshot} from '../data/builds';
import { charmForLegacy } from '../data/charms';
import { rollBaseItem, rollCharm, type ItemInstance } from '../data/items';
import { statsWithoutCharms } from './CharmEffects';
import { addItems, pushItemNotice } from './ItemStore';
import { RunGrowth } from './RunGrowth';
import type { CharacterId } from '../data/characters';
import type { PlayerStats, WeaponState } from '../types';
import type { Player } from '../entities/Player';
import type { Legion, LegionState } from './Legion';
export interface CampaignTransfer {
  character: CharacterId; chapter: 'hulao' | 'huangjin'; stage?:1|2|3; army: LegionState;
  /** 2026-11-17 本局遗物 / 宝物并入信物库：不再存 relics、trinkets、build.treasures（旧档里有的读档时换成信物，见 takeLegacyTreasures）。stats 不含信物加成。 */
  player: { build?: BuildSnapshot; growth?: Pick<RunGrowth,'attributes'|'masteries'|'unallocated'> & {heroFree?: number}; stats: PlayerStats; weapons: WeaponState[] };
}
/**
 * 旧档迁移：构筑里的本局宝物 / 饰品换成同名信物（橙色，放进行囊、不自动穿）；已删除的（疾风靴）换成随机橙色信物。
 * 改写传入的 state（删掉这些字段），返回发放的件数。
 */
export function takeLegacyTreasures(state: CampaignTransfer): number {
  const p = state.player as CampaignTransfer['player'] & { relics?: unknown; growth?: { trinkets?: unknown } };
  const ids = [...(Array.isArray(p.build?.treasures) ? p.build!.treasures : []), ...(Array.isArray(p.growth?.trinkets) ? p.growth!.trinkets as unknown[] : [])].filter((x): x is string => typeof x === 'string');
  if (p.build) delete p.build.treasures; if (p.growth) delete p.growth.trinkets; delete p.relics;
  const items = ids.map(id => { const base = charmForLegacy(id); return base?.startsWith('charm_') ? rollCharm('orange', Math.random, base) : base ? rollBaseItem(base, 'orange') : rollCharm('orange'); }).filter((i): i is ItemInstance => !!i);
  if (items.length) { try { addItems(items); pushItemNotice(`旧的本局宝物 ${items.length} 件已换成橙色信物，放进行囊`); } catch { /* 存储不可用 */ } }
  return items.length;
}
export function packCampaign(character: CharacterId, player: Player, army: Legion): CampaignTransfer {
  return { character, chapter: 'hulao', army: army.exportState(), player: { build:player.growth.build.snapshot(), growth: {attributes:{...player.growth.attributes},masteries:{...player.growth.masteries},unallocated:player.growth.unallocated,heroFree:player.growth.heroFree}, stats: statsWithoutCharms(player), weapons: player.weapons.map(w => ({ ...w, cooldownLeft: 0 })) } };
}
export function restoreCampaign(state: CampaignTransfer, player: Player, army: Legion): void {
  takeLegacyTreasures(state);
  // Restore the saved final stats exactly once (信物加成由 GameScene 随后 applyCharms 重新加上).
  Object.assign(player.stats, state.player.stats); // 2026-11-17 取消局内等级：等级 / 经验即武将等级，开局由 GameScene.syncHeroLevel 读入
  // Restore values, never reapply reward callbacks. Timers/counters start fresh.
  player.growth = new RunGrowth(state.character);
  player.growth.build.restore(state.player.build);
  const growth=state.player.growth;
  if(growth){Object.assign(player.growth.attributes,growth.attributes);Object.assign(player.growth.masteries,growth.masteries);player.growth.unallocated=growth.unallocated;player.growth.heroFree=growth.heroFree??0;}
  player.weapons = state.player.weapons.map(w => ({ ...w, cooldownLeft: 0 })); player.hp = player.maxHp;
  army.restore(state.army);
}

/**
 * 征程构筑（2026-11-17 用户批准 skill-carryover-proposal.md）：每位武将存一份，存进存档（im_campaign_v1），
 * 主线每赢一关（首次通关那一关）就更新，相当于「关卡存档点」。从天下地图 / 营寨 / 章节选关 / 结算「下一关」出征、
 * 关游戏重开时都从这里恢复；重打已通关的旧关、攻城、军情、挑战用空构筑，不读也不改它。失败 / 放弃不保存（退回开打前）。
 * 血量每关回满。2026-11-17 本局遗物 / 宝物并入信物库：只继承武器、战法、技艺、局内等级、部曲。
 */
export const CAMPAIGN_KEY = 'im_campaign_v1';
function readBuilds(): Record<string, CampaignTransfer> {
  let heroes: Record<string, CampaignTransfer> = {};
  try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null'); heroes = v && (v.version === 1 || v.version === 2) && v.heroes && typeof v.heroes === 'object' ? v.heroes : {}; } catch { return {}; }
  // 旧档迁移：存档里的本局宝物换成信物（只做一次：换完立刻写回）
  let moved = 0; for (const s of Object.values(heroes)) if (s?.player) moved += takeLegacyTreasures(s);
  if (moved) try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ version: 2, heroes })); } catch { /* */ }
  return heroes;
}
export function saveCampaignBuild(hero: CharacterId, state: CampaignTransfer): void {
  const heroes = readBuilds(); heroes[hero] = { ...structuredClone(state), character: hero, player: structuredClone(state.player) };
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify({ version: 2, heroes })); localStorage.setItem('im_slot_touched', String(Date.now())); } catch { /* 存储不可用：本次不保存 */ }
}
export function loadCampaignBuild(hero: CharacterId): CampaignTransfer | undefined {
  const s = readBuilds()[hero];
  return s && s.player && Array.isArray(s.player.weapons) && s.army ? { ...s, character: hero } : undefined;
}
