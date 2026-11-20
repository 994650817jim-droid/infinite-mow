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
  /**
   * 营寨（用户 11-19「营寨可以隔着远点，然后营寨应该做些场景有围栏围着之类的然后小怪比较多守着」）：
   * 城下东西两翼、西南 / 东南、正南——彼此隔 1100～1700，要走一段才到下一座；都在城墙以南，避开开局点附近的焦屋废墟。
   */
  camps: [[-1500, 60], [1500, 60], [-1150, 1100], [1150, 1100], [0, 1750]] as ReadonlyArray<readonly [number, number]>,
  /**
   * 每座营寨的布景与守军（systems/LuoyangCamps）。坐标相对营帐脚底：
   * 营栅围一圈（halfW 半宽、north 北排 / south 南排的 y），南面留营门（gate 宽），营里军旗、粮草、兵器架、火盆，东北角望楼。
   * 守军开局就在营里（garrison 个 + elites 个精锐，按本关配兵表 data/enemyRoster 抽兵种），主将走近 alertR 以内、或营里有人 / 营帐挨打就出营门迎战；
   * 营帐没毁、主将在 nearR 以内时每 reinforceMs 从营门出 reinforceN 个援兵（本营援兵同时在场最多 reinforceLive 个）。初值，交平衡会话。
   */
  camp: { halfW: 280, north: -175, south: 150, gate: 150, garrison: 8, elites: 1, alertR: 520, reinforceMs: 9000, reinforceN: 3, reinforceLive: 6, nearR: 1100, exitPad: 90, clearR: 430 },
  /**
   * 营寨守将（统筹 11-20：第二章副将「李傕」原来用不上——2-3 不分段）：李傕是董卓部将，守正南大营（camps 第 camp 座，0 起），
   * 副将一档的生命、第二章副将专属形象（lt_hulao_*）、头顶名牌「营寨守将 · 李傕」；开局在营里，和守军一起出营迎战；倒下同副将（军略、伤药）。
   */
  commander: { name: '李傕', camp: 4, label: '营寨守将 · ', dx: 0, dy: 70 },
  /** 城墙半长（用户「2-3只有很长一段城墙，不用把玩家困在里面」）：一道长墙、两端角楼收口；没有侧墙 / 南边界。墙北进不去（DongzhuoLubu.keepSouth 不分 x）。 */
  wallHalf: 4200,
  /** 吕布在城头：站在董卓右侧多远、来回踱步的幅度（像素）与一趟多久（毫秒）、走到头停多久。 */
  lubuDx: 200, paceRange: 90, paceMs: 2600, paceRestMs: 900,
  /** 2.5D 城墙图（用户「生成那张可以站在立体上的城墙素材」；即梦出图，public/assets/siege-v2/luoyang/）：
   *  每张图「图内像素」标注：ground = 墙脚贴地那一行，crenel = 外侧城垛顶（从这行往下另画一层盖在城头人物前面，挡住腿）。
   *  scale：图像素 → 世界像素；城门楼 / 角楼按墙高对齐另乘系数；overlap：墙段相邻重叠（藏住两端的斜角）。 */
  wallArt: {
    scale: .52, overlap: 40,
    seg: {file: 'assets/siege-v2/luoyang/wall_seg.png', w: 1339, ground: 452, crenel: 92},
    gate: {file: 'assets/siege-v2/luoyang/wall_gate.png', w: 836, ground: 605, crenel: 276, mul: 1.1},
    corner: {file: 'assets/siege-v2/luoyang/wall_corner.png', w: 487, ground: 640, crenel: 205, mul: 1.05},
  },
  /** 吕布跃下：用时、弧顶比起点高多少、落点（相对城门）。 */
  leapMs: 900, leapArc: 150, landDx: 110, landDy: 150,
  /** 镜头上让：董卓还在城头时，主将离墙线 cameraNear 以内开始往上让，贴墙时最多让 cameraLift（2.5D 城墙连门楼约 330 高，城头的董卓头顶在墙线上方约 320，不让他出画面）。 */
  cameraNear: 700, cameraLift: 240,
  /**
   * 友军攻势（systems/AllyPush；用户「从后方会有我方小兵去一路打过去会去摧毁营寨，小地图会显示这个攻势」）：
   * 开局 firstMs 后第一队、之后每 everyMs 一队义军（squad 人，长枪 / 刀盾）从后方（镜头下沿外 rearPad）出发，走向离主将最近的营寨；
   * 场上最多 cap 人。speed 行军速度；hp 血；dmg 砍敌兵一下、campDmg 砍营寨一下（每 hitMs 一下）；engage 多近的敌兵会去打；
   * reach / campReach 够得着的距离；enemyDps 身边每个敌兵每秒掉多少血（最多按 3 个算）。初值，交平衡会话。
   */
  push: { firstMs: 6000, everyMs: 20000, squad: 5, cap: 20, sheets: ['shu_spearman_walk_sheet', 'shu_swordsman_walk_sheet'], speed: 78, hp: 150, dmg: 18, campDmg: 9, hitMs: 900, engage: 120, reach: 46, campReach: 40, enemyDps: 6, rearPad: 90 },
} as const;

