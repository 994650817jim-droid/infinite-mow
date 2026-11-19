/**
 * 义军营寨的营帐与兵士（用户 2026-11-17：「义军营寨也要做些效果，像城市一样，有帐篷有人填充一下空地，现在有点太空了」）。
 * 只在营寨档（citySize === 1）画；升县城以后沿用城市的民居 / 居民。纯装饰：不接收点击、画在所有建筑与牌匾之下，不挡建筑点击、按钮和顶部文字。
 * - 物件：我方营帐 / 大旗（攻城 v2 图 siege_mid_ram 帧 7 / 6）、营地道具（yellow_props：兵器架、盾牌堆、木箱、粮袋、辎重车、火塘、吊锅、木桩）、火盆（手绘燃烧 8 帧）。
 *   候选位置写在 CAMP_PROPS（全景像素 1536×1024），运行时去掉压到建筑（按建筑贴图真实外框）或彼此重叠的。
 * - 兵士：v2 刀盾 / 长枪 / 弓兵行走图沿栅栏巡逻、在营帐间走动；校场有 2–3 人对着木桩操练（播攻击帧）；火塘边 1–2 人站着。
 * - 动态：大旗轻摆、火塘冒烟（手绘扬尘序列帧染灰上飘，不用程序粒子）、走动扬起一点尘（同一套扬尘帧，稀疏）。
 * 人数 / 物件都有上限，精灵池化，每帧只更新这些对象（不全量扫描）。
 * 还缺的图（交美术会话）：练兵木人桩、义军「义」字大旗（现借攻城我方大旗）、营寨专用火塘（现借营地火盆）。
 */
import Phaser from 'phaser';
import { playSheet } from '../systems/SkillFxSheets';
import { TITLE_FONT } from '../config';

type PropKind = 'tent' | 'flag' | 'fire' | 'brazier' | 'rack' | 'shields' | 'crates' | 'sacks' | 'cart' | 'pot' | 'post' | 'rail' | 'fodder' | 'horse' | 'canopy' | 'barrels'
  | 'tentb' | 'yurt' | 'tents' | 'palisade' | 'gate' | 'spears' | 'weapons' | 'bows' | 'jars' | 'sacks2' | 'crates2' | 'cart2' | 'wheels';
