import Phaser from 'phaser';
import { charmDef } from '../data/charms';
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
  // 四角镶宝石：绿 / 蓝两角小石，紫 / 橙四角（2026-11-17 行囊美术重设计；厚涂边框素材到位后换图）
  if (q !== 'white') {
    const corners = q === 'green' || q === 'blue' ? [[x + 1, y + 1], [x + w - 1, y + h - 1]] : [[x + 1, y + 1], [x + w - 1, y + 1], [x + 1, y + h - 1], [x + w - 1, y + h - 1]];
    const gem = q === 'orange' ? (hi ? GOLD_HI : GOLD) : d.color, r = q === 'green' || q === 'blue' ? 3 : 3.5;
    for (const [px, py] of corners) { g.fillStyle(0x000000, .5); diamond(g, px + .6, py + .8, r + .8); g.fillStyle(gem, 1); diamond(g, px, py, r); g.fillStyle(0xffffff, .55); diamond(g, px - r * .3, py - r * .3, r * .35); }
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
  const c = charmDef(item.base); if (c && scene.textures.exists(c.icon)) return { key: c.icon, art: true };
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

/** 行囊厚涂素材（美术风格会话 2026-11-17，public/assets/bag/README.md）：贴图键 = 'bag_' + 文件名。 */
export const BAG_ART = ['panel_bg', 'doll_paper', 'tray_bg', 'slot_frame', 'slot_frame_hover', 'slot_frame_selected', 'q_white', 'q_green', 'q_blue', 'q_purple', 'q_orange',
  'sil_helm', 'sil_armor', 'sil_boots', 'sil_token', 'sil_mount', 'sil_relic', 'slot_tag', 'lock_tag', 'medal_frame', 'medal_frame_selected', 'tab', 'tab_selected',
  'tab_icon_all', 'tab_icon_armor', 'tab_icon_helm', 'tab_icon_boots', 'tab_icon_token', 'tab_icon_relic', 'tooltip_card',
  // 2026-11-19 用户「行囊做成行囊的样子」：包袱按钮（常态 / 悬停）、摊开的包袱布（行囊格子铺在上面）、缝口袋格
  'bundle', 'cloth_open', 'pocket', 'pocket_slot', 'gem_green', 'gem_blue', 'gem_purple', 'gem_orange'] as const;
export const bagArt = (scene: Phaser.Scene, name: string): string | null => scene.textures.exists('bag_' + name) ? 'bag_' + name : null;
/** 按需加载行囊素材（只缺的才排队）；全部到位回调 onReady。返回是否已齐。 */
export function loadBagArt(scene: Phaser.Scene, onReady: () => void): boolean {
  const miss = BAG_ART.filter(n => !scene.textures.exists('bag_' + n));
  if (!miss.length) return true;
  for (const n of miss) scene.load.image('bag_' + n, 'assets/bag/' + n + '.webp');
  scene.load.once(Phaser.Loader.Events.COMPLETE, onReady); scene.load.start();
  return false;
}
/** 厚涂格子：槽框（空格 / 选中）+ 品质边框（四角宝石已含）；素材没加载时返回 false。 */
export function drawQualityArt(scene: Phaser.Scene, c: Phaser.GameObjects.Container, size: number, q: ItemQuality | null, o: { selected?: boolean; slot?: boolean } = {}): boolean {
  const frame = bagArt(scene, o.selected ? 'slot_frame_selected' : 'slot_frame'); if (!frame) return false;
  // 2026-11-19 用户「行囊做成行囊的样子」：格子是缝在包袱布上的口袋（行囊格赭黄、穿戴槽靛青）；品质改成口袋内一圈品质色针脚 + 右上角品质宝石（白无宝石）
  const pocket = o.slot ? bagArt(scene, 'pocket_slot') ?? bagArt(scene, 'pocket') : bagArt(scene, 'pocket');
  if (pocket) {
    c.add(scene.add.image(0, 0, pocket).setDisplaySize(size, size));
    if (q && q !== 'white') {
      const col = QUALITIES[q].color, g = scene.add.graphics().setName('item-quality-frame'), r = size / 2 - size * .13, dash = size * .07;
      g.fillStyle(col, .14).fillRect(-r, -r, r * 2, r * 2);
      g.lineStyle(Math.max(1.5, size * .04), col, .95);
      for (const [x0, y0, x1, y1] of [[-r, -r, r, -r], [r, -r, r, r], [r, r, -r, r], [-r, r, -r, -r]] as const) { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / (dash * 2)); for (let k = 0; k < n; k++) { const t0 = (k * 2 + .5) * dash / len, t1 = Math.min(1, t0 + dash / len); g.lineBetween(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1); } }
      c.add(g);
      const gem = bagArt(scene, 'gem_' + q); if (gem) c.add(scene.add.image(size / 2 - size * .15, -size / 2 + size * .15, gem).setDisplaySize(size * .26, size * .26));
    }
    if (o.selected) c.add(scene.add.graphics().lineStyle(2.5, 0xffe7a0, 1).strokeRoundedRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4, 4));
    return true;
  }
  c.add(scene.add.image(0, 0, frame).setDisplaySize(size, size));
  const qa = q && bagArt(scene, 'q_' + q); if (qa) c.add(scene.add.image(0, 0, qa).setDisplaySize(size, size).setName('item-quality-frame'));
  return true;
}

/** 道具小图块（品质框 + 图标 + 名器星），返回容器；size 为边长。 */
export function itemTile(scene: Phaser.Scene, x: number, y: number, size: number, item: ItemInstance | null, slotHint?: IconSlot, o: { hover?: boolean; selected?: boolean; slot?: boolean } = {}): Phaser.GameObjects.Container {
  ensureItemTextures(scene);
  const c = scene.add.container(x, y), art = drawQualityArt(scene, c, size, item?.quality ?? null, o);
  if (!art) { const g = scene.add.graphics(); drawQualityFrame(g, -size / 2, -size / 2, size, size, item?.quality ?? null, o); c.add(g); }
  const slot = item ? itemSlot(item) : slotHint;
  // 厚涂框边较宽，图标缩到框内（.7）；程序框沿用原比例
  if (item) { const ic = itemIcon(scene, item), k = art ? (ic.art ? .7 : .6) : ic.art ? .84 : .72; const img = scene.add.image(0, 0, ic.key, ic.frame).setDisplaySize(size * k, size * k).setName('item-icon').setData('art', ic.art); if (art) c.addAt(img, 1); else c.add(img); }
  else if (slot) { const sil = art && bagArt(scene, 'sil_' + slot); c.add(sil ? scene.add.image(0, 0, sil).setDisplaySize(size * .62, size * .62).setAlpha(.42) : scene.add.image(0, 0, itemIconKey(slot)).setDisplaySize(size * .72, size * .72).setAlpha(.22)); }
  // 首领遗珍：右下角「珍」字
  if (item && relicDef(item.base)) c.add(scene.add.text(size / 2 - 3, size / 2 - 3, '珍', { fontFamily: 'serif', fontSize: Math.max(10, Math.round(size * .2)) + 'px', color: '#2a1606', backgroundColor: '#f3c66acc', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0).setName('item-relic-badge'));
  if (item?.special) c.add(scene.add.text(size / 2 - 4, -size / 2 + 2, '★', { fontFamily: 'serif', fontSize: Math.round(size * .26) + 'px', color: '#ffd27a', resolution: 2 }).setOrigin(1, 0));
  return c;
}
