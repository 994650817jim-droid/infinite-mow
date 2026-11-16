import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Player } from '../entities/Player';

/**
 * 战法「踏风步」专属表现（青叶轻风）。只管画面与音效，增伤仍在 BuildCombat.damage。
 * 与迂回袭（暗金影袭，风刃在腰部）、拖刀斩（青色半月刀气）区分：踏风步只在脚下，配色是嫩叶绿 + 白风，体量更小。
 * 过渡素材：程序生成的低分辨率像素图（最近邻放大、深色描边），正式序列帧到位后替换。
 * - 蓄力：移动时脚边飘出白色小风纹（"~"）与淡淡步尘，越接近蓄满越密，七成后夹带青叶。
 * - 蓄满：三片青叶贴地绕脚旋转，靴边一圈白色细风纹，音效 windReady（轻）。
 * - 命中：命中点爆一小团碎叶 + 一道白色小风刃，音效 windHit（短）。
 */
const PX = 2;
interface P { img: Phaser.GameObjects.Image; life: number; age: number; vx: number; vy: number; g: number; spin: number; s0: number; s1: number; a0: number }

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (put: (x: number, y: number, c: string, a?: number) => void) => void): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  draw((x, y, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, 1, 1); });
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ensure(scene: Phaser.Scene): void {
  // 风纹：一笔 "~"（白，两头淡）
  tex(scene, 'wind-wisp', 9, 3, put => { const ys = [2, 1, 0, 0, 1, 2, 2, 1, 0]; ys.forEach((y, x) => put(x, y, '#ffffff', x === 0 || x === 8 ? .45 : .95)); });
  // 青叶：5×3 小叶片（亮绿芯、深绿边、一像素叶柄）
  tex(scene, 'wind-leaf', 6, 4, put => {
    const shape = ['.##...', '####..', '.#####', '..##..'];
    shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') put(x, y, (y === 1 && x > 0 && x < 4) || (y === 2 && x > 1 && x < 5) ? '#b6ec6e' : '#4f8f2c'); }));
    put(5, 3, '#2e5a18', .9);
  });
  // 小风刃：短弧 "》"（白芯、浅青绿边、深色描边）
  const W = 7, H = 11, on = (x: number, y: number) => { const d = Math.abs(y - 5); return x === Math.round(1 + d * .8) || x === Math.round(2 + d * .8) && d < 4; };
  tex(scene, 'wind-slash', W, H, put => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (on(x, y)) put(x, y, Math.abs(y - 5) < 3 ? '#ffffff' : '#c8f4d0'); else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => on(x + dx, y + dy))) put(x, y, '#173a24', .7); } });
  // 步尘：3×2 淡土色
  tex(scene, 'wind-dust', 3, 2, put => { put(1, 0, '#e6d6b0', .8); put(0, 1, '#d8c49a', .7); put(1, 1, '#e6d6b0', .9); put(2, 1, '#d8c49a', .7); });
}

