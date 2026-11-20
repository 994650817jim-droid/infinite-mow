import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, IS_DESKTOP } from '../config';
import { SURRENDER, SURRENDER_TIERS, parleyTier, surrenderLine, surrenderOdds, type Odds, type OddsCtx, type SurrenderDef } from '../data/surrender';
import { bossInRoster, captureBoss, joinByPersuasion } from './RosterStore';
import { markSurrender, neverSeenIds, surrenderedIds, surrenderLive } from './SurrenderStore';
import { gainProvisions } from '../world/WorldStore';
import { homeCommand } from '../ui/HomeCommand';
import { lqButton, lqLabelColor, lqPanel, type LqState } from '../ui/LacquerKit';
import { bossDeathKey } from './BossDeathArt';
import { setStoryFlag } from './Story';

/**
 * 首领招降（通用，surrender-spec.md）：第二章起，可降 / 难降 / 必降 / 宁死不降（本存档首次）的首领血量 ≤ 15% → 战斗暂停 → 弹窗：
 *   劝降（掷骰，成功率见 data/surrender.ts surrenderOdds）/ 斩杀 / 再压一压（打到 5% 或 20 秒后再弹一次，把握 +15%）。
 *   成功：首领跪降、淡出离场，不倒地不掉宝箱，算击败首领（宿主走 persuaded()）；进降将栏（黄忠、孟获直入麾下）；本存档首次 +60 军粮。
 *   失败：拒绝台词 + 红横幅，首领回到 25% 血、本场伤害 +20%，本场不再弹窗；打死照常掉宝箱、拿斩杀奖励。
 *   宁死不降：本存档第一次弹窗、劝降必拒后只能斩杀；以后不弹窗，倒下把拒绝台词当临终台词。
 * 剧情首领 / 第一章 / 孟获不建 Parley（各自走剧情）。界面只有主按钮「劝 降」用一处水墨，其余漆底描金。
 */
export type ParleyChoice = 'persuade' | 'execute' | 'press';
export type ParleyState = 'idle' | 'open' | 'pressing' | 'done' | 'failed' | 'skip';
export interface ParleyHost {
  scene: Phaser.Scene;
  boss: () => Enemy | null;
  mode: () => string; setMode: (m: string) => void; over: () => boolean; now: () => number;
  ctx: () => Omit<OddsCtx, 'pressed'>;
  /** 华雄：温酒斩华雄条件生效中。 */ wenjiu?: () => boolean;
  banner: (t: string, danger: boolean, caption?: string) => void; sfx: (k: string) => void;
  /** 大字台词（剧情关闭时宿主只出横幅，返回 false）。 */ bark: (target: { x: number; y: number }, name: string, text: string) => boolean;
  /** 斩杀：照常击杀（倒地、宝箱）。 */ kill: (boss: Enemy) => void;
  /** 劝降成功：算击败首领，但不倒地不掉宝箱。 */ persuaded: (boss: Enemy) => void;
  /** 弹窗打开（双首领关：宿主把当前 parley 指到这一个，手柄 A/B/X 用）。 */ opened?: (p: Parley) => void;
}

export class Parley {
  state: ParleyState = 'idle';
  pressed = false; refused = false; persuadedOk = false;
  /** 测试注入随机数（0–1）。 */ static random: (() => number) | null = null;
  readonly log: { opens: number; rolls: Array<{ pct: number; roll: number; ok: boolean }>; choices: ParleyChoice[] } = { opens: 0, rolls: [], choices: [] };
  private panel?: Phaser.GameObjects.Container; private pressUntil = 0; private keys?: (e: KeyboardEvent) => void;
  private readonly firstNever: boolean;
  constructor(private h: ParleyHost, readonly def: SurrenderDef) {
    const roster = bossInRoster(def.id, def.name, def.hero);
    const seenNever = def.tier === 'never' && neverSeenIds().includes(def.key);
    this.firstNever = def.tier === 'never' && !seenNever;
    if (!parleyTier(def) || roster || seenNever) this.state = 'skip';
  }
  /** 宿主按场景建：只有弹窗档且未在麾下的首领才建（其余 null）。 */
  static for(h: ParleyHost, def: SurrenderDef | null): Parley | null { return def && parleyTier(def) ? new Parley(h, def) : null; }
  get active(): boolean { return this.state === 'idle' || this.state === 'open' || this.state === 'pressing'; }
  odds(): Odds { return surrenderOdds(this.def, { ...this.h.ctx(), pressed: this.pressed }); }

