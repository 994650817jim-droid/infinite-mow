/**
 * 名将连战（共享笔记 gauntlet-design.md；统筹 2026-11-21「第一版」，用户批准）：一位武将在一张开阔场地里不停割草，每阵末尾闯进来一位名将，
 * 斩将后清场、三样战利品选一样，接下一阵；十阵通关后可继续「无尽」。没有行营、没有剧情、不用整军。
 * 一开始就能玩（用户 11-22「这个模式可以一开始就玩」）：没有开关、没有通关条件，新存档第一次进主菜单就有入口；名将池 38 位全开；
 * 不继承战役，所以有自己的选将页（GauntletPickScene，记住上次选的武将，和战役主将无关）。开发构建 ?gauntlet=1 仍可直接进（测试用）。
 * 所有数值都是初值（统筹合并前给用户看），集中在这一个文件。
 */
/** 模式名：用户 11-22 要改名（候选还没定），主菜单按钮、进场横幅、结算标题、天下地图、选将页……所有显示处都读这一个常量。 */
export const GAUNTLET_NAME = '名将连战幸存者'; // 用户 11-22 定名（原「名将连战」；存档键、代码标识符 gauntlet 不改）
/** 主菜单模式按钮下那行小字。 */
export const GAUNTLET_TAGLINE = '从零开局 · 十阵斩将';
/** 本模式上次选的武将（选将页记住；和战役主将无关）。 */
export const GAUNTLET_HERO_KEY = 'im_gauntlet_hero';
export function lastGauntletHero(): string | null { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(GAUNTLET_HERO_KEY) : null; } catch { return null; } }
export function saveGauntletHero(id: string): void { try { if (typeof localStorage !== 'undefined') localStorage.setItem(GAUNTLET_HERO_KEY, id); } catch { /* 存储不可用 */ } }

import type { BossMovesetDef, MoveDef } from './bossMoves';

/** 名将怎么出招：native = 战斗场景原生控制器（张角 / 吕布）；moveset = 首领招式框架（data/bossMoves）；yuanshu / caoren / guandu = 各自的专属控制器。 */
export type GauntletCtrl = 'native' | 'moveset' | 'yuanshu' | 'caoren' | 'guandu' | 'dongzhuo' | 'simayi';
/** 名将属于哪一篇（取首领图、首领数值用）。 */
export type GauntletArc = 'huangjin' | 'hulao' | 'qunxiong' | 'guandu' | 'chibi' | 'jingnan' | 'shu' | 'hanzhong' | 'xiangfan' | 'yiling' | 'nanzheng' | 'beifa';
/**
 * 出场段（共享笔记 gauntlet-roster.md）：前 = 第 1～3 阵，中 = 第 4～6 阵，后 = 第 7～9 阵，守关 = 第 10 阵（第 8～9 阵每局最多借一次）。
 * 某段没有打败过的名将时往前一段借（守关 → 后 → 中 → 前），再没有就往后借。
 */
export type GauntletTier = 'front' | 'mid' | 'late' | 'gate';
export const GAUNTLET_TIERS: readonly GauntletTier[] = ['front', 'mid', 'late', 'gate'];
/**
 * 随身布置：art = 用哪种现成图（粮垛 / 辎重车 / 营帐 / 城门 / 箭楼 / 火油罐）；count 件，每件生命 = 名将最大生命 × hpFrac；
 * 还有一件立着时名将受伤 ×takenMul；lifeSec 秒后自己倒；shaken = 打掉一件名将僵直（官渡控制器的「军心动摇」）；
 * pin = 立着时名将钉在原地（刘璋闭城）；front = 立在名将和主将之间（城门），否则围一圈。
 */
export interface GauntletProps { art: 'granary' | 'cart' | 'tent' | 'gate' | 'tower' | 'jar'; name: string; count: number; takenMul: number; hpFrac: number; lifeSec: number; shaken?: boolean; pin?: boolean; front?: boolean;
  /** 箭楼：立着时每 everySec 秒朝主将放一轮箭雨（count 个落点，半径 r，每中一个掉 ratio 最大生命；手绘预警圈，同陈仓箭楼）。 */
  volley?: { everySec: number; count: number; r: number; ratio: number };
  /** 火油罐：打碎处起火 fireSec 秒；名将踩进火里或罐全碎 → armor（藤甲着火：不再减伤，名将狂怒）。 */
  fireSec?: number; armor?: string }
