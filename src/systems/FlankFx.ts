import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';

/**
 * 战法「迂回袭」表现（第二版，用户反馈「不好看，重新做，但是也不需要太夸张」）。只管画面与音效，伤害在 BuildCombat。
 * 原则：精致、克制，尺寸约为第一版一半；蓄力 / 蓄满只留细微提示，触发 1 道（至多 2 道）细长侧袭，0.2–0.3 秒内干净消失。
 * 配色避开踏风步（绿叶白风）与拖刀斩，用柔和的冷色 / 暖色细线，不用大面积色块。两版小样，?flankfx=a / b 切换（默认 a）：
 * - a 月白弧光：蓄力时脚跟偶尔飘一点淡紫灰微尘；蓄满时身侧一粒星点慢闪；触发时一道细长月白弧光从侧面扫过被波及的敌人。
 * - b 侧袭残影：蓄力时脚跟拖一线淡影；蓄满时脚边一线微光；触发时 1–2 道细长杏白流光从主将侧面直插目标，首道带一张极淡残影。
 * 命中处都是一个小而亮的四角闪点。过渡素材：程序生成的像素图（最近邻），正式序列帧到位后替换。
 */
export type FlankStyle = 'a' | 'b';
export function flankStyle(search = typeof location !== 'undefined' ? location.search : ''): FlankStyle {
  return new URLSearchParams(search).get('flankfx') === 'b' ? 'b' : 'a';
}

const PX = 2;
const PAL = {
  a: { core: '#f8f6ff', edge: '#c2b6ec', line: '#2c2444', mote: 0xc9bfe8, glint: 0xf2eeff, flash: 0xf4f0ff },
  b: { core: '#fff6ec', edge: '#f2c2a8', line: '#3a2420', mote: 0xf0c8b4, glint: 0xffeedd, flash: 0xfff4e6 },
} as const;
interface P { img: Phaser.GameObjects.Image; life: number; age: number; vx: number; vy: number; s0: number; s1: number; a0: number }

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (put: (x: number, y: number, c: string, a?: number) => void) => void): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  draw((x, y, col, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(x, y, 1, 1); });
  scene.textures.addCanvas(key, c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ensure(scene: Phaser.Scene): void {
  tex(scene, 'flk-mote', 1, 1, put => put(0, 0, '#ffffff'));
  // 四角闪点（5×5）：白芯，十字两臂渐淡
  tex(scene, 'flk-glint', 5, 5, put => { put(2, 2, '#ffffff'); for (const [x, y] of [[1, 2], [3, 2], [2, 1], [2, 3]]) put(x, y, '#ffffff', .85); for (const [x, y] of [[0, 2], [4, 2], [2, 0], [2, 4]]) put(x, y, '#ffffff', .4); });
  for (const s of ['a', 'b'] as const) {
    const pal = PAL[s];
    if (s === 'a') {
      // 细长月白弧：高 44、最宽处 3 像素，两端收尖；凸面朝 +x；外沿一像素淡描边
      const W = 10, H = 44, on: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
      for (let y = 0; y < H; y++) { const t = (y - (H - 1) / 2) / ((H - 1) / 2), cx = 2 + 6 * (1 - t * t), th = Math.max(0, 2.6 * (1 - Math.abs(t) ** 1.6)); for (let x = 0; x < W; x++) { const d = x - cx; if (d <= .5 && d > -th) on[y][x] = d > -1 ? 2 : 1; } }
      tex(scene, 'flk-arc-a', W, H, put => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (on[y][x]) put(x, y, on[y][x] === 2 ? pal.core : pal.edge, on[y][x] === 2 ? 1 : .8); else if ([[1, 0], [-1, 0]].some(([dx]) => on[y][x + dx])) put(x, y, pal.line, .35); } });
    } else {
      // 细长流光：长 40、高 3，头亮尾淡
      tex(scene, 'flk-streak-b', 40, 3, put => { for (let x = 0; x < 40; x++) { const t = x / 39; put(x, 1, t > .82 ? pal.core : pal.edge, .12 + .88 * t); if (x > 22) { put(x, 0, pal.edge, .3 * t); put(x, 2, pal.edge, .3 * t); } } });
    }
  }
}