  /** 每帧（战斗中）。 */
  update(): void {
    if (!this.active || this.state === 'open') return;
    const b = this.h.boss(); if (!b?.active || this.h.over() || this.h.mode() !== 'none') return;
    if (this.state === 'idle' && b.hp <= b.maxHp * SURRENDER.hpLine) this.open();
    else if (this.state === 'pressing' && (b.hp <= b.maxHp * SURRENDER.pressLine || this.h.now() >= this.pressUntil)) this.open();
  }
  /** 致命一击：还没表态前不让首领死（锁在残血线 / 再压一压的 5% 线）。返回 true = 这一下不死。 */
  preventKill(e: Enemy): boolean {
    if (e !== this.h.boss() || !this.active) return false;
    if (this.state === 'idle' && this.h.wenjiu?.()) { this.state = 'skip'; return false; }
    e.hp = Math.max(1, Math.floor(e.maxHp * (this.state === 'pressing' ? SURRENDER.pressLine : SURRENDER.hpLine)));
    if (this.state !== 'open') this.open();
    return true;
  }
  private open(): void {
    const b = this.h.boss(); if (!b) return;
    if (this.state === 'idle' && this.h.wenjiu?.()) { this.state = 'skip'; return; } // 温酒斩华雄优先
    const second = this.state === 'pressing'; this.state = 'open'; this.log.opens++; b.invulnerable = true;
    if (this.firstNever) markSurrender('neverSeen', this.def.key);
    this.h.setMode('parley'); this.h.opened?.(this); this.render(second);
  }
  /** 选择（按钮 / 键盘 1 2 3 / 手柄 A B X / 测试直接调）。 */
  choose(c: ParleyChoice): void {
    if (this.state !== 'open') return;
    const b = this.h.boss(); if (!b) return;
    const d = this.def, ctx = this.h.ctx(); this.log.choices.push(c);
    if (c === 'press') { if (d.tier === 'never' || d.tier === 'sure' || this.pressed) return; this.pressed = true; this.state = 'pressing'; this.pressUntil = this.h.now() + SURRENDER.pressTimeoutMs; this.close(); b.invulnerable = false; this.h.banner('再压一压', false, `打到 ${Math.round(SURRENDER.pressLine * 100)}% 再劝 · 把握 +${Math.round(SURRENDER.press * 100)}%`); return; }
    if (c === 'execute') { this.state = 'done'; if (d.flag) setStoryFlag(d.flag.key, d.flag.no); this.close(); b.invulnerable = false; b.hp = 0; this.h.kill(b); return; }
    // 劝降
    // 宁死不降 / 条件未满足：劝降按钮置灰，点了也没用（surrender-rules.md：不让玩家白点）
    if (d.tier === 'never' || this.odds().blocked) return;
    const o = this.odds(), roll = Parley.random ? Parley.random() : Math.random(), ok = o.sure || roll * 100 < o.pct;
    this.log.rolls.push({ pct: o.pct, roll, ok });
    this.close();
    if (ok) this.succeed(b, ctx); else this.fail(b, ctx);
  }
  private succeed(b: Enemy, ctx: Omit<OddsCtx, 'pressed'>): void {
    const d = this.def, live = surrenderLive(); this.state = 'done'; this.persuadedOk = true;
    if (d.flag) setStoryFlag(d.flag.key, d.flag.yes); // 剧情旗标：玩法结果，剧情关了也照记
    this.say(b, true, ctx);
    let where = '已入降将栏（四季内六折招降）';
    if (live) {
      const first = markSurrender('surrendered', d.id);
      if (d.hero) { const r = joinByPersuasion(d.name, d.hero); where = r.message.includes('已入') || r.message.includes('已在') ? '以武将身份加入麾下' : r.message; }
      else { const r = captureBoss({ id: d.id, name: d.name, template: d.template ?? 'blade' }); if (r?.evicted.length) where += ` · ${r.evicted.join('、')}久候不至，已离去`; }
      if (first) gainProvisions(SURRENDER.persuadeProvisions);
    } else where = '试炼不入册';
    this.h.banner(`${d.name}归降`, false, where + (live ? ` · 军粮 +${SURRENDER.persuadeProvisions}` : ''));
    this.h.sfx('gong');
    this.kneel(b);
  }
  private fail(b: Enemy, ctx: Omit<OddsCtx, 'pressed'>): void {
    this.state = 'failed'; this.say(b, false, ctx);
    this.h.banner(`劝降不成 · ${this.def.name}怒而再战`, true, `伤害 +${Math.round((SURRENDER.failDamageMul - 1) * 100)}% · 劝降只有这一次`); this.h.sfx('bossSummon');
    b.invulnerable = false; b.hp = Math.max(b.hp, Math.round(b.maxHp * SURRENDER.failHeal));
    b.def = { ...b.def, damage: b.def.damage * SURRENDER.failDamageMul };
    b.sprite.setTint(0xff7060); this.h.scene.time.delayedCall(220, () => { if (b.active) b.sprite.clearTint(); });
  }
  /** 跪降：有倒地帧的首领播前两帧当跪地，其余直接；然后淡出离场，宿主按击败首领处理（不掉宝箱）。 */
  private kneel(b: Enemy): void {
    const s = this.h.scene, key = bossDeathKey(s, this.def.id); b.invulnerable = true;
    let img: Phaser.GameObjects.Image | null = null;
    if (key) { const sp = b.sprite; img = s.add.image(sp.x, sp.y, key, 0).setOrigin(.5, 256 / 288).setScale(Math.abs(sp.displayHeight) / 288).setFlipX(sp.flipX).setDepth(sp.depth).setName('parley-kneel'); sp.setAlpha(0); s.time.delayedCall(220, () => img?.setFrame(1)); }
    s.tweens.add({ targets: img ? [img] : [b.sprite], alpha: 0, delay: 900, duration: 600, onComplete: () => { img?.destroy(); } });
    s.time.delayedCall(1000, () => { if (b.active) this.h.persuaded(b); });
  }
  private say(b: Enemy, ok: boolean, ctx: Omit<OddsCtx, 'pressed'>): void {
    const d = this.def, at = { x: b.x, y: b.y };
    if (!ok && d.preIfHero && ctx.team.includes(d.preIfHero.id)) { this.h.bark(at, d.preIfHero.who, d.preIfHero.text); this.h.scene.time.delayedCall(1400, () => this.h.bark(at, d.name, surrenderLine(d, false, ctx))); return; }
    if (ok && d.yesPreIfHero && ctx.team.includes(d.yesPreIfHero.id)) { this.h.bark(at, d.yesPreIfHero.who, d.yesPreIfHero.text); const sc = this.h.scene; window.setTimeout(() => { if (sc.sys.isActive()) this.h.bark(at, d.name, surrenderLine(d, true, ctx)); }, 1400); return; } // 真实时钟：归降跪地后战斗时钟会停（宝箱 / 结算）
    this.h.bark(at, d.name, surrenderLine(d, ok, ctx));
  }
  /** 宁死不降（已弹过窗）倒下：拒绝台词当临终台词。返回是否播了（播了宿主就不再播剧本 bossFall）。 */
  dyingLine(at: { x: number; y: number }): boolean {
    if (this.def.tier !== 'never' || this.firstNever) return false;
    return this.h.bark(at, this.def.name, surrenderLine(this.def, false, this.h.ctx()));
  }

