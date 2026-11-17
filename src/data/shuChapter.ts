import type { ChapterDef } from './chapters';
import type { EnemyDef } from './enemies';
import { thirdBattle, type ThirdStage } from './thirdChapter';
import { stageTuning } from './stageTuning';
import type { StoryLine } from '../ui/StoryScroll';
import { artStyle } from '../systems/ArtStyle';

/**
 * 第七章 · 入蜀（建安十六～十九年）。共享笔记 chapters-6-12-plan.md：葭萌关 → 落凤坡（张任伏兵）→ 成都（刘璋）。
 * 独有玩法「山道伏击」：狭长山道，两侧山坡伏兵冲下、滚石先预警再沿线滚过（src/systems/MountainPass.ts）。
 * 落凤坡是剧情危机关：庞统随军，张任伏兵集火（主将是庞统时改写台词）。成都：攻城中城样板做成大城简化版，攻下后接城池建设。
 * 战场与首领招式沿用第三章框架：behavior = 首领招式组（1 冲锋 / 号令 / 横扫，2 连枪 / 突刺 / 伏兵，3 旗令 / 亲军 / 弓阵）。
 * 数值为能打的初值，平衡之后再调（用户 2026-11-17：先把概念玩法开发出来）。
 */
export type ShuStage = 1 | 2 | 3;
export interface ShuStageInfo { stage: ShuStage; name: string; boss: string; id: 'yanghuai' | 'zhangren' | 'liuzhang'; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage; skills: [string, string, string]; mode: 'pass' | 'crisis' | 'siege' }
export const SHU_STAGES: readonly ShuStageInfo[] = [
  { stage: 1, name: '葭萌关', boss: '杨怀', id: 'yanghuai', tag: '山道伏击', feature: '两侧伏兵与滚石', story: '刘璋邀玄德入蜀拒张鲁，白水关杨怀、高沛暗藏杀机。闯过山道，夺下葭萌。', behavior: 1, scenery: 1, skills: ['眉尖刀冲阵', '号令伏兵', '横刀断路'], mode: 'pass' },
  { stage: 2, name: '落凤坡', boss: '张任', id: 'zhangren', tag: '剧情危机', feature: '张任伏兵 · 护住凤雏', story: '雒城前山路狭窄，林中箭声如雨。张任设伏，凤雏危在旦夕。', behavior: 2, scenery: 2, skills: ['连枪突阵', '落凤箭雨', '伏兵四起'], mode: 'crisis' },
  { stage: 3, name: '成都', boss: '刘璋', id: 'liuzhang', tag: '攻城', feature: '冲车破城 · 巷战 · 州府', story: '大军合围成都，城中尚有三万精兵。破门、夺巷、逼降益州牧。', behavior: 3, scenery: 3, skills: ['旗令守城', '东州亲军', '城头弓阵'], mode: 'siege' },
];
/** 首领图集（ThirdBoss 版式 4×8；v2 图到之前用第三章同招式组首领的图过渡，见 SHU_BOSS_FALLBACK）。 */
/** v2 首领图（288 格）登记在 ArtStyle.ART_V2_FILES，loadBossSheet 按 v2 载入；这里的 v1 路径只作占位（v1 画风时不用第七章新图）。 */
export const SHU_SHEETS: Record<string, string> = { shu_yanghuai: 'assets/bosses-v2/shu_yanghuai.png', shu_zhangren: 'assets/bosses-v2/shu_zhangren.png', shu_liuzhang: 'assets/bosses-v2/shu_liuzhang.png' };
export const SHU_BOSS_FALLBACK: Record<string, string> = { shu_yanghuai: 'third_lijue', shu_zhangren: 'third_zhangxiu', shu_liuzhang: 'third_yuanshu' };
/** 已到的第七章图（只载这些，缺的用过渡图，避免 404）。 */
export const SHU_ART_READY: ReadonlySet<string> = new Set<string>(['shu_yanghuai', 'shu_zhangren', 'shu_liuzhang', 'shu_nushou_walk', 'shu_pass']);
/** 第七章新图只有 v2 版：v1 画风时一律用过渡图。 */
export const shuArt = (key: string): boolean => SHU_ART_READY.has(key) && artStyle() === 'v2';
/** 本关首领纹理键与图集路径（缺图时取过渡首领）。 */
export function shuBossTexture(id: string): string { return shuArt('shu_' + id) ? 'shu_' + id : SHU_BOSS_FALLBACK['shu_' + id]; }
export function shuBossSheet(id: string): string { const k = shuBossTexture(id); return k.startsWith('shu_') ? SHU_SHEETS[k] : 'assets/phase23/' + k.replace('third_', '') + '.png'; }

const WAVE_NAMES: string[][] = [
  ['白水关下', '山道伏兵', '杨怀拔刀'],
  ['雒城山道', '林中伏弩', '张任现身'],
  ['成都城外', '巷战东州兵', '刘璋出降'],
];

/** 新敌兵（v2 图）：东州兵（替换刀兵）、蜀中弩手（替换弓手）。纹理键在场景里载入，缺图时沿用原兵种图。 */
export const SHU_TROOPS = {
  dongzhou: { walk: 'shu_dongzhou_walk', file: 'assets/processed-v2/enemies/shu_dongzhou_walk.png' },
  nushou: { walk: 'shu_nushou_walk', file: 'assets/processed-v2/enemies/shu_nushou_walk.png' },
} as const;