/** 随行护卫：id = 名将池里护卫那位；hpFrac = 生命按他自己的首领数值再乘；leaveAt = 打到几成血退场；line = 退场喊话。 */
export interface GauntletEscort { id: string; takenMul: number; hpFrac: number; leaveAt: number; line: string }
export interface GauntletBoss {
  id: string; name: string; chapter: number; arc: GauntletArc; stage: 1 | 2 | 3; ctrl: GauntletCtrl; tier: GauntletTier;
  /** 战役里是哪一关的首领（HeroProgress.stageCleared 的键）。11-22 起名将池全开，不再按它限抽，只作记录。 */
  clearKey: string;
  /** 本模式每位最多 3 招：从招式框架里去掉的招（按招名；二阶段同名加强版不另算）。 */
  drop?: readonly string[];
  /** 按适配表加的招（如孙桓的吴军军旗：原关卡目标「砍倒吴军军旗」改成随身插旗）。 */
  add?: { p1?: readonly MoveDef[]; p2?: readonly MoveDef[] };
  /** 二阶段加强（庞德：原场景层的「抬棺狂暴」并进二阶段）：移速 / 招式伤害倍率。 */
  p2Boost?: { speed: number; dmg: number };
  /** 随身布置（适配表规则 a）：依赖建筑的机关改成登场时立在身边、可打掉、有持续时间的缩小版。 */
  props?: GauntletProps;
  /** 随行护卫（规则 c）：和名将一起登场，护卫在时名将受伤减；护卫打到 leaveAt 血退场（不算斩将）。 */
  escort?: GauntletEscort;
  /** 主章节河北双雄复用：一阵两将，全败才结算。 */
  dual?: 'hebei';
  /** 斩将后「收为副将」收的是谁（韩玄那阵收黄忠）。 */
  followAs?: string;
  /** 倒下后原地再起几次（孟获三擒：规则 c，不隐身、不无敌、不逃走）：每次回 hp 比例血、移速 ×speed、招式间隔 ×gap。 */
  rises?: { count: number; hp: number; speed: number; gap: number };
  /** 第 fromWave 阵起换一套招（曹仁：中段八门金锁，后段樊城死守）。 */
  late?: { fromWave: number; arc: GauntletArc; stage: 1 | 2 | 3; ctrl: GauntletCtrl };
  /** 袁术：「蜜水」逃跑不限时、不回血（首领自己的限时关掉，规则 d）。 */
  endlessHoney?: boolean;
  /** 高地圈（规则 b，夏侯渊 / 曹操的山头）：每 everySec 秒场上出现一块高地（预警 warnSec 秒、持续 lastSec 秒）；主将站在里面伤害 ×playerDmg，名将站进去出招间隔 ×bossGap。 */
  hill?: { everySec: number; warnSec: number; lastSec: number; radius: number; playerDmg: number; bossGap: number };
  /** 火带（规则 b，陆逊的火线 / 风向）：每 everySec 秒报风向，一道 rows 行 × cols 格的火带顺风扫过全场（留 gap 格缺口），每格预警 warnMs，行间隔 stepMs；二阶段一次两道。 */
  fireBand?: { everySec: number; warnMs: number; rows: number; cols: number; gap: number; spacing: number; stepMs: number; r: number; ratio: number; p2Bands: number };
  /** 换掉了本章哪位最终首领（依赖关卡机关）；关掉了他招式之外的哪些关卡机关（写进交接）。 */
  replaces?: string; off?: string;
}
/**
 * 名将池（适配表 gauntlet-roster.md，统筹 11-21 同意；分四批接入，这里是已接入的）：
 * - 第一版 12 位 + 第一批 10 位（纯招式框架：张梁、张宝、李傕、郭汜、张绣、曹纯、蔡瑁、赵范、刘度、黄忠）
 *   + 第二批 10 位（华雄、徐荣原生控制器；颜良官渡控制器；杨怀、张任、庞德、孙桓、忙牙长、祝融、张郃招式框架）。
 * - 招式框架首领（moveset）的招式只有冲锋 / 扇射 / 横扫 / 地裂 / 落点 / 突刺 / 奔射 / 隐身 / 召兵 / 插旗，都不依赖关卡机关；关卡层的机关（山头、攻城、限时突围、七擒、劝降）在本模式不建，第三、四批按适配表改成随身布置 / 全场险情 / 阶段。
 *   + 第三批（董卓吕布护卫、文丑辎重车、淳于琼粮垛、刘璋城门、朱然营帐、韩玄黄忠随行、孟获三擒、曹仁前后两套、袁术蜜水不限时；吕蒙伪装伏兵没图先不改）。
 *   + 第四批（夏侯渊 / 曹操高地圈、陆逊火带、司马懿随身营垒、郝昭随身箭楼 + 专属图、兀突骨火油罐）。全部 38 位接入。
 */
