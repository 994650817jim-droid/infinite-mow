import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { LQ, lqDiamond } from './LacquerKit';
import { warText } from './WarStyle';
import type { BattleOrders } from '../systems/BattleOrders';
import type { Enemy } from '../entities/Enemy';

/**
 * 战场地图（电脑布局；设计见共享笔记 battle-map-design.md）：
 *  - 小地图：右上角（设置钮左侧）170×110，羊皮纸底（ink_paper 中间裁一块）+ 漆金框；以主将为中心，约 2600×1700 范围。
 *  - 大地图：G 键开关，屏幕中央 640×400，约 4 倍范围，军令目标标名字；不暂停。
 *  - 屏外军令箭头：当前首要军令（不含首领——首领箭头 BossPresence 已有）在屏外时，屏幕边缘画朱红小箭头 + 距离。
 * 图层：墨色障碍框、青色河道、敌兵密度淡墨（12×8 分桶，不逐个画）、精锐朱点、首领朱印（对象池 2）、随行碧点、主将金菱、军令朱旗菱。
 * 小 / 大地图 8 Hz 重画（一个 Graphics clear 重画）；障碍框每 2 秒重取一次。
 */
export const BATTLE_MAP = {
  mini: { x: 700, y: 10, w: 170, h: 110, range: 2600 },
  big: { w: 640, h: 400, range: 5200 },
  hz: 8, cols: 12, rows: 8, obstacleRefreshMs: 2000,
} as const;

type Box = { left: number; right: number; top: number; bottom: number };
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface MapHost {
  scene: Phaser.Scene;
  player(): { x: number; y: number };
  enemies(): readonly Enemy[];
  followers(): ReadonlyArray<{ x: number; y: number; active?: boolean }>;
  bosses(): readonly Enemy[];
}

const PAPER = 'bm_paper';
/** 从 ink_paper（500×803，带撕边透明）中间裁一块不透明的纸面，做成小 / 大地图共用的底纹。 */
function paperTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(PAPER)) return PAPER;
  if (!scene.textures.exists('ink_paper')) return null;
  const src = scene.textures.get('ink_paper').getSourceImage() as HTMLImageElement;
  const c = scene.textures.createCanvas(PAPER, 400, 250); if (!c) return null;
  c.context.drawImage(src, 50, 230, 400, 250, 0, 0, 400, 250); c.refresh(); return PAPER;
}

