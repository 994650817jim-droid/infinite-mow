import Phaser from 'phaser';
import { charmText } from '../data/charms';
import { FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, screenPoint } from '../config';
import { AFFIXES, QUALITIES, SLOTS, SPECIALS, formatAffix, itemName, itemSlot, relicDef, type AffixId, type ItemInstance } from '../data/items';
import { bagArt, itemTile } from './ItemQuality';

/** 与当前同槽装备的词条差：▲ 涨（绿）/ ▼ 降（红）。 */
export function compareLines(item: ItemInstance, current?: ItemInstance): { text: string; up: boolean }[] {
  if (!current || current.uid === item.uid) return [];
  const sum = (i: ItemInstance) => { const m = new Map<AffixId, number>(); for (const a of i.affixes) m.set(a.id, (m.get(a.id) ?? 0) + a.value); return m; };
  const a = sum(item), b = sum(current), ids = [...new Set([...a.keys(), ...b.keys()])], out: { text: string; up: boolean }[] = [];
  for (const id of ids) {
    const d = (a.get(id) ?? 0) - (b.get(id) ?? 0); if (Math.abs(d) < 1e-4) continue;
    const f = AFFIXES[id], v = f.percent ? `${Math.round(Math.abs(d) * 1000) / 10}%` : Math.abs(d).toFixed(1);
    // 「受到伤害」是减伤：数值越大越好，显示为 −
    const sign = id === 'reduce' ? (d > 0 ? '−' : '+') : (d > 0 ? '+' : '−');
    out.push({ text: `${d > 0 ? '▲' : '▼'} ${f.name} ${sign}${v}`, up: d > 0 });
  }
  return out;
}

/**
 * 兵装悬停提示框（2026-11-16 用户要求「鼠标挪上去可以显示属性」）：名称（品质色）、品质 · 栏位、词条、名器特效，
 * 以及与当前穿着的同槽装备对比（涨绿降红）。跟随鼠标，不超出屏幕边。一个界面建一个，用 attach 挂到装备图块上。
 */
