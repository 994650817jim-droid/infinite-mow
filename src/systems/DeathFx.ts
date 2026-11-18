import Phaser from 'phaser';
import { IS_DESKTOP } from '../config';
import { SKILL_FX } from './SkillFxSheets';
import { deathFxOn } from './BattleSettings';
import type { Enemy } from '../entities/Enemy';

/**
 * 敌军死亡特效（2026-11-18 用户选定 B「脚下尘土」，样片见分支 claude/death-fx-proto）。默认对所有普通敌人生效；
 * 设置里「死亡特效：开 / 关」（im_death_fx，主页设置与战斗内设置共用，缺省开）；?deathfx=a|b|c|off 只用于调试 / 对比。
 * 规则：不画任何代码图形；全部是对敌人自己的手绘贴图（身体、阴影）做补间，加上已有的手绘尘土序列帧。
 * 性能：一个对象池（电脑最多 CAP_DESKTOP 个、手机 CAP_LITE 个）+ 一个统一的 update 循环，不为每个敌人建 tween / 计时器。
 *  B：闪白 60ms → 往后退一小步、向「受击来源 → 敌人」的方向倾倒约 70° → 0.3 秒内淡出并略微下沉；脚下阴影同步淡出；
 *     脚下一小团尘土（专属手绘黄土地扬尘 fx_death_dust 6 帧，缺图退回 fx_collapse_dust；约敌人宽度 0.8 倍）。首领、补给、墙体、我方单位（部曲 / 召唤物 / 名将）不走这套。
 *  手机降级：池更小、尘土隔一个出、同屏尘土封顶、尘土略小。
 *  A（无尘土）/ C（压扁薄片 + 精英墨晕）只保留给调试对比。
 */
export type DeathFxMode = 'a' | 'b' | 'c';
export const DEATH_FX = {
  capDesktop: 160, capLite: 80, flashMs: 60, fallMs: 180, fadeMs: 300, tiltRad: 1.22, backStep: 9, sink: 6,
  dustMs: 460, dustScale: .8, dustScaleLite: .65, dustCapDesktop: 120, dustCapLite: 28, warmDesktop: 100, warmLite: 30, warmPerFrame: 4, squashMs: 150, haloMs: 420,
} as const;
const DUST = 'fx_collapse_dust'; // 墨晕（C 调试）和尘土缺图时的兜底
/** 专属黄土地扬尘（死亡特效 B）；缺图退回 fx_collapse_dust。originY = 贴图里的地面线（占格高比例），scale = 显示尺寸倍率（专属图内容占格宽约 3/4）。 */
const DUST_SHEETS: Record<string, { originY: number; scale: number; alpha: number }> = { fx_death_dust: { originY: .8, scale: .95, alpha: .7 }, fx_collapse_dust: { originY: .62, scale: 1, alpha: .8 } };


interface Entry {
  img: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; dust?: Phaser.GameObjects.Image; halo?: Phaser.GameObjects.Image;
  active: boolean; start: number; x: number; y: number; dir: number; sx: number; sy: number; size: number; elite: boolean; dustOn: boolean; dustWanted: boolean; shadowA: number;
}

/** 当前模式：?deathfx=a|b|c 调试覆盖，缺省 B；?deathfx=off 调试关闭（返回 null）。 */
export function deathFxMode(): DeathFxMode | null {
  try { const v = new URLSearchParams(location.search).get('deathfx'); if (v === 'off') return null; return v === 'a' || v === 'c' ? v : 'b'; } catch { return 'b'; }
}

export class DeathFx {
  private readonly pool: Entry[] = []; private live = 0; private liveDust = 0; private cursor = 0; private skip = 0;
  private readonly lite = !IS_DESKTOP;
  /** 本场累计播放数。 */
  played = 0;
  /** 本场累计创建过的池条目数（对象池复用检查用）。 */
  created = 0;
  constructor(private scene: Phaser.Scene, readonly mode: DeathFxMode) {}

  get liveCount(): number { return this.live; }
  get poolSize(): number { return this.pool.length; }
  get dustCount(): number { return this.liveDust; }

