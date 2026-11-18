import type {ChapterDef} from './chapters';
import {thirdBattle,type ThirdStage} from './thirdChapter';
import {withV2Sheets} from '../systems/ArtStyle';

/**
 * 第十二章 · 北伐（最终章，建兴六年 ~ 十二年）。三关沿用第三章战场与首领招式框架：
 * 街亭（张郃，扼守当道、守住水源）→ 陈仓（郝昭守城：先破城门，城头箭楼放箭雨）→ 五丈原（司马懿，最终首领，三阶段，SimayiBoss）。
 * 打赢五丈原 → 结局（EndingScene）：按占城情况分「天下一统 / 三分天下」，主公不是刘备时改写；麒麟阁生成本局编年史。
 * 初值，交平衡会话；开发期不做老存档兼容（用户 2026-11-17）。
 */
export type BeifaStage = 1 | 2 | 3;
export type BeifaBossId = 'zhanghe' | 'haozhao' | 'simayi';
export interface BeifaStageInfo { stage: BeifaStage; name: string; boss: string; id: BeifaBossId; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage | 4; skills: [string, string, string]; signature?: string; signatureId?: 'caochun' | 'caimao' | 'caoren' }

export const BEIFA_STAGES: readonly BeifaStageInfo[] = [
  { stage: 1, name: '街亭', boss: '张郃', id: 'zhanghe', tag: '当道扎营', feature: '守住水源 · 张郃断汲道', story: '丞相出祁山，陇右三郡响应。街亭为咽喉之地——须当道扎营，守住汲水之路。', behavior: 2, scenery: 1, skills: ['连环枪击', '突刺追击', '伏兵包围'] },
  { stage: 2, name: '陈仓', boss: '郝昭', id: 'haozhao', tag: '攻城', feature: '先破城门 · 城头箭楼放箭雨', story: '再出散关，围陈仓。守将郝昭只千余人，筑城坚守，云梯冲车皆不能克。', behavior: 3, scenery: 4, skills: ['旗令轰击', '亲军护驾', '弓阵齐射'] },
  { stage: 3, name: '五丈原', boss: '司马懿', id: 'simayi', tag: '最终之战', feature: '坚守不出 → 出营决战 → 天象异变', story: '屯田渭滨，与司马懿隔渭对垒。司马懿坚壁不出——这是最后一战。', behavior: 1, scenery: 2, skills: ['调兵合围', '假退诱敌', '落雷阵'] },
];
/** 首领图 v1 回退（借旧首领图）；v2 键在 ArtStyle.ART_V2_FILES 的 beifa_*（正式图到之前借用现有 v2 图过渡）。 */
export const BEIFA_SHEETS: Record<string, string> = {
  beifa_zhanghe: 'assets/phase23/zhangxiu.png', beifa_haozhao: 'assets/guandu/chunyuqiong.png', beifa_simayi: 'assets/phase23/lijue.png',
};
export const beifaTexture = (id: string): string => 'beifa_' + id;

const WAVE_NAMES: string[][] = [
  ['街亭当道', '魏军断水', '张郃围山'],
  ['散关北出', '陈仓城下', '郝昭登城'],
  ['渭水南岸', '魏营森严', '司马懿出营'],
];
/** 新兵种 v2 图集（BeifaGameScene.preload 按需加载）。图到之后再把这 4 个键加进 ArtStyle.ART_V2_FILES / V2_TROOP_KEYS；没加之前沿用换色。 */
export const BEIFA_TROOP_SHEETS = { wuzu: ['beifa_wuzu_walk_sheet', 'beifa_wuzu_attack_sheet'], liannu: ['beifa_liannu_walk_sheet', 'beifa_liannu_attack_sheet'] } as const;
/** 新兵种（换色过渡）：魏武卒（重甲步兵，最耐打）、连弩营（连射弩兵）。 */
export const BEIFA_TROOPS = {
  wuzu: { hp: 66, speed: 72, damage: 11, tint: 0x8c9bb8 },
  liannu: { hp: 20, speed: 58, damage: 8, tint: 0x7d8fa8 },
} as const;

