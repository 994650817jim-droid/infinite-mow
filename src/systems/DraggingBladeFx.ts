import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Player } from '../entities/Player';
import { DRAG_SLASH_MS, DRAG_SLASH_SHEET, DRAG_SLASH_WEIGHTS, DRAG_TIP } from '../data/dragArt';

/**
 * 关羽本命修习「拖刀斩」专属表现（只管画面与音效，伤害判定仍在 weapons/registry.ts）。
 * 过渡素材：全部为程序生成的像素图（低分辨率画布 + 最近邻放大 + 深色描边），正式序列帧到位后替换。
 * - 蓄力：移动时刀尖拖地，身后留下划痕与火星；越接近蓄满，火星越密、划痕越亮，最后由橙转青。
 * - 蓄满：刀尖冒青色刀焰并持续飘青色火星，播一声轻响（bladeReady）。
 * - 释放：青绿色半月刀气向前飞出一段再碎散，命中处闪光；三级的回旋刀气为金色、弧向相反、边飞边旋。
 */
export const DRAG_NEED = [200, 160, 130] as const;
type Dir = 'down' | 'up' | 'left' | 'right';
interface Particle { img: Phaser.GameObjects.Image; life: number; age: number; vx: number; vy: number; g: number; s0: number; s1: number; a0: number }

const PX = 3; // 像素放大倍数（世界像素 / 贴图像素）
const CYAN = { core: '#f2fffb', light: '#8ffff0', mid: '#2fd6b0', dark: '#138a77', line: '#0b2a24' };
const GOLD = { core: '#fff6d8', light: '#ffd56a', mid: '#f0a030', dark: '#a85a18', line: '#3a1a08' };

function makeCanvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (put: (x: number, y: number, c: string, a?: number) => void) => void): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  draw((x, y, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, 1, 1); });
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** 半月刀气：凸面朝 +x（飞行方向），前缘最亮，后缘渐暗，外圈一像素深色描边。 */
function makeCrescent(scene: Phaser.Scene, key: string, pal: typeof CYAN): void {
  const W = 30, H = 52, cy = H / 2, c1 = 4, r1 = 25, c2 = -5, r2 = 24;
  const fill: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  const alpha: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + .5, py = y + .5, d1 = r1 - Math.hypot(px - c1, py - cy), d2 = Math.hypot(px - c2, py - cy) - r2;
    if (d1 < 0 || d2 < 0) continue;
    const t = d2 / (d1 + d2 || 1); // 0 后缘 → 1 前缘
    const [col, a] = t > .78 ? [pal.core, 1] : t > .55 ? [pal.light, 1] : t > .3 ? [pal.mid, .95] : [pal.dark, .75];
    fill[y][x] = col; alpha[y][x] = a;
  }
  makeCanvasTexture(scene, key, W, H, put => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (fill[y][x]) { put(x, y, fill[y][x]!, alpha[y][x]); continue; }
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fill[y + dy]?.[x + dx]);
      if (near) put(x, y, pal.line, .9);
    }
  });
}

