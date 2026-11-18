import type { ChapterDef } from './chapters';
import type { EnemyDef } from './enemies';
import { thirdBattle, type ThirdStage } from './thirdChapter';
import { stageTuning } from './stageTuning';
import type { StoryLine } from '../ui/StoryScroll';
import { artStyle } from '../systems/ArtStyle';
import { GUANDU_ATLAS_FILES } from './guanduChapter';

/**
 * 第十一章 · 南征（建兴三年）。共享笔记 chapters-6-12-plan.md：泸水（毒泉）→ 藤甲兵 → 七擒孟获。
 * 独有玩法「克制兵种」（systems/Nanman.ts）：藤甲兵刀枪不入（物理只吃 20%）、怕火（火攻 3 倍并引燃周围）；象兵直线冲撞（先出预警）；毒泉持续掉血、减速。
 * 场上有火盆：主将碰到即得「火攻」（一段时间内普攻全算火攻）——没有火系武将也能克制藤甲。
 * 七擒孟获（简化）：孟获被击倒后逃走、再次出现，共 3 次，最后一次才算击败，章末「心服」剧情。
 * 战场与首领招式沿用第三章框架（behavior = 首领招式组）。数值为能打的初值，平衡之后再调。
 */
export type NanzhengStage = 1 | 2 | 3;
export interface NanzhengStageInfo { stage: NanzhengStage; name: string; boss: string; id: 'mangyachang' | 'wutugu' | 'menghuo'; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage; skills: [string, string, string] }
export const NANZHENG_STAGES: readonly NanzhengStageInfo[] = [
  { stage: 1, name: '泸水', boss: '忙牙长', id: 'mangyachang', tag: '毒泉', feature: '瘴气毒泉 · 蛮兵象兵', story: '五月渡泸，深入不毛。泸水两岸瘴气蒸腾，毒泉遍地，蛮将忙牙长据守渡口。', behavior: 1, scenery: 2, skills: ['截头大刀', '蛮兵冲阵', '驱象踏营'] },
  { stage: 2, name: '藤甲兵', boss: '兀突骨', id: 'wutugu', tag: '藤甲', feature: '刀枪不入 · 唯惧火攻', story: '乌戈国主兀突骨率藤甲兵三万来援。藤甲浸油晒干，刀箭不入，渡水不沉。', behavior: 2, scenery: 3, skills: ['藤甲横冲', '乌戈蛮阵', '巨身践踏'] },
  { stage: 3, name: '七擒孟获', boss: '孟获', id: 'menghuo', tag: '七擒', feature: '擒而复纵 · 攻心为上', story: '孟获屡败屡战，丞相擒而复纵——攻心为上，攻城为下。', behavior: 3, scenery: 1, skills: ['蛮王怒斩', '洞兵合围', '驱象冲阵'] },
];
/** 首领图（ThirdBoss 版式 4×8）：v2 图到之前借用官渡首领图过渡（写明：淳于琼 / 颜良 / 文丑）。 */
const OWN: Record<string, { key: string; sheet: string }> = {
  mangyachang: { key: 'nz_mangyachang', sheet: 'assets/bosses-v2/nz_mangyachang.png' },
  wutugu: { key: 'nz_wutugu', sheet: 'assets/bosses-v2/nz_wutugu.png' },
  menghuo: { key: 'nz_menghuo', sheet: 'assets/bosses-v2/nz_menghuo.png' },
};
const FALLBACK: Record<string, string> = { nz_mangyachang: 'guandu_chunyuqiong', nz_wutugu: 'guandu_yanliang', nz_menghuo: 'guandu_wenchou' };
/** 已到的第十一章图（只载这些；缺的用过渡图，避免 404）。只有 v2 版。 */
export const NZ_ART_READY: ReadonlySet<string> = new Set<string>(['nz_menghuo', 'nz_mangyachang', 'nz_wutugu', 'nz_tengjia_walk', 'nz_manbing_walk', 'nz_elephant_walk']); // 2026-11-17 Gemini 3.1 Pro 出图；忙牙长 / 兀突骨 ChatGPT 出图（21:53 / 21:59）
export const nzArt = (key: string): boolean => NZ_ART_READY.has(key) && artStyle() === 'v2';
export function nzBossTexture(id: string): string { const o = OWN[id]; return nzArt(o.key) ? o.key : FALLBACK[o.key]; }
export function nzBossSheet(id: string): string { const k = nzBossTexture(id); return k === OWN[id].key ? OWN[id].sheet : GUANDU_ATLAS_FILES[k]; }
/** 新敌兵（v2，等额度恢复后再要）：蛮兵（替换刀兵）、藤甲兵（替换盾兵）、象兵（替换骑兵）。缺图时沿用原兵种图（象兵放大）。 */
export const NZ_TROOPS = {
  manbing: { walk: 'nz_manbing_walk', file: 'assets/processed-v2/enemies/nz_manbing_walk.png' },
  tengjia: { walk: 'nz_tengjia_walk', file: 'assets/processed-v2/enemies/nz_tengjia_walk.png' },
  elephant: { walk: 'nz_elephant_walk', file: 'assets/processed-v2/enemies/nz_elephant_walk.png' },
} as const;
const WAVE_NAMES: string[][] = [['五月渡泸', '瘴气四起', '忙牙长出阵'], ['乌戈来援', '藤甲压阵', '兀突骨亲至'], ['蛮洞初战', '象阵冲营', '孟获再来']];

