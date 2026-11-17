import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { TACTICS, TAG_NAMES, type BuildTag, type TacticId } from '../data/builds';
import { WEAPON_DEFS } from '../weapons/registry';
import { ATTRIBUTE_INFO, ATTRIBUTE_MAX, attributeIcon, type AttributeId } from '../systems/RunGrowth';
import { allocateHeroAttr, heroAttrs, heroFreePoints, heroInfo, type HeroKey } from '../systems/HeroProgress';
import { gearFor, gearSummary } from '../systems/ItemEffects';
import { gearOwners, ownerName } from '../systems/RosterStore';
import { TACTIC_UNLOCK_SCROLLS, TEMPER, XINDE_SLOTS, getXinde, grain, respec, respecCost, scrolls, tacticUnlocked, temperCost, temperLevel, temperUp, toggleXinde, unlockTactic } from '../systems/MasteryStore';
import { lqHitBox, lqPanel, lqSkin } from './LacquerKit';

type Tab = 'overview' | 'attrs' | 'weapon' | 'xinde';
const TABS: [Tab, string][] = [['overview', '总览'], ['attrs', '属性'], ['weapon', '本命'], ['xinde', '战法心得']];

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

  constructor(private readonly scene: Phaser.Scene, hero?: HeroKey, private readonly onClose?: () => void) {
    const list = gearOwners();
    this.hero = (hero && list.some(o => o.id === hero) ? hero : list[0]?.id ?? 'zhaoyun') as HeroKey;
    this.root = scene.add.container(0, 0).setDepth(DEPTH.overlay + 20).setScrollFactor(0).setName('hero-codex').setData('ui', this);
    this.render();
  }
  close(): void { this.root.destroy(); this.onClose?.(); }

  private get playable(): CharacterId | null { return CHARACTERS.some(c => c.id === this.hero) ? this.hero as CharacterId : null; }
  private add<T extends Phaser.GameObjects.GameObject & { setScrollFactor: (x: number) => unknown }>(o: T): T { o.setScrollFactor(0); this.body.add(o); return o; }
  private text(x: number, y: number, v: string, size: number, color = '#e9dcbc', heading = false): Phaser.GameObjects.Text {
    return this.add(this.scene.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2 }));
  }
  private button(x: number, y: number, label: string, name: string, onClick: () => void, o: { size?: number; active?: boolean; disabled?: boolean; w?: number } = {}): Phaser.GameObjects.Text {
    const t = this.text(x, y, label, o.size ?? 14, o.disabled ? '#8d7d60' : '#ffe9bd').setOrigin(.5).setPadding(12, 7).setName(name);
    const bw = o.w ? o.w + 24 : Math.max(t.width, 44), bh = Math.max(30, t.height);
    if (t.width > bw - 6) t.setScale((bw - 6) / t.width);
    if (!o.disabled) t.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => { e?.stopPropagation?.(); onClick(); });
    lqHitBox(t, bw, bh);
    const skin = lqSkin(this.scene, t, t, () => ({ w: bw, h: bh }), { tone: o.active ? 'cinnabar' : 'quiet', on: () => !!o.active, enabled: () => !o.disabled });
    skin.gfx.setScrollFactor(0); this.body.addAt(skin.gfx, this.body.getIndex(t));
    return t;
  }
  private act(r: { ok: boolean; message: string }): void { this.notice = r.message; this.render(); }

  render(): void {
    this.body?.destroy();
    this.body = this.scene.add.container(0, 0).setScrollFactor(0); this.root.add(this.body);
    const W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    this.add(this.scene.add.rectangle(0, 0, W, H, 0x0b0805, .86).setOrigin(0).setInteractive()).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e?: Phaser.Types.Input.EventData) => e?.stopPropagation?.());
    const x0 = D ? 18 : 10, y0 = D ? 12 : 14, pw = W - x0 * 2, ph = H - y0 * 2;
    lqPanel(this.add(this.scene.add.graphics()), x0, y0, pw, ph);
    this.text(x0 + 28, y0 + (D ? 18 : 22), '武将谱', D ? 26 : 30, '#f2ddae', true);
    this.text(x0 + (D ? 130 : 140), y0 + (D ? 28 : 34), `武学残卷 ${scrolls()} · 军粮 ${grain()}`, 13, '#e8d6a4').setName('codex-resources');
    this.button(x0 + pw - (D ? 52 : 56), y0 + (D ? 32 : 40), '关闭', 'codex-close', () => this.close(), { size: D ? 15 : 17 });

    // 左：武将列表
    const owners = gearOwners(), lx = x0 + 24, lw = D ? 150 : pw - 48, top = y0 + (D ? 70 : 84);
    if (D) owners.forEach((o, i) => { const lv = heroInfo(o.id as HeroKey).level; this.button(lx + lw / 2, top + i * 38, `${o.name}  Lv.${lv}`, 'codex-hero-' + o.id, () => { this.hero = o.id as HeroKey; this.render(); }, { active: o.id === this.hero, w: lw - 24 }); });
    else { const per = 4, cw = (lw - 3 * 8) / per; owners.forEach((o, i) => this.button(lx + cw / 2 + (i % per) * (cw + 8), top + Math.floor(i / per) * 40, o.name, 'codex-hero-' + o.id, () => { this.hero = o.id as HeroKey; this.render(); }, { active: o.id === this.hero, w: cw - 24 })); }
    // 右：分页
    const rx = D ? x0 + 200 : x0 + 24, rw = D ? pw - 224 : pw - 48, ry = D ? top : top + Math.ceil(owners.length / 4) * 40 + 10;
    const tw = (rw - 3 * 8) / 4;
    TABS.forEach(([id, label], i) => this.button(rx + tw / 2 + i * (tw + 8), ry, label, 'codex-tab-' + id, () => { this.tab = id; this.render(); }, { active: this.tab === id, w: tw - 24, size: 15 }));
    const cy = ry + 34;
    if (this.tab === 'overview') this.renderOverview(rx, cy, rw);
    else if (this.tab === 'attrs') this.renderAttrs(rx, cy, rw);
    else if (this.tab === 'weapon') this.renderWeapon(rx, cy, rw);
    else this.renderXinde(rx, cy, rw, y0 + ph - 50);
    if (this.notice) { this.text(W / 2, y0 + ph - 24, this.notice, 14, '#f3d48a').setOrigin(.5).setBackgroundColor('#1b120bcc').setPadding(10, 4).setName('codex-notice'); this.notice = ''; }
  }

  private renderOverview(x: number, y: number, w: number): void {
    const info = heroInfo(this.hero), name = ownerName(this.hero), c = this.playable;
    this.text(x, y, name, 24, '#f2ddae', true).setName('codex-name');
    this.text(x, y + 36, `等级 Lv.${info.level}（本章上限 Lv.${info.cap}）· 经验 ${info.xp} / ${info.next}${info.level >= info.cap ? '（已到上限，经验暂存）' : ''}`, 14, '#d8ccb0').setName('codex-level');
    const a = heroAttrs(this.hero), attrs = (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).map(id => `${ATTRIBUTE_INFO[id].name} ${a[id]}`).join('　');
    this.text(x, y + 64, `属性：${attrs}　· 未分配 ${heroFreePoints(this.hero)} 点`, 14, '#d8ccb0').setWordWrapWidth(w);
    if (!c) { this.text(x, y + 100, '招募武将：随行时按等级成长（每级生命、伤害提高），将阶请到招贤馆提升。', 13, '#9c8c6c').setWordWrapWidth(w); return; }
    const weapon = WEAPON_DEFS[CHARACTERS.find(h => h.id === c)!.startWeapon];
    this.text(x, y + 100, `本命：${weapon?.name ?? ''} · 淬炼 ${temperLevel(c)}/${TEMPER.max}（本命伤害 +${Math.round(temperLevel(c) * TEMPER.step * 100)}%）`, 14, '#e8d6a4');
    const xd = getXinde(c);
    this.text(x, y + 128, `战法心得：${xd.length ? xd.map(t => TACTICS[t].name).join('、') : '未选（到「战法心得」页预选 2 个）'}`, 14, '#e8d6a4');
    const gear = gearSummary(gearFor(c));
    this.text(x, y + 160, '兵装加成', 15, '#ecd49a', true);
    this.text(x, y + 184, gear.length ? gear.join('　') : '尚未穿戴兵装', 13, '#d8ccb0').setWordWrapWidth(w).setLineSpacing(4);
  }

  private renderAttrs(x: number, y: number, w: number): void {
    const a = heroAttrs(this.hero), free = heroFreePoints(this.hero), cost = respecCost(this.hero), spent = Object.values(a).reduce((n, v) => n + v, 0);
    this.text(x, y, `未分配属性点 ${free}　（武将每升 1 级得 1 点，单项最多 ${ATTRIBUTE_MAX} 点）`, 14, free ? '#f3d48a' : '#b9a57a').setName('codex-free');
    (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).forEach((id, i) => {
      const ry = y + 40 + i * 44;
      if (this.scene.textures.exists(attributeIcon(id))) this.add(this.scene.add.image(x + 16, ry + 12, attributeIcon(id)).setDisplaySize(28, 28));
      this.text(x + 40, ry, ATTRIBUTE_INFO[id].name, 16, '#f0dfb4');
      this.text(x + 100, ry + 3, ATTRIBUTE_INFO[id].effect, 12, '#a9b9a3');
      this.text(x + w - 110, ry + 2, `${a[id]} / ${ATTRIBUTE_MAX}`, 14, '#e5d4ab').setOrigin(1, 0).setName('codex-attr-' + id);
      this.button(x + w - 50, ry + 12, '+', 'codex-add-' + id, () => this.act(allocateHeroAttr(this.hero, id) ? { ok: true, message: `${ATTRIBUTE_INFO[id].name} +1` } : { ok: false, message: '没有可分配的点，或这一项已满' }), { disabled: free <= 0 || a[id] >= ATTRIBUTE_MAX, size: 18 });
    });
    const by = y + 40 + 6 * 44 + 10;
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

  private renderXinde(x: number, y: number, w: number, bottom: number): void {
    const c = this.playable;
    if (!c) { this.text(x, y, '招募武将的随行心得由招贤馆管理。', 14, '#9c8c6c'); return; }
    const xd = getXinde(c);
    this.text(x, y, `心得 ${xd.length} / ${XINDE_SLOTS}：${xd.map(t => TACTICS[t].name).join('、') || '未选'}　· 局内出现概率 ×2，开局第一次升级必出一张`, 13, '#f3d48a').setWordWrapWidth(w).setName('codex-xinde');
    this.text(x, y + 22, `点已解锁的战法选为心得；未解锁的花 ${TACTIC_UNLOCK_SCROLLS} 武学残卷解锁（局内照样会出，只是不能选为心得）。`, 12, '#9c8c6c').setWordWrapWidth(w);
    const tags = [...new Set((Object.keys(TACTICS) as TacticId[]).map(t => TACTICS[t].tag))] as BuildTag[];
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