  // ———— 弹窗（漆金面板；只有「劝 降」用水墨主按钮） ————
  private close(): void { this.panel?.destroy(); this.panel = undefined; if (this.keys) { window.removeEventListener('keydown', this.keys); this.keys = undefined; } if (this.h.mode() === 'parley') this.h.setMode('none'); }
  private render(second: boolean): void {
    this.panel?.destroy(); const s = this.h.scene, d = this.def, W = GAME_WIDTH, H = GAME_HEIGHT, D = IS_DESKTOP;
    const pw = D ? 600 : W - 32, ph = D ? 300 : 330, x0 = (W - pw) / 2, y0 = D ? H * .2 : H * .24;
    const root = s.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 12).setName('parley-panel');
    const g = s.add.graphics().setScrollFactor(0); g.fillStyle(0x0c0805, .55).fillRect(0, 0, W, H); lqPanel(g, x0, y0, pw, ph); root.add(g);
    const t = (x: number, y: number, v: string, size: number, color: string, heading = false, ox = .5) => s.add.text(x, y, v, { fontFamily: heading ? HEADING_FONT : FONT, fontSize: size + 'px', color, resolution: 2, align: 'center', wordWrap: { width: pw - 60, useAdvancedWrap: true } }).setOrigin(ox, .5).setScrollFactor(0);
    root.add(t(W / 2 - 30, y0 + 38, `${d.title} · ${d.name} 败势已成`, D ? 24 : 21, '#f6dc9a', true).setName('parley-title'));
    // 档位印（手绘印章图到之前用文字章）
    const tier = SURRENDER_TIERS[d.tier], sx = x0 + pw - 62, sy = y0 + 40, sealKey = `seal_${d.tier === 'sure' ? 'can' : d.tier}`;
    if (s.textures.exists(sealKey)) root.add(s.add.image(sx, sy, sealKey).setDisplaySize(64, 64).setScrollFactor(0).setAngle(-8).setName('parley-seal'));
    else { const c = Phaser.Display.Color.HexStringToColor(tier.color).color, sg = s.add.graphics().setScrollFactor(0); sg.lineStyle(2.5, c, .95).strokeRoundedRect(sx - 34, sy - 22, 68, 44, 6); root.add([sg, t(sx, sy, tier.seal, tier.seal.length > 2 ? 14 : 18, tier.color, true).setAngle(-6).setName('parley-seal')]); }
    const never = d.tier === 'never', o = this.odds(), blocked = !never ? o.blocked : undefined;
    root.add(t(W / 2, y0 + 78, never ? `宁死不降 · ${d.reason ?? `${d.name}不肯归降`}` : blocked ? `劝降条件：${blocked}（尚未满足）· ${d.reason ?? ''}` : '是劝其归降，还是阵前斩杀？', never || blocked ? 15 : 16, never ? '#f0a090' : '#eadcbd').setName('parley-reason'));
    const oddsText = o.sure ? '劝降把握：必成' : never ? '劝降把握：——' : blocked ? '劝降把握：条件未满足' : `劝降把握：${o.pct}%`;
    root.add(t(W / 2, y0 + 112, oddsText, 20, o.sure ? '#9fe0a0' : never || blocked ? '#c07060' : '#ffe08a', true).setName('parley-odds'));
    if (never) root.add(t(W / 2, y0 + 140, `斩杀后以礼厚葬：军粮 +${SURRENDER.persuadeProvisions} · 仁名 +1（本存档首次）`, 13, '#d8c08a').setName('parley-honor'));
    else if (!o.sure && !blocked) root.add(t(W / 2, y0 + 140, o.parts.map((p, i) => (i ? `${p.label} ${p.add >= 0 ? '+' : ''}${p.add}` : `${p.label} ${p.add}`)).join(' · '), 13, '#b9a57a').setName('parley-parts'));
    const relic = (this.h as unknown as { relicName?: () => string | null }).relicName?.() ?? null;
    if (never) root.add(t(W / 2, y0 + 168, `斩杀：首领宝箱${relic ? `（遗珍：${relic}）` : ''} · 军粮 +${SURRENDER.executeProvisions}`, 13, '#b9a57a'));
    else root.add(t(W / 2, y0 + 168, `劝降：${d.hero ? '以武将身份加入麾下' : '入降将栏（四季内六折招降）'} · 军粮 +${SURRENDER.persuadeProvisions}　|　斩杀：首领宝箱${relic ? `（遗珍：${relic}）` : ''} · 军粮 +${SURRENDER.executeProvisions}`, 13, '#b9a57a'));
    // 按钮：劝降（水墨主按钮）/ 斩杀 / 再压一压（漆底描金）
    const by = y0 + ph - 62, three = !second && !this.pressed && !never && !blocked && d.tier !== 'sure', canPersuade = !never && !blocked;
    const xs = three ? [W / 2 - 190, W / 2, W / 2 + 190] : [W / 2 - 110, W / 2 + 110];
    if (canPersuade) {
      const c = homeCommand(s, xs[0], by, D ? 170 : 150, 50, '劝 降', true); [c.g, c.caption, c.hit].forEach(o2 => o2.setScrollFactor(0)); c.hit.setName('parley-persuade').on('pointerup', () => this.choose('persuade')); root.add([c.g, c.caption, c.hit]);
    } else root.add(this.lq(xs[0], by, D ? 170 : 150, 46, never ? '宁死不降' : '劝 降', 'parley-persuade', null));
    root.add(this.lq(xs[1], by, D ? 170 : 150, 46, '斩 杀', 'parley-execute', () => this.choose('execute')));
    if (three) { root.add(this.lq(xs[2], by, D ? 170 : 150, 46, '再压一压', 'parley-press', () => this.choose('press'))); root.add(t(xs[2], by + 36, `打到 ${Math.round(SURRENDER.pressLine * 100)}% 再劝，把握 +${Math.round(SURRENDER.press * 100)}%`, 12, '#a8977a')); }
    root.add(t(W / 2, y0 + ph - 18, three ? '键盘 1 劝降 · 2 斩杀 · 3 再压一压' : canPersuade ? '键盘 1 劝降 · 2 斩杀' : '键盘 2 斩杀', 11, '#8f8068'));
    this.panel = root;
    if (this.keys) window.removeEventListener('keydown', this.keys);
    this.keys = (e: KeyboardEvent) => { if (e.key === '1') this.choose('persuade'); else if (e.key === '2') this.choose('execute'); else if (e.key === '3' && three) this.choose('press'); };
    window.addEventListener('keydown', this.keys);
  }
  /** 漆底描金按钮（中心坐标）；fn 为空 = 置灰。 */
  private lq(cx: number, cy: number, w: number, h: number, label: string, name: string, fn: (() => void) | null): Phaser.GameObjects.GameObject[] {
    const s = this.h.scene, g = s.add.graphics().setScrollFactor(0), cap = s.add.text(cx, cy, label, { fontFamily: HEADING_FONT, fontSize: '19px', color: '#ffe9bd', resolution: 2 }).setOrigin(.5).setLetterSpacing(4).setScrollFactor(0);
    const hit = s.add.rectangle(cx, cy, w, h, 0, .001).setScrollFactor(0).setName(name); if (fn) hit.setInteractive({ useHandCursor: true });
    const paint = (st: LqState) => { g.clear(); const dd = lqButton(g, cx, cy, w, h, fn ? st : 'off', 'gold'); cap.setY(cy + dd).setColor(lqLabelColor(fn ? st : 'off')); };
    hit.on('pointerover', () => paint('hover')).on('pointerout', () => paint('idle')).on('pointerdown', () => paint('down')).on('pointerup', () => { paint('hover'); fn?.(); });
    paint('idle'); return [g, cap, hit];
  }
  /** 手柄：A 劝降 / B 斩杀 / X 再压一压（宿主在 parley 模式转发）。 */
  pad(button: number): boolean { if (this.state !== 'open') return false; if (button === 0) this.choose('persuade'); else if (button === 1) this.choose('execute'); else if (button === 2) this.choose('press'); else return false; return true; }
  snapshot() { return { key: this.def.key, tier: this.def.tier, state: this.state, pressed: this.pressed, refused: this.refused, ok: this.persuadedOk, odds: this.odds(), panel: !!this.panel, log: { ...this.log, rolls: [...this.log.rolls] } }; }
  clear(): void { this.close(); }
}