/** 候选物件（全景像素：底边中心 x,y；w 显示宽）。按顺序放，压到建筑或已放物件的跳过。 */
export const CAMP_PROPS: Array<{ x: number; y: number; w: number; kind: PropKind; flip?: boolean }> = [
  // 11-18 用户「丰富义军营寨更多空地」——按用途成组：马厩上方拴马桩 + 两匹马 + 草料；主帐门前两面「义」旗；主帐与军营之间的辎重棚
  { x: 1300, y: 788, w: 110, kind: 'rail' }, { x: 1262, y: 795, w: 92, kind: 'horse' }, { x: 1342, y: 797, w: 92, kind: 'horse', flip: true }, { x: 1470, y: 795, w: 72, kind: 'fodder' },
  { x: 735, y: 738, w: 66, kind: 'flag' }, { x: 1165, y: 738, w: 66, kind: 'flag' },
  { x: 1268, y: 660, w: 104, kind: 'canopy' }, { x: 1365, y: 672, w: 52, kind: 'barrels' },
  // 右侧营区：营帐一片，中间火塘
  { x: 1190, y: 345, w: 175, kind: 'tent' }, { x: 1355, y: 360, w: 165, kind: 'tent', flip: true }, { x: 1490, y: 400, w: 140, kind: 'tent' },
  { x: 1470, y: 520, w: 130, kind: 'tent' },
  { x: 1250, y: 480, w: 64, kind: 'fire' }, { x: 1298, y: 478, w: 54, kind: 'pot' },
  { x: 1010, y: 300, w: 100, kind: 'flag' }, { x: 700, y: 520, w: 120, kind: 'flag' }, { x: 360, y: 700, w: 120, kind: 'flag' },
  // 中路两侧：营帐、兵器架
  { x: 600, y: 330, w: 165, kind: 'tent' }, { x: 735, y: 320, w: 150, kind: 'tent', flip: true },
  { x: 440, y: 300, w: 140, kind: 'tent' }, { x: 140, y: 335, w: 150, kind: 'tent', flip: true },
  { x: 660, y: 420, w: 74, kind: 'rack' }, { x: 735, y: 430, w: 70, kind: 'shields' },
  // 左侧校场：木桩、兵器架
  { x: 215, y: 565, w: 62, kind: 'post' }, { x: 300, y: 585, w: 62, kind: 'post' }, { x: 120, y: 600, w: 72, kind: 'rack' },
  // 辎重：粮袋、木箱、辎重车
  { x: 1000, y: 310, w: 70, kind: 'sacks' }, { x: 960, y: 330, w: 64, kind: 'crates' }, { x: 1500, y: 300, w: 110, kind: 'cart' },
  { x: 1500, y: 840, w: 100, kind: 'cart', flip: true }, { x: 650, y: 980, w: 72, kind: 'crates' }, { x: 560, y: 960, w: 68, kind: 'sacks' },
  // 前排：火盆、营帐
  { x: 860, y: 905, w: 56, kind: 'brazier' }, { x: 1010, y: 925, w: 150, kind: 'tent' }, { x: 520, y: 760, w: 140, kind: 'tent', flip: true },
  // 军营门前操练用的木人桩
  { x: 1100, y: 815, w: 52, kind: 'post' },
  // 11-18 用户「义军营寨放多点帐篷和画面整个屏幕」：全屏放大后看得到的空地补营帐、粮堆、兵器架、小旗（都避开建筑与上面已放的）
  { x: 110, y: 440, w: 120, kind: 'tent', flip: true }, 
  { x: 660, y: 700, w: 110, kind: 'tent', flip: true }, { x: 250, y: 720, w: 130, kind: 'tent' },
  { x: 790, y: 1015, w: 120, kind: 'tent' }, { x: 40, y: 560, w: 60, kind: 'barrels' },
  { x: 160, y: 1010, w: 60, kind: 'sacks' }, { x: 410, y: 1000, w: 120, kind: 'tent', flip: true },
];
/**
 * 密集布置（用户 11-18「我觉得营寨还是很多空地」）：一簇簇营帐沿路排开、辎重场、兵器架、练兵场、马厩旁营帐。
 * 与 CAMP_PROPS 不同：彼此可以挨着（允许压边 DENSE_OVERLAP 像素），但不压建筑、不压路面（CAMP_ROADS 中线两侧 ROAD_HALF 内不放）；
 * 每件按序号轻微染色（DENSE_TINTS），同一张图看起来不重样。全是静态图，不加动画。
 */
