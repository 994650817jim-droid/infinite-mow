/**
 * 名将连战 · 局内 build 卡池（共享笔记 gauntlet-build.md，统筹 11-21 确认）：稀有度四档、三选一类别分散、将星卡（24 要星 + 4 主星）。
 * 纯数据 / 规则，场景接线在 scenes/GauntletGameScene.ts（upgradeChoices / renderCards）。数值是初值，交平衡。
 */
import { QUALITIES } from './items';
import { ATTRIBUTE_IDS, type AttributeId } from './attributes';
import { STAR_BY_ID, STAR_NODES, STAR_RULES, perkStarId } from './starMap';

export type GRarity = 'common' | 'fine' | 'rare' | 'legend';
export const RARITY_ORDER: readonly GRarity[] = ['common', 'fine', 'rare', 'legend'];
/** 四档稀有度，颜色沿用兵装品质色（白 / 蓝 / 紫 / 橙；统筹确认不另起一套）。 */
export const RARITY: Record<GRarity, { name: string; color: number; css: string }> = {
  common: { name: '普通', color: QUALITIES.white.color, css: QUALITIES.white.css },
  fine: { name: '精良', color: QUALITIES.blue.color, css: QUALITIES.blue.css },
  rare: { name: '稀有', color: QUALITIES.purple.color, css: QUALITIES.purple.css },
  legend: { name: '传说', color: QUALITIES.orange.color, css: QUALITIES.orange.css },
};
/** 稀有度随阵数（gauntlet-build.md 第三节第 5 条）：普通 / 精良 / 稀有 / 传说 的权重。 */
export const RARITY_BY_WAVE: ReadonlyArray<{ upTo: number; w: readonly [number, number, number, number] }> = [
  { upTo: 3, w: [.70, .25, .05, 0] }, { upTo: 6, w: [.50, .33, .15, .02] }, { upTo: 9, w: [.35, .35, .24, .06] }, { upTo: Infinity, w: [.25, .35, .30, .10] },
];
export function rarityWeights(wave: number): readonly [number, number, number, number] { return (RARITY_BY_WAVE.find(r => wave <= r.upTo) ?? RARITY_BY_WAVE[RARITY_BY_WAVE.length - 1]).w; }
/** 按本阵的稀有度表掷一档。 */
export function rollRarity(wave: number, rnd: () => number = Math.random): GRarity {
  const w = rarityWeights(wave), t = w.reduce((a, b) => a + b, 0); let r = rnd() * t;
  for (let i = 0; i < 4; i++) { r -= w[i]; if (r < 0) return RARITY_ORDER[i]; }
  return 'common';
}
/**
 * 局内 build 的规则（初值）：
 * - extraChance：三选一里三类本来就不重样时，仍有这个几率把「新卡」那张换成一张本模式专有的卡（将星 / 兵装……），让它们常出；
 * - keystoneMax：主星每局最多几颗（同星图规则 2 颗，代价照旧）；charmSlots：信物最多戴几件（同战役两格）；
 * - extraWeights：抽本模式专有卡时先按这个权重挑一类（将星 / 兵装 / 信物 / 坐骑），再按稀有度挑这一类里的卡。
 */
export const GAUNTLET_BUILD = { extraChance: .35, keystoneMax: STAR_RULES.keystoneMax, charmSlots: 2, extraWeights: { star: .45, gear: .25, charm: .18, horse: .12 } } as const;

/** 卡归哪一类（三选一尽量三类各一）：本命 / 武艺、战法、将星、兵装（兵装 / 信物 / 坐骑）、其他新卡（锦囊、机缘、兵源……）。 */
export type GCategory = 'own' | 'tactic' | 'star' | 'gear' | 'other';
export const CATEGORY_NAME: Record<GCategory, string> = { own: '本命 · 武艺', tactic: '战法', star: '将星', gear: '兵装', other: '机缘' };
export function cardCategory(id: string): GCategory {
  if (/^(signature_weapon_|weapon_over_|martial_|branch_)/.test(id)) return 'own';
  if (id.startsWith('tactic_')) return 'tactic';
  if (id.startsWith('gauntlet_star_')) return 'star';
  if (id.startsWith('gauntlet_gear_') || id.startsWith('gauntlet_charm_') || id.startsWith('gauntlet_horse_')) return 'gear';
  return 'other';
}
/** 卡名里的等级（「七探盘龙枪 · Lv.4」→ 4）。 */
const lvOf = (name: string): number => { const m = /Lv\.(\d+)/.exec(name); return m ? +m[1] : 1; };
/**
 * 一张三选一卡的稀有度（gauntlet-build.md 第一节的表）：本命 Lv4–5 精良、专职 / 精进稀有（Lv7 传说）、武艺精熟 Lv4–5 稀有、
 * 战法 Lv3 精良 / 精研 Lv4–5 稀有、心法 / 兵源 / 名将来投 / 悬赏精良、赌局 / 宝物稀有、空城 / 连环 / 草船锦囊精良；本模式专有的卡自己带（extra）。
 */
