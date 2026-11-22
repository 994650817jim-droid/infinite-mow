import { PRIMARY_ATTRIBUTE, type AttributeId } from './attributes';
import { STAT_ORDER, statSource, type StatSource } from './heroStats';

/**
 * 星图（2026-11-21 用户批准 docs/STAR_MAP_DESIGN.md：用技能树取代四维加点）第一期：数据 + 纯函数，不依赖 Phaser / 存档。
 * 节点、坐标、连线由设计稿的 docs/star-map/nodes.json 转来（84 颗：4 入口、52 小星、24 要星、4 主星；四个区 + 四座桥）。
 *
 * 开关 starMapOn()：**默认开**（2026-11-22 用户：「我想正式打开可以应用上去游戏游玩」）——开发版、正式版、纯 node 都是开。
 * 关闭的口子只留给对照 / 测试，关着时游戏行为与接入星图之前完全一样（旧的四维加点）：
 * - 开发构建网址带 ?starMap=0，或页面加载前写 window.__starMap = false（正式构建里这两个都不生效，没有关闭入口）；
 * - 测试 / 模拟器 setStarMap(false) 强制关（setStarMap(null) 还给默认）。
 * 规则（设计稿第 2 节）：武将从主属性入口进图，自己的入口免费、自动点亮、不加属性；每升 1 级 1 颗星；只能点亮与已点亮的星相连的星；
 * 小星（含别人的入口、桥上的小星）= +1 点对应属性，结算仍走 heroStats 的等效点与分段折扣；主星要求本区已点亮 ≥ keystoneNeed、每人最多 keystoneMax 颗。
 */
export const STAR_MAP_DEFAULT = true;
let forced: boolean | null = null;
/** 只有开发构建认网址 / window 上的关闭口子；正式构建和纯 node（没有 import.meta.env）恒为 false = 用默认。 */
const devOff: boolean = (() => {
  if (!import.meta.env?.DEV) return false;
  try { return (window as unknown as { __starMap?: boolean }).__starMap === false || new URLSearchParams(window.location.search).get('starMap') === '0'; } catch { return false; }
})();
export function starMapOn(): boolean { return forced ?? (devOff ? false : STAR_MAP_DEFAULT); }
/** 测试 / 模拟器用：true / false 强制开关，null = 还给默认。 */
export function setStarMap(on: boolean | null): void { forced = on; }

export type StarKind = 'gate' | 'small' | 'notable' | 'keystone';
export type StarRegion = AttributeId | 'bridge';
export interface StarNode {
  id: string; region: StarRegion; kind: StarKind; x: number; y: number; name: string; desc: string;
  /** 入口 / 小星加的属性（要星、主星没有）。 */
  attr?: AttributeId;
  /** 桥上的跨系要星：连接的两个区。 */
  between?: readonly [AttributeId, AttributeId];
  /** 已有的 12 个主属性专精（attributes.PRIMARY_PERK）：哪一维的第几档（1–3）。 */
  perk?: { attr: AttributeId; tier: number };
  /** 效果未实现的标记。第三期起 28 颗有名字的星都已接上效果（STAR_EFFECT / STAR_KEYSTONE），现在恒为 false；留着给以后新加的星用。 */
  todo: boolean;
  links: readonly string[];
}
export const STAR_RULES = { keystoneNeed: 10, keystoneMax: 2 } as const;
/** 星图开着时才用的数值（平衡评审 hero-balance-review.md 第 30 节采纳的两处；关着时用 PRIMARY_PERK 的原值）。 */
export const STAR_TUNING = {
  /** 破阵：重击倍率 ×2 → ×1.6；定身每秒最多一次。 */
  crushMul: 1.6, crushStunCdMs: 1000,
  /** 闪避合计封顶（游刃 10% + 第三期一骑当千 10%）。 */
  dodgeCap: .2,
} as const;
/**
 * 第二期：12 颗新要星的效果数值（设计稿第 4 节的表，初值，归平衡会话）。键 = 节点编号；结算在 systems/RunGrowth.ts（starOn / STAR_EFFECT）。
 * STAR_NEAR_RADIUS =「主将身边」的半径（号令、身先士卒）。
 */
