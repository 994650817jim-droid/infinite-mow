/**
 * 城池全景里的市井：民居店铺、街上的居民、几处小景（用户 2026-11-17：「我想往城市里面加入居民楼和居民」；
 * 2026-11-19：「城市市民穿模在建筑物上走，而且多一些市民建筑塞满城市。中间的桥生成也有问题，多点市民互动」）。
 *
 * - 民居店铺（TOWN_DECOR）：占满不是建筑位的空地基与路边空地，复用攻城城内图集（siege-v2/street.png 民房 / 楼房 / 店铺 / 粮仓 / 水井，
 *   siege-v2/city.png 市集摊棚 / 货担 / 库房）和营地道具。府衙等级越高越密（lv 字段）。空着的建筑位（＋屯田 / ＋募兵所）不放东西，只在地基两角插小旗，一眼看出是能建的地。
 * - 居民（TownFolk）：只在路网（TOWN_ROADS：大道、小径、桥）上走，节点间按道路宽度错开车道；过河只走桥。居民和民居、功能建筑放进同一个全景容器，
 *   按脚下的 y 排前后（TownFolk.sortPano），所以走到屋后会被屋子挡住，不再「踩」在屋顶上。孩童跑得快，挑担货郎推一辆小车。
 * - 小景（TOWN_SCENES）：两人闲谈、摊前买货、井边打水；建了屯田有农夫、建了募兵所有两名兵士对练。动的人数有限（走动 ≤ FOLK_MAX，小景 ≤ 8）。
 * - 点居民：冒一句话（barkAt）。居民本身不接收点击（不挡建筑），由 TownScene 在没点到建筑时按位置找最近的人。
 * 坐标都是全景像素（1536×1024，与 assets/town-city/bg_<档>.webp 对应），画时乘 k。
 */
import Phaser from 'phaser';
import type { CityTier } from '../world/WorldCities';
import type { CityBuildingId } from '../data/cityBuildings';

/** 居民人数（小城 4–6、中城 6–10、大城 10–15），封顶 FOLK_MAX。 */
export const FOLK_MAX = 15;
export function folkCount(tier: CityTier, office: number): number {
  return Math.min(FOLK_MAX, { small: [4, 6, 6], medium: [6, 8, 10], large: [10, 12, 15] }[tier][Math.min(3, Math.max(1, office)) - 1]);
}
/** 居民行走图（4×4：行 = 下 / 左 / 右 / 上）。civilian=false 为巡逻兵。按此顺序轮流分配。 */
export const FOLK_SHEETS: Array<{ key: string; url: string; civilian: boolean }> = [
  { key: 'folk_man', url: 'assets/town-city/folk/folk_man_walk.png', civilian: true },
  { key: 'folk_woman', url: 'assets/town-city/folk/folk_woman_walk.png', civilian: true },
  { key: 'folk_swordsman', url: 'assets/processed-v2/troops/swordsman_walk.png', civilian: false },
  { key: 'folk_porter', url: 'assets/town-city/folk/folk_porter_walk.png', civilian: true },
  { key: 'folk_child', url: 'assets/town-city/folk/folk_child_walk.png', civilian: true },
  { key: 'folk_spearman', url: 'assets/processed-v2/troops/spearman_walk.png', civilian: false },
];
/** 图集：攻城城内的民房 / 城内图集（各 4×2，每格 384）、营地道具（6×6，每格 128）、石桥桥面（竖向平铺，terrain/bridge 套件）。 */
const ATLAS = {
  st: { key: 'town_street', url: 'assets/siege-v2/street.png', cell: 384 },   // 0 民房 1 楼房（茶肆） 2 店铺 3 粮仓 4 兵营 5 路障 6 屋脊 7 水井
  ct: { key: 'town_cityset', url: 'assets/siege-v2/city.png', cell: 384 },   // 0 市集摊棚 1 货担 2 库房 3 兵器院
  cp: { key: 'camp_props_v2', url: 'assets/props-v2/camp-props.png', cell: 128 }, // 4 小旗 14 木箱 16 粮袋 18 坛罐 24 推车
} as const;
const DECK = { key: 'town_bridge_deck', url: 'assets/terrain/bridge/stoneDeckT.png' };
/** 各帧画面底边在格子里的位置（originY），让物件「站」在地上。 */
const FOOT: Record<string, number> = { st0: .99, st1: .99, st2: .99, st3: .99, st7: .99, ct0: .95, ct1: .93, ct2: .93, cp4: .95, cp14: .93, cp16: .9, cp18: .9, cp24: .88 };
const BUILDING = /^(st[0-3]|ct[02])$/;
/**
 * 比例尺（11-19 用户「注意建筑比例」）：居民身高 CITIZEN（全景像素）；门高约 1.3 个居民。各图的门高占画宽的比例量过（DOOR），
 * 宽度按门算出来（decorWidth）——所有图等比缩放、不拉伸。府衙等功能建筑图是「院落微缩」，门高约 30 全景像素（府衙 Lv1 宽 284），居民按它定为 24。
 * 两层楼房门比例小、画面更高；摊棚、货担按人能站在棚下（棚檐约 1.3 人）定，比民房小得多。
 */
