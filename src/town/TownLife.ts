/**
 * 城池全景里的民居与居民（用户 2026-11-17：「我想往城市里面加入居民楼和居民，这些互动不了，只能互动建筑物」）。
 * 纯装饰：不接收点击、不挡功能建筑的点击。小城少、大城多；府衙等级越高，民居和居民越多。
 * 民居暂用营寨旧的民居 / 市集 / 酒肆图（同一套手绘厚涂）；居民暂用 v2 兵种行走图（刀盾 / 长枪当巡逻兵，军医当百姓），
 * 平民行走图到了再换（FOLK_SHEETS）。坐标都是全景像素（1536×1024，与 assets/town-city/bg_<档>.webp 对应）。
 */
import Phaser from 'phaser';
import type { CityTier } from '../world/WorldCities';

export interface HouseSlot { x: number; y: number; w: number }
/** 民居位置（按优先顺序：先占空地基，再沿街）。数量由 houseCount 决定。 */
export const HOUSE_SLOTS: Record<CityTier, HouseSlot[]> = {
  small: [{ x: 285, y: 396, w: 240 }, { x: 1150, y: 352, w: 170 }, { x: 470, y: 318, w: 150 }, { x: 1170, y: 900, w: 190 }, { x: 95, y: 760, w: 150 }],
  medium: [{ x: 388, y: 380, w: 230 }, { x: 1216, y: 380, w: 230 }, { x: 1188, y: 518, w: 280 }, { x: 300, y: 1015, w: 170 }, { x: 1310, y: 1015, w: 170 }, { x: 95, y: 520, w: 130 }, { x: 1450, y: 650, w: 130 }],
  large: [{ x: 408, y: 380, w: 300 }, { x: 1205, y: 380, w: 290 }, { x: 380, y: 482, w: 290 }, { x: 1135, y: 975, w: 170 }, { x: 1450, y: 975, w: 150 }, { x: 640, y: 1010, w: 120 }, { x: 1440, y: 560, w: 120 }, { x: 255, y: 975, w: 140 }],
};
/** 民居图（营寨旧图，按府衙等级取 1–3 级）。 */
export const HOUSE_ART = ['house', 'market', 'tavern', 'house'] as const;
/** 民居数量：档次基础 + 府衙每升一级再加。 */
export function houseCount(tier: CityTier, office: number): number {
  const n = { small: [2, 4, 4], medium: [3, 5, 7], large: [4, 6, 8] }[tier][Math.min(3, Math.max(1, office)) - 1];
  return Math.min(n, HOUSE_SLOTS[tier].length);
}
/** 居民人数（小城 4–6、中城 6–10、大城 10–15），封顶 FOLK_MAX。 */
export const FOLK_MAX = 15;
export function folkCount(tier: CityTier, office: number): number {
  return Math.min(FOLK_MAX, { small: [4, 6, 6], medium: [6, 8, 10], large: [10, 12, 15] }[tier][Math.min(3, Math.max(1, office)) - 1]);
}
/** 居民走的街道（折线，全景像素）。每人随机挑一条，在上面来回走、停下、转身。居民总画在建筑前面，所以路线只走在建筑底边之前（不从屋后穿过）。 */
export const FOLK_PATHS: Record<CityTier, Array<Array<[number, number]>>> = {
  small: [
    [[910, 330], [1000, 430], [960, 530], [800, 640], [790, 780], [880, 990]],
    [[180, 430], [430, 450], [620, 560]],
    [[1010, 520], [1150, 600], [1330, 640], [1480, 660]],
    [[600, 880], [760, 860], [920, 900]],
  ],
  medium: [
    [[790, 330], [790, 1000]], [[860, 1000], [860, 330]],
    [[200, 395], [700, 395]], [[920, 395], [1420, 395]],
    [[90, 890], [560, 890]], [[1040, 890], [1500, 890]],
  ],
  large: [
    [[790, 300], [790, 1010]], [[870, 1010], [870, 300]],
    [[160, 545], [720, 545]], [[940, 545], [1500, 545]],
    [[420, 1000], [700, 1000]], [[950, 1005], [1500, 1005]],
  ],
};
/** 居民用的行走图（4×4：行 = 下 / 左 / 右 / 上）。key → 文件；civilian 表示百姓，否则是巡逻兵。 */
export const FOLK_SHEETS: Array<{ key: string; url: string; civilian: boolean }> = [
  { key: 'folk_medic', url: 'assets/processed-v2/troops/medic_walk.png', civilian: true },
  { key: 'folk_swordsman', url: 'assets/processed-v2/troops/swordsman_walk.png', civilian: false },
  { key: 'folk_spearman', url: 'assets/processed-v2/troops/spearman_walk.png', civilian: false },
];
const DIRS = ['down', 'left', 'right', 'up'] as const;

