import type { EnemyKind } from '../types';

/**
 * 各章小怪兵种（共享笔记 enemy-roster-design.md，用户 2026-11-19 批准；美术风格会话出图、content 写代码）。
 * 做法：底层仍是 6 种 EnemyKind（步 / 盾 / 弓 / 骑 / 精英 / 首领），新兵种 = 某个底层兵种 + 数值倍率 + 一种机制（trait），
 * 刷怪时按关卡配置（STAGE_ROSTER）按比例混进普通刷怪；机制由 systems/EnemyTraits 每帧驱动。
 * 第一批：第 1 章（流民 / 符水道徒 / 黄巾力士）、第 2 章（羌胡弓骑 / 关守滚石兵 / 纵火兵）、第 11 章（蛮族投石手 / 毒箭蛮 / 驯兽兵）。
 * 只在普通难度出现（噩梦难度的机制强化以后再做）。数值都是初值，交平衡会话。
 */

/** 机制库（设计第二节 M1–M12 里第一批用到的几种 + 弓骑 / 兽群）。 */
export type TraitDef =
  /** M1 蜂拥：一批 group 个一起刷，血少、跑得快 */
  | { kind: 'swarm' }
  /** M2 重装：慢、血厚、不吃击退；贴近后预警砸地，范围伤害 + 击退部曲 */
  | { kind: 'heavy'; slamRange: number; slamRadius: number; warnMs: number; everyMs: number; damage: number; allyDamage: number }
  /** M4 治疗：躲在友军身后，每 everyMs 给半径内友军回 share 最大生命（首领不回） */
  | { kind: 'healer'; radius: number; share: number; everyMs: number; keepAway: number }
  /** M5 投掷：站在 range 外，每 everyMs 往主将脚下抛一块，落点圈预警 warnMs，范围伤害 */
  | { kind: 'lobber'; range: number; everyMs: number; warnMs: number; radius: number; damage: number; allyDamage: number; flightMs: number }
  /** M6 纵火：冲向主将，一路留下燃烧地面；死时爆燃 */
  | { kind: 'torch'; dropEveryMs: number; fireMs: number; fireRadius: number; fireDamage: number; burstRadius: number; burstDamage: number }
  /** M11 毒：吹箭，中毒每秒掉 dps、持续 seconds 秒，可叠 maxStacks 层 */
  | { kind: 'poison'; range: number; everyMs: number; dps: number; seconds: number; maxStacks: number; hitDamage: number }
  /** 弓骑：绕主将 orbit 距离转圈边跑边射，不近身 */
  | { kind: 'horsearcher'; orbit: number; everyMs: number; arrowSpeed: number }
  /** 驯兽：驯兽师带 beasts 只猛兽（beast 兵种）一起来；驯兽师倒下后猛兽狂暴（加速） */
  | { kind: 'tamer'; beast: string; beasts: number; enrage: number };

export type TraitKind = TraitDef['kind'];

export interface RosterType {
  id: string; name: string;
  /** 底层兵种（决定基础行为、受击、掉落、刷怪池里算哪类）。 */
  base: EnemyKind;
  /** 相对当章同类基线的倍数：血 / 速度 / 伤害。 */
  mul: { hp: number; speed: number; damage: number };
  trait: TraitDef;
  /** 专属图（美术风格会话出图后接上；键不存在就退回底层兵种图 + fallback）。 */
  art: { walk: string; attack?: string; scale: number; groundY: number };
  /** 没有专属图时：底层兵种图染色 + 缩放。 */
  fallback: { tint: number; scale: number };
  /** 一次刷几个（蜂拥 / 兽群）。 */
  group?: readonly [number, number];
  /** 场上同时最多几个（治疗 ≤4、重装 ≤4、投掷 ≤6）。 */
  cap: number;
  /** 底层是骑兵但不要冲锋（弓骑自己绕圈）。 */
  noCharge?: boolean;
}

const A = (id: string, scale = .9, groundY = .875) => ({ walk: `enemy_${id}_walk`, attack: `enemy_${id}_attack`, scale, groundY });

