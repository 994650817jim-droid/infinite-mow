import Phaser from 'phaser';
import {FONT, HEADING_FONT} from '../config';
import {FACTIONS, factionStrength, type FactionId, type EraId} from './WorldCities';
import {BANNER_CHAR} from './WorldMapLayers';
import type {TerritoryLabel} from './WorldTerritory';

/** 天下地图界面件（漆底描金，与主页漆金小匾同系）：资源栏、势力排行条、疆域大字、详情旗印。仅表现。 */
const GOLD = 0xc9a35e, LACQUER = 0x1b120b;

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void { g.fillTriangle(x - r, y, x, y - r, x + r, y).fillTriangle(x - r, y, x, y + r, x + r, y); }

/** 漆底描金板（四角菱饰）。 */
export function lacquerPlate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = .9, accent: number = GOLD): void {
  g.fillStyle(0x000000, .3).fillRoundedRect(x + 2, y + 3, w, h, 6);
  g.fillStyle(LACQUER, alpha).fillRoundedRect(x, y, w, h, 6);
  g.fillStyle(0x3a2616, .4).fillRoundedRect(x + 2, y + 2, w - 4, h * .42, {tl: 5, tr: 5, bl: 0, br: 0});
  g.lineStyle(1.2, accent, .85).strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 4);
  g.fillStyle(accent, 1); for (const [px, py] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) diamond(g, px, py, 2.5);
}

/** 顶部资源栏：每项一个朱 / 金圆徽 + 名称 + 数值，横向排列；返回总宽。 */
export function resourceBar(scene: Phaser.Scene, x: number, y: number, items: Array<{glyph: string; label: string; value: string | number; tint: number}>, desk: boolean): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setName('world-resources'), h = desk ? 34 : 40, r = h / 2 - 6;
  const g = scene.add.graphics(); root.add(g);
  let cx = x + 10; const parts: Array<() => void> = [];
  for (const it of items) {
    const ix = cx + r, label = scene.add.text(ix + r + 8, y, it.label, {fontFamily: FONT, fontSize: (desk ? 13 : 14) + 'px', color: '#bfae88', resolution: 2}).setOrigin(0, .5);
    const value = scene.add.text(label.x + label.width + 6, y, String(it.value), {fontFamily: HEADING_FONT, fontSize: (desk ? 18 : 20) + 'px', color: '#f6dc9a', resolution: 2}).setOrigin(0, .5);
    const glyph = scene.add.text(ix, y, it.glyph, {fontFamily: HEADING_FONT, fontSize: Math.round(r * 1.15) + 'px', color: '#fbe7cc', resolution: 2}).setOrigin(.5);
    const tint = it.tint, at = ix;
    parts.push(() => g.fillStyle(tint, 1).fillCircle(at, y, r).lineStyle(1.5, GOLD, .95).strokeCircle(at, y, r));
    root.add([label, value, glyph]);
    cx = value.x + value.width + 18;
  }
  const w = cx - x - 8;
  lacquerPlate(g, x, y - h / 2, w, h, .88);
  for (const p of parts) p();
  root.setData('width', w);
  return root;
}

/** 势力排行条：按城池数排序的势力色块 + 名 + 城数（不含地方豪强），放在地图底边。 */
export function factionStrip(scene: Phaser.Scene, x: number, y: number, maxW: number, era: EraId, owned: readonly string[], desk: boolean): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0).setName('world-faction-strip'), size = desk ? 13 : 14;
  const counts = new Map<FactionId, number>(factionStrength(era, owned));
  if (owned.length) counts.set('player', owned.length);
  const rows = [...counts.entries()].filter(([f, n]) => f !== 'han' && n > 0).sort((a, b) => b[1] - a[1] || (a[0] === 'player' ? -1 : 1));
  const g = scene.add.graphics(); root.add(g);
  const head = scene.add.text(x + 12, y, '势力', {fontFamily: HEADING_FONT, fontSize: size + 1 + 'px', color: '#e8c47a', resolution: 2}).setOrigin(0, .5); root.add(head);
  let cx = head.x + head.width + 10; const h = desk ? 28 : 32, pills: Array<() => void> = [];
  for (const [f, n] of rows) {
    const t = scene.add.text(0, y, `${FACTIONS[f].name} ${n}`, {fontFamily: FONT, fontSize: size + 'px', color: f === 'player' ? '#d8f5dc' : '#f2e6c8', resolution: 2}).setOrigin(0, .5);
    const pw = 14 + t.width + 10; if (cx + pw > x + maxW - 8) { t.destroy(); break; }
    t.setX(cx + 14); root.add(t);
    const px = cx, color = FACTIONS[f].color, player = f === 'player';
    pills.push(() => { g.fillStyle(color, .9).fillRoundedRect(px + 2, y - 6, 8, 12, 2); if (player) g.lineStyle(1, 0xd8f5dc, .9).strokeRoundedRect(px - 2, y - h / 2 + 5, pw + 2, h - 10, 4); });
    cx += pw + 4;
  }
  lacquerPlate(g, x, y - h / 2, Math.min(maxW, cx - x + 6), h, .82);
  for (const p of pills) p();
  return root;
}

/** 疆域大字：势力名写在疆域上（随地图缩放），字距拉开、半透明，像史书地图的题字。 */
export function realmLabels(scene: Phaser.Scene, labels: readonly TerritoryLabel[]): Phaser.GameObjects.Text[] {
  return labels.filter(l => l.faction !== 'han').map(l => {
    const name = FACTIONS[l.faction].name.split('').join(' ');
    return scene.add.text(l.x, l.y, name, {fontFamily: HEADING_FONT, fontSize: Math.round(l.size) + 'px', color: FACTIONS[l.faction].css, resolution: 2})
      .setOrigin(.5).setAlpha(.62).setStroke('#120c06', Math.max(3, l.size * .09)).setShadow(0, 2, '#000000', 4, true, true).setName('realm-' + l.faction);
  });
}

/** 详情面板旗印：势力色方印 + 姓氏字（营寨 / 战役节点用「营」「战」「锁」）。 */
export function ownerSeal(scene: Phaser.Scene, x: number, y: number, size: number): {root: Phaser.GameObjects.Container; set: (color: number, glyph: string) => void} {
  const root = scene.add.container(x, y).setName('world-owner-seal'), g = scene.add.graphics();
  const t = scene.add.text(0, 0, '', {fontFamily: HEADING_FONT, fontSize: Math.round(size * .5) + 'px', color: '#fff6e0', align: 'center', resolution: 2}).setOrigin(.5).setStroke('#1a120a', 3);
  root.add([g, t]);
  const set = (color: number, glyph: string) => {
    g.clear().fillStyle(0x000000, .4).fillRoundedRect(-size / 2 + 2, -size / 2 + 3, size, size, 6)
      .fillStyle(color, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 6)
      .lineStyle(2, 0xf0d496, .9).strokeRoundedRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, 4);
    t.setText(glyph.length > 1 ? glyph.split('').join('\n') : glyph).setFontSize(Math.round(size * (glyph.length > 1 ? .3 : .5))).setLineSpacing(-4);
  };
  return {root, set};
}
export const sealGlyph = (f: FactionId) => BANNER_CHAR[f] ?? FACTIONS[f].name[0];