interface Walker { img: Phaser.GameObjects.Image; key: string; path: Array<[number, number]>; seg: number; t: number; dir: 1 | -1; speed: number; pause: number; frame: number }

/**
 * 居民：对象池（最多 FOLK_MAX 个），每帧沿折线移动；到端点或随机停下几秒再走、偶尔掉头。
 * 精灵不 setInteractive，所以不会截走点击。坐标按全景比例 k 换算。
 */
export class TownFolk {
  private walkers: Walker[] = [];
  private active = 0;
  constructor(private scene: Phaser.Scene, readonly root: Phaser.GameObjects.Container, private k: number, private tier: CityTier) {
    for (const s of FOLK_SHEETS) {
      if (!scene.textures.exists(s.key)) continue;
      const t = scene.textures.get(s.key), src = t.getSourceImage() as { width: number }, cell = src.width / 4;
      if (!t.has('down_0')) DIRS.forEach((d, row) => { for (let c = 0; c < 4; c++) t.add(`${d}_${c}`, 0, c * cell, row * cell, cell, cell); });
    }
  }
  /** 设定人数（复用池里的精灵）。 */
  setCount(n: number): void {
    const keys = FOLK_SHEETS.filter(s => this.scene.textures.exists(s.key));
    if (!keys.length) { this.active = 0; return; }
    const paths = FOLK_PATHS[this.tier], want = Math.min(FOLK_MAX, n);
    while (this.walkers.length < want) {
      const i = this.walkers.length, sheet = keys[i % 3 === 2 ? Math.min(2, keys.length - 1) : i % 3 === 1 ? Math.min(1, keys.length - 1) : 0];
      const path = paths[i % paths.length], img = this.scene.add.image(0, 0, sheet.key, 'down_0').setOrigin(.5, .92).setName('folk-' + i);
      const cell = img.frame.height; img.setScale(this.k * 46 / cell * (1.6));
      this.root.add(img);
      this.walkers.push({ img, key: sheet.key, path, seg: 0, t: Math.random(), dir: Math.random() < .5 ? 1 : -1, speed: 26 + Math.random() * 18, pause: Math.random() * 2, frame: 0 });
    }
    this.active = want;
    this.walkers.forEach((w, i) => w.img.setVisible(i < want));
    for (let i = 0; i < want; i++) this.place(this.walkers[i]);
  }
  get count(): number { return this.active; }
  private pos(w: Walker): [number, number] { const a = w.path[w.seg], b = w.path[Math.min(w.path.length - 1, w.seg + 1)]; return [a[0] + (b[0] - a[0]) * w.t, a[1] + (b[1] - a[1]) * w.t]; }
  private place(w: Walker) { const [x, y] = this.pos(w); w.img.setPosition(x * this.k, y * this.k); }
  update(dtMs: number): void {
    const dt = Math.min(.1, dtMs / 1000);
    for (let i = 0; i < this.active; i++) {
      const w = this.walkers[i];
      if (w.pause > 0) { w.pause -= dt; w.img.setFrame(w.img.frame.name.replace(/_\d$/, '_0')); continue; }
      const a = w.path[w.seg], b = w.path[w.seg + 1]; if (!b) { w.seg = 0; continue; }
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      w.t += w.dir * w.speed * dt / len;
      if (w.t > 1) { if (w.seg < w.path.length - 2) { w.seg++; w.t = 0; } else { w.t = 1; w.dir = -1; w.pause = 1 + Math.random() * 2.5; } }
      else if (w.t < 0) { if (w.seg > 0) { w.seg--; w.t = 1; } else { w.t = 0; w.dir = 1; w.pause = 1 + Math.random() * 2.5; } }
      else if (Math.random() < dt * .04) { w.pause = .8 + Math.random() * 2; if (Math.random() < .35) w.dir = (w.dir * -1) as 1 | -1; }
      const dx = (b[0] - a[0]) * w.dir, dy = (b[1] - a[1]) * w.dir, dirName = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      w.frame = (w.frame + dt * 6) % 4;
      w.img.setFrame(`${dirName}_${Math.floor(w.frame)}`);
      this.place(w);
    }
  }
}