/** 第七章战斗：以对应招式组的第三章战斗为底，换首领、名称、敌兵与数值（比第五章略强）。 */
export function shuBattle(stage: ShuStage, hasArt: (key: string) => boolean = shuArt): ChapterDef {
  const d = SHU_STAGES[stage - 1], base = thirdBattle(d.behavior), t = stageTuning('chibi', stage);
  const e = base.enemies, v = (def: EnemyDef, key: string, extra: Partial<EnemyDef>): EnemyDef => hasArt(key) && def.walkVisual
    ? { ...def, ...extra, texture: key, walkVisual: { ...def.walkVisual, texture: key }, attackVisual: undefined } : { ...def, ...extra };
  const bossTex = shuBossTexture(d.id);
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `7-${stage} ${d.name}`, label: `第七章 · 入蜀 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id as ChapterDef['bossStyle'],
    enemies: {
      ...e,
      // 东州兵：更耐打、伤害略高；蜀中弩手：射程远、箭快（伤害沿用弓手）
      infantry: v(e.infantry, SHU_TROOPS.dongzhou.walk, { hp: Math.round(e.infantry.hp * 1.25), damage: Math.round(e.infantry.damage * 1.15) }),
      archer: v(e.archer, SHU_TROOPS.nushou.walk, { hp: Math.round(e.archer.hp * 1.1) }),
      boss: { ...e.boss, texture: bossTex, hp: [2400, 2700, 3000][stage - 1], speed: [58, 46, 36][stage - 1], damage: [15, 16, 14][stage - 1] },
    },
    pickEnemy: tt => { const r = Math.random(); return stage === 1 ? (tt < 25 ? 'infantry' : r < .55 ? 'infantry' : r < .85 ? 'archer' : 'shield') : stage === 2 ? (r < .4 ? 'infantry' : r < .85 ? 'archer' : 'elite') : (r < .35 ? 'infantry' : r < .6 ? 'shield' : r < .88 ? 'archer' : 'elite'); },
    growth: { hp: t.hp * 1.08, damage: t.damage * 1.05, bossHp: t.bossHp },
    victoryTitle: d.boss + (stage === 3 ? '出降' : '败退'), victoryText: stage === 3 ? '刘璋开城出降 · 益州归附 · 入蜀告捷' : d.name + '告捷 · 进入军营休整',
  };
}

// ———— 剧情卷轴（开头一张、章末一张；落凤坡危机两张） ————
export const SHU_OPENING: StoryLine[] = [
  { who: '张松', text: '益州沃野千里，刘季玉暗弱，张鲁在北，人心思得明主。' },
  { who: '法正', text: '刘璋请将军入川拒张鲁——此正天赐之机。' },
  { who: '主将', text: '蜀道艰险，两侧皆是悬崖峭壁。传令：前军探路，提防山上伏兵与滚石。' },
  { text: '建安十六年，大军溯江而上，入蜀。' },
];
/** 落凤坡开场：主将是庞统时改写（他自己就是凤雏）。 */
export function luofengOpening(isPangtong: boolean, hero: string): StoryLine[] {
  return isPangtong ? [
    { who: '庞统', text: '前方地名落凤坡……我道号凤雏，此地于我不利？哈，天命何足惧！' },
    { who: '张任', text: '骑白马者必是刘备！万箭齐发！' },
    { who: '庞统', text: '我骑的正是主公所赐的的卢——将计就计，诱他伏兵尽出。诸军护住两翼！' },
    { text: '张任伏弩会集中射向庞统。避开红色箭道，击败张任。' },
  ] : [
    { who: '庞统', text: `${hero}将军，前方地名落凤坡……我道号凤雏，此地于我不利。` },
    { who: hero, text: '军师宽心，我护在你身侧，必不让张任得逞。' },
    { who: '张任', text: '骑白马者必是刘备！万箭齐发！' },
    { text: '庞统随军前进。张任伏弩会集中射向庞统——带他避开红色箭道，击败张任。' },
  ];
}
/** 落凤坡结局：凤雏得救 / 落凤（主将是庞统时只有「得救」，倒下即战败）。 */
export function luofengEnding(saved: boolean, isPangtong: boolean, hero: string): StoryLine[] {
  if (isPangtong) return [{ who: '庞统', text: '落凤坡？今日落的是张任的伏兵。' }, { who: '张任', text: '……竟是我中了你的计。' }, { text: '凤雏改写天命。雒城门户大开，大军直指成都。' }];
  return saved ? [
    { who: '庞统', text: `若非${hero}将军舍身相护，统已葬身此坡。` },
    { who: hero, text: '军师无恙，便是全军之幸。' },
    { text: '凤雏不落，此后军中多一谋主。雒城门户大开，大军直指成都。' },
  ] : [
    { who: '张任', text: '白马者已中箭坠落！' },
    { who: hero, text: '军师——！' },
    { text: '庞统身中数箭，殁于落凤坡，年三十六。全军缟素，誓取成都。' },
  ];
}
export const SHU_ENDING: StoryLine[] = [
  { who: '刘璋', text: '父子在州二十余年，无恩德以加百姓。百姓攻战三年，肌膏草野者，以璋故也，何心能安！' },
  { text: '刘璋开城出降。益州归附，天府之国自此为根基。' },
  { who: '主将', text: '取成都、定益州。北可图汉中，东可望荆襄——三分之势，至此方成。' },
];
