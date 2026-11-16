import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { AFFIXES, BAG_CAPACITY, LEGENDS, QUALITIES, QUALITY_ORDER, SLOTS, SLOT_ORDER, SPECIALS, formatAffix, itemDef, itemName, itemSlot, type AffixId, type ItemInstance, type ItemSlot } from '../data/items';
import { gearFromItems, gearSummary } from '../systems/ItemEffects';
import { equipItem, equippedBy, loadItems, loadout, salvageItems, salvageUpTo, unequipSlot } from '../systems/ItemStore';
import { drawQualityFrame, ensureItemTextures, itemTile } from './ItemQuality';
import { lqDivider, lqHitBox, lqPanel, lqSkin } from './LacquerKit';
import { padNavigator } from './PadNavigator';

export interface ItemBagOptions { hero: CharacterId; runLoot?: ItemInstance[]; readOnly?: boolean; onClose?: () => void }

const GOLD = 0xc9a35e, LACQUER = 0x1b120b;
const qIndex = (i: ItemInstance) => QUALITY_ORDER.indexOf(i.quality);

/**
 * 行囊面板：上方武将切换（每位武将各一套 6 槽兵装），左 / 上为 6 个装备槽 + 加成汇总，右 / 下为行囊网格（槽位筛选、翻页）。
 * 点道具弹详情卡：品质色名字、词条、名器特效与典故、与当前装备的对比；可穿戴 / 卸下 / 分解。
 * readOnly（战斗暂停中）：只看，不可换装；可切到「本局缴获」查看尚未带回的道具。
 * 电脑 960×540 左右分栏，手机 540×H 上下排列。命名的命中区供测试使用。
 */
