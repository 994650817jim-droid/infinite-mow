import type {BuildSnapshot,TacticId} from '../data/builds';
import {BuildState} from '../data/builds';
import { charmForLegacy } from '../data/charms';
import { rollBaseItem, rollCharm, type ItemInstance } from '../data/items';
import { statsWithoutCharms } from './CharmEffects';
import { addItems, pushItemNotice } from './ItemStore';
import { RunGrowth } from './RunGrowth';
import type { CharacterId } from '../data/characters';
import type { SchoolId } from '../data/schools';
import type { PlayerStats, WeaponState } from '../types';
import type { Player } from '../entities/Player';
import type { Legion, LegionState } from './Legion';
export interface CampaignTransfer {
  character: CharacterId; chapter: 'hulao' | 'huangjin'; stage?:1|2|3; army: LegionState;
  /** 2026-11-17 本局遗物 / 宝物并入信物库：不再存 relics、trinkets、build.treasures（旧档里有的读档时换成信物，见 takeLegacyTreasures）。stats 不含信物加成。 */
  player: { build?: BuildSnapshot; growth?: Pick<RunGrowth,'attributes'|'masteries'|'unallocated'> & {heroFree?: number; masteryExtra?: RunGrowth['masteryExtra']}; stats: PlayerStats; weapons: WeaponState[];
    /** 2026-11-18 用户「前一关受的伤会继承到下一关」：主将剩余血量比例（0–1；旧档没有 = 满血）。 */ hpFrac?: number;
    /** 名将随从剩余血量比例（按随从 recruit.id；倒地的记 0，下一关以救起血量开局）。 */ followerHp?: Record<string, number> };
}
/** 打包时读随从血量用（FollowerSquad 的最小接口，免得 Campaign 依赖场景）。 */
export interface FollowerHpSource { members: ReadonlyArray<{ recruit: { id: string }; hp: number; maxHp: number; downed?: boolean }> }
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
export function packCampaign(character: CharacterId, player: Player, army: Legion, followers?: FollowerHpSource | null): CampaignTransfer {
  const followerHp: Record<string, number> = {};
  for (const m of followers?.members ?? []) followerHp[m.recruit.id] = m.downed ? 0 : Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
  return { character, chapter: 'hulao', army: army.exportState(), player: { build:player.growth.build.snapshot(), growth: {attributes:{...player.growth.attributes},masteries:{...player.growth.masteries},masteryExtra:{...player.growth.masteryExtra},unallocated:player.growth.unallocated,heroFree:player.growth.heroFree}, stats: statsWithoutCharms(player), weapons: player.weapons.map(w => ({ ...w, cooldownLeft: 0 })),
    hpFrac: Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp))), followerHp } };
}
/** 血量继承：主将（按比例，至少 1 血）与名将随从（倒地的以救起血量开局）。在等级 / 信物改完上限之后调用。 */
export function applyCarriedHp(state: CampaignTransfer, player: Player, followers?: { members: Array<{ recruit: { id: string }; hp: number; maxHp: number }> } | null, reviveFrac = .4): void {
  const f = state.player.hpFrac; player.hp = f === undefined ? player.maxHp : Math.max(1, Math.round(player.maxHp * Math.max(0, Math.min(1, f))));
  const map = state.player.followerHp ?? {};
  for (const m of followers?.members ?? []) { const v = map[m.recruit.id]; if (v === undefined) continue; m.hp = Math.max(1, Math.round(m.maxHp * (v > 0 ? Math.min(1, v) : reviveFrac))); }
}
/** 行营治疗后把存档里的征程构筑的血量也改掉（存档点是打赢那一刻存的，治疗在那之后）。 */
export function patchCampaignHp(hero: CharacterId, hpFrac: number, followerHp?: Record<string, number>): void {
  try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null'); const s = v?.heroes?.[hero]; if (!s?.player) return; s.player.hpFrac = Math.max(0, Math.min(1, hpFrac)); if (followerHp) s.player.followerHp = { ...(s.player.followerHp ?? {}), ...followerHp }; localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(v)); } catch { /* 存储不可用 */ }
}
/** 行营军需商人买了战法：把存档点里的战法与随军粮一并改掉（同 patchCampaignHp，存档点在买之前）。 */
export function patchCampaignTactics(hero: CharacterId, tactics: Record<string, number>, food: number, manuals?: readonly string[]): void {
  try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null'); const s = v?.heroes?.[hero]; if (!s?.player || !s.army) return; s.player.build = { ...(s.player.build ?? {}), tactics: { ...tactics }, ...(manuals ? { manuals: [...manuals] } : {}) }; s.army.food = food; localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(v)); } catch { /* 存储不可用 */ }
}
/**
 * 营寨旅商（军需商人在营寨里摆的摊）卖战法：不在战斗里，买下的写进该武将的征程构筑（下次从存档点出征时带上）。
 * 规则同 RunBuild：最多 6 种、每种到 3 级。没有征程构筑（还没打赢过主线关）时返回 null，商人卷轴不能买。
 */
