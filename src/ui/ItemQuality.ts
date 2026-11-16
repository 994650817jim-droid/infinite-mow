import Phaser from 'phaser';
import { QUALITIES, SLOT_ORDER, itemSlot, relicDef, type ItemInstance, type ItemQuality, type ItemSlot } from '../data/items';

/**
 * 道具品质的统一表现：边框（白细线 → 绿单线 → 蓝双线 → 紫双线 + 四角菱饰 → 橙漆金描边 + 菱饰 + 外发光）
 * 与程序化图标（槽位剪影，素材到位前的过渡；见 public/assets/items/ASSET_REQUEST.md）。
 * 漆金风格沿用 ChapterVictoryNotice / HomePlaque。
 */
const GOLD = 0xc9a35e, GOLD_HI = 0xf3d48a, LACQUER = 0x1b120b;

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillTriangle(x - r, y, x, y - r, x + r, y).fillTriangle(x - r, y, x, y + r, x + r, y);
}

/** 画一个品质格（左上角 x, y）。hover / selected 时描边提亮。 */
export function drawQualityFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, q: ItemQuality | null, o: { hover?: boolean; selected?: boolean } = {}): void {
  const r = Math.min(8, w * .12);
  if (!q) { // 空槽
    g.fillStyle(LACQUER, .75).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(1, 0x6b5a40, o.hover ? .9 : .55).strokeRoundedRect(x + .5, y + .5, w - 1, h - 1, r);
    return;
  }
  const d = QUALITIES[q], hi = o.hover || o.selected;
  if (q === 'orange') { g.fillStyle(d.color, hi ? .32 : .2).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, r + 3); }
  g.fillStyle(LACQUER, .96).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(d.dark, .95).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, r - 1);
  g.fillStyle(d.color, .14).fillRoundedRect(x + 2, y + 2, w - 4, (h - 4) * .45, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
  const line = (inset: number, width: number, color: number, alpha: number) => g.lineStyle(width, color, alpha).strokeRoundedRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(2, r - inset * .6));
  if (q === 'white') line(1, 1, d.color, hi ? .95 : .6);
  else if (q === 'green') line(1, 1.5, d.color, hi ? 1 : .85);
  else if (q === 'blue') { line(1, 1.5, d.color, hi ? 1 : .9); line(4, 1, d.color, .45); }
  else if (q === 'purple') { line(1, 2, d.color, hi ? 1 : .9); line(4.5, 1, d.color, .5); }
  else { line(1, 2, hi ? GOLD_HI : GOLD, 1); line(4.5, 1, d.color, .85); }
  if (q === 'purple' || q === 'orange') {
    g.fillStyle(q === 'orange' ? (hi ? GOLD_HI : GOLD) : d.color, 1);
    for (const [px, py] of [[x + 1, y + 1], [x + w - 1, y + 1], [x + 1, y + h - 1], [x + w - 1, y + h - 1]]) diamond(g, px, py, 3.5);
  }
  if (o.selected) g.lineStyle(2, 0xfff1c4, .95).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
}

/** 程序化剪影的键：4 个兵装槽 + 马厩坐骑。 */
export type IconSlot = ItemSlot | 'mount';
export const itemIconKey = (slot: IconSlot) => 'item_icon_' + slot;
/** 正式图标图集（BootScene 加载 public/assets/items/item-icons.webp + .json，帧名 = 道具 id）。 */
export const ITEM_ATLAS = 'item_icons';

/** 道具图标贴图：有正式图标用图集帧，缺图回退到程序化槽位剪影。 */
export function itemIcon(scene: Phaser.Scene, item: ItemInstance): { key: string; frame?: string; art: boolean } {
  const t = scene.textures.exists(ITEM_ATLAS) ? scene.textures.get(ITEM_ATLAS) : null;
  if (t?.has(item.base)) return { key: ITEM_ATLAS, frame: item.base, art: true };
  return { key: itemIconKey(itemSlot(item)), art: false };
}
/** 马厩里一匹马的图标：图集里有同名帧（马的 id 沿用旧坐骑道具 id）就用，缺图回退马首剪影。 */
export function horseIcon(scene: Phaser.Scene, id: string): { key: string; frame?: string; art: boolean } {
  const t = scene.textures.exists(ITEM_ATLAS) ? scene.textures.get(ITEM_ATLAS) : null;
  if (t?.has(id)) return { key: ITEM_ATLAS, frame: id, art: true };
  return { key: itemIconKey('mount'), art: false };
}