export const STAR_NEAR_RADIUS = 220;
export const STAR_EFFECT = {
  /** 铁骨：生命上限 +8%，受到的伤害 −5%。 */
  'strength.NR1': { hp: .08, taken: .05 },
  /** 背水：生命低于 40% 时伤害 +15%。 */
  'strength.NR2': { below: .4, damage: .15 },
  /** 连击：暴击伤害 +20%。 */
  'agility.NR1': { critDamage: .2 },
  /** 追风：移动中攻速 +8%，拾取范围 +20%。 */
  'agility.NR2': { moveHaste: .08, pickup: .2 },
  /** 余烬：灼烧、地火等持续伤害 +20%，持续时间 +1 秒。 */
  'intellect.NR1': { dot: .2, extraMs: 1000 },
  /** 妙算：锦囊效果 +15%。 */
  'intellect.NR2': { jinnang: .15 },
  /** 严阵：部曲生命 +15%，部曲受首领伤害 −15%。 */
  'command.NR1': { allyHp: .15, bossTaken: .15 },
  /** 号令：主将身边的部曲伤害 +12%（进部曲伤害加法桶）。 */
  'command.NR2': { nearAllyDamage: .12 },
  /** 骁锐：武器伤害 +6%，攻速 +6%。 */
  'bridge0.h': { weapon: .06, attackSpeed: .06 },
  /** 奇谋：暴击后 3 秒内法术伤害 +12%。 */
  'bridge1.h': { ms: 3000, spell: .12 },
  /** 帷幄：每 1 点智力生效点，部曲伤害 +0.8%（进部曲伤害加法桶）。 */
  'bridge2.h': { allyDamagePerInt: .008 },
  /** 身先士卒：主将身边的部曲受伤 −10%，主将生命上限 +6%。 */
  'bridge3.h': { nearAllyTaken: .1, hp: .06 },
} as const;
export type StarEffectId = keyof typeof STAR_EFFECT;
/**
 * 第三期：4 颗主星（设计稿第 4 节，已含平衡评审的修订；初值，归平衡会话）。结算在 systems/RunGrowth.ts（keyOn），爆燃在 GameScene.starPyre。
 * 万人敌的部曲伤害 −30% 与三军统帅的 +30% 都进部曲伤害加法桶，同时点正好抵消（设计稿「方向相反，互相抵消，是有意的」）。
 */
export const STAR_KEYSTONE = {
  /** 万人敌：主将全伤害 +15%，对首领再 +5%；部曲伤害 −30%。 */
  'strength.K': { damage: .15, boss: .05, allyDamage: -.3 },
  /** 一骑当千：暴击 +10%，闪避 +10%（合计封顶 STAR_TUNING.dodgeCap）；生命上限 −20%（最终生命上限 ×0.8）。 */
  'agility.K': { crit: .1, dodge: .1, maxHp: -.2 },
  /** 火烧连营：法术击杀爆燃（STAR_PYRE）；法术武器冷却 +15%。 */
  'intellect.K': { cooldown: .15 },
  /** 三军统帅：部曲伤害 +30%（进加法桶）、部曲生命 +20%、免费招兵再多 1 人；主将自身伤害 −25%。 */
  'command.K': { allyDamage: .3, allyHp: .2, freeRecruit: 1, selfDamage: -.25 },
} as const;
export type StarKeystoneId = keyof typeof STAR_KEYSTONE;
/**
 * 火烧连营的爆燃：被主将法术伤害（非武器伤害，或法术武器的武器命中）打死的敌人，在原地对 radius 内的其他敌人造成一次伤害。
 * - 伤害基准 = 本关此刻新刷出来的一名 basis 兵种（刀兵）的生命上限 × ratio，与死的是谁无关（精锐、副将倒下不会炸得更狠）；
 * - 爆燃打死的敌人不再爆燃；任意 1 秒内最多 perSecond 次，超出的不炸；
 * - 画面是手绘贴地火环（data/starFx.ts huoshao），大小在那张表里。
 */
