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

type PropKind = 'tent' | 'flag' | 'fire' | 'brazier' | 'rack' | 'shields' | 'crates' | 'sacks' | 'cart' | 'pot' | 'post';
/** 候选物件（全景像素：底边中心 x,y；w 显示宽）。按顺序放，压到建筑或已放物件的跳过。 */
export const CAMP_PROPS: Array<{ x: number; y: number; w: number; kind: PropKind; flip?: boolean }> = [
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
];
/** 兵士走的路线（全景像素）；压到建筑的路线运行时去掉。巡逻 / 走动都在上面来回。 */
export const CAMP_PATHS: Array<Array<[number, number]>> = [
  [[140, 292], [760, 292], [1480, 292]], // 沿栅栏巡逻
  [[1480, 292], [900, 292], [160, 292]],
  [[1170, 420], [1300, 420], [1450, 450], [1420, 560]], // 营区之间
  [[880, 285], [820, 360], [700, 470], [640, 560]], // 中路
  [[560, 720], [610, 860], [700, 1000]], // 前路
  [[90, 470], [200, 500], [320, 520]], // 校场
  [[930, 860], [800, 940], [700, 1000]],
];
/** 校场操练位（对着木桩出招）与火塘边站位。 */
const DRILL_SPOTS: Array<{ x: number; y: number; dir: 'left' | 'right' }> = [{ x: 255, y: 640, dir: 'left' }, { x: 175, y: 640, dir: 'right' }, { x: 345, y: 640, dir: 'left' }];
const IDLE_SPOTS: Array<{ x: number; y: number; dir: 'left' | 'right' | 'down' }> = [{ x: 1205, y: 505, dir: 'right' }, { x: 1300, y: 515, dir: 'left' }];
export const CAMP_MAX_WALKERS = 9;

const SHEETS = {
  sw: { key: 'camp_sw_walk', url: 'assets/processed-v2/troops/swordsman_walk.png' },
  sp: { key: 'camp_sp_walk', url: 'assets/processed-v2/troops/spearman_walk.png' },
  ar: { key: 'camp_ar_walk', url: 'assets/processed-v2/troops/archer_walk.png' },
  swA: { key: 'camp_sw_atk', url: 'assets/processed-v2/troops/swordsman_attack.png' },
  spA: { key: 'camp_sp_atk', url: 'assets/processed-v2/troops/spearman_attack.png' },
} as const;
const RAM = { key: 'siege_mid_ram', url: 'assets/siege-v2/ram.png' };
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
  for (const a of [PROPS, BRAZIER, DUST, CAMP_ART.firepit, CAMP_ART.dummy]) if (!scene.textures.exists(a.key)) scene.load.spritesheet(a.key, a.url, { frameWidth: a.cell, frameHeight: a.cell });
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
  readonly stats = { props: 0, walkers: 0, drillers: 0, idlers: 0, skippedProps: 0, skippedPaths: 0 };
  private walkers: Walker[] = []; private drillers: Driller[] = []; private flags: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Container> = []; private dummies: Phaser.GameObjects.Image[] = []; private drillDummy = new Map<Driller, Phaser.GameObjects.Image>();
  private fires: Array<{ x: number; y: number; img?: Phaser.GameObjects.Image }> = [];
  private smokeAt = 0; private sortAt = 0; private clock = 0;

  /** blocked：建筑贴图外框（全景像素）；装饰与路线不得压上去。 */
  constructor(private scene: Phaser.Scene, private k: number, blocked: Box[]) {
    this.root = scene.add.container(0, 0).setName('camp-life');
    const pad = 14, hit = (b: Box, o: Box) => b.l < o.r + pad && b.r > o.l - pad && b.t < o.b + pad && b.b > o.t - pad;
    const placed: Box[] = [];
    for (const p of CAMP_PROPS) {
      const h = p.kind === 'tent' ? p.w * .78 : p.kind === 'flag' ? p.w * 1.1 : p.w * .9;
      const box = { l: p.x - p.w / 2, r: p.x + p.w / 2, t: p.y - h, b: p.y };
      if (blocked.some(o => hit(box, o)) || placed.some(o => hit(box, o))) { this.stats.skippedProps++; continue; }
      if (this.addProp(p)) { placed.push(box); this.stats.props++; }
    }
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
      default: {
        if (p.kind === 'post' && sc.textures.exists(CAMP_ART.dummy.key)) { this.dummies.push(img(CAMP_ART.dummy.key, 0, p.w * 1.25)); return true; }
        if (!camp) return false;
        const frame = { rack: 21, shields: 23, crates: 14, sacks: 16, cart: 24, pot: 31, post: 34 }[p.kind]; img(PROPS.key, frame, p.w); return true;
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
