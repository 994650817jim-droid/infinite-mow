import { CH1_TRIAL, CH1V6 } from './ch1Trial';
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
  | { kind: 'sniper'; range: number; chargeMs: number; everyMs: number; width: number; length: number; damage: number }
  // —— 第三批（第 7～10、12 章）——
  /** M11 绳网：保持距离投网，中了主将移速 × (1 − slow) 持续 slowMs */
  | { kind: 'net'; range: number; everyMs: number; slow: number; slowMs: number; hitDamage: number }
  /** M3 增益光环：躲在友军后面念咒，半径内友军移速 × speedMul、伤害 × damageMul（首领不吃）；倒下光环消失 */
  | { kind: 'aura'; radius: number; speedMul: number; damageMul: number; keepAway: number }
  /** 箭雨区：站远处，在主将脚下标一圈，warnMs 后落箭 */
  | { kind: 'volley'; range: number; everyMs: number; warnMs: number; radius: number; damage: number; allyDamage: number }
  /** 擂木：贴近后沿直线预警，滚木从脚下滚出 length（速度 speed），碾到就伤 */
  | { kind: 'roller'; range: number; length: number; width: number; warnMs: number; everyMs: number; speed: number; damage: number; allyDamage: number }
  /** 火罐：同投掷，落点留燃烧地面；倒下爆燃 */
  | { kind: 'firepot'; range: number; everyMs: number; warnMs: number; radius: number; damage: number; allyDamage: number; flightMs: number; fireMs: number; fireRadius: number; fireDamage: number; burstRadius: number; burstDamage: number }
  /** 连射：保持距离，每 everyMs 连射 shots 支（伏弓现身后的三连射） */
  | { kind: 'burst'; range: number; everyMs: number; shots: number; gapMs: number; arrowSpeed: number }
  /** 护主：离首领 radius 内受伤 × mul，没事时跟在首领身边；主将近了就上前打 */
  | { kind: 'guard'; radius: number; mul: number; engage: number }
  /** 火箭：保持距离放火箭，箭落处留火 */
  | { kind: 'firearrow'; range: number; everyMs: number; speed: number; fireMs: number; fireRadius: number; fireDamage: number };

export type TraitKind = TraitDef['kind'];

/**
 * 配兵角色：同一角色的兵种共用一个「同时在场」上限（ROSTER_MIX.roleCaps），免得满屏都是治疗或满屏投石。
 * fodder（流民）和 pack（驯兽师带的猛兽）算杂兵，不计入「新兵种占比」。
 */
