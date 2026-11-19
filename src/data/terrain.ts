/**
 * 战场地形层（用户 2026-11-17：「我想做更多场景比如说有树（不可摧毁）树林，河水流过，踩上去河水会减速。桥跨过河水之类的」；统筹会话定的细则）：
 * - 树 / 树林：不可摧毁的实心障碍（主将、敌兵、部曲、随从都挡住，贴着滑开不卡死）；树林 = 成簇的树，中间留能穿过的空隙；
 *   我方攻击、箭矢与敌方箭矢都穿过树（保持割草手感）；人走到树冠后面时树冠变半透明。
 * - 河：一条（可弯折的）带状水面，站在水里的人（敌我、骑兵冲锋、马超锦马冲锋都算）移动减速 40%；水面流动；刷兵 / 掉落不落在水里（落进去挪到岸上）。
 * - 桥：横跨河面、上面不减速，是过河的咽喉；每条河 1～2 座。
 * 系统在 systems/Terrain.ts，按「哪一章、第几关」配置（terrainConfigFor）。数值为开发期初值，平衡之后再调。
 */
export interface Pt { x: number; y: number }
/** 一簇树林：在椭圆里撒 count 棵树（固定随机种子，每次一样），树与树至少隔 gap，自然留出可穿行的空隙。 */
export interface WoodsSpec { x: number; y: number; rx: number; ry: number; count: number; seed: number; kind?: TreeKind; gap?: number }
/** 树种：第一张图集 terrain/trees.png（松 / 竹 / 阔叶 / 雨林）+ 第二张 terrain/trees2.png（即梦出图，用户「树增加多点在不同适合的场景」：垂柳 / 侧柏 / 白杨 / 枯树 / 棕榈 / 榕树）。 */
export type TreeKind = 'pine' | 'bamboo' | 'broad' | 'jungle' | 'willow' | 'cypress' | 'poplar' | 'dead' | 'palm' | 'banyan';
export interface TreeSpec extends Pt { kind?: TreeKind; size?: number }
/** 河：折线（points）+ 宽度；bridges 的 at 是沿河长度的比例（0～1），width 是桥面宽（垂直于桥的方向）。 */
export interface RiverSpec { points: Pt[]; width: number; bridges: Array<{ at: number; width: number }>; flow?: number }
/** 山崖 / 山坡：实心矩形（x、y 为中心），画成第七章山道的崖壁、坡上几棵松；碰撞并进场景障碍（sishuiObstacles），敌我、随行都挡，刷兵避开。 */
export interface CliffSpec { x: number; y: number; w: number; h: number }
export interface TerrainConfig {
  woods?: WoodsSpec[]; trees?: TreeSpec[]; rivers?: RiverSpec[]; cliffs?: CliffSpec[];
  /** 自动成片的树林（GROVES 表，按地域选树种）：Terrain 在开局点四周的环带里撒成簇，避开中间十字通道、障碍、营寨 / 目标。 */
  auto?: AutoGroves;
  /** 这些圆里不长树（主将出生点、首领出场点、玩法要用的空地）。 */
  clear?: Array<Pt & { r: number }>;
}

export const TERRAIN = {
  /** 树干碰撞半径（树冠画得大，碰撞只算树干，不挡视线） */
  trunk: 22,
  /** 树的显示尺寸（世界像素）：pine / bamboo / broad */
  treeSize: { pine: 190, bamboo: 170, broad: 210, jungle: 220, willow: 220, cypress: 205, poplar: 235, dead: 185, palm: 225, banyan: 250 } as Record<TreeKind, number>,
  /** 每棵树的大小浮动（±）、色调浮动（压暗 / 偏暖的最大比例）——成片的树不像复制粘贴。 */
  sizeJitter: .16, tintJitter: .22,
  /** 树图离开镜头多远就不画（每 250 毫秒按镜头开关一次可见）。 */
  cullPad: 320,
  /** 主将走到树冠后面时树冠透明度 */
  behindAlpha: .42,
  /** 在水里的移动倍率（敌我一样）：减速 40% */
  waterMul: .6,
  /** 桥两头伸出河岸的长度 */
  bridgeOverhang: 46,
  /** 水面流速（贴图滚动，像素 / 秒） */
  flow: 46,
  /** 静态树格子边长（碰撞只查附近格子） */
  cell: 160,
} as const;

const C0 = { x: 0, y: 0, r: 260 };

