import type {ChapterDef} from './chapters';
import {thirdBattle,type ThirdStage} from './thirdChapter';

/**
 * 第八章 · 汉中之战（建安二十三 ~ 二十四年）。三关沿用第三章战场与首领招式框架（同第五、六章写法）：
 * 阳平关（张郃）→ 定军山（夏侯渊，黄忠在队时被斩将加成）→ 汉水（曹操，章末首领，两阶段：虎豹骑冲阵 → 鸡肋退兵）。
 * 独有玩法「夺高地」（HanzhongHills）：地图上 1~2 个山头，站上去读条占领，我方伤害、射程提高；敌军会来反夺。
 * 初值，交平衡会话；开发期不做老存档兼容（用户 2026-11-17）。
 */
export type HanzhongStage = 1 | 2 | 3;
export type HanzhongBossId = 'zhanghe' | 'xiahouyuan' | 'caocao';
export interface HanzhongStageInfo { stage: HanzhongStage; name: string; boss: string; id: HanzhongBossId; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage | 4; skills: [string, string, string]; signature?: string; signatureId?: 'caochun' | 'caimao' | 'caoren';
  /** 本关山头数。 */ hills: 1 | 2 }

export const HANZHONG_STAGES: readonly HanzhongStageInfo[] = [
  { stage: 1, name: '阳平关', boss: '张郃', id: 'zhanghe', tag: '关前对峙', feature: '一处山头 · 张郃枪阵', story: '刘备进军汉中，屯兵阳平关下。张郃据险而守，先夺关前高地，压住敌阵。', behavior: 2, scenery: 1, skills: ['连环枪击', '突刺追击', '伏兵包围'], hills: 1 },
  { stage: 2, name: '定军山', boss: '夏侯渊', id: 'xiahouyuan', tag: '居高临下', feature: '两处山头 · 黄忠在队可斩夏侯渊', story: '法正献策：抢占定军山，居高临下。夏侯渊率军来争，正是破敌之时。', behavior: 1, scenery: 2, skills: ['疾行突袭', '号令援军', '军刀横扫'], hills: 2 },
  { stage: 3, name: '汉水', boss: '曹操', id: 'caocao', tag: '鸡肋', feature: '两处山头 · 曹操两阶段', story: '曹操亲率大军自长安来争汉中。两军隔汉水相持，粮道不继，曹军进退两难。', behavior: 1, scenery: 4, skills: ['虎豹冲阵', '号令诸军', '倚天剑斩'], signature: '虎豹骑冲阵', signatureId: 'caochun', hills: 2 },
];
/** 首领图：正式 v2 图到之前借用现有首领 v2 图过渡（ArtStyle.ART_V2_FILES 的 hanzhong_* 键同步改）。 */
export const HANZHONG_SHEETS: Record<string, string> = {
  hanzhong_zhanghe: 'assets/phase23/zhangxiu.png', hanzhong_xiahouyuan: 'assets/guandu/wenchou.png', hanzhong_caocao: 'assets/chibi/caoren.png',
};
export const hanzhongTexture = (id: string): string => 'hanzhong_' + id;

const WAVE_NAMES: string[][] = [
  ['关前斥候', '张郃枪阵', '张郃出关'],
  ['定军山下', '夏侯渊来争', '夏侯渊督战'],
  ['汉水北岸', '虎豹骑南下', '曹操亲至'],
];
/** 新兵种（v2 图到之前换色过渡）：青州兵（耐打的重步）、魏军强弩手（射得远的弩兵）。 */
export const HANZHONG_TROOPS = {
  qingzhou: { hp: 52, speed: 74, damage: 9, tint: 0x8fa3c4 },
  crossbow: { hp: 16, speed: 56, damage: 9, tint: 0x6f86a8 },
} as const;
/** 夺高地（初值）。 */
export const HILL = { radius: 96, captureSec: 3, contestNear: 2, recaptureSec: 4, raidEverySec: 22, raidSize: 6, damageMul: 1.2, rangeMul: 1.2 } as const;
/** 定军山：黄忠在队（主将或随行）时夏侯渊受到的伤害倍率。 */
export const DINGJUN_HUANGZHONG_MUL = 1.5;

export function hanzhongBattle(stage: HanzhongStage): ChapterDef {
  const d = HANZHONG_STAGES[stage - 1], base = thirdBattle(d.behavior), T = HANZHONG_TROOPS;
  const infantry = { ...base.enemies.infantry, hp: T.qingzhou.hp, speed: T.qingzhou.speed, damage: T.qingzhou.damage, tint: T.qingzhou.tint };
  const archer = { ...base.enemies.archer, hp: T.crossbow.hp, speed: T.crossbow.speed, damage: T.crossbow.damage, tint: T.crossbow.tint };
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `8-${stage} ${d.name}`, label: `第八章 · 汉中之战 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id,
    pickEnemy: (t: number) => { const r = Math.random(); return r < .25 ? 'archer' : r < .35 ? 'cavalry' : base.pickEnemy(t); },
    enemies: { ...base.enemies, infantry, archer, boss: { ...base.enemies.boss, texture: hanzhongTexture(d.id), hp: [3000, 3200, 3800][stage - 1], speed: [46, 62, 48][stage - 1], damage: [17, 18, 19][stage - 1] } },
    victoryTitle: d.boss + '败退', victoryText: stage === 3 ? '曹操退兵 · 汉中尽归 · 汉中之战告捷' : d.name + '告捷 · 进入军营休整',
  };
}