export const STAR_PYRE = { radius: 90, ratio: .1, perSecond: 6, windowMs: 1000, basis: 'infantry' } as const;
export const STAR_REGIONS: Record<AttributeId, { name: string; color: number }> = {
  strength: { name: '力量', color: 0xc8553d }, agility: { name: '敏捷', color: 0x4fa38f }, intellect: { name: '智力', color: 0x8f7fd0 }, command: { name: '统御', color: 0xd39a3a },
};
/** 三档专精在各区的位置：第 1 档 = NC（最少 4 星），第 2 档 = NL1（5 星），第 3 档 = NL2（7 星）。 */
export const PERK_SLOTS: readonly string[] = ['NC', 'NL1', 'NL2'];
export function perkStarId(attr: AttributeId, tier: number): string { return attr + '.' + PERK_SLOTS[tier - 1]; }

type Row = readonly [id: string, region: StarRegion, kind: StarKind, x: number, y: number, name?: string, desc?: string, between?: readonly [AttributeId, AttributeId]];
const ROWS: readonly Row[] = [
  ['strength.G', 'strength', 'gate', 737, 387],
  ['strength.T1', 'strength', 'small', 701, 351],
  ['strength.T2', 'strength', 'small', 665, 315],
  ['strength.L1', 'strength', 'small', 602, 331],
  ['strength.L2', 'strength', 'small', 539, 323],
  ['strength.NL1', 'strength', 'notable', 483, 300, '破阵', '每 5 次武器命中一次重击：伤害 ×1.6，定身 0.5 秒（定身每秒最多一次）'],
  ['strength.L3', 'strength', 'small', 452, 252],
  ['strength.NL2', 'strength', 'notable', 440, 193, '斩将', '对精英、首领伤害 +10%'],
  ['strength.R1', 'strength', 'small', 681, 252],
  ['strength.R2', 'strength', 'small', 673, 189],
  ['strength.NR1', 'strength', 'notable', 650, 133, '铁骨', '生命上限 +8%，受到的伤害 −5%'],
  ['strength.R3', 'strength', 'small', 602, 102],
  ['strength.NR2', 'strength', 'notable', 543, 90, '背水', '生命低于 40% 时伤害 +15%'],
  ['strength.C1', 'strength', 'small', 626, 276],
  ['strength.NC', 'strength', 'notable', 586, 236, '千钧', '武器命中把小兵推开'],
  ['strength.C2', 'strength', 'small', 547, 197],
  ['strength.C3', 'strength', 'small', 499, 149],
  ['strength.K', 'strength', 'keystone', 444, 94, '万人敌', '主将全伤害 +15%，对首领再 +5%；部曲伤害 −30%'],
  ['agility.G', 'agility', 'gate', 863, 387],
  ['agility.T1', 'agility', 'small', 899, 351],
  ['agility.T2', 'agility', 'small', 935, 315],
  ['agility.L1', 'agility', 'small', 919, 252],
  ['agility.L2', 'agility', 'small', 927, 189],
  ['agility.NL1', 'agility', 'notable', 950, 133, '游刃', '暴击 +5%，10% 几率闪避伤害'],
  ['agility.L3', 'agility', 'small', 998, 102],
  ['agility.NL2', 'agility', 'notable', 1057, 90, '疾影', '暴击后 2 秒内攻速 +10%'],
  ['agility.R1', 'agility', 'small', 998, 331],
  ['agility.R2', 'agility', 'small', 1061, 323],
  ['agility.NR1', 'agility', 'notable', 1117, 300, '连击', '暴击伤害 +20%'],
  ['agility.R3', 'agility', 'small', 1148, 252],
  ['agility.NR2', 'agility', 'notable', 1160, 193, '追风', '移动中攻速 +8%，拾取范围 +20%'],
  ['agility.C1', 'agility', 'small', 974, 276],
  ['agility.NC', 'agility', 'notable', 1014, 236, '轻骑', '移速 +8%'],
  ['agility.C2', 'agility', 'small', 1053, 197],
  ['agility.C3', 'agility', 'small', 1101, 149],
  ['agility.K', 'agility', 'keystone', 1156, 94, '一骑当千', '暴击 +10%，闪避 +10%（闪避合计最多 20%）；生命上限 −20%'],
  ['intellect.G', 'intellect', 'gate', 863, 513],
  ['intellect.T1', 'intellect', 'small', 899, 549],
  ['intellect.T2', 'intellect', 'small', 935, 585],
  ['intellect.L1', 'intellect', 'small', 998, 569],
  ['intellect.L2', 'intellect', 'small', 1061, 577],
  ['intellect.NL1', 'intellect', 'notable', 1117, 600, '连珠', '法术伤害 15% 几率翻倍'],
  ['intellect.L3', 'intellect', 'small', 1148, 648],
  ['intellect.NL2', 'intellect', 'notable', 1160, 707, '广域', '范围再 +6%'],
  ['intellect.R1', 'intellect', 'small', 919, 648],
  ['intellect.R2', 'intellect', 'small', 927, 711],
  ['intellect.NR1', 'intellect', 'notable', 950, 767, '余烬', '灼烧、地火等持续伤害 +20%，持续时间 +1 秒'],
  ['intellect.R3', 'intellect', 'small', 998, 798],
  ['intellect.NR2', 'intellect', 'notable', 1057, 810, '妙算', '锦囊效果 +15%'],
  ['intellect.C1', 'intellect', 'small', 974, 624],
  ['intellect.NC', 'intellect', 'notable', 1014, 664, '凝神', '法术武器冷却 −10%'],
  ['intellect.C2', 'intellect', 'small', 1053, 703],
  ['intellect.C3', 'intellect', 'small', 1101, 751],
  ['intellect.K', 'intellect', 'keystone', 1156, 806, '火烧连营', '被法术击杀的敌人爆燃，对周围造成小兵生命上限 10% 的伤害（爆燃不再引发爆燃，每秒最多 6 次）；法术武器冷却 +15%'],
  ['command.G', 'command', 'gate', 737, 513],
  ['command.T1', 'command', 'small', 701, 549],
  ['command.T2', 'command', 'small', 665, 585],
  ['command.L1', 'command', 'small', 681, 648],
  ['command.L2', 'command', 'small', 673, 711],
  ['command.NL1', 'command', 'notable', 650, 767, '募众', '每次免费招兵多 1 人'],
  ['command.L3', 'command', 'small', 602, 798],
  ['command.NL2', 'command', 'notable', 543, 810, '同袍', '随行救起快 20%，救起带 55% 生命'],
  ['command.R1', 'command', 'small', 602, 569],
  ['command.R2', 'command', 'small', 539, 577],
  ['command.NR1', 'command', 'notable', 483, 600, '严阵', '部曲生命 +15%，部曲受首领伤害 −15%'],
  ['command.R3', 'command', 'small', 452, 648],
  ['command.NR2', 'command', 'notable', 440, 707, '号令', '主将身边的部曲伤害 +12%'],
  ['command.C1', 'command', 'small', 626, 624],
  ['command.NC', 'command', 'notable', 586, 664, '励军', '部曲伤害 +15%'],
  ['command.C2', 'command', 'small', 547, 703],
  ['command.C3', 'command', 'small', 499, 751],
  ['command.K', 'command', 'keystone', 444, 806, '三军统帅', '部曲伤害 +30%、生命 +20%，免费招兵再多 1 人；主将自身伤害 −25%'],
  ['bridge0.a', 'strength', 'small', 737, 189],
  ['bridge0.h', 'bridge', 'notable', 800, 189, '骁锐', '武器伤害 +6%，攻速 +6%', ['strength', 'agility']],
  ['bridge0.b', 'agility', 'small', 864, 189],
  ['bridge1.a', 'agility', 'small', 1061, 387],
  ['bridge1.h', 'bridge', 'notable', 1061, 450, '奇谋', '暴击后 3 秒内法术伤害 +12%', ['agility', 'intellect']],
  ['bridge1.b', 'intellect', 'small', 1061, 514],
  ['bridge2.a', 'intellect', 'small', 864, 711],
  ['bridge2.h', 'bridge', 'notable', 800, 711, '帷幄', '每 1 点智力生效点，部曲伤害 +0.8%', ['intellect', 'command']],
  ['bridge2.b', 'command', 'small', 737, 711],
  ['bridge3.a', 'command', 'small', 539, 514],
  ['bridge3.h', 'bridge', 'notable', 539, 450, '身先士卒', '主将身边的部曲受伤 −10%，主将生命上限 +6%', ['command', 'strength']],
  ['bridge3.b', 'strength', 'small', 539, 387],
];
const EDGES: ReadonlyArray<readonly [string, string]> = [
  ['strength.G', 'strength.T1'], ['strength.T1', 'strength.T2'], ['strength.T2', 'strength.L1'], ['strength.T2', 'strength.R1'], ['strength.T2', 'strength.C1'],
  ['strength.L1', 'strength.L2'], ['strength.L2', 'strength.NL1'], ['strength.NL1', 'strength.L3'], ['strength.L3', 'strength.NL2'], ['strength.R1', 'strength.R2'],
  ['strength.R2', 'strength.NR1'], ['strength.NR1', 'strength.R3'], ['strength.R3', 'strength.NR2'], ['strength.C1', 'strength.NC'], ['strength.NC', 'strength.C2'],
  ['strength.C2', 'strength.C3'], ['strength.C3', 'strength.K'], ['strength.NL2', 'strength.C3'], ['strength.NR2', 'strength.C3'], ['agility.G', 'agility.T1'],
  ['agility.T1', 'agility.T2'], ['agility.T2', 'agility.L1'], ['agility.T2', 'agility.R1'], ['agility.T2', 'agility.C1'], ['agility.L1', 'agility.L2'], ['agility.L2', 'agility.NL1'],
  ['agility.NL1', 'agility.L3'], ['agility.L3', 'agility.NL2'], ['agility.R1', 'agility.R2'], ['agility.R2', 'agility.NR1'], ['agility.NR1', 'agility.R3'],
  ['agility.R3', 'agility.NR2'], ['agility.C1', 'agility.NC'], ['agility.NC', 'agility.C2'], ['agility.C2', 'agility.C3'], ['agility.C3', 'agility.K'], ['agility.NL2', 'agility.C3'],
  ['agility.NR2', 'agility.C3'], ['intellect.G', 'intellect.T1'], ['intellect.T1', 'intellect.T2'], ['intellect.T2', 'intellect.L1'], ['intellect.T2', 'intellect.R1'],
  ['intellect.T2', 'intellect.C1'], ['intellect.L1', 'intellect.L2'], ['intellect.L2', 'intellect.NL1'], ['intellect.NL1', 'intellect.L3'], ['intellect.L3', 'intellect.NL2'],
  ['intellect.R1', 'intellect.R2'], ['intellect.R2', 'intellect.NR1'], ['intellect.NR1', 'intellect.R3'], ['intellect.R3', 'intellect.NR2'], ['intellect.C1', 'intellect.NC'],
  ['intellect.NC', 'intellect.C2'], ['intellect.C2', 'intellect.C3'], ['intellect.C3', 'intellect.K'], ['intellect.NL2', 'intellect.C3'], ['intellect.NR2', 'intellect.C3'],
  ['command.G', 'command.T1'], ['command.T1', 'command.T2'], ['command.T2', 'command.L1'], ['command.T2', 'command.R1'], ['command.T2', 'command.C1'], ['command.L1', 'command.L2'],
  ['command.L2', 'command.NL1'], ['command.NL1', 'command.L3'], ['command.L3', 'command.NL2'], ['command.R1', 'command.R2'], ['command.R2', 'command.NR1'],
  ['command.NR1', 'command.R3'], ['command.R3', 'command.NR2'], ['command.C1', 'command.NC'], ['command.NC', 'command.C2'], ['command.C2', 'command.C3'],
  ['command.C3', 'command.K'], ['command.NL2', 'command.C3'], ['command.NR2', 'command.C3'], ['strength.R2', 'bridge0.a'], ['bridge0.a', 'bridge0.h'], ['bridge0.h', 'bridge0.b'],
  ['bridge0.b', 'agility.L2'], ['strength.G', 'agility.G'], ['agility.R2', 'bridge1.a'], ['bridge1.a', 'bridge1.h'], ['bridge1.h', 'bridge1.b'], ['bridge1.b', 'intellect.L2'],
  ['agility.G', 'intellect.G'], ['intellect.R2', 'bridge2.a'], ['bridge2.a', 'bridge2.h'], ['bridge2.h', 'bridge2.b'], ['bridge2.b', 'command.L2'], ['intellect.G', 'command.G'],
  ['command.R2', 'bridge3.a'], ['bridge3.a', 'bridge3.h'], ['bridge3.h', 'bridge3.b'], ['bridge3.b', 'strength.L2'], ['command.G', 'strength.G'],
];
export const STAR_EDGES = EDGES;
export const STAR_NODES: readonly StarNode[] = ROWS.map(([id, region, kind, x, y, name, desc, between]) => {
  const named = kind === 'notable' || kind === 'keystone', attr = named ? undefined : (region as AttributeId), slot = id.split('.')[1];
  const tier = kind === 'notable' && region !== 'bridge' ? PERK_SLOTS.indexOf(slot) + 1 : 0, perk = tier > 0 ? { attr: region as AttributeId, tier } : undefined;
  const links = EDGES.filter(e => e[0] === id || e[1] === id).map(e => (e[0] === id ? e[1] : e[0]));
  return {
    id, region, kind, x, y, attr, between, perk, links, todo: false,
    name: name ?? STAR_REGIONS[attr!].name + ' +1', desc: desc ?? `+1 ${STAR_REGIONS[attr!].name}点（与现在加 1 点相同）`,
  };
});
export const STAR_BY_ID: ReadonlyMap<string, StarNode> = new Map(STAR_NODES.map(n => [n.id, n]));
export function starNode(id: string): StarNode | undefined { return STAR_BY_ID.get(id); }
/** 相邻的星。 */
export function starNeighbors(id: string): readonly string[] { return STAR_BY_ID.get(id)?.links ?? []; }
export function gateOf(attr: AttributeId): string { return attr + '.G'; }