export const CITIZEN = 24;
const DOOR: Record<string, number> = { st0: .295, st1: .24, st2: .34, st3: .35, ct2: .37, ct0: .41, ct1: .52 };
const decorWidth = (id: string, scale = 1): number => DOOR[id] ? CITIZEN * 1.3 / DOOR[id] * scale : 0;

export function loadTownLife(scene: Phaser.Scene): void {
  for (const f of FOLK_SHEETS) if (!scene.textures.exists(f.key)) scene.load.image(f.key, f.url);
  for (const a of Object.values(ATLAS)) if (!scene.textures.exists(a.key)) scene.load.spritesheet(a.key, a.url, { frameWidth: a.cell, frameHeight: a.cell });
  if (!scene.textures.exists(DECK.key)) scene.load.image(DECK.key, DECK.url);
}

type Art = keyof typeof ATLAS;
interface Decor { a: Art; f: number; x: number; y: number; w: number; lv?: number; flip?: boolean }
/** w = 0：按比例尺（门高）算宽；道具、水井给定宽。 */
const d = (a: Art, f: number, x: number, y: number, w = 0, lv = 1, flip = false): Decor => ({ a, f, x, y, w, lv, flip });
/** 民居店铺（x, y = 底边中点）。不放在建筑位、路面、河上。 */
export const TOWN_DECOR: Record<CityTier, Decor[]> = {
  small: [
    d('st', 0, 392, 392), d('ct', 0, 620, 702), d('cp', 16, 668, 706, 26), d('cp', 24, 470, 986, 40),
    d('st', 1, 1420, 985, 0, 2), d('st', 0, 330, 990, 0, 2, true), d('st', 2, 1380, 760, 0, 3), d('cp', 18, 1110, 690, 24),
  ],
  medium: [
    // 右中地基：军营旁一座民房；左上 / 右上地基：招贤馆、讲武堂旁的坛罐木箱
    d('st', 0, 1300, 510), d('cp', 18, 500, 374, 24), d('cp', 14, 1338, 374, 28),
    // 大道两侧草地（运河南）：小摊、货担；运河北岸水井
    d('ct', 0, 592, 772), d('ct', 1, 600, 842, 0, 2), d('ct', 0, 1028, 772, 0, 2), d('cp', 16, 568, 570, 26), d('st', 7, 1010, 572, 42),
    // 南边一排：民房、楼房（茶肆）、店铺
    d('st', 0, 190, 1012), d('st', 1, 330, 1010, 0, 2), d('st', 2, 462, 1013), d('cp', 24, 572, 1000, 40, 2), d('st', 0, 1440, 1012, 0, 3, true),
  ],
  large: [
    // 左上第一排：招贤馆旁楼房、店铺；第二排：讲武堂旁水井、民房
    d('st', 1, 472, 370), d('st', 2, 568, 372), d('st', 7, 430, 476, 42), d('st', 0, 520, 478), d('st', 3, 405, 372, 0, 3),
    // 右上：军营旁市集小摊、店铺
    d('ct', 0, 1285, 373), d('st', 2, 1360, 373, 0, 2), d('ct', 1, 1335, 380, 0, 3),
    // 横街边：推车、木箱；货担
    d('cp', 24, 1010, 598, 40), d('cp', 14, 980, 522, 28, 2), d('cp', 16, 640, 522, 26), d('ct', 1, 1440, 600, 0, 2),
  ],
};
/**
 * 营寨功能建筑在城里的位置（11-19 用户「城市也应该有义军营寨那些功能建筑」）。同一套建筑、同一份等级（世界存档 town.levels），
 * 每座城画一处「分署」，点了打开营寨同一个面板（TownScene → CityScene {open, back}）。宽度与营寨同比例（府衙最大）。merchant = 旅商摊。
 */
