import Phaser from 'phaser';
import { HEADING_FONT } from '../config';
import { loadBagArt } from './ItemQuality';

/**
 * 「行囊」按钮做成手绘包袱（2026-11-19 用户「行囊做成行囊的样子」）：打结的布包袱图标 + 下方小字「行囊」，悬停换亮一档的包袱、略放大。
 * 只管外观：点击由调用方的命中区（hud-bag / camp-bag）负责，名字不变（测试、手柄、快捷键角标都认它）。
 * 素材 public/assets/bag/bundle.webp、bundle_hover.webp（缺图时不显示，调用方保留原来的漆牌）。
 */
export interface BagBundle { icon: Phaser.GameObjects.Image; caption: Phaser.GameObjects.Text; setHover: (on: boolean) => void; ready: () => boolean; }

export function bagBundle(scene: Phaser.Scene, x: number, y: number, size: number, o: { depth?: number; caption?: boolean; onReady?: () => void } = {}): BagBundle {
  const has = (): boolean => scene.textures.exists('bag_bundle');
  const icon = scene.add.image(x, y, has() ? 'bag_bundle' : '__DEFAULT') /* 占位用透明贴图：图还没载到时若被别处 setVisible(true)，原来是白方块（2026-11-21） */.setDisplaySize(size, size).setScrollFactor(0).setVisible(has()).setName('bag-bundle-icon');
  const caption = scene.add.text(x, y + size / 2 - 2, '行囊', { fontFamily: HEADING_FONT, fontSize: '12px', color: '#f6e2b8', resolution: 2 }).setOrigin(.5, 0).setStroke('#1a0f08', 3).setScrollFactor(0).setVisible(has() && o.caption !== false).setName('bag-bundle-caption');
  if (o.depth !== undefined) { icon.setDepth(o.depth); caption.setDepth(o.depth); }
  let hover = false;
  const paint = (): void => {
    if (!has()) return;
    const key = hover && scene.textures.exists('bag_bundle_hover') ? 'bag_bundle_hover' : 'bag_bundle', k = hover ? 1.08 : 1;
    icon.setTexture(key).setDisplaySize(size * k, size * k).setVisible(true); caption.setVisible(o.caption !== false).setColor(hover ? '#fff3d6' : '#f6e2b8');
  };
  if (!has()) loadBagArt(scene, () => { if (icon.scene && has()) { paint(); o.onReady?.(); } });
  return { icon, caption, setHover: (on: boolean) => { hover = on; paint(); }, ready: has };
}
