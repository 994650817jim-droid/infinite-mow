import {getSishuiEncounter} from './sishui';
import type {ChapterDef} from './chapters';
import type {EnemyDef} from './enemies';
import {yuanKey} from '../systems/YuanPalette';
import {tuneStage} from './stageTuning';

/** 第四章 · 官渡之战（公元200年）。见 CHAPTER4_PLAN.md。 */
export type GuanduStage = 1 | 2 | 3;
/** 已实装关数：P3 起三关全部开放。 */
export const GUANDU_PLAYABLE = 3;
export interface GuanduStageInfo {
  stage: GuanduStage; name: string; boss: string; id: string;
  /** 首领动作图集 key（P4：ChatGPT 生成的独立图集，见 public/assets/guandu/）。 */
  atlas: string; story: string; tag: string; feature: string;
}
export const GUANDU_STAGES: readonly GuanduStageInfo[] = [
  { stage: 1, name: '白马解围', boss: '颜良', id: 'yanliang', atlas: 'guandu_yanliang', story: '袁军围白马，颜良当先。冲开围城之军，斩将解围。', tag: '解围破阵', feature: '突进斩将与回旋大刀' },
  { stage: 2, name: '延津诱敌', boss: '文丑', id: 'wenchou', atlas: 'guandu_wenchou', story: '辎重散于道，文丑来劫。先焚辎重，再斩文丑。', tag: '诱敌追击', feature: '回马枪、骑射与劫粮' },
  { stage: 3, name: '乌巢焚粮', boss: '淳于琼', id: 'chunyuqiong', atlas: 'guandu_chunyuqiong', story: '夜袭乌巢，火烧袁军屯粮。粮仓每焚一座，袁军军心动摇。', tag: '焚粮决胜', feature: '守粮阵、弓阵与投石' },
];
/** 第四章首领图集文件（512×1024，32 帧 128×128；tools/prepare-guandu-art.mjs 生成）。 */
export const GUANDU_ATLAS_FILES: Record<string, string> = { guandu_yanliang: 'assets/guandu/yanliang.png', guandu_wenchou: 'assets/guandu/wenchou.png', guandu_chunyuqiong: 'assets/guandu/chunyuqiong.png' };
/** 河北袁军：沿用西凉兵动作图，红色军服换成袁军土黄（YuanPalette 生成 yuan_* 贴图；动作与造型仍为复用，非独立原画）。 */
export function guanduYuanSourceKeys(): string[] { return [...new Set(Object.values(getSishuiEncounter().enemies).map(d => d.walkVisual?.texture).filter((k): k is string => !!k))]; }

/** 第四章关卡（已套用 stageTuning 的节奏与小怪成长）。 */
export function guanduBattle(stage: GuanduStage): ChapterDef { return tuneStage(rawGuanduBattle(stage), 'guandu', stage); }
function rawGuanduBattle(stage: GuanduStage): ChapterDef {
  const base = getSishuiEncounter(), d = GUANDU_STAGES[stage - 1];
  const tinted = Object.fromEntries(Object.entries(base.enemies).map(([k, def]) => [k, k === 'boss' || !def.walkVisual ? def : { ...def, walkVisual: { ...def.walkVisual, texture: yuanKey(def.walkVisual.texture) } }])) as Record<string, EnemyDef>;
  const last = stage >= GUANDU_PLAYABLE;
  return {
    ...base,
    name: `4-${stage} ${d.name}`, label: `第四章 · 官渡之战 · ${d.name}`, description: d.story, bossName: d.boss,
    bossStyle: d.id as ChapterDef['bossStyle'], westStage: 3,
    waves: (stage === 1 ? ['袁军前锋', '白马围城', '颜良出阵'] : stage === 2 ? ['辎重疑兵', '争抢辎重', '文丑出阵'] : ['乌巢外营', '焚仓', '淳于琼出阵']).map((name, i) => ({ name, start: i * 45 })),
    recruitWaves: [1, 2],
    enemies: { ...base.enemies, ...tinted, boss: { ...base.enemies.boss, texture: d.atlas, walkVisual: undefined, attackVisual: undefined, hp: [2000, 2000, 2400][stage - 1], speed: [52, 60, 34][stage - 1], damage: [14, 13, 13][stage - 1] } } as ChapterDef['enemies'],
    // 4-1 攻城步兵与刀盾为主，少量弓骑
    pickEnemy: t => { const r = Math.random(); return stage === 1 ? (t < 30 ? 'infantry' : r < .42 ? 'infantry' : r < .64 ? 'shield' : r < .84 ? 'archer' : 'cavalry') : stage === 2 ? (r < .4 ? 'cavalry' : r < .7 ? 'infantry' : r < .9 ? 'archer' : 'elite') : (r < .3 ? 'shield' : r < .65 ? 'archer' : r < .88 ? 'infantry' : 'elite'); },
    victoryTitle: d.boss + '授首',
    victoryText: stage === 3 ? '袁军溃败 · 官渡告捷' : last ? d.name + '告捷 · 后续战报筹备中' : d.name + '告捷 · 进入军营休整',
  };
}
