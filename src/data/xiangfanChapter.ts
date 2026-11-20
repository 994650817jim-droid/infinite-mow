import type { ChapterDef } from './chapters';
import type { EnemyDef } from './enemies';
import { thirdBattle, type ThirdStage } from './thirdChapter';
import { stageTuning } from './stageTuning';
import type { StoryLine } from '../ui/StoryScroll';
import { artStyle } from '../systems/ArtStyle';
import { GUANDU_ATLAS_FILES } from './guanduChapter';

/**
 * 第九章 · 襄樊之战（建安二十四年）。共享笔记 chapters-6-12-plan.md：樊城 → 水淹七军（于禁、庞德）→ 麦城突围（吕蒙）。
 * 独有玩法「洪水」（systems/Flood.ts）：水淹七军中途大水从一侧漫场，水里的敌人被冲散、减速、持续受伤；我方站在高地或船上不受影响。
 * 庞德抬棺死战：二阶段狂暴（更快、更狠）。麦城是反向突围（systems/Breakout.ts）：被包围，限时冲到出口，吕蒙在出口前拦截。
 * 战场与首领招式沿用第三章框架（behavior = 首领招式组）。数值为能打的初值，平衡之后再调。
 */
export type XiangfanStage = 1 | 2 | 3;
export interface XiangfanStageInfo { stage: XiangfanStage; name: string; boss: string; id: 'caoren' | 'pangde' | 'lvmeng'; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage; skills: [string, string, string] }
export const XIANGFAN_STAGES: readonly XiangfanStageInfo[] = [
  { stage: 1, name: '樊城', boss: '曹仁', id: 'caoren', tag: '围城', feature: '曹仁固守 · 樊城精兵', story: '关羽北伐，围曹仁于樊城。城中坚守，城中精兵屡出逆击。', behavior: 2, scenery: 1, skills: ['坚阵连枪', '突阵追击', '伏兵四起'] },
  { stage: 2, name: '水淹七军', boss: '庞德', id: 'pangde', tag: '洪水', feature: '汉水暴涨 · 庞德抬棺', story: '秋雨连绵，汉水暴涨。于禁七军屯于低地，庞德抬棺立誓死战。', behavior: 1, scenery: 2, skills: ['抬棺冲阵', '号令死士', '大刀横扫'] },
  { stage: 3, name: '麦城突围', boss: '吕蒙', id: 'lvmeng', tag: '突围', feature: '四面吴兵 · 限时冲出', story: '吕蒙白衣渡江，荆州尽失。困守麦城，唯有杀开一条血路。', behavior: 3, scenery: 3, skills: ['旗令合围', '江东亲军', '白衣弓阵'] },
];
/** 首领图（ThirdBoss 版式 4×8）：曹仁沿用第五章 v2 图；庞德 / 吕蒙 v2 图到之前借用官渡首领图过渡。 */
const OWN: Record<string, { key: string; sheet: string }> = {
  caoren: { key: 'chibi_caoren', sheet: 'assets/chibi/caoren.png' },
  pangde: { key: 'xf_pangde', sheet: 'assets/bosses-v2/xf_pangde.png' },
  lvmeng: { key: 'xf_lvmeng', sheet: 'assets/bosses-v2/xf_lvmeng.png' },
};
const FALLBACK: Record<string, string> = { xf_pangde: 'guandu_yanliang', xf_lvmeng: 'guandu_wenchou' };
/** 已到的第九章图（只载这些；缺的用过渡图，避免 404）。只有 v2 版。 */
export const XF_ART_READY: ReadonlySet<string> = new Set<string>(['xf_pangde', 'xf_lvmeng', 'xf_baier_walk', 'xf_jiangdong_walk']); // 2026-11-17 Gemini 3.1 Pro 出图（白底 → tools/white-to-magenta.mjs → prepare-artv2）
export const xfArt = (key: string): boolean => XF_ART_READY.has(key) && artStyle() === 'v2';
export function xfBossTexture(id: string): string { const o = OWN[id]; if (!o.key.startsWith('xf_')) return o.key; return xfArt(o.key) ? o.key : FALLBACK[o.key]; }
export function xfBossSheet(id: string): string { const k = xfBossTexture(id); return k.startsWith('xf_') ? OWN[id].sheet : k === OWN[id].key ? OWN[id].sheet : GUANDU_ATLAS_FILES[k]; }
/** 新敌兵（v2）：樊城精兵（曹军，图键沿用 xf_baier；原称白耳兵——白毦兵是刘备亲兵，2026-11-20 改名）、江东水军（吴军，麦城替换刀兵）。 */
export const XF_TROOPS = {
  baier: { walk: 'xf_baier_walk', file: 'assets/processed-v2/enemies/xf_baier_walk.png' },
  jiangdong: { walk: 'xf_jiangdong_walk', file: 'assets/processed-v2/enemies/xf_jiangdong_walk.png' },
} as const;
const WAVE_NAMES: string[][] = [['樊城城下', '精兵逆击', '曹仁出城'], ['汉水秋雨', '七军被淹', '庞德死战'], ['麦城被围', '吴兵四合', '吕蒙截道']];