  /** 池预热：战斗开始后每帧建几个条目（含阴影 / 尘土），避免第一次大清屏时一帧里创建几百个对象。 */
  private prewarm(): void {
    const target = this.lite ? DEATH_FX.warmLite : DEATH_FX.warmDesktop;
    for (let i = 0; i < DEATH_FX.warmPerFrame && this.pool.length < target; i++) {
      const e: Entry = { img: this.scene.add.image(0, 0, 'gem_small').setVisible(false).setName('death-fx'), shadow: this.scene.add.image(0, 0, 'shadow').setVisible(false).setName('death-fx-shadow'),
        active: false, start: 0, x: 0, y: 0, dir: 1, sx: 1, sy: 1, size: 40, elite: false, dustOn: false, dustWanted: false, shadowA: .5 };
      const dk = this.dustKey; if (this.mode === 'b' && dk) e.dust = this.scene.add.image(0, 0, dk, 0).setVisible(false).setName('death-fx-dust');
      this.pool.push(e); this.created++;
    }
  }

  /** 本场用的尘土图：专属图在就用专属图，否则兜底。 */
  get dustKey(): string | null { return this.scene.textures.exists('fx_death_dust') ? 'fx_death_dust' : this.scene.textures.exists(DUST) ? DUST : null; }

  private acquire(): Entry {
    for (let n = 0; n < this.pool.length; n++) { const e = this.pool[(this.cursor + n) % this.pool.length]; if (!e.active) { this.cursor = (this.cursor + n + 1) % this.pool.length; return e; } }
    if (this.pool.length < (this.lite ? DEATH_FX.capLite : DEATH_FX.capDesktop)) {
      const e: Entry = { img: this.scene.add.image(0, 0, 'gem_small').setVisible(false).setName('death-fx'),
        active: false, start: 0, x: 0, y: 0, dir: 1, sx: 1, sy: 1, size: 40, elite: false, dustOn: false, dustWanted: false, shadowA: .5 };
      this.pool.push(e); this.created++; return e;
    }
    const old = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.pool.length; this.release(old); return old; // 满了：回收最老的
  }

  private release(e: Entry): void {
    if (e.active) this.live--;
    if (e.dustWanted) this.liveDust--; // 尘土名额在播放时预留、释放时归还
    e.active = false; e.dustOn = false; e.dustWanted = false; e.img.setVisible(false); e.shadow?.setVisible(false); e.dust?.setVisible(false); e.halo?.setVisible(false);
  }