/**
 * 街亭（第一关）水源：场上 WATER.count 处汲水点，站上去读条占住；一处都没占着时「断水」，主将每秒掉最大生命 drainRatio。
 * 张郃每 cutEverySec 秒派一队兵去夺一处汲水点（占着的会被夺回成无主）。
 */
export const WATER = { count: 2, radius: 80, captureSec: 2.5, drainRatio: .012, graceSec: 10, cutEverySec: 26, cutSize: 6 } as const;
/** 陈仓（第二关）攻城：城门生命、箭楼数与生命、每座箭楼放箭雨的间隔、落点数、半径、预警、伤害（主将最大生命比例 / 部曲）。 */
export const CHENCANG = { gateHp: 1600, gateY: -360, wallHalf: 2400, gateHalf: 88, segW: 230, towers: 2, towerHp: 420, towerGap: 380, volleyEverySec: 6, volleyPoints: 3, volleyR: 70, warnMs: 1300, playerRatio: .06, allyDamage: 14 } as const;
/**
 * 五丈原 · 司马懿（最终首领，初值）：
 *  ① 坚守不出：营垒 forts 顶环绕司马懿，营垒在时他不动、受伤 ×fortTakenMul；伏兵箭阵 volleyEverySec 秒一轮，伏兵 ambushEverySec 秒一次。
 *  ② 出营决战（营垒尽破）：调兵合围 / 假退诱敌 / 落雷阵轮流，间隔 gapMs。
 *  ③ 天象异变（生命 ≤ phase3At）：夜空，将星坠落（陨星）每 meteorEveryMs 一颗，招式间隔 gapMs3。
 */
export const SMY = {
  forts: 4, fortRadius: 230, fortHp: 520, fortTakenMul: .1, volleyEverySec: 7, volleyPoints: 5, volleyR: 72, volleyWarnMs: 1300, ambushEverySec: 13, ambushSize: 4,
  gapMs: 3200, gapMs3: 2200, phase3At: .35,
  surround: { count: 8, radius: 270, warnMs: 900 },
  feint: { ms: 1500, speedMul: 2.2, arrows: 5, warnMs: 1200, r: 70 },
  thunder: { count: 6, radius: 170, r: 82, warnMs: 1500 },
  meteorEveryMs: 2300, meteorR: 105, meteorWarnMs: 1700, meteorRatio: .1,
  playerRatio: .06, allyDamage: 16,
} as const;
/** 结局：占城数 ≥ 全部城池 × unifyRatio → 天下一统，否则三分天下。 */
export const ENDING = { unifyRatio: .5 } as const;

export function beifaBattle(stage: BeifaStage): ChapterDef {
  const d = BEIFA_STAGES[stage - 1], base = thirdBattle(d.behavior), T = BEIFA_TROOPS;
  const infantry = withV2Sheets({ ...base.enemies.infantry, hp: T.wuzu.hp, speed: T.wuzu.speed, damage: T.wuzu.damage, tint: T.wuzu.tint }, BEIFA_TROOP_SHEETS.wuzu);
  const archer = withV2Sheets({ ...base.enemies.archer, hp: T.liannu.hp, speed: T.liannu.speed, damage: T.liannu.damage, tint: T.liannu.tint }, BEIFA_TROOP_SHEETS.liannu);
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `12-${stage} ${d.name}`, label: `第十二章 · 北伐 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id,
    pickEnemy: (t: number) => { const r = Math.random(); return r < .3 ? 'archer' : r < .55 ? 'infantry' : base.pickEnemy(t); },
    enemies: { ...base.enemies, infantry, archer, boss: { ...base.enemies.boss, texture: beifaTexture(d.id), hp: [4000, 4300, 6200][stage - 1], speed: [60, 40, 50][stage - 1], damage: [20, 21, 23][stage - 1] } },
    victoryTitle: d.boss + (stage === 3 ? '退兵' : '败退'), victoryText: stage === 3 ? '五丈原决胜 · 北伐功成' : d.name + '告捷 · 进入军营休整',
  };
}
