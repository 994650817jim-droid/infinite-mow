import Phaser from 'phaser';
import { inkSkin } from './HomeCommand';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { TACTICS, TAG_NAMES, type BuildTag, type TacticId } from '../data/builds';
import { SCHOOLS, SCHOOL_IDS, SHI_SOURCES, OFFER, TIER_STEPS, heroAffinity } from '../data/schools';
import { COMBO_AT } from '../data/schoolCombos';
import { WEAPON_DEFS } from '../weapons/registry';
import { ATTRIBUTE_INFO, attributeCap, attributeIcon, type AttributeId } from '../systems/RunGrowth';
import { allocateHeroAttr, heroAttrs, heroFreePoints, heroInfo, takeAttrNotice, type HeroKey } from '../systems/HeroProgress';
import { primaryAttribute, PRIMARY_MUL, PRIMARY_PERK_INFO, PRIMARY_TIERS } from '../data/attributes';
import { gearFor, gearSummary } from '../systems/ItemEffects';
import { gearOwners, ownerName } from '../systems/RosterStore';
import { TACTIC_UNLOCK_SCROLLS, TEMPER, XINDE_SLOTS, getXinde, grain, respec, respecCost, scrolls, tacticUnlocked, temperCost, temperLevel, temperUp, toggleXinde, unlockTactic } from '../systems/MasteryStore';
import { LQ, lqDiamond, lqHitBox, lqPanel, lqSkin } from './LacquerKit';
import { attrBadge } from './AttrBadge';

type Tab = 'overview' | 'attrs' | 'weapon' | 'xinde' | 'schools';
/** 电脑版手绘素材（public/assets/ui/codex/codex_*.png）：页签三态、箭头四态、朱印、节标题牌、立绘挂轴框。 */
const CODEX_ART = ['tab_n', 'tab_h', 'tab_s', 'arrow_l', 'arrow_lh', 'arrow_r', 'arrow_rh', 'seal', 'header', 'scroll'];
const TABS: [Tab, string][] = [['overview', '总览'], ['attrs', '属性'], ['weapon', '本命'], ['xinde', '战法心得'], ['schools', '流派亲和']];

/** 武将谱入口（营寨建筑「将帅府」等调用）。 */
export function openHeroCodex(scene: Phaser.Scene, hero?: HeroKey, onClose?: () => void): HeroCodexUI { return new HeroCodexUI(scene, hero, onClose); }

/**
 * 武将谱（2026-11-16 用户批准 hero-management-proposal.md 方案 B）第一批：
 * 左边列出主公和已拥有的武将；右边分页「总览 / 属性（加点、洗点）/ 本命（淬炼）/ 战法心得（解锁、预选 2 个）」。
 * 招募来的大众武将（r_）只看等级和属性，本命淬炼、心得只对可玩名将开放（他们的随行心得由招募会话对接）。
 * 电脑布局优先；命名的命中区供测试与手柄使用。
 */
export class HeroCodexUI {
  readonly root: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private hero: HeroKey;
  private tab: Tab = 'overview';
  private notice = '';
  private artLoading = false;

  constructor(private readonly scene: Phaser.Scene, hero?: HeroKey, private readonly onClose?: () => void) {
    const list = gearOwners();
    this.hero = (hero && list.some(o => o.id === hero) ? hero : list[0]?.id ?? 'zhaoyun') as HeroKey;
    this.root = scene.add.container(0, 0).setDepth(DEPTH.overlay + 20).setScrollFactor(0).setName('hero-codex').setData('ui', this);
    if (takeAttrNotice()) this.notice = '属性已改版：点数已全部返还，请在「属性」页重新分配';
    this.render();
  }
  close(): void { this.root.destroy(); this.onClose?.(); }