export const ROSTER: Record<string, RosterType> = {
  // —— 第 1 章 黄巾 ——
  liumin: { id: 'liumin', name: '流民', base: 'infantry', mul: { hp: .35, speed: 1.15, damage: .5 }, trait: { kind: 'swarm' }, art: A('liumin', .8), fallback: { tint: 0xb8a888, scale: .8 }, group: [6, 8], cap: 32 },
  fushui: { id: 'fushui', name: '符水道徒', base: 'infantry', mul: { hp: 1.2, speed: .7, damage: .4 }, trait: { kind: 'healer', radius: 200, share: .03, everyMs: 1000, keepAway: 280 }, art: A('fushui'), fallback: { tint: 0xf0e2a0, scale: 1 }, cap: 4 },
  lishi: { id: 'lishi', name: '黄巾力士', base: 'shield', mul: { hp: 7, speed: .55, damage: 2.2 }, trait: { kind: 'heavy', slamRange: 120, slamRadius: 130, warnMs: 800, everyMs: 3200, damage: 14, allyDamage: 18 }, art: A('lishi', 1.25), fallback: { tint: 0xd89060, scale: 1.4 }, cap: 4 },
  // —— 第 2 章 西凉 ——
  qianghu: { id: 'qianghu', name: '羌胡弓骑', base: 'cavalry', mul: { hp: 1.2, speed: 1.3, damage: .8 }, trait: { kind: 'horsearcher', orbit: 300, everyMs: 2200, arrowSpeed: 230 }, art: A('qianghu', 1), fallback: { tint: 0xc8a070, scale: 1 }, cap: 6, noCharge: true },
  gunshi: { id: 'gunshi', name: '关守滚石兵', base: 'shield', mul: { hp: 1.5, speed: .5, damage: 1.6 }, trait: { kind: 'lobber', range: 420, everyMs: 4000, warnMs: 1000, radius: 80, damage: 12, allyDamage: 16, flightMs: 900 }, art: A('gunshi'), fallback: { tint: 0x9a9890, scale: 1 }, cap: 6 },
  zonghuo: { id: 'zonghuo', name: '纵火兵', base: 'infantry', mul: { hp: .8, speed: 1.25, damage: .7 }, trait: { kind: 'torch', dropEveryMs: 550, fireMs: 2000, fireRadius: 42, fireDamage: 4, burstRadius: 100, burstDamage: 14 }, art: A('zonghuo'), fallback: { tint: 0x8a5a40, scale: 1 }, cap: 8 },
  // —— 第 11 章 南中 ——
  mantoushi: { id: 'mantoushi', name: '蛮族投石手', base: 'archer', mul: { hp: 1, speed: .6, damage: 1.3 }, trait: { kind: 'lobber', range: 440, everyMs: 4200, warnMs: 1000, radius: 80, damage: 11, allyDamage: 14, flightMs: 950 }, art: A('mantoushi'), fallback: { tint: 0xc08860, scale: 1 }, cap: 6 },
  dujian: { id: 'dujian', name: '毒箭蛮', base: 'archer', mul: { hp: .8, speed: .8, damage: .4 }, trait: { kind: 'poison', range: 360, everyMs: 2600, dps: 2, seconds: 3, maxStacks: 3, hitDamage: 2 }, art: A('dujian'), fallback: { tint: 0x8aa868, scale: 1 }, cap: 6 },
  xunshou: { id: 'xunshou', name: '驯兽兵', base: 'infantry', mul: { hp: .9, speed: .9, damage: .6 }, trait: { kind: 'tamer', beast: 'beast', beasts: 3, enrage: 1.35 }, art: A('xunshou'), fallback: { tint: 0xb07850, scale: 1 }, cap: 3 },
  beast: { id: 'beast', name: '猛兽', base: 'infantry', mul: { hp: .6, speed: 1.5, damage: 1.2 }, trait: { kind: 'swarm' }, art: { walk: 'enemy_beast_walk', attack: 'enemy_beast_attack', scale: .9, groundY: .875 }, fallback: { tint: 0x7a5a38, scale: .75 }, cap: 12 },
};

/** 各关混进普通刷怪的新兵种：share = 每次刷怪换成这个兵种的概率；from = 加速后刷怪时间轴（秒）多少以后才出。 */
export const STAGE_ROSTER: Record<string, ReadonlyArray<{ id: string; share: number; from?: number }>> = {
  'huangjin.1': [{ id: 'liumin', share: .08, from: 20 }],
  'huangjin.2': [{ id: 'liumin', share: .07, from: 15 }, { id: 'fushui', share: .05, from: 60 }],
  'huangjin.3': [{ id: 'fushui', share: .05, from: 40 }, { id: 'lishi', share: .03, from: 70 }],
  'hulao.1': [{ id: 'gunshi', share: .06, from: 30 }],
  'hulao.2': [{ id: 'qianghu', share: .05, from: 40 }, { id: 'gunshi', share: .04, from: 60 }],
  'hulao.3': [{ id: 'qianghu', share: .04, from: 40 }, { id: 'zonghuo', share: .07, from: 30 }],
  'nanzheng.1': [{ id: 'mantoushi', share: .07, from: 30 }],
  'nanzheng.3': [{ id: 'dujian', share: .07, from: 30 }, { id: 'xunshou', share: .03, from: 60 }],
};
