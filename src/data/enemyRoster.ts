import type { EnemyKind } from '../types';

/**
 * 各章小怪兵种（共享笔记 enemy-roster-design.md，用户 2026-11-19 批准；美术风格会话出图、content 写代码）。
 * 做法：底层仍是 6 种 EnemyKind（步 / 盾 / 弓 / 骑 / 精英 / 首领），新兵种 = 某个底层兵种 + 数值倍率 + 一种机制（trait），
 * 刷怪时按关卡配兵表（STAGE_MIX + ROSTER_MIX，逻辑在 systems/RosterMix）按比例混进普通刷怪；机制由 systems/EnemyTraits 每帧驱动。
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
  | { kind: 'tamer'; beast: string; beasts: number; enrage: number }
  // —— 第二批（第 3～6 章）——
  /** M7 伏击：藏着（见 RosterType.hide），现身后猛冲 dashMs（速度 × dash），现身处点一把火（夜袭兵的火把）*/
  | { kind: 'ambusher'; dash: number; dashMs: number; fireMs: number }
  /** M8 盾墙：慢慢转身面向主将（turnDeg 度 / 秒），正面 ±60° 受击只吃 (1 − front)；贴近 bashRange 盾击 */
  | { kind: 'shieldwall'; front: number; turnDeg: number; bashRange: number; bashDamage: number; everyMs: number }
  /** 标枪游击：保持 range 外掷标枪，太近就后撤（kite） */
  | { kind: 'javelin'; range: number; everyMs: number; speed: number }
  /** M2 变体 · 大戟横扫：贴近后扇形预警 arcDeg、warnMs 后横扫 */
  | { kind: 'sweeper'; range: number; arcDeg: number; warnMs: number; everyMs: number; damage: number; allyDamage: number }
  /** M9 两态：举盾 upMs（正面减伤、不攻击）↔ 放盾 downMs 内连射 shots 支弩 */
  | { kind: 'stance'; upMs: number; downMs: number; front: number; shots: number; shotGapMs: number; arrowSpeed: number; range: number }
  /** 运粮：背粮往远处（场地关口 / 背离主将）跑，runMs 内没被截住就把粮送到——当场来 reinforce 名援兵；被杀掉 food 军粮 */
  | { kind: 'courier'; runMs: number; reinforce: number; food: number }
  /** M12 水战：水里不减速、速度 × waterSpeed；从水面刷出 */
  | { kind: 'amphibious'; waterSpeed: number }
  /** 火船：顺水冲向主将，碰到（或被打沉）就爆燃：radius 内伤害 + 留火 */
  | { kind: 'fireship'; radius: number; damage: number; allyDamage: number; fireMs: number; fireRadius: number; fireDamage: number }
  /** 枪阵：贴近后预警一条直线，warnMs 后长枪向前贯穿 range */
  | { kind: 'lancer'; range: number; width: number; warnMs: number; everyMs: number; damage: number; allyDamage: number }
  /** M10 扑跳：minRange～range 之间预警落点，warnMs 后一跃（flightMs）落地 radius 内伤害 */
  | { kind: 'leaper'; range: number; minRange: number; warnMs: number; flightMs: number; everyMs: number; radius: number; damage: number }
  /** 蓄力狙击：远处站定，蓄力 chargeMs（预警线），一箭穿透 length 长、width 宽 */
  | { kind: 'sniper'; range: number; chargeMs: number; everyMs: number; width: number; length: number; damage: number };

export type TraitKind = TraitDef['kind'];

/**
 * 配兵角色：同一角色的兵种共用一个「同时在场」上限（ROSTER_MIX.roleCaps），免得满屏都是治疗或满屏投石。
 * fodder（流民）和 pack（驯兽师带的猛兽）算杂兵，不计入「新兵种占比」。
 */
export type RosterRole = 'fodder' | 'support' | 'heavy' | 'artillery' | 'ranged' | 'raider' | 'beast' | 'pack' | 'ambush' | 'wall' | 'courier' | 'swim' | 'ship' | 'lancer' | 'leaper' | 'sniper';