export function campaignTacticBook(hero: CharacterId): { canLearn(id: TacticId): boolean; level(id: TacticId): number; manualsRead(): readonly SchoolId[] } | null {
  const s = loadCampaignBuild(hero); if (!s) return null;
  // 同 BuildState（2026-11-19 流派重做）：读档丢掉已删除的旧 id；基础成长不占战法格；反震不再出卡
  const b = new BuildState(); b.restore(s.player.build);
  return { level: id => b.rank(id), canLearn: id => b.canLearn(id), manualsRead: () => b.manuals };
}
/** 营寨旅商卖的「流派心法」：写进征程构筑（下次出征生效）；没有征程构筑或已研读过返回 false。 */
export function learnCampaignManual(hero: CharacterId, school: SchoolId): boolean {
  const book = campaignTacticBook(hero); if (!book || book.manualsRead().includes(school)) return false;
  try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null'); const s = v?.heroes?.[hero]; if (!s?.player) return false; s.player.build = { ...(s.player.build ?? { tactics: {} }), manuals: [...book.manualsRead(), school] }; localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(v)); return true; } catch { return false; }
}
/** 把一卷战法学进征程构筑：等级须与卷轴标的一致（买前没在别处升过），成功返回 true。 */
export function learnCampaignTactic(hero: CharacterId, id: TacticId, fromLevel: number): boolean {
  const book = campaignTacticBook(hero); if (!book || !book.canLearn(id) || book.level(id) !== fromLevel) return false;
  try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null'); const s = v?.heroes?.[hero]; if (!s?.player) return false; s.player.build = { ...(s.player.build ?? {}), tactics: { ...(s.player.build?.tactics ?? {}), [id]: fromLevel + 1 } }; localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(v)); return true; } catch { return false; }
}
export function restoreCampaign(state: CampaignTransfer, player: Player, army: Legion): void {
  takeLegacyTreasures(state);
  // Restore the saved final stats exactly once (信物加成由 GameScene 随后 applyCharms 重新加上).
  Object.assign(player.stats, state.player.stats); // 2026-11-17 取消局内等级：等级 / 经验即武将等级，开局由 GameScene.syncHeroLevel 读入
  // Restore values, never reapply reward callbacks. Timers/counters start fresh.
  player.growth = new RunGrowth(state.character);
  player.growth.build.restore(state.player.build);
  const growth=state.player.growth;
  if(growth){Object.assign(player.growth.attributes,growth.attributes);Object.assign(player.growth.masteries,growth.masteries);if(growth.masteryExtra)player.growth.masteryExtra={...growth.masteryExtra};player.growth.unallocated=growth.unallocated;player.growth.heroFree=growth.heroFree??0;}
  player.weapons = state.player.weapons.map(w => ({ ...w, cooldownLeft: 0 })); player.hp = player.maxHp;
  army.restore(state.army);
}

/**
 * 征程构筑（2026-11-17 用户批准 skill-carryover-proposal.md）：每位武将存一份，存进存档（im_campaign_v1），
 * 主线每赢一关（首次通关那一关）就更新，相当于「关卡存档点」。从天下地图 / 营寨 / 章节选关 / 结算「下一关」出征、
 * 关游戏重开时都从这里恢复；重打已通关的旧关、攻城、军情、挑战用空构筑，不读也不改它。失败 / 放弃不保存（退回开打前）。
 * 血量继承（2026-11-18 用户：前一关受的伤带到下一关；行营休整「军医」花随军粮治疗）。2026-11-17 本局遗物 / 宝物并入信物库：只继承武器、战法、技艺、局内等级、部曲。
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