export type HqId = 'talent' | 'academy' | 'stable' | 'barracks';
export const HQ_SLOTS: Record<CityTier, Record<HqId | 'merchant', { x: number; y: number; w: number }>> = {
  small: { talent: { x: 245, y: 392, w: 196 }, academy: { x: 1262, y: 690, w: 200 }, barracks: { x: 600, y: 996, w: 200 }, stable: { x: 1160, y: 975, w: 200 }, merchant: { x: 985, y: 728, w: 70 } },
  medium: { talent: { x: 385, y: 372, w: 196 }, academy: { x: 1215, y: 373, w: 200 }, barracks: { x: 1138, y: 509, w: 196 }, stable: { x: 1240, y: 1012, w: 200 }, merchant: { x: 632, y: 506, w: 70 } },
  large: { talent: { x: 300, y: 372, w: 196 }, academy: { x: 290, y: 477, w: 200 }, barracks: { x: 1130, y: 373, w: 200 }, stable: { x: 1240, y: 1008, w: 200 }, merchant: { x: 1490, y: 606, w: 70 } },
};
/** 建筑位没建时，在地基前两角插的小旗（全景像素）。 */
const SLOT_FLAGS: Record<CityTier, Partial<Record<CityBuildingId, Array<[number, number]>>>> = {
  small: { tuntian: [[172, 758], [538, 758]], muster: [[1128, 564], [1428, 564]], office: [[648, 470], [905, 470]] },
  medium: { tuntian: [[86, 838], [480, 838]], muster: [[1132, 838], [1478, 838]], office: [[262, 510], [570, 510]] },
  large: { tuntian: [[205, 778], [580, 778]], muster: [[1075, 778], [1500, 778]], office: [[1080, 478], [1455, 478]] },
};
/**
 * 石桥（只有中城的大道跨运河）：桥面与大道同宽，盖住底图上那座窄拱桥，桥面两端压住南北两岸的路面——桥面就用底图里桥南那段大道的石板（src 区域），
 * 天衣无缝接上路；两侧栏杆用石桥套件（terrain/bridge/stoneDeckT）左右两列的望柱栏板。全景像素：l, r, t, b；src = 取石板的底图区域 [x, y, w, h]。
 */
const BRIDGES: Record<CityTier, Array<{ l: number; r: number; t: number; b: number; src: [number, number, number, number] }>> = {
  small: [], large: [], medium: [{ l: 666, r: 944, t: 520, b: 640, src: [666, 668, 278, 110] }],
};