export const CAMP_DENSE: Array<{ x: number; y: number; w: number; kind: PropKind; flip?: boolean }> = [
  // 西北：路北两排营帐
  { x: 60, y: 350, w: 100, kind: 'tentb' }, { x: 150, y: 365, w: 78, kind: 'tents', flip: true }, { x: 35, y: 392, w: 40, kind: 'jars' },
  { x: 470, y: 335, w: 120, kind: 'tent' }, { x: 585, y: 330, w: 108, kind: 'tentb', flip: true }, { x: 690, y: 330, w: 98, kind: 'yurt' },
  { x: 455, y: 385, w: 86, kind: 'tents' }, { x: 545, y: 382, w: 54, kind: 'crates' }, { x: 625, y: 388, w: 112, kind: 'tent', flip: true }, { x: 722, y: 380, w: 48, kind: 'sacks2' },
  // 北路口辎重场：车、粮袋、木箱、坛罐
  { x: 990, y: 382, w: 92, kind: 'cart' }, { x: 1062, y: 362, w: 50, kind: 'sacks' }, { x: 948, y: 425, w: 56, kind: 'crates2' }, { x: 1078, y: 415, w: 44, kind: 'jars' }, { x: 1022, y: 440, w: 46, kind: 'sacks2', flip: true },
  // 主帐西侧：兵器架
  { x: 700, y: 612, w: 58, kind: 'spears' }, { x: 742, y: 700, w: 50, kind: 'shields' }, { x: 742, y: 590, w: 46, kind: 'jars' },
  // 西侧练兵场：弓架、枪架、栅栏
  { x: 280, y: 662, w: 58, kind: 'bows' }, { x: 112, y: 692, w: 104, kind: 'palisade' }, { x: 340, y: 630, w: 56, kind: 'weapons', flip: true },
  // 讲武堂与大路之间
  { x: 420, y: 692, w: 44, kind: 'jars' }, { x: 402, y: 762, w: 56, kind: 'spears', flip: true }, { x: 452, y: 742, w: 48, kind: 'sacks2' },
  // 主帐南、大路东：营帐一簇
  { x: 728, y: 846, w: 100, kind: 'tentb' }, { x: 792, y: 862, w: 46, kind: 'sacks' },
  // 军营西侧：粮袋、坛罐
  { x: 900, y: 962, w: 50, kind: 'sacks2' }, { x: 918, y: 1004, w: 44, kind: 'jars', flip: true },
  // 东侧马厩一带：营帐、车轮、坛罐
  { x: 1462, y: 722, w: 108, kind: 'tentb', flip: true }, { x: 1172, y: 722, w: 72, kind: 'tents' }, { x: 1515, y: 868, w: 50, kind: 'wheels' }, { x: 1515, y: 1012, w: 46, kind: 'jars' },
  // 东北营区外圈：再补一顶、栅门
  { x: 1120, y: 300, w: 92, kind: 'yurt', flip: true }, { x: 1505, y: 470, w: 64, kind: 'crates2' },
];
const DENSE_OVERLAP = 12, ROAD_HALF = 24;
const DENSE_TINTS = [0xffffff, 0xf3e7da, 0xe9dccb, 0xfff4e6];
/** 底图上的路（中线，全景像素）：密集布置不压上去，路面保持清楚。 */
export const CAMP_ROADS: Array<Array<[number, number]>> = [
  [[900, 262], [880, 330], [800, 400], [700, 450], [620, 520], [540, 600], [505, 700], [560, 800], [650, 900], [720, 1024]], // 城门 → 西南大路
  [[700, 445], [600, 425], [500, 415], [400, 412], [300, 410], [200, 415], [100, 420], [0, 430]], // 西路
  [[860, 300], [990, 275]], // 城门东岔
  [[1000, 510], [1150, 530], [1300, 560], [1536, 620]], [[1180, 515], [1360, 470], [1536, 450]], // 东路两岔
];
const distToRoad = (x: number, y: number) => { let best = Infinity; for (const r of CAMP_ROADS) for (let i = 0; i + 1 < r.length; i++) { const [ax, ay] = r[i], [bx, by] = r[i + 1], dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return best; };

/** 兵士走的路线（全景像素）；压到建筑的路线运行时去掉。巡逻 / 走动都在上面来回。 */
export const CAMP_PATHS: Array<Array<[number, number]>> = [
  [[140, 292], [760, 292], [1480, 292]], // 沿栅栏巡逻
  [[1480, 292], [900, 292], [160, 292]],
  [[1170, 420], [1300, 420], [1450, 450], [1420, 560]], // 营区之间
  [[880, 285], [820, 360], [700, 470], [640, 560]], // 中路
  [[560, 720], [610, 860], [700, 1000]], // 前路
  [[90, 470], [200, 500], [320, 520]], // 校场
  [[930, 860], [800, 940], [700, 1000]],
  [[400, 470], [560, 480], [620, 380]], // 西北营帐之间（全屏放大后可见）
  [[600, 640], [760, 720], [790, 900]], // 讲武堂与主帐之间
];
/** 校场操练位（对着木桩出招）与火塘边站位。 */
const DRILL_SPOTS: Array<{ x: number; y: number; dir: 'left' | 'right' }> = [{ x: 255, y: 640, dir: 'left' }, { x: 175, y: 640, dir: 'right' }, { x: 345, y: 640, dir: 'left' },
  // 军营门前：两人对着木人桩操练（木人桩见 CAMP_PROPS 末尾）
  { x: 1052, y: 830, dir: 'right' }, { x: 1150, y: 832, dir: 'left' }];
const IDLE_SPOTS: Array<{ x: number; y: number; dir: 'left' | 'right' | 'down' }> = [{ x: 1205, y: 505, dir: 'right' }, { x: 1300, y: 515, dir: 'left' }];
/** 走动的兵（11-18：加了军营门前两名操练的，走动的从 9 减到 7，总人数仍在 14 上下，不挤） */
export const CAMP_MAX_WALKERS = 10; // 11-18 全屏放大、营帐变多后加到 10

const SHEETS = {
  sw: { key: 'camp_sw_walk', url: 'assets/processed-v2/troops/swordsman_walk.png' },
  sp: { key: 'camp_sp_walk', url: 'assets/processed-v2/troops/spearman_walk.png' },
  ar: { key: 'camp_ar_walk', url: 'assets/processed-v2/troops/archer_walk.png' },
  swA: { key: 'camp_sw_atk', url: 'assets/processed-v2/troops/swordsman_attack.png' },
  spA: { key: 'camp_sp_atk', url: 'assets/processed-v2/troops/spearman_attack.png' },
} as const;
const RAM = { key: 'siege_mid_ram', url: 'assets/siege-v2/ram.png' };
/** 拴着的马：v2 通用马行走表（4 方向 × 4 帧，每格 288）取站立帧，按毛色乘色；独立键，不干扰战斗里的马。 */
/** 草料堆 / 拴马桩（即梦 Seedream 5.5，11-18，tools/prepare-camp-hay.mjs）：2 帧横排，每帧 256，0 草料堆、1 拴马桩；缺图时退回营地道具里的粮袋 / 木栏帧。 */
const HAY = { key: 'camp_hay_rail', url: 'assets/props-v2/camp-hay-rail.png', cell: 256 };
const HORSE = { key: 'camp_horse', url: 'assets/horses-v2/generic_walk.png', cell: 288, tints: [0xb59a7a, 0x8a6a4c] };
/** 营地道具 / 火盆 / 扬尘：战斗里另有同图的键（yellow_props / brazier_burning 会在开战时被换图），这里用独立键载入，不干扰战斗的载入与换图。 */
const PROPS = { key: 'camp_props_v2', url: 'assets/props-v2/camp-props.png', cell: 128 }, BRAZIER = { key: 'camp_brazier', url: 'assets/props-v2/brazier_burning.png', cell: 444 }, DUST = { key: 'fx_collapse_dust', url: 'assets/skill-fx/collapse_dust.png', cell: 256 };
/** 营寨专用图（美术会话 11-17）：「义」字大旗（1 帧，旗面空白，字用标题字体叠上去；旗杆在帧内 x≈73）、营寨火塘（8 帧，只换火苗）、木人桩（3 帧：站直 / 被击右歪 / 回弹左歪）。缺图时退回上面借用的图。 */
const CAMP_ART = { banner: { key: 'camp_banner', url: 'assets/props-v2/camp-banner.png', w: 256, h: 512, poleX: 73, cloth: { x: 155, y: 228 } }, firepit: { key: 'camp_firepit', url: 'assets/props-v2/camp-firepit.png', cell: 256 }, dummy: { key: 'camp_dummy', url: 'assets/props-v2/camp-dummy.png', cell: 256 } } as const;
/** 营寨档（大殿 1 级）用营寨风建筑图的建筑（public/assets/city/camp_<id>.webp，画布同 Lv1 图）。 */
export const CAMP_ART_IDS = ['hall', 'talent', 'academy', 'barracks'] as const;
const DIRS = ['down', 'left', 'right', 'up'] as const;
type Box = { l: number; r: number; t: number; b: number };

/** CityScene.preload 里调用：载入营寨装饰要用的图（已载的跳过）。 */
export function loadCampLife(scene: Phaser.Scene): void {
  for (const s of Object.values(SHEETS)) if (!scene.textures.exists(s.key)) scene.load.image(s.key, s.url);
  if (!scene.textures.exists(RAM.key)) scene.load.spritesheet(RAM.key, RAM.url, { frameWidth: 256, frameHeight: 256 });
  for (const a of [PROPS, BRAZIER, DUST, CAMP_ART.firepit, CAMP_ART.dummy, HORSE, HAY]) if (!scene.textures.exists(a.key)) scene.load.spritesheet(a.key, a.url, { frameWidth: a.cell, frameHeight: a.cell });
  if (!scene.textures.exists(CAMP_ART.banner.key)) scene.load.image(CAMP_ART.banner.key, CAMP_ART.banner.url);
}
function sliceSheet(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key)) return false;
  const t = scene.textures.get(key); if (t.has('down_0')) return true;
  const src = t.getSourceImage() as { width: number }, cell = src.width / 4;
  DIRS.forEach((d, row) => { for (let c = 0; c < 4; c++) t.add(`${d}_${c}`, 0, c * cell, row * cell, cell, cell); });
  return true;
}

