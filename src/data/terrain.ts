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
export type TreeKind = 'pine' | 'bamboo' | 'broad' | 'jungle';
export interface TreeSpec extends Pt { kind?: TreeKind; size?: number }
/** 河：折线（points）+ 宽度；bridges 的 at 是沿河长度的比例（0～1），width 是桥面宽（垂直于桥的方向）。 */
export interface RiverSpec { points: Pt[]; width: number; bridges: Array<{ at: number; width: number }>; flow?: number }
export interface TerrainConfig {
  woods?: WoodsSpec[]; trees?: TreeSpec[]; rivers?: RiverSpec[];
  /** 这些圆里不长树（主将出生点、首领出场点、玩法要用的空地）。 */
  clear?: Array<Pt & { r: number }>;
}

export const TERRAIN = {
  /** 树干碰撞半径（树冠画得大，碰撞只算树干，不挡视线） */
  trunk: 22,
  /** 树的显示尺寸（世界像素）：pine / bamboo / broad */
  treeSize: { pine: 190, bamboo: 170, broad: 210, jungle: 220 } as Record<TreeKind, number>,
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
    // 第九章 樊城：城南一条汉水支流，两座木桥（与水淹七军的洪水互不干扰：洪水在第二关）
    case 'xiangfan': return stage === 1 ? {
      clear: [C0],
      rivers: [{ points: [{ x: -1500, y: 330 }, { x: -600, y: 270 }, { x: 200, y: 300 }, { x: 1500, y: 240 }], width: 150, bridges: [{ at: .3, width: 120 }, { at: .72, width: 120 }] }],
      woods: [{ x: -900, y: 620, rx: 300, ry: 140, count: 9, seed: 5, kind: 'broad' }, { x: 950, y: 600, rx: 280, ry: 140, count: 8, seed: 9, kind: 'broad' }],
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
