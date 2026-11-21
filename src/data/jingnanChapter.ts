import type {ChapterDef} from './chapters';
import {withV2Sheets as withSheets} from '../systems/ArtStyle';
import {thirdBattle,type ThirdStage} from './thirdChapter';

/**
 * 第六章 · 平定荆南（建安十三年冬 ~ 十四年，赤壁之后）。三关沿用第三章战场与首领招式框架（同第五章写法）。
 * 关序按史事：桂阳先降（赵范）→ 零陵、武陵（刘度降、金旋死）→ 长沙最后（黄忠可劝降，章末首领韩玄）。
 * 独有玩法「劝降」：可劝降的首领残血时弹「劝降 / 斩杀」（JingnanBattle），劝降者入招贤馆。
 * 初值，交平衡会话；开发期不做老存档兼容（用户 2026-11-17）。
 */
export type JingnanStage = 1 | 2 | 3;
export type JingnanBossId = 'zhaofan' | 'liudu' | 'hanxuan' | 'huangzhong';
export interface JingnanBoss { id: JingnanBossId; name: string; title: string; behavior: ThirdStage; skills: [string, string, string];
  /** 可劝降：残血时弹「劝降 / 斩杀」；hero = 劝降后以可玩武将身份入麾下（黄忠）。 */
  persuade?: { hero?: 'huangzhong'; line: string; refuse?: string } }
export interface JingnanStageInfo { stage: JingnanStage; name: string; boss: string; id: JingnanBossId; tag: string; feature: string; story: string; behavior: ThirdStage; scenery: ThirdStage | 4; skills: [string, string, string]; signature?: string }

export const JINGNAN_BOSSES: Record<JingnanBossId, JingnanBoss> = {
  zhaofan: { id: 'zhaofan', name: '赵范', title: '桂阳太守', behavior: 3, skills: ['旗令轰击', '亲军护驾', '弓阵齐射'],
    persuade: { line: '赵范：某本无心抗拒，愿献桂阳印绶，从将军调遣。' } },
  liudu: { id: 'liudu', name: '刘度', title: '零陵太守', behavior: 1, skills: ['铁骑破阵', '号令援军', '军刀横扫'],
    persuade: { line: '刘度：零陵小郡，岂敢逆天兵？愿举城归降。' } },
  huangzhong: { id: 'huangzhong', name: '黄忠', title: '长沙老将', behavior: 3, skills: ['百步穿杨', '老当益壮', '连珠箭阵'],
    persuade: { hero: 'huangzhong', line: '黄忠：韩玄无道，忠岂为昏主殉身？愿随将军，以报知遇。' } },
  hanxuan: { id: 'hanxuan', name: '韩玄', title: '长沙太守', behavior: 2, skills: ['连环枪击', '突刺追击', '伏兵包围'] },
};

export const JINGNAN_STAGES: readonly JingnanStageInfo[] = [
  { stage: 1, name: '桂阳受降', boss: '赵范', id: 'zhaofan', tag: '兵临桂阳', feature: '旗令弓阵 · 可劝降', story: '赤壁之后，荆南四郡观望。兵临桂阳，赵范进退两难。', behavior: 3, scenery: 1, skills: ['旗令轰击', '亲军护驾', '弓阵齐射'] },
  { stage: 2, name: '零陵武陵', boss: '刘度', id: 'liudu', tag: '山越据险', feature: '山越弓手 · 藤牌兵 · 可劝降', story: '零陵、武陵依山据险，山越弓手藏于林间。破其藤牌阵，逼刘度出降。', behavior: 1, scenery: 2, skills: ['铁骑破阵', '号令援军', '军刀横扫'] },
  { stage: 3, name: '长沙会战', boss: '韩玄', id: 'hanxuan', tag: '老将黄忠', feature: '先战黄忠（可劝降）· 再破韩玄', story: '长沙太守韩玄性急寡恩，老将黄忠守城。先与黄忠交锋，再取长沙。', behavior: 2, scenery: 4, skills: ['连环枪击', '突刺追击', '伏兵包围'] },
];
/**
 * 首领图：v2 正式图在 ArtStyle.ART_V2_FILES 的 jingnan_* 键（4×8，每格 288）；这里是 v1 回退（v1 无专属图，借用旧首领图）。
 */