export class ItemTooltip {
  readonly root: Phaser.GameObjects.Container;
  constructor(private readonly scene: Phaser.Scene, depth: number) {
    this.root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setVisible(false).setName('item-tooltip');
  }
  show(item: ItemInstance, current: ItemInstance | undefined, px: number, py: number): void {
    const s = this.scene, q = QUALITIES[item.quality], pad = 12, w = 268, bandH = 56;
    this.root.removeAll(true);
    const add = (t: Phaser.GameObjects.Text) => { t.setScrollFactor(0); this.root.add(t); return t; };
    const txt = (x: number, y: number, v: string, size: number, color: string, heading = false) => add(s.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, wordWrap: { width: w - pad * 2, useAdvancedWrap: true } }));
    // 2026-11-17 美术重设计：顶部品质色渐变带（图标 + 名字 + 品质 · 栏位），漆底金边，虚线下是对比
    const g = s.add.graphics().setScrollFactor(0); this.root.add(g);
    const icon = itemTile(s, 8 + 21, 7 + 21, 42, item).setScrollFactor(0); this.root.add(icon);
    const head = (x: number, y0: number, v: string, size: number, color: string, heading = false) => add(s.add.text(x, y0, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, wordWrap: { width: w - 70, useAdvancedWrap: true } }));
    head(60, 10, itemName(item), 17, q.css, true).setName('item-tooltip-name');
    const relic = relicDef(item.base);
    head(60, 34, `${relic ? '首领遗珍（' + relic.boss + '）· ' : ''}${q.name} · ${SLOTS[itemSlot(item)].name}`, 12, relic ? '#f3c66a' : '#c9b89a');
    let y = bandH + 8;
    const aff = txt(pad, y, item.affixes.map(a => (a.minor ? '· ' : '') + formatAffix(a)).join('\n'), 13, '#e9dcbc').setLineSpacing(3).setName('item-tooltip-affixes'); y += aff.height + 4;
    if (item.special) { const sp = txt(pad, y, `★ ${SPECIALS[item.special].name}：${SPECIALS[item.special].desc}`, 12, '#f3c37a'); y += sp.height + 4; }
    const ct = charmText(item); if (ct) { const c = txt(pad, y, ct, 12, '#f3c37a').setName('item-tooltip-charm'); y += c.height + 4; }
    const cmp = compareLines(item, current);
    if (current && current.uid !== item.uid) {
      y += 4; const dash = y; y += 6; txt(pad, y, `对比当前（${itemName(current)}）`, 12, '#b9a57a'); y += 18;
      for (let x = pad; x < w - pad; x += 6) g.lineStyle(1, 0xc9a45c, .4).lineBetween(x, dash, Math.min(w - pad, x + 3), dash);
      if (!cmp.length) { txt(pad, y, '词条相同', 12, '#9c8c6c'); y += 18; }
      for (const c of cmp) { txt(pad, y, c.text, 12, c.up ? '#7fd88a' : '#f08a6a').setName(c.up ? 'item-tooltip-up' : 'item-tooltip-down'); y += 17; }
    } else if (!current) { txt(pad, y + 2, '该栏位尚未穿戴', 12, '#9c8c6c'); y += 20; }
    const h = y + pad - 4;
    const card = bagArt(s, 'tooltip_card');
    if (card) { const ns = s.add.nineslice(0, 0, card, undefined, w * 2, h * 2, 40, 40, 40, 40).setOrigin(0).setScale(.5).setScrollFactor(0); this.root.addAt(ns, 0); }
    const bg = s.add.graphics().setScrollFactor(0); this.root.addAt(bg, card ? 1 : 0);
    if (!card) { bg.fillStyle(0x0a0603, .5).fillRoundedRect(3, 5, w, h, 7); bg.fillStyle(0x1b110a, .97).fillRoundedRect(0, 0, w, h, 6); } // 无素材：投影 + 漆底
    for (let i = 0; i < 12; i++) bg.fillStyle(q.color, .34 * (1 - i / 12)).fillRect(2 + i * (w - 4) / 12, 2, (w - 4) / 12 + 1, bandH - 2); // 品质色渐变带
    bg.fillStyle(0x000000, .25).fillRect(2, bandH, w - 4, 1);
    if (!card) bg.lineStyle(1, 0x000000, 1).strokeRoundedRect(.5, .5, w - 1, h - 1, 6).lineStyle(2, 0xc08a3e, 1).strokeRoundedRect(2, 2, w - 4, h - 4, 5);
    bg.lineStyle(1, q.color, .7).strokeRoundedRect(4.5, 4.5, w - 9, h - 9, 4);
    this.root.setData('w', w).setData('h', h).setVisible(true);
    this.move(px, py);
  }
  /** 放在鼠标右下方；靠右 / 靠下时翻到另一侧，始终留在屏幕内。 */
  move(px: number, py: number): void {
    const w = this.root.getData('w') as number ?? 0, h = this.root.getData('h') as number ?? 0, gap = 16;
    let x = px + gap, y = py + gap;
    if (x + w > GAME_WIDTH - 4) x = px - gap - w;
    if (y + h > GAME_HEIGHT - 4) y = py - gap - h;
    this.root.setPosition(Math.max(4, Math.min(GAME_WIDTH - w - 4, x)), Math.max(4, Math.min(GAME_HEIGHT - h - 4, y)));
  }
  hide(): void { this.root.setVisible(false); }
  destroy(): void { this.root.destroy(); }
  /** 挂到可交互对象上：悬停显示、移动跟随、移出隐藏。getItem / getCurrent 在悬停时取（便于读最新穿戴）。 */
  attach(obj: Phaser.GameObjects.GameObject, getItem: () => ItemInstance | null | undefined, getCurrent: () => ItemInstance | undefined): void {
    // 指针坐标换成界面坐标（电脑版相机按 RENDER_SCALE 缩放，见 config.screenPoint）
    obj.on('pointerover', (p: Phaser.Input.Pointer) => { const it = getItem(); if (!it) return; const q = screenPoint(p); this.show(it, getCurrent(), q.x, q.y); });
    obj.on('pointermove', (p: Phaser.Input.Pointer) => { if (!this.root.visible) return; const q = screenPoint(p); this.move(q.x, q.y); });
    obj.on('pointerout', () => this.hide());
    obj.once('destroy', () => this.hide());
  }
}
