import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { AFFIXES, BAG_CAPACITY, LEGENDS, QUALITIES, QUALITY_ORDER, SLOTS, SLOT_ORDER, SPECIALS, formatAffix, itemDef, itemName, itemSlot, type AffixId, type ItemInstance, type ItemSlot } from '../data/items';
import { HORSES, mountStyle } from '../data/mounts';
import { gearFromItems, gearSummary, horseBonusText } from '../systems/ItemEffects';
import { equipItem, equippedBy, heroHorse, horseRider, loadItems, loadout, looseCount, markBagSeen, rideHorse, salvageItems, salvageUpTo, setAutoSalvageWhite, stableUnlocked, takeItemNotice, takeStableAnnouncement, unequipSlot } from '../systems/ItemStore';
import { drawQualityFrame, ensureItemTextures, horseIcon, itemIconKey, itemTile } from './ItemQuality';
import { lqHitBox, lqPanel, lqSkin } from './LacquerKit';
import { padNavigator } from './PadNavigator';

/** 本局宝物（战法宝物 / 饰品）的显示条目，由 GameScene 提供。 */
export interface TreasureEntry { name: string; desc: string; icon: string }
export interface ItemBagOptions {
  hero: CharacterId;
  /** 本局缴获（战斗中）。 */
  runLoot?: ItemInstance[];
  /** 战斗中打开：只看当前武将；可换装，坐骑除外（atRest = 行营休整，可换马）。 */
  battle?: boolean; atRest?: boolean;
  treasures?: TreasureEntry[];
  /** 战斗中穿上缴获（收入行囊并穿上）；测试战斗不提供。 */
  claimLoot?: (item: ItemInstance) => boolean;
  /** 换装 / 换马后通知战斗场景重算加成。 */
  onGearChange?: () => void;
  /** 打开时直接显示马厩（主城马厩建筑调用 openStable）。 */
  stable?: boolean;
  onClose?: () => void;
}

const qIndex = (i: ItemInstance) => QUALITY_ORDER.indexOf(i.quality);
interface SlotRect { slot: ItemSlot; x: number; y: number; size: number }

/** 马厩入口（主城马厩建筑、主页等调用）：打开行囊并直接显示马厩。 */
export function openStable(scene: Phaser.Scene, hero: CharacterId, onClose?: () => void): ItemBagUI { return new ItemBagUI(scene, { hero, stable: true, onClose }); }

/**
 * 行囊面板（2026-11-16 改版，RPG 纸娃娃）：
 * - 左 / 上：武将立绘，四周 4 个兵装槽（头盔、甲胄、战靴、信物）+ 坐骑位 + 本局宝物 2 格，下方加成汇总；
 * - 右 / 下：行囊网格（槽位筛选、翻页；战斗中可切「本局缴获」）。
 * 点道具弹详情卡（穿戴 / 卸下 / 分解 / 对比）；也可把道具从行囊拖到装备槽穿上、从槽拖回行囊卸下（拖到已有装备的槽即互换）。
 * 坐骑位打开马厩：第一章通关后开放，只在休整时（主页、行营休整）可换马。
 * 电脑 960×540 左右分栏，手机 540×H 上下排列。命名的命中区供测试与手柄使用。
 */
export class ItemBagUI {
  readonly root: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private hero: CharacterId;
  private tab: 'bag' | 'loot';
  private filter: ItemSlot | 'all' = 'all';
  private page = 0;
  /** 选中：道具 uid、'treasure:N'、'stable'。 */
  private selected: string | null = null;
  private notice = '';
  /** 详情卡关掉后手柄焦点回到这件道具的格子。 */
  private lastUid: string | null = null;
  private lastFrom: string | null = null;
  private slotRects: SlotRect[] = [];
  private gridRect = { x: 0, y: 0, w: 0, h: 0 };
  private dragHints?: Phaser.GameObjects.Graphics;
  private dragTip?: Phaser.GameObjects.Text;
  private readonly prevDragDistance: number;

  constructor(private readonly scene: Phaser.Scene, private readonly o: ItemBagOptions) {
    ensureItemTextures(scene);
    this.hero = o.hero;
    this.tab = 'bag';
    if (o.stable) this.selected = 'stable';
    this.root = scene.add.container(0, 0).setDepth(DEPTH.overlay + 20).setScrollFactor(0).setName('item-bag').setData('ui', this);
    // 拖拽：移动超过 8px 才算拖，轻点仍是选中（手柄 Ⓐ 走点击）
    this.prevDragDistance = scene.input.dragDistanceThreshold; scene.input.dragDistanceThreshold = 8;
    const notes = [takeItemNotice(), takeStableAnnouncement() ? '马厩已开放 · 获赠驽马（点坐骑位换马）' : undefined].filter(Boolean);
    this.notice = notes.join('\n');
    markBagSeen();
    this.render();
  }