/** 路网（全景像素）：节点 [x, y, 半宽]；半宽 = 该处道路一侧可错开的距离（路口收窄，大道中段放宽）。 */
interface RoadNet { nodes: Array<[number, number, number]>; edges: Array<[number, number]> }
export const TOWN_ROADS: Record<CityTier, RoadNet> = {
  // 小城：土路从城门分两股绕过中间地基，在南边并成一条；东岔通右侧地基
  small: {
    nodes: [[905, 305, 6], [800, 345, 10], [620, 392, 12], [440, 445, 8], [205, 430, 8], [610, 552, 10], [705, 612, 8], [760, 720, 14], [850, 860, 18], [950, 1010, 20], [990, 385, 10], [1008, 495, 8], [935, 580, 10], [1120, 555, 8]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [6, 7], [7, 8], [8, 9], [0, 10], [10, 11], [11, 12], [12, 6], [11, 13]],
  },
  // 中城：中轴石板大道（过运河走桥），两侧 y≈395 / 545 / 890 三条横向小径
  medium: {
    nodes: [[790, 300, 8], [790, 350, 40], [790, 395, 8], [790, 470, 55], [790, 545, 8], [790, 598, 70], [790, 650, 8], [790, 770, 70], [790, 890, 8], [790, 1015, 70],
      [470, 395, 7], [200, 392, 7], [470, 545, 7], [222, 545, 7], [330, 890, 7], [100, 890, 7],
      [1110, 395, 7], [1390, 392, 7], [1110, 545, 7], [1365, 545, 7], [1250, 890, 7], [1480, 890, 7]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
      [2, 10], [10, 11], [4, 12], [12, 13], [8, 14], [14, 15], [2, 16], [16, 17], [4, 18], [18, 19], [8, 20], [20, 21]],
  },
  // 大城：中轴御道（过牌坊）+ 横街；横街西头过运河上的小桥
  large: {
    nodes: [[822, 300, 8], [822, 420, 60], [822, 540, 8], [822, 780, 75], [822, 1012, 80], [480, 540, 14], [200, 540, 12], [70, 556, 6], [1180, 540, 14], [1505, 540, 12]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [2, 8], [8, 9]],
  },
};

type SceneKind = 'chat' | 'buy' | 'well' | 'farm' | 'drill';
interface Vignette { kind: SceneKind; x: number; y: number; need?: CityBuildingId }
/** 小景（全景像素，人物脚下）：农夫要建了屯田、对练要建了募兵所才有。 */
const TOWN_SCENES: Record<CityTier, Vignette[]> = {
  small: [{ kind: 'chat', x: 520, y: 470 }, { kind: 'well', x: 1036, y: 692 }, { kind: 'buy', x: 620, y: 716 }, { kind: 'chat', x: 1050, y: 800 }, { kind: 'farm', x: 352, y: 712, need: 'tuntian' }, { kind: 'drill', x: 1275, y: 530, need: 'muster' }],
  medium: [{ kind: 'chat', x: 600, y: 404 }, { kind: 'buy', x: 592, y: 786 }, { kind: 'well', x: 988, y: 582 }, { kind: 'chat', x: 1230, y: 552 }, { kind: 'farm', x: 292, y: 800, need: 'tuntian' }, { kind: 'drill', x: 1300, y: 812, need: 'muster' }],
  large: [{ kind: 'chat', x: 620, y: 552 }, { kind: 'buy', x: 1285, y: 388 }, { kind: 'well', x: 430, y: 492 }, { kind: 'chat', x: 1360, y: 552 }, { kind: 'farm', x: 392, y: 740, need: 'tuntian' }, { kind: 'drill', x: 1292, y: 752, need: 'muster' }],
};
/** 点居民时的话（按行走图）。 */
const BARKS: Record<string, string[]> = {
  folk_man: ['今年雨水足，收成错不了', '听说主公又打了胜仗！', '城南新开了茶肆，去喝一碗？'],
  folk_woman: ['井水甜着呢', '孩子他爹去募兵所报名了', '布价又涨了……'],
  folk_porter: ['让一让，货来了！', '南来的盐巴，便宜卖嘞', '担子重，借过借过'],
  folk_child: ['抓不着我！', '我长大也要当将军！', '嘻嘻嘻'],
  folk_swordsman: ['巡街呢，莫要喧哗', '城中安稳，乡亲放心', '主公有令，夜里宵禁'],
  folk_spearman: ['站好岗，守好城', '城门那边一切如常', '操练完了再来巡'],
};