export class FlankFx {
  readonly style: FlankStyle;
  private parts: P[] = [];
  private glint?: Phaser.GameObjects.Image;
  private ready = false;
  private blink = 0;
  private emit = 0;
  private lastX: number; private lastY: number;
  readonly stats = { motes: 0, readyCount: 0, strikes: 0, sweeps: 0, hits: 0 };

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly sfx?: { play(kind: string): void }, style: FlankStyle = flankStyle()) {
    this.style = style; ensure(scene); this.lastX = player.x; this.lastY = player.y;
  }

  get isReady(): boolean { return this.ready; }
  /** 当前可见的迂回袭表现对象数（测试用：触发后应在 0.3 秒左右清干净）。 */
  get visibleCount(): number { return this.parts.filter(q => q.age < q.life).length + (this.glint?.visible ? 1 : 0); }

  private spawn(key: string, x: number, y: number, o: { life: number; vx?: number; vy?: number; s?: [number, number]; sx?: number; a0?: number; tint?: number; add?: boolean; depth: number; rot?: number }): Phaser.GameObjects.Image | undefined {
    let slot = this.parts.find(q => q.age >= q.life && q.img.texture.key === key);
    if (!slot && this.parts.length < 60) { slot = { img: this.scene.add.image(x, y, key).setName('flank-fx'), life: 0, age: 0, vx: 0, vy: 0, s0: 1, s1: 1, a0: 1 }; this.parts.push(slot); }
    if (!slot) return undefined;
    const [s0, s1] = o.s ?? [PX, PX];
    Object.assign(slot, { life: o.life, age: 0, vx: o.vx ?? 0, vy: o.vy ?? 0, s0, s1, a0: o.a0 ?? 1 });
    slot.img.setPosition(x, y).setScale(s0).setAlpha(slot.a0).setVisible(true).setDepth(o.depth).setRotation(o.rot ?? 0).setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) slot.img.setTint(o.tint); else slot.img.clearTint();
    return slot.img;
  }

  /** 每帧：level 为迂回袭等级（0 = 未拥有），ratio 为蓄力进度 0–1。 */
  update(dt: number, level: number, ratio: number): void {
    for (const q of this.parts) {
      if (q.age >= q.life) { if (q.img.visible) q.img.setVisible(false); continue; }
      q.age += dt * 1000; const t = Math.min(1, q.age / q.life);
      q.img.x += q.vx * dt; q.img.y += q.vy * dt;
      q.img.setScale(q.s0 + (q.s1 - q.s0) * t).setAlpha(q.a0 * (1 - t) * (1 - t));
    }
    const p = this.player, dx = p.x - this.lastX, dy = p.y - this.lastY, moved = Math.hypot(dx, dy); this.lastX = p.x; this.lastY = p.y;
    if (!level || !p.alive) { this.setReady(false); return; }
    if (ratio >= 1 && !this.ready) this.onReady();
    if (ratio < 1) this.setReady(false);
    const pal = PAL[this.style], depth = actorDepth(p.y + 26) - .01;
    // 蓄力：过半后才有，脚跟处极少量提示（约 6 个 / 秒）
    if (moved > .3 && dt > 0 && ratio > .5 && !this.ready) {
      const ux = dx / moved, uy = dy / moved;
      this.emit += dt * 6 * ratio;
      while (this.emit >= 1) {
        this.emit -= 1; this.stats.motes++;
        if (this.style === 'a') this.spawn('flk-mote', p.x - ux * 9 + (Math.random() - .5) * 8, p.y + 22, { life: 340, vx: -ux * 14, vy: -16, s: [PX, PX * .5], a0: .55, tint: pal.mote, add: true, depth });
        else this.spawn('flk-streak-b', p.x - ux * 14, p.y + 23, { life: 200, vx: -ux * 30, vy: -uy * 30, s: [PX * .35, PX * .2], a0: .35, tint: pal.mote, depth, rot: Math.atan2(uy, ux) });
      }
    }
    if (this.ready && this.glint) {
      // 蓄满：一粒星点（a 在身侧腰部 / b 在脚边）每 0.7 秒慢闪一次
      this.blink = (this.blink + dt) % .7; const on = this.blink < .22, k = on ? Math.sin(this.blink / .22 * Math.PI) : 0;
      const side = p.direction === 'left' ? -1 : 1, gx = this.style === 'a' ? p.x + side * 13 : p.x + side * 11, gy = this.style === 'a' ? p.y - 4 : p.y + 23;
      this.glint.setPosition(gx, gy).setDepth(p.sprite.depth + .004).setAlpha(.25 + .75 * k).setScale(PX * (.6 + .4 * k)).setVisible(true);
    }
  }

  private setReady(on: boolean): void { if (this.ready === on) return; this.ready = on; if (!on) this.glint?.setVisible(false); }

  private onReady(): void {
    this.ready = true; this.stats.readyCount++; this.blink = 0;
    this.sfx?.play('flankReady');
    this.glint ??= this.scene.add.image(0, 0, 'flk-glint').setBlendMode(Phaser.BlendModes.ADD).setName('flank-ready-glint');
    this.glint.setTint(PAL[this.style].glint);
  }

  /** 触发：a 一道月白弧光侧扫；b 至多两道杏白流光直插。被波及的每个敌人一个小闪点。 */
  strike(targets: Enemy[]): void {
    if (!targets.length) return;
    this.stats.strikes++; this.setReady(false);
    this.sfx?.play('flankStrike');
    const p = this.player, sc = this.scene, pal = PAL[this.style];
    const cx = targets.reduce((n, e) => n + e.x, 0) / targets.length, cy = targets.reduce((n, e) => n + e.y, 0) / targets.length - 16;
    const ang = Math.atan2(cy - (p.y - 16), cx - p.x), nx = -Math.sin(ang), ny = Math.cos(ang), side = Math.random() < .5 ? -1 : 1;
    const flash = (e: Enemy, delay: number): void => { sc.time.delayedCall(delay, () => { this.stats.hits++; this.spawn('flk-glint', e.x, e.y - 18, { life: 160, s: [PX * 1.4, PX * .8], tint: pal.flash, add: true, depth: DEPTH.fx + .2 }); }); };
    if (this.style === 'a') {
      // 一道弧光：从目标群一侧 40px 处出现，沿垂直方向扫过目标群到另一侧，220ms
      this.stats.sweeps++;
      const len = 40, x0 = cx + nx * len * side, y0 = cy + ny * len * side, x1 = cx - nx * len * side, y1 = cy - ny * len * side;
      const arc = this.spawn('flk-arc-a', x0, y0, { life: 230, s: [PX * .9, PX * .9], a0: .95, depth: DEPTH.fx, rot: ang });
      if (arc) sc.tweens.addCounter({ from: 0, to: 1, duration: 200, ease: 'Sine.Out', onUpdate: tw => { const t = tw.getValue() ?? 0; arc.setPosition(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); } });
      // 被扫到的先后：按目标在扫掠方向上的投影排序
      for (const e of targets) { const proj = ((e.x - x0) * (x1 - x0) + (e.y - 16 - y0) * (y1 - y0)) / (4 * len * len); flash(e, Math.max(0, Math.min(1, proj)) * 200); }
    } else {
      // 至多两道流光：从主将左 / 右侧 14px 处直插前两个目标，110ms；第一道带一张极淡残影
      targets.slice(0, 2).forEach((e, i) => {
        this.stats.sweeps++;
        const s = i === 0 ? side : -side, x0 = p.x + nx * 14 * s, y0 = p.y - 16 + ny * 14 * s, tx = e.x, ty = e.y - 16, a = Math.atan2(ty - y0, tx - x0);
        const st = this.spawn('flk-streak-b', x0, y0, { life: 200, s: [PX, PX], a0: 1, depth: DEPTH.fx, rot: a });
        if (st) sc.tweens.addCounter({ from: 0, to: 1, duration: 110, ease: 'Quad.Out', onUpdate: tw => { const t = tw.getValue() ?? 0; st.setPosition(x0 + (tx - x0) * t, y0 + (ty - y0) * t); } });
        if (i === 0) { const sp = p.sprite, g = this.spawn(sp.texture.key, p.x + nx * 14 * s, p.y + ny * 14 * s, { life: 200, s: [sp.scaleX, sp.scaleX], a0: .22, tint: pal.mote, add: true, depth: sp.depth - .002 }); g?.setFrame(sp.frame.name).setOrigin(sp.originX, sp.originY).setFlipX(sp.flipX); }
      });
      targets.forEach((e, i) => flash(e, i < 2 ? 110 : 140));
    }
  }

  destroy(): void { for (const q of this.parts) q.img.destroy(); this.parts = []; this.glint?.destroy(); this.glint = undefined; }
}