/** 一张地图视图（小 / 大共用）。 */
class MapView {
  readonly root: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly seals: Phaser.GameObjects.Image[] = [];
  private readonly names: Phaser.GameObjects.Text[] = [];
  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, readonly w: number, readonly h: number, readonly range: number, big: boolean) {
    this.root = scene.add.container(x, y).setScrollFactor(0).setDepth(big ? DEPTH.overlay + 5 : DEPTH.hud + 2).setName(big ? 'battle-map-big' : 'battle-map-mini');
    const frame = scene.add.graphics();
    if (big) frame.fillStyle(0x000000, .5).fillRect(-x, -y, GAME_WIDTH, GAME_HEIGHT);
    frame.fillStyle(0x000000, .4).fillRoundedRect(4, 5, w, h, 8);
    const key = paperTexture(scene);
    const paper = key ? scene.add.image(0, 0, key).setOrigin(0).setDisplaySize(w, h) : null;
    if (!paper) frame.fillStyle(0xd9c7a0, 1).fillRoundedRect(0, 0, w, h, 6);
    this.g = scene.add.graphics();
    const border = scene.add.graphics();
    border.lineStyle(big ? 3 : 2, LQ.gold, .95).strokeRoundedRect(0, 0, w, h, 6);
    border.lineStyle(1, LQ.lacquer, .8).strokeRoundedRect(3, 3, w - 6, h - 6, 4);
    border.fillStyle(LQ.goldHi, 1); for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h]]) lqDiamond(border, px, py, big ? 6 : 4);
    this.root.add([frame, ...(paper ? [paper] : []), this.g, border]);
    if (big) {
      this.root.add(scene.add.text(w / 2, -6, '战 场 地 图', warText(18, LQ.title)).setOrigin(.5, 1));
      this.root.add(scene.add.text(w / 2, h + 8, 'G / Esc 关闭 · 朱旗 = 军令　朱印 = 首领　墨晕 = 敌军　碧点 = 随行', warText(12, '#d8c8a0')).setOrigin(.5, 0));
    }
    for (let i = 0; i < 3; i++) { const s = scene.add.image(0, 0, 'seal_boss').setDisplaySize(big ? 26 : 15, big ? 26 : 15).setVisible(false); this.seals.push(s); this.root.add(s); }
    if (big) for (let i = 0; i < 6; i++) { const t = scene.add.text(0, 0, '', warText(12, '#3a1a0e')).setOrigin(.5, 1).setStroke('#f3e6c4', 3).setVisible(false); this.names.push(t); this.root.add(t); }
  }
  /** 世界 → 地图坐标（以 c 为中心）。 */
  private map(c: { x: number; y: number }, wx: number, wy: number): [number, number] { const k = this.w / this.range; return [this.w / 2 + (wx - c.x) * k, this.h / 2 + (wy - c.y) * k]; }
  private inside(px: number, py: number, pad = 3): boolean { return px >= pad && py >= pad && px <= this.w - pad && py <= this.h - pad; }

  draw(h: MapHost, orders: BattleOrders, boxes: readonly Box[], rivers: ReadonlyArray<{ ax: number; ay: number; bx: number; by: number; half: number }>, big: boolean): void {
    const c = h.player(), g = this.g.clear(), k = this.w / this.range, W = this.w, H = this.h;
    // 障碍（城墙 / 崖壁 / 营栅）：墨色块（裁到框内）
    g.fillStyle(0x3b2a1c, .55);
    for (const b of boxes) {
      let [x0, y0] = this.map(c, b.left, b.top), [x1, y1] = this.map(c, b.right, b.bottom);
      x0 = Math.max(2, x0); y0 = Math.max(2, y0); x1 = Math.min(W - 2, x1); y1 = Math.min(H - 2, y1);
      if (x1 > x0 && y1 > y0) g.fillRect(x0, y0, Math.max(1.5, x1 - x0), Math.max(1.5, y1 - y0));
    }
    // 河道：青墨线
    for (const r of rivers) {
      const [ax, ay] = this.map(c, r.ax, r.ay), [bx, by] = this.map(c, r.bx, r.by);
      if (!this.inside(ax, ay, -40) && !this.inside(bx, by, -40)) continue;
      g.lineStyle(Math.max(2, r.half * 2 * k), 0x4f8592, .55).lineBetween(Phaser.Math.Clamp(ax, 2, W - 2), Phaser.Math.Clamp(ay, 2, H - 2), Phaser.Math.Clamp(bx, 2, W - 2), Phaser.Math.Clamp(by, 2, H - 2));
    }
    // 敌兵密度：分桶淡墨（精锐另画朱点）
    const C = BATTLE_MAP.cols, R = BATTLE_MAP.rows, bins = new Uint8Array(C * R), elites: Array<[number, number]> = [];
    for (const e of h.enemies()) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.hp <= 0) continue;
      const [px, py] = this.map(c, e.x, e.y); if (!this.inside(px, py)) continue;
      if (e.kind === 'elite') { if (elites.length < 24) elites.push([px, py]); continue; }
      const i = Math.min(C - 1, Math.floor(px / W * C)), j = Math.min(R - 1, Math.floor(py / H * R)); if (bins[j * C + i] < 255) bins[j * C + i]++;
    }
    const cw = W / C, ch = H / R;
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const n = bins[j * C + i]; if (!n) continue;
      g.fillStyle(0x24170e, Math.min(.62, .16 + n * .05)).fillEllipse((i + .5) * cw, (j + .5) * ch, Math.min(cw * 1.25, cw * (.55 + n * .07)), Math.min(ch * 1.25, ch * (.55 + n * .07))); }
    g.fillStyle(0xa62a1a, .95); for (const [px, py] of elites) g.fillCircle(px, py, big ? 3 : 2);
    // 随行：碧点
    g.fillStyle(0x3f8f6a, 1); g.lineStyle(1, 0x10241a, .9);
    for (const f of h.followers()) { if (f.active === false) continue; const [px, py] = this.map(c, f.x, f.y); if (this.inside(px, py)) g.fillCircle(px, py, big ? 3.5 : 2.4).strokeCircle(px, py, big ? 3.5 : 2.4); }
    // 首领：朱印（框外贴边）
    const bs = h.bosses().filter(b => b.active && b.hp > 0);
    this.seals.forEach((s, i) => { const b = bs[i]; if (!b) { s.setVisible(false); return; } const [px, py] = this.map(c, b.x, b.y); s.setPosition(Phaser.Math.Clamp(px, 8, W - 8), Phaser.Math.Clamp(py, 8, H - 8)).setVisible(true); });
    // 军令：朱旗菱（框外贴边画小三角），大地图标名字
    let ni = 0;
    for (const o of orders.all()) {
      if (o.state !== 'active' || o.kind === 'boss' || !o.at) continue; const p = o.at(); if (!p) continue;
      const [px, py] = this.map(c, p.x, p.y), inside = this.inside(px, py, 6), cx = Phaser.Math.Clamp(px, 7, W - 7), cy = Phaser.Math.Clamp(py, 7, H - 7);
      if (inside) { g.fillStyle(0xf3d48a, 1); lqDiamond(g, cx, cy, big ? 8 : 5.5); g.fillStyle(0xb3261a, 1); lqDiamond(g, cx, cy, big ? 6 : 4); g.lineStyle(1, 0xb3261a, .6).strokeCircle(cx, cy, big ? 12 : 8); }
      else { const a = Math.atan2(py - H / 2, px - W / 2), r = big ? 9 : 6; g.fillStyle(0xb3261a, 1).fillTriangle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a + 2.4) * r * .8, cy + Math.sin(a + 2.4) * r * .8, cx + Math.cos(a - 2.4) * r * .8, cy + Math.sin(a - 2.4) * r * .8); }
      const t = this.names[ni++]; if (t) t.setText(o.label).setPosition(cx, cy - 10).setVisible(true);
    }
    for (; ni < this.names.length; ni++) this.names[ni].setVisible(false);
    // 主将：金菱（中心）
    g.fillStyle(LQ.lacquer, 1); lqDiamond(g, W / 2, H / 2, big ? 8 : 6); g.fillStyle(LQ.goldHi, 1); lqDiamond(g, W / 2, H / 2, big ? 6 : 4.2);
  }
  setVisible(v: boolean): void { this.root.setVisible(v); }
  destroy(): void { this.root.destroy(true); }
}

