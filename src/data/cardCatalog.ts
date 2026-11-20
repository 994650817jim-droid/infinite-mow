import type { Player } from '../entities/Player';
import type { UpgradeOption, WeaponState } from '../types';
import { getCharacter } from './characters';
import { WEAPON_DEFS } from '../weapons/registry';
import { MARTIALS, type MasteryId } from '../systems/RunGrowth';
import { TACTICS, tacticDescription, tacticSchool, type TacticId } from './builds';
import { SCHOOL_IDS } from './schools';
import { branchesFor } from './weaponBranches';
import { weaponUpgrade, branchOption, overOption, martialOption, potionOption, foundationOptions, schoolLabel } from './upgrades';
import { make, chestCharmCard, JINNANG, GAMBLES, BOUNTIES, type CardHost, type JinnangId, type GambleId, type BountyId } from '../systems/LevelCards';
import { FORTUNE_BUFFS } from './fortunes';

/**
 * 升级三选一的卡面总表（2026-11-19 三选一文案审校）：给这位主将可能出现的每一张卡各造一份（不执行效果），
 * 测试逐张渲染查溢出 / undefined / NaN（tools/test-levelup-cards.mjs），截图工具按 id 取卡（tools/shot-levelup-cards.mjs）。
 * id 约定：weapon_<武器>_<当前级>、branch_<分支>、weapon_over_<6|7>_<分支>、martial_<武艺>_<级>、tactic_<战法>_<级>、
 * new_*（机缘 / 兵源 / 军资 / 名将）、new_manual_<派>、jinnang_<id>、gamble_<id>、bounty_<id>、charm_card_<章>、foundation_*、potion_*。
 */
export function cardCatalog(player: Player, o: { chapter?: number } = {}): UpgradeOption[] {
  const g = player.growth, hero = getCharacter(g.character), out: UpgradeOption[] = [], chapter = o.chapter ?? 9;
  // 本命：每一级（1→2 … max-1→max），用当前属性算伤害
  const wid = hero.startWeapon, def = WEAPON_DEFS[wid];
  for (let lv = 1; lv < def.maxLevel; lv++) { const w: WeaponState = { id: wid, level: lv, cooldownLeft: 0 }; out.push({ ...weaponUpgrade(w, player), id: `weapon_${wid}_${lv}` }); }
  // 兵器专职二选一 + Lv6 / 7（每条分支各一张）
  for (const b of branchesFor(wid)) {
    const w: WeaponState = { id: wid, level: def.maxLevel, cooldownLeft: 0, branch: b.id };
    out.push(branchOption(w, b));
    for (const over of [0, 1]) out.push({ ...overOption({ ...w, over }, b, g.character), id: `weapon_over_${6 + over}_${b.id}` });
  }
  // 专属武艺 Lv1–5（Lv4 / 5 精熟）
  for (const id of Object.keys(MARTIALS) as MasteryId[]) if (g.owns(id)) for (let lv = 0; lv < 5; lv++) out.push(martialOption(id, lv));
  // 战法 Lv1–5（Lv4 / 5 精研）；流派标签按当前势
  const tags = g.build.tags();
  for (const id of Object.keys(TACTICS) as TacticId[]) for (let n = 1; n <= 5; n++) {
    const sc = tacticSchool(id), d = TACTICS[id];
    out.push({ id: `tactic_${id}_${n}`, name: d.name + ' · Lv.' + n, desc: tacticDescription(id, n), kind: 'tactic', scope: 'run', icon: 'build_icon_' + id, categoryLabel: sc ? schoolLabel(sc, tags) : '基础成长', apply: () => undefined });
  }
  out.push(potionOption('rejuvenation'), ...foundationOptions());
  // 新卡：每一种都造出来（按类别，不按随机）
  const host: CardHost = {
    chapter, taken: {}, applyBuff: () => undefined, momentum: () => false, startMomentum: () => undefined, jinnangHeld: () => false, giveJinnang: () => undefined,
    escort: () => undefined, general: () => undefined, addGrain: () => undefined, healFrac: () => undefined,
    manualSchools: () => [...SCHOOL_IDS], readManual: () => undefined, gambleTaken: () => false, gamble: () => undefined, bountyOpen: () => true, bounty: () => undefined,
  };
  for (const k of ['troops', 'supply', 'general'] as const) { const c = make(k, host, () => .5); if (c) out.push(c); }
  out.push(make('fortune', host, () => .1)!); // 乘胜追击
  for (const [i, f] of FORTUNE_BUFFS.entries()) { const c = make('fortune', { ...host, momentum: () => true }, () => (i + .5) / FORTUNE_BUFFS.length); /* 已在乘胜：不掷乘胜，直接按序取 */ if (c) out.push({ ...c, id: 'new_' + f.id }); }
  for (const [i, id] of (Object.keys(JINNANG) as JinnangId[]).entries()) { const c = make('jinnang', host, () => (i + .5) / Object.keys(JINNANG).length); if (c) out.push({ ...c, id: 'jinnang_' + id }); }
  for (const [i, id] of (Object.keys(GAMBLES) as GambleId[]).entries()) { const c = make('gamble', host, () => (i + .5) / Object.keys(GAMBLES).length); if (c) out.push({ ...c, id: 'gamble_' + id }); }
  for (const [i, id] of (Object.keys(BOUNTIES) as BountyId[]).entries()) { const c = make('bounty', host, () => (i + .5) / Object.keys(BOUNTIES).length); if (c) out.push({ ...c, id: 'bounty_' + id }); }
  for (const [i, s] of SCHOOL_IDS.entries()) { const c = make('manual', host, () => (i + .5) / SCHOOL_IDS.length); if (c) out.push({ ...c, id: 'new_manual_' + s }); }
  for (const ch of [3, 6, 10]) out.push({ ...chestCharmCard(ch, () => ''), id: 'charm_card_' + ch });
  return out;
}