export function getLuoyangChapter(): ChapterDef {
  const base = getSishuiEncounter(), elite = base.enemies.elite, wv = elite.walkVisual;
  const boss: EnemyDef = {...base.enemies.boss, texture: wv?.texture ?? elite.texture, walkVisual: wv ? {...wv, scale: wv.scale * DONGZHUO_BOSS.scale} : undefined, attackVisual: undefined, tint: DONGZHUO_BOSS.tint, hp: DONGZHUO_BOSS.hp, speed: DONGZHUO_BOSS.speed, damage: DONGZHUO_BOSS.damage, radius: 34};
  return {
    ...base, name: '2-3 火烧洛阳', label: '第二章 · 讨伐董卓 · 洛阳', description: '董卓焚城西走 · 摧毁营寨、吕布、董卓', bossName: '董卓', bossStyle: 'dongzhuo', westStage: 3,
    // 不分波（用户：「这里不用设计波数」）：一段持续刷兵；首领（董卓）开局就站在城头
    waves: [{name: '洛阳城外', start: 0}], recruitWaves: [], bossAtStart: true,
    objective: {kind: 'destroy', count: LUOYANG.camps.length, target: '营寨', label: '摧毁营寨', limit: 9999, spots: LUOYANG.camps, doneBanner: ['营寨尽毁', '吕布跃下城头！']},
    enemies: {...base.enemies, boss},
    victoryTitle: '国贼伏诛', victoryText: '吕布斩董卓 · 讨伐董卓告捷 · 群雄并起', // 本作 2-3 末段吕布倒戈斩董卓（原写「董卓败退长安」，与流程不符）
  };
}

/** 天下地图挑战关「虎牢关 · 三英战吕布」：原第二章虎牢关的吕布战，压到 3 波。 */
/** 首胜的赤兔走马厩（mounts.ts HORSES 中 reward 为 'lubu' 的马）。 */
/** 天下地图挑战关「虎牢关 · 三英战吕布」：unlockAfter = 第二章讨董通过的关数（3 = 整章通关；2026-11-18 用户「三英战吕布是打完第二章才开的」，原为 2）。 */
export const LUBU_CHALLENGE = {unlockAfter: 3, unlockHint: '通关第二章「讨伐董卓」后开放', reward: {merits: 80, provisions: 120}, repeatReward: {merits: 30, provisions: 50}} as const;
export function lubuChallengeChapter(hulao: ChapterDef): ChapterDef {
  return {
    ...hulao, name: '虎牢关 · 三英战吕布', label: '挑战 · 虎牢关', description: '吕布横扫与蓄力冲锋 · 首通得赤兔',
    waves: ['关前哨骑', '虎牢精锐', '吕布出阵'].map((name, i) => ({name, start: i * 45})), recruitWaves: [1, 2],
    victoryTitle: '威震虎牢', victoryText: '三英战吕布 · 吕布败走',
  };
}