interface Walker { img: Phaser.GameObjects.Image; key: string; path: Array<[number, number]>; seg: number; t: number; dir: 1 | -1; speed: number; pause: number; frame: number; dustAt: number }
interface Driller { img: Phaser.GameObjects.Image; key: string; dir: string; t: number; rest: number }

export class CampLife {
  readonly root: Phaser.GameObjects.Container;
  /** 没放上的密集布置（调试 / 测试读）：种类@坐标:原因。 */
  readonly skippedDense: string[] = [];
  readonly stats = { props: 0, walkers: 0, drillers: 0, idlers: 0, skippedProps: 0, skippedPaths: 0, dense: 0, skippedDense: 0 };
  private walkers: Walker[] = []; private drillers: Driller[] = []; private flags: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Container> = []; private dummies: Phaser.GameObjects.Image[] = []; private drillDummy = new Map<Driller, Phaser.GameObjects.Image>();
  private fires: Array<{ x: number; y: number; img?: Phaser.GameObjects.Image }> = [];
  private smokeAt = 0; private sortAt = 0; private clock = 0; private horses = 0;

  /** blocked：建筑贴图外框（全景像素）；装饰与路线不得压上去。 */
  constructor(private scene: Phaser.Scene, private k: number, blocked: Box[]) {
    this.root = scene.add.container(0, 0).setName('camp-life');
    const pad = 14, hit = (b: Box, o: Box) => b.l < o.r + pad && b.r > o.l - pad && b.t < o.b + pad && b.b > o.t - pad;
    const placed: Box[] = [], feet: Box[] = [];
    /** 落地占位（底边往上最多 44 像素）：密集布置只看它，前后挨着靠绘制顺序（按 y）分层，旗杆身后也能放营帐。 */
    const foot = (b: Box): Box => ({ l: b.l, r: b.r, b: b.b, t: Math.max(b.t, b.b - 44) });
    for (const p of CAMP_PROPS) {
      const h = p.kind === 'tent' ? p.w * .78 : p.kind === 'flag' ? p.w * 2 : p.w * .9; // 「义」字大旗画布 1:2
      const box = { l: p.x - p.w / 2, r: p.x + p.w / 2, t: p.y - h, b: p.y };
      // 拴着的马本来就站在拴马桩跟前：只避开建筑，不和别的装饰互相让
      if (blocked.some(o => hit(box, o)) || (p.kind !== 'horse' && placed.some(o => hit(box, o)))) { this.stats.skippedProps++; continue; }
      if (this.addProp(p)) { placed.push(box); feet.push(foot(box)); this.stats.props++; }
    }
    // 密集布置：可以彼此挨着，但不压建筑、不压路面
    const tight = (b: Box, o: Box) => b.l < o.r - DENSE_OVERLAP && b.r > o.l + DENSE_OVERLAP && b.t < o.b - DENSE_OVERLAP && b.b > o.t + DENSE_OVERLAP;
    CAMP_DENSE.forEach((p, i) => {
      const h = p.w * (/tent|yurt/.test(p.kind) ? .78 : .9), box = { l: p.x - p.w / 2, r: p.x + p.w / 2, t: p.y - h, b: p.y };
      const onRoad = [[p.x, p.y], [p.x - p.w * .35, p.y], [p.x + p.w * .35, p.y]].some(([x, y]) => distToRoad(x, y) < ROAD_HALF);
      const why = onRoad ? 'road' : blocked.some(o => hit(box, o)) ? 'building' : feet.some(o => tight(foot(box), o)) ? 'prop' : '';
      if (why) { this.stats.skippedProps++; this.stats.skippedDense++; this.skippedDense.push(`${p.kind}@${p.x},${p.y}:${why}`); return; }
      const img = this.addProp(p); if (img) { placed.push(box); feet.push(foot(box)); this.stats.props++; this.stats.dense++; this.root.list.at(-1) && (this.root.list.at(-1) as Phaser.GameObjects.Image).setTint?.(DENSE_TINTS[i % DENSE_TINTS.length]); }
    });
    // 兵士
    const okPath = (path: Array<[number, number]>) => { for (let i = 0; i + 1 < path.length; i++) { const [ax, ay] = path[i], [bx, by] = path[i + 1]; for (let s = 0; s <= 8; s++) { const x = ax + (bx - ax) * s / 8, y = ay + (by - ay) * s / 8; if (blocked.some(o => x > o.l - 20 && x < o.r + 20 && y > o.t && y < o.b + 30)) return false; } } return true; };
    const paths = CAMP_PATHS.filter(p => okPath(p) || (this.stats.skippedPaths++, false));
    const walkKeys = [SHEETS.sp.key, SHEETS.sw.key, SHEETS.ar.key, SHEETS.sw.key].filter(k2 => sliceSheet(scene, k2));
    if (walkKeys.length && paths.length) for (let i = 0; i < CAMP_MAX_WALKERS; i++) {
      const key = walkKeys[i % walkKeys.length], path = paths[i % paths.length];
      const img = scene.add.image(0, 0, key, 'down_0').setOrigin(.5, .92).setName('camp-walker-' + i); this.scaleMan(img); this.root.add(img);
      this.walkers.push({ img, key, path, seg: 0, t: Math.random(), dir: Math.random() < .5 ? 1 : -1, speed: 22 + Math.random() * 16, pause: Math.random() * 2, frame: Math.random() * 4, dustAt: 0 });
    }
    this.stats.walkers = this.walkers.length;
    // 校场操练（攻击帧循环）
    const atkKeys = [SHEETS.swA.key, SHEETS.spA.key].filter(k2 => sliceSheet(scene, k2));
    if (atkKeys.length) DRILL_SPOTS.forEach((d, i) => {
      if (blocked.some(o => d.x > o.l && d.x < o.r && d.y > o.t && d.y < o.b)) return;
      const key = atkKeys[i % atkKeys.length], img = scene.add.image(d.x * k, d.y * k, key, d.dir + '_0').setOrigin(.5, .92).setName('camp-drill-' + i);
      this.scaleMan(img, 1.3); this.root.add(img); this.drillers.push({ img, key, dir: d.dir, t: i * .7, rest: 0 });
    });
    this.stats.drillers = this.drillers.length;
    // 每个操练的兵对着最近的木人桩：出招那一帧木人桩被打歪、再回弹
    if (this.dummies.length) for (const d of this.drillers) { let best = this.dummies[0]; for (const m of this.dummies) if (Math.hypot(m.x - d.img.x, m.y - d.img.y) < Math.hypot(best.x - d.img.x, best.y - d.img.y)) best = m; this.drillDummy.set(d, best); }
    // 火塘边站着的
    if (this.fires.length && walkKeys.length) IDLE_SPOTS.forEach((s, i) => {
      if (blocked.some(o => s.x > o.l && s.x < o.r && s.y > o.t && s.y < o.b)) return;
      const img = scene.add.image(s.x * k, s.y * k, walkKeys[(i + 1) % walkKeys.length], s.dir + '_0').setOrigin(.5, .92).setName('camp-idle-' + i);
      this.scaleMan(img); this.root.add(img); this.stats.idlers++;
    });
    this.sortByY();
  }
  private scaleMan(img: Phaser.GameObjects.Image, mul = 1) { img.setScale(this.k * 46 / img.frame.height * 1.6 * mul); }
  private addProp(p: (typeof CAMP_PROPS)[number]): boolean {
    const sc = this.scene, k = this.k;
    const img = (key: string, frame: number | string, w: number, h = w) => { const i = sc.add.image(p.x * k, p.y * k, key, frame).setOrigin(.5, .92).setDisplaySize(w * k, h * k).setFlipX(!!p.flip).setName('camp-prop-' + p.kind); this.root.add(i); return i; };
    const camp = sc.textures.exists(PROPS.key), ram = sc.textures.exists(RAM.key);
    switch (p.kind) {
      case 'tent': if (ram) { img(RAM.key, 7, p.w); return true; } if (camp) { img(PROPS.key, 1, p.w); return true; } return false;
      case 'flag': if (sc.textures.exists(CAMP_ART.banner.key)) {
        // 「义」字大旗：旗杆底座为转轴（摆动时旗面带着字一起摆）
        const B = CAMP_ART.banner, w = p.w * k, h = w * B.h / B.w, s = w / B.w;
        const c = sc.add.container(p.x * k, p.y * k).setName('camp-prop-flag');
        c.add(sc.add.image(0, 0, B.key).setOrigin(B.poleX / B.w, .98).setDisplaySize(w, h));
        c.add(sc.add.text((B.cloth.x - B.poleX) * s, (B.cloth.y - B.h * .98) * s, '义', { fontFamily: TITLE_FONT, fontSize: Math.round(w * .42) + 'px', color: '#1c0f08', resolution: 2 }).setOrigin(.5).setAlpha(.9));
        this.root.add(c); this.flags.push(c); return true;
      }
      if (ram) { const f = img(RAM.key, 6, p.w); f.setOrigin(.5, .95); this.flags.push(f); return true; } return false;
      case 'fire': if (sc.textures.exists(CAMP_ART.firepit.key)) { const f = img(CAMP_ART.firepit.key, 0, p.w * 1.5); this.fires.push({ x: p.x, y: p.y - p.w * .45, img: f }); return true; }
        if (camp) { img(PROPS.key, 30, p.w); this.fires.push({ x: p.x, y: p.y }); return true; } return false;
      case 'brazier': if (sc.textures.exists(BRAZIER.key)) { const b = img(BRAZIER.key, 0, p.w); this.fires.push({ x: p.x, y: p.y - p.w * .55, img: b }); return true; } return false;
      case 'fodder': case 'rail': if (sc.textures.exists(HAY.key)) { img(HAY.key, p.kind === 'fodder' ? 0 : 1, p.w); return true; } if (!camp) return false; img(PROPS.key, p.kind === 'fodder' ? 17 : 10, p.w); return true;
      case 'horse': if (sc.textures.exists(HORSE.key)) { const h = img(HORSE.key, p.flip ? 8 : 4, p.w).setOrigin(.5, 280 / 288).setFlipX(false).setTint(HORSE.tints[this.horses++ % HORSE.tints.length]); void h; return true; } return false;
      default: {
        if (p.kind === 'post' && sc.textures.exists(CAMP_ART.dummy.key)) { this.dummies.push(img(CAMP_ART.dummy.key, 0, p.w * 1.25)); return true; }
        if (!camp) return false;
        const frame = { rack: 21, shields: 23, crates: 14, sacks: 16, cart: 24, pot: 31, post: 34, rail: 10, fodder: 17, canopy: 2, barrels: 18, tentb: 0, yurt: 1, tents: 3, palisade: 12, gate: 13, spears: 19, weapons: 20, bows: 22, jars: 18, sacks2: 17, crates2: 15, cart2: 25, wheels: 26 }[p.kind as 'rack']; img(PROPS.key, frame, p.w); return true;
      }
    }
  }
  private sortByY() { this.root.list.sort((a, b) => (a as Phaser.GameObjects.Image).y - (b as Phaser.GameObjects.Image).y); }