export const GAUNTLET_POOL: readonly GauntletBoss[] = [
  // 第一章
  { id: 'zhangliang', name: '张梁', chapter: 1, arc: 'huangjin', stage: 1, ctrl: 'moveset', tier: 'front', clearKey: 'huangjin-1' },
  { id: 'zhangbao', name: '张宝', chapter: 1, arc: 'huangjin', stage: 2, ctrl: 'moveset', tier: 'front', clearKey: 'huangjin-2', drop: ['撒豆成兵'] },
  { id: 'zhangjiao', name: '张角', chapter: 1, arc: 'huangjin', stage: 3, ctrl: 'native', tier: 'front', clearKey: 'huangjin-3', off: '1-3 法坛、广宗城门（场景布景）' },
  // 第二章
  { id: 'huaxiong', name: '华雄', chapter: 2, arc: 'hulao', stage: 1, ctrl: 'native', tier: 'front', clearKey: 'hulao-1', off: '汜水关城墙、箭楼、温酒彩蛋（布景）' },
  { id: 'xurong', name: '徐荣', chapter: 2, arc: 'hulao', stage: 2, ctrl: 'native', tier: 'front', clearKey: 'hulao-2', off: '荥阳伏兵营帐（布景）' },
  { id: 'dongzhuo', name: '董卓', chapter: 2, arc: 'hulao', stage: 3, ctrl: 'dongzhuo', tier: 'gate', clearKey: 'hulao-3', escort: { id: 'lubu', takenMul: .2, hpFrac: .5, leaveAt: 1 / 3, line: '哼，来日再战！' }, off: '城头、营寨、吕布斩董卓演出（吕布改护卫，1/3 血退场；迁都后撤原样 2.5 秒）' },
  { id: 'lubu', name: '吕布', chapter: 2, arc: 'hulao', stage: 3, ctrl: 'native', tier: 'gate', clearKey: 'hulao-3' },
  // 第三章
  { id: 'lijue', name: '李傕', chapter: 3, arc: 'qunxiong', stage: 1, ctrl: 'moveset', tier: 'front', clearKey: 'third-1', drop: ['西凉残部'], off: '李郭双首领（单独出场）' },
  { id: 'guosi', name: '郭汜', chapter: 3, arc: 'qunxiong', stage: 1, ctrl: 'moveset', tier: 'front', clearKey: 'third-1', off: '李郭双首领（单独出场）' },
  { id: 'zhangxiu', name: '张绣', chapter: 3, arc: 'qunxiong', stage: 2, ctrl: 'moveset', tier: 'front', clearKey: 'third-2', drop: ['白马突阵', '二连扇刺'], add: { p2: [{ kind: 'rings', name: '封步枪阵', windupMs: 950, cd: 12000, dmg: .9, radii: [110, 190], gapMs: 900, band: 36 }] } },
  { id: 'yuanshu', name: '袁术', chapter: 3, arc: 'qunxiong', stage: 3, ctrl: 'yuanshu', tier: 'mid', clearKey: 'third-3', endlessHoney: true, off: '蜜水 25 秒限时与逃脱回血（改为追上就打）' },
  // 第四章
  { id: 'yanliang', name: '颜良', chapter: 4, arc: 'guandu', stage: 1, ctrl: 'guandu', tier: 'mid', clearKey: 'guandu-1', off: '焚粮军心（不减伤）、4-1 负伤败走（本模式正常斩杀）' },
  { id: 'wenchou', name: '文丑', chapter: 4, arc: 'guandu', stage: 2, ctrl: 'guandu', tier: 'mid', clearKey: 'guandu-2', dual: 'hebei', off: '复用4-2河北双雄；不叠加辎重车减伤机关' },
  { id: 'chunyuqiong', name: '淳于琼', chapter: 4, arc: 'guandu', stage: 3, ctrl: 'guandu', tier: 'mid', clearKey: 'guandu-3', props: { art: 'granary', name: '乌巢粮垛', count: 3, takenMul: .5, hpFrac: .07, lifeSec: 40, shaken: true }, off: '乌巢粮仓（改随身粮垛：在时减伤，烧掉一座僵直）' },
  // 第五章
  { id: 'caochun', name: '曹纯', chapter: 5, arc: 'chibi', stage: 1, ctrl: 'moveset', tier: 'mid', clearKey: 'chibi-1', drop: ['马刀横扫'], off: '护百姓辎重（关卡目标）' },
  { id: 'caimao', name: '蔡瑁', chapter: 5, arc: 'chibi', stage: 2, ctrl: 'moveset', tier: 'mid', clearKey: 'chibi-2', drop: ['水军增援'], off: '水寨 / 连环船（布景）' },
  { id: 'caoren', name: '曹仁', chapter: 5, arc: 'chibi', stage: 3, ctrl: 'caoren', tier: 'mid', clearKey: 'chibi-3', late: { fromWave: 7, arc: 'xiangfan', stage: 1, ctrl: 'moveset' }, off: '第 7 阵起换 9-1 樊城那套（精兵 / 大刀 / 城门死守）' },
  // 第六章
  { id: 'zhaofan', name: '赵范', chapter: 6, arc: 'jingnan', stage: 1, ctrl: 'moveset', tier: 'mid', clearKey: 'jingnan-1', off: '劝降（由收为副将代替）' },
  { id: 'liudu', name: '刘度', chapter: 6, arc: 'jingnan', stage: 2, ctrl: 'moveset', tier: 'mid', clearKey: 'jingnan-2', drop: ['军刀横扫'], off: '劝降（由收为副将代替）' },
  { id: 'huangzhong', name: '黄忠', chapter: 6, arc: 'jingnan', stage: 3, ctrl: 'moveset', tier: 'mid', clearKey: 'jingnan-3', off: '先战黄忠 / 劝降（单独出场）' },
  { id: 'hanxuan', name: '韩玄', chapter: 6, arc: 'jingnan', stage: 3, ctrl: 'moveset', tier: 'mid', clearKey: 'jingnan-3', escort: { id: 'huangzhong', takenMul: .3, hpFrac: .6, leaveAt: 1 / 3, line: '老夫去也！' }, followAs: 'huangzhong', off: '先战黄忠（改黄忠随行，1/3 血退场）；劝降改收为副将，收的是黄忠' },
  // 第七章
  { id: 'yanghuai', name: '杨怀', chapter: 7, arc: 'shu', stage: 1, ctrl: 'moveset', tier: 'mid', clearKey: 'shu-1', off: '山道两侧伏兵与滚石（关卡层）' },
  { id: 'zhangren', name: '张任', chapter: 7, arc: 'shu', stage: 2, ctrl: 'moveset', tier: 'mid', clearKey: 'shu-2', off: '护住凤雏（护送）' },
  { id: 'liuzhang', name: '刘璋', chapter: 7, arc: 'shu', stage: 3, ctrl: 'moveset', tier: 'mid', clearKey: 'shu-3', props: { art: 'gate', name: '州府城门', count: 1, takenMul: .3, hpFrac: .16, lifeSec: 40, pin: true, front: true }, off: '冲车破城、巷战、州府（改随身城门：门在时刘璋闭城不出、减伤）' },
  // 第八章
  { id: 'xiahouyuan', name: '夏侯渊', chapter: 8, arc: 'hanzhong', stage: 2, ctrl: 'moveset', tier: 'late', clearKey: 'hanzhong-2', drop: ['号令援军'], hill: { everySec: 25, warnSec: 2, lastSec: 12, radius: 110, playerDmg: 1.2, bossGap: .7 }, off: '定军山两处山头（改高地圈）、黄忠在队可斩、8-2 双首领（单独出场）' },
  { id: 'zhanghe', name: '张郃', chapter: 8, arc: 'hanzhong', stage: 1, ctrl: 'moveset', tier: 'late', clearKey: 'hanzhong-1', drop: ['连环枪击'], off: '8-1 山头、12-1 断汲道（场地）；8-2 双首领（单独出场）' },
  { id: 'caocao', name: '曹操', chapter: 8, arc: 'hanzhong', stage: 3, ctrl: 'moveset', tier: 'gate', clearKey: 'hanzhong-3', drop: ['倚天剑斩'], hill: { everySec: 25, warnSec: 2, lastSec: 12, radius: 110, playerDmg: 1.2, bossGap: .7 }, off: '汉水两处山头（改高地圈）' },
  // 第九章
  { id: 'pangde', name: '庞德', chapter: 9, arc: 'xiangfan', stage: 2, ctrl: 'moveset', tier: 'late', clearKey: 'xiangfan-2', p2Boost: { speed: 1.3, dmg: 1.2 }, off: '水淹七军（场地）；抬棺狂暴并进二阶段' },
  { id: 'lvmeng', name: '吕蒙', chapter: 9, arc: 'xiangfan', stage: 3, ctrl: 'moveset', tier: 'late', clearKey: 'xiangfan-3', off: '麦城限时突围（不建）；伪装伏兵的白衣商旅图没画，伏兵先用现成吴兵（麦城合围）' },
  // 第十章
  { id: 'sunhuan', name: '孙桓', chapter: 10, arc: 'yiling', stage: 1, ctrl: 'moveset', tier: 'late', clearKey: 'yiling-1', drop: ['夷道死守'], add: { p1: [{ kind: 'flags', name: '吴军军旗', windupMs: 700, cd: 16000, dmg: 0, count: 3, radius: 170, hp: 90, takenMul: .5 }] }, off: '砍倒吴军军旗（关卡目标 → 随身插旗）' },
  { id: 'zhuran', name: '朱然', chapter: 10, arc: 'yiling', stage: 2, ctrl: 'moveset', tier: 'late', clearKey: 'yiling-2', props: { art: 'tent', name: '连营营帐', count: 3, takenMul: .4, hpFrac: .07, lifeSec: 40 }, off: '连营营帐（改随身营帐：在时减伤）' },
  { id: 'luxun', name: '陆逊', chapter: 10, arc: 'yiling', stage: 3, ctrl: 'moveset', tier: 'gate', clearKey: 'yiling-3', fireBand: { everySec: 14, warnMs: 1600, rows: 7, cols: 9, gap: 2, spacing: 115, stepMs: 260, r: 62, ratio: .12, p2Bands: 2 }, off: '整张图的格子火 / 风向（改全场定时火带：报风向、顺风扫过、留缺口）；没有招式框架，本模式新配（GAUNTLET_MOVES.luxun）' },
  // 第十一章
  { id: 'wutugu', name: '兀突骨', chapter: 11, arc: 'nanzheng', stage: 2, ctrl: 'moveset', tier: 'late', clearKey: 'nanzheng-2', props: { art: 'jar', name: '火油罐', count: 2, takenMul: .35, hpFrac: .06, lifeSec: 60, fireSec: 4, armor: '藤甲着火' }, off: '藤甲刀枪不入、唯惧火攻（改随身火油罐：罐在时几乎不受伤，打碎起火，踩进火或罐全碎 → 藤甲着火）' },
  { id: 'mangyachang', name: '忙牙长', chapter: 11, arc: 'nanzheng', stage: 1, ctrl: 'moveset', tier: 'late', clearKey: 'nanzheng-1', off: '泸水瘴气毒泉（场地；瘴气由招式自带）' },
  { id: 'zhurong', name: '祝融', chapter: 11, arc: 'nanzheng', stage: 3, ctrl: 'moveset', tier: 'late', clearKey: 'nanzheng-3', off: '孟获祝融双首领（单独出场）' },
  { id: 'menghuo', name: '孟获', chapter: 11, arc: 'nanzheng', stage: 3, ctrl: 'moveset', tier: 'gate', clearKey: 'nanzheng-3', rises: { count: 2, hp: .4, speed: 1.15, gap: .85 }, off: '七擒（改原地再起两次：不隐身、不无敌、不逃走，一次比一次快）' },
  // 第十二章
  { id: 'haozhao', name: '郝昭', chapter: 12, arc: 'beifa', stage: 2, ctrl: 'moveset', tier: 'late', clearKey: 'beifa-2', props: { art: 'tower', name: '陈仓箭楼', count: 2, takenMul: 1, hpFrac: .1, lifeSec: 45, volley: { everySec: 5, count: 3, r: 70, ratio: .06 } }, off: '陈仓城门（不建）；城头箭楼改随身箭楼（左右各一座，每 5 秒一轮箭雨）' },
  { id: 'simayi', name: '司马懿', chapter: 12, arc: 'beifa', stage: 3, ctrl: 'simayi', tier: 'gate', clearKey: 'beifa-3', off: '五丈原营垒（改随身营垒：登场在身边立 4 座，45 秒自倒）；假退诱敌保留（本模式开阔场地，不会引出场地）' },
];