  /**
   * 敌人被击杀的一瞬间调用。fromX / fromY = 受击来源（弹道 / 近战攻击者，拿不到时用主将）位置，用来定倒向：来源 → 敌人。
   * 返回是否真的播了（关闭 / 首领 / 池满回收等情况返回 false 的只有前两种）。
   */
  play(enemy: Enemy, fromX: number, fromY: number, now: number): boolean {
    if (enemy.kind === 'boss' || !deathFxOn()) return false;
    const sp = enemy.sprite, e = this.acquire(), dx = sp.x - fromX;
    e.active = true; this.live++; this.played++;
    e.start = now; e.x = sp.x; e.y = sp.y; e.dir = dx === 0 ? (sp.flipX ? -1 : 1) : Math.sign(dx);
    e.sx = sp.scaleX; e.sy = sp.scaleY; e.size = Math.max(28, Math.abs(sp.displayWidth)); e.elite = enemy.kind === 'elite'; e.dustOn = false; e.dustWanted = this.mode === 'b' && this.wantDust(); if (e.dustWanted) this.liveDust++;
    e.img.setTexture(sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setScale(e.sx, e.sy).setFlipX(sp.flipX).setPosition(e.x, e.y).setRotation(0)
      .setAlpha(1).setDepth(sp.depth).setVisible(true).setTintFill(0xffffff);
    // 脚下阴影：和身体一起淡出（敌人自己的阴影在 deactivate 时已隐藏，这里用同一张手绘阴影图接着画）
    const sh = enemy.shadow;
    e.shadow ??= this.scene.add.image(0, 0, 'shadow').setName('death-fx-shadow');
    e.shadowA = sh.alpha || .5;
    e.shadow.setTexture(sh.texture.key, sh.frame.name).setDisplaySize(Math.abs(sh.displayWidth), Math.abs(sh.displayHeight)).setPosition(sh.x, sh.y).setOrigin(sh.originX, sh.originY)
      .setAlpha(e.shadowA).setDepth(sh.depth).setVisible(true);
    e.dust?.setVisible(false); e.halo?.setVisible(false);
    if (this.mode === 'c' && e.elite && this.scene.textures.exists(DUST)) {
      const s = e.size * 1.9; e.halo ??= this.scene.add.image(0, 0, DUST, 2).setName('death-fx-halo'); e.halo.setDisplaySize(s, s).setPosition(e.x, e.y - 2).setOrigin(.5, .62).setAlpha(.0).setTint(0x2a2118).setRotation(Math.random() * 6.28).setDepth(sp.depth - .2).setVisible(true);
    }
    return true;
  }

  /** 这一个要不要带尘土：手机隔一个出、同屏尘土封顶。 */
  private wantDust(): boolean {
    const cap = this.lite ? DEATH_FX.dustCapLite : DEATH_FX.dustCapDesktop;
    if (this.liveDust >= cap) return false;
    if (this.lite) { this.skip++; return this.skip % 2 === 0; }
    return true;
  }

  update(now: number): void {
    if (deathFxOn()) this.prewarm();
    if (!this.live) return;
    const D = DEATH_FX, dk = this.dustKey, frames = SKILL_FX[dk ?? DUST]?.frames ?? 6, sheet = DUST_SHEETS[dk ?? DUST];
    for (const e of this.pool) {
      if (!e.active) continue;
      const t = now - e.start;
      if (this.mode === 'c') {
        // 闪白 → 压成薄片、淡出
        if (t >= D.flashMs) e.img.clearTint();
        const k = Phaser.Math.Clamp((t - D.flashMs * .5) / D.squashMs, 0, 1), q = 1 - (1 - k) * (1 - k);
        e.img.setScale(e.sx * (1 + .35 * q), e.sy * (1 - .88 * q));
        const a = 1 - Phaser.Math.Clamp((t - D.flashMs) / (D.squashMs * 1.5), 0, 1); e.img.setAlpha(a); e.shadow?.setAlpha(e.shadowA * a);
        if (e.elite && e.halo) { const h = Phaser.Math.Clamp(t / D.haloMs, 0, 1); e.halo.setAlpha(h < .25 ? h / .25 * .28 : (1 - h) / .75 * .28); }
        if (t >= D.haloMs || (!e.elite && t >= D.flashMs + D.squashMs * 1.5)) this.release(e);
        continue;
      }
      // A / B：闪白 60ms → 后退 + 向受击反方向倾倒 70° → 0.3 秒淡出并略微下沉；阴影同步淡出
      if (t >= D.flashMs) e.img.clearTint();
      const f = Phaser.Math.Clamp((t - D.flashMs) / D.fallMs, 0, 1), ease = 1 - (1 - f) * (1 - f);
      const fade = Phaser.Math.Clamp((t - D.flashMs) / D.fadeMs, 0, 1);
      e.img.setRotation(e.dir * D.tiltRad * ease).setPosition(e.x + e.dir * D.backStep * ease, e.y + D.sink * fade).setAlpha(1 - fade);
      e.shadow?.setAlpha(e.shadowA * (1 - fade));
      if (this.mode === 'b' && dk) {
        if (!e.dustOn && e.dustWanted && t >= D.flashMs) {
          e.dustOn = true; const s = e.size * (this.lite ? D.dustScaleLite : D.dustScale) * sheet.scale; e.dust ??= this.scene.add.image(0, 0, dk, 0).setName('death-fx-dust');
          e.dust.setDisplaySize(s, s).setPosition(e.x + e.dir * D.backStep * .6, e.y + 2).setOrigin(.5, sheet.originY).setAlpha(sheet.alpha).setDepth(e.img.depth + .1).setVisible(true);
        }
        if (e.dustOn && e.dust) { const d = Phaser.Math.Clamp((t - D.flashMs) / D.dustMs, 0, 1); e.dust.setFrame(Math.min(frames - 1, Math.floor(d * frames))).setAlpha(sheet.alpha * (1 - d * d)); }
      }
      const dustEnd = e.dustOn ? D.flashMs + D.dustMs : 0;
      if (t >= D.flashMs + D.fadeMs && t >= dustEnd) this.release(e);
    }
  }
}