function ensureTextures(scene: Phaser.Scene): void {
  makeCrescent(scene, 'drag-crescent', CYAN);
  makeCrescent(scene, 'drag-crescent-gold', GOLD);
  // 火星：2×2 白点（加色混合后按需着色）
  makeCanvasTexture(scene, 'drag-spark', 2, 2, put => { put(0, 0, '#fff'); put(1, 0, '#fff'); put(0, 1, '#fff'); put(1, 1, '#fff', .7); });
  // 划痕：深色地沟 + 一行浅色翻土
  makeCanvasTexture(scene, 'drag-groove', 7, 3, put => { for (let x = 0; x < 7; x++) { put(x, 0, '#c9a070', x === 0 || x === 6 ? .3 : .55); put(x, 1, '#2b1a10', x === 0 || x === 6 ? .5 : .9); put(x, 2, '#5a3b22', .35); } });
  makeCanvasTexture(scene, 'drag-ember', 7, 1, put => { for (let x = 0; x < 7; x++) put(x, 0, '#fff', x === 0 || x === 6 ? .5 : 1); });
  // 刀焰 3 帧（加色）
  for (let f = 0; f < 3; f++) makeCanvasTexture(scene, 'drag-flame-' + f, 7, 11, put => {
    const sway = [0, 1, -1][f];
    for (let y = 0; y < 11; y++) {
      const w = Math.max(0, Math.round((y / 10) * 3.2 - (y > 8 ? (y - 8) * 1.4 : 0))), cx = 3 + (y < 5 ? sway : 0);
      for (let x = cx - w; x <= cx + w; x++) { if (x < 0 || x > 6) continue; const edge = Math.abs(x - cx) === w; put(x, y, y > 6 && !edge ? CYAN.core : edge ? CYAN.mid : CYAN.light, y < 3 ? .6 : 1); }
    }
  });
  // 命中闪光：四角星
  makeCanvasTexture(scene, 'drag-flash', 9, 9, put => {
    for (let i = 0; i < 9; i++) { const a = 1 - Math.abs(i - 4) / 5; put(i, 4, '#fff', a); put(4, i, '#fff', a); }
    for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5]]) put(x, y, CYAN.light, .8);
  });
}

