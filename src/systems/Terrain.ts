import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { TERRAIN, type TerrainConfig, type TreeKind, type Pt, type RiverSpec, type AutoGroves } from '../data/terrain';
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
interface Tree { x: number; y: number; kind: TreeKind; img?: Phaser.GameObjects.Image; burnt: boolean; burning: number; behind: boolean; size: number; auto?: boolean }
interface Seg { ax: number; ay: number; bx: number; by: number; len: number; ux: number; uy: number; s0: number }
interface Bridge { x: number; y: number; ux: number; uy: number; halfLen: number; halfW: number; broken: boolean; style: 'wood' | 'stone' }
interface River { spec: RiverSpec; segs: Seg[]; half: number; box: { l: number; r: number; t: number; b: number }; bridges: Bridge[]; total: number }
/** 河 / 桥新图（2026-11-18 ChatGPT 出图，原图 originals/river_kit_gpt_v1.png、bridge_kit_gpt_v1.png，tools/crop-terrain-kit.mjs 裁切；带 Mirror 的是与自身镜像拼成的无缝平铺）。 */
const RV = 'assets/terrain/river/', BR = 'assets/terrain/bridge/';
const BANK_KINDS = ['mud', 'rock', 'reed', 'cliff'] as const;
const RIVER_ART: Record<string, string> = {
  tr_water: RV + 'water.png', tr_foam: RV + 'foam.png', tr_reed: RV + 'reed.png', tr_rocks: RV + 'rocks.png', tr_boat: RV + 'boat.png',
  ...Object.fromEntries(BANK_KINDS.flatMap(k => [[`tr_bankN_${k}`, `${RV}bankN_${k}.png`], [`tr_bankS_${k}`, `${RV}bankS_${k}.png`]])),
  tb_deck: BR + 'deckT.png', tb_railL: BR + 'railLT.png', tb_railR: BR + 'railRT.png', tb_headN: BR + 'headN.png', tb_headS: BR + 'headS.png', tb_piers: BR + 'piers.png',
  tb_stoneDeck: BR + 'stoneDeckT.png', tb_stoneHead: BR + 'stoneHead.png', tb_broken: BR + 'broken.png',
};
interface WaterRec { cx: number; cy: number; rad: number; flow: Phaser.GameObjects.TileSprite[]; glint?: Phaser.GameObjects.TileSprite; foam: Phaser.GameObjects.TileSprite[]; ph: number }
interface BridgeVis { always: Phaser.GameObjects.GameObject[]; intact: Phaser.GameObjects.GameObject[]; broken: Phaser.GameObjects.GameObject[] }
const tex1 = (sc: Phaser.Scene, k: string) => sc.textures.get(k).getSourceImage() as { width: number; height: number };
const ART = 'shu_pass', ART_FILE = 'assets/shu/pass.png';
/** 正式 v2 地形图（到了再接）：terrain_trees（松 / 竹 / 阔叶 / 焦桩 …）、terrain_water（水面平铺）、terrain_bridge（桥）。 */
export const TERRAIN_ART = { trees: 'terrain_trees', trees2: 'terrain_trees2', water: 'terrain_water', bridge: 'terrain_bridge' } as const;
/** v2 地形图（2026-11-17 Gemini 3.1 Pro 出图，原图在 public/assets/terrain/originals/）：树图集 4×2（384 格：松 / 竹 / 阔叶 / 焦桩 / 小松 / 细竹 / 雨林树 / 灌木）、水面平铺 512、木桥（横向，宽高约 2.5:1）。 */
/** 第二张树图集 trees2（2026-11-18 即梦 Seedream 5.5，原图 originals/jimeng_terrain_trees2.webp）4×2（384 格）：垂柳 / 侧柏 / 白杨 / 枯树 / 小垂柳 / 小枯树 / 棕榈 / 榕树。 */
const ART_FILES = { trees: 'assets/terrain/trees.png', trees2: 'assets/terrain/trees2.png', water: 'assets/terrain/water.png', bridge: 'assets/terrain/bridge.png' } as const;
/** 树种 → 图集帧（[图集, 帧, 备选帧]：备选帧三成机会用）。 */
const TREE_FRAMES: Record<TreeKind, [keyof typeof ART_FILES, number, number?]> = {
  pine: ['trees', 0, 4], bamboo: ['trees', 1, 5], broad: ['trees', 2], jungle: ['trees', 6, 7],
  willow: ['trees2', 0, 4], cypress: ['trees2', 1], poplar: ['trees2', 2], dead: ['trees2', 3, 5], palm: ['trees2', 6], banyan: ['trees2', 7],
};

