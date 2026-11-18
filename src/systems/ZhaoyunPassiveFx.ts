import Phaser from 'phaser';
import { DEPTH, IS_DESKTOP, actorDepth } from '../config';
import { ZHAOYUN_FX as Z } from '../data/zhaoyunFx';
import type { CharacterPassives } from './CharacterPassives';

/**
 * 赵云被动「七进七出」的手绘特效（透明底，普通混合）（参数与图集说明见 src/data/zhaoyunFx.ts）：
 *  1. 层数：脚下前半圈 7 枚银白龙鳞，叠一层点亮一枚（点亮序列），掉层熄灭（化光屑序列），满 7 层时一齐流光；
 *  2. 触发（满层后那一枪）：白龙枪芒沿出枪方向刺出 + 白龙绕身一闪 + 突进残影（人物同帧剪影 + 脚下疾风拖尾）。
 * 全部用对象池（龙鳞 7 枚常驻；一次性特效的精灵 / 残影用完回池），逐帧在 update 里推进，不开 tween。
 * 手机布局降级：龙鳞略小、残影只留 1 个。缺图时什么都不画（不退回代码画法）。
 */
type Mode = 'idle' | 'light' | 'lit' | 'out';
interface Anim { s: Phaser.GameObjects.Sprite; t0: number; ms: number; first: number; frames: number; alpha: number; }
interface Ghost { g: Phaser.GameObjects.Image; t0: number; alpha: number; }