  close(): void { this.scene.input.dragDistanceThreshold = this.prevDragDistance; this.root.destroy(); this.o.onClose?.(); }

  private get battle(): boolean { return !!this.o.battle; }
  private get canChangeHorse(): boolean { return !this.battle || !!this.o.atRest; }

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

  /** 穿戴（行囊里的）或穿上缴获（战斗中）。返回是否成功。 */
  private wear(item: ItemInstance): boolean {
    const inBag = loadItems().bag.some(i => i.uid === item.uid);
    const ok = inBag ? equipItem(this.hero, item.uid) : !!this.o.claimLoot?.(item);
    if (ok) { this.notice = `${CHARACTERS.find(c => c.id === this.hero)?.name ?? ''} 穿戴 ${itemName(item)}${inBag ? '' : ' · 已收入行囊'}`; this.o.onGearChange?.(); }
    return ok;
  }
  private takeOff(slot: ItemSlot): void { if (unequipSlot(this.hero, slot)) { this.notice = '已卸下'; this.o.onGearChange?.(); } }

  render(): void {
    // 手柄：重绘前记住焦点对象的名字，重绘后把同名对象设为默认焦点（PadNavigator 会在旧对象销毁后取默认）
    const prev = padNavigator()?.focused, prevName = prev && (prev.name.startsWith('item-') || prev.name.startsWith('stable-')) ? prev.name : null;
    this.body?.destroy();
    this.body = this.scene.add.container(0, 0).setScrollFactor(0); this.root.add(this.body);
    this.slotRects = [];
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP, s = loadItems();
    const dim = this.add(this.scene.add.rectangle(0, 0, W, H, 0x0b0805, .86).setOrigin(0).setInteractive());
    dim.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const x0 = D ? 18 : 10, y0 = D ? 12 : 14, pw = W - x0 * 2, ph = H - y0 * 2;
    lqPanel(this.add(this.scene.add.graphics()), x0, y0, pw, ph);

    // 标题 + 计数（只算未穿戴的）+ 关闭
    this.text(x0 + 28, y0 + (D ? 18 : 22), '行囊', D ? 26 : 30, '#f2ddae', true);
    const loose = looseCount(s), over = loose > BAG_CAPACITY;
    this.text(x0 + (D ? 100 : 108), y0 + (D ? 28 : 34), `未穿戴 ${loose} / ${BAG_CAPACITY}${over ? ' · 已超出，请分解' : ''}${this.battle ? (this.o.atRest ? ' · 休整中' : ' · 战斗中可换装') : ''}`, 13, over ? '#f08a6a' : '#b9a57a').setName('item-bag-count');
    this.button(x0 + pw - (D ? 52 : 56), y0 + (D ? 32 : 40), '关闭', 'item-bag-close', () => this.close(), { size: D ? 15 : 17 });

    // 武将切换（战斗中只看出征的武将）
    const heroY = y0 + (D ? 70 : 90);
    const heroRows = Math.ceil(CHARACTERS.length / (D ? 10 : 5));
    if (!this.battle) {
      const per = D ? 10 : 5, chipW = D ? 80 : 92, gap = 8, rowW = per * chipW + (per - 1) * gap, sx = W / 2 - rowW / 2 + chipW / 2;
      CHARACTERS.forEach((c, i) => {
        const col = i % per, row = Math.floor(i / per), worn = Object.keys(loadout(c.id, s)).length;
        this.button(sx + col * (chipW + gap), heroY + row * 42, c.name + (worn ? ' ·' + worn : ''), 'item-hero-' + c.id, () => { this.hero = c.id; if (this.selected !== 'stable') this.selected = null; this.render(); }, { size: D ? 14 : 15, active: c.id === this.hero, w: chipW - 24 });
      });
    }
    const dollTop = this.battle ? y0 + (D ? 66 : 76) : heroY + (heroRows - 1) * 42 + (D ? 32 : 36);

    // 纸娃娃
    const worn = loadout(this.hero, s), horse = heroHorse(this.hero, s);
    const size = D ? 58 : 64, pitch = D ? 78 : 88, lx = D ? x0 + 62 : x0 + 64, rx = D ? x0 + 300 : x0 + pw - 64, cx = (lx + rx) / 2;
    const rowY = (r: number) => dollTop + size / 2 + r * pitch;
    this.portrait(cx, dollTop, (rx - lx) - size - 24, pitch * 2 - 28);
    const place: Record<ItemSlot, [number, number]> = { helm: [lx, rowY(0)], armor: [lx, rowY(1)], boots: [rx, rowY(0)], token: [rx, rowY(1)] };
    for (const slot of SLOT_ORDER) {
      const [sx, sy] = place[slot], item = worn[slot] ?? null;
      const tile = this.add(itemTile(this.scene, sx, sy, size, item, slot, { selected: !!item && item.uid === this.selected }));
      tile.setName('item-slot-' + slot).setData('uid', item?.uid ?? null).setSize(size, size).setInteractive({ useHandCursor: true });
      this.tapOrDrag(tile, () => { if (item) this.select(item.uid); else { this.filter = slot; this.page = 0; this.notice = `行囊已筛选 · ${SLOTS[slot].name}（点道具或拖到槽位穿戴）`; this.render(); } }, item ? { item, fromSlot: slot } : undefined);
      this.text(sx, sy + size / 2 + 10, item ? itemName(item) : SLOTS[slot].name, 12, item ? QUALITIES[item.quality].css : '#8d7d60').setOrigin(.5).setName('item-slot-label-' + slot);
      this.slotRects.push({ slot, x: sx, y: sy, size });
    }
    // 坐骑位
    const my = rowY(2), mountTile = this.add(this.scene.add.container(lx, my));
    const mg = this.scene.add.graphics(); drawQualityFrame(mg, -size / 2, -size / 2, size, size, horse ? (HORSES.find(h => h.id === horse.id)?.legend ? 'orange' : 'blue') : null); mountTile.add(mg);
    const unlocked = stableUnlocked();
    if (horse) { const ic = horseIcon(this.scene, horse.id), k = ic.art ? .84 : .72; mountTile.add(this.scene.add.image(0, 0, ic.key, ic.frame).setDisplaySize(size * k, size * k).setTint(ic.art ? 0xffffff : mountStyle(horse.id).tint)); }
    else mountTile.add(this.scene.add.image(0, 0, itemIconKey('mount')).setDisplaySize(size * .72, size * .72).setAlpha(.22));
    if (!unlocked || !this.canChangeHorse) mountTile.add(this.scene.add.text(size / 2 - 3, size / 2 - 3, '锁', { fontFamily: FONT, fontSize: '12px', color: '#1c140a', backgroundColor: '#b9a57a', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0));
    mountTile.setName('item-slot-mount').setSize(size, size).setInteractive({ useHandCursor: true }).on('pointerup', () => this.select('stable'));
    this.text(lx, my + size / 2 + 10, !unlocked ? '坐骑 · 一章通关开放' : horse ? horse.name : '坐骑', 12, horse ? '#f3c37a' : '#8d7d60').setOrigin(.5).setName('item-slot-label-mount');
    // 本局宝物 2 格
    const tre = this.o.treasures ?? [], tdx = D ? 46 : 60;
    this.text(cx, my - size / 2 - 12, '本局宝物', 12, '#b9a57a').setOrigin(.5);
    for (let i = 0; i < 2; i++) {
      const tx = cx + (i ? tdx : -tdx), t = tre[i], c = this.add(this.scene.add.container(tx, my));
      const g = this.scene.add.graphics(); g.fillStyle(0x1b120b, .8).fillRoundedRect(-size / 2, -size / 2, size, size, 7); g.lineStyle(t ? 2 : 1, t ? 0xc9a35e : 0x6b5a40, t ? 1 : .55).strokeRoundedRect(-size / 2, -size / 2, size, size, 7); c.add(g);
      if (t && this.scene.textures.exists(t.icon)) c.add(this.scene.add.image(0, 0, t.icon).setDisplaySize(size * .78, size * .78));
      else c.add(this.scene.add.text(0, 0, '宝', { fontFamily: HEADING_FONT, fontSize: Math.round(size * .42) + 'px', color: t ? '#f3d48a' : '#5d5040', resolution: 2 }).setOrigin(.5));
      c.setName('item-treasure-' + i).setSize(size, size).setInteractive({ useHandCursor: true }).on('pointerup', () => this.select('treasure:' + i));
      this.text(tx, my + size / 2 + 10, t ? t.name : this.battle ? '空' : '出征后获得', 12, t ? '#f3d48a' : '#6f6250').setOrigin(.5).setName('item-treasure-label-' + i);
    }

    // 加成汇总
    const gear = gearFromItems(Object.values(worn).filter((i): i is ItemInstance => !!i), horse);
    const sumX = x0 + 28, sumY = my + size / 2 + (D ? 26 : 30), lines = gearSummary(gear);
    this.text(sumX, sumY, '兵装加成', D ? 14 : 15, '#ecd49a', true);
    const half = Math.ceil(lines.length / 2), cols = D && lines.length > 3 ? [lines.slice(0, half), lines.slice(half)] : [lines];
    // 手机：一行接一行；词条内用不换行空格，避免「受到伤 / 害」被拆开
    const sumText = lines.length ? (D ? cols.map(c => c.join('\n')) : [lines.map(l => l.replace(/ /g, ' ')).join('　 ')]) : ['尚未穿戴兵装 · 点行囊中的道具或拖到槽位穿戴'];
    const sum = this.text(sumX + (D ? 0 : 0), sumY + 22, sumText[0], D ? 12 : 13, '#d8ccb0').setWordWrapWidth(D ? 320 : pw - 56).setLineSpacing(3).setName('item-gear-summary');
    if (sumText[1]) this.text(sumX + 168, sumY + 22, sumText[1], 12, '#d8ccb0').setLineSpacing(3).setName('item-gear-summary-2');
    let sumBottom = sum.y + sum.height;
    if (gear.specials.length) { const sp = this.text(sumX, sumBottom + 4, '★ ' + gear.specials.map(id => SPECIALS[id].name).join(' · ★ ') + '（点道具看详情）', 12, '#f3c37a').setWordWrapWidth(D ? 320 : pw - 56).setName('item-gear-specials'); sumBottom = sp.y + sp.height; }

    // 行囊网格
    const gx = D ? x0 + 372 : x0 + 22, gw = D ? pw - 372 - 24 : pw - 44;
    let fy = D ? dollTop + 10 : sumBottom + 22;
    if (this.battle && this.o.runLoot) {
      this.button(gx + 60, fy, '行囊', 'item-tab-bag', () => { this.tab = 'bag'; this.page = 0; this.selected = null; this.render(); }, { active: this.tab === 'bag', size: 14 });
      this.button(gx + 170, fy, '本局缴获 ' + this.o.runLoot.length, 'item-tab-loot', () => { this.tab = 'loot'; this.page = 0; this.selected = null; this.render(); }, { active: this.tab === 'loot', size: 14 });
      fy += 40;
    }
    const filters: Array<ItemSlot | 'all'> = ['all', ...SLOT_ORDER], fw = (gw - 4 * 6) / 5;
    filters.forEach((f, i) => this.button(gx + fw / 2 + i * (fw + 6), fy, f === 'all' ? '全部' : SLOTS[f].name, 'item-filter-' + f, () => { this.filter = f; this.page = 0; this.render(); }, { active: this.filter === f, size: 13, w: fw - 24 }));
    const cell = D ? 60 : 72, gap = D ? 8 : 10, gcols = Math.max(1, Math.floor((gw + gap) / (cell + gap)));
    const gridTop = fy + 30, bottom = y0 + ph - (D ? 62 : 74), rows = Math.max(1, Math.floor((bottom - gridTop + gap) / (cell + gap))), per = gcols * rows;
    this.gridRect = { x: gx, y: gridTop - 8, w: gw, h: bottom - gridTop + 16 };
    const list = this.items(), pages = Math.max(1, Math.ceil(list.length / per)); this.page = Math.min(this.page, pages - 1);
    const offX = gx + (gw - (gcols * cell + (gcols - 1) * gap)) / 2, canWearLoot = this.tab === 'bag' || !!this.o.claimLoot;
    list.slice(this.page * per, this.page * per + per).forEach((item, i) => {
      const ix = offX + cell / 2 + (i % gcols) * (cell + gap), iy = gridTop + cell / 2 + Math.floor(i / gcols) * (cell + gap);
      const tile = this.add(itemTile(this.scene, ix, iy, cell, item, undefined, { selected: item.uid === this.selected }));
      tile.setName('item-cell-' + i).setData('uid', item.uid).setSize(cell, cell).setInteractive({ useHandCursor: true });
      this.tapOrDrag(tile, () => this.select(item.uid), canWearLoot ? { item } : undefined);
      const owner = this.tab === 'bag' ? equippedBy(s, item.uid) : undefined;
      if (owner) this.text(ix - cell / 2 + 3, iy + cell / 2 - 3, CHARACTERS.find(c => c.id === owner)?.name.slice(0, 1) ?? '装', 11, '#1c140a').setOrigin(0, 1).setBackgroundColor('#d7b46a').setPadding(2, 0);
    });
    if (!list.length) this.text(gx + gw / 2, gridTop + 60, this.tab === 'loot' ? '本局尚未缴获兵装\n击败精锐、首领或打开宝箱可得' : '行囊空空\n战斗中击败精锐、首领、打开宝箱可得兵装', 15, '#9c8c6c').setOrigin(.5).setAlign('center');
    const pageY = y0 + ph - (D ? 36 : 44);
    this.button(gx + 30, pageY, '‹', 'item-page-prev', () => { this.page = Math.max(0, this.page - 1); this.render(); }, { disabled: this.page === 0, size: 16 });
    this.text(gx + 82, pageY, `${this.page + 1} / ${pages}`, 14, '#cdb98a').setOrigin(.5).setName('item-page');
    this.button(gx + 134, pageY, '›', 'item-page-next', () => { this.page = Math.min(pages - 1, this.page + 1); this.render(); }, { disabled: this.page >= pages - 1, size: 16 });
    if (this.tab === 'bag') {
      this.button(gx + gw - (D ? 196 : 208), pageY, `自动分解白：${s.autoSalvageWhite ? '开' : '关'}`, 'item-auto-white', () => { setAutoSalvageWhite(!s.autoSalvageWhite); this.notice = s.autoSalvageWhite ? '已关闭：白色兵装照常收入行囊' : '已开启：之后的白色兵装收入时直接折成钱'; this.render(); }, { size: 13, active: s.autoSalvageWhite });
      this.button(gx + gw - 62, pageY, '分解白 / 绿', 'item-salvage-low', () => { const m = salvageUpTo('green'); this.notice = m ? `分解完成 · 钱 +${m}` : '没有可分解的白 / 绿兵装（已穿戴的不会分解）'; this.selected = null; this.render(); }, { size: 13 });
    }
    if (this.notice) { const n = this.text(W / 2, pageY - (D ? 34 : 40), this.notice, 14, '#f3d48a').setOrigin(.5, 1).setAlign('center').setBackgroundColor('#1b120bcc').setPadding(10, 4).setName('item-notice'); this.notice = ''; this.scene.time.delayedCall(2600, () => n.active && n.setVisible(false)); }

    if (this.selected === 'stable') this.renderStable();
    else if (this.selected?.startsWith('treasure:')) this.renderTreasure(Number(this.selected.slice(9)));
    else if (this.selected) this.renderDetail(this.selected);
    this.markPadDefault(prevName);
  }

  /** 武将立绘（缺图时只写名字）。 */
  private portrait(cx: number, top: number, w: number, h: number): void {
    const c = CHARACTERS.find(x => x.id === this.hero), g = this.add(this.scene.add.graphics());
    g.fillStyle(0x2a1c10, .55).fillRoundedRect(cx - w / 2, top, w, h, 10); g.lineStyle(1, 0x6b5a40, .6).strokeRoundedRect(cx - w / 2, top, w, h, 10);
    const key = c && [`epic_hero_${c.id}`, c.portrait].find(k => this.scene.textures.exists(k));
    if (key) {
      const img = this.add(this.scene.add.image(cx, top + h - 4, key).setOrigin(.5, 1)), src = img.texture.getSourceImage() as { width: number; height: number };
      img.setScale(Math.min((w - 8) / src.width, (h - 8) / src.height)).setName('item-portrait');
    }
    this.text(cx, top + h - 6, c?.name ?? '', 15, '#f2ddae', true).setOrigin(.5, 1).setStroke('#140d07', 4);
  }

  /**
   * 轻点 = onTap；拖动（drag 给出道具）= 拖到装备槽穿戴 / 从槽拖回行囊卸下。
   * 轻点用 pointerup 触发（手柄 Ⓐ 依次发 pointerdown + pointerup）；拖过的那次 pointerup 忽略。
   */
  private tapOrDrag(tile: Phaser.GameObjects.Container, onTap: () => void, drag?: { item: ItemInstance; fromSlot?: ItemSlot }): void {
    tile.on('pointerup', () => { if (tile.getData('dragged')) { tile.setData('dragged', false); return; } onTap(); });
    if (!drag) return;
    this.scene.input.setDraggable(tile);
    const home = { x: tile.x, y: tile.y }, slotOf = drag.fromSlot ?? itemSlot(drag.item);
    tile.on('dragstart', () => { tile.setData('dragged', true); this.body.bringToTop(tile); tile.setScale(1.08); this.showDragHints(slotOf, !!drag.fromSlot); });
    tile.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      tile.setPosition(dx, dy);
      const hit = this.slotAt(dx, dy), cur = hit && hit.slot === slotOf && !drag.fromSlot ? loadout(this.hero)[slotOf] : undefined;
      const tip = cur && cur.uid !== drag.item.uid ? this.compare(drag.item, cur) : hit && hit.slot === slotOf && !drag.fromSlot ? '放下穿戴' : drag.fromSlot && this.inGrid(dx, dy) ? '放下卸下' : '';
      this.dragTip?.setText(tip).setPosition(dx + 40, dy - 30).setVisible(!!tip);
    });
    tile.on('dragend', () => {
      this.dragHints?.destroy(); this.dragTip?.destroy(); this.dragHints = this.dragTip = undefined;
      const hit = this.slotAt(tile.x, tile.y);
      if (!drag.fromSlot && hit?.slot === slotOf) { if (this.wear(drag.item)) { this.selected = null; this.render(); return; } }
      else if (drag.fromSlot && this.inGrid(tile.x, tile.y)) { this.takeOff(drag.fromSlot); this.selected = null; this.render(); return; }
      else if (hit && hit.slot !== slotOf) this.notice = `${itemName(drag.item)} 是${SLOTS[slotOf].name}，只能放进${SLOTS[slotOf].name}槽`;
      this.scene.tweens.add({ targets: tile, x: home.x, y: home.y, scale: 1, duration: 140, onComplete: () => { if (this.notice) this.render(); } });
    });
  }
  private slotAt(x: number, y: number): SlotRect | undefined { return this.slotRects.find(r => Math.abs(x - r.x) <= r.size / 2 + 8 && Math.abs(y - r.y) <= r.size / 2 + 8); }
  private inGrid(x: number, y: number): boolean { const g = this.gridRect; return x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h; }
  /** 拖动中：能放的槽发金光，不能放的压暗；从槽拖出时行囊区发光。 */
  private showDragHints(slot: ItemSlot, fromSlot: boolean): void {
    const g = this.dragHints = this.add(this.scene.add.graphics()); this.body.sendToBack(g); this.body.moveUp(g);
    for (const r of this.slotRects) {
      if (!fromSlot && r.slot === slot) g.lineStyle(3, 0xf3d48a, 1).strokeRoundedRect(r.x - r.size / 2 - 5, r.y - r.size / 2 - 5, r.size + 10, r.size + 10, 9).fillStyle(0xf3d48a, .18).fillRoundedRect(r.x - r.size / 2 - 5, r.y - r.size / 2 - 5, r.size + 10, r.size + 10, 9);
      else if (!fromSlot) g.fillStyle(0x000000, .5).fillRoundedRect(r.x - r.size / 2, r.y - r.size / 2, r.size, r.size, 7);
    }
    if (fromSlot) { const b = this.gridRect; g.lineStyle(2, 0xf3d48a, .8).strokeRoundedRect(b.x, b.y, b.w, b.h, 8).fillStyle(0xf3d48a, .06).fillRoundedRect(b.x, b.y, b.w, b.h, 8); }
    this.dragTip = this.text(0, 0, '', 13, '#ffe9bd').setBackgroundColor('#1b120bee').setPadding(8, 4).setLineSpacing(2).setVisible(false).setName('item-drag-tip');
  }

  /** 手柄默认焦点：卡片 → 穿戴 / 卸下 / 骑乘 / 关闭；否则回到刚看过的道具，再否则沿用重绘前的焦点、第一格、关闭。 */
  private markPadDefault(prevName: string | null): void {
    const find = (root: Phaser.GameObjects.Container, pred: (o: Phaser.GameObjects.GameObject) => boolean): Phaser.GameObjects.GameObject | null => {
      for (const o of root.list) { if (o.input?.enabled && pred(o)) return o; if (o instanceof Phaser.GameObjects.Container) { const r = find(o, pred); if (r) return r; } }
      return null;
    };
    const card = this.body.getByName('item-detail') as Phaser.GameObjects.Container | null, byName = (n: string) => (o: Phaser.GameObjects.GameObject) => o.name === n;
    let target: Phaser.GameObjects.GameObject | null = null;
    if (card) target = (prevName ? find(card, byName(prevName)) : null) ?? find(card, byName('item-equip')) ?? find(card, byName('item-unequip')) ?? find(card, o => o.name.startsWith('stable-ride-')) ?? find(card, byName('item-detail-close'));
    else {
      if (this.lastUid) {
        // 同一件道具可能同时在装备槽和行囊格里：先回到打开详情时所在的那个，再找行囊格，最后装备槽
        const uid = this.lastUid, from = this.lastFrom, mine = (o: Phaser.GameObjects.GameObject) => o.getData('uid') === uid || o.name === from;
        target = (from ? find(this.body, o => mine(o) && o.name === from) : null) ?? find(this.body, o => o.getData('uid') === uid && o.name.startsWith('item-cell-')) ?? find(this.body, o => o.getData('uid') === uid && o.name.startsWith('item-slot-'));
        this.lastUid = null;
      }
      if (!target && prevName) target = find(this.body, byName(prevName));
      target ??= find(this.body, byName('item-cell-0')) ?? find(this.body, byName('item-bag-close'));
    }
    target?.setData('padDefault', true);
  }

  private select(id: string): void { this.lastUid = id; this.lastFrom = padNavigator()?.focused?.name ?? null; this.selected = this.selected === id ? null : id; this.render(); }
  private closeDetail(): void { this.lastUid = this.selected; this.selected = null; this.render(); }

  /** 详情卡底板 + 关闭按钮；返回卡片容器与左上角。 */
  private card(cw: number, est: number): { card: Phaser.GameObjects.Container; x: number; y: number; g: Phaser.GameObjects.Graphics } {
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const card = this.scene.add.container(0, 0).setScrollFactor(0).setName('item-detail'); this.body.add(card);
    this.add(this.scene.add.rectangle(0, 0, W, H, 0x000000, .45).setOrigin(0).setInteractive(), card).on('pointerdown', () => this.closeDetail());
    const x = (W - cw) / 2, y = Math.max(16, (H - est) / 2), g = this.add(this.scene.add.graphics(), card);
    return { card, x, y, g };
  }
  private plainFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(0x1b120b, .97).fillRoundedRect(x, y, w, h, 10); g.lineStyle(2, 0xc9a35e, .9).strokeRoundedRect(x, y, w, h, 10);
  }

  private renderTreasure(i: number): void {
    const t = this.o.treasures?.[i], cw = IS_DESKTOP ? 380 : 460, { card, x, y, g } = this.card(cw, 200);
    const body = t ? t.desc : this.battle ? '这一格还空着。升级三选一里的「宝物」或行营军需商人可得，最多 2 件。' : '宝物只在本局有效：出征后在升级三选一或行营军需商人处获得，最多 2 件，结算后不保留。';
    this.text(x + 26, y + 22, t ? t.name : '本局宝物', 22, '#f3d48a', true, card).setName('item-detail-name');
    this.text(x + 26, y + 56, t ? '宝物 · 本局有效' : '宝物位', 13, '#b9a57a', false, card);
    const txt = this.text(x + 26, y + 86, body, 15, '#e9dcbc', false, card).setWordWrapWidth(cw - 52).setLineSpacing(5);
    this.plainFrame(g, x, y, cw, txt.y + txt.height - y + 30);
    this.button(x + cw - 30, y + 28, '×', 'item-detail-close', () => this.closeDetail(), { parent: card, size: 16 });
  }

  /** 马厩：拥有的马、每匹马的固定加成与骑乘特色；休整时可给当前武将换马。 */
  private renderStable(): void {
    const D = IS_DESKTOP, s = loadItems(), unlocked = stableUnlocked(), cols = D ? 2 : 1, rowH = D ? 60 : 44;
    const cw = D ? 860 : 500, rows = Math.ceil(HORSES.length / cols), est = 96 + rows * rowH + 40;
    const { card, x, y, g } = this.card(cw, est), heroName = CHARACTERS.find(c => c.id === this.hero)?.name ?? '';
    this.plainFrame(g, x, y, cw, est);
    this.text(x + 26, y + 18, '马厩', 24, '#f2ddae', true, card).setName('item-detail-name');
    const sub = !unlocked ? '第一章「黄巾之乱」通关后开放，并赠驽马一匹。之后的马靠各章首领首次击杀获得。'
      : !this.canChangeHorse ? '战斗中不可换马 · 在行营休整或主页行囊里换马' : `为 ${heroName} 选马 · 一匹马同时只归一名武将${this.battle ? ' · 下一关出征生效' : ''}`;
    this.text(x + 26, y + 54, sub, 13, '#b9a57a', false, card).setWordWrapWidth(cw - 90).setName('stable-hint');
    this.button(x + cw - 30, y + 28, '×', 'item-detail-close', () => this.closeDetail(), { parent: card, size: 16 });
    const cur = heroHorse(this.hero, s);
    HORSES.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols), cx = x + 20 + col * ((cw - 40) / cols), cy = y + 96 + row * rowH, cwid = (cw - 40) / cols - 10;
      const owned = s.stable.owned.includes(h.id), rider = owned ? horseRider(h.id, s) : undefined, mine = cur?.id === h.id, ic = horseIcon(this.scene, h.id), isz = D ? 46 : 36;
      const rg = this.add(this.scene.add.graphics(), card); rg.fillStyle(mine ? 0x4a2a14 : 0x2a1c10, owned ? .8 : .4).fillRoundedRect(cx, cy, cwid, rowH - 6, 6);
      const img = this.add(this.scene.add.image(cx + 6 + isz / 2, cy + (rowH - 6) / 2, ic.key, ic.frame).setDisplaySize(isz, isz), card).setAlpha(owned ? 1 : .3);
      if (!ic.art) img.setTint(mountStyle(h.id).tint);
      const nameX = cx + isz + 16;
      this.text(nameX, cy + 4, (h.legend ? '★ ' : '') + h.name + (rider ? ` · ${CHARACTERS.find(c => c.id === rider)?.name ?? ''}骑乘` : ''), D ? 15 : 14, owned ? (h.legend ? '#f2a24e' : '#ecd49a') : '#6f6250', false, card).setName('stable-name-' + h.id);
      const style = mountStyle(h.id).ride;
      this.text(nameX, cy + (D ? 26 : 23), owned ? horseBonusText(h) + (style ? ' · ' + style.replace(/^[^：]+：/, '') : '') : '未获得 · ' + h.lore, 11, owned ? '#d8ccb0' : '#6f6250', false, card).setWordWrapWidth(cwid - isz - 110).setMaxLines(D ? 2 : 1);
      if (owned && unlocked && this.canChangeHorse) this.button(cx + cwid - 46, cy + (rowH - 6) / 2, mine ? '下马' : '骑乘', mine ? 'stable-dismount' : 'stable-ride-' + h.id, () => {
        rideHorse(this.hero, mine ? null : h.id); this.notice = mine ? `${heroName} 已下马` : `${heroName} 骑乘 ${h.name}${this.battle ? ' · 下一关出征生效' : ''}`; this.o.onGearChange?.(); this.render();
      }, { parent: card, size: 14, active: !mine, w: 50 });
    });
  }

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
    if (compare) { this.text(x + 26, ty, `对比当前（${itemName(current!)}）`, 13, '#b9a57a', false, card); this.text(x + 26, ty + 20, compare, 13, '#d8ccb0', false, card).setLineSpacing(2).setName('item-detail-compare'); ty += 22 + compare.split('\n').length * 18; }
    const ch = ty - y + 58, by = y + ch - 32;
    drawQualityFrame(g, x, y, cw, ch, item.quality, { hover: true });
    g.fillStyle(0x1b120b, .9).fillRoundedRect(x + 6, y + 6, cw - 12, ch - 12, 6);
    g.lineStyle(1, q.color, .5).strokeRoundedRect(x + 6, y + 6, cw - 12, ch - 12, 6);
    // 关闭（手柄 Ⓑ 也走这里）
    this.button(x + cw - 30, y + 28, '×', 'item-detail-close', () => this.closeDetail(), { parent: card, size: 16 });
    if (!inBag) { // 本局缴获
      if (this.o.claimLoot) this.button(x + cw / 2, by, '穿上 · 收入行囊', 'item-equip', () => { if (this.wear(item)) { this.lastUid = item.uid; this.selected = null; this.render(); } }, { parent: card, size: 16 });
      else this.text(x + cw / 2, by, this.battle ? '测试战斗的缴获不入行囊' : '结算后收入行囊', 13, '#9c8c6c', false, card).setOrigin(.5);
      return;
    }
    const wornHere = current?.uid === item.uid;
    this.button(x + cw * .3, by, wornHere ? '卸下' : '穿戴', wornHere ? 'item-unequip' : 'item-equip', () => {
      if (wornHere) this.takeOff(slot); else this.wear(item);
      this.lastUid = item.uid; this.selected = null; this.render();
    }, { parent: card, size: 16 });
    this.button(x + cw * .7, by, owner ? '已穿戴不可分解' : `分解 · 钱 +${q.salvage}`, 'item-salvage', () => { const m = salvageItems([item.uid]); this.notice = `分解 ${itemName(item)} · 钱 +${m}`; this.selected = null; this.render(); }, { parent: card, size: 14, disabled: !!owner });
  }

  /** 与当前同槽装备的词条差，如「▲ 生命上限 +2.1%」「▼ 暴击率 −1.0%」。 */
  private compare(item: ItemInstance, current?: ItemInstance): string {
    if (!current) return '';
    const sum = (i: ItemInstance) => { const m = new Map<AffixId, number>(); for (const a of i.affixes) m.set(a.id, (m.get(a.id) ?? 0) + a.value); return m; };
    const a = sum(item), b = sum(current), ids = [...new Set([...a.keys(), ...b.keys()])];
    return ids.map(id => { const d = (a.get(id) ?? 0) - (b.get(id) ?? 0); if (Math.abs(d) < 1e-4) return ''; const f = AFFIXES[id], v = f.percent ? `${Math.round(Math.abs(d) * 1000) / 10}%` : Math.abs(d).toFixed(1);
      return `${d > 0 ? '▲' : '▼'} ${f.name} ${d > 0 ? '+' : '−'}${v}`; }).filter(Boolean).join('\n');
  }
}