/**
 * 画民居店铺、建筑位小旗、石桥（加进全景容器 pano，zy 字段 = 排前后用的脚下 y）。返回民居店铺座数（名 house-*）。
 * built：各建筑位当前等级（没建的插小旗）。
 */
export function drawTownDecor(scene: Phaser.Scene, pano: Phaser.GameObjects.Container, k: number, tier: CityTier, office: number, built: Record<CityBuildingId, number>, bgKey?: string): number {
  let houses = 0, props = 0;
  for (const [bi, b] of BRIDGES[tier].entries()) {
    if (!bgKey || !scene.textures.exists(bgKey)) break;
    const bgT = scene.textures.get(bgKey), bs = (bgT.getSourceImage() as { width: number }).width / 1536, fr = `town-bridge-${tier}-${bi}`;
    if (!bgT.has(fr)) bgT.add(fr, 0, b.src[0] * bs, b.src[1] * bs, b.src[2] * bs, b.src[3] * bs);
    const w = (b.r - b.l) * k, h = (b.b - b.t) * k, add = (o: Phaser.GameObjects.GameObject, z: number) => { zy(o, z); pano.add(o); };
    // 水影：桥身两侧水面上一道暗影，看起来是架在水上
    add(scene.add.rectangle(b.l * k - 4, b.t * k + h * .5, w + 8, h * .42, 0x0b1714, .4).setOrigin(0, .5).setName('town-bridge-shadow'), -1e8);
    add(scene.add.image(b.l * k, b.t * k, bgKey, fr).setOrigin(0).setDisplaySize(w, h).setName('town-bridge'), -1e8 + 1);
    if (scene.textures.exists(DECK.key)) {
      const dk = scene.textures.get(DECK.key), ds = dk.getSourceImage() as { width: number; height: number }, cw = 40;
      if (!dk.has('railL')) { dk.add('railL', 0, 0, 0, cw, ds.height); dk.add('railR', 0, ds.width - cw, 0, cw, ds.height); }
      const rw = 24 * k, sc = rw / cw;
      for (const [fn, x] of [['railL', b.l * k - rw * .35], ['railR', b.r * k - rw * .65]] as const)
        add(scene.add.tileSprite(x, b.t * k - 6 * k, cw, (h + 12 * k) / sc, DECK.key, fn).setOrigin(0).setScale(sc).setName('town-bridge-rail'), -1e8 + 2);
    }
  }
  for (const it of TOWN_DECOR[tier]) {
    if ((it.lv ?? 1) > office) continue;
    const A = ATLAS[it.a]; if (!scene.textures.exists(A.key)) continue;
    const id = it.a + it.f, w = it.w || decorWidth(id) || 80, img = scene.add.image(it.x * k, it.y * k, A.key, it.f).setOrigin(.5, FOOT[id] ?? .95).setFlipX(!!it.flip);
    img.setScale(w * k / A.cell * (it.a === 'cp' ? 1.15 : 1.08));
    img.setName(BUILDING.test(id) ? 'house-' + houses++ : 'prop-' + props++); zy(img, it.y * k); pano.add(img);
  }
  for (const [id, pts] of Object.entries(SLOT_FLAGS[tier]) as Array<[CityBuildingId, Array<[number, number]>]>) {
    if ((built[id] ?? 0) > 0 || !scene.textures.exists(ATLAS.cp.key)) continue;
    pts.forEach(([x, y], i) => { const f = scene.add.image(x * k, y * k, ATLAS.cp.key, 4).setOrigin(.5, .95).setScale(CITIZEN * 1.9 * k / 128).setFlipX(i === 1).setName(`slot-flag-${id}-${i}`); zy(f, y * k); pano.add(f); });
  }
  return houses;
}
/** 排前后用的 y（存在对象上）。 */
export function zy(o: Phaser.GameObjects.GameObject, v: number): void { (o as unknown as { zy: number }).zy = v; }
const zyOf = (o: Phaser.GameObjects.GameObject): number => { const v = (o as unknown as { zy?: number }).zy; return v ?? (o as unknown as { y: number }).y ?? 0; };