export class ZhaoyunPassiveFx {
  /** 测试用计数。 */
  readonly stats = { lit: 0, out: 0, bursts: 0, ghosts: 0 };
  private scales: Phaser.GameObjects.Sprite[] = [];
  private mode: Mode[] = []; private at: number[] = [];
  private shown = -1; private full = false;
  private pool: Phaser.GameObjects.Sprite[] = []; private live: Anim[] = [];
  private ghostPool: Phaser.GameObjects.Image[] = []; private ghosts: Ghost[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  private texOk(): boolean { return this.scene.textures.exists('zhaoyun_scales'); }

  /** 每帧调用。x / y 为赵云脚底，now 为战斗时间（毫秒）。 */
  update(passive: CharacterPassives, now: number, x: number, y: number, visible: boolean): void {
    this.tick(now);
    const on = visible && passive.characterId === 'zhaoyun' && this.texOk();
    if (!on) { for (const s of this.scales) s.setVisible(false); this.shown = -1; return; }
    if (!this.scales.length) for (let i = 0; i < 7; i++) {
      this.scales.push(this.scene.add.sprite(0, 0, 'zhaoyun_scales', 0).setName('zhaoyun-scale-' + i));
      this.mode.push('idle'); this.at.push(-Infinity);
    }
    const snap = passive.snapshot(now), n = Math.max(0, Math.min(7, snap.stacks));
    if (this.shown < 0) { for (let i = 0; i < 7; i++) { this.mode[i] = i < n ? 'lit' : 'idle'; this.at[i] = -Infinity; } this.shown = n; }
    if (n > this.shown) for (let i = this.shown; i < n; i++) { this.mode[i] = 'light'; this.at[i] = now; this.stats.lit++; }
    if (n < this.shown) for (let i = n; i < this.shown; i++) { this.mode[i] = 'out'; this.at[i] = now; this.stats.out++; }
    this.shown = n; this.full = n >= 7;
    const S = Z.scales, size = IS_DESKTOP ? S.size : S.sizeMobile, depth = actorDepth(y) - .02, fy = y + Z.footDy;
    for (let i = 0; i < 7; i++) {
      const s = this.scales[i], a = S.from + (S.to - S.from) * i / 6;
      s.setPosition(x + Math.cos(a) * S.rx, fy + S.oy + Math.sin(a) * S.ry).setDisplaySize(size, size).setDepth(depth).setVisible(true);
      let frame = 0, alpha: number = S.idleAlpha;
      if (this.mode[i] === 'light') {
        const k = (now - this.at[i]) / S.lightMs;
        if (k >= 1) this.mode[i] = 'lit'; else { frame = Math.min(5, Math.floor(k * 6)); alpha = S.litAlpha; }
      } else if (this.mode[i] === 'out') {
        const k = (now - this.at[i]) / S.outMs;
        if (k >= 1) this.mode[i] = 'idle'; else { frame = 6 + Math.min(5, Math.floor(k * 6)); alpha = S.litAlpha; }
      }
      if (this.mode[i] === 'lit') { alpha = S.litAlpha; frame = this.full ? 12 + Math.floor(now / 1000 * S.shimmerFps + i * .7) % 6 : 5; }
      s.setFrame(frame).setAlpha(alpha);
    }
  }

  /** 满层那一枪：白龙枪芒 + 白龙绕身一闪 + 突进残影。angle 为出枪方向，len 为这一枪的枪长。 */
  burst(x: number, y: number, angle: number, len: number, now: number, body?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite): void {
    if (!this.scene.textures.exists('zhaoyun_thrust')) return;
    this.stats.bursts++;
    const L = Math.min(Z.thrust.maxLen, len * Z.thrust.lenMul), fy = y + Z.footDy;
    this.play('zhaoyun_thrust', 0, 8, Z.thrust.ms, Z.thrust.alpha, now).setPosition(x, y - 6).setOrigin(.03, .5).setRotation(angle).setDisplaySize(L, L).setDepth(DEPTH.fx);
    if (this.scene.textures.exists('zhaoyun_aura')) {
      const sz = IS_DESKTOP ? Z.aura.size : Z.aura.sizeMobile;
      this.play('zhaoyun_aura', 0, 6, Z.aura.ms, Z.aura.alpha, now).setPosition(x, fy).setOrigin(.5, Z.aura.originY).setRotation(0).setDisplaySize(sz, sz).setDepth(actorDepth(y) + .5);
      this.play('zhaoyun_aura', 6, 6, Z.trail.ms, Z.trail.alpha, now).setPosition(x, fy - Z.trail.dy).setOrigin(.9, .5).setRotation(angle).setDisplaySize(Z.trail.width, Z.trail.height).setDepth(actorDepth(y) - .03);
    }
    // 残影：人物当前这一帧的手绘图染成淡青剪影，沿出枪反方向排开、画在人物身后，再淡出
    if (body?.active && body.visible) {
      const G = Z.ghosts, n = IS_DESKTOP ? G.count : G.countMobile;
      for (let k = 0; k < n; k++) {
        const g = this.ghostPool.pop() ?? this.scene.add.image(0, 0, body.texture.key);
        g.setActive(true).setVisible(true).setTexture(body.texture.key, body.frame.name).setOrigin(body.originX, body.originY)
          .setDisplaySize(body.displayWidth, body.displayHeight).setFlipX(body.flipX).setTintFill(G.tint)
          .setPosition(body.x - Math.cos(angle) * G.gap * (k + 1), body.y - Math.sin(angle) * G.gap * (k + 1)).setDepth(body.depth - .001 - k * .001).setName('zhaoyun-ghost');
        const alpha = G.alpha * (1 - k / (n + 1));
        g.setAlpha(alpha); this.ghosts.push({ g, t0: now + k * 30, alpha }); this.stats.ghosts++;
      }
    }
  }

  private play(key: string, first: number, frames: number, ms: number, alpha: number, now: number): Phaser.GameObjects.Sprite {
    const s = this.pool.pop() ?? this.scene.add.sprite(0, 0, key);
    s.setTexture(key, first).setActive(true).setVisible(true).setAlpha(alpha).setName('zhaoyun-fx-' + key);
    this.live.push({ s, t0: now, ms, first, frames, alpha });
    return s;
  }

  private tick(now: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const a = this.live[i], k = (now - a.t0) / a.ms;
      if (k >= 1 || !a.s.active) { a.s.setVisible(false).setActive(false); this.pool.push(a.s); this.live.splice(i, 1); continue; }
      a.s.setFrame(a.first + Math.min(a.frames - 1, Math.floor(Math.max(0, k) * a.frames))).setAlpha(a.alpha * (k > .8 ? (1 - k) / .2 : 1));
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const o = this.ghosts[i], k = (now - o.t0) / Z.ghosts.lifeMs;
      if (k >= 1 || !o.g.active) { o.g.setVisible(false).setActive(false); this.ghostPool.push(o.g); this.ghosts.splice(i, 1); continue; }
      o.g.setAlpha(o.alpha * (1 - Math.max(0, k)));
    }
  }

  /** 测试用：当前各龙鳞状态。 */
  debug(): { modes: Mode[]; frames: number[]; visible: boolean; live: number; ghosts: number; pool: number } {
    return { modes: [...this.mode], frames: this.scales.map(s => Number(s.frame.name)), visible: this.scales.some(s => s.visible), live: this.live.length, ghosts: this.ghosts.length, pool: this.pool.length + this.ghostPool.length };
  }
}