  update(dtMs: number): void {
    const dt = Math.min(.1, dtMs / 1000), k = this.k; this.clock += dt;
    for (const w of this.walkers) {
      if (w.pause > 0) { w.pause -= dt; w.img.setFrame(w.img.frame.name.replace(/_\d$/, '_0')); continue; }
      const a = w.path[w.seg], b = w.path[w.seg + 1]; if (!b) { w.seg = 0; continue; }
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      w.t += w.dir * w.speed * dt / len;
      if (w.t > 1) { if (w.seg < w.path.length - 2) { w.seg++; w.t = 0; } else { w.t = 1; w.dir = -1; w.pause = 1.2 + Math.random() * 2.5; } }
      else if (w.t < 0) { if (w.seg > 0) { w.seg--; w.t = 1; } else { w.t = 0; w.dir = 1; w.pause = 1.2 + Math.random() * 2.5; } }
      else if (Math.random() < dt * .05) { w.pause = .8 + Math.random() * 2; if (Math.random() < .35) w.dir = (w.dir * -1) as 1 | -1; }
      const p0 = w.path[w.seg], p1 = w.path[Math.min(w.path.length - 1, w.seg + 1)];
      const dx = (p1[0] - p0[0]) * w.dir, dy = (p1[1] - p0[1]) * w.dir, dn = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      w.frame = (w.frame + dt * 6) % 4; w.img.setFrame(`${dn}_${Math.floor(w.frame)}`);
      const x = p0[0] + (p1[0] - p0[0]) * w.t, y = p0[1] + (p1[1] - p0[1]) * w.t; w.img.setPosition(x * k, y * k);
      // 稀疏扬尘（手绘扬尘帧，很淡）
      if (this.clock >= w.dustAt) { w.dustAt = this.clock + 1.4 + Math.random() * 1.2; this.puff(x - Math.sign(dx) * 10, y + 2, 34, .28, 0xc9b28a, 0); }
    }
    for (const d of this.drillers) {
      if (d.rest > 0) { d.rest -= dt; continue; }
      d.t += dt * 7; const f = Math.floor(d.t);
      const dm = this.drillDummy.get(d);
      if (f >= 4) { d.t = 0; d.rest = .25 + Math.random() * .5; d.img.setFrame(d.dir + '_0'); dm?.setFrame(0); continue; }
      d.img.setFrame(`${d.dir}_${f}`); dm?.setFrame(f === 2 ? 1 : f === 3 ? 2 : 0);
    }
    for (const [i, f] of this.flags.entries()) f.setRotation(Math.sin(this.clock * 1.6 + i) * .035);
    for (const f of this.fires) if (f.img) f.img.setFrame(Math.floor(this.clock * 11) % 8);
    if (this.clock >= this.smokeAt && this.fires.length) { this.smokeAt = this.clock + .7; for (const f of this.fires) this.puff(f.x + (Math.random() - .5) * 10, f.y - 30, 60, .35, 0x8a8478, -60); }
    if (this.clock >= this.sortAt) { this.sortAt = this.clock + .3; this.sortByY(); }
  }
  /** 手绘扬尘序列帧（染色、上飘）；没有图就不画。 */
  private puff(x: number, y: number, size: number, alpha: number, tint: number, rise: number) {
    const k = this.k, img = playSheet(this.scene, 'fx_collapse_dust', x * k, y * k, { size: size * k, depth: 0, ms: 1400, alpha, tint, onUpdate: (im, t) => { im.setY((y + rise * t) * k).setAlpha(alpha * (1 - t)); } });
    if (img) { this.root.add(img); }
  }
  get info() { return { ...this.stats, flags: this.flags.length, fires: this.fires.length, dummies: this.dummies.length, campArt: { banner: this.flags.some(f => f instanceof Phaser.GameObjects.Container), firepit: this.fires.some(f => f.img?.texture.key === CAMP_ART.firepit.key), dummy: this.dummies.length > 0 } }; }
  destroy() { this.root.destroy(); this.walkers = []; this.drillers = []; this.flags = []; this.fires = []; this.dummies = []; this.drillDummy.clear(); }
}