/** 武将从哪个属性的入口进图：有主属性的按主属性（attributes.PRIMARY_ATTRIBUTE），招募武将按本色最高的一维（并列取 力 / 敏 / 智 / 统 靠前的）。 */
export function heroEntryAttr(hero: string, src: StatSource = statSource(hero)): AttributeId {
  const p = (PRIMARY_ATTRIBUTE as Record<string, AttributeId>)[hero]; if (p) return p;
  let best = 0; for (let i = 1; i < 4; i++) if (src.base[i] > src.base[best]) best = i;
  return STAT_ORDER[best];
}
export function heroGate(hero: string, src?: StatSource): string { return gateOf(heroEntryAttr(hero, src)); }

/** 已点亮集合（总是含自己的入口；不认识的编号丢掉）。 */
export function litSet(lit: Iterable<string>, gate: string): Set<string> { const s = new Set<string>([gate]); for (const id of lit) if (STAR_BY_ID.has(id)) s.add(id); return s; }
/** 某个区已点亮几颗（自己的入口也算；桥上的小星算所属的区，跨系要星不算任何区）。 */
export function regionLit(lit: Iterable<string>, region: StarRegion, gate: string): number { let n = 0; for (const id of litSet(lit, gate)) if (STAR_BY_ID.get(id)!.region === region) n++; return n; }
export function keystonesLit(lit: Iterable<string>): number { let n = 0; for (const id of new Set(lit)) if (STAR_BY_ID.get(id)?.kind === 'keystone') n++; return n; }
/** 为什么不能点亮（null = 可以）：不存在 / 已点亮 / 不相连 / 主星门槛 / 主星已满。不管有没有星可花（那是存档层的事）。 */
export function lightBlock(lit: Iterable<string>, id: string, gate: string): string | null {
  const node = STAR_BY_ID.get(id), s = litSet(lit, gate);
  if (!node) return '没有这颗星';
  if (s.has(id)) return '已点亮';
  if (!node.links.some(l => s.has(l))) return '要先点亮相连的星';
  if (node.kind === 'keystone') {
    const have = regionLit(s, node.region, gate);
    if (have < STAR_RULES.keystoneNeed) return `主星要求本区先点亮 ${STAR_RULES.keystoneNeed} 颗（现在 ${have}）`;
    if (keystonesLit(s) >= STAR_RULES.keystoneMax) return `每位武将最多同时点亮 ${STAR_RULES.keystoneMax} 颗主星`;
  }
  return null;
}
export function canLight(lit: Iterable<string>, id: string, gate: string): boolean { return lightBlock(lit, id, gate) === null; }
/** 花掉的星数（自己的入口免费，不算）。 */
export function starsSpent(lit: Iterable<string>, gate: string): number { return litSet(lit, gate).size - 1; }
/** 某等级累计得到的星：每升 1 级 1 颗，全程不减速。 */
export function starsAt(level: number): number { return Math.max(0, Math.floor(level) - 1); }
/** 从已点亮的星汇总四维点数：小星、桥上小星、别人的入口各 +1；自己的入口不加。 */
export function starPoints(lit: Iterable<string>, gate: string): Record<AttributeId, number> {
  const out: Record<AttributeId, number> = { strength: 0, agility: 0, intellect: 0, command: 0 };
  for (const id of litSet(lit, gate)) { const n = STAR_BY_ID.get(id)!; if (n.attr && id !== gate) out[n.attr]++; }
  return out;
}
/** 某一档旧专精的要星是否点亮（任何武将都可以跨区拿）。 */
export function perkLit(lit: Iterable<string>, attr: AttributeId, tier: number): boolean { const id = perkStarId(attr, tier); for (const x of lit) if (x === id) return true; return false; }
/**
 * 把一组星整理成「按规则能依次点亮」的顺序（读档、setHeroStars、预设都走这里）：从入口出发反复点亮能点的，
 * 点不到的（不相连、主星不够门槛或超过 2 颗、不认识的编号）丢掉。尽量保持传入的先后；返回值不含自己的入口。
 */