export function nanzhengBattle(stage: NanzhengStage): ChapterDef {
  const d = NANZHENG_STAGES[stage - 1], base = thirdBattle(d.behavior), t = stageTuning('chibi', stage), e = base.enemies;
  const v = (def: EnemyDef, key: string, extra: Partial<EnemyDef>): EnemyDef => nzArt(key) && def.walkVisual
    ? { ...def, ...extra, texture: key, walkVisual: { ...def.walkVisual, texture: key }, attackVisual: undefined } : { ...def, ...extra };
  // 象兵比人高大：有象兵 v2 图时按兵种图规格（同人高）放大 1.6 倍，没图时把骑兵图放大 1.55 倍过渡
  const cav = e.cavalry, ele = v(cav, NZ_TROOPS.elephant.walk, { hp: Math.round(cav.hp * 4.5), speed: Math.round(cav.speed * .72), damage: Math.round(cav.damage * 1.6), radius: 26, xp: cav.xp * 3 });
  const big = ele.walkVisual ? { walkVisual: { ...ele.walkVisual, scale: ele.walkVisual.scale * (nzArt(NZ_TROOPS.elephant.walk) ? 1.6 : 1.55) } } : {};
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `11-${stage} ${d.name}`, label: `第十一章 · 南征 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id as ChapterDef['bossStyle'],
    enemies: {
      ...e,
      infantry: v(e.infantry, NZ_TROOPS.manbing.walk, { hp: Math.round(e.infantry.hp * 1.1), speed: Math.round(e.infantry.speed * 1.08) }),
      // 藤甲兵：血量略高；减伤 / 怕火在 systems/Nanman.ts（按 kind === 'shield' 判定）
      shield: v(e.shield, NZ_TROOPS.tengjia.walk, { hp: Math.round(e.shield.hp * 1.2), damage: Math.round(e.shield.damage * 1.1), tint: nzArt(NZ_TROOPS.tengjia.walk) ? undefined : 0xc9a46a }),
      // 象兵：皮糙肉厚、体型大；冲撞在 systems/Nanman.ts
      cavalry: { ...ele, ...big },
      boss: { ...e.boss, texture: nzBossTexture(d.id), hp: [2700, 3100, 2600][stage - 1], speed: [46, 40, 48][stage - 1], damage: [16, 18, 17][stage - 1] },
    },
    pickEnemy: tt => { const r = Math.random(); return stage === 1 ? (tt < 25 ? 'infantry' : r < .6 ? 'infantry' : r < .78 ? 'archer' : r < .9 ? 'cavalry' : 'elite') : stage === 2 ? (tt < 15 ? 'infantry' : r < .3 ? 'infantry' : r < .78 ? 'shield' : r < .9 ? 'archer' : 'elite') : (r < .42 ? 'infantry' : r < .64 ? 'shield' : r < .8 ? 'cavalry' : r < .92 ? 'archer' : 'elite'); },
    growth: { hp: t.hp * 1.2, damage: t.damage * 1.1, bossHp: t.bossHp },
    victoryTitle: stage === 3 ? '孟获心服' : d.boss + '败退', victoryText: stage === 3 ? '七擒七纵 · 南中平定' : d.name + '告捷 · 进入军营休整',
  };
}

// ———— 剧情卷轴 ————
export const NZ_OPENING: StoryLine[] = [
  { who: '诸葛亮', text: '南中诸郡叛乱，雍闿、孟获煽动蛮夷。北伐之前，后方必须安定。' },
  { who: '马谡', text: '南中恃其险远，不服久矣。今日破之，明日复反——用兵之道，攻心为上，攻城为下。' },
  { who: '诸葛亮', text: '幼常知我心。传令：五月渡泸，深入不毛。' },
  { text: '建兴三年春，诸葛亮亲率大军南征。泸水两岸有毒泉瘴气，踏入会持续掉血、减速——绕开或速速通过。' },
];
export const NZ_TENGJIA_OPENING: StoryLine[] = [
  { who: '孟获', text: '乌戈国藤甲兵到了！刀砍不入，箭射不进，看你诸葛亮如何破！' },
  { who: '诸葛亮', text: '藤甲以油浸之，遇水不沉——遇火必燃。' },
  { text: '藤甲兵受刀箭只吃两成伤害，被火攻命中则受三倍伤害并引燃周围。碰触场上的火盆即可获得「火攻」。' },
];
export const NZ_MENGHUO_OPENING: StoryLine[] = [
  { who: '孟获', text: '前番是我自家不小心！放我回去，整顿兵马再决胜负！' },
  { who: '诸葛亮', text: '好，放你回去。再擒时，可肯降否？' },
  { text: '孟获被击倒后会逃走、再次出现——擒他三次（擒而复纵），方得心服。小心象兵冲撞：地面出现预警箭道时让开。' },
];
/** 每次擒住孟获时的横幅说明。 */
export const MENGHUO_CAPTURE_LINES = ['一擒孟获 · 孟获不服，纵之', '二擒孟获 · 孟获又不服，再纵之', '三擒孟获'] as const;
/** 章末：主将是诸葛亮时改写为本人说话。 */
export function nzEnding(hero: string, isZhuge: boolean): StoryLine[] {
  const speaker = isZhuge ? '诸葛亮' : hero;
  return [
    { who: '孟获', text: '七擒七纵，自古未尝有也。丞相天威，南人不复反矣！' },
    { who: speaker, text: isZhuge ? '汝既心服，南中仍归汝等自治。我不留兵、不运粮，纲纪粗定，夷汉粗安。' : '丞相有令：南中仍归汝等自治。愿此后夷汉相安，共御外敌。' },
    { text: '孟获心服，南中平定。蜀汉后方既安，北伐之师，自此可出。' },
  ];
}