/** 程序化图标：每个槽位一张 64×64 剪影（暖白描墨），以及战场宝箱 item_chest（正式宝箱图已加载时不生成）。场景首次用到时生成。 */
export function ensureItemTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(itemIconKey('mount'))) return;
  const ink = 0x1c140c, light = 0xf1e4c4, mid = 0xc8b48a;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const draw = (slot: IconSlot) => {
    g.clear(); g.lineStyle(3, ink, 1); g.fillStyle(light, 1);
    if (slot === 'armor') { // 札甲
      const pts = [{ x: 14, y: 12 }, { x: 26, y: 8 }, { x: 32, y: 14 }, { x: 38, y: 8 }, { x: 50, y: 12 }, { x: 52, y: 54 }, { x: 12, y: 54 }];
      g.fillPoints(pts, true); g.strokePoints(pts, true);
      g.lineStyle(1.5, ink, .7); for (let yy = 22; yy < 54; yy += 8) g.lineBetween(14, yy, 50, yy); for (let xx = 20; xx < 50; xx += 8) g.lineBetween(xx, 20, xx, 54);
    } else if (slot === 'helm') { // 兜鍪 + 缨
      g.fillPoints([{ x: 12, y: 46 }, { x: 14, y: 26 }, { x: 32, y: 14 }, { x: 50, y: 26 }, { x: 52, y: 46 }], true); g.strokePoints([{ x: 12, y: 46 }, { x: 14, y: 26 }, { x: 32, y: 14 }, { x: 50, y: 26 }, { x: 52, y: 46 }], true);
      g.fillStyle(mid, 1).fillRect(10, 44, 44, 8).strokeRect(10, 44, 44, 8);
      g.fillStyle(0xb8402e, 1).fillTriangle(30, 16, 34, 16, 32, 2); g.lineStyle(2, ink, 1).strokeTriangle(30, 16, 34, 16, 32, 2);
    } else if (slot === 'boots') { // 战靴
      const pts = [{ x: 20, y: 8 }, { x: 36, y: 8 }, { x: 36, y: 38 }, { x: 54, y: 44 }, { x: 54, y: 54 }, { x: 14, y: 54 }, { x: 18, y: 38 }];
      g.fillPoints(pts, true); g.strokePoints(pts, true); g.fillStyle(mid, 1).fillRect(18, 8, 20, 7).strokeRect(18, 8, 20, 7);
    } else if (slot === 'mount') { // 马首
      const pts = [{ x: 18, y: 56 }, { x: 22, y: 30 }, { x: 30, y: 14 }, { x: 34, y: 6 }, { x: 38, y: 14 }, { x: 52, y: 30 }, { x: 54, y: 40 }, { x: 46, y: 42 }, { x: 36, y: 34 }, { x: 34, y: 56 }];
      g.fillPoints(pts, true); g.strokePoints(pts, true); g.fillStyle(ink, 1).fillCircle(38, 24, 2.5);
      g.lineStyle(4, 0x4a3018, 1).lineBetween(24, 28, 28, 52);
    } else { // 信物：玉璧 + 系绳
      g.fillStyle(0x9fd3b0, 1).fillCircle(32, 36, 20); g.strokeCircle(32, 36, 20); g.fillStyle(LACQUER, 1).fillCircle(32, 36, 7); g.strokeCircle(32, 36, 7);
      g.lineStyle(3, 0xb8402e, 1).lineBetween(32, 16, 32, 4);
    }
    g.generateTexture(itemIconKey(slot), 64, 64);
  };
  for (const slot of [...SLOT_ORDER, 'mount'] as const) draw(slot);
  // 宝箱：漆木 + 铜包角
  if (scene.textures.exists('item_chest')) { g.destroy(); return; }
  g.clear(); g.fillStyle(0x6a3a1c, 1).fillRoundedRect(4, 14, 56, 34, 4); g.fillStyle(0x8a4d24, 1).fillRoundedRect(4, 6, 56, 14, { tl: 8, tr: 8, bl: 0, br: 0 });
  g.lineStyle(3, LACQUER, 1).strokeRoundedRect(4, 6, 56, 42, 5); g.fillStyle(GOLD, 1).fillRect(28, 16, 8, 12); g.fillRect(4, 18, 56, 3);
  for (const [px, py] of [[8, 10], [56, 10], [8, 44], [56, 44]]) g.fillCircle(px, py, 3);
  g.generateTexture('item_chest', 64, 52);
  g.destroy();
}

/** 道具小图块（品质框 + 图标 + 名器星），返回容器；size 为边长。 */
export function itemTile(scene: Phaser.Scene, x: number, y: number, size: number, item: ItemInstance | null, slotHint?: IconSlot, o: { hover?: boolean; selected?: boolean } = {}): Phaser.GameObjects.Container {
  ensureItemTextures(scene);
  const c = scene.add.container(x, y), g = scene.add.graphics();
  drawQualityFrame(g, -size / 2, -size / 2, size, size, item?.quality ?? null, o); c.add(g);
  const slot = item ? itemSlot(item) : slotHint;
  if (item) { const ic = itemIcon(scene, item), k = ic.art ? .84 : .72; c.add(scene.add.image(0, 0, ic.key, ic.frame).setDisplaySize(size * k, size * k).setName('item-icon').setData('art', ic.art)); }
  else if (slot) c.add(scene.add.image(0, 0, itemIconKey(slot)).setDisplaySize(size * .72, size * .72).setAlpha(.22));
  // 首领遗珍：右下角「珍」字
  if (item && relicDef(item.base)) c.add(scene.add.text(size / 2 - 3, size / 2 - 3, '珍', { fontFamily: 'serif', fontSize: Math.max(10, Math.round(size * .2)) + 'px', color: '#2a1606', backgroundColor: '#f3c66acc', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0).setName('item-relic-badge'));
  if (item?.special) c.add(scene.add.text(size / 2 - 4, -size / 2 + 2, '★', { fontFamily: 'serif', fontSize: Math.round(size * .26) + 'px', color: '#ffd27a', resolution: 2 }).setOrigin(1, 0));
  return c;
}