export interface WaveScale { count: number }
/**
 * 每阵的杂兵（用户 11-21「兵种质量从第一章的兵到最后的兵，从弱到强」）：用哪一章哪一关的敌人定义——兵种、外形（含各章换色）、配比、精锐 / 特性兵照搬；
 * 强度按目标折算：本阵步卒生命 / 伤害折到 infHp / infDmg，其余兵种按同一倍率；再保证每类兵都不比上一阵弱（场景里逐阵取大）。
 * 名将生命 / 伤害按阵定目标（bossHp / bossDmg，不再用各章原值——后几章首领原值是按 50 级主将调的，从 0 开局打不动）。初值，交平衡。
 */
export interface GauntletTroops {
  arc: GauntletArc; stage: 1 | 2 | 3; name: string; infHp: number; infDmg: number; bossHp: number; bossDmg: number;
  /** 这几类兵换用另一章的图（只换外形：图 / 攻击图 / 染色，数值与配比照本章）。 */
  look?: { arc: GauntletArc; stage: 1 | 2 | 3; kinds: ReadonlyArray<'infantry' | 'shield' | 'archer' | 'cavalry' | 'elite'> };
}
export const GAUNTLET_TROOPS: readonly GauntletTroops[] = [
  { arc: 'huangjin', stage: 1, name: '黄巾流民 · 刀兵', infHp: 18, infDmg: 5, bossHp: 750, bossDmg: 11 }, // 11-21 实打（白板赵云）：第一阵名将原 900 要打两分钟
  { arc: 'hulao', stage: 1, name: '西凉军', infHp: 26, infDmg: 6, bossHp: 1300, bossDmg: 12 },
  { arc: 'qunxiong', stage: 2, name: '群雄杂军（凉州残部）', infHp: 34, infDmg: 6.5, bossHp: 1600, bossDmg: 12.5 }, // 实打：第三阵是白板的第一道坎（原 7 / 1800 / 13 时割草掉一半血、名将战被拖死）
  { arc: 'guandu', stage: 1, name: '袁军', infHp: 44, infDmg: 7.5, bossHp: 2300, bossDmg: 14 },
  { arc: 'chibi', stage: 1, name: '曹军水陆', infHp: 56, infDmg: 8.5, bossHp: 3000, bossDmg: 16 },
  { arc: 'jingnan', stage: 2, name: '荆南守军（山越弓手 · 藤牌兵）', infHp: 70, infDmg: 9.5, bossHp: 3800, bossDmg: 18 },
  { arc: 'shu', stage: 2, name: '益州守军（蜀弩手）', infHp: 86, infDmg: 10.5, bossHp: 4700, bossDmg: 20 },
  { arc: 'yiling', stage: 1, name: '吴军（解烦兵）', infHp: 104, infDmg: 11.5, bossHp: 5700, bossDmg: 22 },
  { arc: 'nanzheng', stage: 2, name: '南蛮（藤甲兵 · 象兵）', infHp: 124, infDmg: 13, bossHp: 6900, bossDmg: 25 },
  // 第十二章北伐的兵在战役里也是第五章那套曹军换色（武卒 / 连弩的图还没画，BEIFA_TROOP_SHEETS 指的文件不存在）：步卒 / 弓手借第八章魏军青州兵、魏弩手的图，和第五阵分得开
  { arc: 'beifa', stage: 1, name: '魏军精锐（青州兵 · 魏弩手）', infHp: 150, infDmg: 15, bossHp: 8500, bossDmg: 28, look: { arc: 'hanzhong', stage: 1, kinds: ['infantry', 'archer'] } },
];
/** 第 n 阵的杂兵与名将目标（无尽：固定用最后三阵的兵种轮换——吴 / 南蛮 / 魏，强度在第十阵上按 endless 每阵再乘）。 */
export function waveTroops(n: number): GauntletTroops {
  const T = GAUNTLET_TROOPS, i = Math.max(1, Math.floor(n));
  if (i <= T.length) return T[i - 1];
  const k = i - T.length, src = T[T.length - 3 + ((k - 1) % 3)], last = T[T.length - 1], E = GAUNTLET.endless;
  return { ...src, name: src.name + ' · 无尽', infHp: Math.round(last.infHp * E.hp ** k), infDmg: +(last.infDmg * E.dmg ** k).toFixed(1), bossHp: Math.round(last.bossHp * E.bossHp ** k), bossDmg: +(last.bossDmg * E.bossDmg ** k).toFixed(1) };
}
export const GAUNTLET = {
  /** 一局几阵；每阵割草多少秒后名将登场；斩将后清场几秒再弹战利品。 */
  waves: 10, mowSec: 55, clearSec: 10, // 从 0 开局（11-21）：割草 70 → 55 秒，十阵约 15～20 分钟
  /** 守关档有两位以上时，第 8～9 阵借一位守关名将的机会（每局最多一次）。 */
  gateBorrow: .35,
  /**
   * 每阵刷兵量（第 1～10 阵）：间隔除以 count、每次数量乘 count。杂兵 / 名将的生命与伤害改按每阵兵种表 GAUNTLET_TROOPS（11-21 从 0 开局）。初值，交平衡。
   */
  scale: [{ count: 1.0 }, { count: 1.1 }, { count: 1.2 }, { count: 1.3 }, { count: 1.4 }, { count: 1.5 }, { count: 1.6 }, { count: 1.7 }, { count: 1.8 }, { count: 2.0 }] as readonly WaveScale[],
  /** 无尽（第十阵以后）：每多一阵在第十阵上再乘（杂兵生命 / 伤害、名将生命 / 伤害、刷兵量）。刷兵量封顶 countCap（同屏敌人仍守 150 红线）。 */
  endless: { hp: 1.12, dmg: 1.06, count: 1.05, bossHp: 1.12, bossDmg: 1.05, countCap: 2.4 },
  /**
   * 从 0 开局（用户 11-21「名将挑战是从 0 开始 build 起来」，不继承主剧情）：主将 1 级、不带星图 / 兵装 / 信物 / 坐骑 / 武将谱 / 城建 / 部曲；局内经验只在本局。
   * xpRate：打怪经验倍率；softLevel：越级加价从这级起（每级所需经验 ×1.45，同战役软上限）。11-21 白板赵云实打前三阵每阵约 400～520 原始经验（Lv10 / 11 / 13），
   *   只靠倍率压到十阵 20 级会让前三阵少两级、更难过；改成前期照快、过 17 级明显变慢：十阵打完约 20～21 级（估算见 gauntlet-v1.md 第八轮）。无尽每阵软上限 +2。
   * 刷新：每局 freeRerolls 次免费，之后 rerollBase 起每次 +rerollStep 钱币；排除：每局 excludes 次（点一张卡，本局不再出现）。
   * clearHeal：斩将后清场休整回复的生命比例（白板主将没有战役里的回血来源，实打第 2 阵带着四成血进场容易被拖死；战利品「取其辎重」仍是回满）。
   * pickGapSec：两次升级三选一面板的最短间隔（关内秒；期间升的级攒着，开面板时连选），战役里是 50 秒，从 0 开局前期升级快，改短。
   */
  from0: { xpRate: 2.2, softLevel: 17, freeRerolls: 2, excludes: 1, rerollBase: 40, rerollStep: 30, pickGapSec: 12, clearHeal: .35 },
  /** 名将登场：带亲兵（各几个，围在他身边）；名将在场时杂兵刷新间隔 ×bossInterval、每次数量 ×bossBurst（刷新量减半）。 */
  guards: [['elite', 1], ['shield', 3]] as ReadonlyArray<readonly ['elite' | 'shield' | 'infantry', number]>,
  bossInterval: 2, bossBurst: .5,
  /** 割草段精锐：开阵 eliteFirst 秒后每 eliteEvery 秒一个。 */
  eliteFirst: 25, eliteEvery: 20,
  /**
   * 首领防拖（bossStall：首领阶段收益额度 / 久战震怒）在本模式关掉：阵数节奏已经限住了每阵的长度（不斩将就不进下一阵），
   * 再叠一层震怒会和阵数递增打架。名将不会因为拖得久变强。
   */
  stallOff: true,
  /** 战利品：收为副将（最多 followerMax 位，满了选替换谁）、取其辎重（随军钱币 legion.food + food + foodPerWave × 阵数，回满生命）、军资补位卡。 */
  followerMax: 3, loot: { food: 60, foodPerWave: 20 },
  /** 副将强度：按名将生涯（品质橙、模板按兵器）走随行系统；能用降将专属招式的（data/surrenderMoves）照样会用。 */
  followerQuality: 'orange' as const,
  /**
   * 结算奖励（存档货币，测试 / 调试战斗不给）：按斩了几位名将给钱币（world provisions，界面已改名「钱币」）与武学残卷（MasteryStore scrolls；「兵法残卷」改名后跟着改）。
   * 首次通关（斩满十位）再给一次大奖。初值，统筹合并前给用户看。
   */
  reward: { provisionsPerKill: 40, scrollsEvery: 2, firstClear: { provisions: 400, scrolls: 6 } },
  /** 存档键：最高连斩（单独一个键）、首次通关大奖领过没有。 */
  bestKey: 'im_gauntlet_best', firstClearKey: 'im_gauntlet_first_clear',
  /** 天下地图入口：第二章打完开放（同「挑战 · 虎牢关」）。dx/dy 是路线图（?map=v2）上相对虎牢关挑战点的位置；默认地图（V1）的点位写在 world/WorldNodes.ts。 */
  entry: { after: 'hulao', dx: 96, dy: -54 },
} as const;