export const JINGNAN_SHEETS: Record<string, string> = {
  jingnan_zhaofan: 'assets/phase23/yuanshu.png', jingnan_liudu: 'assets/guandu/chunyuqiong.png',
  jingnan_hanxuan: 'assets/phase23/lijue.png', jingnan_huangzhong: 'assets/guandu/yanliang.png',
};
export const jingnanTexture = (id: string): string => 'jingnan_' + id;

const WAVE_NAMES: string[][] = [
  ['桂阳城外', '郡兵列阵', '赵范出城'],
  ['武陵山道', '山越伏林', '刘度督战'],
  ['长沙城下', '老将黄忠', '韩玄出阵'],
];
/** 荆南新兵种 v2 图集（4×4 下左右上；JingnanGameScene.preload 按需加载）。 */
export const JINGNAN_TROOP_SHEETS = { archer: ['jingnan_shanyue_archer_walk_sheet', 'jingnan_shanyue_archer_attack_sheet'], shield: ['jingnan_rattan_shield_walk_sheet', 'jingnan_rattan_shield_attack_sheet'] } as const;
/** 荆南新兵种（v1 用换色过渡）：山越弓手（射得远、伤害高、血薄）、藤牌兵（藤牌护身，先破盾）。 */
export const JINGNAN_TROOPS = {
  shanyueArcher: { hp: 14, speed: 66, damage: 7, tint: 0x9fc27a },
  tengpai: { hp: 46, speed: 58, damage: 8, tint: 0xd8b070 },
} as const;

/** 第六章战斗：以对应招式组的第三章战斗为底，换首领、名称、兵种与数值（比第五章再强一点）。 */
export function jingnanBattle(stage: JingnanStage): ChapterDef {
  const d = JINGNAN_STAGES[stage - 1], base = thirdBattle(d.behavior), T = JINGNAN_TROOPS;
  const archer = withSheets({ ...base.enemies.archer, hp: T.shanyueArcher.hp, speed: T.shanyueArcher.speed, damage: T.shanyueArcher.damage, tint: T.shanyueArcher.tint }, JINGNAN_TROOP_SHEETS.archer);
  const shield = withSheets({ ...base.enemies.shield, hp: T.tengpai.hp, speed: T.tengpai.speed, damage: T.tengpai.damage, tint: T.tengpai.tint }, JINGNAN_TROOP_SHEETS.shield);
  return {
    ...base,
    waves: base.waves.map((w, i) => ({ ...w, name: WAVE_NAMES[stage - 1][i] ?? w.name })),
    name: `6-${stage} ${d.name}`, label: `第六章 · 平定荆南 · ${d.name}`, description: d.story, bossName: d.boss, bossStyle: d.id,
    // 第二、三关山越弓手、藤牌兵比例更高
    pickEnemy: stage === 1 ? base.pickEnemy : (t: number) => { const r = Math.random(); return r < .22 ? 'archer' : r < .47 ? 'shield' : base.pickEnemy(t); }, // 2026-11-21 配兵审计：原弓 .3，6-3 远程约 42%
    enemies: { ...base.enemies, archer, shield, boss: { ...base.enemies.boss, texture: jingnanTexture(d.id), hp: [2500, 2700, 3000][stage - 1], speed: [44, 56, 44][stage - 1], damage: [15, 16, 17][stage - 1] } },
    victoryTitle: d.boss + '败退', victoryText: stage === 3 ? '长沙易帜 · 荆南四郡尽归 · 平定荆南告捷' : d.name + '告捷 · 进入军营休整',
  };
}