export function orderStars(ids: Iterable<string>, gate: string): string[] {
  const want = [...new Set(ids)].filter(id => id !== gate && STAR_BY_ID.has(id)), out: string[] = [], lit = new Set<string>([gate]);
  for (let moved = true; moved;) {
    moved = false;
    for (const id of want) if (!lit.has(id) && canLight(lit, id, gate)) { lit.add(id); out.push(id); moved = true; }
  }
  return out;
}
/** 从已点亮集合到某颗星最少还要花几颗星（含这颗星本身；只算连通，不算主星门槛）。已点亮返回 0。 */
export function starCost(lit: Iterable<string>, target: string, gate: string): number {
  const s = litSet(lit, gate); if (s.has(target)) return 0; if (!STAR_BY_ID.has(target)) return Infinity;
  const dist = new Map<string, number>([[target, 1]]), q = [target];
  while (q.length) { const c = q.shift()!, d = dist.get(c)!; for (const n of starNeighbors(c)) { if (s.has(n)) return d; if (!dist.has(n)) { dist.set(n, d + 1); q.push(n); } } }
  return Infinity;
}

/**
 * 设计稿第 5 节的三套示例走法（平衡会话对照用）：按最短路把想要的要星 / 主星依次连起来，第 69 颗起就近把剩下的花掉。
 * order 是点亮顺序（不含自己的入口，各 81 颗 = 全图 83 颗减去点不了的另外 2 颗主星）；presetStars(key, n) 取前 n 颗。
 * 前 9 / 25 / 53 / 69 颗的小星数与要星清单和设计稿的表一致（tools/test-star-map.mjs 校验）。
 */