export interface RosterType {
  id: string; name: string;
  /** 底层兵种（决定基础行为、受击、掉落、刷怪池里算哪类）。 */
  base: EnemyKind;
  role: RosterRole;
  /** 相对当章同类基线的倍数：血 / 速度 / 伤害。 */
  mul: { hp: number; speed: number; damage: number };
  trait: TraitDef;
  /**
   * 专属图（美术风格会话出图，登记在 ArtStyle.ART_V2_FILES，键 enemy_<id>_walk / enemy_<id>_attack；4×4，行 = 下 / 左 / 右 / 上）。
   * cell = 行走表格边长（128 / 144 / 176），脚底 = (cell − 7) / cell，显示倍数 V2_TROOP_SCALE。图没到就退回底层兵种图 + fallback。
   */
  art: { walk: string; attack: string; cell: number };
  /** 没有专属图时：底层兵种图染色 + 缩放。 */
  fallback: { tint: number; scale: number };
  /** 一次刷几个（蜂拥）。 */
  group?: readonly [number, number];
  /** 本兵种同时在场上限（另外还受角色上限 ROSTER_MIX.roleCaps 管）。 */
  cap: number;
  /** 底层是骑兵但不要冲锋（弓骑自己绕圈）。 */
  noCharge?: boolean;
  /** M7 伏击：刷在主将附近（暗处）、半透明且刀枪不入、不动；主将走进 reveal 以内现身（伏兵旗影预警）。 */
  hide?: { reveal: number };
  /** 经验倍数（运粮卒等「截住有赏」的兵）。 */
  xpMul?: number;
}

const A = (id: string, cell: number) => ({ walk: `enemy_${id}_walk`, attack: `enemy_${id}_attack`, cell });