const DIRS = ['down', 'left', 'right', 'up'] as const;
type Dir = typeof DIRS[number];
interface Walker { img: Phaser.GameObjects.Image; key: string; from: number; to: number; prev: number; t: number; lane: number; speed: number; pause: number; frame: number; cart?: Phaser.GameObjects.Image; kid: boolean }
interface Ambient { img: Phaser.GameObjects.Image; key: string; extra: Phaser.GameObjects.GameObject[] }

/**
 * 居民：对象池（最多 FOLK_MAX 个），在路网上随机走：到路口挑一条没走过来的路（死路就掉头），偶尔停一停。
 * 精灵不接收点击。和全景同一个容器，sortPano 按脚下 y 排前后。
 */
export class TownFolk {
  readonly walkers: Walker[] = [];
  readonly ambient: Ambient[] = [];
  private active = 0; private sortIn = 0;
  /** 气泡反缩放（全景容器缩小时字仍一样大），由 TownScene 设。 */
  labelK = 1;
  private adj: number[][] = [];
  constructor(private scene: Phaser.Scene, readonly pano: Phaser.GameObjects.Container, private k: number, private tier: CityTier) {
    for (const s of FOLK_SHEETS) {
      if (!scene.textures.exists(s.key)) continue;
      const t = scene.textures.get(s.key), src = t.getSourceImage() as { width: number }, cell = src.width / 4;
      if (!t.has('down_0')) DIRS.forEach((dn, row) => { for (let c = 0; c < 4; c++) t.add(`${dn}_${c}`, 0, c * cell, row * cell, cell, cell); });
    }
    const net = TOWN_ROADS[tier]; this.adj = net.nodes.map(() => []);
    for (const [a, b] of net.edges) { this.adj[a].push(b); this.adj[b].push(a); }
  }
  private scale(img: Phaser.GameObjects.Image) { img.setScale(this.k * CITIZEN / .75 / img.frame.height); }
  /** 所有要放进全景的对象（全景重画前摘下、画完再放回）。 */
  objects(): Phaser.GameObjects.GameObject[] { return [...this.walkers.flatMap(w => w.cart ? [w.img, w.cart] : [w.img]), ...this.ambient.flatMap(a => [a.img, ...a.extra])]; }
  detach(): void { for (const o of this.objects()) this.pano.remove(o, false); }
  attach(): void { for (const o of this.objects()) if (o.active) this.pano.add(o); this.sortPano(); }
  /** 设定走动人数（复用池里的精灵）。每 5 人里 1 个孩童（跑得快），第一个挑担货郎推车。 */
  setCount(n: number): void {
    const keys = FOLK_SHEETS.filter(s => this.scene.textures.exists(s.key));
    if (!keys.length) { this.active = 0; return; }
    const want = Math.min(FOLK_MAX, n), N = TOWN_ROADS[this.tier].nodes.length;
    while (this.walkers.length < want) {
      const i = this.walkers.length, sheet = keys[i % keys.length], img = this.scene.add.image(0, 0, sheet.key, 'down_0').setOrigin(.5, .92).setName('folk-' + i);
      this.scale(img); this.pano.add(img);
      const from = Math.floor(Math.random() * N), nb = this.adj[from], to = nb[Math.floor(Math.random() * nb.length)] ?? from, kid = sheet.key === 'folk_child';
      const w: Walker = { img, key: sheet.key, from, to, prev: -1, t: Math.random(), lane: Math.random() * 2 - 1, speed: kid ? 62 + Math.random() * 14 : 24 + Math.random() * 16, pause: Math.random() * 2, frame: 0, kid };
      if (sheet.key === 'folk_porter' && !this.walkers.some(x => x.cart) && this.scene.textures.exists(ATLAS.cp.key)) { w.cart = this.scene.add.image(0, 0, ATLAS.cp.key, 24).setOrigin(.5, .88).setScale(this.k * 34 / 128 * 1.15).setName('folk-cart'); this.pano.add(w.cart); w.speed = 20; }
      this.walkers.push(w);
    }
    this.active = want;
    this.walkers.forEach((w, i) => { w.img.setVisible(i < want); w.cart?.setVisible(i < want); });
    for (let i = 0; i < want; i++) this.place(this.walkers[i]);
    this.sortPano();
  }
  get count(): number { return this.active; }
  /** 小景：按当前建筑重摆（屯田有农夫、募兵所有对练）。 */
  setAmbient(built: Record<CityBuildingId, number>): void {
    for (const a of this.ambient) { a.img.destroy(); a.extra.forEach(o => o.destroy()); } this.ambient.length = 0;
    const has = (k: string) => this.scene.textures.exists(k);
    const put = (key: string, x: number, y: number, dir: Dir, front = false, extra: Phaser.GameObjects.GameObject[] = []) => {
      if (!has(key)) return null; const img = this.scene.add.image(x * this.k, y * this.k, key, dir + '_0').setOrigin(.5, .92).setName('town-npc-' + this.ambient.length);
      this.scale(img); zy(img, (front ? 1e7 : 0) + y * this.k); this.pano.add(img); const a = { img, key, extra }; this.ambient.push(a); return a; /* front：农夫 / 对练站在建筑图里（田里、校场上），排在建筑前、名牌后 */
    };
    for (const v of TOWN_SCENES[this.tier]) {
      if (v.need && !(built[v.need] > 0)) continue;
      if (v.kind === 'chat') {
        const a = put('folk_man', v.x - 7, v.y, 'right'), b = put('folk_woman', v.x + 7, v.y, 'left');
        if (a && b) { const dots = this.bubble(v.x * this.k, (v.y - CITIZEN * 1.4) * this.k, '……', 11).setAlpha(0); a.extra.push(dots); this.scene.tweens.add({ targets: dots, alpha: { from: 0, to: 1 }, yoyo: true, hold: 1400, repeatDelay: 2600 + Math.random() * 2000, repeat: -1, duration: 260 }); }
      } else if (v.kind === 'buy') put('folk_woman', v.x, v.y, 'up');
      else if (v.kind === 'well') { const a = put('folk_woman', v.x, v.y, 'up'); if (a) this.scene.tweens.add({ targets: a.img, scaleY: a.img.scaleY * .93, yoyo: true, repeat: -1, duration: 700, hold: 300, ease: 'Sine.easeInOut' }); }
      else if (v.kind === 'farm') { const a = put('folk_man', v.x, v.y, 'down', true); if (a) this.scene.tweens.add({ targets: a.img, scaleY: a.img.scaleY * .9, yoyo: true, repeat: -1, duration: 520, hold: 200, repeatDelay: 300 }); }
      else if (v.kind === 'drill') {
        for (const [dx, dir] of [[-10, 'right'], [10, 'left']] as const) { const a = put('folk_spearman', v.x + dx, v.y, dir, true); if (a) this.scene.tweens.add({ targets: a.img, x: a.img.x + (dx < 0 ? 3 : -3) * this.k, yoyo: true, repeat: -1, duration: 260, repeatDelay: 500, onYoyo: () => a.img.setFrame(dir + '_2'), onRepeat: () => a.img.setFrame(dir + '_0') }); }
      }
    }
    this.sortPano();
  }
  private bubble(x: number, y: number, s: string, size = 12): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, s, { fontFamily: '"Noto Serif SC","SimSun",serif', fontSize: size + 'px', color: '#2a1a0c', backgroundColor: '#f6ecd2ee', padding: { x: 6, y: 3 }, resolution: 2 }).setOrigin(.5, 1).setName('folk-bubble').setScale(this.labelK);
    zy(t, 1e8 + 10); this.pano.add(t); return t;
  }
  /** 点到全景 (x, y)（全景内坐标）：最近的居民冒一句话；没人就返回 false。 */
  barkAt(x: number, y: number): boolean {
    const cand = [...this.walkers.slice(0, this.active).map(w => ({ img: w.img, key: w.key, w })), ...this.ambient.map(a => ({ img: a.img, key: a.key, w: undefined as Walker | undefined }))];
    const r = CITIZEN * .8 * this.k, h = CITIZEN * 1.5 * this.k; let best: typeof cand[number] | null = null, bd = Infinity;
    for (const c of cand) { if (!c.img.visible) continue; const dx = Math.abs(c.img.x - x), dy = c.img.y - y; if (dx > r || dy < -8 || dy > h) continue; const dd = dx + Math.abs(dy - h / 2) * .5; if (dd < bd) { bd = dd; best = c; } }
    if (!best) return false;
    const lines = BARKS[best.key] ?? BARKS.folk_man, line = lines[Math.floor(Math.random() * lines.length)];
    this.pano.list.filter(o => o.name === 'folk-bark').forEach(o => o.destroy());
    const b = this.bubble(best.img.x, best.img.y - best.img.displayHeight * .95, line).setName('folk-bark');
    if (best.w) { best.w.pause = 2.2; best.img.setFrame('down_0'); }
    this.scene.tweens.add({ targets: b, alpha: 0, delay: 1900, duration: 300, onComplete: () => b.destroy() });
    return true;
  }
  /** 全景容器按 zy（脚下 y）排前后：底图最先，名牌 / 点击区 / 气泡最后。 */
  sortPano(): void { this.pano.list.sort((a, b) => zyOf(a) - zyOf(b)); }
  private pos(w: Walker): [number, number] {
    const n = TOWN_ROADS[this.tier].nodes, a = n[w.from], b = n[w.to], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, hw = a[2] + (b[2] - a[2]) * w.t;
    return [a[0] + dx * w.t - dy / len * hw * w.lane, a[1] + dy * w.t + dx / len * hw * w.lane * .5];
  }
  private place(w: Walker) {
    const [x, y] = this.pos(w); w.img.setPosition(x * this.k, y * this.k); zy(w.img, y * this.k);
    if (w.cart) { const n = TOWN_ROADS[this.tier].nodes, dx = n[w.to][0] - n[w.from][0], dy = n[w.to][1] - n[w.from][1], len = Math.hypot(dx, dy) || 1, back = CITIZEN * .7 * this.k;
      w.cart.setPosition(w.img.x - dx / len * back, w.img.y - dy / len * back * .6).setFlipX(dx < 0); zy(w.cart, w.cart.y); }
  }
  update(dtMs: number): void {
    const dt = Math.min(.1, dtMs / 1000), n = TOWN_ROADS[this.tier].nodes;
    for (let i = 0; i < this.active; i++) {
      const w = this.walkers[i];
      if (w.pause > 0) { w.pause -= dt; continue; }
      const a = n[w.from], b = n[w.to], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      w.t += w.speed * dt / len;
      if (w.t >= 1) {
        const nb = this.adj[w.to].filter(x => x !== w.from), next = nb.length ? nb[Math.floor(Math.random() * nb.length)] : w.from;
        w.prev = w.from; w.from = w.to; w.to = next; w.t = 0;
        if (!w.kid && (Math.random() < .25 || !nb.length)) { w.pause = .8 + Math.random() * 2.2; w.img.setFrame(w.img.frame.name.replace(/_\d$/, '_0')); }
        if (Math.random() < .3) w.lane = Phaser.Math.Clamp(w.lane + (Math.random() - .5) * .8, -1, 1);
        continue;
      }
      const dx = b[0] - a[0], dy = b[1] - a[1], dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      w.frame = (w.frame + dt * (w.kid ? 9 : 6)) % 4;
      w.img.setFrame(`${dir}_${Math.floor(w.frame)}`);
      this.place(w);
    }
    this.sortIn -= dt; if (this.sortIn <= 0) { this.sortIn = .15; this.sortPano(); }
  }
}
