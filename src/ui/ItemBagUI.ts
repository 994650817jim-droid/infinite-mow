import Phaser from 'phaser';
import { inkSkin } from './HomeCommand';
import { charmText } from '../data/charms';
import { gearOwners, ownerName } from '../systems/RosterStore';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { CHARACTERS, HOME_ART_HEROES, type CharacterId } from '../data/characters';
import { AFFIXES, BAG_CAPACITY, LEGENDS, QUALITIES, QUALITY_ORDER, SLOTS, SLOT_ORDER, SPECIALS, formatAffix, itemDef, itemName, itemSlot, type AffixId, type ItemInstance, type ItemSlot } from '../data/items';
import { rewardGrain } from '../world/WorldStore';
import { HORSES, horseQuality, mountStyle } from '../data/mounts';
import { gearFromItems, gearSummary, horseBonusText } from '../systems/ItemEffects';
import { type GearOwner, type LoadoutKey, LOADOUT_KEYS, equipTarget, keySlot, tokenSlots, equipItem, equippedBy, heroHorse, horseRider, legacyValue, loadItems, salvageLegacy, loadout, looseCount, markBagSeen, rideHorse, salvageItems, salvageUpTo, setAutoSalvageWhite, stableUnlocked, takeItemNotice, takeStableAnnouncement, unequipSlot } from '../systems/ItemStore';
import { bagArt, drawQualityArt, drawQualityFrame, ensureItemTextures, horseIcon, itemIconKey, itemTile, loadBagArt, type IconSlot } from './ItemQuality';
import { lqHitBox, lqPanel, lqSkin } from './LacquerKit';
import { padNavigator } from './PadNavigator';
import { ItemTooltip, compareLines } from './ItemTooltip';

/** 本局宝物（战法宝物 / 饰品）的显示条目，由 GameScene 提供。 */
export interface ItemBagOptions {
  hero: CharacterId;
  /** 本局缴获（战斗中）。 */
  runLoot?: ItemInstance[];
  /** 战斗中打开：只看当前武将；可换装，坐骑除外（atRest = 行营休整，可换马）。 */
  battle?: boolean; atRest?: boolean;
  /** 战斗中穿上缴获（收入行囊并穿上）；测试战斗不提供。 */
  claimLoot?: (item: ItemInstance) => boolean;
  /** 换装 / 换马后通知战斗场景重算加成。 */
  onGearChange?: () => void;
  /** 打开时直接显示马厩（主城马厩建筑调用 openStable）。 */
  stable?: boolean;
  onClose?: () => void;
}

const qIndex = (i: ItemInstance) => QUALITY_ORDER.indexOf(i.quality);

/** 马厩入口（主城马厩建筑、主页等调用）：打开行囊并直接显示马厩。 */
export function openStable(scene: Phaser.Scene, hero: CharacterId, onClose?: () => void): ItemBagUI { return new ItemBagUI(scene, { hero, stable: true, onClose }); }

/**
 * 行囊面板（2026-11-16 改版，RPG 纸娃娃）：
 * - 左 / 上：武将立绘，四周 4 个兵装槽（头盔、甲胄、战靴、信物）+ 坐骑位 + 本局宝物 2 格，下方加成汇总；
 * - 右 / 下：行囊网格（槽位筛选、翻页；战斗中可切「本局缴获」）。
 * 点道具弹详情卡（穿戴 / 卸下 / 分解 / 对比）；鼠标悬停显示属性提示框（含与当前穿戴的对比）；2026-11-16 起去掉拖拽穿戴。
 * 坐骑位打开马厩：第一章通关后开放，只在休整时（主页、行营休整）可换马。
 * 电脑 960×540 左右分栏，手机 540×H 上下排列。命名的命中区供测试与手柄使用。
 */
export class ItemBagUI {
  readonly root: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private hero: GearOwner;
  private filter: ItemSlot | 'all' = 'all';
  private page = 0;
  /** 选中：道具 uid、'stable'、'legacy'。 */
  private selected: string | null = null;
  private notice = '';
  /** 详情卡关掉后手柄焦点回到这件道具的格子。 */
  private lastUid: string | null = null;
  private lastFrom: string | null = null;
  /** 悬停属性提示框（电脑鼠标；手柄焦点也会触发）。 */
  private readonly tip: ItemTooltip;

  constructor(private readonly scene: Phaser.Scene, private readonly o: ItemBagOptions) {
    ensureItemTextures(scene);
    this.hero = o.hero;
    if (o.stable) this.selected = 'stable';
    this.root = scene.add.container(0, 0).setDepth(DEPTH.overlay + 20).setScrollFactor(0).setName('item-bag').setData('ui', this);
    const notes = [takeItemNotice(), takeStableAnnouncement() ? '马厩已开放 · 获赠驽马（点坐骑位换马）' : undefined].filter(Boolean);
    this.notice = notes.join('\n');
    markBagSeen();
    this.tip = new ItemTooltip(scene, DEPTH.overlay + 30);
    this.render();
  }

