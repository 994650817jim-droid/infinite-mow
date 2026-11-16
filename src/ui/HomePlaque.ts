import Phaser from 'phaser';
import {HEADING_FONT,FONT} from '../config';

/**
 * 主页右上角的漆金小匾（成就 / 天下地图 / 主城）：深色漆底 + 内描金线 + 四角菱饰，左侧徽记（图标或朱印字），
 * 可带进度（数字 + 细进度条）。悬停描金变亮、微放大；点击区命名为 name（测试与手柄导航用）。
 * 右对齐：rightX 为匾的右边缘；返回宽度，便于从右往左依次排列。
 */
export interface PlaqueOptions { label: string; name: string; icon?: string; glyph?: string; progress?: [number, number]; onClick: () => void }
export function homePlaque(scene: Phaser.Scene, rightX: number, y: number, o: PlaqueOptions, desk: boolean): number {
  const h = desk ? 42 : 46, iconD = h - 12;
  const label = scene.add.text(0, 0, o.label, {fontFamily: HEADING_FONT, fontSize: (desk ? 17 : 18) + 'px', color: '#f2ddae', resolution: 2}).setOrigin(0, .5);
  const count = o.progress ? scene.add.text(0, 0, `${o.progress[0]}/${o.progress[1]}`, {fontFamily: FONT, fontSize: (desk ? 13 : 14) + 'px', color: '#e8c47a', resolution: 2}).setOrigin(0, .5) : null;
  const countW = count ? Math.max(count.width, 40) : 0;
  const w = 10 + iconD + 8 + label.width + (count ? 10 + countW : 0) + 14, x0 = rightX - w, top = y - h / 2;
  const c = scene.add.container(0, 0).setDepth(20).setName(o.name + '-plaque');
  const g = scene.add.graphics();
  const paint = (hover: boolean) => {
    g.clear();
    g.fillStyle(0x000000, .35).fillRoundedRect(x0 + 2, top + 3, w, h, 7);
    g.fillStyle(0x1b120b, .9).fillRoundedRect(x0, top, w, h, 7);
    g.fillStyle(0x3a2616, .55).fillRoundedRect(x0 + 2, top + 2, w - 4, h * .45, {tl: 6, tr: 6, bl: 0, br: 0});
    g.lineStyle(1.5, hover ? 0xf3d48a : 0xb8914f, hover ? 1 : .85).strokeRoundedRect(x0 + 3.5, top + 3.5, w - 7, h - 7, 5);
    // 四角菱饰
    g.fillStyle(hover ? 0xf3d48a : 0xc9a35e, 1);
    for (const [px, py] of [[x0 + 3.5, top + 3.5], [x0 + w - 3.5, top + 3.5], [x0 + 3.5, top + h - 3.5], [x0 + w - 3.5, top + h - 3.5]]) g.fillTriangle(px - 3, py, px, py - 3, px + 3, py).fillTriangle(px - 3, py, px, py + 3, px + 3, py);
  };
  paint(false); c.add(g);
  // 徽记
  const ix = x0 + 10 + iconD / 2;
  const ring = scene.add.circle(ix, y, iconD / 2, 0x2a1a0f, 1).setStrokeStyle(1.5, 0xc9a35e, .9); c.add(ring);
  if (o.icon && scene.textures.exists(o.icon)) { const img = scene.add.image(ix, y, o.icon); img.setScale((iconD - 4) / Math.max(img.width, img.height)); c.add(img); }
  else { ring.setFillStyle(0x8e2a1e, 1); c.add(scene.add.text(ix, y, o.glyph ?? o.label[0], {fontFamily: HEADING_FONT, fontSize: Math.round(iconD * .55) + 'px', color: '#f8e6c4', resolution: 2}).setOrigin(.5)); }
  label.setPosition(ix + iconD / 2 + 8, y + (count ? 0 : 0)); c.add(label);
  if (count && o.progress) {
    const cx = label.x + label.width + 10; count.setPosition(cx, y - 5); c.add(count);
    const bar = scene.add.graphics(), ratio = o.progress[1] ? Math.min(1, o.progress[0] / o.progress[1]) : 0;
    bar.fillStyle(0x3a2c1c, 1).fillRoundedRect(cx, y + 7, countW, 4, 2).fillStyle(0xe2b866, 1).fillRoundedRect(cx, y + 7, Math.max(ratio > 0 ? 4 : 0, countW * ratio), 4, 2); c.add(bar);
  }
  const hit = scene.add.rectangle(x0 + w / 2, y, w, h, 0xffffff, .001).setInteractive({useHandCursor: true}).setName(o.name);
  hit.on('pointerover', () => { paint(true); scene.tweens.add({targets: c, scale: 1.03, duration: 90}); c.setPosition(-(x0 + w / 2) * .03, -y * .03); })
    .on('pointerout', () => { paint(false); scene.tweens.killTweensOf(c); c.setScale(1).setPosition(0, 0); })
    .on('pointerdown', () => o.onClick());
  // 点击区放在场景顶层（getByName 与手柄导航都能直接找到），深度略高于小匾
  hit.setDepth(21);
  return w;
}
