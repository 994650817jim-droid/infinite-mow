import type {ChapterDef} from './chapters';
import {thirdBattle,type ThirdStage} from './thirdChapter';

/**
 * 第五章 · 赤壁之战（官渡之后，建安十三年）。三关沿用第三章的战场框架与首领招式框架：
 * behavior = 首领招式组（1 铁骑冲锋 / 号令 / 横扫，2 连枪 / 突刺 / 伏兵，3 旗令 / 亲军 / 弓阵），scenery = 战场地貌组。
 */
export type ChibiStage = 1 | 2 | 3;
export interface ChibiStageInfo { stage: ChibiStage; name: string; boss: string; id: 'caochun' | 'caimao' | 'caoren'; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage; skills: [string, string, string]; signature: string }
export const CHIBI_STAGES: readonly ChibiStageInfo[] = [
  { stage: 1, name: '长坂突围', boss: '曹纯', id: 'caochun', tag: '虎骑追袭', feature: '虎豹骑冲锋与号令', story: '曹军虎豹骑一日一夜追至长坂。护住百姓辎重，杀出重围。', behavior: 1, scenery: 1, skills: ['虎豹冲锋', '号令虎骑', '马刀横扫'], signature: '虎豹围猎' },
  { stage: 2, name: '赤壁鏖兵', boss: '蔡瑁', id: 'caimao', tag: '火攻水寨', feature: '水军旗令与弓阵', story: '东南风起，火船顺流。趁夜焚其连环，击破荆州水军都督。', behavior: 3, scenery: 2, skills: ['旗令轰击', '水军护驾', '楼船弓阵'], signature: '楼船箭雨' },
  { stage: 3, name: '江陵夺城', boss: '曹仁', id: 'caoren', tag: '破阵夺城', feature: '坚阵连枪与伏兵', story: '曹仁据江陵坚守，枪阵森严。破其阵势，夺取南郡。', behavior: 2, scenery: 3, skills: ['连环枪阵', '突阵追击', '伏兵四起'], signature: '八门金锁' },
];
export const CHIBI_SHEETS: Record<string, string> = { chibi_caochun: 'assets/chibi/caochun.png', chibi_caimao: 'assets/chibi/caimao.png', chibi_caoren: 'assets/chibi/caoren.png' };

const WAVE_NAMES: string[][] = [
  ['当阳道上', '虎豹骑追至', '长坂坡前', '曹纯督阵'],
  ['江上烽火', '水寨弓阵', '连环战船', '蔡瑁号令'],
  ['江陵城下', '坚阵连枪', '城门伏兵', '曹仁出城'],
];
/** 第五章战斗：以对应招式组的第三章战斗为底，换首领、名称与数值（比第三章略强）。 */
export function chibiBattle(stage: ChibiStage): ChapterDef {
  const d = CHIBI_STAGES[stage - 1], base = thirdBattle(d.behavior);
  return {
    ...base,
    // 波次名换成本关史事（波数与开始时间沿用招式组对应的第三章关）
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `5-${stage} ${d.name}`, label: `第五章 · 赤壁之战 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id,
    enemies: { ...base.enemies, boss: { ...base.enemies.boss, texture: 'chibi_' + d.id, hp: [2300, 2500, 2800][stage - 1], speed: [64, 40, 42][stage - 1], damage: [15, 14, 15][stage - 1] } },
    victoryTitle: d.boss + '败退', victoryText: stage === 3 ? '江陵易帜 · 赤壁之战告捷 · 三分天下之势已成' : d.name + '告捷 · 进入军营休整',
  };
}
