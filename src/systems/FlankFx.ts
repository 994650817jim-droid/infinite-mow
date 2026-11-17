import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';

/**
 * 战法「迂回袭」专属表现（暗金影袭，与关羽拖刀斩的青色半月刀气、阵营青色区分开）。只管画面与音效，伤害仍在 BuildCombat。
 * 过渡素材：程序生成的低分辨率像素图（最近邻放大、深色描边），正式序列帧到位后替换。
 * - 蓄力：移动时脚后拖出淡金色疾风线，越接近蓄满越密；七成以上开始留下暗金残影。
 * - 蓄满：两片暗金小风刃绕身旋转，播一声轻响（flankReady），提示下一击是迂回追击。
 * - 触发：从主将身边分出 1–3 个暗金残影，沿侧翼弧线扑向被波及的敌人，命中处交叉爪痕 + 闪光（flankStrike）。
 */
const PX = 3;
const GOLD = { core: '#fff3c4', light: '#f2c45a', mid: '#b8862a', dark: '#6a4612', line: '#1e1206' };
interface P { img: Phaser.GameObjects.Image; life: number; age: number; vx: number; vy: number; s0x: number; s1x: number; s0y: number; s1y: number; a0: number }

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (put: (x: number, y: number, c: string, a?: number) => void) => void): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  draw((x, y, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, 1, 1); });
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ensure(scene: Phaser.Scene): void {
  // 疾风线：中段实、两头虚
  tex(scene, 'flank-streak', 11, 1, put => { for (let x = 0; x < 11; x++) put(x, 0, '#fff', x < 2 ? .35 : x > 8 ? .5 : 1); });
  // 小风刃：细长弯月（凸面朝 +x），描深色边
  const W = 10, H = 18, fill: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + .5, py = y + .5, d1 = 9 - Math.hypot(px - 1, py - 9), d2 = Math.hypot(px + 3, py - 9) - 9.5;
    if (d1 >= 0 && d2 >= 0) { const t = d2 / (d1 + d2 || 1); fill[y][x] = t > .65 ? GOLD.core : t > .35 ? GOLD.light : GOLD.mid; }
  }
  tex(scene, 'flank-blade', W, H, put => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (fill[y][x]) put(x, y, fill[y][x]!); else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fill[y + dy]?.[x + dx])) put(x, y, GOLD.line, .85); } });
  // 交叉爪痕：两道斜线，金芯深边
  tex(scene, 'flank-slash', 15, 15, put => {
    const on = (x: number, y: number) => Math.abs(x - y) <= 1 && x > 1 && x < 13 || Math.abs(x + y - 14) <= 1 && x > 2 && x < 12;
    for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
      if (on(x, y)) put(x, y, Math.abs(x - y) === 0 || Math.abs(x + y - 14) === 0 ? GOLD.core : GOLD.light);
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => on(x + dx, y + dy))) put(x, y, GOLD.line, .8);
    }
  });
  // 命中闪光：小十字星
  tex(scene, 'flank-flash', 7, 7, put => { for (let i = 0; i < 7; i++) { const a = 1 - Math.abs(i - 3) / 4; put(i, 3, '#fff', a); put(3, i, '#fff', a); } put(2, 2, GOLD.light, .7); put(4, 4, GOLD.light, .7); put(2, 4, GOLD.light, .7); put(4, 2, GOLD.light, .7); });
}