export function xiangfanBattle(stage: XiangfanStage): ChapterDef {
  const d = XIANGFAN_STAGES[stage - 1], base = thirdBattle(d.behavior), t = stageTuning('chibi', stage), e = base.enemies;
  const v = (def: EnemyDef, key: string, extra: Partial<EnemyDef>): EnemyDef => xfArt(key) && def.walkVisual
    ? { ...def, ...extra, texture: key, walkVisual: { ...def.walkVisual, texture: key }, attackVisual: undefined } : { ...def, ...extra };
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `9-${stage} ${d.name}`, label: `第九章 · 襄樊之战 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id as ChapterDef['bossStyle'],
    enemies: {
      ...e,
      shield: v(e.shield, XF_TROOPS.baier.walk, { hp: Math.round(e.shield.hp * 1.3), damage: Math.round(e.shield.damage * 1.15) }),
      infantry: stage === 3 ? v(e.infantry, XF_TROOPS.jiangdong.walk, { hp: Math.round(e.infantry.hp * 1.15), speed: Math.round(e.infantry.speed * 1.1) }) : e.infantry,
      boss: { ...e.boss, texture: xfBossTexture(d.id), hp: [2800, 3000, 3300][stage - 1], speed: [44, 56, 40][stage - 1], damage: [16, 17, 16][stage - 1] },
    },
    pickEnemy: tt => { const r = Math.random(); return stage === 1 ? (tt < 25 ? 'infantry' : r < .45 ? 'infantry' : r < .75 ? 'shield' : r < .92 ? 'archer' : 'elite') : stage === 2 ? (r < .5 ? 'infantry' : r < .75 ? 'shield' : r < .92 ? 'archer' : 'elite') : (r < .55 ? 'infantry' : r < .75 ? 'archer' : r < .9 ? 'cavalry' : 'elite'); },
    growth: { hp: t.hp * 1.15, damage: t.damage * 1.08, bossHp: t.bossHp },
    // 麦城：被包围——刷兵更密
    ...(stage === 3 ? { spawnInterval: (tt: number) => base.spawnInterval(tt) * .75 } : {}),
    victoryTitle: stage === 3 ? '冲出麦城' : d.boss + '败退', victoryText: stage === 3 ? '杀出重围 · 襄樊之战终' : d.name + '告捷 · 进入军营休整',
  };
}

// ———— 剧情卷轴 ————
export const XF_OPENING: StoryLine[] = [
  { who: '关羽', text: '曹仁坐守樊城，北方震动。今日便是我军威震华夏之时。' },
  { who: '王甫', text: '将军，东吴吕蒙称病还建业，陆逊书来卑辞——此中恐怕有诈。' },
  { who: '关羽', text: '江东鼠辈，何足挂齿！传令：围樊城！' },
  { text: '建安二十四年秋，关羽自江陵北伐，围曹仁于樊城。' },
  { who: '关羽', text: '某夜读春秋，兵法读到深处，自有一层新天地。' },
  { text: '新：战法精研第九章起可到 Lv5。' },
];
export const XF_FLOOD_OPENING: StoryLine[] = [
  { who: '关羽', text: '秋雨连旬，汉水将溢。于禁七军屯在罾口川低地——此天亡之也。' },
  { who: '庞德', text: '我受国恩，义在效死！今抬棺而来，不杀关羽，便杀我！' },
  { text: '大水将至时会出预警。站上高地或小船可免水患；水中的敌人会被冲散、减速、持续受伤。' },
];
/** 章末：主将是关羽时改写为本人突围。 */
export function xfEnding(hero: string, isGuanyu: boolean): StoryLine[] {
  return isGuanyu ? [
    { who: '吕蒙', text: '云长！荆州已失，何不早降？' },
    { who: '关羽', text: '玉可碎而不可改其白，竹可焚而不可毁其节！' },
    { text: '关羽杀出麦城，退守西川。荆州虽失，汉寿亭侯之名震于天下。' },
  ] : [
    { who: '吕蒙', text: '截住他们！一个也不许放走！' },
    { who: hero, text: '随我杀出去——回西川，再图荆州！' },
    { text: `${hero}护众杀出麦城，退守西川。荆州之失，蜀汉元气大伤，夷陵之役由此而起。` },
  ];
}
