/**
 * 3-2 宛城夜袭「典韦守营」（剧情 story-ch03.md 第五节，用户 2026-11-17 批准）：
 * 后营寨门有一名友军典韦（不可操作），有血条；约四成敌兵改打他（ThirdGameScene.customEnemyStep 按 lures 改目标）。
 * 张绣倒下时典韦还活着 → 旗标 dianwei = saved（军功 +80）；典韦血空 → 倒地 + 横幅「典韦力战而死」，不判负，战斗继续 → dianwei = fell。
 * 军令面板「（可选）保护典韦」：他倒下只把这条标成失败（灰），不挡胜利。数值在 data/dianweiGuard.ts。
 * 11-19 用户「穿模」：典韦有身体（推开贴身单位）；碧色友军名牌 + 血条；朝敌站、挥戟播攻击帧；专属双戟图。
 * 11-19 用户「也要增加剧情台词和典韦可以动和有自己技能」：
 *  - 守区：以营门为圆心 zone 半径，圈内有敌人就走过去打（走路帧随位移、朝向随走向），圈里清了回门口；绝不出圈；
 *  - 技能：双戟旋风（身边 ≥3 敌，友军色预警圈 → 旋扫 + 击退）、掷戟（圈内远处的敌人，友军色直线预警 → 飞戟）、恶来死战（血 < 30% 一次：减伤 + 加攻速 + 红气）；
 *  - 台词：开场、曹操一句、血过半 / 两成、主将来援、各技能首次、得救、战死（data/story/qunxiong.ts barks，剧情设置关掉不播）。
 * 只打敌人，不伤主将和友军。
 */