export type RosterRole = 'fodder' | 'support' | 'heavy' | 'artillery' | 'ranged' | 'raider' | 'beast' | 'pack' | 'ambush' | 'wall' | 'courier' | 'swim' | 'ship' | 'lancer' | 'leaper' | 'sniper' | 'aura' | 'engine' | 'cavalry';

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
  art: { walk: string; attack: string; cell: number; /** 专属图显示倍数（在 V2_TROOP_SCALE 之上；四足兽等画面里显矮的才用） */ mul?: number };
  /** 没有专属图时：底层兵种图染色 + 缩放。 */
  fallback: { tint: number; scale: number };
  /** 一次刷几个（蜂拥）。 */
  group?: readonly [number, number];
  /** 本兵种同时在场上限（另外还受角色上限 ROSTER_MIX.roleCaps 管）。 */
  cap: number;
  /** 底层是骑兵但不要冲锋（弓骑自己绕圈）。 */
  noCharge?: boolean;
  /** M7 伏击：刷在主将附近（暗处）、半透明且刀枪不入、不动；主将走进 reveal 以内现身（伏兵旗影预警）。 */
  hide?: { reveal: number; /** 伪装（白衣商旅）：看得见、白衣、不攻击、刀枪不入；走近才露刀 */ disguise?: boolean };
  /** 从哪边来：north = 从高处（北面山头）刷出（山地轻骑） */
  from?: 'north';
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
  // —— 第三批 · 第 7 章 入蜀 ——
  liehu: { id: 'liehu', name: '巴蜀猎户', base: 'infantry', role: 'ranged', mul: { hp: .9, speed: 1.1, damage: .5 }, trait: { kind: 'net', range: 320, everyMs: 4200, slow: .4, slowMs: 3000, hitDamage: 3 }, art: A('lieshou', 128), fallback: { tint: 0xb0a080, scale: 1 }, cap: 4 },
  dongzhou: { id: 'dongzhou', name: '东州兵', base: 'shield', role: 'wall', mul: { hp: 2.5, speed: .7, damage: 1.3 }, trait: { kind: 'shieldwall', front: .55, turnDeg: 75, bashRange: 80, bashDamage: 11, everyMs: 1900 }, art: A('dongzhou', 144), fallback: { tint: 0xb08870, scale: 1.1 }, group: [3, 5], cap: 6 },
  funu: { id: 'funu', name: '伏弩手', base: 'archer', role: 'ambush', mul: { hp: .8, speed: .5, damage: 1.5 }, trait: { kind: 'volley', range: 460, everyMs: 4200, warnMs: 1000, radius: 85, damage: 11, allyDamage: 10 }, hide: { reveal: 400 }, art: A('funu', 128), fallback: { tint: 0x8a9a80, scale: 1 }, cap: 3 },
  // —— 第 8 章 汉中 ——
  jijiu: { id: 'jijiu', name: '五斗米祭酒', base: 'infantry', role: 'aura', mul: { hp: 1.2, speed: .7, damage: .5 }, trait: { kind: 'aura', radius: 220, speedMul: 1.25, damageMul: 1.25, keepAway: 300 }, art: A('jisi', 128), fallback: { tint: 0xc8a868, scale: 1 }, cap: 2 },
  shanqi: { id: 'shanqi', name: '魏军山地轻骑', base: 'cavalry', role: 'cavalry', mul: { hp: 1.2, speed: 1.2, damage: 1.3 }, trait: { kind: 'swarm' }, from: 'north', art: A('shanji', 176), fallback: { tint: 0x9aa0a8, scale: 1 }, cap: 4 },
  pili: { id: 'pili', name: '霹雳车', base: 'shield', role: 'engine', mul: { hp: 6, speed: .25, damage: 3 }, trait: { kind: 'lobber', range: 620, everyMs: 6000, warnMs: 1400, radius: 110, damage: 22, allyDamage: 26, flightMs: 1300 }, art: A('pilie', 176), fallback: { tint: 0xa08060, scale: 1.4 }, cap: 1 },
  // —— 第 9 章 襄樊 ——
  kuibing: { id: 'kuibing', name: '七军溃兵', base: 'infantry', role: 'fodder', mul: { hp: .4, speed: 1.1, damage: .6 }, trait: { kind: 'amphibious', waterSpeed: 1 }, art: A('kuibing', 128), fallback: { tint: 0x9a9a98, scale: .9 }, group: [5, 7], cap: 28 },
  baiyi: { id: 'baiyi', name: '白衣商旅兵', base: 'infantry', role: 'ambush', mul: { hp: 1, speed: 1.2, damage: 1.4 }, trait: { kind: 'ambusher', dash: 2, dashMs: 800, fireMs: 0 }, hide: { reveal: 200, disguise: true }, art: A('baiyi', 128), fallback: { tint: 0xd8c8b8, scale: 1 }, cap: 4 },
  leimu: { id: 'leimu', name: '樊城擂木兵', base: 'shield', role: 'artillery', mul: { hp: 1.5, speed: .5, damage: 1.5 }, trait: { kind: 'roller', range: 320, length: 520, width: 90, warnMs: 1000, everyMs: 5000, speed: 560, damage: 16, allyDamage: 20 }, art: A('leimu', 144), fallback: { tint: 0x9a9890, scale: 1 }, cap: 3 },
  // —— 第 10 章 夷陵 ——
  huogong: { id: 'huogong', name: '吴军火攻兵', base: 'infantry', role: 'artillery', mul: { hp: 1, speed: 1, damage: .8 }, trait: { kind: 'firepot', range: 380, everyMs: 4200, warnMs: 900, radius: 75, damage: 9, allyDamage: 10, flightMs: 800, fireMs: 2500, fireRadius: 60, fireDamage: 4, burstRadius: 90, burstDamage: 12 }, art: A('huogong', 128), fallback: { tint: 0xb07058, scale: 1 }, cap: 3 },
  linfu: { id: 'linfu', name: '林中伏弓', base: 'archer', role: 'ambush', mul: { hp: .9, speed: .6, damage: 1 }, trait: { kind: 'burst', range: 400, everyMs: 3800, shots: 3, gapMs: 200, arrowSpeed: 300 }, hide: { reveal: 380 }, art: A('linggong', 128), fallback: { tint: 0x8aa078, scale: 1 }, cap: 3 },
  zhuran: { id: 'zhuran', name: '朱然亲军', base: 'shield', role: 'heavy', mul: { hp: 3, speed: .8, damage: 1.5 }, trait: { kind: 'sweeper', range: 150, arcDeg: 120, warnMs: 750, everyMs: 3000, damage: 13, allyDamage: 16 }, art: A('zhuranqin', 176), fallback: { tint: 0xc07060, scale: 1.25 }, cap: 2 },
  // —— 第 12 章 北伐 ——
  huwei: { id: 'huwei', name: '魏国虎卫', base: 'shield', role: 'heavy', mul: { hp: 4, speed: .8, damage: 1.6 }, trait: { kind: 'guard', radius: 200, mul: .5, engage: 260 }, art: A('huwei', 176), fallback: { tint: 0x6a6a78, scale: 1.25 }, cap: 4 },
  qiangbing: { id: 'qiangbing', name: '西凉羌兵', base: 'infantry', role: 'leaper', mul: { hp: 1, speed: 1.3, damage: 1.1 }, trait: { kind: 'leaper', range: 340, minRange: 120, warnMs: 600, flightMs: 380, everyMs: 3200, radius: 75, damage: 11 }, art: A('qiangbing', 128), fallback: { tint: 0xc0a888, scale: 1 }, cap: 4 },
  huojian: { id: 'huojian', name: '火箭手', base: 'archer', role: 'ranged', mul: { hp: .9, speed: .6, damage: 1 }, trait: { kind: 'firearrow', range: 420, everyMs: 3200, speed: 300, fireMs: 2000, fireRadius: 50, fireDamage: 4 }, art: A('huojian', 144), fallback: { tint: 0xb89070, scale: 1 }, cap: 4 },
  beast: { id: 'beast', name: '猛兽', base: 'infantry', role: 'pack', mul: { hp: .6, speed: 1.5, damage: 1.2 }, trait: { kind: 'swarm' }, art: { ...A('beast', 144), mul: 1.25 } /* 猛虎四足、画面里只有步兵的 0.76 高，放大到 ~0.95（11-19 比例总览）*/, fallback: { tint: 0x7a5a38, scale: .75 }, cap: 6 },
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
  roleCaps: { fodder: 32, support: 2, heavy: 2, artillery: 3, ranged: 4, raider: 4, beast: 2, pack: 6, ambush: 4, wall: 7, courier: 3, swim: 10, ship: 2, lancer: 4, leaper: 4, sniper: 2, aura: 2, engine: 1, cavalry: 4 } as Record<RosterRole, number>,
  /** 没写 wave 的新兵种从第几波起出。 */
  firstWave: 2,
};