  close(): void { this.tip.destroy(); this.root.destroy(); this.o.onClose?.(); }

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
    const skin = (IS_DESKTOP ? inkSkin(this.scene, t, () => ({ w: bw, h: bh }), { active: () => !!o.active, enabled: () => !o.disabled }) : null) ?? lqSkin(this.scene, t, t, () => ({ w: bw, h: bh }), { tone: o.active ? 'cinnabar' : 'quiet', on: () => !!o.active, enabled: () => !o.disabled }); // 电脑版水墨（2026-11-17 UI 审查 N）
    skin.gfx.setScrollFactor(0); parent.addAt(skin.gfx, parent.getIndex(t));
    return t;
  }

  /** 是否本局缴获（战斗中拾取、尚未收入行囊）。 */
  private isLoot(uid: string): boolean { return !!this.o.runLoot?.some(i => i.uid === uid); }
  /** 行囊网格：战斗中把本局缴获并进来排在最前（角上标「新」），其余按品质排序。 */
  private items(): ItemInstance[] {
    const byQuality = (a: ItemInstance, b: ItemInstance) => qIndex(b) - qIndex(a) || SLOT_ORDER.indexOf(itemSlot(a)) - SLOT_ORDER.indexOf(itemSlot(b)) || itemName(a).localeCompare(itemName(b));
    const pick = (l: ItemInstance[]) => l.filter(i => this.filter === 'all' || itemSlot(i) === this.filter).sort(byQuality);
    return [...pick([...(this.o.runLoot ?? [])]), ...pick(loadItems().bag)];
  }

  /** 穿戴（行囊里的）或穿上缴获（战斗中）。返回是否成功。 */
  private wear(item: ItemInstance): boolean {
    const inBag = loadItems().bag.some(i => i.uid === item.uid);
    const ok = inBag ? equipItem(this.hero, item.uid) : !!this.o.claimLoot?.(item);
    if (ok) { this.notice = `${ownerName(this.hero)} 穿戴 ${itemName(item)}${inBag ? '' : ' · 已收入行囊'}`; this.o.onGearChange?.(); }
    return ok;
  }
  private takeOff(slot: LoadoutKey): void { if (unequipSlot(this.hero, slot)) { this.notice = '已卸下'; this.o.onGearChange?.(); } }

  render(): void {
    // 手柄：重绘前记住焦点对象的名字，重绘后把同名对象设为默认焦点（PadNavigator 会在旧对象销毁后取默认）
    const prev = padNavigator()?.focused, prevName = prev && (prev.name.startsWith('item-') || prev.name.startsWith('stable-')) ? prev.name : null;
    this.tip?.hide();
    this.body?.destroy();
    this.body = this.scene.add.container(0, 0).setScrollFactor(0); this.root.add(this.body);
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP, s = loadItems();
    const dim = this.add(this.scene.add.rectangle(0, 0, W, H, 0x0b0805, .86).setOrigin(0).setInteractive());
    dim.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const x0 = D ? 18 : 10, y0 = D ? 12 : 14, pw = W - x0 * 2, ph = H - y0 * 2;
    lqPanel(this.add(this.scene.add.graphics()), x0, y0, pw, ph);
    { const bg = D && bagArt(this.scene, 'panel_bg'); if (bg) this.add(this.scene.add.image(x0 + pw / 2, y0 + ph / 2, bg).setDisplaySize(pw + 8, ph + 8)); }

    // 标题 + 计数（只算未穿戴的）+ 关闭
    this.text(x0 + 28, y0 + (D ? 18 : 22), '行囊', D ? 26 : 30, '#f2ddae', true);
    const loose = looseCount(s), over = loose > BAG_CAPACITY;
    this.text(x0 + (D ? 100 : 108), y0 + (D ? 28 : 34), `未穿戴 ${loose} / ${BAG_CAPACITY}${over ? ' · 已超出，请分解' : ''}${this.battle ? (this.o.atRest ? ' · 休整中' : ' · 战斗中可换装') : ''}`, 13, over ? '#f08a6a' : '#b9a57a').setName('item-bag-count');
    this.button(x0 + pw - (D ? 52 : 56), y0 + (D ? 32 : 40), '返回', 'item-bag-close', () => this.close(), { size: D ? 15 : 17 });
    // 旧物（旧档的兵刃挂饰、重复的马）：原样保留，点开可按双倍价分解
    if (s.legacy.length) this.button(x0 + pw - (D ? 170 : 176), y0 + (D ? 32 : 40), `旧物 ${s.legacy.length}`, 'item-legacy', () => this.select('legacy'), { size: D ? 14 : 15 });

    const pageY = D ? this.renderDesk(s, x0, y0, pw, ph) : this.renderMobile(s, x0, y0, pw, ph);
    if (this.notice) { const n = this.text(W / 2, pageY - (D ? 34 : 40), this.notice, 14, '#f3d48a').setOrigin(.5, 1).setAlign('center').setBackgroundColor('#1b120bcc').setPadding(10, 4).setName('item-notice'); this.notice = ''; this.scene.time.delayedCall(2600, () => n.active && n.setVisible(false)); }

    if (this.selected === 'stable') this.renderStable();
    else if (this.selected === 'legacy') this.renderLegacy();
    else if (this.selected) this.renderDetail(this.selected);
    this.markPadDefault(prevName);
  }

  /** 手机布局（原版，未改）。返回底部按钮行的 y。 */
  private renderMobile(s: ReturnType<typeof loadItems>, x0: number, y0: number, pw: number, ph: number): number {
    const W = GAME_WIDTH, D = IS_DESKTOP;
    // 武将切换（战斗中只看出征的武将）
    const heroY = y0 + (D ? 70 : 90);
    const owners = gearOwners(), heroRows = Math.ceil(Math.max(1, owners.length) / (D ? 10 : 5));
    if (!this.battle) {
      const per = D ? 10 : 5, chipW = D ? 80 : 92, gap = 8, rowW = per * chipW + (per - 1) * gap, sx = W / 2 - rowW / 2 + chipW / 2;
      owners.forEach((c, i) => {
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
    // Boss遗物：右下，与左下坐骑位对称；第二信物：下排正中（原「本局宝物」位，2026-11-17 本局宝物改为信物）
    const place: Record<LoadoutKey, [number, number]> = { helm: [lx, rowY(0)], armor: [lx, rowY(1)], boots: [rx, rowY(0)], token: [rx, rowY(1)], relic: [rx, rowY(2)], token2: [cx, rowY(2)] };
    const twoTokens = tokenSlots() > 1;
    for (const slot of LOADOUT_KEYS) {
      const [sx, sy] = place[slot], item = worn[slot] ?? null, locked = slot === 'token2' && !twoTokens, base = keySlot(slot);
      const tile = this.add(itemTile(this.scene, sx, sy, size, item, base, { selected: !!item && item.uid === this.selected }));
      if (locked) tile.add(this.scene.add.text(size / 2 - 3, size / 2 - 3, '锁', { fontFamily: FONT, fontSize: '12px', color: '#1c140a', backgroundColor: '#b9a57a', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0)).setAlpha(.7);
      tile.setName('item-slot-' + slot).setData('uid', item?.uid ?? null).setSize(size, size).setInteractive({ useHandCursor: true });
      this.onTap(tile, () => { if (item) this.select(item.uid); else if (locked) { this.notice = '第二信物位：第二章通关后开放'; this.render(); } else { this.filter = base; this.page = 0; this.notice = `行囊已筛选 · ${SLOTS[base].name}（点道具穿戴）`; this.render(); } });
      if (item) this.tip.attach(tile, () => item, () => item);
      const name = slot === 'token2' ? (locked ? '信物·二 · 二章通关开放' : '信物·二') : SLOTS[slot].name;
      this.text(sx, sy + size / 2 + 10, item ? itemName(item) : name, 12, item ? QUALITIES[item.quality].css : '#8d7d60').setOrigin(.5).setName('item-slot-label-' + slot);
    }
    // 坐骑位
    const my = rowY(2), mountTile = this.add(this.scene.add.container(lx, my));
    const mg = this.scene.add.graphics(); drawQualityFrame(mg, -size / 2, -size / 2, size, size, horse ? horseQuality(HORSES.find(h => h.id === horse.id)) : null); mountTile.add(mg);
    const unlocked = stableUnlocked();
    if (horse) { const ic = horseIcon(this.scene, horse.id), k = ic.art ? .84 : .72; mountTile.add(this.scene.add.image(0, 0, ic.key, ic.frame).setDisplaySize(size * k, size * k).setTint(ic.art ? 0xffffff : mountStyle(horse.id).tint)); }
    else mountTile.add(this.scene.add.image(0, 0, itemIconKey('mount')).setDisplaySize(size * .72, size * .72).setAlpha(.22));
    if (!unlocked || !this.canChangeHorse || this.hero.startsWith('r_')) mountTile.add(this.scene.add.text(size / 2 - 3, size / 2 - 3, '锁', { fontFamily: FONT, fontSize: '12px', color: '#1c140a', backgroundColor: '#b9a57a', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0));
    mountTile.setName('item-slot-mount').setSize(size, size).setInteractive({ useHandCursor: true }); this.onTap(mountTile, () => this.select('stable'));
    this.text(lx, my + size / 2 + 10, !unlocked ? '坐骑 · 一章通关开放' : horse ? horse.name : '坐骑', 12, horse ? '#f3c37a' : '#8d7d60').setOrigin(.5).setName('item-slot-label-mount');
    // 加成汇总
    const gear = gearFromItems(Object.values(worn).filter((i): i is ItemInstance => !!i), horse);
    const sumX = x0 + 28, sumY = my + size / 2 + (D ? 26 : 30), lines = gearSummary(gear);
    this.text(sumX, sumY, '兵装加成', D ? 14 : 15, '#ecd49a', true);
    const half = Math.ceil(lines.length / 2), cols = D && lines.length > 3 ? [lines.slice(0, half), lines.slice(half)] : [lines];
    // 手机：一行接一行；词条内用不换行空格，避免「受到伤 / 害」被拆开
    const sumText = lines.length ? (D ? cols.map(c => c.join('\n')) : [lines.map(l => l.replace(/ /g, ' ')).join('　 ')]) : ['尚未穿戴兵装 · 点行囊中的道具穿戴'];
    const sum = this.text(sumX + (D ? 0 : 0), sumY + 22, sumText[0], D ? 12 : 13, '#d8ccb0').setWordWrapWidth(D ? 320 : pw - 56).setLineSpacing(3).setName('item-gear-summary');
    if (sumText[1]) this.text(sumX + 168, sumY + 22, sumText[1], 12, '#d8ccb0').setLineSpacing(3).setName('item-gear-summary-2');
    let sumBottom = sum.y + sum.height;
    if (gear.specials.length) { const sp = this.text(sumX, sumBottom + 4, '★ ' + gear.specials.map(id => SPECIALS[id].name).join(' · ★ ') + '（点道具看详情）', 12, '#f3c37a').setWordWrapWidth(D ? 320 : pw - 56).setName('item-gear-specials'); sumBottom = sp.y + sp.height; }

    // 行囊网格
    const gx = D ? x0 + 372 : x0 + 22, gw = D ? pw - 372 - 24 : pw - 44;
    let fy = D ? dollTop + 10 : sumBottom + 22;
    const filters: Array<ItemSlot | 'all'> = ['all', ...SLOT_ORDER], fw = (gw - (filters.length - 1) * 6) / filters.length;
    filters.forEach((f, i) => this.button(gx + fw / 2 + i * (fw + 6), fy, f === 'all' ? '全部' : SLOTS[f].name, 'item-filter-' + f, () => { this.filter = f; this.page = 0; this.render(); }, { active: this.filter === f, size: 13, w: fw - 24 }));
    const cell = D ? 60 : 72, gap = D ? 8 : 10, gcols = Math.max(1, Math.floor((gw + gap) / (cell + gap)));
    const gridTop = fy + 30, bottom = y0 + ph - (D ? 62 : 74), rows = Math.max(1, Math.floor((bottom - gridTop + gap) / (cell + gap))), per = gcols * rows;
    const list = this.items(), pages = Math.max(1, Math.ceil(list.length / per)); this.page = Math.min(this.page, pages - 1);
    const offX = gx + (gw - (gcols * cell + (gcols - 1) * gap)) / 2;
    list.slice(this.page * per, this.page * per + per).forEach((item, i) => {
      const ix = offX + cell / 2 + (i % gcols) * (cell + gap), iy = gridTop + cell / 2 + Math.floor(i / gcols) * (cell + gap);
      const tile = this.add(itemTile(this.scene, ix, iy, cell, item, undefined, { selected: item.uid === this.selected }));
      tile.setName('item-cell-' + i).setData('uid', item.uid).setSize(cell, cell).setInteractive({ useHandCursor: true });
      const loot = this.isLoot(item.uid);
      this.onTap(tile, () => this.select(item.uid));
      this.tip.attach(tile, () => item, () => loadout(this.hero)[equipTarget(this.hero, item)]);
      // 本局缴获：左上角淡金「新」字（穿上即收入行囊；没穿的结算时按原规则带回）
      if (loot) tile.setData('loot', true).add(this.scene.add.text(-cell / 2 + 3, -cell / 2 + 2, '新', { fontFamily: HEADING_FONT, fontSize: '12px', color: '#2a1a08', backgroundColor: '#f3d48acc', resolution: 2 }).setPadding(3, 0).setName('item-new-badge'));
      const owner = loot ? undefined : equippedBy(s, item.uid);
      if (owner) this.text(ix - cell / 2 + 3, iy + cell / 2 - 3, (ownerName(owner).slice(0, 1) || '装'), 11, '#1c140a').setOrigin(0, 1).setBackgroundColor('#d7b46a').setPadding(2, 0);
    });
    if (!list.length) this.text(gx + gw / 2, gridTop + 60, '行囊空空\n战斗中击败精锐、首领、打开宝箱可得兵装', 15, '#9c8c6c').setOrigin(.5).setAlign('center');
    const pageY = y0 + ph - (D ? 36 : 44);
    this.button(gx + 30, pageY, '‹', 'item-page-prev', () => { this.page = Math.max(0, this.page - 1); this.render(); }, { disabled: this.page === 0, size: 16 });
    this.text(gx + 82, pageY, `${this.page + 1} / ${pages}`, 14, '#cdb98a').setOrigin(.5).setName('item-page');
    this.button(gx + 134, pageY, '›', 'item-page-next', () => { this.page = Math.min(pages - 1, this.page + 1); this.render(); }, { disabled: this.page >= pages - 1, size: 16 });
    {
      this.button(gx + gw - (D ? 196 : 208), pageY, `自动分解白：${s.autoSalvageWhite ? '开' : '关'}`, 'item-auto-white', () => { setAutoSalvageWhite(!s.autoSalvageWhite); this.notice = s.autoSalvageWhite ? '已关闭：白色兵装照常收入行囊' : '已开启：之后的白色兵装收入时直接折成军粮'; this.render(); }, { size: 13, active: s.autoSalvageWhite });
      this.button(gx + gw - 62, pageY, '分解白 / 绿', 'item-salvage-low', () => { const m = salvageUpTo('green'); this.notice = m ? `分解完成 · 军粮 +${rewardGrain(0, 0, m)}` : '没有可分解的白 / 绿兵装（已穿戴的不会分解）'; this.selected = null; this.render(); }, { size: 13 });
    }
    return pageY;
  }

  // ———— 电脑布局（2026-11-17 美术重设计，用户批准「按效果图做」，见 assets/review/ui-round11/PROPOSAL.md）————
  // 立绘居中站在卷轴纸上，槽位围着身体（左 头盔 / 甲胄 / 信物 / 坐骑，右 遗珍 / 信物二 / 战靴），细金虚线引到身体部位；
  // 顶部圆形将印切换武将；右侧漆木行囊盘（带图标的筛选页签）；立绘下方兵装加成横幅。
  // 厚涂素材（bag/*.webp，画风会话在要）到位前用现有美术 + 代码描边过渡；只改表现，穿脱 / 对比 / 筛选逻辑与命名命中区不变。

  /** 现有美术按需加载（全身立绘、水墨立轴头像、卷轴纸），到了就重绘。 */
  private artQueued = false;
  private ensureBagArt(): void {
    const sc = this.scene, want: [string, string][] = [];
    if (!sc.textures.exists('ink_paper')) want.push(['ink_paper', 'assets/ink-scroll/paper.webp']);
    for (const id of new Set<string>([this.hero, ...gearOwners().map(o => o.id)])) {
      if (!(HOME_ART_HEROES as readonly string[]).includes(id)) continue;
      if (id === this.hero && !sc.textures.exists('epic_hero_' + id)) want.push(['epic_hero_' + id, 'assets/epic-home/' + id + '.webp']);
      if (!sc.textures.exists('ink_hero_' + id)) want.push(['ink_hero_' + id, 'assets/ink-scroll/' + id + '.webp']);
    }
    // 只排一次队：行囊厚涂素材 + 缺的立绘 / 头像 / 卷轴纸一起加载，全部到了重绘一次
    if (this.artQueued) return;
    const bagReady = loadBagArt(sc, () => undefined);
    if (bagReady && !want.length) return;
    this.artQueued = true;
    for (const [k, p] of want) sc.load.image(k, p);
    sc.load.once(Phaser.Loader.Events.COMPLETE, () => { this.artQueued = false; if (this.root.active) this.render(); });
    sc.load.start();
  }
  /** 圆形将印贴图：水墨立轴头像裁成圆（canvas 生成一次，缓存）。 */
  private medalKey(id: string): string | null {
    const key = 'bag_medal_' + id, sc = this.scene;
    if (sc.textures.exists(key)) return key;
    if (!sc.textures.exists('ink_hero_' + id)) return null;
    const src = sc.textures.get('ink_hero_' + id).getSourceImage() as HTMLImageElement, S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d')!; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
    const w = src.width, side = w * .62; g.drawImage(src, (w - side) / 2, src.height * .1, side, side, 0, 0, S, S);
    sc.textures.addCanvas(key, c); return key;
  }
  /** 细金虚线（Graphics 没有虚线，逐段画）。 */
  private dashed(g: Phaser.GameObjects.Graphics, pts: [number, number][]): void {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.floor(len / 6));
      for (let k = 0; k < n; k += 2) { const t1 = k / n, t2 = Math.min(1, (k + 1) / n); g.lineBetween(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1, x1 + (x2 - x1) * t2, y1 + (y2 - y1) * t2); }
    }
  }
  /** 槽名竖排朱红小牌。 */
  private slotTag(x: number, y: number, label: string): void {
    const t = this.text(x, y, [...label.replace(/[·\s]/g, '')].slice(0, 2).join('\n'), 11, '#ffe2a0', true).setOrigin(.5).setLineSpacing(-1);
    const w = 18, h = t.height + 10, tagArt = bagArt(this.scene, 'slot_tag');
    if (tagArt) this.add(this.scene.add.image(x, y, tagArt).setDisplaySize(w, h));
    else { const g = this.add(this.scene.add.graphics()); g.fillStyle(0x7a2a1c, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 2).lineStyle(1, 0xd8a868, .9).strokeRoundedRect(x - w / 2 + .5, y - h / 2 + .5, w - 1, h - 1, 2); }
    this.body.bringToTop(t);
  }

  private renderDesk(s: ReturnType<typeof loadItems>, x0: number, y0: number, pw: number, ph: number): number {
    this.ensureBagArt();
    const sc = this.scene;
    // 将印：一排圆形头像（战斗中只看出征的武将，不显示）
    if (!this.battle) {
      const owners = gearOwners(), r = 19, gap = 46, hy = y0 + 76, sx = x0 + 46;
      owners.forEach((c, i) => {
        const x = sx + i * gap, on = c.id === this.hero, worn = Object.keys(loadout(c.id, s)).length, g = this.add(sc.add.graphics());
        if (on) g.fillStyle(0xf3d48a, .25).fillCircle(x, hy, r + 7);
        g.fillStyle(0x1b120b, 1).fillCircle(x, hy, r + 3).lineStyle(on ? 2.5 : 1.5, on ? 0xf3d48a : 0x9a7a46, 1).strokeCircle(x, hy, r + 2.5);
        const key = this.medalKey(c.id);
        if (key) this.add(sc.add.image(x, hy, key).setDisplaySize(r * 2, r * 2)).setAlpha(on ? 1 : .78);
        else this.text(x, hy, c.name.replace(/（.*）/, '').slice(0, 1), 17, on ? '#fff3d6' : '#cdb98a', true).setOrigin(.5);
        if (on) g.lineStyle(1, 0x7a2a1c, 1).strokeCircle(x, hy, r + .5);
        const ring = bagArt(sc, on ? 'medal_frame_selected' : 'medal_frame'); if (ring) { g.clear(); this.add(sc.add.image(x, hy, ring).setDisplaySize(r * 2 * 120 / 80, r * 2 * 120 / 80)); }
        this.text(x, hy + r + 9, c.name.replace(/（.*）/, '') + (worn ? '·' + worn : ''), 11, on ? '#f3d48a' : '#b9a57a').setOrigin(.5);
        const hit = this.add(sc.add.circle(x, hy, r + 4, 0, .001)).setName('item-hero-' + c.id).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.hero = c.id; if (this.selected !== 'stable') this.selected = null; this.render(); });
      });
      this.text(x0 + pw - 30, y0 + 70, '点道具看详情 · 悬停看属性和对比', 11, '#8f8070').setOrigin(1, .5);
    }
    // 版面：左装束图 + 加成横幅，右行囊盘
    const dx = x0 + 22, dy = this.battle ? y0 + 58 : y0 + 112, dw = 430, sumH = 82, bottom = y0 + ph - 14, dh = bottom - sumH - 8 - dy;
    const tx = dx + dw + 14, ty = dy, tw = x0 + pw - 22 - tx, th = bottom - ty;
    // —— 装束图底：卷轴纸（缺图时暖色纸底）+ 暗角 + 铜边
    const paper = this.add(sc.add.graphics()); paper.fillStyle(0xcdb48a, 1).fillRoundedRect(dx, dy, dw, dh, 6);
    const paperKey = bagArt(sc, 'doll_paper') ?? (sc.textures.exists('ink_paper') ? 'ink_paper' : null);
    if (paperKey) { const img = this.add(sc.add.image(dx + dw / 2, dy + dh / 2, paperKey)); img.setScale(Math.max(dw / img.width, dh / img.height)); img.setCrop((img.width - dw / img.scaleX) / 2, (img.height - dh / img.scaleY) / 2, dw / img.scaleX, dh / img.scaleY); }
    const vig = this.add(sc.add.graphics());
    for (let i = 0; i < 10; i++) vig.lineStyle(6, 0x2a160a, .05 + i * .012).strokeRoundedRect(dx + 3 + i * 3, dy + 3 + i * 3, dw - 6 - i * 6, dh - 6 - i * 6, 6);
    vig.lineStyle(2, 0x8a6a3a, 1).strokeRoundedRect(dx + 1, dy + 1, dw - 2, dh - 2, 6).lineStyle(1, 0x2a1a0e, 1).strokeRoundedRect(dx + 3.5, dy + 3.5, dw - 7, dh - 7, 5);
    // —— 立绘：全身厚涂居中（缺图回退旧立绘框）
    const c = CHARACTERS.find(x => x.id === this.hero), epic = c && sc.textures.exists('epic_hero_' + c.id) ? 'epic_hero_' + c.id : null;
    let body = { x: dx + dw / 2 - 90, y: dy + 10, w: 180, h: dh - 16 };
    if (epic) {
      this.add(sc.add.ellipse(dx + dw / 2, dy + dh - 10, 190, 20, 0x2a160a, .35));
      const img = this.add(sc.add.image(dx + dw / 2 + 6, dy + dh - 4, epic).setOrigin(.5, 1)).setName('item-portrait');
      img.setScale((dh - 6) / img.height);
      body = { x: img.x - img.displayWidth / 2, y: img.y - img.displayHeight, w: img.displayWidth, h: img.displayHeight };
    } else this.portrait(dx + dw / 2, dy + 24, 200, dh - 48);
    const at = (fx: number, fy: number): [number, number] => [body.x + body.w * fx, body.y + body.h * fy];
    // —— 槽位：左 4、右 3（坐骑在左下，战靴在右下靠脚）
    const worn = loadout(this.hero, s), horse = heroHorse(this.hero, s), size = 54, lx = dx + 46, rx = dx + dw - 46;
    const rowY = (r: number) => dy + 34 + r * ((dh - 78) / 3); // 槽 54 + 名字 11px：行距约 74，名字不碰下一格
    const place: Record<LoadoutKey, [number, number]> = { helm: [lx, rowY(0)], armor: [lx, rowY(1)], token: [lx, rowY(2)], relic: [rx, rowY(0)], token2: [rx, rowY(1)], boots: [rx, rowY(3)] };
    const anchor: Partial<Record<LoadoutKey | 'mount', [number, number]>> = { helm: at(.47, .12), armor: at(.45, .32), token: at(.37, .56), token2: at(.55, .42), boots: at(.6, .95), mount: at(.32, .97) };
    const lines = this.add(sc.add.graphics()); lines.lineStyle(1.2, 0x7a5626, .9);
    const lead = (sx: number, sy: number, key: LoadoutKey | 'mount'): void => {
      const a = anchor[key]; if (!a) return; const side = sx < dx + dw / 2 ? 1 : -1, ex = sx + side * (size / 2 + 4), mid = ex + side * Math.max(12, Math.abs(a[0] - ex) * .55);
      this.dashed(lines, [[ex, sy], [mid, sy], [a[0], a[1]]]); lines.fillStyle(0xc9a45c, 1).fillCircle(a[0], a[1], 2.6);
    };
    const twoTokens = tokenSlots() > 1;
    for (const slot of LOADOUT_KEYS) {
      const [sx, sy] = place[slot], item = worn[slot] ?? null, locked = slot === 'token2' && !twoTokens, base = keySlot(slot);
      lead(sx, sy, slot);
      const tile = this.add(itemTile(sc, sx, sy, size, item, base, { selected: !!item && item.uid === this.selected }));
      if (locked) { const lk = bagArt(sc, 'lock_tag'); tile.add(lk ? sc.add.image(size / 2 - 9, size / 2 - 9, lk).setDisplaySize(20, 20) : sc.add.text(size / 2 - 3, size / 2 - 3, '锁', { fontFamily: FONT, fontSize: '12px', color: '#1c140a', backgroundColor: '#b9a57a', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0)); tile.setAlpha(.8); }
      tile.setName('item-slot-' + slot).setData('uid', item?.uid ?? null).setSize(size, size).setInteractive({ useHandCursor: true });
      this.onTap(tile, () => { if (item) this.select(item.uid); else if (locked) { this.notice = '第二信物位：第二章通关后开放'; this.render(); } else { this.filter = base; this.page = 0; this.notice = `行囊已筛选 · ${SLOTS[base].name}（点道具穿戴）`; this.render(); } });
      if (item) this.tip.attach(tile, () => item, () => item);
      const name = slot === 'token2' ? (locked ? '信物·二 · 二章通关开放' : '信物·二') : SLOTS[slot].name;
      this.slotTag(sx < dx + dw / 2 ? sx - size / 2 - 12 : sx + size / 2 + 12, sy, slot === 'relic' ? '遗珍' : slot === 'token2' ? '信物' : SLOTS[slot].name);
      this.text(sx, sy + size / 2 + 8, item ? itemName(item) : name, 11, item ? QUALITIES[item.quality].css : '#6b5a40').setOrigin(.5).setName('item-slot-label-' + slot).setStroke(item ? '#140d07' : '#e8d9b8', item ? 3 : 2);
    }
    // 坐骑位（左下）
    const my = rowY(3), mountTile = this.add(sc.add.container(lx, my));
    lead(lx, my, 'mount');
    const hq = horse ? horseQuality(HORSES.find(h => h.id === horse.id)) : null, mArt = drawQualityArt(sc, mountTile, size, hq);
    if (!mArt) { const mg = sc.add.graphics(); drawQualityFrame(mg, -size / 2, -size / 2, size, size, hq); mountTile.add(mg); }
    const unlocked = stableUnlocked();
    if (horse) { const ic = horseIcon(sc, horse.id), k = mArt ? .7 : ic.art ? .84 : .72; mountTile.add(sc.add.image(0, 0, ic.key, ic.frame).setDisplaySize(size * k, size * k).setTint(ic.art ? 0xffffff : mountStyle(horse.id).tint)); }
    else { const sil = mArt && bagArt(sc, 'sil_mount'); mountTile.add(sil ? sc.add.image(0, 0, sil).setDisplaySize(size * .62, size * .62).setAlpha(.42) : sc.add.image(0, 0, itemIconKey('mount')).setDisplaySize(size * .72, size * .72).setAlpha(.22)); }
    if (!unlocked || !this.canChangeHorse || this.hero.startsWith('r_')) { const lk = bagArt(sc, 'lock_tag'); mountTile.add(lk ? sc.add.image(size / 2 - 9, size / 2 - 9, lk).setDisplaySize(20, 20) : sc.add.text(size / 2 - 3, size / 2 - 3, '锁', { fontFamily: FONT, fontSize: '12px', color: '#1c140a', backgroundColor: '#b9a57a', resolution: 2 }).setOrigin(1, 1).setPadding(2, 0)); }
    mountTile.setName('item-slot-mount').setSize(size, size).setInteractive({ useHandCursor: true }); this.onTap(mountTile, () => this.select('stable'));
    this.slotTag(lx - size / 2 - 12, my, '坐骑');
    this.text(lx, my + size / 2 + 8, !unlocked ? '坐骑 · 一章通关开放' : horse ? horse.name : '坐骑', 11, horse ? '#f3c37a' : '#6b5a40').setOrigin(.5).setName('item-slot-label-mount').setStroke(horse ? '#140d07' : '#e8d9b8', horse ? 3 : 2);
    // —— 兵装加成横幅（三列词条 + 右上 ★ 特效）
    const gear = gearFromItems(Object.values(worn).filter((i): i is ItemInstance => !!i), horse), sy0 = dy + dh + 8, list = gearSummary(gear);
    const band = this.add(sc.add.graphics()); band.fillStyle(0x140d08, .9).fillRoundedRect(dx, sy0, dw, bottom - sy0, 6).lineStyle(1, 0x6b5a40, 1).strokeRoundedRect(dx + .5, sy0 + .5, dw - 1, bottom - sy0 - 1, 6);
    this.text(dx + 14, sy0 + 8, '兵装加成', 15, '#ecd49a', true);
    if (gear.specials.length) this.text(dx + dw - 14, sy0 + 10, '★ ' + gear.specials.map(id => SPECIALS[id].name).join(' · ★ ') + '（点道具看详情）', 11, '#f3c37a').setOrigin(1, 0).setName('item-gear-specials');
    if (!list.length) this.text(dx + 14, sy0 + 32, '尚未穿戴兵装 · 点行囊中的道具穿戴', 12, '#9c8c6c').setName('item-gear-summary');
    else {
      const cols = 3, per = Math.ceil(list.length / cols), cw = (dw - 28) / cols;
      for (let k = 0; k < cols; k++) { const part = list.slice(k * per, k * per + per); if (part.length) this.text(dx + 14 + k * cw, sy0 + 30, part.join('\n'), 12, '#d8ccb0').setLineSpacing(2).setName(k ? 'item-gear-summary-' + (k + 1) : 'item-gear-summary'); }
    }
    // —— 行囊盘：漆木托盘 + 带图标的筛选页签 + 网格
    const trayArt = bagArt(sc, 'tray_bg');
    if (trayArt) this.add(sc.add.nineslice(tx, ty, trayArt, undefined, tw * 2, th * 2, 60, 60, 60, 60).setOrigin(0).setScale(.5));
    const tray = this.add(sc.add.graphics());
    if (!trayArt) tray.fillStyle(0x1c120b, 1).fillRoundedRect(tx, ty, tw, th, 6).fillStyle(0x2a1a10, .5).fillRoundedRect(tx + 4, ty + 4, tw - 8, 40, { tl: 4, tr: 4, bl: 0, br: 0 });
    if (!trayArt) for (let yy = ty + 50; yy < ty + th - 50; yy += 9) tray.lineStyle(1, 0x24170e, .55).lineBetween(tx + 8, yy, tx + tw - 8, yy); // 木纹
    if (!trayArt) tray.lineStyle(1, 0x6b5a40, 1).strokeRoundedRect(tx + .5, ty + .5, tw - 1, th - 1, 6).lineStyle(1, 0x000000, .6).strokeRoundedRect(tx + 3.5, ty + 3.5, tw - 7, th - 7, 4);
    const filters: Array<ItemSlot | 'all'> = ['all', ...SLOT_ORDER], fgap = 6, fw = (tw - 20 - (filters.length - 1) * fgap) / filters.length, fy = ty + 24;
    filters.forEach((fl, i) => {
      const x = tx + 10 + fw / 2 + i * (fw + fgap), label = fl === 'all' ? '全部' : fl === 'relic' ? '遗珍' : SLOTS[fl].name;
      const on = this.filter === fl, tabArt = bagArt(sc, on ? 'tab_selected' : 'tab'), iconArt = bagArt(sc, 'tab_icon_' + fl);
      if (tabArt) {
        this.add(sc.add.nineslice(x, fy, tabArt, undefined, fw * 2, 60, 32, 32, 0, 0).setScale(.5));
        if (iconArt) this.add(sc.add.image(x - fw / 2 + 15, fy, iconArt).setDisplaySize(20, 20)).setAlpha(on ? 1 : .8);
        const t = this.text(x + (iconArt ? 8 : 0), fy, label, 13, on ? '#fff3d6' : '#e9dcbc').setOrigin(.5).setName('item-filter-' + fl);
        lqHitBox(t, fw, 28); t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.filter = fl; this.page = 0; this.render(); });
      } else {
        this.button(x + (fl === 'all' ? 0 : 7), fy, label, 'item-filter-' + fl, () => { this.filter = fl; this.page = 0; this.render(); }, { active: on, size: 13, w: fw - (fl === 'all' ? 24 : 38) });
        if (fl !== 'all') { const icon = this.add(sc.add.image(x - fw / 2 + 13, fy, itemIconKey(fl as IconSlot)).setDisplaySize(18, 18)).setAlpha(on ? 1 : .75); this.body.bringToTop(icon); }
      }
    });
    const cell = 52, gap = 6, gcols = Math.max(1, Math.floor((tw - 20 + gap) / (cell + gap)));
    const pageY = ty + th - 22, gridTop = fy + 30, rows = Math.max(1, Math.floor((pageY - 22 - gridTop + gap) / (cell + gap))), per = gcols * rows;
    const items = this.items(), pages = Math.max(1, Math.ceil(items.length / per)); this.page = Math.min(this.page, pages - 1);
    const offX = tx + (tw - (gcols * cell + (gcols - 1) * gap)) / 2;
    // 空凹格：整页铺满，物品放在上面
    const wells = this.add(sc.add.graphics());
    const wellArt = bagArt(sc, 'slot_frame');
    for (let i = 0; i < per; i++) { const ix = offX + (i % gcols) * (cell + gap), iy = gridTop + Math.floor(i / gcols) * (cell + gap); if (wellArt) { this.add(sc.add.image(ix + cell / 2, iy + cell / 2, wellArt).setDisplaySize(cell, cell).setAlpha(.45)); continue; } wells.fillStyle(0x000000, .28).fillRoundedRect(ix, iy, cell, cell, 5).lineStyle(1, 0xc9a45c, .14).strokeRoundedRect(ix + .5, iy + .5, cell - 1, cell - 1, 5); }
    items.slice(this.page * per, this.page * per + per).forEach((item, i) => {
      const ix = offX + cell / 2 + (i % gcols) * (cell + gap), iy = gridTop + cell / 2 + Math.floor(i / gcols) * (cell + gap);
      const tile = this.add(itemTile(sc, ix, iy, cell, item, undefined, { selected: item.uid === this.selected }));
      tile.setName('item-cell-' + i).setData('uid', item.uid).setSize(cell, cell).setInteractive({ useHandCursor: true });
      const loot = this.isLoot(item.uid);
      this.onTap(tile, () => this.select(item.uid));
      this.tip.attach(tile, () => item, () => loadout(this.hero)[equipTarget(this.hero, item)]);
      tile.on('pointerover', () => tile.setY(iy - 2)).on('pointerout', () => tile.setY(iy));
      if (loot) tile.setData('loot', true).add(sc.add.text(-cell / 2 + 3, -cell / 2 + 2, '新', { fontFamily: HEADING_FONT, fontSize: '11px', color: '#2a1a08', backgroundColor: '#f3d48acc', resolution: 2 }).setPadding(3, 0).setName('item-new-badge'));
      const owner = loot ? undefined : equippedBy(s, item.uid);
      if (owner) tile.add(sc.add.text(-cell / 2 + 3, cell / 2 - 3, (ownerName(owner).slice(0, 1) || '装'), { fontFamily: FONT, fontSize: '11px', color: '#1c140a', backgroundColor: '#d7b46a', resolution: 2 }).setOrigin(0, 1).setPadding(2, 0));
    });
    if (!items.length) this.text(tx + tw / 2, gridTop + 90, '行囊空空\n战斗中击败精锐、首领、打开宝箱可得兵装', 15, '#9c8c6c').setOrigin(.5).setAlign('center');
    this.button(tx + 30, pageY, '‹', 'item-page-prev', () => { this.page = Math.max(0, this.page - 1); this.render(); }, { disabled: this.page === 0, size: 16 });
    this.text(tx + 80, pageY, `${this.page + 1} / ${pages}`, 14, '#cdb98a').setOrigin(.5).setName('item-page');
    this.button(tx + 130, pageY, '›', 'item-page-next', () => { this.page = Math.min(pages - 1, this.page + 1); this.render(); }, { disabled: this.page >= pages - 1, size: 16 });
    this.button(tx + tw - 182, pageY, `自动分解白：${s.autoSalvageWhite ? '开' : '关'}`, 'item-auto-white', () => { setAutoSalvageWhite(!s.autoSalvageWhite); this.notice = s.autoSalvageWhite ? '已关闭：白色兵装照常收入行囊' : '已开启：之后的白色兵装收入时直接折成军粮'; this.render(); }, { size: 13, active: s.autoSalvageWhite });
    this.button(tx + tw - 56, pageY, '分解白 / 绿', 'item-salvage-low', () => { const m = salvageUpTo('green'); this.notice = m ? `分解完成 · 军粮 +${rewardGrain(0, 0, m)}` : '没有可分解的白 / 绿兵装（已穿戴的不会分解）'; this.selected = null; this.render(); }, { size: 13 });
    return pageY;
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
    this.text(cx, top + h - 6, c?.name ?? ownerName(this.hero), 15, '#f2ddae', true).setOrigin(.5, 1).setStroke('#140d07', 4);
  }

  /** 点击：pointerup 触发（手柄 Ⓐ 依次发 pointerdown + pointerup）。2026-11-16 用户要求去掉拖拽穿戴，只保留点击。 */
  private onTap(tile: Phaser.GameObjects.Container, onTap: () => void): void {
    // 必须在这个格子上按下、再在它上面松开才算点击。关详情框的按钮在按下时就重绘了行囊，松手那一下
    // 会落到新露出来的格子上（2026-11-16 用户报「点 X 又点到其他装备」）：新格子没按下过，不响应。
    tile.on('pointerdown', () => tile.setData('armed', true));
    tile.on('pointerout', () => tile.setData('armed', false));
    tile.on('pointerup', () => { if (!tile.getData('armed')) return; tile.setData('armed', false); onTap(); });
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


  /** 旧物：旧档里已下架的兵刃挂饰和重复的马，原样保留；可一键按双倍分解价折钱。 */
  private renderLegacy(): void {
    const s = loadItems(), cw = IS_DESKTOP ? 460 : 480, names = s.legacy.map(i => `${QUALITIES[i.quality].label} · ${({ sword_tassel: '剑穗', blade_ring: '刀环', spear_tassel: '枪缨', bow_tip: '弓弭', whet_charm: '砺石佩', bronze_guard: '青铜剑格', iron_pommel: '铁首环', jade_hilt: '玉具剑璏' } as Record<string, string>)[i.base] ?? HORSES.find(h => h.id === i.base)?.name ?? i.base}`);
    const { card, x, y, g } = this.card(cw, 220);
    this.text(x + 26, y + 20, '旧物', 22, '#f2ddae', true, card).setName('item-detail-name');
    this.text(x + 26, y + 54, '兵装改版前的兵刃挂饰和重复的马，已原样保留（不能穿戴）。', 13, '#b9a57a', false, card).setWordWrapWidth(cw - 90);
    const list = this.text(x + 26, y + 84, names.join('　'), 14, '#e9dcbc', false, card).setWordWrapWidth(cw - 52).setLineSpacing(4).setName('item-legacy-list');
    const by = list.y + list.height + 34, money = legacyValue(s);
    this.plainFrame(g, x, y, cw, by - y + 30);
    this.button(x + cw / 2, by, `全部分解 · 军粮 +${rewardGrain(0, 0, money)}`, 'item-legacy-salvage', () => { const m = salvageLegacy(); this.notice = `旧物已分解 · 军粮 +${rewardGrain(0, 0, m)}`; this.selected = null; this.render(); }, { parent: card, size: 15 });
    this.button(x + cw - 30, y + 28, '×', 'item-detail-close', () => this.closeDetail(), { parent: card, size: 16 });
  }

  /** 马厩：拥有的马、每匹马的固定加成与骑乘特色；休整时可给当前武将换马。 */
  private renderStable(): void {
    const D = IS_DESKTOP, s = loadItems(), unlocked = stableUnlocked(), cols = D ? 2 : 1, rowH = D ? 60 : 44;
    const cw = D ? 860 : 500, rows = Math.ceil(HORSES.length / cols), est = 96 + rows * rowH + 40;
    const { card, x, y, g } = this.card(cw, est), heroName = ownerName(this.hero);
    this.plainFrame(g, x, y, cw, est);
    this.text(x + 26, y + 18, '马厩', 24, '#f2ddae', true, card).setName('item-detail-name');
    const recruitOnly = this.hero.startsWith('r_');
    const sub = !unlocked ? '第一章「黄巾之乱」通关后开放，并赠驽马一匹。之后的马靠各章首领首次击杀获得。'
      : recruitOnly ? `${heroName}是招募的武将，暂不骑马` : !this.canChangeHorse ? '战斗中不可换马 · 在行营休整或主页行囊里换马' : `为 ${heroName} 选马 · 一匹马同时只归一名武将${this.battle ? ' · 下一关出征生效' : ''}`;
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
      this.text(nameX, cy + 4, (h.legend ? '★ ' : '') + h.name + (rider ? ` · ${CHARACTERS.find(c => c.id === rider)?.name ?? ''}骑乘` : ''), D ? 15 : 14, owned ? (h.legend ? '#f2a24e' : horseQuality(h) === 'white' ? '#e6e1d6' : '#ecd49a') : '#6f6250', false, card).setName('stable-name-' + h.id);
      const style = mountStyle(h.id).ride;
      this.text(nameX, cy + (D ? 26 : 23), owned ? horseBonusText(h) + (style ? ' · ' + style.replace(/^[^：]+：/, '') : '') : '未获得 · ' + h.lore, 11, owned ? '#d8ccb0' : '#6f6250', false, card).setWordWrapWidth(cwid - isz - 110).setMaxLines(D ? 2 : 1);
      if (owned && unlocked && this.canChangeHorse && !recruitOnly) this.button(cx + cwid - 46, cy + (rowH - 6) / 2, mine ? '下马' : '骑乘', mine ? 'stable-dismount' : 'stable-ride-' + h.id, () => {
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
    const target = equipTarget(this.hero, item, s), current = loadout(this.hero, s)[target];
    const lines = item.affixes.map(a => (a.minor ? '· ' : '') + formatAffix(a));
    const compare = this.compare(item, current && current.uid !== item.uid ? current : undefined);
    const legend = def?.legend ?? LEGENDS.find(l => l.id === item.base) ?? def?.relic;
    // 先估算高度定位，排完文字后按实际高度画底
    const est = 96 + lines.length * 25 + (item.special ? 44 : 0) + (charmText(item) ? 52 : 0) + (legend ? 22 : 0) + (compare ? 22 + compare.split('\n').length * 18 : 0) + 64;
    const x = (W - cw) / 2, y = Math.max(20, (H - est) / 2);
    const g = this.add(this.scene.add.graphics(), card);
    card.add(itemTile(this.scene, x + 50, y + 52, 64, item).setScrollFactor(0));
    this.text(x + 92, y + 22, itemName(item), 22, q.css, true, card).setName('item-detail-name');
    this.text(x + 92, y + 56, `${def?.relic ? '首领遗珍 · ' + def.relic.boss + ' · ' : ''}${q.name} · ${SLOTS[slot].name}${owner ? ' · ' + ownerName(owner) + '已穿戴' : ''}`, 13, '#b9a57a', false, card).setName('item-detail-quality');
    let ty = y + 96;
    this.text(x + 26, ty, lines.join('\n'), 15, '#e9dcbc', false, card).setLineSpacing(6).setName('item-detail-affixes'); ty += lines.length * 25 + 6;
    if (item.special) { this.text(x + 26, ty, `★ ${SPECIALS[item.special].name}：${SPECIALS[item.special].desc}`, 14, '#f3c37a', false, card).setWordWrapWidth(cw - 52); ty += 44; }
    const ct = charmText(item); if (ct) { const c = this.text(x + 26, ty, ct, 14, '#f3c37a', false, card).setWordWrapWidth(cw - 52).setName('item-detail-charm'); ty += c.height + 8; }
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
      if (wornHere) this.takeOff(target); else this.wear(item);
      this.lastUid = item.uid; this.selected = null; this.render();
    }, { parent: card, size: 16 });
    this.button(x + cw * .7, by, def?.relic ? '遗珍不可分解' : owner ? '已穿戴不可分解' : `分解 · 军粮 +${rewardGrain(0, 0, q.salvage)}`, 'item-salvage', () => { const m = salvageItems([item.uid]); this.notice = `分解 ${itemName(item)} · 军粮 +${rewardGrain(0, 0, m)}`; this.selected = null; this.render(); }, { parent: card, size: 14, disabled: !!owner || !!def?.relic });
  }

  /** 与当前同槽装备的词条差，如「▲ 生命上限 +2.1%」「▼ 暴击率 −1.0%」。 */
  private compare(item: ItemInstance, current?: ItemInstance): string { return compareLines(item, current).map(c => c.text).join('\n'); }
}