export const STAR_PRESETS = {
  guanyu: { hero: 'guanyu', name: '关羽 · 单骑斩将', order: ['strength.T1', 'strength.T2', 'strength.C1', 'strength.NC', 'strength.L1', 'strength.L2', 'strength.NL1', 'strength.R1', 'strength.R2', 'strength.NR1', 'strength.L3', 'strength.NL2', 'strength.C3', 'strength.K', 'strength.NR2', 'bridge0.a', 'bridge0.h', 'bridge0.b', 'agility.L2', 'agility.NL1', 'agility.L1', 'agility.T2', 'agility.C1', 'agility.NC', 'agility.R1', 'agility.R2', 'agility.NR1', 'agility.L3', 'agility.NL2', 'bridge3.b', 'bridge3.h', 'bridge3.a', 'command.R2', 'command.NR1', 'agility.R3', 'agility.NR2', 'agility.C3', 'agility.K', 'command.R1', 'command.T2', 'command.C1', 'command.NC', 'command.L1', 'command.L2', 'command.NL1', 'command.R3', 'command.NR2', 'bridge1.a', 'bridge1.h', 'agility.G', 'intellect.G', 'intellect.T1', 'intellect.T2', 'intellect.C1', 'intellect.NC', 'command.L3', 'command.NL2', 'intellect.L1', 'intellect.L2', 'intellect.NL1', 'intellect.L3', 'intellect.NL2', 'intellect.C3', 'intellect.NR2', 'intellect.R3', 'intellect.NR1', 'bridge2.b', 'bridge2.h', 'strength.R3', 'strength.C2', 'agility.T1', 'agility.C2', 'intellect.R1', 'intellect.R2', 'intellect.C2', 'command.G', 'command.T1', 'command.C2', 'command.C3', 'bridge1.b', 'bridge2.a'] },
  zhuge: { hero: 'zhuge', name: '诸葛亮 · 火攻军师', order: ['intellect.T1', 'intellect.T2', 'intellect.C1', 'intellect.NC', 'intellect.L1', 'intellect.L2', 'intellect.NL1', 'intellect.R1', 'intellect.R2', 'intellect.NR1', 'intellect.C2', 'intellect.C3', 'intellect.K', 'intellect.NL2', 'bridge2.a', 'bridge2.h', 'command.G', 'command.T1', 'command.T2', 'command.C1', 'command.NC', 'command.R1', 'command.R2', 'command.NR1', 'intellect.NR2', 'command.L1', 'command.L2', 'command.NL1', 'command.R3', 'command.NR2', 'command.L3', 'command.NL2', 'command.C3', 'command.K', 'bridge1.b', 'bridge1.h', 'agility.G', 'agility.T1', 'agility.T2', 'agility.C1', 'agility.NC', 'agility.L1', 'agility.L2', 'agility.NL1', 'agility.R1', 'agility.R2', 'agility.NR1', 'bridge0.b', 'bridge0.h', 'strength.G', 'strength.T1', 'strength.T2', 'strength.C1', 'strength.NC', 'strength.L1', 'strength.L2', 'strength.NL1', 'agility.L3', 'agility.NL2', 'strength.R1', 'strength.R2', 'strength.NR1', 'strength.L3', 'strength.NL2', 'strength.R3', 'strength.NR2', 'agility.R3', 'agility.NR2', 'command.C2', 'strength.C2', 'strength.C3', 'agility.C2', 'agility.C3', 'intellect.L3', 'intellect.R3', 'bridge0.a', 'bridge1.a', 'bridge2.b', 'bridge3.a', 'bridge3.h', 'bridge3.b'] },
  liubei: { hero: 'liubei', name: '刘备 · 三军统帅', order: ['command.T1', 'command.T2', 'command.C1', 'command.NC', 'command.L1', 'command.L2', 'command.NL1', 'command.R1', 'command.R2', 'command.NR1', 'command.L3', 'command.NL2', 'command.C3', 'command.K', 'command.NR2', 'bridge3.a', 'bridge3.h', 'bridge2.b', 'bridge2.h', 'strength.G', 'strength.T1', 'strength.T2', 'strength.R1', 'strength.R2', 'strength.NR1', 'intellect.G', 'intellect.T1', 'intellect.T2', 'intellect.C1', 'intellect.NC', 'strength.C1', 'strength.NC', 'intellect.C2', 'intellect.C3', 'intellect.NR2', 'strength.L1', 'strength.L2', 'strength.NL1', 'intellect.L1', 'intellect.L2', 'intellect.NL1', 'strength.L3', 'strength.NL2', 'strength.R3', 'strength.NR2', 'strength.C3', 'strength.K', 'intellect.R3', 'intellect.NR1', 'intellect.NL2', 'bridge0.a', 'bridge0.h', 'agility.G', 'agility.T1', 'agility.T2', 'agility.C1', 'agility.NC', 'agility.L1', 'agility.L2', 'agility.NL1', 'agility.L3', 'agility.NL2', 'agility.C3', 'agility.NR2', 'agility.R3', 'agility.NR1', 'bridge1.b', 'bridge1.h', 'strength.C2', 'agility.R1', 'agility.R2', 'agility.C2', 'intellect.L3', 'intellect.R1', 'intellect.R2', 'command.R3', 'command.C2', 'bridge0.b', 'bridge1.a', 'bridge2.a', 'bridge3.b'] },
} as const satisfies Record<string, { hero: string; name: string; order: readonly string[] }>;
export type StarPresetId = keyof typeof STAR_PRESETS;
/** 预设走法的前 n 颗星（n 省略 = 全部）；按等级取用 presetStars(key, starsAt(level))。 */
export function presetStars(key: StarPresetId, n = Infinity): string[] { const o = STAR_PRESETS[key].order; return o.slice(0, Math.max(0, Math.min(o.length, Math.floor(n)))); }