/** 各关配兵表：键 = 章节 arc + '.' + 第几关（同 stageMaps）。 */
export const STAGE_MIX: Record<string, StageMix> = {
  // 2026-11-19 平衡会话审查（用户「每一关敌军兵种配比也要检查调整一下」）：wave = 五段里第几段起出（1 先锋 · 2 精锐 · 3 事件 · 4 副将 · 5 首领）。
  // 原则：先锋只出本章底层兵 + 最多一种轻量新兵；第 2 段起出本关主题兵；第 3～4 段再加一种本章兵加码；新兵种合计权重约 10～13（场上占比另有 20% 上限）。
  'huangjin.1': { traits: { liumin: { w: CH1_TRIAL ? CH1V6.stage1Mix.liumin : 10 } } }, // 1-1 新手关：只有流民（成群、很脆）
  'huangjin.2': { traits: { liumin: { w: 8 }, fushui: { w: 5, wave: 3 } } }, // 符水道徒挪到事件段：先学会打人群，再学先杀治疗
  'huangjin.3': { traits: { fushui: { w: 4, wave: 2 }, lishi: { w: 3, wave: 3 }, liumin: { w: 4, wave: 1 } } }, // 原 fushui 第 1 波就出 → 第 2 段；先锋补流民
  'hulao.1': { traits: { gunshi: { w: 6 }, qianghu: { w: 3, wave: 4 } } }, // 汜水关：关守滚石兵 + 副将段西凉弓骑
  'hulao.2': { traits: { qianghu: { w: 5 }, gunshi: { w: 4, wave: 3 } } },
  'hulao.3': { traits: { qianghu: { w: 4, wave: 1 }, zonghuo: { w: 7, wave: 1 } } }, // 2-3 火烧洛阳不分段（只有第 1 波），不动
  // 第 3 章 群雄
  'qunxiong.1': { traits: { qianghu: { w: 4 }, xianzhen: { w: 3, wave: 3 } } }, // 3-1 李傕郭汜：西凉弓骑打底，事件段陷阵营压上（原只有陷阵营）
  'qunxiong.2': { traits: { yexi: { w: 6 }, zonghuo: { w: 3, wave: 3 } } }, // 3-2 宛城夜袭：夜袭兵 + 营中纵火
  'qunxiong.3': { traits: { danyang: { w: 6 }, xianzhen: { w: 3, wave: 4 } } }, // 3-3 寿春：丹阳兵投矛 + 副将段盾阵
  // 第 4 章 官渡
  'guandu.1': { traits: { xiandeng: { w: 4 }, daji: { w: 4, wave: 3 } } }, // 原两种同时第 2 段出 → 大戟士挪到事件段
  'guandu.2': { traits: { daji: { w: 4 }, xiandeng: { w: 3, wave: 3 } } }, // 原只有大戟士
  'guandu.3': { traits: { yaliang: { w: 5 }, xiandeng: { w: 4, wave: 3 } } }, // 乌巢：押粮卒先出（截住有赏），再加先登
  // 第 5 章 赤壁
  'chibi.1': { traits: { qiangzhen: { w: 5 }, shuizu: { w: 3, wave: 4 } } }, // 5-1 长坂（原无新兵）：曹军枪阵追击，副将段水卒过河
  'chibi.2': { traits: { shuizu: { w: 6 }, huochuan: { w: 3, wave: 3 } } }, // 火船挪到事件段（原第 2 段就出）
  'chibi.3': { traits: { qiangzhen: { w: 6 }, shuizu: { w: 3, wave: 3 } } }, // 江陵：原只有枪阵兵
  // 第 6 章 荆南
  'jingnan.1': { traits: { wuxi: { w: 5 }, feishi: { w: 3, wave: 3 } } }, // 6-1（原无新兵）：五溪蛮扑跳 + 山越飞石
  'jingnan.2': { traits: { feishi: { w: 4 }, wuxi: { w: 4, wave: 3 } } },
  'jingnan.3': { traits: { changsha: { w: 3 }, wuxi: { w: 4, wave: 3 } } }, // 长沙：强弓（上限 2）+ 五溪蛮（原只有强弓）
  // 第 7 章 入蜀
  'shu.1': { traits: { liehu: { w: 6 }, dongzhou: { w: 3, wave: 4 } } },
  'shu.2': { traits: { liehu: { w: 4 }, funu: { w: 4, wave: 3 } } }, // 落凤坡：伏弩挪到事件段
  'shu.3': { traits: { dongzhou: { w: 4 }, funu: { w: 3, wave: 3 } } }, // 原只有东州兵
  // 第 8 章 汉中
  'hanzhong.1': { traits: { jijiu: { w: 3 }, shanqi: { w: 4, wave: 3 } } }, // 阳平关：祭酒（上限 2）+ 魏军山地轻骑
  'hanzhong.2': { traits: { shanqi: { w: 6 }, jijiu: { w: 3, wave: 4 } } }, // 定军山：原只有山地轻骑
  'hanzhong.3': { traits: { shanqi: { w: 4 }, pili: { w: 2, wave: 3 } } }, // 汉水：霹雳车（上限 1）挪到事件段，先锋 / 精锐出轻骑（原只有霹雳车）
  // 第 9 章 襄樊
  'xiangfan.1': { traits: { leimu: { w: 4 }, kuibing: { w: 4, wave: 4 } } }, // 樊城擂木 + 副将段溃兵
  'xiangfan.2': { traits: { kuibing: { w: 6 }, leimu: { w: 3, wave: 3 } } }, // 水淹七军：原只有溃兵（杂兵）
  'xiangfan.3': { traits: { baiyi: { w: 4 }, huogong: { w: 3, wave: 4 } } }, // 白衣渡江：吴军火攻兵在副将段接上（原只有白衣）
  // 第 10 章 夷陵
  'yiling.1': { traits: { linfu: { w: 4 }, huogong: { w: 3, wave: 3 } } },
  'yiling.2': { traits: { huogong: { w: 4 }, linfu: { w: 3, wave: 2 }, zhuran: { w: 3, wave: 4 } } }, // 原三种第 2 段同时出 → 朱然亲军留到副将段
  'yiling.3': { traits: { huogong: { w: 5 }, zhuran: { w: 2, wave: 4 } } }, // 火烧连营：原只有火攻兵
  // 第 11 章 南征
  'nanzheng.1': { traits: { mantoushi: { w: 5 }, dujian: { w: 3, wave: 3 } } }, // 原投石手权重 7 一种
  'nanzheng.2': { traits: { dujian: { w: 4 }, xunshou: { w: 2, wave: 3 }, mantoushi: { w: 3, wave: 4 } } }, // 11-2（原无新兵）
  'nanzheng.3': { traits: { dujian: { w: 6 }, xunshou: { w: 3, wave: 3 } } }, // 驯兽兵挪到事件段
  // 第 12 章 北伐
  'beifa.1': { traits: { qiangbing: { w: 5 }, huojian: { w: 3, wave: 3 } } }, // 街亭：原只有羌兵
  'beifa.2': { traits: { huojian: { w: 5 }, qiangbing: { w: 3, wave: 3 } } }, // 陈仓：原只有火箭手
  'beifa.3': { traits: { huwei: { w: 3 }, huojian: { w: 3, wave: 3 }, qiangbing: { w: 2, wave: 4 } } }, // 五丈原：原只有虎卫

  // ———— 支线战场（data/sideRoutes，统筹 11-21：配兵审计 wave-mix-audit.md 第 5 条「支线主题兵没进配兵表」）————
  // 键 = 支线 id + '.' + 第几关（白门楼走吕布战，不在这里）。支线不走五段（CHAPTER_INDEX 没有支线），用基础章节的三波：
  // 1 先锋（底层兵，最多一种轻量 / 杂兵）· 2 主题兵（就是关卡第二波的波名：白马义从、先登死士……）· 3 首领段加码。权重合计约 10～12，占比 / 角色上限同主线。
  // 没有专属兵种图的主题兵借最像的：白马义从 / 并州狼骑 = 羌胡弓骑，虎豹骑 = 魏军山地轻骑，锦帆贼 = 夜袭兵，江东水军 = 荆州水卒，鬼卒 = 流民 / 黄巾力士（张鲁支线外观借黄巾）。
  // 吕布 · 下邳（借第三章）
  'xiapi.1': { traits: { qianghu: { w: 6, wave: 2 }, gunshi: { w: 4, wave: 3 } } }, // 小沛：并州狼骑（弓骑）+ 守城滚石
  'xiapi.2': { traits: { xianzhen: { w: 6, wave: 2 }, qianghu: { w: 4, wave: 3 } } }, // 辕门射戟：陷阵营压阵
  'xiapi.3': { traits: { gunshi: { w: 5, wave: 2 }, xianzhen: { w: 3, wave: 3 }, qianghu: { w: 3, wave: 3 } } }, // 下邳：城头滚石，张辽守城时陷阵营 + 狼骑
  // 江东 · 南郡（借第五章、外观第十章吴军）
  'nanjun.1': { traits: { shuizu: { w: 6, wave: 2 }, danyang: { w: 4, wave: 3 } } }, // 江陵外围：水军跳帮登岸
  'nanjun.2': { traits: { shuizu: { w: 3, wave: 1 }, danyang: { w: 5, wave: 2 }, huogong: { w: 4, wave: 3 } } }, // 南郡：江东精兵（丹阳兵），周瑜亲至时火攻
  // 中原 · 曹魏（借第八章，底兵有青州兵）
  'caowei.1': { traits: { qiangzhen: { w: 6, wave: 2 }, huojian: { w: 4, wave: 3 } } }, // 陈留：青州兵列阵（枪阵）+ 城头火箭
  'caowei.2': { traits: { huwei: { w: 5, wave: 2 }, qiangzhen: { w: 3, wave: 3 }, shanqi: { w: 3, wave: 3 } } }, // 宛城旧地：虎卫军（护主）
  'caowei.3': { traits: { shanqi: { w: 6, wave: 2 }, pili: { w: 2, wave: 3 }, huojian: { w: 3, wave: 3 } } }, // 许昌：虎豹骑巡城 + 霹雳车守城
  'caowei.4': { traits: { shanqi: { w: 6, wave: 2 }, huwei: { w: 4, wave: 3 } } }, // 许都决战：虎豹骑出城，曹操亲至虎卫护主
  // 公孙瓒 · 幽州（借第三章）
  'gongsun.1': { traits: { qianghu: { w: 6, wave: 2 }, gunshi: { w: 4, wave: 3 } } }, // 平原：白马斥候
  'gongsun.2': { traits: { qianghu: { w: 7, wave: 2 }, qiangzhen: { w: 3, wave: 3 } } }, // 界桥：白马义从往来驰射（弓骑上限 4）
  'gongsun.3': { traits: { gunshi: { w: 5, wave: 2 }, funu: { w: 3, wave: 3 }, qianghu: { w: 3, wave: 3 } } }, // 易京楼：楼橹死守（滚石 + 伏弩）
  // 袁绍 · 河北（借第四章）
  'hebei.1': { traits: { daji: { w: 6, wave: 2 }, xiandeng: { w: 4, wave: 3 } } }, // 南皮：大戟士
  'hebei.2': { traits: { xiandeng: { w: 6, wave: 2 }, daji: { w: 4, wave: 3 } } }, // 仓亭：先登死士伏弩
  'hebei.3': { traits: { yaliang: { w: 5, wave: 2 }, xiandeng: { w: 3, wave: 3 }, daji: { w: 3, wave: 3 } } }, // 邺城：围城断粮（运粮卒截住有赏）
  'hebei.4': { traits: { daji: { w: 6, wave: 2 }, xiandeng: { w: 5, wave: 3 } } }, // 冀州决战：袁氏亲军
  // 荆州 · 江夏（借第四章、外观第六章荆南）
  'jiangxia.1': { traits: { shuizu: { w: 5, wave: 1 }, yexi: { w: 5, wave: 2 } } }, // 江夏水寨（水卒开局就有）→ 锦帆贼夜袭
  'jiangxia.2': { traits: { shuizu: { w: 6, wave: 2 }, changsha: { w: 3, wave: 3 }, yexi: { w: 2, wave: 3 } } }, // 江夏：荆州水军，黄祖亲至时强弓（上限 2）
  // 张鲁 · 汉中（借第八章、外观第一章黄巾）
  'zhanglu.1': { traits: { liumin: { w: 5, wave: 1 }, jijiu: { w: 3, wave: 2 }, fushui: { w: 3, wave: 3 } } }, // 五斗米道坛：鬼卒成群，祭酒（光环）、道徒（治疗）
  'zhanglu.2': { traits: { liumin: { w: 4, wave: 1 }, lishi: { w: 3, wave: 2 }, jijiu: { w: 3, wave: 3 }, fushui: { w: 2, wave: 3 } } }, // 南郑：鬼卒道兵（力士压阵）
  // 西凉 · 马韩（借第八章、外观第三章西凉）
  'xiliang.1': { traits: { qianghu: { w: 6, wave: 2 }, gunshi: { w: 4, wave: 3 } } }, // 天水：羌胡骑兵
  'xiliang.2': { traits: { qianghu: { w: 5, wave: 2 }, qiangbing: { w: 5, wave: 3 } } }, // 渭水：西凉铁骑往来驰射，阎行出阵时羌兵扑跳
  'xiliang.3': { traits: { qiangbing: { w: 6, wave: 2 }, qianghu: { w: 4, wave: 3 } } }, // 金城：羌兵助阵
  // 东吴 · 江东（借第十章）
  'dongwu.1': { traits: { linfu: { w: 4, wave: 2 }, danyang: { w: 3, wave: 3 }, huogong: { w: 3, wave: 3 } } }, // 庐江：江东弓手（伏弓三连射）
  'dongwu.2': { traits: { shuizu: { w: 6, wave: 2 }, huogong: { w: 4, wave: 3 } } }, // 濡须口：吴军水师，黄盖出阵时火攻
  'dongwu.3': { traits: { danyang: { w: 5, wave: 2 }, zhuran: { w: 3, wave: 3 }, huogong: { w: 3, wave: 3 } } }, // 吴郡：江东子弟（丹阳兵），周泰亲军（重甲横扫）
  // 南中 · 银坑（借第十一章）：底层兵在本章里就是蛮兵 / 藤甲（盾）/ 象兵（骑），主题兵靠底层配比出；基础章节第 1、2 关的表没有藤甲 / 象兵，这里自己给
  'nanzhong.1': { base: { infantry: { w: 52 }, shield: { w: 30, wave: 2 }, archer: { w: 12 }, elite: { w: 6, wave: 2 } }, traits: { dujian: { w: 4, wave: 2 }, mantoushi: { w: 3, wave: 3 } } }, // 银坑洞：藤甲兵（约三成，同 11-2 审计后的 33%）
  'nanzhong.2': { base: { infantry: { w: 42 }, shield: { w: 22 }, cavalry: { w: 16, wave: 2 }, archer: { w: 12 }, elite: { w: 8, wave: 2 } }, traits: { xunshou: { w: 3, wave: 2 }, dujian: { w: 4, wave: 3 } } }, // 秃龙洞：象兵冲阵（同 11-3 的 16%）+ 驯兽兵
};