export class ItemBagUI {
  readonly root: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private hero: CharacterId;
  private tab: 'bag' | 'loot';
  private filter: ItemSlot | 'all' = 'all';
  private page = 0;
  private selected: string | null = null;
  private notice = '';
  /** 详情卡关掉后手柄焦点回到这件道具的格子。 */
  private lastUid: string | null = null;
  private lastFrom: string | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly o: ItemBagOptions) {
    ensureItemTextures(scene);
    this.hero = o.hero;
    this.tab = o.readOnly && o.runLoot ? 'loot' : 'bag';
    this.root = scene.add.container(0, 0).setDepth(DEPTH.overlay + 20).setScrollFactor(0).setName('item-bag');
    this.render();
  }

  close(): void { this.root.destroy(); this.o.onClose?.(); }

  private add<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => unknown }>(obj: T, parent = this.body): T { obj.setScrollFactor(0); parent.add(obj); return obj; }
  private text(x: number, y: number, value: string, size: number, color = '#e9dcbc', heading = false, parent = this.body): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, value, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }), parent);
  }
  private button(x: number, y: number, label: string, name: string, onClick: () => void, o: { size?: number; active?: boolean; disabled?: boolean; parent?: Phaser.GameObjects.Container; w?: number } = {}): Phaser.GameObjects.Text {
    // 漆金按钮：选中为朱漆，禁用为暗底；文字过长时整体缩小，不再溢出底框。命名的文字对象仍是命中区。
    const parent = o.parent ?? this.body;
    const t = this.text(x, y, label, o.size ?? 15, '#ffe9bd', o.size !== undefined && o.size >= 16, parent).setOrigin(.5).setPadding(12, 7).setName(name);
    const bw = o.w ? o.w + 24 : Math.max(t.width, 44), bh = Math.max(30, t.height);
    if (t.width > bw - 6) t.setScale((bw - 6) / t.width);
    if (!o.disabled) t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); onClick(); });
    lqHitBox(t, bw, bh);
    const skin = lqSkin(this.scene, t, t, () => ({ w: bw, h: bh }), { tone: o.active ? 'cinnabar' : 'quiet', on: () => !!o.active, enabled: () => !o.disabled });
    skin.gfx.setScrollFactor(0); parent.addAt(skin.gfx, parent.getIndex(t));
    return t;
  }

  private items(): ItemInstance[] {
    const list = this.tab === 'loot' ? [...(this.o.runLoot ?? [])] : loadItems().bag;
    return list.filter(i => this.filter === 'all' || itemSlot(i) === this.filter)
      .sort((a, b) => qIndex(b) - qIndex(a) || SLOT_ORDER.indexOf(itemSlot(a)) - SLOT_ORDER.indexOf(itemSlot(b)) || itemName(a).localeCompare(itemName(b)));
  }

  render(): void {
    // 手柄：重绘前记住焦点对象的名字，重绘后把同名对象设为默认焦点（PadNavigator 会在旧对象销毁后取默认）
    const prev = padNavigator()?.focused, prevName = prev && prev.name.startsWith('item-') ? prev.name : null;
    this.body?.destroy();
    this.body = this.scene.add.container(0, 0).setScrollFactor(0); this.root.add(this.body);
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP, s = loadItems();
    const dim = this.add(this.scene.add.rectangle(0, 0, W, H, 0x0b0805, .86).setOrigin(0).setInteractive());
    dim.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const x0 = D ? 18 : 10, y0 = D ? 12 : 14, pw = W - x0 * 2, ph = H - y0 * 2;
    const g = this.add(this.scene.add.graphics());
    lqPanel(g, x0, y0, pw, ph);

    // 标题 + 计数 + 关闭
    this.text(x0 + 28, y0 + (D ? 18 : 22), '行囊', D ? 26 : 30, '#f2ddae', true);
    const bagCount = s.bag.length;
    this.text(x0 + (D ? 100 : 108), y0 + (D ? 28 : 34), `${bagCount} / ${BAG_CAPACITY}${this.o.readOnly ? ' · 战斗中只可查看' : ''}`, 13, '#b9a57a').setName('item-bag-count');
    this.button(x0 + pw - (D ? 52 : 56), y0 + (D ? 32 : 40), '关闭', 'item-bag-close', () => this.close(), { size: D ? 15 : 17 });

    // 武将切换
    const heroY = y0 + (D ? 70 : 90);
    // 武将多于原设计的行数（电脑 1 行 10 人、手机 2 行 5 人）时，装备槽与行囊网格整体下移
    const heroRows = Math.ceil(CHARACTERS.length / (D ? 10 : 5)), extra = this.o.readOnly ? 0 : Math.max(0, heroRows - (D ? 1 : 2)) * 42;
    if (this.o.readOnly) this.text(x0 + 28, heroY - 10, '武将 · ' + (CHARACTERS.find(c => c.id === this.hero)?.name ?? ''), 15, '#ecd49a');
    else {
      const per = D ? 10 : 5, chipW = D ? 80 : 92, gap = D ? 8 : 8, rowW = per * chipW + (per - 1) * gap, sx = W / 2 - rowW / 2 + chipW / 2;
      CHARACTERS.forEach((c, i) => {
        const col = i % per, row = Math.floor(i / per), worn = Object.keys(loadout(c.id, s)).length;
        this.button(sx + col * (chipW + gap), heroY + row * 42, c.name + (worn ? ' ·' + worn : ''), 'item-hero-' + c.id, () => { this.hero = c.id; this.selected = null; this.render(); }, { size: D ? 14 : 15, active: c.id === this.hero, w: chipW - 24 });
      });
    }

    // 装备槽 + 加成
    const worn = loadout(this.hero, s), gear = gearFromItems(Object.values(worn).filter((i): i is ItemInstance => !!i));
    const slotSize = D ? 74 : 70, slotTop = (D ? y0 + 112 : heroY + (this.o.readOnly ? 30 : 90)) + extra;
    SLOT_ORDER.forEach((slot, i) => {
      const cx = D ? x0 + 70 + (i % 3) * 108 : W / 2 + (i - 2.5) * (slotSize + 12), cy = D ? slotTop + 40 + Math.floor(i / 3) * 104 : slotTop + slotSize / 2;
      const item = worn[slot] ?? null, tile = this.add(itemTile(this.scene, cx, cy, slotSize, item, slot, { selected: !!item && item.uid === this.selected }));
      tile.setName('item-slot-' + slot).setData('uid', item?.uid ?? null).setSize(slotSize, slotSize).setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (item) this.select(item.uid); });
      this.text(cx, cy + slotSize / 2 + 12, item ? itemName(item) : SLOTS[slot].name, 12, item ? QUALITIES[item.quality].css : '#8d7d60').setOrigin(.5).setName('item-slot-label-' + slot);
    });
    const sumX = x0 + 28, sumY = D ? slotTop + 222 : slotTop + slotSize + 34;
    const lines = gearSummary(gear);
    this.text(sumX, sumY, '兵装加成', 15, '#ecd49a', true);
    // 电脑：两列排开（最多 6 行）；手机：一行行接续换行。名器特效只列名字，详情在道具卡里看
    const half = Math.ceil(lines.length / 2), sumCols = D && lines.length > 3 ? [lines.slice(0, half), lines.slice(half)] : [lines];
    const sumText = lines.length ? (D ? sumCols.map(c => c.join('\n')) : [lines.map(l => l.replace(/ /g, ' ')).join('　 ')]) : ['尚未穿戴兵装 · 点行囊中的道具穿戴'];
    const sum = this.text(sumX, sumY + 24, sumText[0], D ? 12 : 13, '#d8ccb0').setWordWrapWidth(D ? 320 : pw - 56).setLineSpacing(3).setName('item-gear-summary');
    if (sumText[1]) this.text(sumX + 168, sumY + 24, sumText[1], 12, '#d8ccb0').setLineSpacing(3).setName('item-gear-summary-2');
    let sumBottom = sum.y + sum.height;
    if (gear.specials.length) { const sp = this.text(sumX, sumBottom + 6, D ? '名器特效 ★ ' + gear.specials.map(id => SPECIALS[id].name).join(' · ★ ') + '（点道具看详情）' : '★ ' + gear.specials.map(id => SPECIALS[id].name + '：' + SPECIALS[id].desc).join('　★ '), D ? 12 : 13, '#f3c37a').setWordWrapWidth(D ? 320 : pw - 56).setLineSpacing(2).setName('item-gear-specials'); sumBottom = sp.y + sp.height; }

    // 行囊网格
    const gx = D ? x0 + 372 : x0 + 22, gw = D ? pw - 372 - 24 : pw - 44;
    let fy = D ? y0 + 112 + extra : sumBottom + 28;
    if (this.o.runLoot) {
      this.button(gx + 60, fy, '本局缴获 ' + this.o.runLoot.length, 'item-tab-loot', () => { this.tab = 'loot'; this.page = 0; this.selected = null; this.render(); }, { active: this.tab === 'loot', size: 14 });
      this.button(gx + 170, fy, '行囊', 'item-tab-bag', () => { this.tab = 'bag'; this.page = 0; this.selected = null; this.render(); }, { active: this.tab === 'bag', size: 14 });
      fy += 40;
    }
    const filters: Array<ItemSlot | 'all'> = ['all', ...SLOT_ORDER], fw = (gw - 6 * 6) / 7;
    filters.forEach((f, i) => this.button(gx + fw / 2 + i * (fw + 6), fy, f === 'all' ? '全部' : SLOTS[f].name, 'item-filter-' + f, () => { this.filter = f; this.page = 0; this.render(); }, { active: this.filter === f, size: 13, w: fw - 24 }));
    const cell = D ? 60 : 72, gap = D ? 8 : 10, cols = Math.max(1, Math.floor((gw + gap) / (cell + gap)));
    const gridTop = fy + 30, bottom = y0 + ph - (D ? 62 : 74), rows = Math.max(1, Math.floor((bottom - gridTop + gap) / (cell + gap))), per = cols * rows;
    const list = this.items(), pages = Math.max(1, Math.ceil(list.length / per)); this.page = Math.min(this.page, pages - 1);
    const offX = gx + (gw - (cols * cell + (cols - 1) * gap)) / 2;
    list.slice(this.page * per, this.page * per + per).forEach((item, i) => {
      const cx = offX + cell / 2 + (i % cols) * (cell + gap), cy = gridTop + cell / 2 + Math.floor(i / cols) * (cell + gap);
      const tile = this.add(itemTile(this.scene, cx, cy, cell, item, undefined, { selected: item.uid === this.selected }));
      tile.setName('item-cell-' + i).setData('uid', item.uid).setSize(cell, cell).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.select(item.uid));
      const owner = this.tab === 'bag' ? equippedBy(s, item.uid) : undefined;
      if (owner) this.text(cx - cell / 2 + 3, cy + cell / 2 - 3, CHARACTERS.find(c => c.id === owner)?.name.slice(0, 1) ?? '装', 11, '#1c140a').setOrigin(0, 1).setBackgroundColor('#d7b46a').setPadding(2, 0);
    });
    if (!list.length) this.text(gx + gw / 2, gridTop + 60, this.tab === 'loot' ? '本局尚未缴获兵装\n击败精锐、首领或打开宝箱可得' : '行囊空空\n战斗中击败精锐、首领、打开宝箱可得兵装', 15, '#9c8c6c').setOrigin(.5).setAlign('center');
    const pageY = y0 + ph - (D ? 36 : 44);
    this.button(gx + 30, pageY, '‹', 'item-page-prev', () => { this.page = Math.max(0, this.page - 1); this.render(); }, { disabled: this.page === 0, size: 16 });
    this.text(gx + 82, pageY, `${this.page + 1} / ${pages}`, 14, '#cdb98a').setOrigin(.5).setName('item-page');
    this.button(gx + 134, pageY, '›', 'item-page-next', () => { this.page = Math.min(pages - 1, this.page + 1); this.render(); }, { disabled: this.page >= pages - 1, size: 16 });
    if (!this.o.readOnly && this.tab === 'bag') this.button(gx + gw - 70, pageY, '分解白 / 绿', 'item-salvage-low', () => { const m = salvageUpTo('green'); this.notice = m ? `分解完成 · 钱 +${m}` : '没有可分解的白 / 绿兵装（已穿戴的不会分解）'; this.selected = null; this.render(); }, { size: 14 });
    if (this.notice) { const n = this.text(W / 2, pageY - (D ? 34 : 40), this.notice, 14, '#f3d48a').setOrigin(.5).setName('item-notice'); this.notice = ''; this.scene.time.delayedCall(1800, () => n.active && n.setVisible(false)); }

    if (this.selected) this.renderDetail(this.selected);
    this.markPadDefault(prevName);
  }

  /** 手柄默认焦点：详情卡 → 穿戴 / 卸下 / 关闭；否则回到刚看过的道具，再否则沿用重绘前的焦点、第一格、关闭。 */
  private markPadDefault(prevName: string | null): void {
    const find = (root: Phaser.GameObjects.Container, pred: (o: Phaser.GameObjects.GameObject) => boolean): Phaser.GameObjects.GameObject | null => {
      for (const o of root.list) { if (o.input?.enabled && pred(o)) return o; if (o instanceof Phaser.GameObjects.Container) { const r = find(o, pred); if (r) return r; } }
      return null;
    };
    const card = this.body.getByName('item-detail') as Phaser.GameObjects.Container | null, byName = (n: string) => (o: Phaser.GameObjects.GameObject) => o.name === n;
    let target: Phaser.GameObjects.GameObject | null = null;
    if (card) target = find(card, byName('item-equip')) ?? find(card, byName('item-unequip')) ?? find(card, byName('item-detail-close'));
    else {
      if (this.lastUid) {
        // 同一件道具可能同时在装备槽和行囊格里：先回到打开详情时所在的那个，再找行囊格，最后装备槽
        const uid = this.lastUid, from = this.lastFrom, mine = (o: Phaser.GameObjects.GameObject) => o.getData('uid') === uid;
        target = (from ? find(this.body, o => mine(o) && o.name === from) : null) ?? find(this.body, o => mine(o) && o.name.startsWith('item-cell-')) ?? find(this.body, o => mine(o) && o.name.startsWith('item-slot-'));
        this.lastUid = null;
      }
      if (!target && prevName) target = find(this.body, byName(prevName));
      target ??= find(this.body, byName('item-cell-0')) ?? find(this.body, byName('item-bag-close'));
    }
    target?.setData('padDefault', true);
  }

  private select(uid: string): void { this.lastUid = uid; this.lastFrom = padNavigator()?.focused?.name ?? null; this.selected = this.selected === uid ? null : uid; this.render(); }
  private closeDetail(): void { this.lastUid = this.selected; this.selected = null; this.render(); }

  private renderDetail(uid: string): void {
    const s = loadItems(), item = s.bag.find(i => i.uid === uid) ?? this.o.runLoot?.find(i => i.uid === uid);
    if (!item) { this.selected = null; return; }
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP, q = QUALITIES[item.quality], slot = itemSlot(item), def = itemDef(item.base);
    const card = this.scene.add.container(0, 0).setScrollFactor(0).setName('item-detail'); this.body.add(card);
    const shade = this.add(this.scene.add.rectangle(0, 0, W, H, 0x000000, .45).setOrigin(0).setInteractive(), card);
    shade.on('pointerdown', () => this.closeDetail());
    const cw = D ? 380 : 460, inBag = s.bag.some(i => i.uid === uid), owner = inBag ? equippedBy(s, uid) : undefined;
    const current = loadout(this.hero, s)[slot];
    const lines = item.affixes.map(a => (a.minor ? '· ' : '') + formatAffix(a));
    const compare = this.compare(item, current && current.uid !== item.uid ? current : undefined);
    const legend = def?.legend ?? LEGENDS.find(l => l.id === item.base);
    // 先估算高度定位，排完文字后按实际高度画底
    const est = 96 + lines.length * 25 + (item.special ? 44 : 0) + (legend ? 22 : 0) + (compare ? 22 + compare.split('\n').length * 18 : 0) + 64;
    const x = (W - cw) / 2, y = Math.max(20, (H - est) / 2);
    const g = this.add(this.scene.add.graphics(), card);
    card.add(itemTile(this.scene, x + 50, y + 52, 64, item).setScrollFactor(0));
    this.text(x + 92, y + 22, itemName(item), 22, q.css, true, card).setName('item-detail-name');
    this.text(x + 92, y + 56, `${q.name} · ${SLOTS[slot].name}${owner ? ' · ' + (CHARACTERS.find(c => c.id === owner)?.name ?? '') + '已穿戴' : ''}`, 13, '#b9a57a', false, card).setName('item-detail-quality');
    let ty = y + 96;
    this.text(x + 26, ty, lines.join('\n'), 15, '#e9dcbc', false, card).setLineSpacing(6).setName('item-detail-affixes'); ty += lines.length * 25 + 6;
    if (item.special) { this.text(x + 26, ty, `★ ${SPECIALS[item.special].name}：${SPECIALS[item.special].desc}`, 14, '#f3c37a', false, card).setWordWrapWidth(cw - 52); ty += 44; }
    if (legend) { this.text(x + 26, ty, '「' + legend.lore + '」', 13, '#9c8c6c', false, card); ty += 22; }
    if (compare) { this.text(x + 26, ty, current && current.uid !== item.uid ? `对比当前（${itemName(current)}）` : '', 13, '#b9a57a', false, card); this.text(x + 26, ty + 20, compare, 13, '#d8ccb0', false, card).setLineSpacing(2).setName('item-detail-compare'); ty += 22 + compare.split('\n').length * 18; }
    const ch = ty - y + 58, by = y + ch - 32;
    drawQualityFrame(g, x, y, cw, ch, item.quality, { hover: true });
    g.fillStyle(LACQUER, .9).fillRoundedRect(x + 6, y + 6, cw - 12, ch - 12, 6);
    g.lineStyle(1, q.color, .5).strokeRoundedRect(x + 6, y + 6, cw - 12, ch - 12, 6);
    // 关闭（手柄 Ⓑ 也走这里）
    this.button(x + cw - 30, y + 28, '×', 'item-detail-close', () => this.closeDetail(), { parent: card, size: 16 });
    if (this.o.readOnly || !inBag) { this.text(x + cw / 2, by, this.o.readOnly ? '战斗中不可更换 · 出征前在主页「行囊」穿戴' : '结算后收入行囊', 13, '#9c8c6c', false, card).setOrigin(.5); return; }
    const wornHere = current?.uid === item.uid;
    this.button(x + cw * .3, by, wornHere ? '卸下' : '穿戴', wornHere ? 'item-unequip' : 'item-equip', () => {
      if (wornHere) unequipSlot(this.hero, slot); else equipItem(this.hero, item.uid);
      this.notice = wornHere ? '已卸下' : `${CHARACTERS.find(c => c.id === this.hero)?.name ?? ''} 穿戴 ${itemName(item)}`; this.lastUid = item.uid; this.selected = null; this.render();
    }, { parent: card, size: 16 });
    this.button(x + cw * .7, by, owner ? '已穿戴不可分解' : `分解 · 钱 +${q.salvage}`, 'item-salvage', () => { const m = salvageItems([item.uid]); this.notice = `分解 ${itemName(item)} · 钱 +${m}`; this.selected = null; this.render(); }, { parent: card, size: 14, disabled: !!owner });
  }

  /** 与当前同槽装备的词条差，如「武器伤害 +2.1%」「暴击率 −1.0%」。 */
  private compare(item: ItemInstance, current?: ItemInstance): string {
    if (!current) return '';
    const sum = (i: ItemInstance) => { const m = new Map<AffixId, number>(); for (const a of i.affixes) m.set(a.id, (m.get(a.id) ?? 0) + a.value); return m; };
    const a = sum(item), b = sum(current), ids = [...new Set([...a.keys(), ...b.keys()])];
    return ids.map(id => { const d = (a.get(id) ?? 0) - (b.get(id) ?? 0); if (Math.abs(d) < 1e-4) return ''; const f = AFFIXES[id], v = f.percent ? `${Math.round(Math.abs(d) * 1000) / 10}%` : Math.abs(d).toFixed(1), better = id === 'reduce' ? d > 0 : d > 0;
      return `${better ? '▲' : '▼'} ${f.name} ${d > 0 ? '+' : '−'}${v}`; }).filter(Boolean).join('\n');
  }
}