/** 第 n 阵（从 1 起）的强度：第十阵以后按 endless 每阵再乘。 */
export function waveScale(n: number): WaveScale {
  const T = GAUNTLET.scale, E = GAUNTLET.endless, i = Math.max(1, Math.floor(n));
  if (i <= T.length) return T[i - 1];
  const k = i - T.length, last = T[T.length - 1];
  return { count: Math.min(E.countCap, last.count * E.count ** k) };
}

/** 能抽的名将：战役里打败过的（cleared 判断）；all = 开发测试存档全开。一个都没有时保底第一章张角。 */
/** 能抽的名将：全部 38 位（11-22 一开始就能玩：新玩家一个都没打败过，不再按战役进度限；clearKey 只留作「战役里是哪一关」的记录）。 */
export function gauntletPool(): GauntletBoss[] { return [...GAUNTLET_POOL]; }

/**
 * 本模式新配的招式框架（战役里没有的）：陆逊 10-3 原来是场景层的火势蔓延，这里配两招（羽扇纵火落点、八阵图迷踪），
 * 第三招是场景层的全场火带（GauntletBoss.fireBand）。初值，交平衡。
 */
export const GAUNTLET_MOVES: Record<string, BossMovesetDef> = {
  luxun: {
    id: 'luxun', name: '陆逊', phaseAt: .5,
    p1: { name: '火烧连营', caption: '羽扇纵火 · 八阵图迷踪 · 看风向躲火带', gapMs: 2800, speedMul: .9, moves: [
      { kind: 'volley', name: '羽扇纵火', windupMs: 1000, cd: 5200, dmg: 1.1, count: 5, r: 62, spread: 220, fx: 'fire' },
      { kind: 'vanish', name: '八阵图迷踪', windupMs: 700, cd: 9000, dmg: 1.2, hideMs: 1200, r: 110, arc: Math.PI * .8 },
    ] },
    p2: { name: '火势已成', caption: '纵火更勤 · 火带两道', gapMs: 2300, speedMul: .95, moves: [
      { kind: 'volley', name: '羽扇纵火', windupMs: 900, cd: 4400, dmg: 1.2, count: 7, r: 62, spread: 260, fx: 'fire' },
      { kind: 'vanish', name: '八阵图迷踪', windupMs: 650, cd: 8000, dmg: 1.3, hideMs: 1100, r: 110, arc: Math.PI * .8 },
    ] },
  },
};