export function queueTreeArt(scene: Phaser.Scene, secondSheet: boolean): number {
  const sheets = [[TERRAIN_ART.trees, ART_FILES.trees], [ART, ART_FILE]];
  if (secondSheet) sheets.push([TERRAIN_ART.trees2, ART_FILES.trees2]);
  const missing = sheets.filter(([key]) => !scene.textures.exists(key));
  for (const [key, url] of missing) scene.load.spritesheet(key, url, { frameWidth: 384, frameHeight: 384 });
  return missing.length;
}

export class Terrain {
  readonly trees: Tree[] = [];
  readonly rivers: River[] = [];
  /** 山崖碰撞框（场景把它们并进 sishuiObstacles）。 */
  readonly cliffBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  readonly stats = { pushes: 0, waterChecks: 0, moved: 0, burnt: 0, auto: 0, drawn: 0 };
  private grid = new Map<number, Tree[]>();
  private objects: Phaser.GameObjects.GameObject[] = [];
  private water: WaterRec[] = []; private bridgeVis: BridgeVis[] = [];
  private near: Tree[] = []; private faded = new Set<Tree>(); private burning: Tree[] = [];
  private built = false; private cullAcc = 1e9;

  /** avoid：场景给的「这里别种树」（障碍框旁、城墙北边、关卡目标 / 营寨 / 布景附近），只管自动树林。 */
  constructor(private readonly scene: Phaser.Scene, cfg: TerrainConfig, avoid?: (x: number, y: number) => boolean) {
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
    if (cfg.auto) this.plantAuto(cfg.auto, ok, avoid);
    for (const t of this.trees) { const k = this.key(Math.floor(t.x / TERRAIN.cell), Math.floor(t.y / TERRAIN.cell)); const l = this.grid.get(k); if (l) l.push(t); else this.grid.set(k, [t]); }
    // 树的图：没载入就现载（山道图集），载完再画
    // 地形图没载入就现载（v2 地形图；载不到时退回山道图集），载完再画
    const L = scene.load; let pending = queueTreeArt(scene, this.trees.some(t => TREE_FRAMES[t.kind][0] === 'trees2'));
    if (this.rivers.length) for (const [k, f] of Object.entries(RIVER_ART)) if (!scene.textures.exists(k)) { L.image(k, f); pending++; }
    if (!pending) { this.build(); this.buildWater(); }
    else { L.once('complete', () => { if (scene.sys.isActive() || scene.sys.isPaused()) { this.build(); this.buildWater(); } }); L.start(); }
  }
  private key(cx: number, cy: number) { return (cx + 4096) * 8192 + (cy + 4096); }
  private addTree(x: number, y: number, kind: TreeKind, size?: number, auto = false) { this.trees.push({ x, y, kind, burnt: false, burning: 0, behind: false, size: size ?? TERRAIN.treeSize[kind], auto }); }
  /**
   * 自动树林（data/terrain.ts GROVES）：环带里成簇的树林、十字通道两侧的行道树、河两岸一行。
   * 中间十字通道（半宽 corridor）不种——开局点、主战场、路都留空；ok = 原有规则（不在水里 / 桥上 / 山崖旁 / clear 圈里、和别的树隔开）；avoid = 场景给的禁区。
   */
  private plantAuto(g: AutoGroves, ok: (x: number, y: number, gap: number) => boolean, avoid?: (x: number, y: number) => boolean) {
    let s = g.seed * 7919 + 3; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const [r0, r1] = g.ring ?? [700, 2500], cor = g.corridor ?? 280, kinds = Object.entries(g.mix) as Array<[TreeKind, number]>, tot = kinds.reduce((n, [, w]) => n + w, 0);
    const pick = (): TreeKind => { let r = rnd() * tot; for (const [k, w] of kinds) if ((r -= w) <= 0) return k; return kinds[0][0]; };
    const fine = (x: number, y: number, gap: number) => Math.abs(x) > cor && Math.abs(y) > cor && (g.minY === undefined || y > g.minY) && ok(x, y, gap) && !avoid?.(x, y);
    const n0 = this.trees.length;
    // 成簇的树林：一簇一个主树种（七成），椭圆里撒，树间隔 95 留穿行缝
    for (let i = 0, tries = 0; i < g.groves && tries < g.groves * 40; tries++) {
      const a = rnd() * Math.PI * 2, r = r0 + (r1 - r0) * Math.sqrt(rnd()), cx = Math.cos(a) * r, cy = Math.sin(a) * r * .8;
      if (!fine(cx, cy, 160)) continue; i++;
      const rx = 200 + rnd() * 150, ry = 130 + rnd() * 90, dom = pick(), n = g.per[0] + Math.floor(rnd() * (g.per[1] - g.per[0] + 1));
      for (let k = 0, t = 0; k < n && t < n * 25; t++) {
        const aa = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()), x = cx + Math.cos(aa) * rx * rr, y = cy + Math.sin(aa) * ry * rr, kind = rnd() < .7 ? dom : pick();
        if (!fine(x, y, 95)) continue; this.addTree(x, y, kind, undefined, true); k++;
      }
    }
    // 行道树：十字通道两侧各一行（开局点附近不种、三成留缺口）
    if (g.rows) for (const v of [true, false]) for (const side of [-1, 1]) for (let t = -r1; t <= r1; t += 200 + rnd() * 90) {
      if (Math.abs(t) < r0 * .8 || rnd() < .35) continue;
      const off = side * (cor + 60 + rnd() * 60), x = v ? off : t, y = v ? t : off;
      if (fine(x, y, 110)) this.addTree(x, y, g.rows, undefined, true);
    }
    // 河岸：两岸各一行，避开桥头
    if (g.riverside) for (const r of this.rivers) for (const sg of r.segs) for (let d = 0; d < sg.len; d += 220 + rnd() * 80) for (const side of [-1, 1]) {
      if (rnd() < .4) continue;
      const off = r.half + 80 + rnd() * 70, x = sg.ax + sg.ux * d - sg.uy * off * side, y = sg.ay + sg.uy * d + sg.ux * off * side;
      if (!this.onBridge(x, y, 200) && fine(x, y, 110)) this.addTree(x, y, g.riverside, undefined, true);
    }
    this.stats.auto = this.trees.length - n0;
  }

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
      river.bridges.push({ x: seg.ax + seg.ux * d, y: seg.ay + seg.uy * d, ux: -seg.uy, uy: seg.ux, halfLen: half + TERRAIN.bridgeOverhang, halfW: br.width / 2, broken: !!br.broken, style: br.style ?? 'wood' });
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
    for (const r of this.rivers) for (const b of r.bridges) { if (b.broken) continue; const dx = x - b.x, dy = y - b.y, along = dx * b.ux + dy * b.uy, side = dx * -b.uy + dy * b.ux; if (Math.abs(along) <= b.halfLen + margin && Math.abs(side) <= b.halfW + margin) return true; }
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
  /** 附近有没有（没烧掉的）树：补给箱 / 道具不放在树脚下（自动树林把树种满了之后，物件会和树叠在一起）。 */
  treeNear(x: number, y: number, r: number): boolean { for (const t of this.treesNear(x, y)) if (!t.burnt && Math.hypot(t.x - x, t.y - y) < TERRAIN.trunk + r) return true; return false; }
  /** 把一个圆推出树干（随行用，和主将同一套）。返回推开量（没碰到为 null）。 */
  pushCircle(x: number, y: number, r: number): Pt | null { return this.push(x, y, r); }
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
  /**
   * 树冠遮挡：主将、首领、精英走到树后面时树冠变半透明（只查他们附近的树）。
   * 首领 / 精英也算（用户 2026-11-18 场景审查：11-3 孟获、10-2 大批人物被丛林树冠整个盖住）。
   */
  updateCanopy(player: Player, others: ReadonlyArray<{ x: number; y: number }> = []) {
    // 只看这几人附近的树，加上上一帧已经变透明的树（离开后恢复）——不扫全图
    const who = [player, ...others], check = new Set<Tree>(this.faded);
    for (const w of who) for (const t of this.treesNear(w.x, w.y)) check.add(t);
    this.faded.clear();
    for (const t of check) {
      if (!t.img) continue;
      const behind = who.some(w => w.y < t.y - 4 && t.y - w.y < t.size * .85 && Math.abs(w.x - t.x) < t.size * .38);
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
    this.animateWater(now, dt);
    for (const t of [...this.burning]) if (now >= t.burning) {
      this.burning.splice(this.burning.indexOf(t), 1); t.burning = 0; t.burnt = true;
      if (t.img) { if (t.img.texture.key === TERRAIN_ART.trees || t.img.texture.key === TERRAIN_ART.trees2) t.img.clearTint().setTexture(TERRAIN_ART.trees, 3).setDisplaySize(t.size * .6, t.size * .6).setAlpha(1); else t.img.setTint(0x2a2018).setDisplaySize(t.size * .45, t.size * .45).setAlpha(.9); }
    }
    // 镜头外的树不画（4 Hz 按镜头开关可见；树是静态图，画不画不影响碰撞）
    this.cullAcc += dt * 1000;
    if (this.cullAcc >= 250 && this.trees.length > 40) {
      this.cullAcc = 0; const v = this.scene.cameras.main.worldView, pad = TERRAIN.cullPad; let n = 0;
      for (const t of this.trees) { if (!t.img) continue; const on = t.x > v.x - pad && t.x < v.right + pad && t.y > v.y - pad && t.y < v.bottom + pad + t.size; if (on !== t.img.visible) t.img.setVisible(on); if (on) n++; }
      this.stats.drawn = n;
    }
  }

  // ---------- 画 ----------
  private build() {
    if (this.built) return; this.built = true;
    const sc = this.scene, v2 = sc.textures.exists(TERRAIN_ART.trees), v2b = sc.textures.exists(TERRAIN_ART.trees2);
    let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const t of this.trees) {
      // v2：松 0 / 小松 4、竹 1 / 细竹 5、阔叶 2、雨林树 6 / 灌木 7；第二张：垂柳 0 / 小柳 4、侧柏 1、白杨 2、枯树 3 / 小枯树 5、棕榈 6、榕树 7（TREE_FRAMES，备选帧三成机会）
      let [sheet, frame, alt] = TREE_FRAMES[t.kind]; if (alt !== undefined && rnd() < .35) frame = alt;
      if (sheet === 'trees2' && !v2b) { sheet = 'trees'; frame = t.kind === 'palm' || t.kind === 'banyan' ? 6 : t.kind === 'dead' ? 3 : 2; } // 第二张没载到：退回第一张相近的树
      // 大小、色调浮动：成片的树不像复制粘贴（自动树林和原有树林都用）
      const j = 1 + (rnd() * 2 - 1) * TERRAIN.sizeJitter, f = rnd() * TERRAIN.tintJitter / .22; t.size = Math.round(t.size * j);
      const img = v2 ? sc.add.image(t.x, t.y + 6, sheet === 'trees2' ? TERRAIN_ART.trees2 : TERRAIN_ART.trees, frame) : sc.add.image(t.x, t.y + 6, ART, t.kind === 'bamboo' ? 3 : 2);
      img.setOrigin(.5, .92).setDisplaySize(t.size, t.size).setDepth(actorDepth(t.y)).setFlipX(rnd() < .5).setName(t.auto ? 'terrain-tree-auto' : 'terrain-tree');
      if (!v2 && t.kind !== 'pine' && t.kind !== 'bamboo') img.setTint(0xc8d8a8); // 阔叶树过渡：松树换浅一点的色调
      else if (f > .05) img.setTint(Phaser.Display.Color.GetColor(255 - 50 * f, 255 - 58 * f, 255 - 86 * f));
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
  /**
   * 河与桥（2026-11-18 重做）。河：水面（无缝镜像平铺，沿河滚动）+ 高光叠层（更快、略斜地滚）+ 两岸岸带（泥 / 石 / 芦苇 / 土坎四种，一段一种，镜像平铺无缝）
   * + 岸边浪花（透明度起伏）+ 岸边道具（芦苇 / 岩石 / 渔船）。桥：桥面平铺 + 两侧栏杆 + 水中桥墩 + 两端桥头（木桥 / 石拱桥）+ 水面桥影；断桥 setBridgeBroken。
   * 图都按「南北向横跨东西流向河」画：河向 = 贴图 X 向，桥向 = 贴图 Y 向（北端在上），任意折线用旋转。静态件一次摆好，只有水面 / 高光 / 浪花三类平铺图每帧滚动（屏幕外的不滚）。
   */
  private buildWater() {
    const sc = this.scene, has = (k: string) => sc.textures.exists(k);
    const tex = (k: string) => sc.textures.get(k).getSourceImage() as { width: number; height: number };
    let seed = 17; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const D = DEPTH.ground, HB = .48, kinds = BANK_KINDS.filter(k => has(`tr_bankN_${k}`));
    for (const r of this.rivers) {
      const W = r.spec.width, half = r.half;
      const nearBridge = (x: number, y: number, pad: number) => r.bridges.some(b => Math.hypot(x - b.x, y - b.y) < b.halfW + pad);
      let prev = '';
      r.segs.forEach((g, si) => {
        const cx = (g.ax + g.bx) / 2, cy = (g.ay + g.by) / 2, ang = Math.atan2(g.uy, g.ux), L = g.len + half, nx = g.uy, ny = -g.ux; // n = 北侧（贴图「上」）
        const rec: WaterRec = { cx, cy, rad: L / 2 + W, flow: [], foam: [], ph: si * 1.7 + rnd() * 3 };
        if (has('tr_water')) {
          const ts = sc.add.tileSprite(cx, cy, L, W + 40, 'tr_water').setRotation(ang).setTileScale(620 / tex('tr_water').width).setDepth(D + 2); rec.flow.push(ts); this.objects.push(ts);
        } else { const ts = sc.add.tileSprite(cx, cy, L, W + 40, 'ground_v2_jiang').setRotation(ang).setTint(0x5f8e9c).setDepth(D + 2); rec.flow.push(ts); this.objects.push(ts); }
        if (has('tr_glint')) {
          const gl = sc.add.tileSprite(cx, cy, L, W + 40, 'tr_glint').setRotation(ang).setTileScale(560 / tex('tr_glint').width).setAlpha(.55).setDepth(D + 2.05); rec.glint = gl; this.objects.push(gl);
        }
        // 岸带：沿河分段，一段一种（段长约 1100，相邻不同种）
        for (const side of [1, -1]) {
          const sk = side > 0 ? 'N' : 'S', n = Math.max(1, Math.round((g.len + 60) / 1100)), cl = (g.len + 60) / n;
          for (let c = 0; c < n; c++) {
            const pool = kinds.filter(k => k !== prev), kind = pool[Math.floor(rnd() * pool.length)] ?? kinds[0]; prev = kind;
            const key = `tr_bank${sk}_${kind}`; if (!has(key)) continue;
            const hh = tex(key).height * HB, t = -30 + cl * (c + .5), off = side > 0 ? half + hh * .3 : -(half + hh * .1);
            const bank = sc.add.tileSprite(g.ax + g.ux * t + nx * off, g.ay + g.uy * t + ny * off, cl + 2, hh, key).setRotation(ang).setTileScale(HB).setDepth(D + 2.2 + (side > 0 ? 0 : .01)); this.objects.push(bank);
          }
          if (has('tr_foam')) {
            const fh = tex('tr_foam').height * .5, off2 = side * (half - 4);
            const fm = sc.add.tileSprite(cx + nx * off2, cy + ny * off2, L, fh, 'tr_foam').setRotation(ang).setTileScale(.5).setAlpha(.5).setDepth(D + 2.3); rec.foam.push(fm); this.objects.push(fm);
          }
        }
        this.water.push(rec);
        // 岸边道具：芦苇（岸线上）、岩石（近岸水里）；宽河（≥240）一条渔船
        for (let d = 120 + rnd() * 200; d < g.len - 60; d += 380 + rnd() * 420) {
          const side = rnd() < .5 ? 1 : -1, kind = rnd();
          const lat = kind < .55 ? side * (half - 6 + rnd() * 10) : side * (half * (.5 + rnd() * .25)), x = g.ax + g.ux * d + nx * lat, y = g.ay + g.uy * d + ny * lat;
          if (nearBridge(x, y, 150)) continue;
          if (kind < .55 && has('tr_reed')) this.objects.push(sc.add.image(x, y, 'tr_reed').setOrigin(.5, .86).setScale(.42 + rnd() * .12).setDepth(D + 2.8 + y / 1e6).setFlipX(rnd() < .5));
          else if (has('tr_rocks')) this.objects.push(sc.add.image(x, y, 'tr_rocks').setOrigin(.5, .6).setScale(.42 + rnd() * .15).setDepth(D + 2.8 + y / 1e6).setFlipX(rnd() < .5));
        }
        if (W >= 240 && si === 0 && has('tr_boat')) {
          for (let d = g.len * .18; d < g.len * .9; d += 90) {
            const x = g.ax + g.ux * d + nx * half * .32, y = g.ay + g.uy * d + ny * half * .32; if (nearBridge(x, y, 220)) continue;
            this.objects.push(sc.add.image(x, y, 'tr_boat').setOrigin(.5, .6).setScale(.5).setRotation(ang).setDepth(D + 2.8 + y / 1e6)); break;
          }
        }
      });
      for (const b of r.bridges) this.bridgeVis.push(this.buildBridge(r, b));
    }
    this.bridgeVis.forEach((_, i) => this.applyBridgeState(i));
  }
  /** 一座桥的全部图件：always = 桥墩 / 桥头（两种状态都在）；intact = 桥面 / 栏杆 / 桥影；broken = 断口残骸。 */
  private buildBridge(r: River, b: Bridge): BridgeVis {
    const sc = this.scene, has = (k: string) => sc.textures.exists(k), D = DEPTH.ground, stone = b.style === 'stone';
    const vis: BridgeVis = { always: [], intact: [], broken: [] }, rot = Math.atan2(-b.ux, b.uy), half = r.half, span = half * 2;
    const P = (a: number, c: number) => ({ x: b.x + b.ux * a + b.uy * c, y: b.y + b.uy * a - b.ux * c });
    const add = <T extends Phaser.GameObjects.GameObject>(o: T, list: Phaser.GameObjects.GameObject[]) => { list.push(o); this.objects.push(o); return o; };
    const deckKey = stone ? 'tb_stoneDeck' : 'tb_deck';
    if (!has(deckKey)) { // 没载到新图：退回营地木栅
      add(sc.add.tileSprite(b.x, b.y, b.halfW * 2, span + 90, 'yellow_props', 10).setTileScale(b.halfW * 2 / 128).setRotation(rot).setTint(0xd8c09a).setDepth(D + 3), vis.intact); return vis;
    }
    const dw = tex1(sc, deckKey).width, s = b.halfW * 2 / dw, sp = P(0, 0);
    // 桥影：桥面图染深、向右下错一点，贴在水面上
    add(sc.add.tileSprite(sp.x + 12, sp.y + 18, dw * s, span + 60, deckKey).setRotation(rot).setTileScale(s).setTint(0x06222c).setAlpha(.3).setDepth(D + 2.5), vis.intact);
    // 桥墩（木桥）：每 ~170 一组，木桩插在水里，桥面盖在上面
    if (!stone && has('tb_piers')) {
      const ps = b.halfW * 2 * 1.2 / tex1(sc, 'tb_piers').width, n = Math.max(1, Math.round(span / 170) - 1);
      for (let k = 1; k <= n; k++) { const p = P(-half + span * k / (n + 1), 0); add(sc.add.image(p.x, p.y, 'tb_piers').setScale(ps).setRotation(rot).setDepth(D + 2.6), vis.always); }
    }
    add(sc.add.tileSprite(sp.x, sp.y, dw * s, span + 80, deckKey).setRotation(rot).setTileScale(s).setDepth(D + 3), vis.intact);
    if (!stone && has('tb_railL')) {
      const rw = tex1(sc, 'tb_railL').width, off = (dw / 2 - 12) * s;
      for (const [k, sgn] of [['tb_railL', -1], ['tb_railR', 1]] as const) { const p = P(0, sgn * off); add(sc.add.tileSprite(p.x, p.y, rw * s, span + 80, k).setRotation(rot).setTileScale(s).setDepth(D + 3.1), vis.intact); }
    }
    // 桥头：北端在上。木桥 headN 桥身在图下沿；石桥 stoneHead 桥身在图上沿（北头纵向翻转）
    const hs = s * (stone ? 1 : 1.04), pn = P(-(half - 26), 0), pz = P(half - 26, 0);
    if (stone && has('tb_stoneHead')) {
      add(sc.add.image(pn.x, pn.y, 'tb_stoneHead').setOrigin(.5, 0).setScale(hs, -hs).setRotation(rot).setDepth(D + 3.2), vis.always);
      add(sc.add.image(pz.x, pz.y, 'tb_stoneHead').setOrigin(.5, 0).setScale(hs).setRotation(rot).setDepth(D + 3.2), vis.always);
    } else if (has('tb_headN') && has('tb_headS')) {
      add(sc.add.image(pn.x, pn.y, 'tb_headN').setOrigin(.5, 1).setScale(hs).setRotation(rot).setDepth(D + 3.2), vis.always);
      add(sc.add.image(pz.x, pz.y, 'tb_headS').setOrigin(.5, 0).setScale(hs).setRotation(rot).setDepth(D + 3.2), vis.always);
    }
    // 断口残骸：从两端桥头各伸出一截，断口朝桥心
    if (has('tb_broken')) {
      const bs = s * Math.min(1, span * .4 / (tex1(sc, 'tb_broken').height * s)), qn = P(-(half - 30), 0), qz = P(half - 30, 0);
      add(sc.add.image(qn.x, qn.y, 'tb_broken').setOrigin(.5, 0).setScale(bs).setRotation(rot).setDepth(D + 3.05), vis.broken);
      add(sc.add.image(qz.x, qz.y, 'tb_broken').setOrigin(.5, 0).setScale(-bs).setRotation(rot).setDepth(D + 3.05), vis.broken);
    }
    return vis;
  }
  private applyBridgeState(i: number) {
    const b = this.rivers.flatMap(r => r.bridges)[i], v = this.bridgeVis[i]; if (!b || !v) return;
    const set = (list: Phaser.GameObjects.GameObject[], on: boolean) => { for (const o of list) (o as unknown as { setVisible(v: boolean): void }).setVisible(on); };
    set(v.always, true); set(v.intact, !b.broken); set(v.broken, b.broken);
  }
  /** 断桥 / 修复第 i 座桥（按 rivers 顺序、河内按 bridges 顺序数）：断了就当水处理（减速、不能走）。给 5-1 长坂断桥用。 */
  setBridgeBroken(i: number, broken = true) { const b = this.rivers.flatMap(r => r.bridges)[i]; if (!b) return false; b.broken = broken; this.applyBridgeState(i); return true; }
  isBridgeBroken(i: number) { return !!this.rivers.flatMap(r => r.bridges)[i]?.broken; }
  private animateWater(now: number, dt: number) {
    if (!this.water.length) return;
    const v = this.scene.cameras.main.worldView, m = 500;
    for (const w of this.water) {
      if (w.cx + w.rad < v.x - m || w.cx - w.rad > v.right + m || w.cy + w.rad < v.y - m || w.cy - w.rad > v.bottom + m) continue;
      for (const ts of w.flow) ts.tilePositionX -= TERRAIN.flow * dt / ts.tileScaleX * .5;
      if (w.glint) { w.glint.tilePositionX -= TERRAIN.flow * dt / w.glint.tileScaleX * .9; w.glint.tilePositionY += 6 * dt; w.glint.setAlpha(.45 + .2 * Math.sin(now / 900 + w.ph)); }
      for (const f of w.foam) { f.tilePositionX += 9 * dt; f.setAlpha(.38 + .3 * Math.sin(now / 650 + w.ph)); }
    }
  }
  get info() { return { cliffs: this.cliffBoxes.length, trees: this.trees.length, burnt: this.trees.filter(t => t.burnt).length, rivers: this.rivers.length, bridges: this.rivers.reduce((n, r) => n + r.bridges.length, 0) }; }
  /** 测试用：第 i 座桥的中心与桥向。 */
  bridge(i = 0) { const all = this.rivers.flatMap(r => r.bridges); return all[i] ?? null; }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; this.water = []; this.bridgeVis = []; }
}
