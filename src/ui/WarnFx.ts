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
 *  通用（铺开到所有首领 / 敌人，见 Telegraph.groundCracks / laneCracks）：
 *  charge    1024×160 · 6 行 × 1：冲锋道（尘土 + 马蹄印，朝右）第 1–4 行蓄力、第 5 行冲过、第 6 行余尘
 *  sweep     256×340  · 3 行 × 6（等分格）：扇形圆心、半径见 SWEEP_CX / SWEEP_R；刀气蓄势 / 斩下 / 碎石尘土
 *  fire / arrows / slam 256×256 · 3 行 × 6：俯视正圆 将燃·箭影·地动（蓄力）/ 窜火·箭落·炸开 / 余火·余尘
 */
export type WarnKind = 'lightning' | 'lubu' | 'rift' | ShapeKind;
export type ShapeKind = 'charge' | 'sweep' | 'fire' | 'arrows' | 'slam';
/**
 * 手绘版（用户 2026-11-16「整套换手绘」）：public/assets/warn-fx/handpainted/，版式同像素版，ChatGPT 洋红底原图 → tools/prepare-warn-fx-handpainted.sh。
 * 默认用手绘；?warnfx=pixel 回到像素版（对比用）。某张手绘图载入失败时该种类自动退回像素版（loadWarnFx）。
 */
export const WARN_FX_HP: boolean = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('warnfx') !== 'pixel'; } catch { return true; } })();
export const WARN_FX_FILES: Record<WarnKind, { key: string; file: string; pixel: string; w: number; h: number }> = {
  lightning: { key: 'warnfx_lightning', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'lightning.png', pixel: 'assets/warn-fx/lightning.png', w: 256, h: 256 },
  lubu: { key: 'warnfx_lubu', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'lubu.png', pixel: 'assets/warn-fx/lubu.png', w: 256, h: 256 },
  rift: { key: 'warnfx_rift', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'rift.png', pixel: 'assets/warn-fx/rift.png', w: 1024, h: 160 },
  charge: { key: 'warnfx_charge', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'charge.png', pixel: 'assets/warn-fx/charge.png', w: 1024, h: 160 },
  sweep: { key: 'warnfx_sweep', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'sweep.png', pixel: 'assets/warn-fx/sweep.png', w: 256, h: 340 },
  fire: { key: 'warnfx_fire', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'fire.png', pixel: 'assets/warn-fx/fire.png', w: 256, h: 256 },
  arrows: { key: 'warnfx_arrows', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'arrows.png', pixel: 'assets/warn-fx/arrows.png', w: 256, h: 256 },
  slam: { key: 'warnfx_slam', file: (WARN_FX_HP ? 'assets/warn-fx/handpainted/' : 'assets/warn-fx/') + 'slam.png', pixel: 'assets/warn-fx/slam.png', w: 256, h: 256 },
};
/** 圆形图里那圈在格子中的直径占比（按实际切出的图量，tools 里量），显示时按此换算让外缘 = 命中范围。 */
const RING_FRAC_PX: Partial<Record<WarnKind, number>> = { fire: .78, arrows: .78, slam: .72 };
/** 手绘版（tools/measure-fx-cells.mjs 量）：圈小一圈，而且画成透视椭圆、圈心偏下（格高 .57~.6）。 */
const RING_FRAC_HP: Partial<Record<WarnKind, number>> = { fire: .64, arrows: .55, slam: .64 };
const RING_OY_HP: Partial<Record<WarnKind, number>> = { fire: .6, arrows: .58, slam: .57, lightning: .6, lubu: .45 };
/** 这一种是否真的用上了手绘图（手绘图载入失败退回像素版时为 false）。 */
const fellBack = new Set<WarnKind>();
const isHp = (k: WarnKind): boolean => WARN_FX_HP && !fellBack.has(k);
const ringFrac = (k: WarnKind): number => (isHp(k) ? RING_FRAC_HP[k] : RING_FRAC_PX[k]) ?? .72;
const ringOy = (k: WarnKind): number => (isHp(k) ? RING_OY_HP[k] : undefined) ?? .5;
/** 天雷符环 / 吕布杀气圈：手绘圈比像素版小，显示时放大。 */
const groundRingMul = (k: 'lightning' | 'lubu'): number => isHp(k) ? (k === 'lightning' ? 1.1 : 1.2) : 1;