/** 进到第 wave 阵：前 1～3、中 4～6、后 7～9、守关第 10 阵。 */
export function waveTier(i: number, n: number = GAUNTLET.waves): GauntletTier { return i >= n - 1 ? 'gate' : i < 3 ? 'front' : i < 6 ? 'mid' : 'late'; }
/** 某段缺人时的借人顺序：本段 → 往前（守关 → 后 → 中 → 前）→ 往后（不借守关档）。 */
function tierOrder(t: GauntletTier): GauntletTier[] { const k = GAUNTLET_TIERS.indexOf(t); return [...GAUNTLET_TIERS.slice(0, k + 1).reverse(), ...GAUNTLET_TIERS.slice(k + 1).filter(x => x !== 'gate')]; }
/**
 * 一局十阵的名将顺序（四段制，适配表 gauntlet-roster.md）：第 1～3 阵前段、4～6 中段、7～9 后段、第 10 阵守关档；
 * 守关档有两位以上时，第 8～9 阵每局最多借一位守关名将（机会 GAUNTLET.gateBorrow），第十阵仍留一位不同的守关。
 * 段里没有打败过的名将就按 tierOrder 借；尽量不重复，池子不够时轮着重复（不连着两阵同一位）。
 */
export function pickBosses(pool: readonly GauntletBoss[], rand: () => number = Math.random, n: number = GAUNTLET.waves): GauntletBoss[] {
  const out: GauntletBoss[] = [], used = new Set<string>(); if (!pool.length) return out;
  const by = (t: GauntletTier) => pool.filter(b => b.tier === t), gateN = by('gate').length;
  let gateBorrowed = false;
  for (let i = 0; i < n; i++) {
    const last = out[out.length - 1];
    let tier = waveTier(i, n);
    // 借守关：借走一位后第十阵还得留一位不同的守关（随行护卫和他本人算一对，借了一方另一方也不能出）
    const canBorrow = (g: GauntletBoss) => !used.has(g.id) && g !== last && by('gate').some(o => o !== g && !used.has(o.id) && o.escort?.id !== g.id && g.escort?.id !== o.id);
    if ((i === n - 3 || i === n - 2) && !gateBorrowed && gateN >= 2 && by('gate').some(canBorrow) && rand() < GAUNTLET.gateBorrow) tier = 'gate';
    let pick: GauntletBoss[] = [];
    if (tier === 'gate' && i < n - 1) pick = by('gate').filter(canBorrow);
    else for (const t of tierOrder(tier)) { pick = by(t).filter(b => !used.has(b.id) && b !== last); if (pick.length) break; }
    if (!pick.length) for (const t of tierOrder(tier)) { pick = by(t).filter(b => b !== last); if (pick.length) break; }
    if (!pick.length) pick = pool.filter(b => b !== last);
    if (!pick.length) pick = [...pool];
    const b = pick[Math.floor(rand() * pick.length) % pick.length];
    if (b.tier === 'gate' && i < n - 1) gateBorrowed = true;
    out.push(b); used.add(b.id);
    // 随行护卫和他本人同一局不都出现（韩玄带黄忠、董卓带吕布）：抽了一方，另一方算用过
    if (b.escort) used.add(b.escort.id); for (const o of pool) if (o.escort?.id === b.id) used.add(o.id);
  }
  return out;
}
/** 无尽：全池循环——不和上一位相同，尽量避开最近斩过的（池子大小 − 1 位以内）。 */
export function endlessBoss(pool: readonly GauntletBoss[], last: GauntletBoss | null, rand: () => number = Math.random, recent: readonly GauntletBoss[] = []): GauntletBoss {
  const avoid = new Set(recent.slice(-Math.max(0, pool.length - 1)).map(b => b.id));
  let from = pool.filter(b => b !== last && !avoid.has(b.id));
  if (!from.length) from = pool.filter(b => b !== last);
  if (!from.length) from = [...pool];
  return from[Math.floor(rand() * from.length) % from.length];
}
/** 结算奖励：斩了 kills 位名将；firstClear = 这一局是首次通关。 */
export function gauntletReward(kills: number, firstClear: boolean): { provisions: number; scrolls: number } {
  const R = GAUNTLET.reward, k = Math.max(0, Math.floor(kills));
  return { provisions: k * R.provisionsPerKill + (firstClear ? R.firstClear.provisions : 0), scrolls: Math.floor(k / R.scrollsEvery) + (firstClear ? R.firstClear.scrolls : 0) };
}
/** 最高连斩记录（存档单独一个键；开发测试存档 ?dev=1 用另一个键 _test，不碰正式记录）：读 / 写（只在超过时写，返回是否新纪录）。 */
export function bestKey(test = false): string { return GAUNTLET.bestKey + (test ? '_test' : ''); }
export function readGauntletBest(test = false): { kills: number; wave: number; ms: number } {
  try {
    const old=JSON.parse(localStorage.getItem(bestKey(test))??'null');
    const modes=JSON.parse(localStorage.getItem('im_gauntlet_modes_v1'+(test?'_test':''))??'{}');
    return [old,...Object.values(modes)].reduce((best,v)=>v && typeof v.kills==='number' && v.kills>best.kills ? {kills:v.kills,wave:v.wave??v.kills,ms:v.ms??0}:best,{kills:0,wave:0,ms:0});
  } catch { return {kills:0,wave:0,ms:0}; }
}
export function writeGauntletBest(kills: number, wave: number, ms: number, test = false): boolean {
  const b = readGauntletBest(test); if (kills <= b.kills) return false;
  try { localStorage.setItem(bestKey(test), JSON.stringify({ kills, wave, ms, at: Date.now() })); } catch { return false; }
  return true;
}
