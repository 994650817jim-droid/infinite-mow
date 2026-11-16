import Phaser from 'phaser';
import { FONT, HEADING_FONT, RENDER_SCALE } from '../config';

/**
 * 漆金描边体系的公共画法（与 ChapterVictoryNotice / HomePlaque 同一套配色）：
 * 深色漆底 + 双层描金线 + 四角菱饰；漆金按钮有 常态 / 悬停 / 按下 / 禁用 四态。
 * 只画表现，不持有逻辑；按钮的命中区与回调仍由调用方的原对象负责（保留原有 name 供测试与手柄导航）。
 */
export const LQ = { gold: 0xc9a35e, goldHi: 0xf3d48a, lacquer: 0x1b120b, lacquerHi: 0x3a2616, cinnabar: 0x9a2a1c, cream: '#eadcbd', title: '#f6dc9a' } as const;

export function lqDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillTriangle(x - r, y, x, y - r, x + r, y).fillTriangle(x - r, y, x, y + r, x + r, y);
}

/** 漆底面板（左上角坐标）。 */
export function lqPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, opts: { shadow?: boolean; alpha?: number; glow?: boolean } = {}): void {
  if (opts.shadow !== false) g.fillStyle(0x000000, .45).fillRoundedRect(x + 4, y + 6, w, h, 10);
  g.fillStyle(LQ.lacquer, opts.alpha ?? .98).fillRoundedRect(x, y, w, h, 10);
  if (opts.glow !== false) {
    const steps = 12;
    for (let i = 0; i < steps; i++) g.fillStyle(LQ.lacquerHi, .2 * (1 - i / steps)).fillRect(x + 6, y + 6 + (h * .35) * i / steps, w - 12, h * .35 / steps + 1);
  }
  g.lineStyle(2, LQ.gold, .95).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 8);
  g.lineStyle(1, LQ.gold, .45).strokeRoundedRect(x + 11, y + 11, w - 22, h - 22, 5);
  g.fillStyle(LQ.goldHi, 1);
  for (const [px, py] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) lqDiamond(g, px, py, 6);
  g.fillStyle(LQ.gold, 1);
  for (const [px, py] of [[x + 11, y + 11], [x + w - 11, y + 11], [x + 11, y + h - 11], [x + w - 11, y + h - 11]]) lqDiamond(g, px, py, 3);
}

/** 细线 + 中央菱饰的分隔线。 */
export function lqDivider(g: Phaser.GameObjects.Graphics, cx: number, y: number, half: number): void {
  g.lineStyle(1, LQ.gold, .7).lineBetween(cx - half, y, cx - 12, y).lineBetween(cx + 12, y, cx + half, y);
  g.fillStyle(LQ.goldHi, 1); lqDiamond(g, cx, y, 5);
  g.fillStyle(LQ.gold, .8); lqDiamond(g, cx - half, y, 2.5); lqDiamond(g, cx + half, y, 2.5);
}

export type LqState = 'idle' | 'hover' | 'down' | 'off' | 'on';
export type LqTone = 'gold' | 'quiet' | 'cinnabar';

/** 漆金按钮（中心坐标）。'on' 用于页签的选中态。 */
export function lqButton(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, state: LqState, tone: LqTone = 'gold'): number {
  lqButtonScaled(g, cx, cy, w, h, state, tone, 1);
  return state === 'down' ? 2 : 0;
}

export function lqLabelColor(state: LqState): string {
  return state === 'off' ? '#8a7c66' : state === 'idle' ? '#ffe9bd' : '#fff3d6';
}

/**
 * 给已有的可点击对象挂上漆金按钮外观：在其下方放一块 Graphics，随悬停 / 按下重绘。
 * target 必须已 setInteractive，以 target 的 x / y 为按钮中心；label 为按钮文字（原点 .5，可就是 target 本身，此时按下不下沉）。
 * 返回 repaint，可在外部改变尺寸 / 位置 / 可用状态后调用。
 */
export function lqSkin(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject & { x: number; y: number; visible: boolean }, label: Phaser.GameObjects.Text, size: () => { w: number; h: number }, opts: { tone?: LqTone; on?: () => boolean; enabled?: () => boolean } = {}): { gfx: Phaser.GameObjects.Graphics; repaint: (s?: LqState) => void } {
  const gfx = scene.add.graphics();
  let cur: LqState = 'idle';
  const repaint = (s?: LqState) => {
    if (s) cur = s;
    if (!target.active || !gfx.active) return; // 点击后面板整体重绘，旧按钮已销毁
    const enabled = opts.enabled ? opts.enabled() : true;
    const st: LqState = !enabled ? 'off' : opts.on?.() && cur === 'idle' ? 'on' : cur;
    const { w, h } = size();
    gfx.clear().setVisible(target.visible);
    const d = lqButton(gfx, target.x, target.y, w, h, st, opts.tone);
    label.setColor(lqLabelColor(st));
    if (label !== (target as unknown)) label.setPosition(target.x, target.y + d).setVisible(target.visible);
  };
  target.on('pointerover', () => repaint('hover')).on('pointerout', () => repaint('idle'))
    .on('pointerdown', () => repaint('down')).on('pointerup', () => repaint('hover'));
  repaint();
  return { gfx, repaint };
}

