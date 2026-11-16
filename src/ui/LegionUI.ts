import {visualTextureKey} from '../systems/ReadableTextures';
import Phaser from 'phaser';
import { WAR, warFrame } from './WarStyle';
import { DEPTH, FONT, HEADING_FONT, GAME_HEIGHT as H, GAME_WIDTH as W, IS_DESKTOP as D } from '../config';
import { LEGION, ORDERS, TROOPS, TROOP_KINDS, INITIAL_TROOPS, type TroopKind } from '../data/legion';
import type { Legion } from '../systems/Legion';
import { loadTroopPortraits, portraitHeadY, portraitKey } from '../systems/TroopPortraits';
const ROLES: Record<TroopKind, string> = {
  swordsman: '近战护卫 · 稳守前线', spearman: '长枪突刺 · 克制骑兵', archer: '远程弓箭 · 持续支援',
  crossbowman: '连弩快射 · 高频压制', guardian: '重甲大盾 · 承受伤害', rider: '高速骑兵 · 主动冲击',
  halberdier: '战戟横扫 · 范围攻击', medic: '治疗友军 · 补充续航',
};
/** 战地招募卡：兵种定位色（仅表现）。 */
const ROLE_TINT: Record<TroopKind, number> = {
  swordsman: 0x7a3b22, guardian: 0x6b4a22, halberdier: 0x7a2f2f, spearman: 0x2d4f6e,
  rider: 0x4d3a72, archer: 0x2f5a42, crossbowman: 0x3a5a2a, medic: 0x2f6466,
};
/** 2026-11-16 用户反馈「战场支援 3 个兵也加一个可以选个血药，变成 4 个」：用户 2026-11-16 批准，默认开启；?recruit=v1 回到 3 张。回复量为临时值（GameScene.RECRUIT_POTION_HEAL）。 */
export const RECRUIT_V2 = (() => { try { return new URLSearchParams(location.search).get('recruit') !== 'v1'; } catch { return true; } })();
/** 半身裁切：立绘帧内人物大小不一，按兵种微调取景中心与高度（帧高比例）。 */
const PORTRAIT_CROP: Partial<Record<TroopKind, { cy: number; h: number }>> = { rider: { cy: .4, h: .42 }, halberdier: { cy: .42, h: .44 } };
export class LegionUI {
  readonly hud: Phaser.GameObjects.Container;
  readonly panel: Phaser.GameObjects.Container;
  private readonly campBackground: Phaser.GameObjects.Image;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly order: Phaser.GameObjects.Text;
  private readonly orderPlate: Phaser.GameObjects.Graphics;
  private readonly orderHint: Phaser.GameObjects.Text;
  private keyHint?: Phaser.GameObjects.Text;
  /** 护阵 / 出击按键提示（E / 手柄 Ⓨ）。 */
  setKeyHint(label: string): void { this.keyHint?.setText(label); }
  private orderState = '';
  /** 军令按钮（护阵 / 出击）：紧凑半透明胶囊，靠右下（2026-11-15 用户反馈原样式太显眼）。 */
  private readonly orderW = D ? 96 : 108; private readonly orderH = D ? 30 : 38;
  private readonly orderX = W - (D ? 112 : 124);
  private readonly orderY = H - (D ? 128 : 150);
  private readonly close: Phaser.GameObjects.Text;
  private readonly prev: Phaser.GameObjects.Text;
  private readonly next: Phaser.GameObjects.Text;
  private readonly pageText: Phaser.GameObjects.Text;
  private page = 0;
  private mode: 'wave' | 'rest' = 'wave';
  private options: TroopKind[] = [];
  private army: Legion | null = null;
  private readonly rows: Array<{ kind: TroopKind; root: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; plate: Phaser.GameObjects.Graphics; skin: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; title: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; buy: Phaser.GameObjects.Text; train: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; seal: Phaser.GameObjects.Text; mask: Phaser.GameObjects.Graphics; walk: string; w: number; h: number; hover: boolean }> = [];
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly flourish: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, order: () => void, buy: (kind: TroopKind, train: boolean) => void, close: () => void, takePotion?: () => void, potionOk?: () => boolean) {
    this.potionOk = potionOk;
    const text = (x: number, y: number, s: string, size = 16) => scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: '#eee2c1', resolution: 2, stroke: '#101910', strokeThickness: 1, shadow: { offsetX: 0, offsetY: 2, color: '#080d09', blur: 3, fill: true } }).setScrollFactor(0);
    const button = (s: string, fn: () => void) => text(0, 0, s, 15).setPadding(10, 10).setBackgroundColor('rgba(57,83,62,0.96)').setInteractive({ useHandCursor: true }).on('pointerover', function(this: Phaser.GameObjects.Text) { this.setTint(0xffe4a1); }).on('pointerout', function(this: Phaser.GameObjects.Text) { this.clearTint(); }).on('pointerdown', fn);
    this.hud = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 3);
    this.status = text(28, 115, '', 15).setStroke('#171a13', 2);
    this.orderPlate = scene.add.graphics().setScrollFactor(0);
    this.order = text(this.orderX, this.orderY, '', D ? 14 : 16).setPadding(32, D ? 6 : 9, 0, 0)
      .setFixedSize(this.orderW, this.orderH).setInteractive({ useHandCursor: true }).setAlpha(.9)
      .on('pointerdown', () => { this.orderPlate.setAlpha(.55); order(); })
      .on('pointerup', () => this.orderPlate.setAlpha(.8))
      .on('pointerover', () => this.orderPlate.setAlpha(1))
      .on('pointerout', () => this.orderPlate.setAlpha(.8));
    this.orderPlate.setAlpha(.8);
    // 说明行不再显示（军令名已说明含义）；保留对象以免改动其它逻辑
    this.orderHint = text(this.orderX + 32, this.orderY + this.orderH, '', 10).setColor('#acbeb0').setVisible(false);
    const key = this.keyHint = text(this.orderX + this.orderW - 14, this.orderY + this.orderH / 2, D ? 'E' : '⇄', 10).setColor('#9fa592').setAlpha(.7).setOrigin(.5);
    this.hud.add([this.status, this.orderPlate, this.order, this.orderHint, key]);
    this.panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 1).setVisible(false);
    this.backdrop = scene.add.rectangle(0, 0, W, H, 0x0c0906, 0).setOrigin(0).setScrollFactor(0).setInteractive();
    this.panel.add(this.backdrop);
    this.campBackground=scene.add.image(W/2,H/2,'rest_camp').setScrollFactor(0).setDisplaySize(Math.max(W,H*1.5),Math.max(H,W/1.5)).setAlpha(1);
    this.panel.addAt(this.campBackground,0);
    this.panel.addAt(scene.add.rectangle(W/2,H/2,W,H,0x1a110a,.36).setScrollFactor(0),1);
    this.heading = text(W / 2, D ? 54 : 75, '', D ? 26 : 28).setOrigin(.5, 0);
    this.summary = text(W / 2, D ? 96 : 122, '', 14).setOrigin(.5, 0);
    this.flourish = scene.add.graphics().setScrollFactor(0);
    this.panel.add([this.flourish, this.heading, this.summary]);
    for (const kind of TROOP_KINDS) {
      const root = scene.add.container(0, 0).setScrollFactor(0);
      const bg = scene.add.rectangle(0, 0, 200, 200, 0x24362e, 0).setStrokeStyle(0).setOrigin(0).setScrollFactor(0);
      const skin = scene.add.image(0,0,'ui_war_panel').setOrigin(0).setScrollFactor(0);
      const plate = scene.add.graphics().setScrollFactor(0);
      const def = TROOPS[kind], sheet = def.walkVisual?.texture ?? `${def.art}_walk_sheet`;
      const icon = scene.add.image(0, 0, visualTextureKey(scene,sheet), 'down_0').setDisplaySize(70, 70).setScrollFactor(0);
      const title = text(12, 12, '', 19), detail = text(12, 42, '', 13).setColor('#b9cdbb');
      const recruit = button('', () => buy(kind, false)), train = button('', () => buy(kind, true));
      const tag = text(0, 0, '', 13).setColor('#f6e6c2').setOrigin(.5);
      // 兵种印记（刀 / 枪 / 弓…）：独立美术到位前，用半身裁切 + 印记区分兵种
      const seal = scene.add.text(0, 0, def.mark, { fontFamily: HEADING_FONT, fontSize: '17px', color: '#fbe7cc', resolution: 2 }).setOrigin(.5).setPadding(5, 3).setScrollFactor(0);
      const mask = scene.make.graphics({}, false).setScrollFactor(0);
      root.add([skin, bg, plate, icon, title, tag, detail, recruit, train, seal]); this.panel.add(root);
      const row = { kind, root, bg, plate, skin, icon, title, detail, buy: recruit, train, tag, seal, mask, walk: icon.texture.key, w: 0, h: 0, hover: false };
      this.rows.push(row);
      // 战地招募：整张卡可点，悬停描金变亮（仅 wave 模式开启命中区）
      const hover = (on: boolean) => { if (this.mode !== 'wave' || row.hover === on) return; row.hover = on; this.paintWaveCard(row); };
      bg.on('pointerover', () => hover(true)).on('pointerout', () => hover(false)).on('pointerdown', () => buy(kind, false));
      recruit.on('pointerover', () => hover(true)).on('pointerout', () => hover(false));
    }
    this.prev = button('上一页', () => { this.page = 0; this.repaint(); }).setPosition(W / 2 - 145, H - 225);
    this.next = button('下一页', () => { this.page = 1; this.repaint(); }).setPosition(W / 2 + 45, H - 225);
    this.pageText = text(W / 2, H - 207, '', 14).setOrigin(.5);
    this.close = button('', close).setPosition(W / 2, H - (D ? 54 : 103)).setOrigin(.5, 0).setFontSize(18);
    this.panel.add([this.prev, this.next, this.pageText, this.close]);
    // 兵种胸像立绘（清单里有才加载）；到位后战地招募卡改用立绘
    loadTroopPortraits(scene, () => { if (this.panel.visible && this.mode === 'wave') this.repaint(); });
    // 血药卡（效果图）：与兵种卡同一套漆底描金卡面，徽章里是药囊
    {const root = scene.add.container(0, 0).setScrollFactor(0).setVisible(false).setName('recruit-potion-card'), g = scene.add.graphics().setScrollFactor(0);
     const icon = scene.add.image(0, 0, scene.textures.exists('healing_potion') ? 'healing_potion' : 'icon_1').setScrollFactor(0);
     const title = text(0, 0, '血药 · 回春', 21).setColor('#f6dc9a'), detail = text(0, 0, '', 14).setColor('#d9c79f'), buy = text(0, 0, '＋ 领取血药', 16).setColor('#ffe6b5').setPadding(10, 10);
     const tag = text(0, 0, '补给', 14).setColor('#f6e6c2').setOrigin(.5);
     // 整张卡可点（命中区名 recruit-potion），悬停描金变亮
     const hit = scene.add.rectangle(0, 0, 10, 10, 0, .001).setOrigin(0).setScrollFactor(0).setName('recruit-potion').setInteractive({ useHandCursor: true });
     hit.on('pointerover', () => { this.potionHover = true; this.layoutPotionCard(root.x, root.y, this.potionW, this.potionH); }).on('pointerout', () => { this.potionHover = false; this.layoutPotionCard(root.x, root.y, this.potionW, this.potionH); })
       .on('pointerdown', () => { if (this.potionOk?.() ?? true) takePotion?.(); });
     root.add([g, icon, title, tag, detail, buy, hit]); this.panel.add(root); this.potion = {root, g, icon, title, detail, buy, tag, hit};}
  }
  private potion!: {root: Phaser.GameObjects.Container; g: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Image; title: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; buy: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; hit: Phaser.GameObjects.Rectangle};
  private potionHover = false; private potionW = 0; private potionH = 0;
  /** 主将满血时血药卡灰掉、不可点（判定同 canOfferRejuvenation，由 GameScene 传入）。 */
  private potionOk?: () => boolean;
  /** 血药卡排版：版式与兵种卡相同（电脑竖卡居中、手机横卡左徽章右文字）。 */
  private layoutPotionCard(x: number, y: number, w: number, h: number): void {
    const p = this.potion, g = p.g, mx = D ? w / 2 : 66, my = D ? 100 : h / 2 - 2, mr = 52, red = 0x7a2a22, ok = this.potionOk?.() ?? true, hover = this.potionHover && ok, gold = hover ? 0xf3d48a : ok ? WAR.gold : 0x8a8170;
    this.potionW = w; this.potionH = h; p.hit.setSize(w, h); if (p.hit.input) p.hit.input.hitArea.setTo(0, 0, w, h);
    p.root.setVisible(true).setPosition(x, y).setAlpha(ok ? 1 : .55);
    if (p.hit.input) p.hit.input.cursor = ok ? 'pointer' : 'default';
    g.clear(); g.fillStyle(0x10221b, .96).fillRect(0, 0, w, h); warFrame(g, 0, 0, w, h, gold, false);
    if (hover) g.lineStyle(2, 0xf3d48a, .9).strokeRect(1, 1, w - 2, h - 2);
    g.fillStyle(0x1b120b, .42).fillRect(2, 2, w - 4, h - 4);
    g.fillStyle(0x0c0906, .6).fillCircle(mx, my, mr).fillStyle(red, .7).fillCircle(mx, my, mr - 3).fillStyle(0xffe2a0, .07).fillCircle(mx - mr * .25, my - mr * .3, mr * .6)
      .lineStyle(3, WAR.gold, .85).strokeCircle(mx, my, mr).lineStyle(1, WAR.gold, .35).strokeCircle(mx, my, mr + 4);
    const f = p.icon.frame, s = (mr * 1.3) / Math.max(f.width, f.height); p.icon.setScale(s).setPosition(mx, my);
    p.title.setPosition(D ? w / 2 : 134, 16).setOrigin(D ? .5 : 0, 0).setFontSize(D ? 21 : 23);
    p.tag.setPosition(D ? w / 2 : 134 + p.tag.width / 2 + 9, D ? 172 : 66);
    const tw = p.tag.width + 18, th = p.tag.height + 6; g.fillStyle(red, .95).fillRoundedRect(p.tag.x - tw / 2, p.tag.y - th / 2, tw, th, 4).lineStyle(1, WAR.gold, .6).strokeRoundedRect(p.tag.x - tw / 2, p.tag.y - th / 2, tw, th, 4);
    // 数值来自「平衡与数值」会话：回复最大生命的 30%
    p.detail.setText('回复 30% 生命').setVisible(true).setAlign('center').setFontSize(D ? 14 : 16);
    if (D) p.detail.setPosition(w / 2, 190).setOrigin(.5, 0); else p.detail.setPosition(p.tag.x + tw / 2 + 12, p.tag.y).setOrigin(0, .5);
    p.buy.setText(ok ? '＋ 领取血药' : '主将满血');
    p.buy.setPosition(D ? 14 : 134, D ? 212 : h - 54).setFixedSize(D ? w - 28 : w - 152, 0).setAlign('center').setFontSize(D ? 16 : 18);
    // 按钮底板与兵种卡「招募入队」同尺寸同画法（文字自带 10px 内边距）
    const bx = p.buy.x, by = p.buy.y, bw = p.buy.width, bh = p.buy.height;
    g.fillStyle(0x000000, .35).fillRoundedRect(bx + 1, by + 3, bw, bh, 6).fillStyle(ok ? hover ? 0x9a6a2c : 0x6e4a22 : 0x4a443b, 1).fillRoundedRect(bx, by, bw, bh, 6)
      .fillStyle(0xffe2a0, hover ? .2 : .1).fillRoundedRect(bx + 2, by + 2, bw - 4, bh * .45, { tl: 5, tr: 5, bl: 0, br: 0 }).lineStyle(1, gold, 1).strokeRoundedRect(bx + 3, by + 3, bw - 6, bh - 6, 4);
    p.buy.setColor(hover ? '#fff3d6' : '#ffe6b5');
    this.panel.bringToTop(p.root);
  }
  setCampDestination(name:string,title='黄巾败退 · 战后休整'):void {this.heading.setText(title);this.close.setText(`出征 · ${name}`).setBackgroundColor('#59452d').setColor('#ffe5b3').setPadding(30,14);}
  /** 战地招募卡面：漆底描金、兵种徽章、金色招募按钮；悬停时描金加亮、按钮转亮金。 */
  private paintWaveCard(row: LegionUI['rows'][number]): void {
    const { w, h, hover } = row, g = row.plate, gold = hover ? 0xf3d48a : WAR.gold;
    const mx = D ? w / 2 : 66, my = D ? 100 : h / 2 - 2, mr = D ? 52 : 52;
    g.clear(); warFrame(g, 0, 0, w, h, gold, false);
    g.fillStyle(0x1b120b, hover ? .55 : .42).fillRect(2, 2, w - 4, h - 4);
    if (hover) g.lineStyle(2, 0xf3d48a, .9).strokeRect(1, 1, w - 2, h - 2);
    // 兵种徽章：描金圆环 + 定位色底；立绘取头到腰的半身裁切，圆形遮罩
    g.fillStyle(0x0c0906, .6).fillCircle(mx, my, mr).fillStyle(ROLE_TINT[row.kind], .7).fillCircle(mx, my, mr - 3)
      .fillStyle(0xffe2a0, .07).fillCircle(mx - mr * .25, my - mr * .3, mr * .6)
      .lineStyle(3, gold, hover ? 1 : .85).strokeCircle(mx, my, mr).lineStyle(1, gold, .35).strokeCircle(mx, my, mr + 4);
    const art = portraitKey(row.kind);
    if (row.icon.scene.textures.exists(art)) {
      // 正式胸像立绘：宽度略大于徽章，头部中心对到徽章中心偏上
      if (row.icon.texture.key !== art) row.icon.setTexture(art);
      const s = (mr * 2.3) / row.icon.frame.width;
      row.icon.setScale(s).setPosition(mx, my - mr * .18 + (.5 - portraitHeadY(row.kind)) * row.icon.frame.height * s);
    } else {
      // 过渡：行走帧半身裁切
      if (row.icon.texture.key !== row.walk) row.icon.setTexture(row.walk, 'down_0');
      const frame = row.icon.frame, crop = PORTRAIT_CROP[row.kind] ?? { cy: .37, h: .56 }, s = (mr * 2 - 6) / (frame.height * crop.h);
      row.icon.setScale(s).setPosition(mx, my + (.5 - crop.cy) * frame.height * s);
    }
    row.mask.clear().fillStyle(0xffffff).fillCircle(row.root.x + mx, row.root.y + my, mr - 3); row.icon.setMask(row.mask.createGeometryMask());
    row.seal.setVisible(true).setPosition(mx + mr * .72, my + mr * .72).setBackgroundColor(Phaser.Display.Color.IntegerToColor(ROLE_TINT[row.kind]).rgba);
    g.lineStyle(1.5, gold, 1).strokeRect(row.seal.x - row.seal.width / 2 - 1, row.seal.y - row.seal.height / 2 - 1, row.seal.width + 2, row.seal.height + 2);
    // 招募按钮底板（按文字对象的本地坐标绘制）
    const bx = row.buy.x, by = row.buy.y, bw = row.buy.width, bh = row.buy.height;
    g.fillStyle(0x000000, .35).fillRoundedRect(bx + 1, by + 3, bw, bh, 6)
      .fillStyle(hover ? 0x9a6a2c : 0x6e4a22, 1).fillRoundedRect(bx, by, bw, bh, 6)
      .fillStyle(0xffe2a0, hover ? .2 : .1).fillRoundedRect(bx + 2, by + 2, bw - 4, bh * .45, { tl: 5, tr: 5, bl: 0, br: 0 })
      .lineStyle(1, gold, 1).strokeRoundedRect(bx + 3, by + 3, bw - 6, bh - 6, 4);
    row.buy.setColor(hover ? '#fff3d6' : '#ffe6b5').clearTint();
    // 定位标签底
    const tw = row.tag.width + 18, th = row.tag.height + 6, tx = row.tag.x - tw / 2, ty = row.tag.y - th / 2;
    g.fillStyle(ROLE_TINT[row.kind], .95).fillRoundedRect(tx, ty, tw, th, 4).lineStyle(1, gold, .6).strokeRoundedRect(tx, ty, tw, th, 4);
  }
  render(army: Legion, mode: 'wave' | 'rest', options: TroopKind[] = []): void { if (this.mode !== mode) this.page = 0; this.army = army; this.mode = mode; this.options = options; this.repaint(); }
  private repaint(): void {
    const army = this.army; if (!army) return;
    const wave = this.mode === 'wave';
    this.potion.root.setVisible(false); // 休整界面不显示血药卡（只在战地招募里出现）
    this.campBackground.setVisible(!wave);
    // 战地招募：压暗战场，卡片竖向居中（手机长屏不再上挤下空）
    // 效果图（?recruit=v2）：三张兵种卡旁再加一张「血药」卡，共 4 张
    const cards = wave && RECRUIT_V2 ? 4 : 3, cardGapX = cards === 4 ? 12 : 16;
    const waveCardH = D ? 262 : cards === 4 ? 150 : 176, waveGap = D ? 16 : cards === 4 ? 16 : 22, waveTop = D ? 150 : Math.max(196, Math.round((H - (waveCardH * cards + waveGap * (cards - 1))) / 2) + 6);
    this.backdrop.setFillStyle(0x0c0906, wave ? .62 : 0);
    this.heading.setY(wave ? waveTop - (D ? 100 : 124) : D ? 22 : 62).setColor(wave ? '#f6dc9a' : '#eee2c1');
    this.summary.setY(wave ? waveTop - (D ? 46 : 62) : D ? 61 : 112).setColor(wave ? '#d9c79f' : '#eee2c1');
    this.flourish.clear();
    if (wave) { const fy = waveTop - (D ? 56 : 74), fx = W / 2; this.flourish.lineStyle(1, WAR.gold, .7).lineBetween(fx - 130, fy, fx - 10, fy).lineBetween(fx + 10, fy, fx + 130, fy).fillStyle(0xf3d48a, 1).fillTriangle(fx - 5, fy, fx, fy - 5, fx + 5, fy).fillTriangle(fx - 5, fy, fx, fy + 5, fx + 5, fy); }
    this.heading.setText(wave ? '战地招募'  : '黄巾已破 · 战后休整');
    this.summary.setText(wave ? `免费招募 1 人 · 点选兵种卡入队　当前兵力 ${army.count}` : `军粮 ${army.food}　当前兵力：${army.count}　阵亡 ${army.dead}\n仅开放刀盾、长枪、弓箭兵 · 使用本局军粮`).setAlign('center');
    this.close.setText(wave ? '跳过本次 · 继续战斗' : '率军出征 · 虎牢关');
    if (wave) this.close.setBackgroundColor('rgba(27,18,11,0.88)').setColor('#d9c79f').setFontSize(D ? 16 : 18).setPadding(26, 12).setY(D ? waveTop + waveCardH + 34 : Math.min(H - 103, waveTop + waveCardH * cards + waveGap * (cards - 1) + 40));
    else this.close.setY(H - (D ? 54 : 103));
    for (const row of this.rows) { row.hover = false; row.tag.setVisible(wave); if (!wave) { row.seal.setVisible(false); row.icon.clearMask(); if (row.icon.texture.key !== row.walk) row.icon.setTexture(row.walk, 'down_0'); } row.buy.setBackgroundColor(wave ? 'rgba(0,0,0,0)' : 'rgba(57,83,62,0.96)'); if (wave) row.bg.setInteractive({ useHandCursor: true }); else row.bg.disableInteractive(); }
    if(!wave){
      this.prev.setVisible(false);this.next.setVisible(false);this.pageText.setVisible(false);
      for(const row of this.rows){const i=INITIAL_TROOPS.indexOf(row.kind);row.root.setVisible(i>=0);if(i<0)continue;
        const width=D?232:W-72,height=D?252:154,x=D?(W-(width*3+32))/2+i*(width+16):36,y=D?153:192+i*174;
        row.root.setPosition(x,y);row.bg.setSize(width,height);row.skin.setDisplaySize(width,height);row.plate.clear();warFrame(row.plate,0,0,width,height,WAR.gold,false);
        const count=army.units.filter(u=>u.active&&u.kind===row.kind).length;
        row.title.setText(`${TROOPS[row.kind].name} · Lv${army.levels[row.kind]}`).setPosition(D?width/2:118,18).setOrigin(D?.5:0,0).setFontSize(19).setColor('#eee2c1');row.detail.setFontSize(13).setColor('#b9cdbb');row.buy.setFontSize(15).setColor('#eee4ca');
        row.icon.setScale(94/Math.max(row.icon.frame.width,row.icon.frame.height)).setPosition(D?width/2:55,D?98:76);
        row.detail.setText(`${ROLES[row.kind]}\n已编入 ${count} 人 · ${army.recruitCost(row.kind)}军粮/人`).setPosition(D?width/2:118,D?153:53).setOrigin(D?.5:0,0).setAlign(D?'center':'left').setWordWrapWidth(D?width-24:width-128);
        row.buy.setText(`招募 1 人 · ${army.recruitCost(row.kind)}军粮`).setPosition(D?14:118,D?207:105).setFixedSize(D?width-28:width-136,0).setAlign('center');
        const canBuy=army.food>=army.recruitCost(row.kind);row.buy.setAlpha(canBuy?1:.45);if(canBuy)row.buy.setInteractive({useHandCursor:true});else row.buy.disableInteractive();row.train.setVisible(false);
      }
      return;
    }
    const visible = wave ? this.options : D ? TROOP_KINDS : TROOP_KINDS.slice(this.page * 4, this.page * 4 + 4);
    for (const row of this.rows) {
      const index = visible.indexOf(row.kind); row.root.setVisible(index >= 0); if (index < 0) continue;
      const level = army.levels[row.kind], count = army.units.filter(u => u.active && u.kind === row.kind).length;
      const width = wave ? D ? (cards === 4 ? 208 : 232) : W - 72 : D ? (W - 70) / 4 : (W - 54) / 2;
      const height = wave ? waveCardH : D ? 166 : 245;
      const x = wave ? D ? (W - (width * cards + cardGapX * (cards - 1))) / 2 + index * (width + cardGapX) : 36 : D ? 20 + index % 4 * (width + 10) : 18 + index % 2 * (width + 18);
      const y = wave ? waveTop + (D ? 0 : index * (height + waveGap)) : (D ? 108 : 180) + Math.floor(index / (D ? 4 : 2)) * (height + 18);
      row.root.setPosition(x, y); row.bg.setSize(width, height); row.skin.setDisplaySize(width,height);
      row.plate.clear(); warFrame(row.plate,0,0,width,height,WAR.gold,false);
      row.title.setText(`${TROOPS[row.kind].name} · Lv${level}`).setPosition(wave ? D ? width / 2 : 134 : 12, wave ? 16 : 18).setOrigin(wave && D ? .5 : 0, 0).setFontSize(wave ? D ? 21 : 23 : 18).setColor(wave ? '#f6dc9a' : '#eee2c1');
      const iconSize = wave ? D ? 104 : 112 : D ? 56 : 70;
      const frame = row.icon.frame;
      row.icon.setScale(iconSize / Math.max(frame.width, frame.height)).setPosition(wave ? D ? width / 2 : 66 : D ? 44 : 52, wave ? D ? 98 : height / 2 - 4 : D ? 60 : 80);
      const [roleTag, roleNote] = ROLES[row.kind].split(' · ');
      if (wave) { row.tag.setText(roleTag).setFontSize(D ? 13 : 15); row.tag.setPosition(D ? width / 2 : 134 + row.tag.width / 2 + 9, D ? 172 : 66); }
      row.detail.setText(wave ? `${roleNote}　·　已编入 ${count} 人` : D ? `${count}人 · ${army.recruitCost(row.kind)}粮/人` : `已编入 ${count}人\n${TROOPS[row.kind].perk}`)
        .setPosition(wave ? D ? width / 2 : 134 : D ? 85 : 98, wave ? D ? 190 : 84 : D ? 47 : 59)
        .setOrigin(wave && D ? .5 : 0, 0).setAlign(wave && D ? 'center' : 'left').setLineSpacing(5)
        .setWordWrapWidth(wave ? D ? width - 24 : width - 148 : width - (D ? 92 : 110)).setFontSize(wave ? D ? 14 : 16 : 13).setColor(wave ? '#d9c79f' : '#b9cdbb');
      // 手机 4 张卡时卡片变矮：省掉说明行，招募按钮下移，避免压字
      const compact = wave && !D && cards === 4; row.detail.setVisible(!compact);
      row.buy.setText(wave ? '＋ 招募入队' : `招募 1 人 · ${army.recruitCost(row.kind)}粮`).setFontSize(wave ? D ? 16 : 18 : 15).setPosition(wave && !D ? 134 : 14, wave ? D ? 212 : height - (compact ? 54 : 62) : D ? 84 : 140).setFixedSize(wave && !D ? width - 152 : width - 28, 0).setAlign('center');
      row.w = width; row.h = height;
      row.train.setVisible(!wave).setText(level === 3 ? '训练已满级' : `训练至Lv${level + 1}　${LEGION.trainCost[level]}粮`).setPosition(10, D ? 124 : 193).setFixedSize(width - 20, 0).setAlign('center');
      const canBuy = (wave || army.food >= army.recruitCost(row.kind)), canTrain = !wave && level < 3 && army.food >= LEGION.trainCost[level];
      row.buy.setAlpha(canBuy ? 1 : .45).setColor(canBuy ? '#eee4ca' : '#98a393'); if (canBuy) row.buy.setInteractive({ useHandCursor: true }); else row.buy.disableInteractive();
      row.train.setAlpha(canTrain ? 1 : .45).setColor(canTrain ? '#d9c28a' : '#98a393'); if (canTrain) row.train.setInteractive({ useHandCursor: true }); else row.train.disableInteractive();
      if (wave) this.paintWaveCard(row);
    }
    // 第 4 张：血药卡（效果图）
    if (wave && cards === 4) {
      const w = D ? 208 : W - 72, i = 3;
      this.layoutPotionCard(D ? (W - (w * 4 + cardGapX * 3)) / 2 + i * (w + cardGapX) : 36, waveTop + (D ? 0 : i * (waveCardH + waveGap)), w, waveCardH);
    } else this.potion.root.setVisible(false);
    this.prev.setVisible(!wave && !D).setAlpha(this.page === 0 ? .4 : 1); this.next.setVisible(!wave && !D).setAlpha(this.page === 1 ? .4 : 1); this.pageText.setVisible(!wave && !D).setText(`${this.page + 1} / 2`);
  }
  update(army: Legion, visible: boolean): void { this.hud.setVisible(visible); if (!visible) return; this.status.setText(`军粮 ${army.food} · 当前兵力：${army.count}${army.dead ? ` · 阵亡 ${army.dead}` : ''}`); this.paintOrder(army); }
  private paintOrder(army: Legion): void {
    if (this.orderState === army.order) return;
    this.orderState = army.order;
    const guard = army.order === 'guard', x = this.orderX, y = this.orderY, width = this.orderW, height = this.orderH;
    const color = guard ? 0x83c8b3 : 0xe9b777, g = this.orderPlate;
    this.order.setText(ORDERS[army.order]).setColor(guard ? '#ddf3e9' : '#ffdfb4');
    this.orderHint.setText(guard ? '跟随护卫' : '主动迎敌');
    const r = height / 2, cx = x + 16, cy = y + r;
    g.clear().fillStyle(0x101e19, .5).fillRoundedRect(x, y, width, height, r)
      .lineStyle(1, color, .35).strokeRoundedRect(x, y, width, height, r)
      .lineStyle(1.5, color, .9);
    // 小图标：盾（护阵）/ 箭头（出击）
    if (guard) {
      g.beginPath().moveTo(cx, cy - 7).lineTo(cx + 6, cy - 4).lineTo(cx + 5, cy + 3)
        .lineTo(cx, cy + 7).lineTo(cx - 5, cy + 3).lineTo(cx - 6, cy - 4).closePath().strokePath();
    } else {
      g.lineBetween(cx - 5, cy + 5, cx + 5, cy - 5).lineBetween(cx - 1, cy - 5, cx + 5, cy - 5).lineBetween(cx + 5, cy - 5, cx + 5, cy + 1);
    }
  }

}
