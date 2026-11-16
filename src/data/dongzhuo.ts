import type {ChapterDef} from './chapters';
import type {EnemyDef} from './enemies';
import {getSishuiEncounter} from './sishui';

/**
 * 用户 2026-11-16：「2-3 吕布换成董卓，需要设计出这个 boss；吕布关卡设计成可选关卡，在大地图选择」。
 * 2-3 火烧洛阳（首领董卓）：史实上董卓焚洛阳、挟天子西迁长安。吕布移到天下地图挑战关「虎牢关 · 三英战吕布」，首通得赤兔。
 * 试玩初值，交平衡会话测。董卓为过渡造型：西凉精锐行走图放大染金褐（正式 32 帧首领图集待 ChatGPT 生成）。
 */
export const DONGZHUO_BOSS = {
  hp: 3000, speed: 34, damage: 16, scale: 1.7, tint: 0xe2b98a,
  /** 纵火：每 fireEvery 秒在主将周围点 3 处火，预警后燃烧；迁都后间隔缩短。 */
  fireEvery: 7, fireEveryEnraged: 5, fireCount: 3, fireRadius: 70, fireWarnMs: 1200, fireBurnMs: 4000, fireTickMs: 500, fireDamage: 6,
  /** 号令西凉铁骑（复用铁骑突阵）、飞熊军护驾。 */
  raidEvery: 15, guards: 3,
  /** 迁都：半血一次，无敌后撤、召一波西凉兵。 */
  retreatAt: .5, retreatMs: 2500, retreatDistance: 260, retreatInfantry: 8, retreatCavalry: 3,
} as const;

export function getLuoyangChapter(): ChapterDef {
  const base = getSishuiEncounter(), elite = base.enemies.elite, wv = elite.walkVisual;
  const boss: EnemyDef = {...base.enemies.boss, texture: wv?.texture ?? elite.texture, walkVisual: wv ? {...wv, scale: wv.scale * DONGZHUO_BOSS.scale} : undefined, attackVisual: undefined, tint: DONGZHUO_BOSS.tint, hp: DONGZHUO_BOSS.hp, speed: DONGZHUO_BOSS.speed, damage: DONGZHUO_BOSS.damage, radius: 34};
  return {
    ...base, name: '2-3 火烧洛阳', label: '讨伐董卓 · 洛阳', description: '董卓焚城西走 · 纵火、铁骑与飞熊军', bossName: '董卓', bossStyle: 'dongzhuo', westStage: 3,
    waves: ['洛阳城外', '飞熊军压阵', '董卓焚城'].map((name, i) => ({name, start: i * 45})), recruitWaves: [1, 2],
    enemies: {...base.enemies, boss},
    victoryTitle: '董卓西走', victoryText: '董卓败退长安 · 讨伐董卓告捷 · 群雄并起',
  };
}

/** 天下地图挑战关「虎牢关 · 三英战吕布」：原第二章虎牢关的吕布战，压到 3 波。 */
/** 首胜的赤兔走马厩（mounts.ts HORSES 中 reward 为 'lubu' 的马）。 */
export const LUBU_CHALLENGE = {unlockAfter: 2, reward: {merits: 80, provisions: 120}, repeatReward: {merits: 30, provisions: 50}} as const;
export function lubuChallengeChapter(hulao: ChapterDef): ChapterDef {
  return {
    ...hulao, name: '虎牢关 · 三英战吕布', label: '挑战 · 虎牢关', description: '吕布横扫与蓄力冲锋 · 首通得赤兔',
    waves: ['关前哨骑', '虎牢精锐', '吕布出阵'].map((name, i) => ({name, start: i * 45})), recruitWaves: [1, 2],
    victoryTitle: '威震虎牢', victoryText: '三英战吕布 · 吕布败走',
  };
}