export class BattleMap {
  private readonly mini: MapView;
  private big: MapView | null = null;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly arrowText: Phaser.GameObjects.Text;
  private acc = 0; private boxAcc = 1e9; private boxes: Box[] = []; private rivers: Array<{ ax: number; ay: number; bx: number; by: number; half: number }> = [];
  /** 测试用：重画次数、最近一次画了多少敌兵桶。 */
  readonly stats = { draws: 0, boxes: 0 };
  constructor(private readonly h: MapHost, private readonly orders: BattleOrders) {
    const M = BATTLE_MAP.mini, s = h.scene;
    this.mini = new MapView(s, M.x, M.y, M.w, M.h, M.range, false);
    this.arrow = s.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('orders-arrow');
    this.arrowText = s.add.text(0, 0, '', warText(12, '#ffd9a0')).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a0e08', 3).setVisible(false);
  }
  get bigOpen(): boolean { return !!this.big?.root.visible; }
  toggleBig(): void {
    if (!this.big) { const B = BATTLE_MAP.big; this.big = new MapView(this.h.scene, (GAME_WIDTH - B.w) / 2, (GAME_HEIGHT - B.h) / 2 + 6, B.w, B.h, B.range, true); this.big.setVisible(false); }
    this.big.setVisible(!this.big.root.visible); this.acc = 1e9;
  }
  setVisible(v: boolean): void { this.mini.setVisible(v); if (!v) { this.big?.setVisible(false); this.arrow.clear(); this.arrowText.setVisible(false); } }

