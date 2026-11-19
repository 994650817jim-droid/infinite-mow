import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { LQ, lqDiamond } from './LacquerKit';
import { warText } from './WarStyle';
import type { BattleOrders } from '../systems/BattleOrders';
import type { Enemy } from '../entities/Enemy';

/**
 * 战场地图（电脑布局；设计见共享笔记 battle-map-design.md）：
 *  - 舆图卷轴（用户「小地图是可以打开的，平时就是卷轴的样子收缩起来，点击才放大」）：平时右上角（设置钮左侧）一卷收起的手卷，不挡战场；
 *    点它或按 G：卷轴飞到屏幕中央、竖起来，两根画轴往两边拉开（画心宣纸跟着展开），地图在纸上淡入；再点 / G / Esc 卷回去、飞回角上。
 *    手卷图：即梦出图（public/assets/ui/map_scroll_*.webp，原图 ui/originals/map_scroll_jimeng.webp）。
 *  - 地图：画心 640×262，以主将为中心，约 5200 宽，军令目标标名字；不暂停。
 *  - 屏外军令箭头：当前首要军令（不含首领——首领箭头 BossPresence 已有）在屏外时，屏幕边缘画朱红小箭头 + 距离。
 * 图层：墨色障碍框、青色河道、敌兵密度淡墨（12×8 分桶，不逐个画）、精锐朱点、首领朱印（对象池 2）、随行碧点、主将金菱、军令朱旗菱。
 * 小 / 大地图 8 Hz 重画（一个 Graphics clear 重画）；障碍框每 2 秒重取一次。
 */
