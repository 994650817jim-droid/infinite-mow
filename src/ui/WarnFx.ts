import Phaser from 'phaser';
import { DEPTH } from '../config';

/**
 * 特效型警示（2026-11-16 用户：「不是说不然用圈，主要是太丑了，可以用特效代替警示，合适的特效」）。
 * 用像素序列帧代替程序画的圈和线：蓄力期间每帧调用 warn() 按进度换帧，落下时 impact() 播一段命中动画。
 * 没有图（素材未加载）时两个函数都返回 false，调用方退回原来的提示。
 *
 * 图集（public/assets/warn-fx/，tools/prepare-warn-fx.mjs 从洋红底原图切出）：
 *  lightning 256×256 · 3 行 × 6：乌云聚拢 / 地面符光 / 雷劈落地
 *  （地面圈在格子里的直径约占 73%（雷）/ 70%（吕布），显示时按此换算，让圈的外缘正好是命中范围）
 *  lubu      256×256 · 3 行 × 6：方天戟虚影压下 / 红色杀气火舌圈（循环）/ 落地冲击
 *  rift      1024×160 · 6 行 × 1：裂地重斩（横条，朝右）第 1–4 行蓄力、第 5–6 行炸开
 */
export type WarnKind = 'lightning' | 'lubu' | 'rift';
export const WARN_FX_FILES: Record<WarnKind, { key: string; file: string; w: number; h: number }> = {
  lightning: { key: 'warnfx_lightning', file: 'assets/warn-fx/lightning.png', w: 256, h: 256 },
  lubu: { key: 'warnfx_lubu', file: 'assets/warn-fx/lubu.png', w: 256, h: 256 },
  rift: { key: 'warnfx_rift', file: 'assets/warn-fx/rift.png', w: 1024, h: 160 },
};
/** 关闭特效警示（只看方案 C 的样子）：?warnfx=0。 */
export const WARN_FX_ON: boolean = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('warnfx') !== '0'; } catch { return true; } })();

interface Live { imgs: Phaser.GameObjects.Image[]; at: number; }
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const step6 = (p: number): number => Math.min(5, Math.floor(clamp01(p) * 6));

export class WarnFx {
  private live = new Map<string, Live>();
  constructor(private scene: Phaser.Scene) {
    scene.events.on('postupdate', this.sweep, this);
    scene.events.once('shutdown', () => { scene.events.off('postupdate', this.sweep, this); this.clear(); });
  }
  has(kind: WarnKind): boolean { return WARN_FX_ON && this.scene.textures.exists(WARN_FX_FILES[kind].key); }

  /** 蓄力中：progress 0~1，now 用战斗时钟。同一个 id 每帧调用一次；战斗时钟走了却没再调用的自动移除（暂停时时钟不走，图留着）。 */
  warn(id: string, kind: WarnKind, x: number, y: number, size: number, progress: number, now: number, angle = 0): boolean {
    if (!this.has(kind)) return false;
    const key = WARN_FX_FILES[kind].key, p = clamp01(progress);
    const e = this.get(id, kind === 'rift' ? 1 : 2, key, now);
    const [a, b] = e.imgs;
    if (kind === 'lightning') {
      // 天上乌云：在落点正上方聚拢，越来越浓；地上符光由暗变亮
      a.setFrame(step6(p)).setPosition(x, y - size * 1.25 - 30).setDisplaySize(size * 2.4, size * 2.4).setAlpha(.55 + .45 * p).setDepth(DEPTH.fx + 1);
      b.setFrame(6 + step6(p)).setPosition(x, y).setDisplaySize(size * 2.74, size * 2.74).setAlpha(.22 + .43 * p).setDepth(DEPTH.ground + 4);
    } else if (kind === 'lubu') {
      // 方天戟虚影从上方缓缓压下；地上一圈红色杀气火舌绕圈（循环），范围靠火舌外缘读出来
      a.setFrame(step6(p)).setPosition(x, y - size * .55 - 70 * (1 - p)).setDisplaySize(size * 1.5, size * 1.5).setAlpha(.35 + .5 * p).setDepth(DEPTH.fx + 1);
      b.setFrame(8 + Math.floor(now / 90) % 4).setPosition(x, y).setDisplaySize(size * 2.8, size * 2.8).setAlpha(.35 + .35 * p).setDepth(DEPTH.ground + 4);
    } else {
      // 裂地：沿刀路一条横条，碎石跳动、地缝透光，按进度换 4 帧
      a.setFrame(Math.min(3, Math.floor(p * 4))).setOrigin(0, .5).setPosition(x, y).setRotation(angle).setDisplaySize(size, size * .5).setAlpha(.6 + .4 * p).setTint(0xffc890).setDepth(DEPTH.ground + 4);
    }
    return true;
  }

  /** 只要地上那圈（吕布火场外缘等持续区域），循环播放。 */
  ring(id: string, kind: 'lubu', x: number, y: number, size: number, now: number, alpha = .5): boolean {
    if (!this.has(kind)) return false;
    const e = this.get(id, 1, WARN_FX_FILES[kind].key, now);
    e.imgs[0].setFrame(8 + Math.floor(now / 90) % 4).setPosition(x, y).setDisplaySize(size * 2.8, size * 2.8).setAlpha(alpha).setDepth(DEPTH.ground + 4);
    return true;
  }

  /** 落下瞬间：播一次命中序列帧（约 0.35 秒）后销毁。 */
  impact(kind: WarnKind, x: number, y: number, size: number, angle = 0): boolean {
    if (!this.has(kind)) return false;
    const key = WARN_FX_FILES[kind].key;
    const first = kind === 'rift' ? 4 : 12, count = kind === 'rift' ? 2 : 6;
    const img = this.scene.add.image(x, y, key, first).setDepth(kind === 'rift' ? DEPTH.ground + 5 : DEPTH.fx);
    if (kind === 'rift') img.setTint(0xffc890).setOrigin(0, .5).setRotation(angle).setDisplaySize(size, size * .5);
    else if (kind === 'lightning') img.setOrigin(.5, .88).setDisplaySize(size * 2.6, size * 2.6);
    else img.setDisplaySize(size * 2.4, size * 2.4);
    this.scene.tweens.addCounter({ from: 0, to: count - .01, duration: kind === 'rift' ? 360 : 340, onUpdate: t => img.setFrame(first + Math.floor(t.getValue() ?? 0)),
      onComplete: () => this.scene.tweens.add({ targets: img, alpha: 0, duration: 140, onComplete: () => img.destroy() }) });
    return true;
  }

  clear(): void { for (const e of this.live.values()) for (const i of e.imgs) i.destroy(); this.live.clear(); }

  private get(id: string, n: number, key: string, now: number): Live {
    let e = this.live.get(id);
    if (!e) { e = { imgs: Array.from({ length: n }, () => this.scene.add.image(0, 0, key, 0)), at: now }; this.live.set(id, e); }
    e.at = now; for (const i of e.imgs) i.setVisible(true);
    return e;
  }
  private sweep(): void {
    const now = (this.scene as unknown as { combatNow?: number }).combatNow ?? this.scene.time.now;
    for (const [id, e] of this.live) if (e.at < now - 1) { for (const i of e.imgs) i.destroy(); this.live.delete(id); }
  }
}

/** 每个场景一份。 */
export function warnFx(scene: Phaser.Scene): WarnFx {
  const host = scene as Phaser.Scene & { __warnFx?: WarnFx };
  if (!host.__warnFx) { host.__warnFx = new WarnFx(scene); scene.events.once('shutdown', () => { delete host.__warnFx; }); }
  return host.__warnFx;
}
