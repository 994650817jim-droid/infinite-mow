import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Player } from '../entities/Player';
import { DRAG_SLASH_MS, DRAG_SLASH_SHEET, DRAG_SLASH_WEIGHTS, DRAG_TIP } from '../data/dragArt';
import { DRAG_TRAVEL } from './RunGrowth';

/**
 * 关羽本命修习「拖刀斩」表现（第二版，用户：「那个拖刀的绿色像素不好看」）。只管画面与音效，伤害判定在 weapons/registry.ts。
 * 去掉青绿色与粗像素块，整体精致、克制：
 * - 蓄力：刀尖拖地冒橙红火星，地上留暗色划痕（越蓄越密、划痕微微发烫），不再变色。
 * - 蓄满：刀刃上一线寒光（?dragfx=a 冷白 / b 淡金，默认 a），一粒亮点沿刀身来回流动；轻响不变。
 * - 释放：半月刀气改为半透明白金弧光，边缘柔和、带拖尾（平滑渐变贴图，线性采样）；三级回旋刀气同色系、更小更淡、边飞边旋。
 * 过渡素材：程序生成，正式序列帧到位后替换。
 */
type Dir = 'down' | 'up' | 'left' | 'right';
export type DragFxStyle = 'a' | 'b';
export function dragFxStyle(search = typeof location !== 'undefined' ? location.search : ''): DragFxStyle { return new URLSearchParams(search).get('dragfx') === 'b' ? 'b' : 'a'; }
const SHEEN = { a: { line: 0xdfe9ff, glint: 0xffffff, wave: [255, 250, 240], edge: [214, 226, 255] }, b: { line: 0xffe6b0, glint: 0xfff6dc, wave: [255, 246, 222], edge: [255, 214, 150] } } as const;
interface Particle { img: Phaser.GameObjects.Image; life: number; age: number; vx: number; vy: number; g: number; s0: number; s1: number; a0: number }

const PX = 2;

function pixelTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (put: (x: number, y: number, c: string, a?: number) => void) => void): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  draw((x, y, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, 1, 1); });
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
function smoothTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** 半月弧光：凸面朝 +x；前缘亮、向后渐隐，两端收尖，整体半透明柔边（256×512，按显示大小缩放）。 */
function crescentTex(scene: Phaser.Scene, key: string, core: readonly number[], edge: readonly number[]): void {
  smoothTex(scene, key, 128, 256, g => {
    const img = g.createImageData(128, 256), d = img.data, cy = 128, c1 = 8, r1 = 118, c2 = -26, r2 = 124;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
      const d1 = r1 - Math.hypot(x - c1, y - cy), d2 = Math.hypot(x - c2, y - cy) - r2;
      if (d1 < -2 || d2 < -2) continue;
      const th = Math.max(1, d1 + d2), t = Math.max(0, Math.min(1, d2 / th)); // 0 后缘 → 1 前缘
      const tip = 1 - Math.pow(Math.abs(y - cy) / 124, 3); // 两端淡出
      const soft = Math.min(1, (d1 + 2) / 3) * Math.min(1, (d2 + 2) / 6); // 边缘柔和
      const a = Math.max(0, soft * tip * (.12 + .88 * Math.pow(t, 1.6)));
      const m = Math.pow(t, 2), i = (y * 128 + x) * 4;
      d[i] = edge[0] + (core[0] - edge[0]) * m; d[i + 1] = edge[1] + (core[1] - edge[1]) * m; d[i + 2] = edge[2] + (core[2] - edge[2]) * m; d[i + 3] = 255 * a;
    }
    g.putImageData(img, 0, 0);
  });
}

function ensureTextures(scene: Phaser.Scene): void {
  // 火星：2×2 白点（按颜色着色），划痕：深色地沟 + 一行浅色翻土，热痕：一行白（着橙色）
  pixelTex(scene, 'drag-spark', 2, 2, put => { put(0, 0, '#fff'); put(1, 0, '#fff'); put(0, 1, '#fff'); put(1, 1, '#fff', .7); });
  pixelTex(scene, 'drag-groove', 7, 3, put => { for (let x = 0; x < 7; x++) { put(x, 0, '#c9a070', x === 0 || x === 6 ? .25 : .45); put(x, 1, '#24160d', x === 0 || x === 6 ? .45 : .85); put(x, 2, '#4a3020', .3); } });
  pixelTex(scene, 'drag-ember', 7, 1, put => { for (let x = 0; x < 7; x++) put(x, 0, '#fff', x === 0 || x === 6 ? .4 : 1); });
  // 寒光：细长柔光线（64×4，中间亮两头淡）与一粒亮点
  smoothTex(scene, 'drag-sheen', 64, 6, g => { const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(.75, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 2, 64, 2); g.globalAlpha = .25; g.fillRect(0, 1, 64, 4); });
  smoothTex(scene, 'drag-glow', 16, 16, g => { const r = g.createRadialGradient(8, 8, 0, 8, 8, 8); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 16, 16); });
  for (const s of ['a', 'b'] as const) crescentTex(scene, 'drag-arc-' + s, SHEEN[s].wave, SHEEN[s].edge);
}