export const ROSTER: Record<string, RosterType> = {
  // —— 第 1 章 黄巾 ——
  liumin: { id: 'liumin', name: '流民', base: 'infantry', role: 'fodder', mul: { hp: .35, speed: 1.15, damage: .5 }, trait: { kind: 'swarm' }, art: A('liumin', 128), fallback: { tint: 0xb8a888, scale: .8 }, group: [6, 8], cap: 32 },
  fushui: { id: 'fushui', name: '符水道徒', base: 'infantry', role: 'support', mul: { hp: 1.2, speed: .7, damage: .4 }, trait: { kind: 'healer', radius: 200, share: .03, everyMs: 1000, keepAway: 280 }, art: A('fushui', 144), fallback: { tint: 0xf0e2a0, scale: 1 }, cap: 2 },
  lishi: { id: 'lishi', name: '黄巾力士', base: 'shield', role: 'heavy', mul: { hp: 7, speed: .55, damage: 2.2 }, trait: { kind: 'heavy', slamRange: 120, slamRadius: 130, warnMs: 800, everyMs: 3200, damage: 14, allyDamage: 18 }, art: A('lishi', 176), fallback: { tint: 0xd89060, scale: 1.4 }, cap: 2 },
  // —— 第 2 章 西凉 ——
  qianghu: { id: 'qianghu', name: '羌胡弓骑', base: 'cavalry', role: 'ranged', mul: { hp: 1.2, speed: 1.3, damage: .8 }, trait: { kind: 'horsearcher', orbit: 300, everyMs: 2200, arrowSpeed: 230 }, art: A('qianghu', 176), fallback: { tint: 0xc8a070, scale: 1 }, cap: 4, noCharge: true },
  gunshi: { id: 'gunshi', name: '关守滚石兵', base: 'shield', role: 'artillery', mul: { hp: 1.5, speed: .5, damage: 1.6 }, trait: { kind: 'lobber', range: 420, everyMs: 4000, warnMs: 1000, radius: 80, damage: 12, allyDamage: 16, flightMs: 900 }, art: A('gunshi', 144), fallback: { tint: 0x9a9890, scale: 1 }, cap: 3 },
  zonghuo: { id: 'zonghuo', name: '纵火兵', base: 'infantry', role: 'raider', mul: { hp: .8, speed: 1.25, damage: .7 }, trait: { kind: 'torch', dropEveryMs: 550, fireMs: 2000, fireRadius: 42, fireDamage: 4, burstRadius: 100, burstDamage: 14 }, art: A('zonghuo', 128), fallback: { tint: 0x8a5a40, scale: 1 }, cap: 4 },
  // —— 第 11 章 南中 ——
  mantoushi: { id: 'mantoushi', name: '蛮族投石手', base: 'archer', role: 'artillery', mul: { hp: 1, speed: .6, damage: 1.3 }, trait: { kind: 'lobber', range: 440, everyMs: 4200, warnMs: 1000, radius: 80, damage: 11, allyDamage: 14, flightMs: 950 }, art: A('mantoushi', 128), fallback: { tint: 0xc08860, scale: 1 }, cap: 3 },
  dujian: { id: 'dujian', name: '毒箭蛮', base: 'archer', role: 'ranged', mul: { hp: .8, speed: .8, damage: .4 }, trait: { kind: 'poison', range: 360, everyMs: 2600, dps: 2, seconds: 3, maxStacks: 3, hitDamage: 2 }, art: A('dujian', 128), fallback: { tint: 0x8aa868, scale: 1 }, cap: 4 },
  xunshou: { id: 'xunshou', name: '驯兽兵', base: 'infantry', role: 'beast', mul: { hp: .9, speed: .9, damage: .6 }, trait: { kind: 'tamer', beast: 'beast', beasts: 3, enrage: 1.35 }, art: A('xunshou', 144), fallback: { tint: 0xb07850, scale: 1 }, cap: 2 },
  // —— 第二批 · 第 3 章 群雄 ——
  yexi: { id: 'yexi', name: '夜袭兵', base: 'infantry', role: 'ambush', mul: { hp: 1, speed: 1.2, damage: 1.2 }, trait: { kind: 'ambusher', dash: 2.2, dashMs: 900, fireMs: 2500 }, hide: { reveal: 260 }, art: A('yexi', 128), fallback: { tint: 0x707488, scale: 1 }, cap: 4 },
  xianzhen: { id: 'xianzhen', name: '陷阵营', base: 'shield', role: 'wall', mul: { hp: 3.5, speed: .75, damage: 1.4 }, trait: { kind: 'shieldwall', front: .6, turnDeg: 70, bashRange: 75, bashDamage: 10, everyMs: 1800 }, art: A('xianzhen', 144), fallback: { tint: 0x9aa0aa, scale: 1.15 }, group: [5, 7], cap: 7 },
  danyang: { id: 'danyang', name: '丹阳兵', base: 'infantry', role: 'ranged', mul: { hp: 1.1, speed: 1.1, damage: 1 }, trait: { kind: 'javelin', range: 340, everyMs: 2600, speed: 330 }, art: A('danyang', 144), fallback: { tint: 0xc89a80, scale: 1 }, cap: 4 },
  // —— 第 4 章 官渡 ——
  daji: { id: 'daji', name: '大戟士', base: 'shield', role: 'heavy', mul: { hp: 3, speed: .8, damage: 1.5 }, trait: { kind: 'sweeper', range: 150, arcDeg: 120, warnMs: 750, everyMs: 3000, damage: 13, allyDamage: 16 }, art: A('daji', 176), fallback: { tint: 0xd8c8a0, scale: 1.25 }, cap: 3 },
  xiandeng: { id: 'xiandeng', name: '先登死士', base: 'archer', role: 'ranged', mul: { hp: 1.6, speed: .6, damage: 1.2 }, trait: { kind: 'stance', upMs: 2500, downMs: 1200, front: .6, shots: 3, shotGapMs: 220, arrowSpeed: 300, range: 380 }, art: A('xiandeng', 144), fallback: { tint: 0x8a8070, scale: 1.05 }, cap: 4 },
  yaliang: { id: 'yaliang', name: '押粮卒', base: 'infantry', role: 'courier', mul: { hp: 1.2, speed: .8, damage: .4 }, trait: { kind: 'courier', runMs: 16000, reinforce: 3, food: 15 }, art: A('yaliang', 128), fallback: { tint: 0xc8b088, scale: .9 }, cap: 3, xpMul: 3 },
  // —— 第 5 章 赤壁 ——
  shuizu: { id: 'shuizu', name: '荆州水卒', base: 'infantry', role: 'swim', mul: { hp: 1.1, speed: 1.15, damage: 1 }, trait: { kind: 'amphibious', waterSpeed: 1.3 }, art: A('shuizu', 128), fallback: { tint: 0x98b0b8, scale: 1 }, group: [3, 4], cap: 10 },
  huochuan: { id: 'huochuan', name: '火船', base: 'infantry', role: 'ship', mul: { hp: 3, speed: .9, damage: 3 }, trait: { kind: 'fireship', radius: 120, damage: 22, allyDamage: 30, fireMs: 3000, fireRadius: 60, fireDamage: 5 }, art: A('huochuan', 176), fallback: { tint: 0xffffff, scale: 1 }, cap: 2 },
  qiangzhen: { id: 'qiangzhen', name: '曹军枪阵兵', base: 'infantry', role: 'lancer', mul: { hp: 1.5, speed: .8, damage: 1.3 }, trait: { kind: 'lancer', range: 170, width: 60, warnMs: 650, everyMs: 2600, damage: 12, allyDamage: 14 }, art: A('qiangzhen', 144), fallback: { tint: 0x8090a8, scale: 1.05 }, cap: 4 },
  // —— 第 6 章 荆南 ——
  feishi: { id: 'feishi', name: '山越飞石手', base: 'archer', role: 'artillery', mul: { hp: .9, speed: 1, damage: 1.2 }, trait: { kind: 'lobber', range: 400, everyMs: 4000, warnMs: 1000, radius: 75, damage: 10, allyDamage: 12, flightMs: 900 }, hide: { reveal: 380 }, art: A('feishi', 128), fallback: { tint: 0xb89070, scale: 1 }, cap: 3 },
  wuxi: { id: 'wuxi', name: '五溪蛮兵', base: 'infantry', role: 'leaper', mul: { hp: 1.3, speed: 1.1, damage: 1.2 }, trait: { kind: 'leaper', range: 320, minRange: 120, warnMs: 700, flightMs: 420, everyMs: 3800, radius: 80, damage: 12 }, art: A('wuxi', 128), fallback: { tint: 0xc88860, scale: 1.05 }, cap: 4 },
  changsha: { id: 'changsha', name: '长沙强弓', base: 'archer', role: 'sniper', mul: { hp: .9, speed: .6, damage: 2.2 }, trait: { kind: 'sniper', range: 620, chargeMs: 1200, everyMs: 4800, width: 36, length: 900, damage: 20 }, art: A('changsha', 144), fallback: { tint: 0xa89878, scale: 1 }, cap: 2 },
  beast: { id: 'beast', name: '猛兽', base: 'infantry', role: 'pack', mul: { hp: .6, speed: 1.5, damage: 1.2 }, trait: { kind: 'swarm' }, art: A('beast', 144), fallback: { tint: 0x7a5a38, scale: .75 }, cap: 6 },
};

