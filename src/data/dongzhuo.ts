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
  /** 正式图（每格 128，同华雄版式）的显示比例与脚线。 */
  artScale: 1.25, artGroundY: 114 / 128,
  /** 纵火：每 fireEvery 秒在主将周围点 3 处火，预警后燃烧；迁都后间隔缩短。 */
  fireEvery: 7, fireEveryEnraged: 5, fireCount: 3, fireRadius: 70, fireWarnMs: 1200, fireBurnMs: 4000, fireTickMs: 500, fireDamage: 6,
  /** 号令西凉铁骑（复用铁骑突阵）、飞熊军护驾。 */
  raidEvery: 15, guards: 3,
  /** 迁都：半血一次，无敌后撤、召一波西凉兵。 */
  retreatAt: .5, retreatMs: 2500, retreatDistance: 260, retreatInfantry: 8, retreatCavalry: 3,
} as const;

/**
 * 2-3 重做（共享笔记 luoyang-2-3-design.md，用户 2026-11-18）：开局董卓、吕布都在城头（打不到）；不分波，摧毁 5 座营寨 → 吕布跃下城头 → 战吕布（1/3 血逃）→ 董卓下城 → 20% 吕布斩董卓。
 * 坐标都相对开局点（城墙线在 DZ_LUBU.wallY = -330）。初值，交平衡会话。
 */
export const LUOYANG = {
  /** 营寨：城下两翼、场地中段两侧、开局点南边——走一圈正好扫一遍场地。 */
  camps: [[-560, -170], [560, -170], [-720, 330], [720, 330], [0, 720]] as ReadonlyArray<readonly [number, number]>,
  /** 城墙两端封口（ChapterDressing.sealCityWall）：南边界（洛水）离开局点多远。 */
  south: 1150,
  /** 吕布在城头：站在董卓右侧多远、来回踱步的幅度（像素）与一趟多久（毫秒）、走到头停多久。 */
  lubuDx: 200, paceRange: 90, paceMs: 2600, paceRestMs: 900,
  /** 后墙垛（城头走道的远侧）：比正面墙线再往北多少、缩放、压暗色。 */
  backParapetDy: 132, backParapetScale: .9, backParapetTint: 0x8c7d6c,
  /** 吕布跃下：用时、弧顶比起点高多少、落点（相对城门）。 */
  leapMs: 900, leapArc: 150, landDx: 110, landDy: 150,
  /** 镜头上让：董卓还在城头时，主将离墙线 cameraNear 以内开始往上让，贴墙时最多让 cameraLift（城墙图约 230 高，不让城头在画面外）。 */
  cameraNear: 560, cameraLift: 150,
} as const;

export function getLuoyangChapter(): ChapterDef {
  const base = getSishuiEncounter(), elite = base.enemies.elite, wv = elite.walkVisual;
  const boss: EnemyDef = {...base.enemies.boss, texture: wv?.texture ?? elite.texture, walkVisual: wv ? {...wv, scale: wv.scale * DONGZHUO_BOSS.scale} : undefined, attackVisual: undefined, tint: DONGZHUO_BOSS.tint, hp: DONGZHUO_BOSS.hp, speed: DONGZHUO_BOSS.speed, damage: DONGZHUO_BOSS.damage, radius: 34};
  return {
    ...base, name: '2-3 火烧洛阳', label: '讨伐董卓 · 洛阳', description: '董卓焚城西走 · 摧毁营寨、吕布、董卓', bossName: '董卓', bossStyle: 'dongzhuo', westStage: 3,
    // 不分波（用户：「这里不用设计波数」）：一段持续刷兵；首领（董卓）开局就站在城头
    waves: [{name: '洛阳城外', start: 0}], recruitWaves: [], bossAtStart: true,
    objective: {kind: 'destroy', count: LUOYANG.camps.length, target: '营寨', label: '摧毁营寨', limit: 9999, spots: LUOYANG.camps, doneBanner: ['营寨尽毁', '吕布跃下城头！']},
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
