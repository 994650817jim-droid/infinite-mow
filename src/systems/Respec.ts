import type { Player } from '../entities/Player';
import type { UpgradeOption } from '../types';
import { getCharacter } from '../data/characters';
import { TACTICS, type TacticId } from '../data/builds';
import { buildUpgradeOptions } from '../data/upgrades';
import { RESPEC, respecCost } from '../data/respec';

/**
 * 重整构筑（data/respec.ts）：退回次数直接从当前构筑算（不另记选卡日志），所以关页面 / 读档都不会多算少算：
 *  本命兵器等级 − 1、兵器专职（选了算 1）、专职加深（over）、武艺各级（含精熟）、战法各级 − 商人买的级、研读心法 − 商人买的派。
 * 重整 = 这些全退回初始；退回的次数记进 growth.respecPending，在休整里一张张重选（选完前关页面也不丢，下一关开打时补上）。
 */
export interface RespecCount { picks: number; weapon: number; branch: number; over: number; martial: number; tactic: number; manual: number }
export function countRespecPicks(player: Player): RespecCount {
  const g = player.growth, b = g.build, own = player.weapons.find(w => w.id === getCharacter(g.character).startWeapon);
  const weapon = Math.max(0, (own?.level ?? 1) - 1), branch = own?.branch ? 1 : 0, over = Math.max(0, own?.over ?? 0);
  let martial = 0; for (const v of Object.values(g.masteries)) martial += Math.max(0, v); for (const v of Object.values(g.masteryExtra)) martial += Math.max(0, v ?? 0);
  let tactic = 0; for (const [id, lv] of Object.entries(b.tactics)) tactic += Math.max(0, (lv ?? 0) - (b.bought[id as TacticId] ?? 0));
  const manual = b.manuals.filter(s => !b.boughtManuals.includes(s)).length;
  return { picks: weapon + branch + over + martial + tactic + manual, weapon, branch, over, martial, tactic, manual };
}
/** 本章还能重整几次（换章重新计）。 */
export function respecLeft(player: Player, chapter: number): number { const g = player.growth; return Math.max(0, RESPEC.perChapter - (g.respecCh === chapter ? g.respecN : 0)); }
export function respecPrice(player: Player, chapter: number): number { return respecCost(countRespecPicks(player).picks, chapter); }

/** 退回初始：本命兵器 Lv1、去掉专职与加深、武艺全退、战法只留商人买的级、心法只留商人买的派。返回退回的次数（同时记进 respecPending）。 */
export function resetBuild(player: Player, chapter: number): number {
  const g = player.growth, b = g.build, n = countRespecPicks(player).picks, own = player.weapons.find(w => w.id === getCharacter(g.character).startWeapon);
  if (own) { own.level = 1; delete own.branch; own.over = 0; }
  g.weaponOver = 0;
  for (const id of Object.keys(g.masteries) as Array<keyof typeof g.masteries>) g.masteries[id] = 0;
  g.masteryExtra = {};
  const kept: typeof b.tactics = {}; for (const [id, lv] of Object.entries(b.bought)) if (id in TACTICS && lv) kept[id as TacticId] = Math.min(lv, b.tactics[id as TacticId] ?? lv);
  b.tactics = kept; b.manuals = b.manuals.filter(s => b.boughtManuals.includes(s));
  g.respecPending += n; if (g.respecCh !== chapter) { g.respecCh = chapter; g.respecN = 0; } g.respecN++;
  return n;
}
/** 重选用的三张卡：只出永久构筑卡（本命 / 专职 / 武艺 / 战法），不出药、固本培元等本关卡。没有可选的返回空。 */
export function respecOptions(player: Player): UpgradeOption[] {
  const keep = (o: UpgradeOption) => o.kind === 'weapon' || o.kind === 'martial' || o.kind === 'tactic';
  for (let i = 0; i < 8; i++) { const opts = buildUpgradeOptions(player, player.weapons, player.growth).filter(keep); if (opts.length >= 2 || i === 7) return opts.slice(0, 3); }
  return [];
}
/** 重选一张：生效并把待补选次数减一。 */
export function respecPick(player: Player, option: UpgradeOption): void {
  option.apply(player, player.weapons, player.growth); player.growth.respecPending = Math.max(0, player.growth.respecPending - 1);
}