/** 载入特效图：手绘图载入失败的种类改载像素版（BootScene 调用）。 */
export function loadWarnFx(load: Phaser.Loader.LoaderPlugin): void {
  const byKey = new Map((Object.entries(WARN_FX_FILES) as [WarnKind, typeof WARN_FX_FILES[WarnKind]][]).map(([k, f]) => [f.key, k]));
  if (WARN_FX_HP) load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    const k = byKey.get(file.key); if (!k || fellBack.has(k)) return;
    fellBack.add(k); const f = WARN_FX_FILES[k]; load.spritesheet(f.key, f.pixel, { frameWidth: f.w, frameHeight: f.h });
  });
  for (const f of Object.values(WARN_FX_FILES)) load.spritesheet(f.key, f.file, { frameWidth: f.w, frameHeight: f.h });
}
/** 横扫图（等分格切出）：扇形圆心在格宽 28.5% 处、垂直居中，半径约 0.59 格宽（按实际图量）。 */
const SWEEP_CX = .285, SWEEP_R_PX = .59, SWEEP_R_HP = .62;
const sweepR = (): number => isHp('sweep') ? SWEEP_R_HP : SWEEP_R_PX;
/** 长条图里内容在格子中的高度占比：显示高度 = 宽度 / 占比。 */
const LANE_FRAC: Partial<Record<WarnKind, number>> = { charge: .57, rift: .5 };
/** 裂地横条的显示高度（占长度）：手绘版内容更高，压低一点。 */
const riftH = (): number => isHp('rift') ? .44 : .5;
/** 关闭特效警示（只看方案 C 的样子）：?warnfx=0。 */
export const WARN_FX_ON: boolean = (() => { try { return new URLSearchParams(globalThis.location?.search ?? '').get('warnfx') !== '0'; } catch { return true; } })();

interface Live { imgs: Phaser.GameObjects.Image[]; at: number; }
/**
 * 友军（降将专属招式，2026-11-18）：调用方传 tint（任意值）即按友军显示——手绘帧暖橙 / 米色，乘色只会变灰褐，
 * 所以用色相旋转（preFX ColorMatrix，转约 170°）把同一套手绘笔触转成天青色，一眼看出是自己人的招；不支持 FX（Canvas 渲染）时退回乘色。
 */
