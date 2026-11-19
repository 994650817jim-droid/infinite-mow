import Phaser from 'phaser';
import { TITLE_FONT } from '../config';
import { LQ, lqDiamond } from './LacquerKit';
import type { BattleOrders } from '../systems/BattleOrders';
import type { Enemy } from '../entities/Enemy';

/**
 * 手绘舆图（用户「我觉得小地图还是有点太简陋了上面信息，可以优化，生图做点」）：
 * 图标是 ChatGPT 出的两张古舆图风透明底图标表（public/assets/ui/originals/map_icons_*_gpt.webp），tools/build-map-icons.py 打成图集 map_icons。
 *  - 底图（每关一次，场景障碍 / 河 / 路 / 树变了才重画）：画进一张 RenderTexture——田畴、路（墨点虚线）、河（河段图沿河铺、桥）、
 *    树林（按 280 见方分格：多的画一片林子、少的画单棵树）、城墙 / 关墙（城墙段沿墙铺，城门楼）、山崖 / 场地边界（山峦）、营栅（木栅）。
 *    显示时按主将位置裁出画心那一块（setCrop），不每帧重画。
 *  - 动态标记（8 Hz）：敌军队伍（按密度分格）、精锐双戟、敌营木栅寨 + 血条（挨打时朱圈闪）、我军攻势（碧色毛笔箭头，墨迹流动）+ 我军队伍、
 *    随行碧点、首领「帅」字朱印、军令令旗（当前军令一明一暗地跳）+ 楷书名字、攻城据点圆圈。
 *  - 固定装饰：左上题签（关名）、右上方位标（北）、右下比例尺（千步）、左下图例框、四角云纹。
 */
export const MAP_ICONS = 'map_icons';
export const MAP_ICONS_FILES = { png: 'assets/ui/map_icons.png', json: 'assets/ui/map_icons.json' } as const;
type Box = { left: number; right: number; top: number; bottom: number };
type River = { ax: number; ay: number; bx: number; by: number; half: number };
type Road = { x: number; y: number; len: number; w: number; ang: number };
type TreeDot = { x: number; y: number; dead: boolean };
export interface PaintLayout { boxes: readonly Box[]; rivers: readonly River[]; roads: readonly Road[]; trees: readonly TreeDot[]; gates: ReadonlyArray<{ x: number; y: number }>; bridges: ReadonlyArray<{ x: number; y: number; ang: number; len: number }> }
export interface PaintHost {
  player(): { x: number; y: number }; enemies(): readonly Enemy[]; followers(): ReadonlyArray<{ x: number; y: number; active?: boolean }>; bosses(): readonly Enemy[];
  camps?(): ReadonlyArray<{ x: number; y: number; ratio: number; hit: boolean }>;
  pushes?(): ReadonlyArray<{ from: { x: number; y: number }; to: { x: number; y: number } | null; members: ReadonlyArray<{ x: number; y: number }> }>;
}
/** 底图范围（世界坐标，以开局点为原点）与分辨率（画心 1 像素 = RES 个底图像素，电脑布局放大后不糊）。 */
const EXT = { x0: -6000, y0: -4500, w: 12000, h: 9000 }, RES = 1.5;
const INK = 0x2e2014, GREEN = 0x3f8a52, CINNABAR = 0xb3261a;