export class DraggingBladeFx {
  private parts: Particle[] = [];
  private flame?: Phaser.GameObjects.Image;
  private ready = false;
  private trail = 0;
  private emit = 0;
  private flameT = 0;
  /** 测试 / 调试用统计。 */
  readonly stats = { sparks: 0, grooves: 0, readyCount: 0, waves: 0, spins: 0, flashes: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }) {
    ensureTextures(scene);
  }

  get isReady(): boolean { return this.ready; }
  /** 蓄力进度 0–1。 */
  get ratio(): number { const lv = this.player.growth.masteries.dragging_blade; return lv ? Math.min(1, this.player.growth.travel / DRAG_NEED[lv - 1]) : 0; }

  /** 刀尖位置：拖在身后（左右朝向）或身体一侧（上下朝向），贴地。 */
  private tip(): { x: number; y: number; back: number } {
    const p = this.player, d = p.direction as Dir;
    // 用拖刀行走图时按图上刀尖着地点（DRAG_TIP），否则按普通持刀姿势估计
    if (p.dragWalking) { const [tx, ty] = DRAG_TIP[d]; return { x: p.x + tx, y: p.y + ty, back: d === 'right' ? -1 : d === 'left' ? 1 : 0 }; }
    const o = { right: [-21, 23, -1], left: [21, 23, 1], down: [17, 21, 0], up: [-17, 24, 0] }[d];
    return { x: p.x + o[0], y: p.y + o[1], back: o[2] };
  }

  private spawn(key: string, x: number, y: number, o: Partial<Particle> & { tint?: number; depth: number; add?: boolean; rot?: number }): void {
    let slot = this.parts.find(q => q.age >= q.life && q.img.texture.key === key);
    if (!slot && this.parts.length < 160) { slot = { img: this.scene.add.image(x, y, key), life: 0, age: 0, vx: 0, vy: 0, g: 0, s0: 1, s1: 1, a0: 1 }; this.parts.push(slot); }
    if (!slot) return;
    Object.assign(slot, { life: o.life ?? 300, age: 0, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, s0: o.s0 ?? PX, s1: o.s1 ?? PX, a0: o.a0 ?? 1 });
    slot.img.setPosition(x, y).setScale(slot.s0).setAlpha(slot.a0).setVisible(true).setDepth(o.depth).setRotation(o.rot ?? 0)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) slot.img.setTint(o.tint); else slot.img.clearTint();
  }

  /** 每帧调用：moved 为本帧主动移动的距离（与 RunGrowth.recordMovement 同口径）。 */
  update(dt: number, moved: number): void {
    const lv = this.player.growth.masteries.dragging_blade;
    for (const q of this.parts) {
      if (q.age >= q.life) { if (q.img.visible) q.img.setVisible(false); continue; }
      q.age += dt * 1000; const t = Math.min(1, q.age / q.life);
      q.vy += q.g * dt; q.img.x += q.vx * dt; q.img.y += q.vy * dt;
      q.img.setScale(q.s0 + (q.s1 - q.s0) * t).setAlpha(q.a0 * (1 - t * t));
    }
    if (!lv || !this.player.alive) { this.flame?.setVisible(false); this.ready = false; return; }
    const ratio = this.ratio, tip = this.tip(), depth = actorDepth(this.player.y + 26) + .004;
    if (ratio >= 1 && !this.ready) this.onReady(tip);
    if (ratio < 1) this.ready = false;
    if (moved > .3) {
      // 划痕：每拖过 8 像素留一道，越蓄越烫
      this.trail += moved;
      while (this.trail >= 8) {
        this.trail -= 8; this.stats.grooves++;
        const ang = this.player.direction === 'up' || this.player.direction === 'down' ? Math.PI / 2 : 0;
        this.spawn('drag-groove', tip.x, tip.y, { life: 900, depth: DEPTH.deco + 2, a0: .55 + .35 * ratio, s0: PX, s1: PX, rot: ang });
        const hot = ratio >= 1 ? 0x8ffff0 : Phaser.Display.Color.GetColor(255, Math.round(120 + 80 * ratio), Math.round(40 * ratio));
        this.spawn('drag-ember', tip.x, tip.y, { life: 300 + 400 * ratio, depth: DEPTH.deco + 2.1, a0: .15 + .7 * ratio, tint: hot, add: true, rot: ang });
      }
      // 火星：频率随蓄力上升（6 → 46 颗 / 秒），蓄到七成后开始夹青色
      this.emit += dt * (6 + 40 * ratio * ratio);
      while (this.emit >= 1) { this.emit -= 1; this.spark(tip, ratio, depth); }
    }
    if (this.ready) {
      // 刀焰：贴在刀尖，三帧闪动；站着也持续冒青色火星
      this.flameT += dt * 14;
      const f = this.flame ??= this.scene.add.image(0, 0, 'drag-flame-0').setOrigin(.5, 1).setBlendMode(Phaser.BlendModes.ADD).setName('drag-ready-flame');
      f.setTexture('drag-flame-' + (Math.floor(this.flameT) % 3)).setPosition(tip.x, tip.y + 2).setScale(PX * 1.3 * (.95 + .1 * Math.sin(this.flameT * 1.7)), PX * 1.4 * (1 + .15 * Math.sin(this.flameT * 2.3))).setDepth(depth + .001).setVisible(true).setAlpha(.9);
      if (Math.random() < dt * 10) this.spawn('drag-spark', tip.x + (Math.random() - .5) * 8, tip.y - 6, { life: 420, vx: (Math.random() - .5) * 20, vy: -50 - Math.random() * 30, g: 0, depth, tint: 0x8ffff0, add: true, s0: PX * .8, s1: PX * .3 });
    } else this.flame?.setVisible(false);
  }

  private spark(tip: { x: number; y: number; back: number }, ratio: number, depth: number): void {
    this.stats.sparks++;
    const cyan = ratio > .7 && Math.random() < (ratio - .7) / .3 * .8;
    const tint = cyan ? 0x8ffff0 : Math.random() < .5 ? 0xffd27a : 0xff8a2a;
    const back = tip.back || (Math.random() - .5) * 1.6;
    this.spawn('drag-spark', tip.x, tip.y - 1, { life: 260 + Math.random() * 260, vx: back * (40 + Math.random() * 70), vy: -60 - Math.random() * 90 * (.5 + ratio), g: 320, depth, tint, add: true, s0: PX * (.7 + .5 * ratio), s1: PX * .3 });
  }

  private onReady(tip: { x: number; y: number }): void {
    this.ready = true; this.stats.readyCount++;
    this.sfx?.play('bladeReady');
    const depth = actorDepth(this.player.y + 26) + .005;
    this.spawn('drag-flash', tip.x, tip.y - 4, { life: 260, depth, tint: 0xbffff6, add: true, s0: PX * .6, s1: PX * 1.6 });
    for (let i = 0; i < 12; i++) { const a = -Math.PI * (i / 11); this.spawn('drag-spark', tip.x, tip.y - 2, { life: 380, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, g: 120, depth, tint: 0x8ffff0, add: true, s0: PX, s1: PX * .3 }); }
  }

  /**
   * 释放刀气。size：刀气弧长（与旧版 spawnGuandaoSlash 同口径）；hits：本次命中敌人的位置（按刀气飞到时闪光）。
   * kind：'crescent' 青色半月向前飞；'spin' 三级金色回旋（弧向相反、边飞边旋、飞得近一些）。
   */
  release(angle: number, size: number, kind: 'crescent' | 'spin', hits: { x: number; y: number }[]): void {
    const spin = kind === 'spin', p = this.player, sc = this.scene;
    if (spin) this.stats.spins++; else this.stats.waves++;
    this.flame?.setVisible(false);
    if (!spin) sc.cameras.main.shake(90, .0028);
    this.sfx?.play(spin ? 'bladeSpin' : 'bladeWave');
    // 拖刀上撩出刀动作（有图时）：半月刀气那一下，朝刀气方向的左 / 右
    if (!spin) { const strip = DRAG_SLASH_SHEET[p.growth.character]; if (strip) p.playStrip(strip, ['0', '1', '2', '3'], DRAG_SLASH_MS, Math.cos(angle) < 0, DRAG_SLASH_WEIGHTS); }
    const key = spin ? 'drag-crescent-gold' : 'drag-crescent';
    const h = size * (spin ? .62 : .95), k = h / 52, dist = size * (spin ? .45 : .7), dur = spin ? 440 : 420, speed = dist / (dur / 1000);
    const x0 = p.x + Math.cos(angle) * 18, y0 = p.y + Math.sin(angle) * 18 - 8;
    const wave = sc.add.image(x0, y0, key).setScale(k * .6).setRotation(angle).setFlipY(spin).setDepth(DEPTH.fx).setAlpha(.95).setName(spin ? 'drag-spin-wave' : 'drag-crescent-wave');
    let lastGhost = 0;
    sc.tweens.addCounter({ from: 0, to: 1, duration: dur, ease: 'Sine.Out', onUpdate: tw => {
      const t = tw.getValue() ?? 0, x = x0 + Math.cos(angle) * dist * t, y = y0 + Math.sin(angle) * dist * t;
      wave.setPosition(x, y).setScale(k * (.6 + .45 * t)).setAlpha(.95 * (t > .65 ? 1 - (t - .65) / .35 : 1));
      if (spin) wave.setRotation(angle + t * Math.PI * 3);
      // 残影：每 45ms 留一张淡影
      if (sc.time.now - lastGhost > 45) {
        lastGhost = sc.time.now;
        const g = sc.add.image(x, y, key).setScale(wave.scaleX).setRotation(wave.rotation).setFlipY(spin).setDepth(DEPTH.fx - .1).setAlpha(.32).setBlendMode(Phaser.BlendModes.ADD);
        sc.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
      }
    }, onComplete: () => {
      // 碎散成像素碎片
      const tint = spin ? 0xffd56a : 0x8ffff0;
      for (let i = 0; i < 10; i++) { const a = angle + (i / 9 - .5) * 2.2; this.spawn('drag-spark', wave.x + Math.cos(a) * h * .3, wave.y + Math.sin(a) * h * .3, { life: 300, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, g: 60, depth: DEPTH.fx, tint, add: true, s0: PX, s1: PX * .3 }); }
      wave.destroy();
    } });
    for (const hit of hits) {
      const d = Math.hypot(hit.x - x0, hit.y - y0), delay = Math.min(dur, d / speed * 1000 * .8);
      sc.time.delayedCall(delay, () => {
        this.stats.flashes++;
        this.spawn('drag-flash', hit.x, hit.y - 18, { life: 200, depth: DEPTH.fx + .1, tint: spin ? 0xfff0b0 : 0xd8fff8, add: true, s0: PX * 1.2, s1: PX * 2.4 });
      });
    }
  }

  destroy(): void { for (const q of this.parts) q.img.destroy(); this.parts = []; this.flame?.destroy(); this.flame = undefined; }
}