export class FlankFx {
  private parts: P[] = [];
  private blades: Phaser.GameObjects.Image[] = [];
  private ready = false;
  private spin = 0;
  private emit = 0;
  private ghostAt = 0;
  private lastX: number; private lastY: number;
  readonly stats = { streaks: 0, ghosts: 0, readyCount: 0, strikes: 0, hits: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }) {
    ensure(scene); this.lastX = player.x; this.lastY = player.y;
  }

  get isReady(): boolean { return this.ready; }

  private spawn(key: string, x: number, y: number, o: { life: number; vx?: number; vy?: number; sx?: [number, number]; sy?: [number, number]; a0?: number; tint?: number; add?: boolean; depth: number; rot?: number; frame?: string | number; flipX?: boolean; tintFill?: boolean }): Phaser.GameObjects.Image | undefined {
    let slot = this.parts.find(q => q.age >= q.life && q.img.texture.key === key);
    if (!slot && this.parts.length < 140) { slot = { img: this.scene.add.image(x, y, key, o.frame), life: 0, age: 0, vx: 0, vy: 0, s0x: 1, s1x: 1, s0y: 1, s1y: 1, a0: 1 }; this.parts.push(slot); }
    if (!slot) return undefined;
    const [s0x, s1x] = o.sx ?? [PX, PX], [s0y, s1y] = o.sy ?? [s0x, s1x];
    Object.assign(slot, { life: o.life, age: 0, vx: o.vx ?? 0, vy: o.vy ?? 0, s0x, s1x, s0y, s1y, a0: o.a0 ?? 1 });
    const img = slot.img; if (o.frame !== undefined) img.setTexture(key, o.frame);
    img.setPosition(x, y).setScale(s0x, s0y).setAlpha(slot.a0).setVisible(true).setDepth(o.depth).setRotation(o.rot ?? 0).setFlipX(!!o.flipX)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) { if (o.tintFill) img.setTintFill(o.tint); else img.setTint(o.tint); } else img.clearTint();
    return img;
  }

  /** 残影：复制主将当前帧，暗金着色。 */
  private ghost(x: number, y: number, life: number, alpha: number, depth: number, vx = 0, vy = 0, solid = true): Phaser.GameObjects.Image | undefined {
    const sp = this.player.sprite; this.stats.ghosts++;
    // solid：拖影用纯暗金剪影；扑击用保留细节的金色着色（看得出是主将的分身）
    const g = this.spawn(sp.texture.key, x, y, { life, vx, vy, sx: [sp.scaleX, sp.scaleX], sy: [sp.scaleY, sp.scaleY], a0: alpha, tint: solid ? 0x8a5e1c : 0xe8b850, tintFill: solid, depth, frame: sp.frame.name, flipX: sp.flipX });
    g?.setOrigin(sp.originX, sp.originY);
    return g;
  }

  /** 每帧：level 为迂回袭等级（0 = 未拥有），ratio 为蓄力进度 0–1。 */
  update(dt: number, level: number, ratio: number): void {
    for (const q of this.parts) {
      if (q.age >= q.life) { if (q.img.visible) q.img.setVisible(false); continue; }
      q.age += dt * 1000; const t = Math.min(1, q.age / q.life);
      q.img.x += q.vx * dt; q.img.y += q.vy * dt;
      q.img.setScale(q.s0x + (q.s1x - q.s0x) * t, q.s0y + (q.s1y - q.s0y) * t).setAlpha(q.a0 * (1 - t));
    }
    const p = this.player, dx = p.x - this.lastX, dy = p.y - this.lastY, moved = Math.hypot(dx, dy); this.lastX = p.x; this.lastY = p.y;
    if (!level || !p.alive) { this.setReady(false); return; }
    if (ratio >= 1 && !this.ready) this.onReady();
    if (ratio < 1) this.setReady(false);
    const depth = actorDepth(p.y + 26);
    if (moved > .3 && dt > 0) {
      const ux = dx / moved, uy = dy / moved;
      // 疾风线：脚后侧向掠过，越蓄越密（5 → 30 条 / 秒）
      this.emit += dt * (5 + 25 * ratio * ratio);
      while (this.emit >= 1) {
        this.emit -= 1; this.stats.streaks++;
        const side = (Math.random() - .5) * 26, bx = p.x - ux * 14 - uy * side, by = p.y + 14 - ux * side * .4 + (Math.random() - .5) * 10;
        this.spawn('flank-streak', bx, by, { life: 220 + 120 * ratio, vx: -ux * 90, vy: -uy * 90, sx: [PX * (.8 + ratio), PX * .4], sy: [PX * .7, PX * .7], a0: .35 + .5 * ratio, tint: ratio > .75 ? 0xffe9a8 : 0xf4ead2, add: true, depth: depth - .01, rot: Math.atan2(uy, ux) });
      }
      // 七成以上：每 90ms 留一张暗金残影
      if (ratio >= .7 && this.scene.time.now - this.ghostAt > 90) { this.ghostAt = this.scene.time.now; this.ghost(p.sprite.x, p.sprite.y, 200, .32 + .25 * (ratio - .7) / .3, p.sprite.depth - .002); }
    }
    if (this.ready) {
      // 两片风刃绕身（椭圆轨道，在腰部高度，前半圈在身前、后半圈在身后）
      this.spin += dt * 7.5;
      this.blades.forEach((b, i) => {
        const a = this.spin + i * Math.PI, x = p.x + Math.cos(a) * 26, y = p.y - 8 + Math.sin(a) * 9;
        b.setPosition(x, y).setRotation(a + Math.PI / 2).setDepth(p.sprite.depth + (Math.sin(a) > 0 ? .003 : -.003)).setVisible(true).setAlpha(.85 + .15 * Math.sin(this.spin * 3));
      });
    }
  }

  private setReady(on: boolean): void { if (this.ready === on) return; this.ready = on; if (!on) for (const b of this.blades) b.setVisible(false); }

  private onReady(): void {
    this.ready = true; this.stats.readyCount++;
    this.sfx?.play('flankReady');
    if (!this.blades.length) for (let i = 0; i < 2; i++) this.blades.push(this.scene.add.image(0, 0, 'flank-blade').setScale(PX * .8).setName('flank-ready-blade'));
    const p = this.player, depth = p.sprite.depth + .004;
    this.spawn('flank-flash', p.x - 16, p.y - 14, { life: 220, sx: [PX * .8, PX * 2], depth, add: true, tint: 0xfff0c0 });
    this.spawn('flank-flash', p.x + 16, p.y - 14, { life: 220, sx: [PX * .8, PX * 2], depth, add: true, tint: 0xfff0c0 });
  }

  /** 触发：每个被波及的敌人一个暗金残影扑过去，命中处爪痕 + 闪光。 */
  strike(targets: Enemy[]): void {
    if (!targets.length) return;
    this.stats.strikes++; this.setReady(false);
    this.sfx?.play('flankStrike');
    const p = this.player, sc = this.scene, x0 = p.sprite.x, y0 = p.sprite.y;
    targets.forEach((e, i) => {
      const tx = e.x, ty = e.y, side = i % 2 ? 1 : -1, len = Math.hypot(tx - x0, ty - y0) || 1;
      // 侧翼弧线：起点在主将左 / 右侧，中段向外鼓出
      const nx = -(ty - y0) / len, ny = (tx - x0) / len, bow = (22 + 10 * i) * side;
      const dur = 170 + 30 * i;
      const ghost = this.ghost(x0 + nx * bow * .4, y0 + ny * bow * .4, dur + 40, .62, DEPTH.fx - .2, 0, 0, false);
      ghost?.setFlipX(tx < x0);
      let lastTrail = 0;
      sc.tweens.addCounter({ from: 0, to: 1, duration: dur, ease: 'Quad.Out', onUpdate: tw => {
        const t = tw.getValue() ?? 0, b = (.4 + .6 * Math.sin(Math.PI * Math.min(1, t * .9 + .1))) * bow * (1 - t * .7);
        const x = x0 + (tx - x0) * t * .82 + nx * b, y = y0 + (ty - y0) * t * .82 + ny * b;
        ghost?.setPosition(x, y);
        if (sc.time.now - lastTrail > 16) { lastTrail = sc.time.now; this.spawn('flank-streak', x, y - 20, { life: 160, sx: [PX * 1.4, PX * .3], sy: [PX, PX], a0: .8, tint: 0xf2c45a, add: true, depth: DEPTH.fx - .3, rot: Math.atan2(ty - y0 + ny * bow, tx - x0 + nx * bow) }); }
      }, onComplete: () => {
        this.stats.hits++;
        const rot = Math.atan2(ty - y0, tx - x0);
        this.spawn('flank-slash', tx, ty - 20, { life: 200, sx: [PX * .9, PX * 1.15], depth: DEPTH.fx + .1, rot: rot - Math.PI / 4 });
        this.spawn('flank-flash', tx, ty - 20, { life: 150, sx: [PX * .9, PX * 1.8], depth: DEPTH.fx + .2, add: true, tint: 0xfff6d8 });
        for (let k = 0; k < 6; k++) { const a = rot + (k / 5 - .5) * 2; this.spawn('flank-streak', tx, ty - 20, { life: 200, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, sx: [PX, PX * .3], sy: [PX * .7, PX * .7], tint: 0xf2c45a, add: true, depth: DEPTH.fx, rot: a }); }
      } });
    });
  }

  destroy(): void { for (const q of this.parts) q.img.destroy(); this.parts = []; for (const b of this.blades) b.destroy(); this.blades = []; }
}
