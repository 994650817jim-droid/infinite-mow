import Phaser from 'phaser';
import { DEPTH, IS_DESKTOP, actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';

/**
 * 敌人身上的状态标记（2026-11-19 用户「关于流派和道具特效做一下」）：灼烧 / 迟滞 / 眩晕 / 破甲 原来在敌人身上没有任何可见标记，玩家看不出谁被点燃 / 减速 / 破甲。
 * 手绘序列帧 fx_status（ChatGPT，黑底转透明；1536×1024，6 列 × 4 行，每格 256；行 0 灼烧火苗（套在身上）/ 行 1 迟滞墨印（脚下地面）/ 行 2 眩晕旋星（头顶）/ 行 3 破甲裂纹（套在身上），每行 6 帧循环）。
 * 池化 + 同屏上限（STATUS_FX.cap）：只给镜头里的敌人画，一个敌人同时多个状态最多各一个；手机（lite）不画；缺图什么都不画。
 */
// 2026-11-20「流派特效太小太快」：标记放大约 1.2 倍、动画 10 → 7 帧 / 秒、略透明（不糊成一片）、同屏上限 28 → 24。
// 2026-11-20 攻击特效检查：眩晕星环 .6 → .46、迟滞地环 .8 → .66（混战时每个兵都比本人还宽的一圈，糊成一片）
export const STATUS_FX = { key: 'fx_status', cap: 24, fps: 7, bodyFrac: .62, groundFrac: .55, stunFrac: .38, alpha: .75 } as const;
export type StatusKind = 'burn' | 'slow' | 'stun' | 'sunder';
const ROW: Record<StatusKind, number> = { burn: 0, slow: 1, stun: 2, sunder: 3 };
export interface StatusProbe { isBurning(e: Enemy, now: number): boolean; isSundered(e: Enemy, now: number): boolean }
interface Slot { img: Phaser.GameObjects.Image; kind: StatusKind; id: number; used: boolean }

export class StatusFx {
  private readonly slots: Slot[] = [];
  private readonly lite = !IS_DESKTOP;
  readonly stats = { drawn: 0, peak: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly probe: StatusProbe) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { for (const s of this.slots) s.img.destroy(); this.slots.length = 0; });
  }
  get ready(): boolean { return !this.lite && this.scene.textures.exists(STATUS_FX.key); }
  /** 当前画着的标记数（测试用）。 */
  get active(): number { let n = 0; for (const s of this.slots) if (s.img.visible) n++; return n; }

  private take(kind: StatusKind, id: number): Slot | null {
    let s = this.slots.find(x => x.kind === kind && x.id === id && !x.used);
    if (!s) s = this.slots.find(x => !x.img.visible && !x.used);
    if (!s) { if (this.slots.length >= STATUS_FX.cap) return null; s = { img: this.scene.add.image(0, 0, STATUS_FX.key, 0).setVisible(false).setName('status-fx'), kind, id, used: false }; this.slots.push(s); }
    s.kind = kind; s.id = id; s.used = true; return s;
  }

  update(now: number, enemies: readonly Enemy[]): void {
    for (const s of this.slots) s.used = false;
    if (!this.ready) { for (const s of this.slots) s.img.setVisible(false); return; }
    const view = this.scene.cameras.main.worldView, K = STATUS_FX, f = Math.floor(now / (1000 / K.fps)) % 6;
    let n = 0;
    for (const e of enemies) {
      if (!e.active || e.isSupplySlot || !view.contains(e.x, e.y)) continue;
      const sp = e.sprite, h = Math.abs(sp.displayHeight), w = Math.abs(sp.displayWidth), depth = actorDepth(e.y);
      const kinds: StatusKind[] = [];
      if (this.probe.isBurning(e, now)) kinds.push('burn');
      if (e.martialSlow < 1 && e.martialSlowUntil > now) kinds.push('slow');
      if (e.stunUntil > now) kinds.push('stun');
      if (this.probe.isSundered(e, now)) kinds.push('sunder');
      for (const k of kinds) {
        const s = this.take(k, e.spawnId); if (!s) break; n++;
        const img = s.img.setFrame(ROW[k] * 6 + f).setVisible(true).setAlpha(K.alpha);
        if (k === 'burn' || k === 'sunder') { const d = Math.max(h * 1.3, 40) / K.bodyFrac; img.setOrigin(.5, .62).setDisplaySize(d, d).setPosition(e.x, e.y - h * .12).setDepth(depth + .02); }
        else if (k === 'slow') { const d = Math.max(w * 1.5, 44) / K.groundFrac; img.setOrigin(.5, .5).setDisplaySize(d, d * .6).setPosition(e.x, e.y + 2).setDepth(DEPTH.ground + 3); }
        else { const d = Math.max(w * 1.2, 40) / K.stunFrac; img.setOrigin(.5, .5).setDisplaySize(d, d * .6).setPosition(e.x, e.y - h - 4).setDepth(depth + .03); }
      }
    }
    for (const s of this.slots) if (!s.used) s.img.setVisible(false);
    this.stats.drawn += n; this.stats.peak = Math.max(this.stats.peak, n);
  }
}
