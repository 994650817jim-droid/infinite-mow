import type {ChapterDef} from './chapters';
import {thirdBattle,type ThirdStage} from './thirdChapter';
import {withV2Sheets} from '../systems/ArtStyle';

/**
 * 第十章 · 夷陵之战（章武元年 ~ 二年）。三关沿用第三章战场与首领招式框架（同第六、八章写法）：
 * 猇亭（孙桓，我军推进）→ 连营（朱然，拆东吴营帐，营帐尽破则敌将出营）→ 火烧连营（陆逊，章末首领，形势反转）。
 * 独有玩法「火势蔓延」（YilingFire）：第三关陆逊放火，风向先有预警，火顺风一格格烧过去，烧到的地方敌我都掉血；
 * 我军营帐连成一片，火烧到营帐会猛地窜开。要边打边躲、往上风口退。火焰用手绘序列帧（fx_ground_fire）。
 * 初值，交平衡会话；开发期不做老存档兼容（用户 2026-11-17）。
 */
export type YilingStage = 1 | 2 | 3;
export type YilingBossId = 'sunhuan' | 'zhuran' | 'luxun';
export interface YilingStageInfo { stage: YilingStage; name: string; boss: string; id: YilingBossId; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage | 4; skills: [string, string, string]; signature?: string; signatureId?: 'caochun' | 'caimao' | 'caoren' }

export const YILING_STAGES: readonly YilingStageInfo[] = [
  { stage: 1, name: '猇亭', boss: '孙桓', id: 'sunhuan', tag: '顺江东下', feature: '我军推进 · 砍倒吴军军旗', story: '为雪荆州之耻，先主亲率大军顺江东下，连破吴军前哨，兵锋直抵猇亭。', behavior: 1, scenery: 1, skills: ['疾行突袭', '号令援军', '军刀横扫'] },
  { stage: 2, name: '连营', boss: '朱然', id: 'zhuran', tag: '拆营破寨', feature: '拆掉吴军营帐 · 营帐尽破敌将出营', story: '吴军依山结寨，营帐相连。拆其营寨，逼朱然出营决战。', behavior: 2, scenery: 2, skills: ['连环枪击', '突刺追击', '伏兵包围'] },
  { stage: 3, name: '火烧连营', boss: '陆逊', id: 'luxun', tag: '火势蔓延', feature: '陆逊放火 · 看风向躲火线', story: '我军连营七百里，暑热移营林中。陆逊等的就是这一刻——东南风起，一把火烧了过来。', behavior: 3, scenery: 4, skills: ['旗令轰击', '伏兵四起', '弓阵齐射'] },
];
/** 首领图 v1 回退（v1 无专属图，借旧首领图）；v2 键在 ArtStyle.ART_V2_FILES 的 yiling_*（正式图到之前也借用现有 v2 图过渡）。 */
export const YILING_SHEETS: Record<string, string> = {
  yiling_sunhuan: 'assets/phase23/zhangxiu.png', yiling_zhuran: 'assets/guandu/chunyuqiong.png', yiling_luxun: 'assets/phase23/lijue.png',
};
export const yilingTexture = (id: string): string => 'yiling_' + id;

const WAVE_NAMES: string[][] = [
  ['巫峡东出', '吴军前哨', '孙桓据守'],
  ['夷道营寨', '连营相望', '朱然出营'],
  ['林间连营', '东南风起', '陆逊纵火'],
];
/** 新兵种 v2 图集（YilingGameScene.preload 按需加载）。解烦兵已有图（ArtStyle 已登记）；江东弓弩手图到之后再把它的 2 个键加进 ArtStyle.ART_V2_FILES / V2_TROOP_KEYS，没加之前沿用换色。 */
export const YILING_TROOP_SHEETS = { jiefan: ['yiling_jiefan_walk_sheet', 'yiling_jiefan_attack_sheet'], crossbow: ['yiling_wu_crossbow_walk_sheet', 'yiling_wu_crossbow_attack_sheet'] } as const;
/** 新兵种（v1 / 图未到时换色过渡）：解烦兵（孙吴精锐重步，耐打）、江东弓弩手（射得远）。 */
export const YILING_TROOPS = {
  jiefan: { hp: 58, speed: 76, damage: 10, tint: 0xc0706a },
  crossbow: { hp: 18, speed: 58, damage: 10, tint: 0xb08a60 },
} as const;

/** 连营（第二关）：吴军营帐数、离主将的距离、营帐生命。 */
export const CAMPS = { count: 6, ringMin: 420, ringMax: 760, hp: 260 } as const;
/**
 * 火势蔓延（第三关，初值）：
 *  - 格子边长 cell；每次放火先预警 warnSec 秒（风向箭头 + 起火点），起火点在主将上风 upwindMin~Max 处，横向排开 points 个。
 *  - 每 spreadMs 毫秒，烧着的格子往下风方向引燃（正前 forward、斜前 diagonal、侧面 side 的概率），最多 maxGen 代。
 *  - 每格烧 burnMs 毫秒后成灰（不再复燃）；每 tickMs 一跳：敌兵 enemyDamage、主将最大生命 playerRatio、部曲同比例。首领不受火。
 *  - 火烧到营帐：营帐塌，周围 tentBurst 格一起窜火。
 *  - 放火间隔 everySec（陆逊出阵后 bossEverySec，半血后 rageEverySec），第一次在开战 firstSec 秒。
 */
export const FIRE = {
  cell: 72, warnSec: 2.6, points: 3, upwindMin: 230, upwindMax: 300, pointGap: 230,
  spreadMs: 420, forward: .92, diagonal: .38, side: .06, maxGen: 15,
  burnMs: 4200, tickMs: 500, enemyDamage: 9, playerRatio: .03, maxCells: 180,
  tentBurst: 2, everySec: 20, bossEverySec: 14, rageEverySec: 10, firstSec: 12,
} as const;
/** 第三关我军营帐（连营）：几排、每排几顶、间距。 */
export const SHU_CAMP = { rows: 3, perRow: 4, gapX: 230, gapY: 200 } as const;

export function yilingBattle(stage: YilingStage): ChapterDef {
  const d = YILING_STAGES[stage - 1], base = thirdBattle(d.behavior), T = YILING_TROOPS;
  const infantry = withV2Sheets({ ...base.enemies.infantry, hp: T.jiefan.hp, speed: T.jiefan.speed, damage: T.jiefan.damage, tint: T.jiefan.tint }, YILING_TROOP_SHEETS.jiefan);
  const archer = withV2Sheets({ ...base.enemies.archer, hp: T.crossbow.hp, speed: T.crossbow.speed, damage: T.crossbow.damage, tint: T.crossbow.tint }, YILING_TROOP_SHEETS.crossbow);
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `10-${stage} ${d.name}`, label: `第十章 · 夷陵之战 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id,
    pickEnemy: (t: number) => { const r = Math.random(); return r < .28 ? 'archer' : r < .5 ? 'infantry' : base.pickEnemy(t); },
    enemies: { ...base.enemies, infantry, archer, boss: { ...base.enemies.boss, texture: yilingTexture(d.id), hp: [3400, 3700, 4400][stage - 1], speed: [56, 44, 46][stage - 1], damage: [18, 19, 20][stage - 1] } },
    victoryTitle: d.boss + '败退', victoryText: stage === 3 ? '火海突围 · 退守白帝 · 夷陵之战终' : d.name + '告捷 · 进入军营休整',
  };
}
