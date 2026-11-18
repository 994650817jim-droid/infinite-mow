import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { TACTICS, TAG_NAMES, type BuildTag, type TacticId } from '../data/builds';
import { WEAPON_DEFS } from '../weapons/registry';
import { ATTRIBUTE_INFO, ATTRIBUTE_MAX, attributeIcon, type AttributeId } from '../systems/RunGrowth';
import { allocateHeroAttr, heroAttrs, heroFreePoints, heroInfo, takeAttrNotice, type HeroKey } from '../systems/HeroProgress';
import { primaryAttribute, PRIMARY_MUL, PRIMARY_PERK_INFO, PRIMARY_TIERS } from '../data/attributes';
import { gearFor, gearSummary } from '../systems/ItemEffects';
import { gearOwners, ownerName } from '../systems/RosterStore';
import { TACTIC_UNLOCK_SCROLLS, TEMPER, XINDE_SLOTS, getXinde, grain, respec, respecCost, scrolls, tacticUnlocked, temperCost, temperLevel, temperUp, toggleXinde, unlockTactic } from '../systems/MasteryStore';
import { lqHitBox, lqPanel, lqSkin } from './LacquerKit';
import { attrBadge } from './AttrBadge';

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
    if (takeAttrNotice()) this.notice = '属性已改版：点数已全部返还，请在「属性」页重新分配';
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
    else if (D) this.renderXindeDesk(rx, cy, rw, y0 + ph - 14);
    else this.renderXinde(rx, cy, rw, y0 + ph - 50);
    // 电脑「战法心得」页：提示放进底部说明栏（见 renderXindeDesk），这里不再叠一条
    if (this.notice && !(D && this.tab === 'xinde')) { this.text(W / 2, y0 + ph - 24, this.notice, 14, '#f3d48a').setOrigin(.5).setBackgroundColor('#1b120bcc').setPadding(10, 4).setName('codex-notice'); this.notice = ''; }
  }

  private renderOverview(x: number, y: number, w: number): void {
    const info = heroInfo(this.hero), name = ownerName(this.hero), c = this.playable;
    this.text(x, y, name, 24, '#f2ddae', true).setName('codex-name');
    { const nm = this.body.getByName('codex-name') as Phaser.GameObjects.Text | null, b = attrBadge(this.scene, x + (nm?.width ?? 60) + 22, y + 15, this.hero, 26); if (b) this.add(b); }
    this.text(x, y + 36, `等级 Lv.${info.level}（本章上限 Lv.${info.cap}）· 经验 ${info.xp} / ${info.next}${info.level >= info.cap ? '（已到上限，经验暂存）' : ''}`, 14, '#d8ccb0').setName('codex-level');
    const a = heroAttrs(this.hero), attrs = (Object.keys(ATTRIBUTE_INFO) as AttributeId[]).map(id => `${ATTRIBUTE_INFO[id].name}${primaryAttribute(this.hero) === id ? '（主）' : ''} ${a[id]}`).join('　');
    this.text(x, y + 64, `属性：${attrs}　· 未分配 ${heroFreePoints(this.hero)} 点`, 14, '#d8ccb0').setWordWrapWidth(w);
    if (!c) { this.text(x, y + 100, '招募武将：随行时按等级成长（每级生命、伤害提高），将阶请到讲武堂「随从操练」提升。', 13, '#9c8c6c').setWordWrapWidth(w); return; }
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
    const head = this.text(x, y, `未分配属性点 ${free}　（武将每升 1 级得 1 点，单项最多 ${ATTRIBUTE_MAX} 点）`, 14, free ? '#f3d48a' : '#b9a57a').setName('codex-free');
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
      this.text(x + w - 110, ry + 2, `${a[id]} / ${ATTRIBUTE_MAX}`, 14, '#e5d4ab').setOrigin(1, 0).setName('codex-attr-' + id);
      this.button(x + w - 50, ry + 12, '+', 'codex-add-' + id, () => this.act(allocateHeroAttr(this.hero, id) ? { ok: true, message: `${ATTRIBUTE_INFO[id].name} +1` } : { ok: false, message: '没有可分配的点，或这一项已满' }), { disabled: free <= 0 || a[id] >= ATTRIBUTE_MAX, size: 18 });
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
    const xd = getXinde(c), all = Object.keys(TACTICS) as TacticId[];
    this.text(x, y, `心得 ${xd.length} / ${XINDE_SLOTS}：${xd.map(t => TACTICS[t].name).join('、') || '未选'}　· 局内出现概率 ×2，开局第一次升级必出一张`, 13, '#f3d48a').setWordWrapWidth(w).setName('codex-xinde');
    this.text(x, y + 22, `点已解锁的战法选为 / 取消心得；未解锁的花 ${TACTIC_UNLOCK_SCROLLS} 武学残卷解锁（局内照样会出，只是不能选为心得）。`, 12, '#9c8c6c').setWordWrapWidth(w);
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