export const BATTLE_MAP = {
  /** 收起的卷轴：中心位置与显示宽（原 170×110 小地图的位置）。 */
  scroll: { x: 786, y: 34, w: 150 },
  big: { w: 640, h: 262, range: 5200 },
  /** 展开 / 卷回用时（毫秒）、飞到中央用时；画轴横向压缩（手卷是横长的，原比例两根轴太宽放不下）。 */
  unrollMs: 420, rollMs: 300, flyMs: 220, endSx: .47,
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
  /** bare：只画地图内容（卷轴画心当底，框与纸由 BattleMap 的卷轴画）。 */
  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, readonly w: number, readonly h: number, readonly range: number, big: boolean, bare = false) {
    this.root = scene.add.container(x, y).setScrollFactor(0).setDepth(big ? DEPTH.overlay + 5 : DEPTH.hud + 2).setName(big ? 'battle-map-big' : 'battle-map-mini');
    if (bare) { this.g = scene.add.graphics(); this.root.add(this.g); for (let i = 0; i < 3; i++) { const s = scene.add.image(0, 0, 'seal_boss').setDisplaySize(26, 26).setVisible(false); this.seals.push(s); this.root.add(s); } for (let i = 0; i < 6; i++) { const t = scene.add.text(0, 0, '', warText(12, '#3a1a0e')).setOrigin(.5, 1).setStroke('#f3e6c4', 3).setVisible(false); this.names.push(t); this.root.add(t); } return; }
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

/** 舆图卷轴的四张图（即梦出图）：收起的手卷、展开手卷的左端 / 画心 / 右端（左右端 302×677、画心 1126×677，纸面在 y 139–563）。 */
const SCROLL_FILES = { closed: 'map_scroll_closed', left: 'map_scroll_left', mid: 'map_scroll_mid', right: 'map_scroll_right' } as const;
const SCROLL_TEX = { h: 677, paperTop: 139, paperBot: 563, midW: 1126 } as const;
type ScrollState = 'closed' | 'opening' | 'open' | 'closing';

export class BattleMap {
  private big: MapView | null = null;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private readonly arrowText: Phaser.GameObjects.Text;
  private acc = 0; private boxAcc = 1e9; private boxes: Box[] = []; private rivers: Array<{ ax: number; ay: number; bx: number; by: number; half: number }> = [];
  /** 卷轴：角上收起的那卷（icon）、展开的三段（左轴 / 画心 / 右轴）、暗场、标题。 */
  private icon: Phaser.GameObjects.Image | null = null; private iconHint: Phaser.GameObjects.Text | null = null;
  private open3: { left: Phaser.GameObjects.Image; mid: Phaser.GameObjects.Image; right: Phaser.GameObjects.Image; dim: Phaser.GameObjects.Rectangle; title: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text } | null = null;
  private state: ScrollState = 'closed'; private t = 0; private tween: Phaser.Tweens.Tween | null = null; private shown = true;
  /** 测试用：重画次数、障碍框数；卷轴状态、展开程度（0–1）。 */
  readonly stats = { draws: 0, boxes: 0, state: 'closed' as ScrollState, t: 0 };
  constructor(private readonly h: MapHost, private readonly orders: BattleOrders) {
    const s = h.scene;
    this.arrow = s.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('orders-arrow');
    this.arrowText = s.add.text(0, 0, '', warText(12, '#ffd9a0')).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud + 1).setStroke('#1a0e08', 3).setVisible(false);
    const need = Object.values(SCROLL_FILES).filter(k => !s.textures.exists(k));
    if (!need.length) this.makeIcon();
    else {
      for (const k of need) s.load.image(k, 'assets/ui/' + k + '.webp');
      s.load.once('complete', () => { if (s.sys.settings.status < Phaser.Scenes.SHUTDOWN) this.makeIcon(); });
      if (!s.load.isLoading()) s.load.start();
    }
  }
  /** 角上收起的卷轴：点它展开；悬停微微放大、下方小字「舆图 · G」。 */
  private makeIcon(): void {
    if (this.icon || !this.h.scene.textures.exists(SCROLL_FILES.closed)) return;
    const s = this.h.scene, S = BATTLE_MAP.scroll, tex = s.textures.get(SCROLL_FILES.closed).getSourceImage() as { width: number; height: number }, k = S.w / tex.width;
    this.icon = s.add.image(S.x, S.y, SCROLL_FILES.closed).setScale(k).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('battle-map-scroll').setInteractive({ useHandCursor: true }).setVisible(this.shown);
    this.icon.setData('k', k);
    this.icon.on('pointerover', () => { if (this.state === 'closed') this.icon?.setScale(k * 1.06); });
    this.icon.on('pointerout', () => { if (this.state === 'closed') this.icon?.setScale(k); });
    this.icon.on('pointerdown', () => this.toggleBig());
    this.iconHint = s.add.text(S.x, S.y + tex.height * k / 2 + 1, '舆图 · G', warText(11, '#e8d6a8')).setOrigin(.5, 0).setStroke('#1a0e08', 3).setScrollFactor(0).setDepth(DEPTH.hud + 2).setName('battle-map-scroll-hint').setVisible(this.shown);
  }
  /** 展开的卷轴（第一次打开时建）：画心纸面中心 = 地图中心；左右轴竖着，按 t 往两边拉开。 */
  private makeOpen(): void {
    if (this.open3) return;
    const s = this.h.scene, B = BATTLE_MAP.big, T = SCROLL_TEX, sy = (B.h + 16) / (T.paperBot - T.paperTop), d = DEPTH.overlay + 4;
    const cx = GAME_WIDTH / 2, cy = (GAME_HEIGHT - B.h) / 2 + 6 + B.h / 2 - ((T.paperTop + T.paperBot) / 2 - T.h / 2) * sy; // 卷轴中心（纸面比卷轴中心略靠下）
    const dim = s.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(d - .5).setInteractive().setName('battle-map-dim');
    dim.on('pointerdown', () => this.toggleBig());
    const mk = (k: string, ox: number, sx: number): Phaser.GameObjects.Image => {
      const im = s.add.image(cx, cy, k).setOrigin(ox, .5).setScale(sx, sy).setScrollFactor(0).setDepth(d).setInteractive();
      im.on('pointerdown', () => this.toggleBig()); return im;
    };
    const mid = mk(SCROLL_FILES.mid, .5, (B.w + 16) / T.midW).setName('battle-map-scroll-mid');
    const left = mk(SCROLL_FILES.left, 1, BATTLE_MAP.endSx).setName('battle-map-scroll-left'), right = mk(SCROLL_FILES.right, 0, BATTLE_MAP.endSx).setName('battle-map-scroll-right');
    const top = cy - T.h * sy / 2;
    const title = s.add.text(cx, top + (T.paperTop - 23) * sy, '战 场 舆 图', warText(17, LQ.title)).setOrigin(.5).setStroke('#1a0e08', 4).setScrollFactor(0).setDepth(d + 2);
    const hint = s.add.text(cx, top + (T.paperBot + 23) * sy, '点卷轴 / G / Esc 卷起 · 朱旗 = 军令　朱印 = 首领　墨晕 = 敌军　碧点 = 随行', warText(11, '#f3e6c4')).setOrigin(.5).setStroke('#1a0e08', 3).setScrollFactor(0).setDepth(d + 2);
    this.open3 = { left, mid, right, dim, title, hint };
    this.big = new MapView(s, (GAME_WIDTH - B.w) / 2, (GAME_HEIGHT - B.h) / 2 + 6, B.w, B.h, B.range, true, true);
    this.big.root.setDepth(d + 1);
    this.layout(0);
  }
  /** t：0 = 两轴并拢在中央，1 = 完全展开。 */
  private layout(t: number): void {
    const o = this.open3; if (!o) return;
    this.t = t; this.stats.t = t;
    const B = BATTLE_MAP.big, half = (B.w + 16) / 2 * t, cx = GAME_WIDTH / 2, vis = t > 0;
    o.left.setX(cx - half).setVisible(vis); o.right.setX(cx + half).setVisible(vis);
    const cw = Math.max(1, SCROLL_TEX.midW * t); o.mid.setCrop((SCROLL_TEX.midW - cw) / 2, 0, cw, SCROLL_TEX.h).setVisible(vis);
    o.dim.setFillStyle(0x000000, .45 * Math.min(1, t * 1.5)).setVisible(vis);
    const a = Phaser.Math.Clamp((t - .65) / .35, 0, 1);
    this.big?.root.setVisible(a > 0).setAlpha(a); o.title.setVisible(a > 0).setAlpha(a); o.hint.setVisible(a > 0).setAlpha(a);
  }
  get bigOpen(): boolean { return this.state === 'open' || this.state === 'opening'; }
  /** G / 点卷轴：收起 → 飞到中央竖起 → 两轴拉开；展开 → 两轴合拢 → 横回去飞回角上。 */
  toggleBig(): void {
    const s = this.h.scene; if (!this.icon) this.makeIcon(); this.makeOpen();
    const icon = this.icon, S = BATTLE_MAP.scroll, k = (icon?.getData('k') as number | undefined) ?? 1, o = this.open3!;
    const rollH = SCROLL_TEX.h * o.mid.scaleY, cy = o.mid.y;
    this.tween?.stop(); this.tween = null; if (icon) s.tweens.killTweensOf(icon);
    if (!this.bigOpen) {
      this.state = 'opening'; this.stats.state = this.state; this.acc = 1e9;
      const fromT = this.t, unroll = (): void => {
        icon?.setVisible(false); this.iconHint?.setVisible(false);
        this.tween = s.tweens.addCounter({ from: fromT, to: 1, duration: Math.max(1, BATTLE_MAP.unrollMs * (1 - fromT)), ease: 'Cubic.easeOut', onUpdate: tw => this.layout(tw.getValue() ?? 1),
          onComplete: () => { this.layout(1); this.state = 'open'; this.stats.state = 'open'; this.tween = null; } });
      };
      if (icon && fromT === 0) { // 收起的卷轴飞到中央、转成竖的（长度 = 画轴高），再拉开
        this.iconHint?.setVisible(false);
        s.tweens.add({ targets: icon, x: GAME_WIDTH / 2, y: cy, angle: 90, scale: rollH / icon.width, duration: BATTLE_MAP.flyMs, ease: 'Sine.easeInOut', onComplete: unroll });
      } else unroll();
    } else {
      this.state = 'closing'; this.stats.state = this.state;
      this.tween = s.tweens.addCounter({ from: this.t, to: 0, duration: Math.max(1, BATTLE_MAP.rollMs * this.t), ease: 'Cubic.easeIn', onUpdate: tw => this.layout(tw.getValue() ?? 0), onComplete: () => {
        this.layout(0); this.tween = null;
        if (!icon) { this.state = 'closed'; this.stats.state = 'closed'; return; }
        icon.setVisible(this.shown).setPosition(GAME_WIDTH / 2, cy).setAngle(90).setScale(rollH / icon.width);
        s.tweens.add({ targets: icon, x: S.x, y: S.y, angle: 0, scale: k, duration: BATTLE_MAP.flyMs, ease: 'Sine.easeInOut', onComplete: () => { this.state = 'closed'; this.stats.state = 'closed'; this.iconHint?.setVisible(this.shown); } });
      } });
    }
  }
  setVisible(v: boolean): void {
    this.shown = v; if (this.state === 'closed') { this.icon?.setVisible(v); this.iconHint?.setVisible(v); }
    if (!v) { if (this.bigOpen) this.toggleBig(); this.arrow.clear(); this.arrowText.setVisible(false); }
  }

  update(dt: number): void {
    this.boxAcc += dt * 1000; if (this.boxAcc >= BATTLE_MAP.obstacleRefreshMs) { this.boxAcc = 0; this.collectObstacles(); }
    this.drawArrow();
    this.acc += dt; if (this.acc < 1 / BATTLE_MAP.hz) return; this.acc = 0;
    if (this.big && this.state !== 'closed') { this.big.draw(this.h, this.orders, this.boxes, this.rivers, true); this.stats.draws++; }
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
  destroy(): void { this.tween?.stop(); this.big?.destroy(); this.icon?.destroy(); this.iconHint?.destroy(); const o = this.open3; if (o) for (const x of [o.left, o.mid, o.right, o.dim, o.title, o.hint]) x.destroy(); this.arrow.destroy(); this.arrowText.destroy(); }
}