export const ALLY_HUE = 170;
function allyLook(img: Phaser.GameObjects.Image, ally: boolean, fallbackTint: number): void {
  if (!ally) return;
  const fx = (img as unknown as { preFX?: Phaser.GameObjects.Components.FX }).preFX;
  if (fx) { if (!img.getData('allyHue')) { fx.addColorMatrix().hue(ALLY_HUE); img.setData('allyHue', 1); } img.setTint(0xffffff); } else img.setTint(fallbackTint);
}
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
  warn(id: string, kind: WarnKind, x: number, y: number, size: number, progress: number, now: number, angle = 0, tint?: number): boolean {
    if (!this.has(kind)) return false;
    const key = WARN_FX_FILES[kind].key, p = clamp01(progress);
    const e = this.get(id, kind === 'rift' ? 1 : 2, key, now);
    const [a, b] = e.imgs;
    if (kind === 'lightning') {
      // 天上乌云：在落点正上方聚拢，越来越浓；地上符光由暗变亮
      a.setFrame(step6(p)).setPosition(x, y - size * 1.25 - 30).setDisplaySize(size * 2.4, size * 2.4).setAlpha(.55 + .45 * p).setDepth(DEPTH.fx + 1);
      b.setFrame(6 + step6(p)).setOrigin(.5, ringOy('lightning')).setPosition(x, y).setDisplaySize(size * 2.74 * groundRingMul('lightning'), size * 2.74 * groundRingMul('lightning')).setAlpha(.22 + .43 * p).setDepth(DEPTH.ground + 4);
    } else if (kind === 'lubu') {
      // 方天戟虚影从上方缓缓压下；地上一圈红色杀气火舌绕圈（循环），范围靠火舌外缘读出来
      a.setFrame(step6(p)).setPosition(x, y - size * .55 - 70 * (1 - p)).setDisplaySize(size * 1.5, size * 1.5).setAlpha(.35 + .5 * p).setDepth(DEPTH.fx + 1);
      b.setFrame(8 + Math.floor(now / 90) % 4).setOrigin(.5, ringOy('lubu')).setPosition(x, y).setDisplaySize(size * 2.8 * groundRingMul('lubu'), size * 2.8 * groundRingMul('lubu')).setAlpha(.35 + .35 * p).setDepth(DEPTH.ground + 4);
    } else {
      // 裂地：沿刀路一条横条，碎石跳动、地缝透光，按进度换 4 帧
      a.setFrame(Math.min(3, Math.floor(p * 4))).setOrigin(0, .5).setPosition(x, y).setRotation(angle).setDisplaySize(size, size * riftH()).setAlpha(.6 + .4 * p).setTint(0xffc890).setDepth(DEPTH.ground + 4); allyLook(a, tint !== undefined, tint ?? 0xffc890);
    }
    return true;
  }

  /** 只要地上那圈（吕布火场外缘等持续区域），循环播放。 */
  ring(id: string, kind: 'lubu', x: number, y: number, size: number, now: number, alpha = .5): boolean {
    if (!this.has(kind)) return false;
    const e = this.get(id, 1, WARN_FX_FILES[kind].key, now);
    e.imgs[0].setFrame(8 + Math.floor(now / 90) % 4).setOrigin(.5, ringOy('lubu')).setPosition(x, y).setDisplaySize(size * 2.8 * groundRingMul('lubu'), size * 2.8 * groundRingMul('lubu')).setAlpha(alpha).setDepth(DEPTH.ground + 4);
    return true;
  }

  /** 落下瞬间：播一次命中序列帧（约 0.35 秒）后销毁。 */
  impact(kind: WarnKind, x: number, y: number, size: number, angle = 0, tint?: number): boolean {
    if (!this.has(kind)) return false;
    const key = WARN_FX_FILES[kind].key;
    const first = kind === 'rift' ? 4 : 12, count = kind === 'rift' ? 2 : 6;
    const img = this.scene.add.image(x, y, key, first).setDepth(kind === 'rift' ? DEPTH.ground + 5 : DEPTH.fx);
    if (kind === 'rift') { img.setTint(0xffc890); allyLook(img, tint !== undefined, tint ?? 0xffc890); img.setOrigin(0, .5).setRotation(angle).setDisplaySize(size, size * riftH()); }
    else if (kind === 'lightning') img.setOrigin(.5, isHp('lightning') ? .7 : .88).setDisplaySize(size * 2.6, size * 2.6); // 手绘雷落地点在格高 .7
    else img.setOrigin(.5, ringOy(kind)).setDisplaySize(size * 1.9, size * 1.9).setAlpha(.85); // 吕布落地冲击：缩小，别盖过吕布本人
    this.scene.tweens.addCounter({ from: 0, to: count - .01, duration: kind === 'rift' ? 360 : 340, onUpdate: t => img.setFrame(first + Math.floor(t.getValue() ?? 0)),
      onComplete: () => this.scene.tweens.add({ targets: img, alpha: 0, duration: 140, onComplete: () => img.destroy() }) });
    return true;
  }

  // ---------- 通用形状（圆 / 环、长条、扇形），供 Telegraph.groundCracks / laneCracks 统一调用 ----------
  private impacted = new Map<string, number>();

  /** 圆 / 环形落点蓄力：第 1 行按进度换帧，外缘 = r。 */
  /** tint：友军（降将专属招式）预警染淡青，与敌人的预警分开。 */
  circle(id: string, kind: 'fire' | 'arrows' | 'slam', x: number, y: number, r: number, progress: number, now: number, tint?: number): boolean {
    if (!this.has(kind)) return false;
    const p = clamp01(progress), d = r * 2 / ringFrac(kind);
    this.get(id, 1, WARN_FX_FILES[kind].key, now).imgs[0].setFrame(step6(p)).setOrigin(.5, ringOy(kind)).setRotation(0).setPosition(x, y).setDisplaySize(d, d).setAlpha(.3 + .4 * p).setDepth(DEPTH.ground + 4);
    allyLook(this.live.get(id)!.imgs[0], tint !== undefined, tint ?? 0xffffff);
    return true;
  }
  /** 长条（冲锋道）蓄力：从 (x,y) 沿 angle 伸出 length，宽 width。 */
  lane(id: string, kind: 'charge', x: number, y: number, angle: number, length: number, width: number, progress: number, now: number, tint?: number): boolean {
    if (!this.has(kind)) return false;
    const p = clamp01(progress);
    this.get(id, 1, WARN_FX_FILES[kind].key, now).imgs[0].setFrame(Math.min(3, Math.floor(p * 4))).setOrigin(0, .5).setPosition(x, y).setRotation(angle).setDisplaySize(length, width / (LANE_FRAC[kind] ?? .5)).setAlpha(.7 + .3 * p).setDepth(DEPTH.ground + 4);
    allyLook(this.live.get(id)!.imgs[0], tint !== undefined, tint ?? 0xffffff);
    return true;
  }
  /** 扇形（横扫）蓄力：圆心 (x,y)、半径 r、朝 angle。图里扇形张开约 140°，不随 arc 变形。 */
  sector(id: string, x: number, y: number, r: number, angle: number, progress: number, now: number, tint?: number): boolean {
    if (!this.has('sweep')) return false;
    const p = clamp01(progress), w = r / sweepR(), f = WARN_FX_FILES.sweep;
    this.get(id, 1, f.key, now).imgs[0].setFrame(step6(p)).setOrigin(SWEEP_CX, .5).setPosition(x, y).setRotation(angle).setDisplaySize(w, w * f.h / f.w).setAlpha(.35 + .4 * p).setDepth(DEPTH.ground + 4);
    allyLook(this.live.get(id)!.imgs[0], tint !== undefined, tint ?? 0xffffff);
    return true;
  }
  /** 通用形状的落下：同一个 id 只播一次（调用方在命中窗口里每帧都会调）。 */
  /** opt：首领招牌招可按真实范围、更实地显示（scale 默认按收敛倍数，alpha 默认 0.6 / 长条 0.75，ms 为播放时长）。 */
  shapeImpact(id: string, kind: ShapeKind, x: number, y: number, size: number, angle: number, now: number, width = 0, opt: { scale?: number; alpha?: number; ms?: number; tint?: number } = {}): boolean {
    if (!this.has(kind)) return false;
    if ((this.impacted.get(id) ?? -1) > now) return true;
    this.impacted.set(id, now + 1500);
    if (this.impacted.size > 64) for (const [k, t] of this.impacted) if (t < now) this.impacted.delete(k);
    // 收敛（用户「首领的攻击特效也需要兼容适应」）：只播「炸开」那一行（不再接余尘行），圆形缩到 0.7 倍、0.35 秒、半透明，不抢首领本身的动作
    const f = WARN_FX_FILES[kind], lane = kind === 'charge', first = lane ? 4 : 6, count = lane ? 2 : 6;
    const img = this.scene.add.image(x, y, f.key, first).setDepth(lane ? DEPTH.ground + 5 : DEPTH.ground + 6).setAlpha(opt.alpha ?? (lane ? .75 : .6));
    allyLook(img, opt.tint !== undefined, opt.tint ?? 0xffffff);
    if (lane) img.setOrigin(0, .5).setRotation(angle).setDisplaySize(size, width / (LANE_FRAC[kind] ?? .5));
    else if (kind === 'sweep') { const w = size * (opt.scale ?? .75) / sweepR(); img.setOrigin(SWEEP_CX, .5).setRotation(angle).setDisplaySize(w, w * f.h / f.w); }
    else { const d = size * 2 * (opt.scale ?? .7) / ringFrac(kind); img.setOrigin(.5, ringOy(kind)).setDisplaySize(d, d); } // 原点与蓄力圈一致，落下不错位
    this.scene.tweens.addCounter({ from: 0, to: count - .01, duration: opt.ms ?? (lane ? 320 : 350), onUpdate: t => img.setFrame(first + Math.floor(t.getValue() ?? 0)),
      onComplete: () => this.scene.tweens.add({ targets: img, alpha: 0, duration: 140, onComplete: () => img.destroy() }) });
    return true;
  }

  // ---------- 徐荣（荥阳伏兵）：伏兵旗影、乱箭、疾影。只用项目里现成的手绘贴图（军旗、箭矢、骑兵本身），不画程序图形、不用像素特效
  // （用户 2026-11-16「不要再做像素特效了」；尘土等新特效等手绘序列帧图，见共享笔记 warn-fx-design.md 的需求清单） ----------
  hasXurong(): boolean { return WARN_FX_ON && this.scene.textures.exists('arrow') && this.scene.textures.exists('zhuge_banner'); }
  /** 伏兵起：一面暗色军旗剪影从草里竖起一闪后淡去（约 0.65 秒）。 */
  ambush(x: number, y: number, size: number): boolean {
    if (!this.hasXurong()) return false;
    const sc = this.scene;
    // 旗影：军旗染成深褐红剪影
    const flag = sc.add.image(x + size * .12, y + 4, 'zhuge_banner').setOrigin(.32, 1).setTintFill(0x3a1a14).setAlpha(0).setDepth(DEPTH.enemy + y / 10000);
    flag.setScale(size * 1.05 / flag.height); const fy = flag.scaleY; flag.setScale(flag.scaleX, fy * .15);
    sc.tweens.add({ targets: flag, alpha: .82, scaleY: fy, duration: 150, ease: 'Back.Out', onComplete: () => sc.tweens.add({ targets: flag, alpha: 0, duration: 380, delay: 120, onComplete: () => flag.destroy() }) });
    return true;
  }
  /** 乱箭斜落：一簇箭从左上斜着飞向落点 (x,y)，progress 0→1 时正好落到。 */
  volley(id: string, x: number, y: number, size: number, progress: number, now: number): boolean {
    if (!this.hasXurong()) return false;
    const p = clamp01(progress), dx = 300, dy = 340, ang = Math.atan2(dy, dx), e = this.get(id, 8, 'arrow', now, true);
    e.imgs.forEach((img, i) => { const ox = ((i * 37) % 7 - 3) * size * .22, oy = ((i * 53) % 5 - 2) * size * .22, lag = (i % 3) * .07, q = Math.min(1, p + lag);
      img.setPosition(x + ox - dx * (1 - q), y + oy - dy * (1 - q)).setRotation(ang).setDisplaySize(34, 9).setTint(0xb48a5e).setAlpha(q < .02 ? 0 : .95).setDepth(DEPTH.fx); }); // 箭杆压暗成木褐色，配徐荣偏暗的色调
    return true;
  }
  /** 疾影：骑兵身后三道渐隐的暗色残影（用骑兵当前帧），跟着骑兵每帧更新。 */
  streak(id: string, x: number, y: number, angle: number, now: number, src?: Phaser.GameObjects.Image): boolean {
    if (!this.hasXurong() || !src) return false;
    const c = Math.cos(angle), n = Math.sin(angle), e = this.get(id, 3, src.texture.key, now, true);
    e.imgs.forEach((img, i) => {
      const d = 22 * (i + 1); img.setTexture(src.texture.key, src.frame.name).setOrigin(src.originX, src.originY).setDisplaySize(src.displayWidth, src.displayHeight).setFlipX(src.flipX)
        .setPosition(x - c * d, y - n * d).setTintFill(0x2b2420).setAlpha(.42 - i * .12).setRotation(0).setDepth(DEPTH.enemy - .5);
    });
    return true;
  }

  /** 单个施法被打断或本体死亡，只回收对应预警。 */
  cancel(id:string):void {const e=this.live.get(id);if(e){for(const img of e.imgs)img.destroy();this.live.delete(id);}this.impacted.delete(id);}
  clear(): void { for (const e of this.live.values()) for (const i of e.imgs) i.destroy(); this.live.clear(); this.impacted.clear(); }

  private get(id: string, n: number, key: string, now: number, plain = false): Live {
    let e = this.live.get(id);
    if (!e) { e = { imgs: Array.from({ length: n }, () => plain ? this.scene.add.image(0, 0, key) : this.scene.add.image(0, 0, key, 0)), at: now }; this.live.set(id, e); }
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
