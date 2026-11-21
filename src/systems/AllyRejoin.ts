import Phaser from 'phaser';
import { DEPTH } from '../config';
import { playSheet } from './SkillFxSheets';

/**
 * 我方单位兜底换位（2026-11-21 用户「为什么我感觉我自己的兵有时候在瞬移」）：部曲 / 名将随从跟不上、卡在墙后、入列超时时原来直接 setPosition。
 * 现在只在「换位前后两个位置都在镜头外」时直接换；否则 0.2 秒淡出 → 换位 → 落点一小团手绘尘土 → 0.2 秒淡入，让玩家看懂「掉队的兵赶上来了」。
 * stats.visibleInstant（玩家视野内凭空换位）按设计恒为 0；测试 / 回归断言它。
 */
export const REJOIN = { fadeMs: 200, pad: 40, dust: 'fx_collapse_dust', dustSize: 58 } as const;
export interface RejoinSprite { alpha: number; active: boolean; setAlpha(a: number): unknown }

export class AllyRejoin {
  readonly stats = { offscreen: 0, faded: 0, visibleInstant: 0 };
  private readonly busy = new WeakSet<object>();
  constructor(private readonly scene: Phaser.Scene) {}
  /** 镜头可见范围（外扩 pad）内。 */
  visible(x: number, y: number): boolean { const v = this.scene.cameras.main.worldView, P = REJOIN.pad; return x > v.left - P && x < v.right + P && y > v.top - P && y < v.bottom + P; }
  /**
   * 把 key（单位本体，用来防重复）从 from 换到 to：apply 真正改位置。sprite 为空（还没挂图）时视同镜头外。
   * 返回 true = 已安排（直接换或在淡出淡入中）。同一单位淡入淡出期间不再重复安排。
   */
  move(key: object, sprite: RejoinSprite | null | undefined, from: { x: number; y: number }, to: { x: number; y: number }, apply: () => void): boolean {
    if (this.busy.has(key)) return false;
    if (!sprite || (!this.visible(from.x, from.y) && !this.visible(to.x, to.y))) { apply(); this.stats.offscreen++; return true; }
    this.busy.add(key); this.stats.faded++;
    const s = this.scene, base = sprite.alpha || 1;
    s.tweens.add({ targets: sprite, alpha: 0, duration: REJOIN.fadeMs, onComplete: () => {
      if (!sprite.active) { this.busy.delete(key); return; }
      apply();
      if (s.textures.exists(REJOIN.dust)) playSheet(s, REJOIN.dust, to.x, to.y + 8, { size: REJOIN.dustSize, depth: DEPTH.ground + 4, ms: 420, alpha: .5 });
      s.tweens.add({ targets: sprite, alpha: base, duration: REJOIN.fadeMs, onComplete: () => this.busy.delete(key) });
    } });
    return true;
  }
}