export function cardRarity(o: { id: string; name: string; kind: string }, extra?: GRarity): GRarity {
  if (extra) return extra;
  const id = o.id, lv = lvOf(o.name);
  if (id.startsWith('signature_weapon_')) return lv >= 4 ? 'fine' : 'common';
  if (id.startsWith('weapon_over_')) return id.endsWith('7') ? 'legend' : 'rare';
  if (id.startsWith('branch_')) return 'rare';
  if (id.startsWith('martial_')) return lv >= 4 ? 'rare' : 'common';
  if (id.startsWith('tactic_')) return lv >= 4 ? 'rare' : lv === 3 ? 'fine' : 'common';
  if (/^jinnang_(kongcheng|lianhuan|caochuan)/.test(id)) return 'fine';
  if (/^(new_troops|new_general|new_manual|new_bounty|bounty_|manual_)/.test(id)) return 'fine';
  if (/^(new_gamble|gamble_)/.test(id) || o.kind === 'treasure' || o.kind === 'relic') return 'rare';
  return 'common';
}

// ———— 将星卡（统筹确认：星图开关关着也出；拿一颗点亮一颗，不走连线 / 点数）————
export type StarCardKind = 'perk' | 'named' | 'keystone';
export interface StarCard { star: string; kind: StarCardKind; rarity: GRarity; name: string; desc: string; attr?: AttributeId; tier?: number }
const NAMED: readonly string[] = STAR_NODES.filter(n => n.kind === 'notable' && !/\.(NC|NL1|NL2)$/.test(n.id)).map(n => n.id); // 12 颗带名字的要星（各区 NR1 / NR2 + 4 座桥）
const KEYSTONES: readonly string[] = STAR_NODES.filter(n => n.kind === 'keystone').map(n => n.id);
/** 卡池里所有的将星（24 要星 + 4 主星），测试 / 清单用。 */
export const STAR_CARD_IDS: readonly string[] = [...ATTRIBUTE_IDS.flatMap(a => [1, 2, 3].map(t => perkStarId(a, t))), ...NAMED, ...KEYSTONES];
/**
 * 现在能出的将星卡：
 * - 专精（各区 NC / NL1 / NL2 = 第 1 / 2 / 3 档）按档位顺序出：这一区还没有的最低一档（主属性靠加点已有的档跳过）；一档精良、二 / 三档稀有；
 * - 12 颗带名字的要星各一次，稀有；
 * - 主星每局最多 keystoneMax 颗，传说（代价写在说明里，照星图）。
 */
export function starCardPool(lit: readonly string[], perkActive: (attr: AttributeId, tier: number) => boolean): StarCard[] {
  const has = new Set(lit), out: StarCard[] = [], node = (id: string) => STAR_BY_ID.get(id)!;
  for (const a of ATTRIBUTE_IDS) {
    const t = [1, 2, 3].find(k => !perkActive(a, k)); if (!t) continue;
    const id = perkStarId(a, t); if (has.has(id)) continue;
    out.push({ star: id, kind: 'perk', rarity: t === 1 ? 'fine' : 'rare', name: node(id).name, desc: node(id).desc, attr: a, tier: t });
  }
  for (const id of NAMED) if (!has.has(id)) out.push({ star: id, kind: 'named', rarity: 'rare', name: node(id).name, desc: node(id).desc });
  const keys = lit.filter(id => KEYSTONES.includes(id)).length;
  if (keys < GAUNTLET_BUILD.keystoneMax) for (const id of KEYSTONES) if (!has.has(id)) out.push({ star: id, kind: 'keystone', rarity: 'legend', name: node(id).name, desc: node(id).desc });
  return out;
}
/** 从候选里按目标稀有度挑一张：没有这一档就往低一档找，再没有往高找。 */
export function pickByRarity<T extends { rarity: GRarity }>(cands: readonly T[], want: GRarity, rnd: () => number = Math.random): T | null {
  if (!cands.length) return null;
  const i0 = RARITY_ORDER.indexOf(want), order = [...RARITY_ORDER.slice(0, i0 + 1).reverse(), ...RARITY_ORDER.slice(i0 + 1)];
  for (const r of order) { const c = cands.filter(x => x.rarity === r); if (c.length) return c[Math.floor(rnd() * c.length)]; }
  return null;
}
