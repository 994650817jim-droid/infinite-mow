import Phaser from 'phaser';
import { ATTRIBUTE_EFFECT, ATTRIBUTE_IDS, ATTRIBUTE_INFO, PRIMARY_BONUS, PRIMARY_MUL, type AttributeId } from '../data/attributes';
import { HEADING_FONT, FONT, TITLE_FONT } from '../config';
import { LQ, lqImageButton } from './LacquerKit';
import { heroPortrait } from './BuildOverview';
import { attrBadge } from './AttrBadge';
import { primarySummary } from './PrimaryAttrInfo';
import type { InfoTip, ItemTooltip } from './ItemTooltip';

/**
 * 「武将修习 · 属性分配」面板电脑版重做（2026-11-19 用户「这里 ui 也要设计一下」）：
 * 左 = 武将水墨立绘 + 名字 / 等级 + 剩余属性点印章；中 = 四张属性卡（图标放大、灯格刻度、主属性金边 + 主属性印 + 专精小徽记、「+」三种状态：可点 / 没点数 / 已满）；
 * 右 = 「实际属性」两列属性块（悬停某张卡的「+」预览加点后变化，绿色 +x）+ 本命武器小栏；规则说明收进标题旁的「?」悬停。
 * 数值全部由 GameScene 算好传进 render()，这里只管画；加点的判定与写回仍在 GameScene（onAdd）。设计坐标 960×540。
 */
export interface AttrStats { damage: number; attack: number; crit: number; hp: number; maxHp: number; hpBonus: number; speed: number; moveBonus: number }
export interface AttrViewState {
  hero: string; heroName: string; level: number; free: number; cap: number;
  points: Record<AttributeId, number>; primary?: AttributeId; weaponName: string; mastery: string; stats: AttrStats;
}
export interface AttrViewOpts { x0: number; y0: number; w: number; h: number; hero: string; onAdd: (id: AttributeId) => boolean }

const GOLD = LQ.gold, GOLD_HI = LQ.goldHi, CREAM = '#eadcbd';
const ATTR_COLOR: Record<AttributeId, number> = { strength: 0xc8573d, agility: 0x5aa86a, intellect: 0x5b86c8, command: 0xc89a3c };
const fmt = (v: number): string => `${+v.toFixed(1)}`;

/** 悬停「+」时各属性块的预览增量（百分点，近似：主属性按 ×PRIMARY_MUL，主属性再 +1% 全伤害）。 */
export function attrPreview(id: AttributeId, primary: boolean, pointsNow: number): { damage?: number; attack?: number; crit?: number; hp?: number; move?: number } {
  const m = primary ? PRIMARY_MUL : 1, E = ATTRIBUTE_EFFECT, bonus = primary && pointsNow < PRIMARY_BONUS.maxPoints ? PRIMARY_BONUS.perPoint * 100 : 0;
  if (id === 'strength') return { damage: E.strength.damage * m * 100 + bonus, hp: E.strength.hp * m * 100 };
  if (id === 'agility') return { attack: E.agility.attackSpeed * m * 100, move: E.agility.move * m * 100, crit: E.agility.crit * m * 100, damage: bonus || undefined };
  return bonus ? { damage: bonus } : {};
}

interface Card { id: AttributeId; y: number; icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; effect: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; button: Phaser.GameObjects.Image; plus: Phaser.GameObjects.Text; chips: Phaser.GameObjects.Text[]; glow: Phaser.GameObjects.Graphics; badge?: Phaser.GameObjects.GameObject }
interface Tile { label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text; delta: Phaser.GameObjects.Text }

export class AttributePanelView {
  private readonly cards: Card[] = []; private readonly tiles: Record<'damage' | 'attack' | 'crit' | 'move' | 'hp', Tile>;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly freeNum: Phaser.GameObjects.Text; private readonly freeLabel: Phaser.GameObjects.Text; private readonly sealG: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text; private readonly lvText: Phaser.GameObjects.Text;
  private readonly weaponName: Phaser.GameObjects.Text; private readonly weaponNote: Phaser.GameObjects.Text;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private state?: AttrViewState; private preview: AttributeId | null = null;
  private readonly mx: number; private readonly mw = 350; private readonly cardH = 86; private readonly top: number;