  update(dt: number): void {
    this.boxAcc += dt * 1000; if (this.boxAcc >= BATTLE_MAP.obstacleRefreshMs) { this.boxAcc = 0; this.collectObstacles(); }
    this.drawArrow();
    this.acc += dt; if (this.acc < 1 / BATTLE_MAP.hz) return; this.acc = 0;
    this.mini.draw(this.h, this.orders, this.boxes, this.rivers, false); this.stats.draws++;
    if (this.big?.root.visible) this.big.draw(this.h, this.orders, this.boxes, this.rivers, true);
  }

  /** 场景里所有「挡人的框」：各系统的 footprints（关墙 / 山道 / 洪水 / 突围 / 陈仓…）+ 攻城的场地 / 城门框。只读。 */
  private collectObstacles(): void {
    const sc = this.h.scene as unknown as Any, out: Box[] = [], seen = new Set<unknown>();
    const add = (list: unknown) => { if (!Array.isArray(list) || seen.has(list)) return; seen.add(list); for (const b of list) if (b && typeof b.left === 'number') out.push(b as Box); };
    for (const k of Object.keys(sc)) { const v = sc[k]; if (!v || typeof v !== 'object') continue; add(v.footprints); if (v.obstacles && typeof v.obstacles === 'object') add(v.obstacles.footprints); }
    const m = sc.mid; if (m) { add(m.arenaBoxes); for (const b of [m.gateBox, m.innerGateBox]) if (b && typeof b.left === 'number') out.push(b); }
    this.boxes = out.length > 400 ? out.slice(0, 400) : out; this.stats.boxes = this.boxes.length;
    const t = sc.terrain; this.rivers = [];
    if (t && Array.isArray(t.rivers)) for (const r of t.rivers) for (const s of r.segs ?? []) this.rivers.push({ ax: s.ax, ay: s.ay, bx: s.bx, by: s.by, half: r.half ?? 30 });
  }

  /** 屏外军令箭头（不含首领）：屏幕边缘朱红箭头 + 「军令 · 距离」。 */
  private drawArrow(): void {
    const g = this.arrow.clear(), cur = this.orders.current();
    if (!cur || cur.kind === 'boss' || this.bigOpen) { this.arrowText.setVisible(false); return; }
    const cam = this.h.scene.cameras.main, v = cam.worldView, kx = GAME_WIDTH / v.width, ky = GAME_HEIGHT / v.height;
    const sx = (cur.pos.x - v.x) * kx, sy = (cur.pos.y - v.y) * ky, pad = 46;
    if (sx >= pad && sy >= pad && sx <= GAME_WIDTH - pad && sy <= GAME_HEIGHT - pad) { this.arrowText.setVisible(false); return; }
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2, a = Math.atan2(sy - cy, sx - cx);
    // 沿方向射到屏幕内框（避开顶部 HUD 与底部血条：上 92、下 84）
    const top = 92, bottom = GAME_HEIGHT - 84, left = 40, right = GAME_WIDTH - 40, dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity);
    const ax = cx + dx * t, ay = cy + dy * t, r = 13;
    g.fillStyle(0x1a0e08, .55).fillCircle(ax, ay, 16);
    g.fillStyle(0xb3261a, 1).fillTriangle(ax + dx * r, ay + dy * r, ax + Math.cos(a + 2.5) * r * .85, ay + Math.sin(a + 2.5) * r * .85, ax + Math.cos(a - 2.5) * r * .85, ay + Math.sin(a - 2.5) * r * .85);
    g.lineStyle(1.5, LQ.goldHi, .9).strokeCircle(ax, ay, 16);
    const pl = this.h.player(), dist = Math.round(Math.hypot(cur.pos.x - pl.x, cur.pos.y - pl.y));
    this.arrowText.setText(`${cur.label} · ${dist} 步`).setPosition(Phaser.Math.Clamp(ax - dx * 34, 70, GAME_WIDTH - 70), Phaser.Math.Clamp(ay - dy * 30, top + 10, bottom - 10)).setVisible(true);
  }
  destroy(): void { this.mini.destroy(); this.big?.destroy(); this.arrow.destroy(); this.arrowText.destroy(); }
}
