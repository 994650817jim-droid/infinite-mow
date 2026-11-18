import Phaser from 'phaser';
import { SKILL_FX } from './SkillFxSheets';
import type { Enemy } from '../entities/Enemy';

/**
 * 敌军死亡特效样片（原型，2026-11-18；?deathfx=a|b|c 切换，不带参数时维持现状）。
 * 规则：不画任何代码图形；全部是对敌人自己的手绘贴图做补间，B / C 另用已有的手绘尘土序列帧。
 * 性能：一个对象池（最多 CAP 个副本）+ 一个统一的 update 循环，不为每个敌人建 tween / 计时器。
 *  A 最轻：闪白 60ms → 往后退一小步、向受击反方向倾倒约 70° → 0.3 秒淡出并略微下沉。
 *  B：A + 脚下一小团手绘尘土（fx_collapse_dust 6 帧，大小约敌人宽度的 0.8 倍）。
 *  C：闪白 → 压成薄片快速淡出（吸血鬼幸存者味）；精英脚下加一圈很淡的墨晕（暂用尘土帧压暗代替手绘墨晕）。
 */
export type DeathFxMode = 'a' | 'b' | 'c';
export const DEATH_FX = { cap: 160, flashMs: 60, fallMs: 180, fadeMs: 300, tiltRad: 1.22, backStep: 9, sink: 6, dustMs: 460, dustScale: .8, squashMs: 150, haloMs: 420 } as const;
const DUST = 'fx_collapse_dust';

interface Entry {
  img: Phaser.GameObjects.Image; /** 只有 B 方案才建 */ dust?: Phaser.GameObjects.Image; /** 只有 C 方案的精英才建 */ halo?: Phaser.GameObjects.Image;
  active: boolean; start: number; x: number; y: number; dir: number; sx: number; sy: number; size: number; elite: boolean; dustOn: boolean;
}

export function deathFxMode(): DeathFxMode | null {
  try { const v = new URLSearchParams(location.search).get('deathfx'); return v === 'a' || v === 'b' || v === 'c' ? v : null; } catch { return null; }
}

export class DeathFx {
  private readonly pool: Entry[] = []; private live = 0; private cursor = 0;
  /** 本场累计播放数（样片测试用）。 */
  played = 0;
  constructor(private scene: Phaser.Scene, readonly mode: DeathFxMode) {}

  get liveCount(): number { return this.live; }

  private acquire(): Entry {
    for (let n = 0; n < this.pool.length; n++) { const e = this.pool[(this.cursor + n) % this.pool.length]; if (!e.active) { this.cursor = (this.cursor + n + 1) % this.pool.length; return e; } }
    if (this.pool.length < DEATH_FX.cap) {
      const s = this.scene, e: Entry = {
        img: s.add.image(0, 0, 'gem_small').setVisible(false).setName('death-fx'),
        active: false, start: 0, x: 0, y: 0, dir: 1, sx: 1, sy: 1, size: 40, elite: false, dustOn: false,
      };
      this.pool.push(e); return e;
    }
    const old = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.pool.length; this.release(old); return old; // 满了：回收最老的
  }

  private release(e: Entry): void { if (e.active) this.live--; e.active = false; e.img.setVisible(false); e.dust?.setVisible(false); e.halo?.setVisible(false); }

  /** 敌人被击杀的一瞬间调用（首领 / 我方 / 补给不走这套）。fromX / fromY = 受击来源（主将）位置，用来定倒向。 */
  play(enemy: Enemy, fromX: number, fromY: number, now: number): void {
    if (enemy.kind === 'boss') return;
    const sp = enemy.sprite, e = this.acquire(), dx = sp.x - fromX;
    e.active = true; this.live++; this.played++;
    e.start = now; e.x = sp.x; e.y = sp.y; e.dir = dx === 0 ? (sp.flipX ? -1 : 1) : Math.sign(dx);
    e.sx = sp.scaleX; e.sy = sp.scaleY; e.size = Math.max(28, Math.abs(sp.displayWidth)); e.elite = enemy.kind === 'elite'; e.dustOn = false;
    e.img.setTexture(sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(e.sx, e.sy).setFlipX(sp.flipX).setPosition(e.x, e.y).setRotation(0)
      .setAlpha(1).setDepth(sp.depth).setVisible(true).setTintFill(0xffffff);
    e.dust?.setVisible(false); e.halo?.setVisible(false);
    if (this.mode === 'c' && e.elite && this.scene.textures.exists(DUST)) {
      const s = e.size * 1.9; e.halo ??= this.scene.add.image(0, 0, DUST, 2).setName('death-fx-halo'); e.halo.setDisplaySize(s, s).setPosition(e.x, e.y - 2).setOrigin(.5, .62).setAlpha(.0).setTint(0x2a2118).setRotation(Math.random() * 6.28).setDepth(sp.depth - .2).setVisible(true);
    }
  }

  update(now: number): void {
    if (!this.live) return;
    const D = DEATH_FX, haveDust = this.scene.textures.exists(DUST), frames = SKILL_FX[DUST]?.frames ?? 6;
    for (const e of this.pool) {
      if (!e.active) continue;
      const t = now - e.start;
      if (this.mode === 'c') {
        // 闪白 → 压成薄片、淡出
        if (t >= D.flashMs) e.img.clearTint();
        const k = Phaser.Math.Clamp((t - D.flashMs * .5) / D.squashMs, 0, 1), q = 1 - (1 - k) * (1 - k);
        e.img.setScale(e.sx * (1 + .35 * q), e.sy * (1 - .88 * q));
        e.img.setAlpha(1 - Phaser.Math.Clamp((t - D.flashMs) / (D.squashMs * 1.5), 0, 1));
        if (e.elite && e.halo) { const h = Phaser.Math.Clamp(t / D.haloMs, 0, 1); e.halo.setAlpha(h < .25 ? h / .25 * .28 : (1 - h) / .75 * .28); }
        if (t >= D.haloMs || (!e.elite && t >= D.flashMs + D.squashMs * 1.5)) this.release(e);
        continue;
      }
      // A / B：闪白 60ms → 后退 + 向受击反方向倾倒 70° → 0.3 秒淡出并略微下沉
      if (t >= D.flashMs) e.img.clearTint();
      const f = Phaser.Math.Clamp((t - D.flashMs) / D.fallMs, 0, 1), ease = 1 - (1 - f) * (1 - f);
      const fade = Phaser.Math.Clamp((t - D.flashMs) / D.fadeMs, 0, 1);
      e.img.setRotation(e.dir * D.tiltRad * ease).setPosition(e.x + e.dir * D.backStep * ease, e.y + D.sink * fade).setAlpha(1 - fade);
      if (this.mode === 'b' && haveDust) {
        if (!e.dustOn && t >= D.flashMs) {
          e.dustOn = true; const s = e.size * D.dustScale; e.dust ??= this.scene.add.image(0, 0, DUST, 0).setName('death-fx-dust');
          e.dust.setDisplaySize(s, s).setPosition(e.x + e.dir * D.backStep * .6, e.y + 2).setOrigin(.5, .62).setAlpha(.8).setDepth(e.img.depth + .1).setVisible(true);
        }
        if (e.dustOn && e.dust) { const d = Phaser.Math.Clamp((t - D.flashMs) / D.dustMs, 0, 1); e.dust.setFrame(Math.min(frames - 1, Math.floor(d * frames))).setAlpha(.8 * (1 - d * d)); }
      }
      if (t >= D.flashMs + D.fadeMs && (!e.dustOn || t >= D.flashMs + D.dustMs)) this.release(e);
    }
  }
}