export class PaintedMap {
  readonly root: Phaser.GameObjects.Container;
  private rt: Phaser.GameObjects.RenderTexture;
  private readonly dyn: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Image[] = []; private iconN = 0;
  private readonly labels: Phaser.GameObjects.Text[] = []; private labelN = 0;
  private sig = '';
  readonly stats = { bakes: 0, icons: 0, labels: 0, stamps: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly w: number, private readonly h: number, private readonly range: number, title: string) {
    const k = this.k;
    this.root = scene.add.container(0, 0).setName('painted-map');
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(EXT.w * k * RES), Math.ceil(EXT.h * k * RES)).setOrigin(0).setScale(1 / RES).setName('painted-map-base');
    this.dyn = scene.add.graphics();
    this.root.add([this.rt, this.dyn]);
    // 固定装饰：四角云纹、题签、方位标、比例尺、图例（加在最上层，动态标记在它们下面）
    const deco = scene.add.container(0, 0).setName('painted-map-deco'), ic = (f: string, x: number, y: number, dw: number) => { const im = scene.add.image(x, y, MAP_ICONS, f); im.setScale(dw / im.width); deco.add(im); return im; };
    for (const [cx, cy, fx, fy] of [[0, 0, false, false], [w, 0, true, false], [0, h, false, true], [w, h, true, true]] as const) ic('corner', cx, cy, 30).setOrigin(0, 0).setFlip(fx, fy).setAlpha(.85);
    const cart = scene.add.nineslice(10, 8, MAP_ICONS, 'cartouche', 150, 28, 24, 24, 12, 12).setOrigin(0).setName('painted-map-cartouche');
    deco.add(cart); deco.add(scene.add.text(10 + 75, 8 + 14, title, { fontFamily: TITLE_FONT, fontSize: '14px', color: '#2a1608', resolution: 2 }).setOrigin(.5).setName('painted-map-title'));
    ic('compass', w - 34, 34, 44); deco.add(scene.add.text(w - 34, 7, '北', { fontFamily: TITLE_FONT, fontSize: '13px', color: '#8a1e14', resolution: 2 }).setOrigin(.5, 0));
    const bar = 1000 * k; ic('scale', w - 16 - bar / 2, h - 18, bar).setScale(bar / 154, .55);
    deco.add(scene.add.text(w - 16 - bar / 2, h - 30, '千 步', { fontFamily: TITLE_FONT, fontSize: '12px', color: '#2a1608', resolution: 2 }).setOrigin(.5, 1));
    // 图例：纸框，四列两行（压在画心左下，不挡中间）
    const LW = 292, LH = 46, lg = scene.add.nineslice(6, h - 6, MAP_ICONS, 'legendbox', LW, LH, 16, 16, 16, 16).setOrigin(0, 1).setAlpha(.95).setName('painted-map-legend'); deco.add(lg);
    const items: Array<[string, string, number]> = [['主将', '', 0], ['敌营', 'camp', 20], ['我军攻势', 'brusharrow', 22], ['敌军', 'enemy', 20], ['首领', 'seal', 15], ['军令', 'flag', 15], ['树林', 'forest', 20], ['城墙', 'wall', 20]];
    items.forEach(([label, f, sz], i) => {
      const x = 6 + 20 + (i % 4) * 69, y = h - 6 - LH + 14 + Math.floor(i / 4) * 17;
      if (f) { const im = ic(f, x, y, sz * .7); if (im.height * im.scaleY > 12) im.setScale(12 / im.height); }
      else { const g = scene.add.graphics(); g.fillStyle(LQ.lacquer, 1); lqDiamond(g, x, y, 6); g.fillStyle(LQ.goldHi, 1); lqDiamond(g, x, y, 4.2); deco.add(g); }
      deco.add(scene.add.text(x + 10, y, label, { fontFamily: TITLE_FONT, fontSize: '11px', color: '#2a1608', resolution: 2 }).setOrigin(0, .5));
    });
    this.deco = deco;
    this.root.add(deco);
  }
  private readonly deco: Phaser.GameObjects.Container;
  private get k(): number { return this.w / this.range; }
  /** 世界 → 底图像素。 */
  private bx(x: number): number { return (x - EXT.x0) * this.k * RES; }
  private by(y: number): number { return (y - EXT.y0) * this.k * RES; }
  private stamp(f: string, wx: number, wy: number, dw: number, o: { angle?: number; alpha?: number; tint?: number; sy?: number; originY?: number } = {}): void {
    const fr = this.scene.textures.getFrame(MAP_ICONS, f); if (!fr) return; const sc = dw * RES / fr.width;
    this.rt.stamp(MAP_ICONS, f, this.bx(wx), this.by(wy), { scaleX: sc, scaleY: sc * (o.sy ?? 1), angle: o.angle ?? 0, alpha: o.alpha ?? 1, tint: o.tint ?? 0xffffff, originX: .5, originY: o.originY ?? .5 });
    this.stats.stamps++;
  }

  /** 底图：布局（障碍框 / 河 / 路 / 树 / 城门 / 桥）变了才重画。 */
  bake(L: PaintLayout): void {
    const sig = `${L.boxes.length}:${L.rivers.length}:${L.roads.length}:${L.trees.length}:${L.gates.length}:${L.boxes.reduce((n, b) => n + b.left + b.top * 3, 0) | 0}`;
    if (sig === this.sig) return; this.sig = sig; this.stats.bakes++;
    const rt = this.rt, k = this.k; rt.clear();
    let s = 977; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const nearBox = (x: number, y: number, m: number) => L.boxes.some(b => x > b.left - m && x < b.right + m && y > b.top - m && y < b.bottom + m);
    const nearRiver = (x: number, y: number, m: number) => L.rivers.some(r => { const dx = r.bx - r.ax, dy = r.by - r.ay, l2 = dx * dx + dy * dy || 1, t = Phaser.Math.Clamp(((x - r.ax) * dx + (y - r.ay) * dy) / l2, 0, 1); return Math.hypot(x - (r.ax + dx * t), y - (r.ay + dy * t)) < r.half + m; });
    // 田畴：开阔处零星几块（淡）
    for (let i = 0, n = 0; i < 300 && n < 48; i++) { const x = (rnd() - .5) * 7000, y = (rnd() - .5) * 5200; if (Math.hypot(x, y) < 700 || nearBox(x, y, 260) || nearRiver(x, y, 220) || L.trees.some(t => Math.abs(t.x - x) < 260 && Math.abs(t.y - y) < 200)) continue; this.stamp('fields', x, y, 26 + rnd() * 10, { alpha: .28 + rnd() * .12 }); n++; }
    // 路：墨点虚线（两行细点，像古地图的官道）
    const g = this.scene.make.graphics({}, false);
    for (const r of L.roads) {
      const ux = Math.cos(r.ang), uy = Math.sin(r.ang), nx = -uy, ny = ux, half = Math.min(r.len / 2, 7000), off = Math.max(2.4, r.w * k * .32) * RES;
      for (let d = -half; d <= half; d += 46) { const x = this.bx(r.x + ux * d), y = this.by(r.y + uy * d); g.fillStyle(0x7a5a34, .55).fillCircle(x + nx * off, y + ny * off, 1.5 * RES).fillCircle(x - nx * off, y - ny * off, 1.5 * RES); }
    }
    // 河：淡石青水面（铺底）+ 河段图沿河铺（两岸墨线、水纹）
    for (const r of L.rivers) { g.lineStyle(Math.max(6, r.half * 2 * k) * RES, 0x9cc4c4, .45).lineBetween(this.bx(r.ax), this.by(r.ay), this.bx(r.bx), this.by(r.by)); }
    rt.draw(g); g.destroy();
    for (const r of L.rivers) {
      const len = Math.hypot(r.bx - r.ax, r.by - r.ay), ang = Phaser.Math.RadToDeg(Math.atan2(r.by - r.ay, r.bx - r.ax)), th = Math.max(9, r.half * 2 * k * 1.25), tw = th * 166 / 70, stepW = tw * .92 / k;
      for (let d = stepW / 2; d < len + stepW / 2; d += stepW) { const t = Math.min(1, d / len); this.stamp('river', r.ax + (r.bx - r.ax) * t, r.ay + (r.by - r.ay) * t, tw, { angle: ang }); }
    }
    for (const b of L.bridges) this.stamp('bridge', b.x, b.y, Math.max(16, b.len * k * 1.1), { angle: Phaser.Math.RadToDeg(b.ang) });
    // 障碍框：长横墙 / 竖墙 → 城墙段；大块（山崖、场地边界）→ 山峦；中等细长 → 木栅；中等方块 → 屋舍
    for (const b of L.boxes) {
      const bw = b.right - b.left, bh = b.bottom - b.top, cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
      if (bw >= 400 && bh <= 260) { const th = 11, tw = th * 166 / 64, step = tw * .94 / k; for (let x = b.left + step / 2; x < b.right; x += step) this.stamp('wall', x, cy, tw); }
      else if (bh >= 400 && bw <= 260) { const th = 11, tw = th * 166 / 64, step = tw * .94 / k; for (let y = b.top + step / 2; y < b.bottom; y += step) this.stamp('wall', cx, y, tw, { angle: 90 }); }
      else if (bw > 260 && bh > 260) {
        const step = 230; for (let y = b.top + step * .6; y < b.bottom; y += step * .8) for (let x = b.left + step * .5 + ((Math.round(y / step) % 2) ? step * .4 : 0); x < b.right; x += step) {
          if (Math.abs(x) > 6200 || Math.abs(y) > 4700) continue; this.stamp(rnd() < .75 ? 'mountains' : 'hill', x + (rnd() - .5) * 60, y + (rnd() - .5) * 40, 26 + rnd() * 12, { alpha: .92 }); }
      } else if (Math.max(bw, bh) >= 120 && Math.min(bw, bh) <= 70) { const tw = 18, step = tw * .9 / k, horiz = bw >= bh; for (let d = (horiz ? b.left : b.top) + step / 2; d < (horiz ? b.right : b.bottom); d += step) this.stamp('wall', horiz ? d : cx, horiz ? cy : d, tw, { angle: horiz ? 0 : 90, tint: 0xc8a070, sy: .8 }); }
      else if (bw >= 60 && bh >= 60) this.stamp('village', cx, cy, Math.min(26, Math.max(14, Math.max(bw, bh) * k * 1.4)), { alpha: .9 });
    }
    for (const gt of L.gates) this.stamp('gate', gt.x, gt.y - 30, 26, { originY: .8 });
    // 树：280 见方分格，多的一片林子、少的单棵
    const cells = new Map<string, TreeDot[]>(); for (const t of L.trees) { const key = Math.floor(t.x / 280) + ',' + Math.floor(t.y / 280); const l = cells.get(key); if (l) l.push(t); else cells.set(key, [t]); }
    for (const list of cells.values()) {
      const cx = list.reduce((n, t) => n + t.x, 0) / list.length, cy = list.reduce((n, t) => n + t.y, 0) / list.length, dead = list.filter(t => t.dead).length > list.length / 2;
      if (list.length >= 4) this.stamp('forest', cx, cy, Math.min(34, 20 + list.length * 1.4), { tint: dead ? 0xc8b896 : 0xffffff, originY: .7 });
      else for (const t of list.slice(0, 2)) this.stamp('tree', t.x, t.y, 12, { tint: t.dead ? 0xc8b896 : 0xffffff, originY: .8 });
    }
  }

  private icon(f: string, x: number, y: number, dw: number, o: { alpha?: number; tint?: number; angle?: number; originY?: number } = {}): Phaser.GameObjects.Image {
    let im = this.icons[this.iconN];
    if (!im) { im = this.scene.add.image(0, 0, MAP_ICONS, f); this.icons.push(im); this.root.addAt(im, this.root.getIndex(this.deco)); }
    this.iconN++; if (im.frame.name !== f) im.setFrame(f);
    return im.setPosition(x, y).setScale(dw / im.frame.width).setAlpha(o.alpha ?? 1).setAngle(o.angle ?? 0).setOrigin(.5, o.originY ?? .5).setVisible(true).setTint(o.tint ?? 0xffffff);
  }
  private label(text: string, x: number, y: number, color = '#2a1608', size = 12): Phaser.GameObjects.Text {
    let t = this.labels[this.labelN];
    if (!t) { t = this.scene.add.text(0, 0, '', { fontFamily: TITLE_FONT, fontSize: `${size}px`, color, resolution: 2, stroke: '#f3e6c4', strokeThickness: 3 }).setOrigin(.5, 1); this.labels.push(t); this.root.addAt(t, this.root.getIndex(this.deco)); }
    this.labelN++; return t.setText(text).setPosition(x, y).setColor(color).setFontSize(size).setVisible(true);
  }

  /** 每次重画（8 Hz）：底图按主将位置裁出画心、动态标记重摆。 */
  draw(h: PaintHost, orders: BattleOrders): void {
    const c = h.player(), W = this.w, H = this.h, k = this.k, now = performance.now(), g = this.dyn.clear();
    const map = (wx: number, wy: number): [number, number] => [W / 2 + (wx - c.x) * k, H / 2 + (wy - c.y) * k];
    const inside = (x: number, y: number, pad = 4) => x >= pad && y >= pad && x <= W - pad && y <= H - pad;
    // 底图：裁出以主将为中心的画心
    const ox = (c.x - EXT.x0) * k - W / 2, oy = (c.y - EXT.y0) * k - H / 2;
    this.rt.setPosition(-ox, -oy).setCrop(ox * RES, oy * RES, W * RES, H * RES);
    this.iconN = 0; this.labelN = 0;
    // 敌军：12×8 分格，人多的格子画一队敌兵（越多越大），四周淡墨晕
    const C = 12, R = 8, bins = new Uint16Array(C * R), elites: Array<[number, number]> = [];
    for (const e of h.enemies()) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.hp <= 0) continue; const [px, py] = map(e.x, e.y); if (!inside(px, py)) continue;
      if (e.kind === 'elite') { if (elites.length < 12) elites.push([px, py]); continue; }
      const i = Math.min(C - 1, Math.floor(px / W * C)), j = Math.min(R - 1, Math.floor(py / H * R)); bins[j * C + i]++;
    }
    const cw = W / C, ch = H / R;
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const n = bins[j * C + i]; if (!n) continue; const x = (i + .5) * cw, y = (j + .5) * ch;
      g.fillStyle(0x5a2a18, Math.min(.16, .05 + n * .015)).fillEllipse(x, y, Math.min(cw * 1.2, cw * (.5 + n * .05)), Math.min(ch * 1.2, ch * (.5 + n * .05)));
      if (n >= 2) this.icon('enemy', x, y + 2, Math.min(34, 16 + n * 1.3), { originY: .75 }); else g.fillStyle(0x7a1a10, .8).fillCircle(x, y, 2.2); }
    for (const [px, py] of elites) this.icon('elite', px, py, 13);
    // 我军攻势：碧色毛笔箭头（粗 → 细，墨迹往前流）+ 箭头尖；队伍画在兵的中心
    for (const p of h.pushes?.() ?? []) {
      const live = p.members; if (!p.to) continue;
      const [ax, ay] = map(p.from.x, p.from.y), [bx, by] = map(p.to.x, p.to.y), dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); if (L < 8) continue;
      const ux = dx / L, uy = dy / L, flow = (now / 40) % 14;
      for (let d = -flow; d < L - 14; d += 14) { const d0 = Math.max(0, d), d1 = Math.min(L - 14, d + 9); if (d1 <= d0) continue; const wv = 5.5 - 3.5 * (d0 / L), x0 = ax + ux * d0, y0 = ay + uy * d0, x1 = ax + ux * d1, y1 = ay + uy * d1;
        if (inside(x0, y0, -2) || inside(x1, y1, -2)) g.lineStyle(wv, GREEN, .8).lineBetween(Phaser.Math.Clamp(x0, 0, W), Phaser.Math.Clamp(y0, 0, H), Phaser.Math.Clamp(x1, 0, W), Phaser.Math.Clamp(y1, 0, H)); }
      const hx = Phaser.Math.Clamp(bx - ux * 10, 8, W - 8), hy = Phaser.Math.Clamp(by - uy * 10, 8, H - 8);
      this.icon('arrowhead', hx, hy, 15, { tint: GREEN, angle: Phaser.Math.RadToDeg(Math.atan2(uy, ux)) });
      if (live.length) { const mx = live.reduce((n, m) => n + m.x, 0) / live.length, my = live.reduce((n, m) => n + m.y, 0) / live.length, [px, py] = map(mx, my); if (inside(px, py)) this.icon('ally', px, py, 22, { originY: .8 }); }
    }
    // 敌营：木栅寨 + 血条；挨打时朱圈闪
    for (const cp of h.camps?.() ?? []) {
      const [px, py] = map(cp.x, cp.y); if (!inside(px, py, 6)) continue;
      if (cp.hit) g.lineStyle(2, 0xffc24a, .45 + .45 * Math.sin(now / 90)).strokeCircle(px, py - 4, 15);
      this.icon('camp', px, py, 28, { originY: .8 });
      g.fillStyle(0x1a0e08, .75).fillRect(px - 12, py + 6, 24, 4); g.fillStyle(cp.ratio > .5 ? 0xc8402a : 0xe0962e, 1).fillRect(px - 12, py + 6, 24 * Phaser.Math.Clamp(cp.ratio, 0, 1), 4);
    }
    // 随行：碧点
    g.fillStyle(0x3f8f6a, 1).lineStyle(1, 0x10241a, .9);
    for (const f of h.followers()) { if (f.active === false) continue; const [px, py] = map(f.x, f.y); if (inside(px, py)) g.fillCircle(px, py, 3.2).strokeCircle(px, py, 3.2); }
    // 首领：「帅」字朱印（贴边）
    for (const b of h.bosses().filter(x => x.active && x.hp > 0).slice(0, 3)) {
      const [px0, py0] = map(b.x, b.y), px = Phaser.Math.Clamp(px0, 12, W - 12), py = Phaser.Math.Clamp(py0, 12, H - 12);
      this.icon('seal', px, py, 22); this.label('帅', px, py + 8, '#9a1a10', 14).setStroke('#f6ead0', 0);
    }
    // 军令：令旗（当前那条一跳一跳）+ 楷书名字；攻城据点画圆圈；在画心外的贴边画朱色小箭头
    const cur = orders.current(); let first = true;
    for (const o of orders.all()) {
      if (o.state !== 'active' || o.kind === 'boss' || !o.at) continue; const p = o.at(); if (!p) continue;
      const [px, py] = map(p.x, p.y), cx = Phaser.Math.Clamp(px, 10, W - 10), cy = Phaser.Math.Clamp(py, 12, H - 10), isIn = inside(px, py, 8);
      const pulse = o === cur || (first && !cur) ? 1 + .14 * Math.sin(now / 200) : 1; first = false;
      if (o.id.startsWith('siege-point')) this.icon('point', cx, cy, 24 * pulse, { alpha: .9 });
      if (isIn) this.icon('flag', cx, cy, 17 * pulse, { originY: .9 });
      else { const a = Math.atan2(py - H / 2, px - W / 2); this.icon('arrowhead', cx, cy, 13, { tint: CINNABAR, angle: Phaser.Math.RadToDeg(a) }); }
      this.label(o.label, cx, cy - 15, '#7a1408', 12);
    }
    // 主将：金菱（中心）
    g.fillStyle(LQ.lacquer, 1); lqDiamond(g, W / 2, H / 2, 8); g.fillStyle(LQ.goldHi, 1); lqDiamond(g, W / 2, H / 2, 6);
    for (let i = this.iconN; i < this.icons.length; i++) this.icons[i].setVisible(false);
    for (let i = this.labelN; i < this.labels.length; i++) this.labels[i].setVisible(false);
    this.stats.icons = this.iconN; this.stats.labels = this.labelN;
  }
  destroy(): void { this.root.destroy(true); }
}