export class WindstepFx {
  private parts: P[] = [];
  private leaves: Phaser.GameObjects.Image[] = [];
  private ready = false;
  private spin = 0;
  private emit = 0;
  private lastX: number; private lastY: number;
  readonly stats = { wisps: 0, readyCount: 0, bursts: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }) {
    ensure(scene); this.lastX = player.x; this.lastY = player.y;
  }

  get isReady(): boolean { return this.ready; }

  private spawn(key: string, x: number, y: number, o: { life: number; vx?: number; vy?: number; g?: number; spin?: number; s?: [number, number]; a0?: number; tint?: number; add?: boolean; depth: number; rot?: number; flipX?: boolean }): void {
    let slot = this.parts.find(q => q.age >= q.life && q.img.texture.key === key);
    if (!slot && this.parts.length < 120) { slot = { img: this.scene.add.image(x, y, key), life: 0, age: 0, vx: 0, vy: 0, g: 0, spin: 0, s0: 1, s1: 1, a0: 1 }; this.parts.push(slot); }
    if (!slot) return;
    const [s0, s1] = o.s ?? [PX, PX];
    Object.assign(slot, { life: o.life, age: 0, vx: o.vx ?? 0, vy: o.vy ?? 0, g: o.g ?? 0, spin: o.spin ?? 0, s0, s1, a0: o.a0 ?? 1 });
    slot.img.setPosition(x, y).setScale(s0).setAlpha(slot.a0).setVisible(true).setDepth(o.depth).setRotation(o.rot ?? 0).setFlipX(!!o.flipX)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) slot.img.setTint(o.tint); else slot.img.clearTint();
  }

  /** 每帧：level 为踏风步等级（0 = 未拥有），ratio 为蓄力进度 0–1。 */
  update(dt: number, level: number, ratio: number): void {
    for (const q of this.parts) {
      if (q.age >= q.life) { if (q.img.visible) q.img.setVisible(false); continue; }
      q.age += dt * 1000; const t = Math.min(1, q.age / q.life);
      q.vy += q.g * dt; q.img.x += q.vx * dt; q.img.y += q.vy * dt; q.img.rotation += q.spin * dt;
      q.img.setScale(q.s0 + (q.s1 - q.s0) * t).setAlpha(q.a0 * (1 - t * t));
    }
    const p = this.player, dx = p.x - this.lastX, dy = p.y - this.lastY, moved = Math.hypot(dx, dy); this.lastX = p.x; this.lastY = p.y;
    if (!level || !p.alive) { this.setReady(false); return; }
    if (ratio >= 1 && !this.ready) this.onReady();
    if (ratio < 1) this.setReady(false);
    const depth = actorDepth(p.y + 26);
    if (moved > .3 && dt > 0 && !this.ready) {
      const ux = dx / moved, uy = dy / moved;
      // 脚边风纹：4 → 16 笔 / 秒，从脚边向后上方飘散；七成后夹带青叶
      this.emit += dt * (4 + 12 * ratio);
      while (this.emit >= 1) {
        this.emit -= 1; this.stats.wisps++;
        const side = Math.random() < .5 ? -1 : 1, fx = p.x - ux * 8 + side * (6 + Math.random() * 8), fy = p.y + 22 + (Math.random() - .5) * 4;
        this.spawn('wind-wisp', fx, fy, { life: 300, vx: -ux * 40 + side * 12, vy: -uy * 40 - 14, s: [PX * .8, PX * 1.1], a0: .35 + .4 * ratio, add: true, depth: depth - .01, flipX: ux < 0 });
        if (Math.random() < .5) this.spawn('wind-dust', p.x - ux * 10, p.y + 25, { life: 260, vx: -ux * 20, vy: -8, s: [PX * .8, PX * 1.4], a0: .55, depth: DEPTH.deco + 2 });
        if (ratio > .7 && Math.random() < .35) this.spawn('wind-leaf', fx, fy - 4, { life: 420, vx: -ux * 50 + side * 18, vy: -30, g: 60, spin: 8 * side, s: [PX, PX * .8], depth: depth + .001 });
      }
    }
    if (this.ready) {
      // 三片青叶贴地绕脚（椭圆很扁，前半圈在身前、后半圈在身后），靴边每 0.12 秒卷起一笔白风纹
      this.spin += dt * 6;
      this.leaves.forEach((l, i) => {
        const a = this.spin + i * Math.PI * 2 / 3, x = p.x + Math.cos(a) * 17, y = p.y + 22 + Math.sin(a) * 5;
        l.setPosition(x, y).setRotation(a * 1.5).setDepth(p.sprite.depth + (Math.sin(a) > 0 ? .003 : -.003)).setVisible(true);
      });
      if (Math.random() < dt * 8) { const a = this.spin + Math.random() * Math.PI * 2; this.spawn('wind-wisp', p.x + Math.cos(a) * 15, p.y + 20 + Math.sin(a) * 4, { life: 240, vy: -18, s: [PX * .7, PX], a0: .6, add: true, depth: p.sprite.depth + .002, rot: a + Math.PI / 2 }); }
    }
  }

  private setReady(on: boolean): void { if (this.ready === on) return; this.ready = on; if (!on) for (const l of this.leaves) l.setVisible(false); }

  private onReady(): void {
    this.ready = true; this.stats.readyCount++;
    this.sfx?.play('windReady');
    if (!this.leaves.length) for (let i = 0; i < 3; i++) this.leaves.push(this.scene.add.image(0, 0, 'wind-leaf').setScale(PX * 1.1).setName('wind-ready-leaf'));
    const p = this.player;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.spawn('wind-wisp', p.x + Math.cos(a) * 10, p.y + 22 + Math.sin(a) * 3, { life: 280, vx: Math.cos(a) * 60, vy: Math.sin(a) * 18 - 10, s: [PX * .8, PX * 1.2], a0: .8, add: true, depth: p.sprite.depth + .002, rot: a + Math.PI / 2 }); }
  }

  /** 踏风步那一击命中：命中点一小团碎叶 + 一道白色小风刃。 */
  burst(x: number, y: number): void {
    this.stats.bursts++; this.setReady(false);
    this.sfx?.play('windHit');
    const p = this.player, a = Math.atan2(y - p.y, x - p.x), cy = y - 18;
    this.spawn('wind-slash', x - Math.cos(a) * 4, cy, { life: 170, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, s: [PX * 1.7, PX * 2.2], depth: DEPTH.fx + .05, rot: a, a0: .95 });
    for (let i = 0; i < 7; i++) { const b = a + (i / 6 - .5) * 2.4, sp = 55 + Math.random() * 55; this.spawn('wind-leaf', x, cy, { life: 380, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp - 30, g: 140, spin: (Math.random() - .5) * 18, s: [PX * 1.25, PX * .8], depth: DEPTH.fx + .04 }); }
    for (let i = 0; i < 3; i++) { const b = a + (i - 1) * .6; this.spawn('wind-wisp', x, cy, { life: 200, vx: Math.cos(b) * 80, vy: Math.sin(b) * 80, s: [PX, PX * 1.3], a0: .8, add: true, depth: DEPTH.fx + .03, rot: b }); }
  }

  destroy(): void { for (const q of this.parts) q.img.destroy(); this.parts = []; for (const l of this.leaves) l.destroy(); this.leaves = []; }
}
