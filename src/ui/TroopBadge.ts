import Phaser from 'phaser';
import { TROOPS, type TroopKind } from '../data/legion';
import { HEADING_FONT } from '../config';
import { badgePortraitKey, badgeHeadY } from '../systems/TroopPortraits';

/** 兵种定位色（与战地招募卡 ui/LegionUI.ts ROLE_TINT 一致）。 */
export const BADGE_TINT: Record<TroopKind, number> = {
  swordsman: 0x7a3b22, guardian: 0x6b4a22, halberdier: 0x7a2f2f, spearman: 0x2d4f6e,
  rider: 0x4d3a72, archer: 0x2f5a42, crossbowman: 0x3a5a2a, medic: 0x2f6466,
};
const GOLD = 0xd8b46a;

export interface BadgeOptions {
  /** 跟随屏幕（战斗场景里的休整面板用）。 */
  fixed?: boolean;
  /** 没有胸像时的过渡：行走图键（取「下」行第 0 帧半身裁切）。 */
  walkKey?: string; walkFrame?: string;
  /** 锁定：整体压暗。 */
  dim?: boolean;
  /** 遮罩用的世界坐标（父容器不在原点时传）；缺省等于 x, y。 */
  worldX?: number; worldY?: number;
}

/**
 * 兵种圆框胸像徽章（照战地招募卡 LegionUI.paintWaveCard）：暗底 + 定位色圆 + 描金双环，胸像头部对到圆心偏上，
 * 圆形遮罩；右下角兵种字印（刀 / 枪 / 弓 …）。胸像优先 Q 版（troop-portraits），缺图时用 v2 过渡胸像，再没有用行走帧半身。
 * 返回一个容器（销毁时一并清理遮罩）。
 */
export function troopBadge(scene: Phaser.Scene, kind: TroopKind, x: number, y: number, r: number, o: BadgeOptions = {}): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y).setName('troop-badge-' + kind);
  const sf = (obj: Phaser.GameObjects.Components.ScrollFactor) => { if (o.fixed) obj.setScrollFactor(0); };
  const tint = BADGE_TINT[kind], g = scene.add.graphics(); sf(g);
  g.fillStyle(0x0c0906, .6).fillCircle(0, 0, r).fillStyle(tint, .7).fillCircle(0, 0, r - 3)
    .fillStyle(0xffe2a0, .07).fillCircle(-r * .25, -r * .3, r * .6);
  root.add(g);
  const key = badgePortraitKey(scene, kind);
  let art: Phaser.GameObjects.Image | undefined;
  if (key) {
    art = scene.add.image(0, 0, key).setName('troop-badge-art');
    const s = (r * 2.3) / art.frame.width;
    art.setScale(s).setPosition(0, -r * .18 + (.5 - badgeHeadY(scene, kind)) * art.frame.height * s);
  } else if (o.walkKey && scene.textures.exists(o.walkKey)) {
    const t = scene.textures.get(o.walkKey);
    art = scene.add.image(0, 0, o.walkKey, o.walkFrame ?? (t.has('down_0') ? 'down_0' : undefined)).setName('troop-badge-art');
    const s = (r * 2 - 6) / (art.frame.height * .56);
    art.setScale(s).setPosition(0, (.5 - .37) * art.frame.height * s);
  }
  if (art) {
    sf(art);
    const m = scene.make.graphics({}, false); if (o.fixed) m.setScrollFactor(0);
    m.fillStyle(0xffffff).fillCircle(o.worldX ?? x, o.worldY ?? y, r - 3);
    art.setMask(m.createGeometryMask()); root.add(art);
    root.once('destroy', () => m.destroy());
  }
  const ring = scene.add.graphics(); sf(ring);
  ring.lineStyle(3, GOLD, .85).strokeCircle(0, 0, r).lineStyle(1, GOLD, .35).strokeCircle(0, 0, r + 4);
  root.add(ring);
  const fs = Math.max(13, Math.round(r * .33));
  const seal = scene.add.text(r * .72, r * .72, TROOPS[kind].mark, { fontFamily: HEADING_FONT, fontSize: fs + 'px', color: '#fbe7cc', resolution: 2 })
    .setOrigin(.5).setPadding(5, 3).setBackgroundColor(Phaser.Display.Color.IntegerToColor(tint).rgba).setName('troop-badge-seal');
  sf(seal);
  ring.lineStyle(1.5, GOLD, 1).strokeRect(seal.x - seal.width / 2 - 1, seal.y - seal.height / 2 - 1, seal.width + 2, seal.height + 2);
  root.add(seal);
  if (o.dim) { art?.setTint(0x5c5c5c); root.setAlpha(.75); }
  return root;
}