/**
 * 自动树林（用户 2026-11-18「树增加多点在不同适合的场景」）：
 * - 成簇：在开局点四周 ring 环带里放 groves 簇（每簇 per 棵，椭圆里撒、彼此隔开留穿行缝），一簇以一种树为主（按 mix 权重抽主树种，七成是主树种）。
 * - 路边林带 rows：沿中间十字通道两侧种一行（有缺口），像官道两旁的行道树；riverside：沿河两岸一行（垂柳 / 棕榈），避开桥头。
 * - 不挡打仗的地方：中间十字通道（半宽 corridor）、开局点附近、关卡目标 / 营寨 / 补给附近、各种障碍框（关墙、营栅、山崖）旁边都不种；
 *   minY：只在这条线以南种（城池的关：只在城外有几棵树）；城墙一类的长障碍北边（城里）一律不种。
 * - 每棵树大小 ±16%、色调略有深浅、随机左右翻。
 */
export interface AutoGroves {
  mix: Partial<Record<TreeKind, number>>; groves: number; per: [number, number]; seed: number;
  ring?: [number, number]; corridor?: number; rows?: TreeKind | false; riverside?: TreeKind; minY?: number;
}
const N_PLAIN = { poplar: 4, broad: 3, willow: 1 }, N_HILL = { pine: 3, cypress: 3, broad: 1 }, RIVER = { willow: 3, broad: 2, poplar: 1 };
const JING = { bamboo: 3, broad: 2, willow: 1 }, SOUTH = { palm: 3, banyan: 2, jungle: 2, bamboo: 1 }, WEST = { dead: 3, cypress: 2, poplar: 1 };
/** 各关自动树林（键 = 篇章.第几关）。没列的关不加：山道 7-1 / 7-2、方形场地 9-2、突围通道 9-3、成都 7-3、盘蛇谷 11-2、林中连营 10-2 / 10-3（已经够密）、攻城 / 守城。 */
export const GROVES: Readonly<Record<string, AutoGroves>> = {
  // 第一章 冀州平原：白杨、阔叶（1-1 原有四簇树林，再补几簇）
  'huangjin.1': { mix: N_PLAIN, groves: 4, per: [5, 8], seed: 101, rows: 'poplar' },
  'huangjin.2': { mix: N_PLAIN, groves: 8, per: [6, 10], seed: 102, rows: 'poplar' },
  'huangjin.3': { mix: N_PLAIN, groves: 7, per: [6, 9], seed: 103 },
  // 第二章 司隶：汜水关、虎牢一带的丘陵——松柏；荥阳野战；洛阳城外（城墙以南）焦枯的树
  'hulao.1': { mix: N_HILL, groves: 6, per: [5, 8], seed: 201 },
  'hulao.2': { mix: { broad: 3, pine: 2, poplar: 2 }, groves: 8, per: [6, 10], seed: 202, rows: 'poplar' },
  'hulao.3': { mix: { dead: 3, broad: 2, cypress: 1 }, groves: 5, per: [4, 7], seed: 203, minY: -60, ring: [900, 2600] },
  // 第三章：长安城外柏树、宛城、寿春淮南水乡
  'qunxiong.1': { mix: { cypress: 3, poplar: 2 }, groves: 4, per: [4, 6], seed: 301 },
  'qunxiong.2': { mix: { broad: 3, willow: 1 }, groves: 4, per: [3, 6], seed: 302 },
  'qunxiong.3': { mix: { willow: 3, broad: 2, bamboo: 1 }, groves: 7, per: [5, 9], seed: 303, rows: 'willow' },
  // 第四章 官渡（河北、黄河南岸）：白杨、柳、几棵枯树
  'guandu.1': { mix: { poplar: 4, willow: 2, dead: 1 }, groves: 7, per: [5, 9], seed: 401, rows: 'poplar' },
  'guandu.2': { mix: { poplar: 3, willow: 3, broad: 1 }, groves: 7, per: [5, 9], seed: 402 },
  'guandu.3': { mix: { poplar: 3, broad: 2, dead: 1 }, groves: 6, per: [5, 8], seed: 403 },
  // 第五章 荆州：长坂、赤壁江岸柳树竹子；江陵城外
  'chibi.1': { mix: RIVER, groves: 7, per: [5, 9], seed: 501, riverside: 'willow' },
  'chibi.2': { mix: { willow: 3, bamboo: 2, broad: 1 }, groves: 7, per: [5, 9], seed: 502, riverside: 'willow' },
  'chibi.3': { mix: JING, groves: 4, per: [4, 6], seed: 503 },
  // 第六章 荆南：竹、阔叶
  'jingnan.1': { mix: JING, groves: 4, per: [4, 6], seed: 601 },
  'jingnan.2': { mix: { bamboo: 3, broad: 2, pine: 1 }, groves: 5, per: [5, 8], seed: 602 },
  'jingnan.3': { mix: JING, groves: 4, per: [4, 6], seed: 603 },
  // 第八章 汉中：阳平关、定军山松柏；汉水岸柳
  'hanzhong.1': { mix: N_HILL, groves: 6, per: [5, 8], seed: 801 },
  'hanzhong.2': { mix: { cypress: 3, pine: 3 }, groves: 4, per: [4, 7], seed: 802 },
  'hanzhong.3': { mix: { pine: 2, willow: 2, cypress: 1 }, groves: 6, per: [5, 8], seed: 803, riverside: 'willow' },
  // 第九章 樊城：汉水支流两岸柳树
  'xiangfan.1': { mix: RIVER, groves: 5, per: [4, 7], seed: 901, riverside: 'willow' },
  // 第十章 猇亭：江边湿地竹林、阔叶
  'yiling.1': { mix: { bamboo: 3, broad: 2, willow: 2 }, groves: 7, per: [5, 9], seed: 1001 },
  // 第十一章 南中：棕榈、榕树、雨林
  'nanzheng.1': { mix: SOUTH, groves: 6, per: [4, 8], seed: 1101, riverside: 'palm' },
  'nanzheng.3': { mix: { palm: 3, banyan: 2 }, groves: 4, per: [3, 6], seed: 1103, ring: [1100, 2600] },
  // 第十二章 陇右 / 关中：街亭、五丈原稀疏枯树、柏、白杨；陈仓城外
  'beifa.1': { mix: WEST, groves: 6, per: [3, 6], seed: 1201 },
  'beifa.2': { mix: WEST, groves: 3, per: [3, 5], seed: 1202 },
  'beifa.3': { mix: { dead: 3, poplar: 2, willow: 1 }, groves: 6, per: [3, 6], seed: 1203, riverside: 'willow' },
};

