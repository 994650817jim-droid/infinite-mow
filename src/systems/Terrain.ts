import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { TERRAIN, type TerrainConfig, type TreeKind, type Pt, type RiverSpec } from '../data/terrain';
import { playSheet } from './SkillFxSheets';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { Ally } from '../entities/Ally';

/**
 * 战场地形层（数据 data/terrain.ts）：树 / 树林（不可摧毁的实心障碍）、河（减速 40%、水面流动）、桥（过河不减速）。
 * - 碰撞：树只算树干圆（TERRAIN.trunk）。树按 TERRAIN.cell 放进静态格子，每个人只查自己附近 3×3 格——不做每帧全量扫描；
 *   推开方向沿圆心连线，人继续往前走时自然沿树干滑开，不会卡死。箭矢 / 攻击不碰树（树不是 Enemy）。
 * - 河：折线 + 宽度；点到折线的距离 < 半宽且不在桥面上 = 在水里。先用河的外包框粗筛。
 * - 刷兵 / 掉落：free() 把落在水里或树干里的点挪到最近的岸边 / 树外。
 * - 夷陵火：burnTreesInCell() 让着火的格子点着里面的树，树烧完成焦桩、不再挡路（由火势系统调用）。
 * 美术：v2 地形图（树 / 水面 / 桥）到之前的过渡——树用第七章山道图集 shu_pass 的松（帧 2）、竹（帧 3），阔叶树用松树压暗换色；
 *   水面用江岸地面 ground_v2_jiang 染青、贴图沿河向滚动表示流动；桥面用营地道具的横木栅（yellow_props 帧 10）平铺。都是现有手绘图，不画像素特效。
 */
interface Tree { x: number; y: number; kind: TreeKind; img?: Phaser.GameObjects.Image; burnt: boolean; burning: number; behind: boolean; size: number }
interface Seg { ax: number; ay: number; bx: number; by: number; len: number; ux: number; uy: number; s0: number }
interface River { spec: RiverSpec; segs: Seg[]; half: number; box: { l: number; r: number; t: number; b: number }; bridges: Array<{ x: number; y: number; ux: number; uy: number; halfLen: number; halfW: number }>; total: number }
const ART = 'shu_pass', ART_FILE = 'assets/shu/pass.png';
/** 正式 v2 地形图（到了再接）：terrain_trees（松 / 竹 / 阔叶 / 焦桩 …）、terrain_water（水面平铺）、terrain_bridge（桥）。 */
export const TERRAIN_ART = { trees: 'terrain_trees', water: 'terrain_water', bridge: 'terrain_bridge' } as const;
/** v2 地形图（2026-11-17 Gemini 3.1 Pro 出图，原图在 public/assets/terrain/originals/）：树图集 4×2（384 格：松 / 竹 / 阔叶 / 焦桩 / 小松 / 细竹 / 雨林树 / 灌木）、水面平铺 512、木桥（横向，宽高约 2.5:1）。 */
const ART_FILES = { trees: 'assets/terrain/trees.png', water: 'assets/terrain/water.png', bridge: 'assets/terrain/bridge.png' } as const;

export class Terrain {
  readonly trees: Tree[] = [];
  readonly rivers: River[] = [];
  /** 山崖碰撞框（场景把它们并进 sishuiObstacles）。 */
  readonly cliffBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  readonly stats = { pushes: 0, waterChecks: 0, moved: 0, burnt: 0 };
  private grid = new Map<number, Tree[]>();
  private objects: Phaser.GameObjects.GameObject[] = [];
  private water: Array<{ ts: Phaser.GameObjects.TileSprite; ux: number; uy: number }> = [];
  private near: Tree[] = []; private faded = new Set<Tree>(); private burning: Tree[] = [];
  private built = false;