export function lqText(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string, heading = false): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 });
}

/**
 * 漆金按钮贴图（按尺寸 / 状态 / 色调缓存），按渲染倍率绘制以免高清屏发糊。
 * 用于需要「单个 Image 对象」的旧按钮（会被加进容器、改透明度、按名字查找），换贴图即可切状态。
 */
export function lqButtonTexture(scene: Phaser.Scene, w: number, h: number, state: LqState, tone: LqTone = 'gold'): string {
  const key = `lq-btn-${tone}-${state}-${Math.round(w)}x${Math.round(h)}`;
  if (scene.textures.exists(key)) return key;
  const k = Math.max(1, Math.min(3, RENDER_SCALE * 2)), pad = 6 * k;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 在放大坐标系里画：尺寸与线宽都乘 k
  const W = w * k, H = h * k;
  lqButtonScaled(g, pad + W / 2, pad + H / 2 - 2 * k, W, H, state, tone, k);
  g.generateTexture(key, W + pad * 2, H + pad * 2); g.destroy();
  return key;
}

function lqButtonScaled(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, state: LqState, tone: LqTone, k: number): void {
  const d = (state === 'down' ? 2 : 0) * k, hi = state === 'hover' || state === 'down' || state === 'on', off = state === 'off';
  const hs = h / k, r = Math.min(8, hs / 4) * k;
  const base = tone === 'cinnabar' ? [0x7a2216, 0x98301f, 0x5c1a10] : tone === 'quiet' ? [0x2e1f13, 0x45301c, 0x24170e] : [0x6e4a22, 0x8a5f2a, 0x5a3c1c];
  const fill = off ? 0x2a211a : state === 'down' ? base[2] : hi ? base[1] : base[0];
  g.fillStyle(0x000000, .4).fillRoundedRect(cx - w / 2 + 2 * k, cy - h / 2 + 4 * k, w, h, r);
  g.fillStyle(fill, 1).fillRoundedRect(cx - w / 2, cy - h / 2 + d, w, h, r);
  if (!off) g.fillStyle(0xffe2a0, state === 'down' ? .06 : hi ? .2 : .1).fillRoundedRect(cx - w / 2 + 3 * k, cy - h / 2 + d + 3 * k, w - 6 * k, h * .42, { tl: Math.max(1, r - 2 * k), tr: Math.max(1, r - 2 * k), bl: 0, br: 0 });
  const inset = (hs >= 36 ? 4 : 3) * k;
  g.lineStyle((hs >= 36 ? 1.5 : 1) * k, off ? 0x6a5a44 : hi ? LQ.goldHi : LQ.gold, off ? .6 : 1).strokeRoundedRect(cx - w / 2 + inset, cy - h / 2 + d + inset, w - inset * 2, h - inset * 2, Math.max(1, r - 3 * k));
  if (hs >= 30 && !off) { g.fillStyle(hi ? LQ.goldHi : LQ.gold, 1); const dr = (hs >= 44 ? 4 : 3) * k; lqDiamond(g, cx - w / 2 + inset, cy + d, dr); lqDiamond(g, cx + w / 2 - inset, cy + d, dr); }
}

/** 把一个 Image 变成漆金按钮：常态 / 悬停 / 按下切贴图，显示尺寸不变（贴图四周留了投影边）。 */
export function lqImageButton(scene: Phaser.Scene, image: Phaser.GameObjects.Image, w: number, h: number, tone: LqTone = 'gold', label?: Phaser.GameObjects.Text): void {
  const pad = 6;
  const set = (st: LqState) => {
    if (!image.active) return;
    image.setTexture(lqButtonTexture(scene, w, h, st, tone)).setDisplaySize(w + pad * 2, h + pad * 2);
    if (label?.active) label.setColor(lqLabelColor(st));
  };
  set('idle');
  // 已经 setInteractive 过的旧按钮：命中区按新贴图重设（各状态贴图同尺寸，之后不必再改）
  if (image.input) image.input.hitArea.setTo(0, 0, image.frame.realWidth, image.frame.realHeight);
  image.on('pointerover', () => set('hover')).on('pointerout', () => set('idle')).on('pointerdown', () => set('down')).on('pointerup', () => set('hover'));
}