  constructor(private readonly scene: Phaser.Scene, private readonly root: Phaser.GameObjects.Container, private readonly tip: ItemTooltip, private readonly o: AttrViewOpts) {
    const s = scene, { x0, y0, w } = o, add = <T extends Phaser.GameObjects.GameObject>(x: T): T => { root.add(x); return x; };
    const text = (x: number, y: number, v: string, size: number, color = CREAM, heading = false) => add(s.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }));
    this.top = y0 + 64; const lx = x0 + 28; this.mx = lx + 196 + 20; const rx = this.mx + this.mw + 16, rw = x0 + w - 28 - rx;
    this.gfx = add(s.add.graphics()); this.cardsGfx = add(s.add.graphics());
    // ── 标题 + 「?」规则提示 ──
    const cx = x0 + w / 2;
    const title = add(s.add.text(cx, y0 + 34, '武将修习 · 属性分配', { fontFamily: TITLE_FONT, fontSize: '24px', color: '#efd399', resolution: 2, stroke: '#120904', strokeThickness: 4 }).setOrigin(.5));
    const q = add(s.add.circle(cx + title.width / 2 + 22, y0 + 34, 11, 0x241a10, 1).setStrokeStyle(1.5, GOLD, .9).setInteractive({ useHandCursor: false }).setName('attribute-rules'));
    add(s.add.text(q.x, q.y, '?', { fontFamily: HEADING_FONT, fontSize: '15px', color: '#efd399', resolution: 2 }).setOrigin(.5));
    tip.attachInfo(q, () => this.rulesTip());
    // ── 左栏：立绘 / 名字 / 剩余点数印章 ──
    const pw = 196, ph = 262, py = y0 + 64;
    this.gfx.fillStyle(0x0e0905, .9).fillRoundedRect(lx, py, pw, ph, 6).lineStyle(2, GOLD, .9).strokeRoundedRect(lx, py, pw, ph, 6).lineStyle(1, GOLD, .4).strokeRoundedRect(lx + 4, py + 4, pw - 8, ph - 8, 4);
    heroPortrait(s, root, o.hero, lx + 3, py + 3, pw - 6, ph - 6, 'attribute-portrait');
    this.nameText = text(lx + pw / 2, py + ph + 14, '', 22, '#f3d48a', true).setOrigin(.5, 0).setStroke('#120904', 3);
    this.lvText = text(lx + pw / 2, py + ph + 42, '', 13, '#b9c5b0').setOrigin(.5, 0);
    this.sealG = add(s.add.graphics());
    this.freeLabel = text(lx + pw / 2 + 38, py + ph + 84, '剩余点数', 12, '#b9c5b0').setOrigin(.5);
    this.freeNum = add(s.add.text(lx + 52, py + ph + 84, '0', { fontFamily: HEADING_FONT, fontSize: '34px', fontStyle: 'bold', color: '#f6dc9a', resolution: 2, stroke: '#2a0b07', strokeThickness: 4 }).setOrigin(.5).setName('attribute-free'));
    // ── 中栏：四张属性卡 ──
    ATTRIBUTE_IDS.forEach((id, i) => this.cards.push(this.makeCard(id, i)));
    // ── 右栏：实际属性 ──
    const sy = this.top;
    text(rx, sy - 2, '实际属性', 16, '#efd399', true);
    const tw = (rw - 8) / 2, th = 58, ty0 = sy + 28;
    const mk = (x: number, y: number, ww: number, label: string): Tile => ({ label: text(x + 10, y + 6, label, 11, '#a9b9a3'), value: text(x + 10, y + 21, '', 19, '#f3d48a', true), sub: text(x + ww - 10, y + 8, '', 11, '#9fb3a0').setOrigin(1, 0), delta: text(x + ww - 10, y + 26, '', 13, '#8fe0a0').setOrigin(1, 0).setName('attribute-delta') });
    this.tiles = { damage: mk(rx, ty0, tw, '伤害'), attack: mk(rx + tw + 8, ty0, tw, '攻速'), crit: mk(rx, ty0 + th + 8, tw, '暴击'), move: mk(rx + tw + 8, ty0 + th + 8, tw, '移速'), hp: mk(rx, ty0 + 2 * (th + 8), rw, '生命') };
    this.tileRects = [[rx, ty0, tw, th], [rx + tw + 8, ty0, tw, th], [rx, ty0 + th + 8, tw, th], [rx + tw + 8, ty0 + th + 8, tw, th], [rx, ty0 + 2 * (th + 8), rw, th]];
    this.hpBar = add(s.add.graphics()); this.hpRect = { x: rx + 10, y: ty0 + 2 * (th + 8) + th - 12, w: rw - 20 };
    // ── 右栏：本命武器小栏 ──
    const wy = ty0 + 3 * (th + 8) + 4;
    this.weaponBox = [rx, wy, rw, 70];
    text(rx + 10, wy + 7, '本命武器', 11, '#a9b9a3');
    this.weaponName = text(rx + 10, wy + 24, '', 14, '#f3d48a', true);
    this.weaponNote = text(rx + 10, wy + 46, '', 11, '#cbbf94').setWordWrapWidth(rw - 20);
    this.paintStatic();
  }
  private tileRects: Array<[number, number, number, number]> = [];
  private hpRect = { x: 0, y: 0, w: 0 };
  private weaponBox: [number, number, number, number] = [0, 0, 0, 0];

  private paintStatic(): void {
    const g = this.gfx, box = (x: number, y: number, w: number, h: number) => g.fillStyle(0x120c07, .88).fillRoundedRect(x, y, w, h, 5).lineStyle(1, GOLD, .4).strokeRoundedRect(x, y, w, h, 5);
    for (const [x, y, w, h] of this.tileRects) box(x, y, w, h);
    box(...this.weaponBox);
  }

  private rulesTip(): InfoTip {
    const st = this.state;
    return { title: '属性点规则', sub: st ? `当前 Lv.${st.level} · 单项上限 ${st.cap} 点` : undefined, body: 'Lv25 前每级 1 点，之后每 2–3 级 1 点。\n点数按武将永久保存，随时可在此加点。\n主属性每点效果 ×' + +PRIMARY_MUL.toFixed(2) + '，另加全伤害；满 4 / 7 / 10 点解锁专精。' };
  }

  private makeCard(id: AttributeId, i: number): Card {
    const s = this.scene, root = this.root, add = <T extends Phaser.GameObjects.GameObject>(x: T): T => { root.add(x); return x; };
    const x = this.mx, y = this.top + i * (this.cardH + 8), w = this.mw, cy = y + this.cardH / 2;
    const glow = add(s.add.graphics()).setAlpha(0);
    const icon = add(s.add.image(x + 38, cy - 2, ATTRIBUTE_INFO[id].icon).setDisplaySize(52, 52));
    const name = add(s.add.text(x + 74, y + 8, ATTRIBUTE_INFO[id].name, { fontFamily: HEADING_FONT, fontSize: '18px', color: '#f3dfb0', resolution: 2 }));
    const effect = add(s.add.text(x + 74, y + 31, '', { fontFamily: FONT, fontSize: '11px', color: '#a9b9a3', resolution: 2, lineSpacing: 2 }).setWordWrapWidth(214));
    const value = add(s.add.text(x + 74 + 184, y + this.cardH - 19, '', { fontFamily: FONT, fontSize: '12px', color: '#e5d4ab', resolution: 2 }));
    const button = add(s.add.image(x + w - 38, cy, 'ui_war_button').setDisplaySize(50, 44).setInteractive({ useHandCursor: true }).setName('attribute-add-' + id));
    const plus = add(s.add.text(button.x, button.y - 1, '+', { fontFamily: FONT, fontSize: '26px', color: '#ffe9bd', resolution: 2, stroke: '#2a170b', strokeThickness: 3 }).setOrigin(.5));
    lqImageButton(s, button, 50, 44, 'gold', plus);
    const card: Card = { id, y, icon, name, effect, value, button, plus, chips: [], glow };
    button.on('pointerdown', () => { if (this.o.onAdd(id)) this.flash(card); });
    button.on('pointerover', () => { this.preview = id; this.renderTiles(); });
    button.on('pointerout', () => { if (this.preview === id) { this.preview = null; this.renderTiles(); } });
    if (this.isPrimaryId(id)) this.buildPrimaryExtras(card);
    return card;
  }
  private isPrimaryId(id: AttributeId): boolean { return id === primaryOf(this.o.hero); }
  private buildPrimaryExtras(card: Card): void {
    const s = this.scene, root = this.root, x = this.mx, y = card.y;
    card.name.setName('attribute-primary-head');
    const ab = attrBadge(s, x + 74 + card.name.width + 16, y + 18, this.o.hero, 20); if (ab) { root.add(ab); card.badge = ab; }
    let cxp = x + 74 + card.name.width + 38;
    for (let k = 0; k < 3; k++) {
      const chip = s.add.text(cxp, y + 18, '', { fontFamily: FONT, fontSize: '11px', color: '#93a08e', resolution: 2 }).setOrigin(0, .5).setPadding(5, 3).setInteractive({ useHandCursor: false }).setName('attribute-perk-' + (k + 1));
      root.add(chip); card.chips.push(chip);
      this.tip.attachInfo(chip, () => this.perkTip(k)); cxp += 48;
    }
    const zone = s.add.zone(x, y, this.mw - 62, this.cardH).setOrigin(0).setInteractive().setName('attribute-primary-hit'); root.add(zone);
    root.sendToBack(zone); // 整张卡悬停出完整说明；不挡「+」和徽记
    this.tip.attachInfo(zone, () => primarySummary(this.o.hero, this.state?.points[card.id] ?? 0, this.state?.cap)?.tip);
  }
  private perkTip(k: number): InfoTip | null {
    const st = this.state, sum = st?.primary ? primarySummary(this.o.hero, st.points[st.primary], st.cap) : null, t = sum?.tiers[k]; if (!t) return null;
    return { title: `${t.name}（专精 ${k + 1}/3）`, sub: `主属性满 ${t.at} 点解锁`, body: t.desc + (t.on ? '\n已解锁' : `\n还差 ${t.left} 点`) };
  }

  /** 加点成功的反馈：卡片金光一闪 + 「+1」从按钮飘起。 */
  private flash(c: Card): void {
    const s = this.scene; c.glow.clear().fillStyle(GOLD_HI, .35).fillRoundedRect(this.mx, c.y, this.mw, this.cardH, 7); c.glow.setAlpha(1);
    s.tweens.add({ targets: c.glow, alpha: 0, duration: 420, ease: 'Quad.easeOut' });
    const t = s.add.text(c.button.x, c.button.y - 6, '+1', { fontFamily: HEADING_FONT, fontSize: '20px', color: '#fff0c0', resolution: 2, stroke: '#2a170b', strokeThickness: 4 }).setOrigin(.5).setDepth(1e5).setScrollFactor(0);
    this.root.add(t); s.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 620, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  render(st: AttrViewState): void {
    this.state = st;
    const { x0, y0 } = this.o, g = this.gfx; void x0; void y0;
    this.nameText.setText(st.heroName); this.lvText.setText(`Lv.${st.level}`);
    this.paintSeal(st.free);
    const cardsG = this.cardsGfx; cardsG.clear();
    for (const c of this.cards) {
      const lv = st.points[c.id], cap = st.cap, full = lv >= cap, can = st.free > 0 && !full, primary = c.id === st.primary, x = this.mx, y = c.y, w = this.mw, h = this.cardH;
      cardsG.fillStyle(primary ? 0x2c1d0e : LQ.lacquerHi, primary ? .9 : .5).fillRoundedRect(x, y, w, h, 7).lineStyle(primary ? 2 : 1, GOLD, primary ? .95 : .38).strokeRoundedRect(x, y, w, h, 7);
      if (primary) cardsG.lineStyle(1, GOLD_HI, .35).strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
      // 灯格刻度：cap 格，点亮的按属性色，主属性在 4 / 7 / 10 格上方画专精刻度
      const px = x + 74, py = y + h - 15, cell = Math.min(16, (178 - (cap - 1) * 3) / cap);
      for (let k = 0; k < cap; k++) {
        const cx = px + k * (cell + 3), on = k < lv, col = ATTR_COLOR[c.id];
        cardsG.fillStyle(on ? col : 0x1b130b, 1).fillRoundedRect(cx, py, cell, 9, 2).lineStyle(1, on ? 0xfff0c0 : 0x6e5a3a, on ? .8 : .9).strokeRoundedRect(cx, py, cell, 9, 2);
        if (on) cardsG.fillStyle(0xffffff, .28).fillRoundedRect(cx + 1, py + 1, cell - 2, 3, 1);
      }
      if (primary) for (const at of [4, 7, 10]) { if (at > cap) continue; const cx = px + (at - 1) * (cell + 3) + cell / 2, on = lv >= at; cardsG.fillStyle(on ? GOLD_HI : 0x6e5a3a, 1); cardsG.fillTriangle(cx - 3, py - 6, cx + 3, py - 6, cx, py - 1); }
      c.effect.setText(ATTRIBUTE_INFO[c.id].effect + (primary ? `\n主属性 每点 ×${+PRIMARY_MUL.toFixed(2)}` : '')).setColor(primary ? '#d8c78e' : '#a9b9a3');
      c.value.setText(full ? '已满' : `${lv}/${cap}`).setColor(full ? '#f3d48a' : '#e5d4ab');
      // 「+」三态：可点 / 没点数（暗、不可点）/ 已满（印「满」、不可点）
      if (full) { c.button.setVisible(false).disableInteractive(); c.plus.setText('满').setFontSize(20).setColor('#f3d48a').setAlpha(1).setStroke('#2a170b', 3); this.drawFullSeal(cardsG, c); }
      else {
        c.button.setVisible(true); c.plus.setText('+').setFontSize(26);
        if (can) { c.button.setAlpha(1).setInteractive({ useHandCursor: true }); c.plus.setAlpha(1).setColor('#ffe9bd'); }
        else { c.button.setAlpha(.32).disableInteractive(); c.plus.setAlpha(.4).setColor('#9d927a'); }
      }
      if (primary) { const sum = primarySummary(this.o.hero, lv, cap); c.chips.forEach((ch, k) => { const on = !!sum?.tiers[k]?.on; ch.setText(`${on ? '◆' : '◇'} ${sum?.tiers[k]?.name ?? ''}`).setColor(on ? '#ffe3a0' : '#8f9b8b'); }); }
    }
    void g; this.renderTiles();
    this.weaponName.setText(st.weaponName || '—'); this.weaponNote.setText(st.mastery);
  }
  private readonly cardsGfx: Phaser.GameObjects.Graphics;

  private drawFullSeal(g: Phaser.GameObjects.Graphics, c: Card): void {
    const x = c.button.x, y = c.button.y;
    g.fillStyle(0x7a2418, 1).fillRoundedRect(x - 21, y - 21, 42, 42, 4).lineStyle(2, GOLD_HI, .9).strokeRoundedRect(x - 21, y - 21, 42, 42, 4).lineStyle(1, 0xf3e2c4, .5).strokeRoundedRect(x - 17, y - 17, 34, 34, 2);
  }
  private paintSeal(free: number): void {
    const g = this.sealG, cx = this.freeNum.x, cy = this.freeNum.y; g.clear();
    const has = free > 0;
    g.fillStyle(0x000000, .35).fillRoundedRect(cx - 28 + 2, cy - 28 + 3, 56, 56, 5);
    g.fillStyle(has ? 0x9a2a1c : 0x2a2418, 1).fillRoundedRect(cx - 28, cy - 28, 56, 56, 5).lineStyle(2, has ? GOLD_HI : 0x5c4e34, .95).strokeRoundedRect(cx - 28, cy - 28, 56, 56, 5).lineStyle(1, has ? 0xf3e2c4 : 0x5c4e34, .5).strokeRoundedRect(cx - 24, cy - 24, 48, 48, 3);
    this.freeNum.setText(String(free)).setColor(has ? '#f8e6b0' : '#7d725a'); this.freeLabel.setText(has ? '剩余点数 · 可加点' : '点数已用完').setColor(has ? '#e7cf8f' : '#8d917f');
  }
  private renderTiles(): void {
    const st = this.state; if (!st) return; const S = st.stats, T = this.tiles;
    const pv = this.preview ? attrPreview(this.preview, this.preview === st.primary, st.points[this.preview]) : {};
    const can = !!this.preview && st.free > 0 && st.points[this.preview] < st.cap, d = (v: number | undefined): string => can && v ? `+${fmt(v)}%` : '';
    T.damage.value.setText(`+${S.damage}%`); T.damage.delta.setText(d(pv.damage));
    T.attack.value.setText(`+${S.attack}%`); T.attack.delta.setText(d(pv.attack));
    T.crit.value.setText(`${Math.round(S.crit * 100)}%`); T.crit.delta.setText(d(pv.crit));
    T.move.value.setText(`${S.speed}`); T.move.sub.setText(`+${S.moveBonus}%`); T.move.delta.setText(d(pv.move));
    T.hp.value.setText(`${S.hp} / ${S.maxHp}`); T.hp.sub.setText(`上限 +${S.hpBonus}%`); T.hp.delta.setText(d(pv.hp));
    this.hpBar.clear(); const r = this.hpRect, f = Phaser.Math.Clamp(S.hp / Math.max(1, S.maxHp), 0, 1);
    this.hpBar.fillStyle(0x1b130b, 1).fillRoundedRect(r.x, r.y, r.w, 6, 3).fillStyle(0x6bbd78, 1).fillRoundedRect(r.x, r.y, Math.max(4, r.w * f), 6, 3).lineStyle(1, 0x6e5a3a, .9).strokeRoundedRect(r.x, r.y, r.w, 6, 3);
  }
}
function primaryOf(hero: string): AttributeId | undefined { return PRIMARY_LOOKUP(hero); }
import { primaryAttribute } from '../data/attributes';
const PRIMARY_LOOKUP = (hero: string): AttributeId | undefined => primaryAttribute(hero);