  constructor(private readonly scene: Phaser.Scene, cfg: TerrainConfig) {
    for (const r of cfg.rivers ?? []) this.rivers.push(this.makeRiver(r));
    for (const c of cfg.cliffs ?? []) this.cliffBoxes.push({ left: c.x - c.w / 2, right: c.x + c.w / 2, top: c.y - c.h / 2, bottom: c.y + c.h / 2 });
    const clear = cfg.clear ?? [];
    const ok = (x: number, y: number, gap: number) => !clear.some(c => Math.hypot(x - c.x, y - c.y) < c.r)
      && !this.inWater(x, y, TERRAIN.trunk + 20) && !this.onBridge(x, y, 60) && !this.trees.some(t => Math.hypot(t.x - x, t.y - y) < gap)
      && !this.cliffBoxes.some(b => x > b.left - 40 && x < b.right + 40 && y > b.top - 40 && y < b.bottom + 60);
    for (const t of cfg.trees ?? []) if (ok(t.x, t.y, 70)) this.addTree(t.x, t.y, t.kind ?? 'pine', t.size);
    for (const w of cfg.woods ?? []) {
      let s = w.seed * 9973 + 1; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      const gap = w.gap ?? 92;
      for (let n = 0, tries = 0; n < w.count && tries < w.count * 30; tries++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()), x = w.x + Math.cos(a) * w.rx * r, y = w.y + Math.sin(a) * w.ry * r;
        if (!ok(x, y, gap)) continue;
        this.addTree(x, y, w.kind ?? (rnd() < .5 ? 'pine' : 'broad')); n++;
      }
    }
    for (const t of this.trees) { const k = this.key(Math.floor(t.x / TERRAIN.cell), Math.floor(t.y / TERRAIN.cell)); const l = this.grid.get(k); if (l) l.push(t); else this.grid.set(k, [t]); }
    // 树的图：没载入就现载（山道图集），载完再画
    // 地形图没载入就现载（v2 地形图；载不到时退回山道图集），载完再画
    const L = scene.load; let pending = 0;
    if (!scene.textures.exists(TERRAIN_ART.trees)) { L.spritesheet(TERRAIN_ART.trees, ART_FILES.trees, { frameWidth: 384, frameHeight: 384 }); pending++; }
    if (!scene.textures.exists(TERRAIN_ART.water)) { L.image(TERRAIN_ART.water, ART_FILES.water); pending++; }
    if (!scene.textures.exists(TERRAIN_ART.bridge)) { L.image(TERRAIN_ART.bridge, ART_FILES.bridge); pending++; }
    if (!scene.textures.exists(ART)) { L.spritesheet(ART, ART_FILE, { frameWidth: 384, frameHeight: 384 }); pending++; }
    if (!pending) { this.build(); this.buildWater(); }
    else { L.once('complete', () => { if (scene.sys.isActive() || scene.sys.isPaused()) { this.build(); this.buildWater(); } }); L.start(); }
  }
  private key(cx: number, cy: number) { return (cx + 4096) * 8192 + (cy + 4096); }
  private addTree(x: number, y: number, kind: TreeKind, size?: number) { this.trees.push({ x, y, kind, burnt: false, burning: 0, behind: false, size: size ?? TERRAIN.treeSize[kind] }); }

  // ---------- 河 ----------
  private makeRiver(spec: RiverSpec): River {
    const segs: Seg[] = []; let s0 = 0;
    for (let i = 0; i + 1 < spec.points.length; i++) {
      const a = spec.points[i], b = spec.points[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len, ux: (b.x - a.x) / len, uy: (b.y - a.y) / len, s0 }); s0 += len;
    }
    const half = spec.width / 2, xs = spec.points.map(p => p.x), ys = spec.points.map(p => p.y);
    const river: River = { spec, segs, half, total: s0, box: { l: Math.min(...xs) - half, r: Math.max(...xs) + half, t: Math.min(...ys) - half, b: Math.max(...ys) + half }, bridges: [] };
    for (const br of spec.bridges) {
      const at = br.at * s0, seg = segs.find(sg => at >= sg.s0 && at <= sg.s0 + sg.len) ?? segs[segs.length - 1], d = at - seg.s0;
      river.bridges.push({ x: seg.ax + seg.ux * d, y: seg.ay + seg.uy * d, ux: -seg.uy, uy: seg.ux, halfLen: half + TERRAIN.bridgeOverhang, halfW: br.width / 2 });
    }
    return river;
  }
  /** 点到河中线的距离（只算外包框里的河）。 */
  private riverDist(r: River, x: number, y: number): { d: number; seg: Seg; t: number } | null {
    if (x < r.box.l || x > r.box.r || y < r.box.t || y > r.box.b) return null;
    let best: { d: number; seg: Seg; t: number } | null = null;
    for (const s of r.segs) { const t = Math.max(0, Math.min(s.len, (x - s.ax) * s.ux + (y - s.ay) * s.uy)), px = s.ax + s.ux * t, py = s.ay + s.uy * t, d = Math.hypot(x - px, y - py); if (!best || d < best.d) best = { d, seg: s, t }; }
    return best;
  }
  /** 是否站在桥面上（margin 放宽判定）。 */
  onBridge(x: number, y: number, margin = 0): boolean {
    for (const r of this.rivers) for (const b of r.bridges) { const dx = x - b.x, dy = y - b.y, along = dx * b.ux + dy * b.uy, side = dx * -b.uy + dy * b.ux; if (Math.abs(along) <= b.halfLen + margin && Math.abs(side) <= b.halfW + margin) return true; }
    return false;
  }
  /** 是否在水里（不在桥上；pad 放宽水面半宽）。 */
  inWater(x: number, y: number, pad = 0): boolean {
    for (const r of this.rivers) { const h = this.riverDist(r, x, y); if (h && h.d < r.half + pad && !this.onBridge(x, y)) return true; }
    return false;
  }
  /** 该点的移动倍率：水里 TERRAIN.waterMul，否则 1。 */
  speedMul(x: number, y: number): number { if (!this.rivers.length) return 1; this.stats.waterChecks++; return this.inWater(x, y) ? TERRAIN.waterMul : 1; }

  // ---------- 刷兵 / 掉落落点 ----------
  /** 落在水里 → 挪到最近的岸上；落在树干里 → 挪到树外。返回新点（没动就原样）。 */
  free(x: number, y: number, r = 20): Pt {
    for (const rv of this.rivers) {
      const h = this.riverDist(rv, x, y);
      if (h && h.d < rv.half + r && !this.onBridge(x, y)) {
        const s = h.seg, px = s.ax + s.ux * h.t, py = s.ay + s.uy * h.t;
        let nx = x - px, ny = y - py; const n = Math.hypot(nx, ny);
        if (n < .001) { nx = -s.uy; ny = s.ux; } else { nx /= n; ny /= n; }
        x = px + nx * (rv.half + r + 12); y = py + ny * (rv.half + r + 12); this.stats.moved++;
      }
    }
    for (const t of this.treesNear(x, y)) { if (t.burnt) continue; const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy), m = TERRAIN.trunk + r + 4; if (d < m) { const k = d > .001 ? m / d : 0; x = d > .001 ? t.x + dx * k : t.x + m; y = d > .001 ? t.y + dy * k : y; this.stats.moved++; } }
    return { x, y };
  }

  // ---------- 树 ----------
  private treesNear(x: number, y: number): Tree[] {
    const cx = Math.floor(x / TERRAIN.cell), cy = Math.floor(y / TERRAIN.cell); this.near.length = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const l = this.grid.get(this.key(cx + dx, cy + dy)); if (l) for (const t of l) this.near.push(t); }
    return this.near;
  }
  /** 把一个圆推出树干。返回推开量（没碰到为 null）。 */
  private push(x: number, y: number, r: number): Pt | null {
    let px = 0, py = 0, hit = false;
    for (const t of this.treesNear(x, y)) {
      if (t.burnt) continue;
      const dx = x + px - t.x, dy = y + py - t.y, d = Math.hypot(dx, dy), m = TERRAIN.trunk + r;
      if (d >= m) continue;
      hit = true;
      if (d > .001) { px += dx / d * (m - d); py += dy / d * (m - d); } else px += m;
    }
    return hit ? { x: px, y: py } : null;
  }
  /** 每帧：把主将、部曲、敌兵推出树干（只查各自附近的格子）。 */
  resolve(player: Player, allies: readonly Ally[], enemies: readonly Enemy[]) {
    if (!this.trees.length) return;
    let p = this.push(player.x, player.y, player.radius); if (p) { player.sprite.x += p.x; player.sprite.y += p.y; this.stats.pushes++; }
    for (const a of allies) if (a.active) { p = this.push(a.x, a.y, a.radius); if (p) a.push(p.x, p.y); }
    for (const e of enemies) if (e.active && !e.isSupplySlot) { p = this.push(e.x, e.y, e.radius); if (p) { e.sprite.x += p.x; e.sprite.y += p.y; } }
  }
  /** 部曲寻路用：树干当作小方块。 */
  navBoxes(): Array<{ left: number; right: number; top: number; bottom: number }> { const r = TERRAIN.trunk; return this.trees.filter(t => !t.burnt).map(t => ({ left: t.x - r, right: t.x + r, top: t.y - r, bottom: t.y + r })); }
  /** 树冠遮挡：主将走到树后面时树冠变半透明（只查主将附近的树）。 */
  updateCanopy(player: Player) {
    // 只看主将附近的树，加上上一帧已经变透明的树（离开后恢复）——不扫全图
    const check = new Set<Tree>([...this.treesNear(player.x, player.y), ...this.faded]);
    this.faded.clear();
    for (const t of check) {
      if (!t.img) continue;
      const behind = player.y < t.y - 4 && t.y - player.y < t.size * .85 && Math.abs(player.x - t.x) < t.size * .38;
      if (behind) this.faded.add(t);
      if (behind !== t.behind) { t.behind = behind; t.img.setAlpha(behind ? TERRAIN.behindAlpha : t.burnt ? .9 : 1); }
    }
  }
  /** 夷陵火：着火格子（左上角 x0,y0、边长 size）里的树被点着；返回新点着的树（火势系统据此往四周窜火）。 */
  burnTreesIn(x0: number, y0: number, size: number, now: number): Pt[] {
    const out: Pt[] = [];
    for (const t of this.treesNear(x0 + size / 2, y0 + size / 2)) {
      if (t.burnt || t.burning || t.x < x0 || t.x > x0 + size || t.y < y0 || t.y > y0 + size) continue;
      t.burning = now + 2600; this.burning.push(t); out.push({ x: t.x, y: t.y }); this.stats.burnt++;
      if (t.img) { t.img.setTint(0xffb27a); playSheet(this.scene, 'fx_ground_fire', t.x, t.y - t.size * .35, { size: t.size * .8, depth: actorDepth(t.y) + 1, ms: 2600, alpha: .95, originY: .8 }); }
    }
    return out;
  }
  update(now: number, dt: number) {
    for (const w of this.water) { w.ts.tilePositionX -= TERRAIN.flow * dt; }
    for (const t of [...this.burning]) if (now >= t.burning) {
      this.burning.splice(this.burning.indexOf(t), 1); t.burning = 0; t.burnt = true;
      if (t.img) { if (t.img.texture.key === TERRAIN_ART.trees) t.img.clearTint().setFrame(3).setDisplaySize(t.size * .6, t.size * .6).setAlpha(1); else t.img.setTint(0x2a2018).setDisplaySize(t.size * .45, t.size * .45).setAlpha(.9); }
    }
  }

  // ---------- 画 ----------
  private build() {
    if (this.built) return; this.built = true;
    const sc = this.scene, v2 = sc.textures.exists(TERRAIN_ART.trees);
    let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const t of this.trees) {
      // v2：松 0 / 小松 4、竹 1 / 细竹 5、阔叶 2、雨林树 6 / 灌木 7（南征），随机挑
      const alt = rnd() < .35, frame = v2 ? ({ pine: alt ? 4 : 0, bamboo: alt ? 5 : 1, broad: 2, jungle: alt ? 7 : 6 } as const)[t.kind] : t.kind === 'bamboo' ? 3 : 2;
      const img = sc.add.image(t.x, t.y + 6, v2 ? TERRAIN_ART.trees : ART, frame).setOrigin(.5, .92).setDisplaySize(t.size, t.size).setDepth(actorDepth(t.y)).setFlipX(rnd() < .5);
      if (!v2 && (t.kind === 'broad' || t.kind === 'jungle')) img.setTint(0xc8d8a8); // 阔叶树过渡：松树换浅一点的色调
      t.img = img; this.objects.push(img);
    }
    this.buildCliffs();
  }
  /**
   * 山崖：第七章山道图集 shu_pass 的左 / 右坡壁（帧 0 / 1）铺满矩形（底排的脚贴着碰撞框底边），坡上几棵松；
   * 深度压在地面层（同山道崖壁），人物永远画在崖前，不会被遮住。
   */
  private buildCliffs() {
    const sc = this.scene; if (!this.cliffBoxes.length || !sc.textures.exists(ART)) return;
    let s = 31; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const b of this.cliffBoxes) {
      const w = b.right - b.left, h = b.bottom - b.top, cols = Math.max(1, Math.round(w / 230)), rows = Math.max(1, Math.round(h / 190)), size = 330;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = b.left + (c + .5) * w / cols + (rnd() - .5) * 30, y = b.top + (r + 1) * h / rows + 30;
        const img = sc.add.image(x, y, ART, (c + r) % 2).setOrigin(.5, 1).setDisplaySize(size, size).setFlipX(rnd() < .5).setDepth(DEPTH.ground + 3 + (y + 5000) / 1e5).setName('terrain-cliff');
        this.objects.push(img);
        if (rnd() < .35) this.objects.push(sc.add.image(x + (rnd() - .5) * 80, y - size * .55, ART, 2).setOrigin(.5, 1).setDisplaySize(150, 150).setDepth(DEPTH.ground + 3.05 + (y + 5000) / 1e5).setName('terrain-cliff-pine'));
      }
    }
  }
  private buildWater() {
    const sc = this.scene, v2 = sc.textures.exists(TERRAIN_ART.water), wKey = v2 ? TERRAIN_ART.water : sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE';
    for (const r of this.rivers) {
      for (const g of r.segs) {
        const cx = (g.ax + g.bx) / 2, cy = (g.ay + g.by) / 2, ang = Math.atan2(g.uy, g.ux), L = g.len + r.half; // 两头各伸半宽，折角处不露缝
        const bank = sc.add.tileSprite(cx, cy, L + 30, r.spec.width + 34, sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE').setRotation(ang).setTint(0x5a4a30).setAlpha(.9).setDepth(DEPTH.ground + 1);
        const ts = sc.add.tileSprite(cx, cy, L, r.spec.width, wKey).setRotation(ang).setDepth(DEPTH.ground + 2);
        if (!v2) ts.setTint(0x5f8e9c).setAlpha(.9); else ts.setTileScale(.42).setAlpha(.96);
        this.objects.push(bank, ts); this.water.push({ ts, ux: g.ux, uy: g.uy });
      }
      for (const b of r.bridges) {
        const ang = Math.atan2(b.uy, b.ux), len = b.halfLen * 2, v2b = sc.textures.exists(TERRAIN_ART.bridge);
        const deck = v2b ? sc.add.image(b.x, b.y, TERRAIN_ART.bridge).setDisplaySize(Math.max(len, b.halfW * 2.5 * 2.5), b.halfW * 2.5).setRotation(ang)
          : sc.add.tileSprite(b.x, b.y, len, b.halfW * 2, 'yellow_props', 10).setTileScale(b.halfW * 2 / 128).setRotation(ang).setTint(0xd8c09a);
        deck.setDepth(DEPTH.ground + 3); this.objects.push(deck);
        if (!v2b) for (const sgn of [-1, 1]) {
          const rx = b.x + -b.uy * sgn * b.halfW, ry = b.y + b.ux * sgn * b.halfW;
          const rail = sc.add.tileSprite(rx, ry, len, 26, 'yellow_props', 11).setTileScale(26 / 128).setRotation(ang).setDepth(DEPTH.ground + 4); this.objects.push(rail);
        }
      }
    }
  }
  get info() { return { cliffs: this.cliffBoxes.length, trees: this.trees.length, burnt: this.trees.filter(t => t.burnt).length, rivers: this.rivers.length, bridges: this.rivers.reduce((n, r) => n + r.bridges.length, 0) }; }
  /** 测试用：第 i 座桥的中心与桥向。 */
  bridge(i = 0) { const all = this.rivers.flatMap(r => r.bridges); return all[i] ?? null; }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; this.water = []; }
}