export class DraggingBladeFx {
  readonly style: DragFxStyle;
  private parts: Particle[] = [];
  private sheen?: Phaser.GameObjects.Image;
  private glint?: Phaser.GameObjects.Image;
  private ready = false;
  private trail = 0;
  private emit = 0;
  private sheenT = 0;
  /** 测试 / 调试用统计。 */
  readonly stats = { sparks: 0, grooves: 0, readyCount: 0, waves: 0, spins: 0, flashes: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }, style: DragFxStyle = dragFxStyle()) {
    this.style = style; ensureTextures(scene);
  }

  get isReady(): boolean { return this.ready; }
  /** 蓄力进度 0–1（门槛与 weapons/registry.ts 同源：RunGrowth.DRAG_TRAVEL）。 */
  get ratio(): number { const lv = this.player.growth.masteries.dragging_blade; return lv ? Math.min(1, this.player.growth.travel / DRAG_TRAVEL[lv - 1]) : 0; }

  /** 刀尖位置：拖在身后（左右朝向）或身体一侧（上下朝向），贴地。 */
  private tip(): { x: number; y: number; back: number } {
    const p = this.player, d = p.direction as Dir;
    if (p.dragWalking) { const [tx, ty] = DRAG_TIP[d]; return { x: p.x + tx, y: p.y + ty, back: d === 'right' ? -1 : d === 'left' ? 1 : 0 }; }
    // 没有拖刀行走图时：现有行走图的大刀握在身前、刀头在脚前方，火星与寒光对准刀头
    const o = { right: [26, 20, -1], left: [-26, 20, 1], down: [14, 22, 0], up: [-12, 14, 0] }[d];
    return { x: p.x + o[0], y: p.y + o[1], back: o[2] };
  }
  /** 握刀手的大致位置（寒光沿 手 → 刀尖 这段刀身流动）。 */
  private hand(): { x: number; y: number } {
    const p = this.player, d = p.direction as Dir, o = p.dragWalking ? { right: [-4, 4], left: [4, 4], down: [8, 2], up: [-8, 2] }[d] : { right: [6, 2], left: [-6, 2], down: [6, 4], up: [-6, 0] }[d];
    return { x: p.x + o[0], y: p.y + o[1] };
  }

  private spawn(key: string, x: number, y: number, o: Partial<Particle> & { tint?: number; depth: number; add?: boolean; rot?: number }): void {
    let slot = this.parts.find(q => q.age >= q.life && q.img.texture.key === key);
    if (!slot && this.parts.length < 140) { slot = { img: this.scene.add.image(x, y, key), life: 0, age: 0, vx: 0, vy: 0, g: 0, s0: 1, s1: 1, a0: 1 }; this.parts.push(slot); }
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
    if (!lv || !this.player.alive) { this.hideSheen(); this.ready = false; return; }
    const ratio = this.ratio, tip = this.tip(), depth = actorDepth(this.player.y + 26) + .004;
    if (ratio >= 1 && !this.ready) this.onReady();
    if (ratio < 1) this.ready = false;
    if (moved > .3) {
      // 划痕：每拖过 9 像素留一道暗痕，上面一线橙红热痕随蓄力变亮
      this.trail += moved;
      while (this.trail >= 9) {
        this.trail -= 9; this.stats.grooves++;
        const ang = this.player.direction === 'up' || this.player.direction === 'down' ? Math.PI / 2 : 0;
        this.spawn('drag-groove', tip.x, tip.y, { life: 800, depth: DEPTH.deco + 2, a0: .5 + .3 * ratio, rot: ang });
        this.spawn('drag-ember', tip.x, tip.y, { life: 260 + 300 * ratio, depth: DEPTH.deco + 2.1, a0: .1 + .5 * ratio, tint: 0xff7a30, add: true, rot: ang });
      }
      // 火星：橙红，频率随蓄力上升（4 → 22 颗 / 秒），个头小
      this.emit += dt * (4 + 18 * ratio * ratio);
      while (this.emit >= 1) { this.emit -= 1; this.spark(tip, ratio, depth); }
    }
    if (this.ready) this.drawSheen(dt, tip, depth); else this.hideSheen();
  }

  private spark(tip: { x: number; y: number; back: number }, ratio: number, depth: number): void {
    this.stats.sparks++;
    const tint = Math.random() < .4 ? 0xffc46a : Math.random() < .6 ? 0xff8a3a : 0xe8502a;
    const back = tip.back || (Math.random() - .5) * 1.6;
    this.spawn('drag-spark', tip.x, tip.y - 1, { life: 200 + Math.random() * 200, vx: back * (30 + Math.random() * 50), vy: -40 - Math.random() * 60 * (.5 + ratio), g: 300, depth, tint, add: true, s0: PX * (.6 + .3 * ratio), s1: PX * .25 });
  }

  /** 刀刃寒光：沿 手 → 刀尖 一线淡光，一粒亮点每 0.9 秒从刀根流到刀尖。 */
  private drawSheen(dt: number, tip: { x: number; y: number }, depth: number): void {
    const h = this.hand(), dx = tip.x - h.x, dy = tip.y - h.y, len = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx), pal = SHEEN[this.style];
    this.sheenT = (this.sheenT + dt / .9) % 1;
    const s = this.sheen ??= this.scene.add.image(0, 0, 'drag-sheen').setBlendMode(Phaser.BlendModes.ADD).setName('drag-ready-sheen');
    const pulse = .7 + .2 * Math.sin(this.sheenT * Math.PI * 2);
    s.setPosition(h.x + dx * .55, h.y + dy * .55).setRotation(ang).setDisplaySize(len * .9, 3).setTint(pal.line).setAlpha(pulse).setDepth(depth + .002).setVisible(true);
    const g = this.glint ??= this.scene.add.image(0, 0, 'drag-glow').setBlendMode(Phaser.BlendModes.ADD).setName('drag-ready-glint');
    const t = this.sheenT < .6 ? this.sheenT / .6 : 1, k = this.sheenT < .6 ? Math.sin(t * Math.PI) : 0;
    g.setPosition(h.x + dx * (.2 + .8 * t), h.y + dy * (.2 + .8 * t)).setDisplaySize(7, 7).setTint(pal.glint).setAlpha(k).setDepth(depth + .003).setVisible(k > .02);
  }
  private hideSheen(): void { this.sheen?.setVisible(false); this.glint?.setVisible(false); }

  private onReady(): void {
    this.ready = true; this.stats.readyCount++; this.sheenT = 0;
    this.sfx?.play('bladeReady');
  }

  /**
   * 释放刀气。size：刀气弧长（与旧版 spawnGuandaoSlash 同口径）；hits：本次命中敌人的位置（按刀气飞到时闪光）。
   * kind：'crescent' 白金半月弧光向前飞；'spin' 三级回旋（同色系、更小更淡、弧向相反、边飞边旋）。
   */
  release(angle: number, size: number, kind: 'crescent' | 'spin', hits: { x: number; y: number }[]): void {
    const spin = kind === 'spin', p = this.player, sc = this.scene;
    if (spin) this.stats.spins++; else this.stats.waves++;
    this.hideSheen();
    if (!spin) sc.cameras.main.shake(70, .002);
    this.sfx?.play(spin ? 'bladeSpin' : 'bladeWave');
    // 拖刀上撩出刀动作（有图时）：半月刀气那一下，朝刀气方向的左 / 右
    if (!spin) { const strip = DRAG_SLASH_SHEET[p.growth.character]; if (strip) p.playStrip(strip, ['0', '1', '2', '3'], DRAG_SLASH_MS, Math.cos(angle) < 0, DRAG_SLASH_WEIGHTS); }
    const key = 'drag-arc-' + this.style;
    const h = size * (spin ? .55 : .85), k = h / 256, dist = size * (spin ? .4 : .65), dur = spin ? 380 : 360, speed = dist / (dur / 1000);
    const x0 = p.x + Math.cos(angle) * 18, y0 = p.y + Math.sin(angle) * 18 - 8, a0 = spin ? .55 : .8;
    const wave = sc.add.image(x0, y0, key).setScale(k * .7).setRotation(angle).setFlipY(spin).setDepth(DEPTH.fx).setAlpha(a0).setBlendMode(Phaser.BlendModes.ADD).setName(spin ? 'drag-spin-wave' : 'drag-crescent-wave');
    let lastGhost = 0;
    sc.tweens.addCounter({ from: 0, to: 1, duration: dur, ease: 'Sine.Out', onUpdate: tw => {
      const t = tw.getValue() ?? 0, x = x0 + Math.cos(angle) * dist * t, y = y0 + Math.sin(angle) * dist * t;
      wave.setPosition(x, y).setScale(k * (.7 + .35 * t)).setAlpha(a0 * (t > .55 ? 1 - (t - .55) / .45 : 1));
      if (spin) wave.setRotation(angle + t * Math.PI * 2.5);
      // 拖尾：每 30ms 留一张淡影，120ms 淡出
      if (sc.time.now - lastGhost > 30) {
        lastGhost = sc.time.now;
        const g = sc.add.image(x, y, key).setScale(wave.scaleX).setRotation(wave.rotation).setFlipY(spin).setDepth(DEPTH.fx - .1).setAlpha(wave.alpha * .35).setBlendMode(Phaser.BlendModes.ADD);
        sc.tweens.add({ targets: g, alpha: 0, duration: 120, onComplete: () => g.destroy() });
      }
    }, onComplete: () => wave.destroy() });
    for (const hit of hits) {
      const d = Math.hypot(hit.x - x0, hit.y - y0), delay = Math.min(dur, d / speed * 1000 * .8);
      sc.time.delayedCall(delay, () => {
        this.stats.flashes++;
        this.spawn('drag-glow', hit.x, hit.y - 18, { life: 160, depth: DEPTH.fx + .1, tint: SHEEN[this.style].glint, add: true, s0: .9, s1: 1.6 });
      });
    }
  }

  destroy(): void { for (const q of this.parts) q.img.destroy(); this.parts = []; this.sheen?.destroy(); this.glint?.destroy(); this.sheen = this.glint = undefined; }
}