import Phaser from 'phaser';
import { DEPTH, FONT, actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import { playSheet } from './SkillFxSheets';
import { ordersOf } from './BattleOrders';
import { ART_V2_FILES, isV2Texture, regridV2 } from './ArtStyle';
import { warnFx } from '../ui/WarnFx';
import { DIANWEI_GUARD as D, DIANWEI_BARKS as BARK } from '../data/dianweiGuard';

/** 兼容旧名（ThirdGameScene 读 meritSaved） */
export const DIANWEI = D;

/** 专属双戟图（v2 4×4：行 下 / 左 / 右 / 上）；没有就用友军刀兵图占位。 */
const ART = { walk: 'dianwei_walk', attack: 'dianwei_attack' } as const;
const FALLBACK = { walk: 'shu_swordsman_walk_sheet', attack: 'shu_swordsman_attack_sheet' } as const;
/**
 * 技能手绘特效（SkillFxSheets 序列帧；按顺序取第一张在的，都没有就不画替代图形）：
 * 专属特效排队等 ChatGPT（fx_dianwei_*）；先用现成手绘图——旋风 = 觉醒「横扫千军」红色刃环，死战红气 = 觉醒火焰染红，飞戟 = 从典韦攻击图裁下的戟头（整张转着飞）。
 */
const FX = { whirl: ['fx_dianwei_whirl', 'fx_awaken_warrior'], rage: ['fx_dianwei_rage', 'fx_awaken_fire'], hit: 'fx_strike_glint', throwSheet: 'fx_dianwei_throw', halberd: 'dianwei_halberd' } as const;
const HALBERD_FILE = 'assets/allies-v2/dianwei_halberd.png';
const fxKey = (sc: Phaser.Scene, keys: readonly string[]): string | null => keys.find(k => sc.textures.exists(k)) ?? null;
type Dir = 'down' | 'left' | 'right' | 'up';
const PLATE = { w: 64, h: 6, color: 0x5fd27a, back: 0x13200f, nameColor: '#b8f5c4', rageColor: 0xe0503a } as const;

export interface DianweiHost {
  scene: Phaser.Scene; player: { x: number; y: number; sprite: { displayHeight: number } };
  enemies: () => readonly Enemy[];
  /** 友军兵（推开用，可选） */
  allies?: () => ReadonlyArray<{ x: number; y: number; active: boolean; setPosition(x: number, y: number): void }>;
  /** 典韦打敌人（算友军伤害） */
  hit: (e: Enemy, damage: number) => void;
  banner: (title: string, danger: boolean, caption?: string) => void;
  /** 剧情台词（StoryDirector.line）；剧情关掉返回 false */
  line?: (id: string, at: { x: number; y: number; displayHeight?: number }) => boolean;
}

interface Throw { img: Phaser.GameObjects.Image | null; x: number; y: number; tx: number; ty: number; target: Enemy; life: number; spin: number }

export class DianweiGuard {
  hp: number = D.hp; down = false; x: number; y: number;
  /** 营门（守区圆心） */
  readonly home: { x: number; y: number };
  private readonly img: Phaser.GameObjects.Image; private readonly label: Phaser.GameObjects.Text; private readonly bar: Phaser.GameObjects.Graphics;
  private nextSwing = 0; private hurtFlashUntil = 0; private attackUntil = 0; private dir: Dir = 'up'; private targetH: number; private barY = 0;
  private walkDist = 0; private moving = false; private readonly bornAt: number;
  private nextWhirl: number; private nextThrow: number; private whirlAt = 0; private throwAt = 0; private throwTarget: Enemy | null = null;
  private readonly throws: Throw[] = []; private rageUntil = 0; private raged = false; private rageFx: Phaser.GameObjects.Image | null = null; private rageFxAt = 0;
  private readonly said = new Set<string>();
  /** 测试用 */
  readonly stats = { swings: 0, hurt: 0, pushed: 0, attackFrames: 0, whirls: 0, throws: 0, throwHits: 0, rage: 0, knocked: 0, walked: 0, walkFrames: 0, maxFromHome: 0, barks: [] as string[] };
  constructor(private readonly h: DianweiHost, now: number) {
    this.x = h.player.x; this.y = h.player.y + D.offsetY; this.home = { x: this.x, y: this.y }; this.bornAt = now;
    const sc = h.scene;
    this.targetH = (h.player.sprite.displayHeight || 96) * D.heightMul;
    this.img = sc.add.image(this.x, this.y, this.walkKey(), 'up_0').setOrigin(.5, .88).setName('dianwei-guard').setDepth(actorDepth(this.y));
    this.fit();
    this.label = sc.add.text(this.x, 0, '典韦', { fontFamily: FONT, fontSize: '13px', color: PLATE.nameColor, resolution: 2 }).setOrigin(.5, 1).setStroke('#0d1a0c', 4).setDepth(DEPTH.hud - 1).setName('dianwei-label');
    this.bar = sc.add.graphics().setDepth(DEPTH.hud - 1).setName('dianwei-hpbar');
    this.nextSwing = now + D.swingMs; this.nextWhirl = now + D.whirl.everyMs * .5; this.nextThrow = now + D.throw.everyMs * .5;
    this.loadArt();
    ordersOf(sc)?.set('dianwei', { label: '（可选）保护典韦', kind: 'side', detail: '守住后营寨门', progress: { cur: this.hp, max: D.hp }, at: () => this.down ? null : { x: this.x, y: this.y } });
    this.refresh();
  }
  private walkKey(): string { const s = this.h.scene.textures; return s.exists(ART.walk) ? ART.walk : s.exists(FALLBACK.walk) ? FALLBACK.walk : 'hero_walk_sheet'; }
  private attackKey(): string | null { const s = this.h.scene.textures; return s.exists(ART.attack) ? ART.attack : s.exists(ART.walk) ? null : s.exists(FALLBACK.attack) ? FALLBACK.attack : null; }
  /** 专属图按首领 v2 标准（格 288、人高约 216）显示 ×0.5；占位图按主将身高 ×heightMul 缩放。 */
  private fit(): void {
    if (this.img.texture.key === ART.walk) this.img.setScale(D.artScale); else { const fh = this.img.frame.height || 96; this.img.setScale(this.targetH / fh); }
  }
  private get topY(): number { return this.y - this.img.displayHeight * (this.img.texture.key === ART.walk || this.img.texture.key === ART.attack ? .8 : .88) - 4; }
  /** 专属双戟图在 ART_V2_FILES 里登记了才载（图还没到就一直用占位）。 */
  private loadArt(): void {
    const sc = this.h.scene; let n = 0;
    for (const k of [ART.walk, ART.attack]) if (ART_V2_FILES[k] && isV2Texture(k) && !sc.textures.exists(k)) { sc.load.once(`filecomplete-image-${k}`, () => { regridV2(sc, k); if (k === ART.walk && this.img.active) { this.img.setTexture(k, `${this.dir}_0`); this.fit(); this.refresh(); } }); sc.load.image(k, ART_V2_FILES[k]); n++; }
    if (!sc.textures.exists(FX.halberd)) { sc.load.image(FX.halberd, HALBERD_FILE); n++; }
    if (n && !sc.load.isLoading()) sc.load.start();
  }
  get alive(): boolean { return !this.down; }
  get raging(): boolean { return this.rageUntil > 0 && !this.down; }
  /** 这名敌兵是否改打典韦（约四成，按出生编号固定）。 */
  lures(e: Enemy): boolean { return !this.down && e.kind !== 'boss' && !e.isSupplySlot && e.spawnId % 10 < D.lureShare * 10; }
  /** 说一句（每句一局只说一次）。 */
  private say(key: keyof typeof BARK): void {
    if (this.said.has(key)) return; this.said.add(key);
    if (this.h.line?.(BARK[key], { x: this.x, y: this.y, displayHeight: this.img.displayHeight })) this.stats.barks.push(key);
  }
  hurt(d: number, now: number): void {
    if (this.down || d <= 0) return;
    if (now < this.rageUntil) d *= D.rage.takenMul;
    const before = this.hp / D.hp;
    this.hp -= d; this.stats.hurt += d; this.hurtFlashUntil = now + 90; this.img.setTintFill(0xffffff);
    const r = this.hp / D.hp;
    if (before >= D.barks.hp50 && r < D.barks.hp50) this.say('hp50');
    if (before >= D.barks.hp20 && r < D.barks.hp20 && r > 0) this.say('hp20');
    if (!this.raged && r < D.rage.at && r > 0) this.startRage(now);
    if (this.hp <= 0) {
      this.hp = 0; this.down = true; this.rageUntil = 0; this.rageFx?.destroy(); this.rageFx = null;
      this.say('fall');
      this.img.clearTint().setTint(0x6a5050).setAlpha(.7).setAngle(80);
      this.h.banner('典韦力战而死', true, '恶来独守营门，至死不退');
      ordersOf(this.h.scene)?.fail('dianwei');
    }
    this.refresh();
  }
  /** 战斗结束时（张绣倒下）：典韦还活着 → 军令完成、说一句。 */
  finish(): void { if (this.down) return; ordersOf(this.h.scene)?.done('dianwei', '典韦得救'); this.say('saved'); }
  private shownHp = -1;
  private refresh(): void {
    const g = this.bar, r = Math.max(0, this.hp / D.hp), x = this.x - PLATE.w / 2, y = this.topY;
    this.label.setPosition(this.x, y - 2).setText(this.down ? '典韦 · 战死' : this.raging ? '典韦 · 死战' : '典韦').setColor(this.down ? '#b9a99a' : this.raging ? '#ffb3a0' : PLATE.nameColor);
    g.clear(); if (this.down) return;
    g.fillStyle(0x000000, .55).fillRect(x - 1, y, PLATE.w + 2, PLATE.h + 2).fillStyle(PLATE.back, 1).fillRect(x, y + 1, PLATE.w, PLATE.h).fillStyle(this.raging ? PLATE.rageColor : PLATE.color, 1).fillRect(x, y + 1, PLATE.w * r, PLATE.h);
    const hp = Math.ceil(this.hp); if (hp !== this.shownHp) { this.shownHp = hp; ordersOf(this.h.scene)?.patch('dianwei', { progress: { cur: hp, max: D.hp } }); }
  }
  /** 身体：把贴进来的敌兵 / 友军推到身体外（防一群人站在典韦身上）。 */
  private pushOut(o: { x: number; y: number }, r: number, set: (x: number, y: number) => void): void {
    const dx = o.x - this.x, dy = o.y - this.y, d = Math.hypot(dx, dy), min = D.body + r;
    if (d >= min) return;
    const a = d > .5 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2; set(this.x + Math.cos(a) * min, this.y + Math.sin(a) * min); this.stats.pushed++;
  }
  private faceDir(dx: number, dy: number): Dir { return Math.abs(dx) > Math.abs(dy) * .8 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'; }
  private face(tx: number, ty: number): void { this.dir = this.faceDir(tx - this.x, ty - this.y); }
  private pose(now: number): void {
    const atk = this.attackKey();
    if (now < this.attackUntil && atk) { const ms = now < this.whirlAt + D.whirl.spinMs && this.whirlAt ? D.whirl.spinMs : D.attackMs, f = Math.min(3, Math.floor((1 - (this.attackUntil - now) / ms) * 4)), key = `${this.dir}_${f}`; if (this.img.texture.key !== atk || this.img.frame.name !== key) { this.img.setTexture(atk, key); this.stats.attackFrames++; } return; }
    const wk = this.walkKey(), f = this.moving ? Math.floor(this.walkDist / D.stride) % 4 : 0, key = `${this.dir}_${f}`;
    if (this.img.texture.key !== wk || this.img.frame.name !== key) { if (this.moving && this.img.frame.name !== key) this.stats.walkFrames++; this.img.setTexture(wk, key); }
  }
  private inZone(o: { x: number; y: number }, pad = 0): boolean { return Math.hypot(o.x - this.home.x, o.y - this.home.y) <= D.zone + pad; }
  /** 守区走位：圈内最近的敌人 → 走过去（到 engage 停）；圈内没敌人 → 回营门。返回本帧要朝向的目标。 */
  private move(dt: number, enemies: readonly Enemy[], busy: boolean): Enemy | null {
    let target: Enemy | null = null, td = 1e9;
    for (const e of enemies) { if (!e.active || e.isSupplySlot || !this.inZone(e, e.radius)) continue; const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < td) { td = d; target = e; } }
    const gx = target ? target.x : this.home.x, gy = target ? target.y : this.home.y, stop = target ? D.engage + target.radius * .5 : D.homeSlack;
    const dx = gx - this.x, dy = gy - this.y, d = Math.hypot(dx, dy);
    this.moving = false;
    if (!busy && d > stop) {
      const sp = D.speed * (this.raging ? 1.25 : 1), st = Math.min(d - stop, sp * dt);
      let nx = this.x + dx / d * st, ny = this.y + dy / d * st;
      // 绝不出圈
      const hx = nx - this.home.x, hy = ny - this.home.y, hd = Math.hypot(hx, hy); if (hd > D.zone) { nx = this.home.x + hx / hd * D.zone; ny = this.home.y + hy / hd * D.zone; }
      const moved = Math.hypot(nx - this.x, ny - this.y);
      if (moved > .2) { this.dir = this.faceDir(nx - this.x, ny - this.y); this.x = nx; this.y = ny; this.walkDist += moved; this.stats.walked += moved; this.moving = true; }
    }
    this.stats.maxFromHome = Math.max(this.stats.maxFromHome, Math.round(Math.hypot(this.x - this.home.x, this.y - this.home.y)));
    return target;
  }
  // ———— 技能 ————
  /** 恶来死战：减伤、加攻速、红气、台词（一局一次）。 */
  private startRage(now: number): void {
    this.raged = true; this.rageUntil = now + D.rage.ms; this.stats.rage++;
    this.h.banner('恶来死战', false, '典韦血战不退 · 减伤加速');
    this.say('rage'); this.rageFxAt = 0;
  }
  private updateRage(now: number): void {
    if (!this.rageUntil) return;
    if (now >= this.rageUntil) { this.rageUntil = 0; this.rageFx?.destroy(); this.rageFx = null; return; }
    // 红气：手绘序列帧循环（每段播完再接一段）；缺图则不画
    const rk = fxKey(this.h.scene, FX.rage);
    if (rk && now >= this.rageFxAt) { this.rageFxAt = now + 600; this.rageFx = playSheet(this.h.scene, rk, this.x, this.y - 10, { size: D.rage.fx, ms: 600, depth: actorDepth(this.y) - .01, alpha: .7, add: true, tint: rk === 'fx_awaken_fire' ? 0xff5a40 : undefined, originY: .8, name: 'dianwei-rage', onUpdate: img => img.setPosition(this.x, this.y - 10).setDepth(actorDepth(this.y) - .01) }); }
    if (Math.floor(now / 120) % 2 === 0 && !this.hurtFlashUntil) this.img.setTint(0xffb0a0); else if (!this.hurtFlashUntil) this.img.clearTint();
  }
  /** 双戟旋风：起手（友军色预警圈）→ 旋扫一圈 + 击退。 */
  private updateWhirl(now: number, enemies: readonly Enemy[]): boolean {
    const W = D.whirl, sc = this.h.scene, id = 'dianwei-whirl';
    if (this.whirlAt && now < this.whirlAt) { warnFx(sc).circle(id, 'slam', this.x, this.y, W.radius, 1 - (this.whirlAt - now) / W.windupMs, now, D.warnTint); return true; }
    if (this.whirlAt) {
      this.whirlAt = 0; this.stats.whirls++; this.attackUntil = now + W.spinMs; this.say('whirl');
      for (const e of enemies) {
        if (!e.active || e.isSupplySlot) continue; const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) || 1; if (d > W.radius + e.radius) continue;
        this.h.hit(e, D.swingDamage * W.damageMul);
        if (e.active && e.kind !== 'boss') { const k = W.knockback; e.sprite.setPosition(e.x + dx / d * k, e.y + dy / d * k); this.stats.knocked++; }
      }
      const wk = fxKey(sc, FX.whirl); if (wk) playSheet(sc, wk, this.x, this.y - 20, { size: W.fx, sizeH: wk === 'fx_awaken_warrior' ? W.fx * .62 : undefined, ms: W.spinMs, depth: DEPTH.fx, alpha: .95, add: true, name: 'dianwei-whirl-fx' });
      this.h.scene.cameras.main.shake(120, .003);
      this.nextSwing = now + D.swingMs * .6;
      return true;
    }
    if (now < this.nextWhirl) return false;
    const near = enemies.filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - this.x, e.y - this.y) <= W.radius + e.radius).length;
    if (near < W.minEnemies) return false;
    this.nextWhirl = now + W.everyMs * (this.raging ? .6 : 1); this.whirlAt = now + W.windupMs; return true;
  }
  /** 掷戟：圈内远处的敌人，起手（友军色直线预警）→ 飞戟，命中重伤。 */
  private updateThrow(now: number, enemies: readonly Enemy[]): boolean {
    const T = D.throw, sc = this.h.scene, id = 'dianwei-throw';
    const tg = this.throwTarget;
    if (this.throwAt && now < this.throwAt) {
      if (!tg?.active) { this.throwAt = 0; this.throwTarget = null; return false; }
      const a = Math.atan2(tg.y - this.y, tg.x - this.x); this.face(tg.x, tg.y);
      warnFx(sc).lane(id, 'charge', this.x, this.y, a, Math.hypot(tg.x - this.x, tg.y - this.y), 26, 1 - (this.throwAt - now) / T.windupMs, now, D.warnTint); return true;
    }
    if (this.throwAt) {
      this.throwAt = 0; this.throwTarget = null;
      if (tg?.active) {
        this.stats.throws++; this.attackUntil = now + D.attackMs; this.say('throw');
        const sheet = sc.textures.exists(FX.throwSheet), img = sheet ? sc.add.image(this.x, this.y - 40, FX.throwSheet, 0).setDisplaySize(T.fx, T.fx) : sc.textures.exists(FX.halberd) ? sc.add.image(this.x, this.y - 40, FX.halberd).setScale(T.fx / 80) : null;
        img?.setDepth(DEPTH.fx).setName('dianwei-halberd');
        this.throws.push({ img, x: this.x, y: this.y - 40, tx: tg.x, ty: tg.y - 20, target: tg, life: 1.2, spin: 0 });
      }
      return false;
    }
    if (now < this.nextThrow) return false;
    let best: Enemy | null = null, bd = 0;
    for (const e of enemies) { if (!e.active || e.isSupplySlot || !this.inZone(e, e.radius)) continue; const d = Math.hypot(e.x - this.x, e.y - this.y); if (d >= T.minDist && d <= T.maxDist && d > bd) { bd = d; best = e; } }
    if (!best) return false;
    this.nextThrow = now + T.everyMs * (this.raging ? .6 : 1); this.throwTarget = best; this.throwAt = now + T.windupMs; return true;
  }
  private updateThrows(dt: number): void {
    const T = D.throw, sc = this.h.scene;
    for (let i = this.throws.length - 1; i >= 0; i--) {
      const t = this.throws[i]; t.life -= dt;
      if (t.target.active) { t.tx = t.target.x; t.ty = t.target.y - 20; }
      const dx = t.tx - t.x, dy = t.ty - t.y, d = Math.hypot(dx, dy), st = T.speed * dt;
      if (d <= st + 8 || t.life <= 0) {
        if (t.target.active && d <= st + 30) { this.h.hit(t.target, D.swingDamage * T.damageMul); this.stats.throwHits++; playSheet(sc, FX.hit, t.tx, t.ty, { size: 90, ms: 260, depth: DEPTH.fx + 1, add: true, name: 'dianwei-throw-hit' }); }
        t.img?.destroy(); this.throws.splice(i, 1); continue;
      }
      t.x += dx / d * st; t.y += dy / d * st; t.spin += dt;
      if (t.img?.texture.key === FX.throwSheet) t.img.setPosition(t.x, t.y).setFrame(Math.floor(t.spin * 24) % 6); else t.img?.setPosition(t.x, t.y).setRotation(t.spin * 22);
    }
  }
  update(dt: number, now: number): void {
    if (this.down) return;
    if (this.hurtFlashUntil && now >= this.hurtFlashUntil) { this.hurtFlashUntil = 0; this.img.clearTint(); }
    const enemies = this.h.enemies(), p = this.h.player;
    // 台词：开场、曹操、主将来援
    if (now - this.bornAt >= D.barks.startMs) this.say('start');
    if (now - this.bornAt >= D.barks.caoMs) this.say('cao');
    if (now - this.bornAt >= D.barks.helpAfterMs && Math.hypot(p.x - this.x, p.y - this.y) <= D.barks.helpDist) this.say('help');
    this.updateRage(now);
    this.updateThrows(dt);
    // 技能优先（起手 / 出手期间站定）
    const casting = this.updateWhirl(now, enemies) || this.updateThrow(now, enemies);
    const target = this.move(dt, enemies, casting || now < this.attackUntil);
    for (const e of enemies) if (e.active && !e.isSupplySlot && e.kind !== 'boss') this.pushOut(e, e.radius * .7, (x, y) => e.sprite.setPosition(x, y));
    for (const a of this.h.allies?.() ?? []) if (a.active) this.pushOut(a, 12, (x, y) => a.setPosition(x, y));
    // 贴身敌兵砍典韦
    for (const e of enemies) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || e.contactCd > 0 || Math.hypot(e.x - this.x, e.y - this.y) > e.radius + D.body + 4) continue;
      e.contactCd = D.contactCd; this.hurt(e.def.damage * D.contactMul, now); if (this.down) return;
    }
    if (target && !this.moving && !casting) this.face(target.x, target.y);
    // 普通双戟：每 swingMs 打身边一圈（死战时更快）
    if (!casting && now >= this.nextSwing) {
      this.nextSwing = now + D.swingMs * (this.raging ? D.rage.swingMul : 1);
      const near = enemies.filter(e => e.active && !e.isSupplySlot && Math.hypot(e.x - this.x, e.y - this.y) <= D.swingRadius + e.radius);
      if (near.length) {
        this.stats.swings++; this.face(near[0].x, near[0].y); this.attackUntil = now + D.attackMs;
        for (const e of near) this.h.hit(e, D.swingDamage);
        const a = Math.atan2(near[0].y - this.y, near[0].x - this.x);
        playSheet(this.h.scene, 'fx_drag_wave', this.x + Math.cos(a) * 26, this.y - 30 + Math.sin(a) * 18, { size: 120, ms: 260, depth: DEPTH.fx, add: true, alpha: .7, rotation: a, name: 'dianwei-swing' });
      }
    }
    this.img.setPosition(this.x, this.y).setDepth(actorDepth(this.y));
    this.pose(now); this.refresh();
  }
  clear(): void {
    this.img.destroy(); this.label.destroy(); this.bar.destroy(); this.rageFx?.destroy();
    for (const t of this.throws) t.img?.destroy(); this.throws.length = 0;
    ordersOf(this.h.scene)?.remove('dianwei');
  }
}