// ———— 配兵比例（用户 11-19「控制一下配兵比例」；现在没有难度分级，traitMul 留给以后接难度）————
export type BaseKind = 'infantry' | 'shield' | 'archer' | 'cavalry' | 'elite';
/** w = 权重：底层兵种权重合计算 100（没填 base 时这 100 份按本章原来的刷怪表出），新兵种 w 就约等于「每 100 次刷怪里有几次是它」；wave = 第几波起出（1 起算）。 */
export interface MixEntry { w: number; wave?: number }
export interface StageMix {
  /** 底层兵种配比；不填 = 沿用本章原有的刷怪表（chapter.pickEnemy，里面有按用户反馈调过的比例和时间段）。 */
  base?: Partial<Record<BaseKind, MixEntry>>;
  traits: Record<string, MixEntry>;
}

export const ROSTER_MIX = {
  /** 全局倍数：所有新兵种权重 ×（以后加难度时接这里）。 */
  traitMul: 1,
  /** 场上新兵种（不算 fodder / pack 杂兵）最多占在场敌军的比例；在场敌军很少时至少允许 1 个。 */
  maxTraitShare: .2,
  /** 各角色同时在场上限。 */
  roleCaps: { fodder: 32, support: 2, heavy: 2, artillery: 3, ranged: 4, raider: 4, beast: 2, pack: 6, ambush: 4, wall: 7, courier: 3, swim: 10, ship: 2, lancer: 4, leaper: 4, sniper: 2 } as Record<RosterRole, number>,
  /** 没写 wave 的新兵种从第几波起出。 */
  firstWave: 2,
};

/** 各关配兵表：键 = 章节 arc + '.' + 第几关（同 stageMaps）。 */
export const STAGE_MIX: Record<string, StageMix> = {
  'huangjin.1': { traits: { liumin: { w: 10 } } },
  'huangjin.2': { traits: { liumin: { w: 8 }, fushui: { w: 5 } } },
  'huangjin.3': { traits: { fushui: { w: 5, wave: 1 }, lishi: { w: 3 } } },
  'hulao.1': { traits: { gunshi: { w: 6 } } },
  'hulao.2': { traits: { qianghu: { w: 5 }, gunshi: { w: 4 } } },
  'hulao.3': { traits: { qianghu: { w: 4, wave: 1 }, zonghuo: { w: 7, wave: 1 } } }, // 2-3 火烧洛阳不分波（只有第 1 波）
  // 第二批（第 3～6 章）
  'qunxiong.1': { traits: { xianzhen: { w: 3 } } }, // 陷阵营一次一队 5～7 人
  'qunxiong.2': { traits: { yexi: { w: 6 } } },
  'qunxiong.3': { traits: { danyang: { w: 7 } } },
  'guandu.1': { traits: { daji: { w: 4 }, xiandeng: { w: 4 } } },
  'guandu.2': { traits: { daji: { w: 4 } } },
  'guandu.3': { traits: { xiandeng: { w: 4 }, yaliang: { w: 5 } } },
  'chibi.2': { traits: { shuizu: { w: 6 }, huochuan: { w: 3 } } },
  'chibi.3': { traits: { qiangzhen: { w: 6 } } },
  'jingnan.2': { traits: { feishi: { w: 5 }, wuxi: { w: 5 } } },
  'jingnan.3': { traits: { changsha: { w: 4 } } },
  'nanzheng.1': { traits: { mantoushi: { w: 7 } } },
  'nanzheng.3': { traits: { dujian: { w: 7 }, xunshou: { w: 3 } } },
};