/** 第七章入蜀：山道两侧坡下的松林 / 竹林（不挡中间的路，留穿插空隙）。 */
function shuTrees(halfW: number, y0: number, y1: number, seed: number): TreeSpec[] {
  const out: TreeSpec[] = []; let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let y = y1 - 160; y > y0 + 200; y -= 150 + rnd() * 120) {
    for (const side of [-1, 1]) {
      if (rnd() < .28) continue; // 留缺口
      const x = side * (halfW - 50 - rnd() * 70);
      out.push({ x, y: y + (rnd() - .5) * 60, kind: rnd() < .55 ? 'pine' : 'bamboo' });
    }
    if (rnd() < .18) out.push({ x: (rnd() - .5) * halfW * .9, y: y - 70, kind: 'pine' }); // 偶有一棵立在路中，绕着走
  }
  return out;
}

/**
 * 各关地形。arc 为篇章（GameScene.hardKey()：第一章 'huangjin'、第七章 'shu'、第九章 'xiangfan'、第十章 'yiling'、第十一章 'nanzheng'），stage 为第几关。
 * 没配的关返回 null（不建地形层）。
 */
export function terrainConfigFor(arc: string, stage: number): TerrainConfig | null {
  const base = baseTerrain(arc, stage), g = GROVES[arc + '.' + stage];
  return g ? { ...(base ?? { clear: [C0] }), auto: g } : base;
}
function baseTerrain(arc: string, stage: number): TerrainConfig | null {
  switch (arc) {
    // 第一章 广宗外围：城外树林（四簇，中间空地开打）
    case 'huangjin': return stage === 1 ? {
      clear: [C0],
      woods: [
        { x: -720, y: -320, rx: 330, ry: 210, count: 15, seed: 11, kind: 'broad' },
        { x: 760, y: 280, rx: 340, ry: 220, count: 15, seed: 23, kind: 'broad' },
        { x: -260, y: 700, rx: 300, ry: 170, count: 11, seed: 37, kind: 'pine' },
        { x: 470, y: -620, rx: 220, ry: 150, count: 8, seed: 41, kind: 'pine' },
      ],
    } : null;
    // 第七章 入蜀：山道两侧松竹林
    case 'shu': return stage === 1 ? { trees: shuTrees(300, -4200, 2200, 7) } : stage === 2 ? { trees: shuTrees(260, -4200, 2200, 19) } : null;
    // 第五章 赤壁（全场景审查 P1：原来一格水都没有）：北面横贯一段大江（长江，宽 340，规则同其它河：水里减速），两座浮桥渡江；
    // 曹军水寨在北岸（systems/ChibiRiverCamp.ts 摆布景）。江心在 y≈-720，躲开南岸伏弓营（y -400）；刷兵 / 掉落不落在江里（Terrain.free）
    // 第五章 长坂（全场景审查 P2：剧本里张飞「据水断桥」却没河）：北面一条河、一座长坂桥（在北岸营地后面，不挡开局空地）
    case 'chibi': return stage === 1 ? {
      clear: [C0],
      rivers: [{ points: [{ x: -2600, y: -700 }, { x: -1100, y: -740 }, { x: 0, y: -690 }, { x: 1200, y: -760 }, { x: 2600, y: -720 }], width: 180, bridges: [{ at: .5, width: 150 }] }],
    } : stage === 2 ? {
      clear: [C0],
      rivers: [{ points: [{ x: -2600, y: -700 }, { x: -1250, y: -760 }, { x: 0, y: -690 }, { x: 1300, y: -770 }, { x: 2600, y: -710 }], width: 340, bridges: [{ at: .35, width: 130 }, { at: .68, width: 130 }] }],
    } : null;
    // 第九章 樊城：城南一条汉水支流，两座木桥（与水淹七军的洪水互不干扰：洪水在第二关）
    case 'xiangfan': return stage === 1 ? {
      clear: [C0],
      rivers: [{ points: [{ x: -1500, y: 330 }, { x: -600, y: 270 }, { x: 200, y: 300 }, { x: 1500, y: 240 }], width: 150, bridges: [{ at: .3, width: 120 }, { at: .72, width: 120 }] }],
      woods: [{ x: -900, y: 620, rx: 300, ry: 140, count: 9, seed: 5, kind: 'broad' }, { x: 950, y: 600, rx: 280, ry: 140, count: 8, seed: 9, kind: 'broad' }],
    } : null;
    // 第六章 零陵武陵（P2：「山越据险、林间弓手」原来是空地）：东西两侧山崖各留一道山口，崖前林子
    case 'jingnan': return stage === 2 ? {
      clear: [C0, { x: -270, y: 340, r: 200 }, { x: 290, y: -400, r: 200 }],
      cliffs: [{ x: -1150, y: -250, w: 500, h: 800 }, { x: -1150, y: 850, w: 500, h: 600 }, { x: 1150, y: 250, w: 500, h: 900 }, { x: 1150, y: -900, w: 500, h: 400 }],
      woods: [
        { x: -720, y: -640, rx: 240, ry: 150, count: 9, seed: 91, kind: 'pine' },
        { x: 760, y: 660, rx: 240, ry: 150, count: 9, seed: 97, kind: 'broad' },
        { x: -700, y: 620, rx: 200, ry: 130, count: 6, seed: 99, kind: 'bamboo' },
      ],
    } : null;
    // 第八章 定军山（P2：「高地」只是小土包）：北面一道山脊（中间一处山口），两处山头外侧松林；汉水（P2：关名叫汉水却没河）：北面汉水、两座桥
    case 'hanzhong': return stage === 2 ? {
      clear: [C0, { x: 380, y: -220, r: 210 }, { x: -400, y: 210, r: 210 }, { x: -270, y: 340, r: 180 }, { x: 290, y: -400, r: 180 }],
      cliffs: [{ x: -700, y: -1000, w: 1300, h: 340 }, { x: 1000, y: -1040, w: 900, h: 340 }],
      woods: [
        { x: 760, y: -380, rx: 200, ry: 130, count: 7, seed: 83, kind: 'pine' },
        { x: -780, y: 400, rx: 200, ry: 130, count: 7, seed: 89, kind: 'pine' },
        { x: -150, y: -720, rx: 260, ry: 110, count: 7, seed: 87, kind: 'pine' },
      ],
    } : stage === 3 ? {
      clear: [C0, { x: 380, y: -220, r: 210 }, { x: -400, y: 210, r: 210 }],
      rivers: [{ points: [{ x: -2600, y: -760 }, { x: -1300, y: -720 }, { x: 0, y: -800 }, { x: 1300, y: -740 }, { x: 2600, y: -790 }], width: 260, bridges: [{ at: .3, width: 140 }, { at: .7, width: 140 }] }],
    } : null;
    // 第十二章 街亭（P2：马谡上的「南山」没有）：南面一座山（崖壁 + 坡前松林）；五丈原（P2：渭水没体现）：南面渭水、两座桥
    case 'beifa': return stage === 1 ? {
      clear: [C0, { x: -600, y: 420, r: 170 }, { x: 380, y: -170, r: 160 }, { x: -340, y: 200, r: 180 }],
      cliffs: [{ x: -100, y: 980, w: 1700, h: 440 }],
      woods: [{ x: -880, y: 680, rx: 220, ry: 120, count: 7, seed: 107, kind: 'pine' }, { x: 760, y: 700, rx: 220, ry: 120, count: 7, seed: 109, kind: 'pine' }],
    } : stage === 3 ? {
      clear: [C0],
      rivers: [{ points: [{ x: -2600, y: 760 }, { x: -1200, y: 820 }, { x: 0, y: 740 }, { x: 1300, y: 810 }, { x: 2600, y: 770 }], width: 240, bridges: [{ at: .3, width: 140 }, { at: .72, width: 140 }] }],
    } : null;
    // 第十章 夷陵：林中连营（火烧连营里树会被点着，烧完成焦桩、不再挡路）
    case 'yiling': return stage === 2 || stage === 3 ? {
      clear: [C0],
      woods: [
        { x: -700, y: -420, rx: 320, ry: 200, count: 14, seed: 3 + stage, kind: 'broad' },
        { x: 720, y: -380, rx: 300, ry: 200, count: 13, seed: 13 + stage, kind: 'pine' },
        { x: -620, y: 520, rx: 300, ry: 190, count: 12, seed: 29 + stage, kind: 'pine' },
        { x: 680, y: 560, rx: 320, ry: 190, count: 13, seed: 31 + stage, kind: 'broad' },
      ],
    } : null;
    // 第十一章 南征：泸水（第一关一条河 + 丛林），孟获蛮洞（第三关密林）
    case 'nanzheng': return stage === 1 ? {
      clear: [C0, { x: 0, y: -520, r: 120 }, { x: 760, y: 420, r: 120 }],
      rivers: [{ points: [{ x: -1500, y: -40 }, { x: -700, y: -100 }, { x: 100, y: -70 }, { x: 1500, y: -110 }], width: 120, bridges: [{ at: .38, width: 110 }, { at: .8, width: 110 }] }],
      woods: [
        { x: -1050, y: -520, rx: 260, ry: 160, count: 10, seed: 17, kind: 'bamboo' },
        { x: 1100, y: 420, rx: 280, ry: 170, count: 11, seed: 43, kind: 'bamboo' },
        { x: 120, y: 620, rx: 260, ry: 140, count: 9, seed: 53, kind: 'jungle' },
      ],
    } : stage === 2 ? {
      // 盘蛇谷（P2：原来是空地）：南北向谷道（半宽约 620），两侧山崖、崖下丛林；营地在谷里
      clear: [C0, { x: -330, y: 210, r: 180 }, { x: 340, y: -420, r: 180 }],
      cliffs: [{ x: -900, y: 0, w: 560, h: 3600 }, { x: 900, y: 0, w: 560, h: 3600 }],
      woods: [
        { x: -500, y: -720, rx: 110, ry: 280, count: 7, seed: 101, kind: 'jungle' },
        { x: 510, y: 660, rx: 110, ry: 280, count: 7, seed: 103, kind: 'jungle' },
        { x: -500, y: 900, rx: 110, ry: 200, count: 5, seed: 105, kind: 'bamboo' },
      ],
    } : stage === 3 ? {
      clear: [C0, { x: -260, y: -200, r: 110 }, { x: 280, y: 260, r: 110 }, { x: 0, y: -560, r: 110 }],
      woods: [
        { x: -760, y: -300, rx: 340, ry: 230, count: 16, seed: 61, kind: 'bamboo' },
        { x: 780, y: 320, rx: 340, ry: 230, count: 16, seed: 67, kind: 'jungle' },
        { x: -560, y: 600, rx: 300, ry: 170, count: 11, seed: 71, kind: 'jungle' },
        { x: 600, y: -620, rx: 280, ry: 160, count: 10, seed: 73, kind: 'bamboo' },
      ],
    } : null;
    default: return null;
  }
}