  private get playable(): CharacterId | null { return CHARACTERS.some(c => c.id === this.hero) ? this.hero as CharacterId : null; }
  private add<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => unknown }>(o: T): T { o.setScrollFactor(0); this.body.add(o); return o; }
  private text(x: number, y: number, v: string, size: number, color = '#e9dcbc', heading = false): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }));
  }
  private button(x: number, y: number, label: string, name: string, onClick: () => void, o: { size?: number; active?: boolean; disabled?: boolean; w?: number; ink?: boolean } = {}): Phaser.GameObjects.Text {
    const t = this.text(x, y, label, o.size ?? 14, o.disabled ? '#8d7d60' : '#ffe9bd').setOrigin(.5).setPadding(12, 7).setName(name);
    const bw = o.w ? o.w + 24 : Math.max(t.width, 44), bh = Math.max(30, t.height);
    if (t.width > bw - 6) t.setScale((bw - 6) / t.width);
    if (!o.disabled) t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); onClick(); });
    lqHitBox(t, bw, bh);
    const skin = (IS_DESKTOP && o.ink ? inkSkin(this.scene, t, () => ({ w: bw, h: bh }), { active: () => !!o.active, enabled: () => !o.disabled }) : null) ?? lqSkin(this.scene, t, t, () => ({ w: bw, h: bh }), { tone: o.active ? 'cinnabar' : 'quiet', on: () => !!o.active, enabled: () => !o.disabled }); // 电脑版水墨（2026-11-17 UI 审查 N）
    skin.gfx.setScrollFactor(0); this.body.addAt(skin.gfx, this.body.getIndex(t));
    return t;
  }
  private act(r: { ok: boolean; message: string }): void { this.notice = r.message; this.render(); }

  render(): void {
    this.body?.destroy();
    this.body = this.scene.add.container(0, 0).setScrollFactor(0); this.root.add(this.body);
    if (IS_DESKTOP) { this.renderDesk(); return; }
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    this.add(this.scene.add.rectangle(0, 0, W, H, 0x0b0805, .86).setOrigin(0).setInteractive()).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const x0 = D ? 18 : 10, y0 = D ? 12 : 14, pw = W - x0 * 2, ph = H - y0 * 2;
    lqPanel(this.add(this.scene.add.graphics()), x0, y0, pw, ph);
    this.text(x0 + 28, y0 + (D ? 18 : 22), '武将谱', D ? 26 : 30, '#f2ddae', true);
    this.text(x0 + (D ? 130 : 140), y0 + (D ? 28 : 34), `武学残卷 ${scrolls()} · 军粮 ${grain()}`, 13, '#e8d6a4').setName('codex-resources');
    this.button(x0 + pw - (D ? 52 : 56), y0 + (D ? 32 : 40), '返回', 'codex-close', () => this.close(), { size: D ? 15 : 17 });

    // 左：武将列表
    const owners = gearOwners(), lx = x0 + 24, lw = D ? 150 : pw - 48, top = y0 + (D ? 70 : 84);
    if (D) owners.forEach((o, i) => { const lv = heroInfo(o.id as HeroKey).level; this.button(lx + lw / 2, top + i * 38, `${o.name}  Lv.${lv}`, 'codex-hero-' + o.id, () => { this.hero = o.id as HeroKey; this.render(); }, { active: o.id === this.hero, w: lw - 24 }); });
    else { const per = 4, cw = (lw - 3 * 8) / per; owners.forEach((o, i) => this.button(lx + cw / 2 + (i % per) * (cw + 8), top + Math.floor(i / per) * 40, o.name, 'codex-hero-' + o.id, () => { this.hero = o.id as HeroKey; this.render(); }, { active: o.id === this.hero, w: cw - 24 })); }
    // 右：分页
    const rx = D ? x0 + 200 : x0 + 24, rw = D ? pw - 224 : pw - 48, ry = D ? top : top + Math.ceil(owners.length / 4) * 40 + 10;
    const tw = (rw - (TABS.length - 1) * 8) / TABS.length;
    TABS.forEach(([id, label], i) => this.button(rx + tw / 2 + i * (tw + 8), ry, label, 'codex-tab-' + id, () => { this.tab = id; this.render(); }, { active: this.tab === id, w: tw - 24, size: 15 }));
    const cy = ry + 34;
    if (this.tab === 'overview') this.renderOverview(rx, cy, rw);
    else if (this.tab === 'attrs') this.renderAttrs(rx, cy, rw);
    else if (this.tab === 'weapon') this.renderWeapon(rx, cy, rw);
    else if (this.tab === 'schools') this.renderSchools(rx, cy, rw, y0 + ph - 14);
    else if (D) this.renderXindeDesk(rx, cy, rw, y0 + ph - 14);
    else this.renderXinde(rx, cy, rw, y0 + ph - 50);
    // 电脑「战法心得」页：提示放进底部说明栏（见 renderXindeDesk），这里不再叠一条
    if (this.notice && !(D && this.tab === 'xinde')) { this.text(W / 2, y0 + ph - 24, this.notice, 14, '#f3d48a').setOrigin(.5).setBackgroundColor('#1b120bcc').setPadding(10, 4).setName('codex-notice'); this.notice = ''; }
  }

  // ───────────── 电脑版版式（2026-11-19 用户「武将谱ui优化一下」） ─────────────
  // 左：武将名册（漆金行）；右上：‹ 武将名 › + 等级经验条；其下手绘漆金页签栏；内容区各节用「朱印节标题牌」。
  // 全屏只有一个水墨笔触按钮（本页主操作：洗点 / 淬炼），其余一律漆金。素材：public/assets/ui/codex/（Gemini 洋红底 → crop-terrain-kit 抠图）。

  /** 手绘素材按需加载（第一次打开武将谱时），载完重画。 */
  private ensureArt(): boolean {
    const missing = CODEX_ART.filter(k => !this.scene.textures.exists('codex_' + k));
    if (!missing.length) return true;
    if (!this.artLoading) {
      this.artLoading = true;
      for (const k of missing) this.scene.load.image('codex_' + k, 'assets/ui/codex/codex_' + k + '.png');
      this.scene.load.once('complete', () => { if (this.root.active) this.render(); });
      this.scene.load.start();
    }
    return false;
  }
  private has(k: string): boolean { return this.scene.textures.exists('codex_' + k); }

  /** 页签 / 名册行这类「图片底 + 文字」的按钮：常态 / 悬停 / 选中三张图；缺图时退回漆金按钮。 */
  private plate(x: number, y: number, w: number, h: number, label: string, name: string, active: boolean, onClick: () => void, size = 15): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    if (!this.has('tab_n')) return this.button(x, y, label, name, onClick, { active, w: w - 24, size });
    const img = this.add(this.scene.add.image(x, y, active ? 'codex_tab_s' : 'codex_tab_n').setDisplaySize(w, h).setName(name));
    const t = this.text(x, y, label, size, active ? '#fff3d6' : '#e8d6a4', true).setOrigin(.5);
    if (t.width > w - 26) t.setScale((w - 26) / t.width);
    img.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { if (!active) { img.setTexture('codex_tab_h').setDisplaySize(w, h * 1.08); t.setColor('#fff3d6'); } })
      .on('pointerout', () => { if (!active) { img.setTexture('codex_tab_n').setDisplaySize(w, h); t.setColor('#e8d6a4'); } })
      .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); onClick(); });
    return img;
  }

  /** 圆形箭头按钮（上一位 / 下一位武将）。 */
  private arrow(x: number, y: number, dir: 'l' | 'r', name: string, onClick: () => void): void {
    const size = 30;
    if (!this.has('arrow_' + dir)) { this.button(x, y, dir === 'l' ? '‹' : '›', name, onClick, { size: 18 }); return; }
    const img = this.add(this.scene.add.image(x, y, 'codex_arrow_' + dir).setDisplaySize(size, size).setName(name));
    img.setInteractive({ useHandCursor: true })
      .on('pointerover', () => img.setTexture('codex_arrow_' + dir + 'h').setDisplaySize(size + 3, size + 3))
      .on('pointerout', () => img.setTexture('codex_arrow_' + dir).setDisplaySize(size, size))
      .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); onClick(); });
  }

  /** 节标题：左端朱印 + 漆底窄条（手绘标题牌），标题字压在印右边。返回节内容起始 y。 */
  private section(x: number, y: number, w: number, title: string, right = ''): number {
    // 九宫拉伸：左端朱印与右端收边保持原比例，只拉中段（标题牌原图 866×82）
    if (this.has('header')) { const k = 24 / 82; this.add(this.scene.add.nineslice(x, y, 'codex_header', undefined, w / k, 82, 90, 40).setOrigin(0, .5).setScale(k).setAlpha(.95)); }
    else { const g = this.add(this.scene.add.graphics()); g.fillStyle(0x9a2a1c, 1).fillRect(x + 4, y - 7, 14, 14); g.lineStyle(1, LQ.gold, .7).lineBetween(x + 24, y, x + w, y); }
    this.text(x + 32, y, title, 14, '#f3d48a', true).setOrigin(0, .5);
    if (right) this.text(x + w - 10, y, right, 11.5, '#c8b88f').setOrigin(1, .5);
    return y + 18;
  }

  /** 点数刻度条：cap 格，前 v 格亮金；主属性用朱红底。 */
  private pips(x: number, y: number, v: number, cap: number, w: number, primary = false): void {
    const g = this.add(this.scene.add.graphics()), n = Math.max(1, cap), gap = 2, cw = (w - gap * (n - 1)) / n, h = 8;
    for (let i = 0; i < n; i++) {
      const px = x + i * (cw + gap);
      g.fillStyle(i < v ? (primary ? 0xf3c46a : 0xd9b36a) : 0x2b2117, 1).fillRoundedRect(px, y, cw, h, 2);
      g.lineStyle(1, i < v ? 0xfff0c0 : 0x5e4a2c, i < v ? .55 : .9).strokeRoundedRect(px + .5, y + .5, cw - 1, h - 1, 2);
    }
  }

  private renderDesk(): void {
    const W = GAME_WIDTH, H = GAME_HEIGHT; this.ensureArt();
    this.add(this.scene.add.rectangle(0, 0, W, H, 0x0b0805, .86).setOrigin(0).setInteractive()).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const x0 = 18, y0 = 12, pw = W - 36, ph = H - 24, bottom = y0 + ph - 18;
    lqPanel(this.add(this.scene.add.graphics()), x0, y0, pw, ph);
    // 顶栏：标题 · 资源 · 返回
    this.text(x0 + 28, y0 + 16, '武将谱', 26, '#f2ddae', true);
    this.text(x0 + 128, y0 + 27, `武学残卷 ${scrolls()} · 军粮 ${grain()}`, 13, '#e8d6a4').setName('codex-resources');
    this.button(x0 + pw - 52, y0 + 32, '返回', 'codex-close', () => this.close(), { size: 15 });
    { const g = this.add(this.scene.add.graphics()); g.lineStyle(1, LQ.gold, .45).lineBetween(x0 + 22, y0 + 56, x0 + pw - 22, y0 + 56); }

    // 左：武将名册（主公在前；降将 / 招募将同列），行高按人数收紧
    const owners = gearOwners(), lx = x0 + 22, lw = 152, top = y0 + 66, listH = bottom - top;
    const rowH = Math.max(24, Math.min(36, Math.floor(listH / Math.max(1, owners.length))));
    const lg = this.add(this.scene.add.graphics());
    lg.fillStyle(0x0d0906, .55).fillRoundedRect(lx - 4, top - 4, lw + 8, Math.min(listH, owners.length * rowH) + 6, 6);
    owners.forEach((o, i) => {
      const y = top + i * rowH, on = o.id === this.hero, lv = heroInfo(o.id as HeroKey).level, h = rowH - 4;
      const g = this.add(this.scene.add.graphics());
      const paint = (hover: boolean) => {
        g.clear();
        if (on) g.fillStyle(0x7a2a1c, .95).fillRoundedRect(lx, y, lw, h, 4).lineStyle(1.5, 0xf3d48a, 1).strokeRoundedRect(lx + .5, y + .5, lw - 1, h - 1, 4).fillStyle(0xf3d48a, 1).fillTriangle(lx + lw + 1, y + h / 2 - 5, lx + lw + 7, y + h / 2, lx + lw + 1, y + h / 2 + 5);
        else if (hover) g.fillStyle(0x3a2616, .9).fillRoundedRect(lx, y, lw, h, 4).lineStyle(1, 0xc9a35e, .9).strokeRoundedRect(lx + .5, y + .5, lw - 1, h - 1, 4);
        else g.lineStyle(1, 0x5e4a2c, .55).lineBetween(lx + 8, y + h + 1.5, lx + lw - 8, y + h + 1.5);
      };
      paint(false);
      const b = attrBadge(this.scene, lx + 15, y + h / 2, o.id, 18); if (b) this.add(b);
      this.text(lx + 30, y + h / 2, o.name, 15, on ? '#fff3d6' : '#efe0bb', true).setOrigin(0, .5);
      this.text(lx + lw - 10, y + h / 2, 'Lv.' + lv, 12, on ? '#ffe2a0' : '#a8977a').setOrigin(1, .5);
      this.add(this.scene.add.rectangle(lx, y, lw, h, 0, .001).setOrigin(0)).setName('codex-hero-' + o.id).setInteractive({ useHandCursor: true })
        .on('pointerover', () => paint(true)).on('pointerout', () => paint(false))
        .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.hero = o.id as HeroKey; this.render(); });
    });

    // 右上：‹ 名字 · 主属性印 · 等级与经验条 ›
    const rx = x0 + 196, rw = x0 + pw - 24 - rx, info = heroInfo(this.hero), idx = owners.findIndex(o => o.id === this.hero);
    const go = (d: number) => { if (!owners.length) return; this.hero = owners[(idx + d + owners.length) % owners.length].id as HeroKey; this.render(); };
    this.arrow(rx + 15, top + 14, 'l', 'codex-prev', () => go(-1));
    const nm = this.text(rx + 38, top + 14, ownerName(this.hero), 24, '#f6dc9a', true).setOrigin(0, .5).setName('codex-name');
    { const b = attrBadge(this.scene, nm.x + nm.width + 18, top + 14, this.hero, 24); if (b) this.add(b); }
    const ex = nm.x + nm.width + 40;
    this.text(ex, top + 4, `Lv.${info.level}`, 15, '#ffe9bd', true).setName('codex-level-num');
    this.text(ex + 46, top + 6, `本章上限 Lv.${info.cap}${info.level >= info.cap ? ' · 已到上限，经验暂存' : ''}`, 11.5, '#a8977a');
    const bw = Math.min(260, rx + rw - 70 - ex), bg = this.add(this.scene.add.graphics()), k = Math.max(0, Math.min(1, info.xp / Math.max(1, info.next)));
    bg.fillStyle(0x0d0906, .9).fillRoundedRect(ex, top + 22, bw, 7, 3).fillStyle(0xd9b36a, 1).fillRoundedRect(ex, top + 22, Math.max(4, bw * k), 7, 3).lineStyle(1, 0x7d6640, .9).strokeRoundedRect(ex + .5, top + 22.5, bw - 1, 6, 3);
    this.text(ex + bw + 8, top + 25, `${info.xp} / ${info.next}`, 11, '#c8b88f').setOrigin(0, .5);
    // 测试 / 旧代码用：等级整行文字
    this.text(-999, -999, `等级 Lv.${info.level}（本章上限 Lv.${info.cap}）· 经验 ${info.xp} / ${info.next}`, 10).setName('codex-level').setVisible(false);
    this.text(rx + rw - 54, top + 14, `${idx + 1} / ${owners.length}`, 11, '#8d7d60').setOrigin(.5);
    this.arrow(rx + rw - 15, top + 14, 'r', 'codex-next', () => go(1));

    // 页签栏
    const ty = top + 56, gap = 6, tw = (rw - gap * (TABS.length - 1)) / TABS.length;
    TABS.forEach(([id, label], i) => this.plate(rx + tw / 2 + i * (tw + gap), ty, tw, 30, label, 'codex-tab-' + id, this.tab === id, () => { this.tab = id; this.render(); }));
    { const g = this.add(this.scene.add.graphics()); g.lineStyle(1, LQ.gold, .5).lineBetween(rx, ty + 21, rx + rw, ty + 21); }
    const cy = ty + 32;
    if (this.tab === 'overview') this.deskOverview(rx, cy, rw, bottom);
    else if (this.tab === 'attrs') this.deskAttrs(rx, cy, rw, bottom);
    else if (this.tab === 'weapon') this.deskWeapon(rx, cy, rw, bottom);
    else if (this.tab === 'schools') this.renderSchools(rx, cy, rw, bottom);
    else this.renderXindeDesk(rx, cy, rw, bottom);
    if (this.notice && this.tab !== 'xinde') { this.text(rx + rw / 2, bottom - 4, this.notice, 13, '#f3d48a').setOrigin(.5, 1).setBackgroundColor('#1b120bdd').setPadding(10, 4).setName('codex-notice'); this.notice = ''; }
  }

  /** 总览：左列四节（属性 / 本命 / 战法心得 / 兵装），右边挂轴立绘。 */
  private deskOverview(x: number, y: number, w: number, bottom: number): void {
    const c = this.playable, a = heroAttrs(this.hero), cap = attributeCap(heroInfo(this.hero).level), prim = primaryAttribute(this.hero);
    const sw = 214, lw = c ? w - sw - 18 : w;
    let yy = this.section(x, y + 10, lw, '属性', `未分配 ${heroFreePoints(this.hero)} 点 · 单项上限 ${cap}`);
    (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).forEach((id, i) => {
      const ry = yy + 4 + i * 22, isP = prim === id;
      if (this.scene.textures.exists(attributeIcon(id))) this.add(this.scene.add.image(x + 12, ry + 6, attributeIcon(id)).setDisplaySize(18, 18));
      this.text(x + 26, ry + 6, ATTRIBUTE_INFO[id].name + (isP ? '（主）' : ''), 13, isP ? '#ffd27a' : '#efe0bb', isP).setOrigin(0, .5);
      this.pips(x + 96, ry + 2, a[id], cap, lw - 150, isP);
      this.text(x + lw - 4, ry + 6, `${a[id]}`, 13, isP ? '#ffd27a' : '#e5d4ab').setOrigin(1, .5);
    });
    // 旧版一行文字（测试按名字读）
    this.text(-999, -999, `属性：${(Object.keys(ATTRIBUTE_INFO) as AttributeId[]).map(id => `${ATTRIBUTE_INFO[id].name}${prim === id ? '（主）' : ''} ${a[id]}`).join('　')}　· 未分配 ${heroFreePoints(this.hero)} 点`, 10).setVisible(false).setName('codex-attrline');
    yy += 4 + 4 * 22 + 8;
    if (!c) { yy = this.section(x, yy + 6, lw, '随行'); this.text(x + 8, yy + 2, '招募武将：随行时按等级成长（每级生命、伤害提高），将阶请到讲武堂「随行操练」提升。', 13, '#bfae8a').setWordWrapWidth(lw - 16); return; }
    const weapon = WEAPON_DEFS[CHARACTERS.find(h => h.id === c)!.startWeapon], lv = temperLevel(c);
    yy = this.section(x, yy + 6, lw, '本命', `淬炼 ${lv} / ${TEMPER.max}`);
    this.text(x + 8, yy + 8, weapon?.name ?? '', 15, '#f2ddae', true).setOrigin(0, .5);
    this.pips(x + 130, yy + 4, lv, TEMPER.max, 120);
    this.text(x + 262, yy + 8, `本命伤害 +${Math.round(lv * TEMPER.step * 100)}%`, 12.5, '#e8d6a4').setOrigin(0, .5);
    yy += 24;
    const xd = getXinde(c);
    yy = this.section(x, yy + 6, lw, '战法心得', `${xd.length} / ${XINDE_SLOTS}`);
    if (xd.length) { let cx = x + 8; xd.forEach(t => { const tt = this.text(cx + 10, yy + 8, TACTICS[t].name, 13, '#fff3d0', true).setOrigin(0, .5), g = this.add(this.scene.add.graphics()); g.fillStyle(0x7a2a1c, .95).fillRoundedRect(cx, yy - 2, tt.width + 20, 20, 4).lineStyle(1, 0xf3d48a, .9).strokeRoundedRect(cx + .5, yy - 1.5, tt.width + 19, 19, 4); this.body.bringToTop(tt); cx += tt.width + 28; }); }
    else this.text(x + 8, yy + 8, '未选（到「战法心得」页预选 2 个）', 13, '#a8977a').setOrigin(0, .5);
    yy += 24;
    const gear = gearSummary(gearFor(c));
    yy = this.section(x, yy + 6, lw, '兵装加成');
    this.text(x + 8, yy + 2, gear.length ? gear.join('　') : '尚未穿戴兵装', 13, '#d8ccb0').setWordWrapWidth(lw - 16).setLineSpacing(4).setMaxLines(Math.max(1, Math.floor((bottom - yy) / 21)));
    this.deskPortrait(c, x + w - sw, y + 2, sw, bottom - y - 2);
  }

  /** 挂轴立绘：手绘卷轴框，人物画在画心上（缺图时按需加载）。 */
  private deskPortrait(c: CharacterId, x: number, y: number, w: number, h: number): void {
    const art = 'epic_hero_' + c;
    if (!this.scene.textures.exists(art)) { this.scene.load.image(art, 'assets/epic-home/' + c + '.webp'); this.scene.load.once('filecomplete-image-' + art, () => { if (this.root.active && this.tab === 'overview') this.render(); }); this.scene.load.start(); }
    const fw = Math.min(w, h * 595 / 881), fh = fw * 881 / 595, fx = x + (w - fw) / 2, fy = y + (h - fh) / 2;
    if (this.has('scroll')) this.add(this.scene.add.image(fx, fy, 'codex_scroll').setOrigin(0).setDisplaySize(fw, fh).setName('codex-scroll'));
    // 画心：卷轴图里约 x 10%–90%、y 16%–84%
    const ix = fx + fw * .1, iy = fy + fh * .155, iw = fw * .8, ih = fh * .69;
    if (!this.scene.textures.exists(art)) return;
    // 整幅放进画心（不用遮罩：局内镜头有滚动，几何遮罩会错位）
    const img = this.add(this.scene.add.image(ix + iw / 2, iy + ih - 2, art).setOrigin(.5, 1)), src = img.texture.getSourceImage() as { width: number; height: number };
    img.setScale(Math.min((iw - 6) / src.width, (ih - 6) / src.height)).setName('codex-portrait');
  }

  /** 属性页：每项一张漆卡（图标 · 名字 · 效果 · 点数刻度 · +），主属性另起一行列专精三档。 */
  private deskAttrs(x: number, y: number, w: number, bottom: number): void {
    const a = heroAttrs(this.hero), free = heroFreePoints(this.hero), cost = respecCost(this.hero), spent = Object.values(a).reduce((n, v) => n + v, 0), cap = attributeCap(heroInfo(this.hero).level);
    const head = this.text(x + 4, y + 8, `未分配属性点 ${free}　（Lv25 前每级 1 点、之后每 2–3 级 1 点，单项最多 ${cap} 点）`, 14, free ? '#f3d48a' : '#b9a57a').setOrigin(0, .5).setName('codex-free');
    const head0 = head.text, ids = Object.keys(ATTRIBUTE_INFO) as AttributeId[], cardH = Math.min(66, Math.floor((bottom - y - 70) / ids.length));
    ids.forEach((id, i) => {
      const ry = y + 24 + i * cardH, primary = primaryAttribute(this.hero) === id, h = cardH - 6, g = this.add(this.scene.add.graphics());
      g.fillStyle(primary ? 0x2e1d10 : 0x18120c, .92).fillRoundedRect(x, ry, w, h, 5).lineStyle(primary ? 1.5 : 1, primary ? 0xf3d48a : 0x5e4a2c, primary ? .95 : .8).strokeRoundedRect(x + .5, ry + .5, w - 1, h - 1, 5);
      if (this.scene.textures.exists(attributeIcon(id))) this.add(this.scene.add.image(x + 26, ry + h / 2, attributeIcon(id)).setDisplaySize(32, 32));
      if (primary) { const b = attrBadge(this.scene, x + 26, ry + h / 2, this.hero, 32); if (b) this.add(b.setName('attr-badge-row')); }
      this.text(x + 52, ry + 8, ATTRIBUTE_INFO[id].name, 17, primary ? '#ffd27a' : '#f0dfb4', true).setName('codex-attr-name-' + id);
      if (primary) this.text(x + 96, ry + 11, '主属性', 11, '#1b120b').setBackgroundColor('#e0b860').setPadding(4, 1);
      const effW = w - 52 - (primary ? 296 : 250);
      this.text(x + 52, ry + 32, ATTRIBUTE_INFO[id].effect + (primary ? `；主属性每点 ×${PRIMARY_MUL}，另 +1% 全伤害` : ''), 12, primary ? '#e8d6a4' : '#a9b9a3').setWordWrapWidth(effW).setMaxLines(2);
      if (primary) { // 专精三档：满 4 / 7 / 10 点，实心菱 = 已解锁；悬停在顶行显示说明
        const perks = PRIMARY_PERK_INFO[id], px0 = x + w - 236;
        perks.forEach((p, k) => {
          const got = a[id] >= PRIMARY_TIERS[k], px = px0 + k * 72, pg = this.add(this.scene.add.graphics());
          pg.fillStyle(got ? 0xf3d48a : 0x2b2117, 1); lqDiamond(pg, px + 6, ry + h - 13, 5);
          const t = this.text(px + 15, ry + h - 13, p.name, 11.5, got ? '#ffd27a' : '#8d7d60').setOrigin(0, .5).setInteractive();
          t.on('pointerover', () => head.setText(`满 ${PRIMARY_TIERS[k]} 点「${p.name}」${p.desc}`).setWordWrapWidth(w)).on('pointerout', () => head.setText(head0));
        });
        this.text(x + w - 236 - 6, ry + h - 13, '专精', 11, '#c8a46a').setOrigin(1, .5).setName('codex-perks').setData('line', perks.map((p, k) => (a[id] >= PRIMARY_TIERS[k] ? '◆' : '◇') + p.name).join(' '));
      }
      this.pips(x + w - 236, ry + 12, a[id], cap, 140, primary);
      this.text(x + w - 64, ry + 16, `${a[id]} / ${cap}`, 13, '#e5d4ab').setOrigin(1, .5).setName('codex-attr-' + id);
      this.button(x + w - 28, ry + h / 2, '+', 'codex-add-' + id, () => this.act(allocateHeroAttr(this.hero, id) ? { ok: true, message: `${ATTRIBUTE_INFO[id].name} +1` } : { ok: false, message: '没有可分配的点，或这一项已满' }), { disabled: free <= 0 || a[id] >= cap, size: 18 });
    });
    const by = y + 24 + ids.length * cardH + 18;
    this.button(x + 96, by, cost ? `洗点 · 军粮 ${cost}` : '洗点 · 本章首次免费', 'codex-respec', () => this.act(respec(this.hero)), { disabled: spent === 0, size: 14, ink: true });
    this.text(x + 200, by, '洗点：已加的属性点全部退回，等级不变。', 12, '#9c8c6c').setOrigin(0, .5);
  }

  /** 本命页：武器名 + 淬炼五格 + 每级效果 + 淬炼（本页唯一水墨主按钮）。 */
  private deskWeapon(x: number, y: number, w: number, _bottom: number): void {
    const c = this.playable;
    if (!c) { this.section(x, y + 10, w, '本命'); this.text(x + 8, y + 34, '招募武将没有本命淬炼。', 14, '#9c8c6c'); return; }
    const weapon = WEAPON_DEFS[CHARACTERS.find(h => h.id === c)!.startWeapon], lv = temperLevel(c), cost = temperCost(c);
    let yy = this.section(x, y + 10, w, '本命兵刃', `淬炼 ${lv} / ${TEMPER.max}`);
    this.text(x + 8, yy + 14, weapon?.name ?? '本命武器', 24, '#f6dc9a', true).setOrigin(0, .5);
    this.text(x + 8, yy + 46, `淬炼 ${lv} / ${TEMPER.max}　· 本命伤害 +${Math.round(lv * TEMPER.step * 100)}%（每级 +${Math.round(TEMPER.step * 100)}%）`, 14, '#e8d6a4').setOrigin(0, .5).setName('codex-temper');
    yy += 66;
    // 五级刻度：每格写等级和累计加成
    const cw = Math.min(110, (w - 16 - 4 * 10) / TEMPER.max), g = this.add(this.scene.add.graphics());
    for (let i = 0; i < TEMPER.max; i++) {
      const px = x + 8 + i * (cw + 10), got = i < lv, next = i === lv;
      g.fillStyle(got ? 0x7a2a1c : 0x18120c, .95).fillRoundedRect(px, yy, cw, 46, 5).lineStyle(got || next ? 1.5 : 1, got ? 0xf3d48a : next ? 0xc9a35e : 0x5e4a2c, 1).strokeRoundedRect(px + .5, yy + .5, cw - 1, 45, 5);
      this.text(px + cw / 2, yy + 14, `${i + 1} 级`, 13, got ? '#fff3d0' : next ? '#ecd49a' : '#8d7d60', true).setOrigin(.5);
      this.text(px + cw / 2, yy + 33, `+${Math.round((i + 1) * TEMPER.step * 100)}% · ${TEMPER.cost[i]} 粮`, 11, got ? '#ffe2a0' : '#9c8c6c').setOrigin(.5);
    }
    yy += 78;
    this.button(x + 100, yy, cost === null ? '已满级' : `淬炼 · 军粮 ${cost}`, 'codex-temper-up', () => this.act(temperUp(c)), { disabled: cost === null, size: 15, ink: true });
    this.text(x + 210, yy, `现有军粮 ${grain()}`, 12.5, '#c8b88f').setOrigin(0, .5);
    this.text(x + 8, yy + 34, '淬炼满 5 级后，局内本命武器将开放第 6 级「突破」（第三批上线）。', 12, '#9c8c6c').setWordWrapWidth(w - 16);
  }

  /**
   * 流派亲和（2026-11-19 流派重做第 4 期「武将谱亲和页」）：左 = 本将亲和哪几派、给什么，再列六派各档（徽印 + 2 / 4 / 6 势）；
   * 右 = 势从哪来、十二将各自亲和（当前武将高亮）。电脑布局优先；手机布局只列本将与六派。
   */
  private renderSchools(x: number, y: number, w: number, bottom: number): void {
    const c = this.playable, aff = c ? heroAffinity(c) : [], D = IS_DESKTOP;
    const lw = D ? Math.floor(w * .66) : w, rx = x + lw + 18, rw = w - lw - 18;
    this.text(x, y, c ? ownerName(this.hero) + ' 亲和：' + (aff.map(s => SCHOOLS[s].name).join(' · ') || '无') : '招募武将没有流派亲和（随行时按兵种给势）。', 16, '#f3d48a', true).setName('codex-schools-affinity');
    if (c && aff.length) this.text(x, y + 24, '第一亲和派「' + SCHOOLS[aff[0]].name + '」开局 +' + SHI_SOURCES.affinityStart + ' 势；亲和派战法出现率 ×' + OFFER.affinityWeight + '（只是偏向）。', 12, '#c8b88f').setWordWrapWidth(lw);
    const top = y + 46, rowH = Math.min(D ? 70 : 72, Math.floor((bottom - top) / 6));
    const sub = this.body.list[this.body.list.length - 1] as Phaser.GameObjects.Text | undefined, sub0 = c && aff.length ? sub?.text ?? '' : ''; // 悬停某派时把它的说明写在这行
    SCHOOL_IDS.forEach((s, i) => {
      const d = SCHOOLS[s], ry = top + i * rowH, mine = aff.includes(s), g = this.add(this.scene.add.graphics());
      g.fillStyle(mine ? 0x3a2414 : 0x1a140d, mine ? .95 : .8).fillRoundedRect(x, ry, lw, rowH - 6, 4).lineStyle(1, mine ? 0xf3d48a : 0x5e4a2c, mine ? 1 : .8).strokeRoundedRect(x + .5, ry + .5, lw - 1, rowH - 7, 4);
      const key = 'build_icon_school_' + s;
      if (this.scene.textures.exists(key)) { const im = this.add(this.scene.add.image(x + 26, ry + (rowH - 6) / 2, key)); im.setScale(42 / Math.max(im.width, im.height)); }
      this.text(x + 54, ry + 7, d.name + (mine && !D ? ' · 亲和' : ''), 15, mine ? '#ffd98a' : d.css, true).setName('codex-school-' + s);
      if (D) { const hit = this.add(this.scene.add.rectangle(x, ry, 100, rowH - 6, 0, .001).setOrigin(0)).setInteractive(); if (sub && sub0) hit.on('pointerover', () => sub.setText(d.name + '：' + d.fantasy)).on('pointerout', () => sub.setText(sub0)); this.text(x + 54, ry + 28, mine ? '本将亲和' : '悬停看说明', 10.5, mine ? '#ffd98a' : '#7d6e55'); }
      else this.text(x + 54, ry + 27, d.fantasy, 10.5, '#9c8c6c').setWordWrapWidth(78).setMaxLines(2);
      const tx = D ? x + 116 : x + 138, tw = (lw - (D ? 120 : 144)) / 3;
      TIER_STEPS.forEach((t, k) => {
        const tier = d.tiers[t];
        this.text(tx + k * tw, ry + 6, t + ' 势 · ' + tier.name, 12, k === 2 ? '#ffd27a' : '#e8d6a4', true);
        const dt = this.text(tx + k * tw, ry + 20, tier.desc.replace(/^觉醒：/, ''), D ? 10 : 10.5, '#bfae8a').setWordWrapWidth(tw - 8).setLineSpacing(-1).setMaxLines(D ? 2 : 3);
        // 电脑版每档只显示两行，悬停这一档时把全文写在顶上说明行
        if (D && sub && sub0) this.add(this.scene.add.rectangle(tx + k * tw, ry, tw - 4, rowH - 6, 0, .001).setOrigin(0)).setInteractive().on('pointerover', () => { sub.setText(`${d.name} ${t} 势「${tier.name}」：${tier.desc.replace(/^觉醒：/, '')}`); dt.setColor('#f0e2c8'); }).on('pointerout', () => { sub.setText(sub0); dt.setColor('#bfae8a'); });
      });
    });
    if (!D) return;
    const src = ['· 学 / 升本派战法：每级 +1', '· 武将亲和：第一亲和派开局 +' + SHI_SOURCES.affinityStart, '· 随行：按兵种给（刀兵→猛将、枪兵→兵阵、弓兵→弓弩、谋士→奇谋），最多 +' + SHI_SOURCES.followerCap, '· 橙色名马：骑突 +' + SHI_SOURCES.orangeMount, '· 机制类信物：对应派 +1', '· 军需商人「流派心法」：每派一次 +1', '两派都到 ' + COMBO_AT + ' 势生效合击。'];
    this.text(rx, y, '势从哪来', 15, '#f3d48a', true);
    const st = this.text(rx, y + 24, src.join('\n'), 11, '#d8ccb0').setLineSpacing(0).setWordWrapWidth(rw).setName('codex-schools-sources');
    // 诸将亲和：一行一将；第一亲和派（开局 +1 势）带 ★、字亮
    const ty = y + 30 + st.height + 10; this.text(rx, ty, '诸将亲和', 15, '#f3d48a', true); this.text(rx + rw, ty + 3, '★ = 开局 +1 势', 11, '#9c8c6c').setOrigin(1, 0);
    const lineH = Math.max(13, Math.min(24, Math.floor((bottom - ty - 24) / CHARACTERS.length)));
    CHARACTERS.forEach((ch, i) => {
      const ay = ty + 26 + i * lineH, on = ch.id === this.hero, a = heroAffinity(ch.id);
      if (on) this.add(this.scene.add.graphics()).fillStyle(0x7a2a1c, .6).fillRoundedRect(rx - 4, ay - 2, rw + 4, lineH - 1, 3);
      this.text(rx, ay, ch.name, 13, on ? '#fff3d0' : '#e8d6a4', on).setName('codex-aff-' + ch.id);
      a.forEach((s, k) => {
        const key = 'build_icon_school_' + s, ax = rx + 60 + k * 96;
        if (this.scene.textures.exists(key)) { const im = this.add(this.scene.add.image(ax + 8, ay + 8, key)); im.setScale(16 / Math.max(im.width, im.height)); }
        this.text(ax + 20, ay + 1, SCHOOLS[s].name + (k === 0 ? ' ★' : ''), 12, k === 0 ? SCHOOLS[s].css : '#a8977a');
      });
    });
  }

  private renderOverview(x: number, y: number, w: number): void {
    const info = heroInfo(this.hero), name = ownerName(this.hero), c = this.playable;
    this.text(x, y, name, 24, '#f2ddae', true).setName('codex-name');
    { const nm = this.body.getByName('codex-name') as Phaser.GameObjects.Text | null, b = attrBadge(this.scene, x + (nm?.width ?? 60) + 22, y + 15, this.hero, 26); if (b) this.add(b); }
    this.text(x, y + 36, `等级 Lv.${info.level}（本章上限 Lv.${info.cap}）· 经验 ${info.xp} / ${info.next}${info.level >= info.cap ? '（已到上限，经验暂存）' : ''}`, 14, '#d8ccb0').setName('codex-level');
    const a = heroAttrs(this.hero), attrs = (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).map(id => `${ATTRIBUTE_INFO[id].name}${primaryAttribute(this.hero) === id ? '（主）' : ''} ${a[id]}`).join('　');
    this.text(x, y + 64, `属性：${attrs}　· 未分配 ${heroFreePoints(this.hero)} 点`, 14, '#d8ccb0').setWordWrapWidth(w);
    if (!c) { this.text(x, y + 100, '招募武将：随行时按等级成长（每级生命、伤害提高），将阶请到讲武堂「随行操练」提升。', 13, '#9c8c6c').setWordWrapWidth(w); return; }
    const weapon = WEAPON_DEFS[CHARACTERS.find(h => h.id === c)!.startWeapon];
    this.text(x, y + 100, `本命：${weapon?.name ?? ''} · 淬炼 ${temperLevel(c)}/${TEMPER.max}（本命伤害 +${Math.round(temperLevel(c) * TEMPER.step * 100)}%）`, 14, '#e8d6a4');
    const xd = getXinde(c);
    this.text(x, y + 128, `战法心得：${xd.length ? xd.map(t => TACTICS[t].name).join('、') : '未选（到「战法心得」页预选 2 个）'}`, 14, '#e8d6a4');
    // 2026-11-17 UI 审查 F：电脑版总览右侧放武将立绘（主页同款手绘），填满原来空着的下半屏；缺图时按需加载
    const art = IS_DESKTOP ? 'epic_hero_' + c : '', pw = 250, hasArt = IS_DESKTOP && this.scene.textures.exists(art);
    if (IS_DESKTOP && !hasArt && !this.scene.textures.exists(art)) { this.scene.load.image(art, 'assets/epic-home/' + c + '.webp'); this.scene.load.once('filecomplete-image-' + art, () => { if (this.root.active && this.tab === 'overview') this.render(); }); this.scene.load.start(); }
    if (hasArt) { const img = this.add(this.scene.add.image(x + w - pw / 2, GAME_HEIGHT - 52, art).setOrigin(.5, 1)), src = img.texture.getSourceImage() as { width: number; height: number }; img.setScale(Math.min(pw / src.width, (GAME_HEIGHT - 52 - y) / src.height)).setName('codex-portrait'); }
    const tw = hasArt ? w - pw - 16 : w;
    const gear = gearSummary(gearFor(c));
    this.text(x, y + 160, '兵装加成', 15, '#ecd49a', true);
    this.text(x, y + 184, gear.length ? gear.join('　') : '尚未穿戴兵装', 13, '#d8ccb0').setWordWrapWidth(tw).setLineSpacing(4);
  }

  private renderAttrs(x: number, y: number, w: number): void {
    const a = heroAttrs(this.hero), free = heroFreePoints(this.hero), cost = respecCost(this.hero), spent = Object.values(a).reduce((n, v) => n + v, 0);
    const head = this.text(x, y, `未分配属性点 ${free}　（Lv25 前每级 1 点、之后每 2–3 级 1 点，单项最多 ${attributeCap(heroInfo(this.hero).level)} 点）`, 14, free ? '#f3d48a' : '#b9a57a').setName('codex-free');
    (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).forEach((id, i) => {
      const ry = y + 40 + i * 44;
      if (this.scene.textures.exists(attributeIcon(id))) this.add(this.scene.add.image(x + 16, ry + 12, attributeIcon(id)).setDisplaySize(28, 28));
      const primary = primaryAttribute(this.hero) === id;
      this.text(x + 40, ry, ATTRIBUTE_INFO[id].name + (primary ? ' · 主属性' : ''), 16, primary ? '#ffd27a' : '#f0dfb4').setName('codex-attr-name-' + id);
      if (primary) { const b = attrBadge(this.scene, x + 16, ry + 12, this.hero, 30); if (b) this.add(b.setName('attr-badge-row')); }
      this.text(x + (primary ? 150 : 100), ry + 3, ATTRIBUTE_INFO[id].effect + (primary ? '；主属性每点 ×' + PRIMARY_MUL + '，另 +1% 全伤害' : ''), 12, primary ? '#e8d6a4' : '#a9b9a3');
      if (primary) { // 主属性专精：满 4 / 7 / 10 点各一档（◆ 已解锁 / ◇ 未解锁），悬停看说明
        const perks = PRIMARY_PERK_INFO[id], line = '专精　' + perks.map((p, k) => (a[id] >= PRIMARY_TIERS[k] ? '◆' : '◇') + p.name).join('　');
        const t = this.text(x + 150, ry + 20, line, 12, '#ffd27a').setName('codex-perks').setInteractive();
        const head0 = head.text; // 悬停时把说明写在顶上那行，不压住下面的属性行
        t.on('pointerover', () => head.setText(perks.map((p, k) => '满 ' + PRIMARY_TIERS[k] + ' 点「' + p.name + '」' + p.desc).join('；')).setWordWrapWidth(w)); t.on('pointerout', () => head.setText(head0));
      }
      this.text(x + w - 110, ry + 2, `${a[id]} / ${attributeCap(heroInfo(this.hero).level)}`, 14, '#e5d4ab').setOrigin(1, 0).setName('codex-attr-' + id);
      this.button(x + w - 50, ry + 12, '+', 'codex-add-' + id, () => this.act(allocateHeroAttr(this.hero, id) ? { ok: true, message: `${ATTRIBUTE_INFO[id].name} +1` } : { ok: false, message: '没有可分配的点，或这一项已满' }), { disabled: free <= 0 || a[id] >= attributeCap(heroInfo(this.hero).level), size: 18 });
    });
    const by = y + 40 + Object.keys(ATTRIBUTE_INFO).length * 44 + 10;
    this.button(x + 110, by, cost ? `洗点 · 军粮 ${cost}` : '洗点 · 本章首次免费', 'codex-respec', () => this.act(respec(this.hero)), { disabled: spent === 0, size: 14 });
    this.text(x + 230, by - 8, '洗点：已加的属性点全部退回，等级不变。', 12, '#9c8c6c');
  }

  private renderWeapon(x: number, y: number, w: number): void {
    const c = this.playable;
    if (!c) { this.text(x, y, '招募武将没有本命淬炼。', 14, '#9c8c6c'); return; }
    const weapon = WEAPON_DEFS[CHARACTERS.find(h => h.id === c)!.startWeapon], lv = temperLevel(c), cost = temperCost(c);
    this.text(x, y, weapon?.name ?? '本命武器', 22, '#f2ddae', true);
    this.text(x, y + 34, `淬炼 ${lv} / ${TEMPER.max}　· 本命伤害 +${Math.round(lv * TEMPER.step * 100)}%（每级 +${Math.round(TEMPER.step * 100)}%）`, 15, '#e8d6a4').setName('codex-temper');
    const g = this.add(this.scene.add.graphics());
    for (let i = 0; i < TEMPER.max; i++) g.fillStyle(i < lv ? 0xe2bd6a : 0x2a3328, 1).fillRect(x + i * 34, y + 66, 28, 12).lineStyle(1, 0x8a7550, .9).strokeRect(x + i * 34 + .5, y + 66.5, 27, 11);
    this.button(x + 100, y + 112, cost === null ? '已满级' : `淬炼 · 军粮 ${cost}`, 'codex-temper-up', () => this.act(temperUp(c)), { disabled: cost === null, size: 15 });
    this.text(x, y + 150, '淬炼满 5 级后，局内本命武器将开放第 6 级「突破」（第三批上线）。', 12, '#9c8c6c').setWordWrapWidth(w);
  }

  /**
   * 战法心得 · 电脑布局（2026-11-17 用户「这里ui很乱」）：每个分类一行（8 行占满面板高度），分类名在左列，
   * 战法卡统一宽度（放得下最长的「破阵重击」+ 锁 + 残卷价）、统一字号；三种状态一眼可分：
   * 已选心得 = 朱红底 + 金边 + ✓；已解锁 = 漆底金边；未解锁 = 暗底灰边 + 锁 + 「6 残卷」。
   * 悬停描边变亮，底部说明栏显示战法效果与当前状态。解锁 / 选心得的逻辑不动（同 renderXinde）。
   */
  private renderXindeDesk(x: number, y: number, w: number, bottom: number): void {
    const c = this.playable;
    if (!c) { this.text(x, y, '招募武将的随行心得由招贤馆管理。', 14, '#9c8c6c'); return; }
    const xd = getXinde(c), all = (Object.keys(TACTICS) as TacticId[]).filter(t => TACTICS[t].tag); // 流派重做：基础成长（卸力 / 以战养战）、反震不在流派里，不进心得表
    this.text(x, y, `心得 ${xd.length} / ${XINDE_SLOTS}：${xd.map(t => TACTICS[t].name).join('、') || '未选'}　· 局内出现概率 ×2，开局第一次升级必出一张`, 13, '#f3d48a').setWordWrapWidth(w).setName('codex-xinde');
    this.text(x, y + 22, `点已解锁的战法选为 / 取消心得；未解锁的花 ${TACTIC_UNLOCK_SCROLLS} 武学残卷解锁（局内照样会出，只是不能选为心得）。`, 12, '#9c8c6c').setWordWrapWidth(w);
    { const aff = heroAffinity(c); if (aff.length) this.text(x + w, y, `亲和流派：${aff.map(s => SCHOOLS[s].name).join(' · ')}（开局 +1 势，出现率 ×1.5）`, 12, '#c8a46a').setOrigin(1, 0).setName('codex-affinity'); }
    const tags = [...new Set(all.map(t => TACTICS[t].tag))] as BuildTag[];
    const labelW = 64, gap = 8, cols = Math.max(...tags.map(tag => all.filter(t => TACTICS[t].tag === tag).length));
    const tileW = Math.floor((w - labelW - (cols - 1) * gap) / cols), tileH = 30, descH = 46;
    const top = y + 48, rowH = Math.min(40, Math.floor((bottom - descH - 10 - top) / tags.length));
    // 底部说明栏：悬停战法时显示效果
    const dy = top + rowH * tags.length + 6, descG = this.add(this.scene.add.graphics());
    descG.fillStyle(0x0d0a07, .7).fillRoundedRect(x, dy, w, descH, 4).lineStyle(1, 0x7d6640, .7).strokeRoundedRect(x + .5, dy + .5, w - 1, descH - 1, 4);
    // 刚解锁 / 选择后的结果（如「残卷不足」）先显示在说明栏里，悬停别的战法时换成说明
    const hint = '把鼠标移到战法上查看效果。', first = this.notice; this.notice = '';
    const desc = this.text(x + 12, dy + 7, first || hint, 13, first ? '#f3d48a' : '#bfae8a').setWordWrapWidth(w - 24).setLineSpacing(2).setName('codex-tactic-desc');
    tags.forEach((tag, ti) => {
      const gy = top + ti * rowH, list = all.filter(t => TACTICS[t].tag === tag), got = list.filter(t => tacticUnlocked(t)).length;
      this.text(x, gy + tileH / 2, TAG_NAMES[tag], 15, '#ecd49a', true).setOrigin(0, .5);
      this.text(x + labelW - 10, gy + tileH / 2, `${got}/${list.length}`, 11, '#8d7d60').setOrigin(1, .5);
      list.forEach((t, k) => {
        const unlocked = tacticUnlocked(t), on = xd.includes(t), tx = x + labelW + k * (tileW + gap);
        const g = this.add(this.scene.add.graphics());
        const paint = (hover: boolean): void => {
          g.clear();
          const fill = on ? 0x7a2a1c : unlocked ? 0x2a2116 : 0x15110c, edge = on ? 0xf3d48a : unlocked ? (hover ? 0xf3d48a : 0xb09056) : (hover ? 0x9c8a66 : 0x4f4434);
          g.fillStyle(fill, on || unlocked ? .96 : .9).fillRoundedRect(tx, gy, tileW, tileH, 4).lineStyle(on || hover ? 2 : 1, edge, 1).strokeRoundedRect(tx + .5, gy + .5, tileW - 1, tileH - 1, 4);
          if (on) g.fillStyle(0xffe2a0, .12).fillRoundedRect(tx + 2, gy + 2, tileW - 4, tileH * .45, { tl: 3, tr: 3, bl: 0, br: 0 });
          if (!unlocked) { // 锁：锁身 + 锁梁
            const lx = tx + 14, ly = gy + tileH / 2 + 1;
            g.fillStyle(0x8d7d60, 1).fillRoundedRect(lx - 5, ly - 2, 10, 8, 1.5).lineStyle(1.6, 0x8d7d60, 1).beginPath().arc(lx, ly - 2, 3.4, Math.PI, 0).strokePath();
          }
        };
        paint(false);
        const label = this.text(unlocked ? tx + tileW / 2 : tx + 26, gy + tileH / 2, (on ? '✓ ' : '') + TACTICS[t].name, 14, on ? '#fff3d0' : unlocked ? '#f0e2c8' : '#8d7d60').setOrigin(unlocked ? .5 : 0, .5);
        if (!unlocked) this.text(tx + tileW - 10, gy + tileH / 2, `${TACTIC_UNLOCK_SCROLLS} 残卷`, 12, scrolls() >= TACTIC_UNLOCK_SCROLLS ? '#e0bf78' : '#8a5a4a').setOrigin(1, .5);
        const state = on ? '已选为心得 · 再点一下取消' : unlocked ? (xd.length >= XINDE_SLOTS ? '已解锁 · 心得已满，先取消一个' : '已解锁 · 点击选为心得') : `未解锁 · 花 ${TACTIC_UNLOCK_SCROLLS} 武学残卷解锁（现有 ${scrolls()}）`;
        const hit = this.add(this.scene.add.rectangle(tx, gy, tileW, tileH, 0, .001).setOrigin(0)).setName('codex-tactic-' + t).setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => { paint(true); desc.setText(`${TACTICS[t].name}（${TAG_NAMES[tag]}）：${TACTICS[t].desc}\n${state}`).setColor('#e9dcbc'); })
          .on('pointerout', () => { paint(false); desc.setText(hint).setColor('#bfae8a'); })
          .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); this.act(unlocked ? toggleXinde(c, t) : unlockTactic(t)); });
        void label;
      });
    });
  }

  private renderXinde(x: number, y: number, w: number, bottom: number): void {
    const c = this.playable;
    if (!c) { this.text(x, y, '招募武将的随行心得由招贤馆管理。', 14, '#9c8c6c'); return; }
    const xd = getXinde(c);
    this.text(x, y, `心得 ${xd.length} / ${XINDE_SLOTS}：${xd.map(t => TACTICS[t].name).join('、') || '未选'}　· 局内出现概率 ×2，开局第一次升级必出一张`, 13, '#f3d48a').setWordWrapWidth(w).setName('codex-xinde');
    this.text(x, y + 22, `点已解锁的战法选为心得；未解锁的花 ${TACTIC_UNLOCK_SCROLLS} 武学残卷解锁（局内照样会出，只是不能选为心得）。`, 12, '#9c8c6c').setWordWrapWidth(w);
    const tags = [...new Set((Object.keys(TACTICS) as TacticId[]).map(t => TACTICS[t].tag).filter(Boolean))] as BuildTag[];
    const colW = w / 2, step = (colW - 64) / 3, rowH = Math.min(46, (bottom - y - 60) / Math.ceil(tags.length / 2));
    tags.forEach((tag, ti) => {
      const col = ti % 2, gx = x + col * colW, gy = y + 60 + Math.floor(ti / 2) * rowH;
      this.text(gx, gy + 2, TAG_NAMES[tag], 14, '#ecd49a', true);
      (Object.keys(TACTICS) as TacticId[]).filter(t => TACTICS[t].tag === tag).forEach((t, k) => {
        const unlocked = tacticUnlocked(t), on = xd.includes(t), bx = gx + 52 + k * step + step / 2;
        this.button(bx, gy + 10, unlocked ? TACTICS[t].name : `${TACTICS[t].name} · 解锁`, 'codex-tactic-' + t, () => this.act(unlocked ? toggleXinde(c, t) : unlockTactic(t)), { active: on, w: step - 30, size: 12 });
      });
    });
  }
}
