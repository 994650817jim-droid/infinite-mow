import Phaser from 'phaser';
import { boxDist, propFootprint, type Box } from './PropFootprint';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import { DEFENSE, defenseWaveStarts, type DefenseTier } from '../data/defenseBattle';
import { isRangedSpawn } from '../data/gateSpawn';
import type { CityTier } from '../world/WorldCities';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';

/**
 * 守城战（共享笔记 defense-redesign.md 第二节；用户 11-20「Approve defaults」）：我方在城内（南），敌军在城外（北）。
 * - 节奏：攻（attackSec）→ 喘息 · 布防（restSec，Space 跳过）→ 再攻 …… 末波（finalSec）攻城主将出阵；守满或击败主将即守住。
 * - 城门有耐久（敌兵贴门砍、冲车撞），破了敌军从门洞涌进瓮城；府衙耐久归零才算失守。
 * - 城头弓手自动放箭；城防设施（滚木、热油）在城头固定位，主将站上去自动放；喘息时花随军粮修门、补设施、补弓手，站在门内读条免费修一点。
 * - 中档起有冲车（撞门）与云梯（不断有人爬上城头），都要优先拆。
 * 场景（SiegeGameScene 守城分支）负责：关墙 / 城门（SishuiPass）、刷兵口、敌兵 / 首领步进转给 step / bossStep、结算。
 */
export interface DefenseHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number };
  now: () => number; elapsed: () => number; paused: () => boolean;
  enemies: () => readonly Enemy[];
  hit: (e: Enemy, dmg: number) => void;
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  spawnTarget: (x: number, y: number, hp: number, size: number, tex: string, frame: number) => Enemy | null;
  advance: (e: Enemy, nx: number, ny: number, dt: number) => void;
  food: () => number; spend: (n: number) => boolean;
  banner: (t: string, danger: boolean, c?: string) => void; sfx: (k: string) => void;
  /** 城门破了：把门的碰撞框撤掉、换破门图。 */ openGate: () => void;
  /** 府衙大堂的碰撞框（按台基，systems/PropFootprint）登记进场景碰撞（统筹 11-21 大件布景碰撞检查：原来能走进府衙）。 */ block?: (boxes: Box[]) => void;
  /** 跳过喘息：把关内时间拨到下一波。 */ skipTo: (sec: number) => void;
  /** 小兵成长（弓手伤害跟着涨一点）。 */ hpScale: () => number;
  /** 登城：主将在城头带里时武器范围加成（1 = 没有）。 */ rampart?: (mul: number) => void;
  /** 部曲守门（formation-design.md §3）：p = 城门内锚点、朝城外；null = 随主将。 */ guardGate?: (p: { x: number; y: number; facing: number } | null) => void;
  win: () => void; lose: () => void;
}
export interface DefenseOpts { tier: CityTier; dtier: DefenseTier; office: number; muster: number; start: { x: number; y: number }; wallLine: number; gateX: number }
type Phase = 'attack' | 'rest' | 'final';
interface Engine { e: Enemy; life: number; kind: 'ram' | 'ladder'; x: number; y: number; next: number; label: Phaser.GameObjects.Text; up?: boolean; warn?: Phaser.GameObjects.Graphics }
interface Archer { img: Phaser.GameObjects.Image; x: number; y: number; hp: number; next: number }

export class DefenseBattle {
  readonly waves: number; readonly starts: number[];
  gate: { hp: number; max: number; open: boolean }; keep: { hp: number; max: number };
  phase: Phase = 'attack'; wave = 0; private lastPhase = ''; private freeRepairUsed = false; private channel = 0;
  private archers: Archer[] = []; private engines: Engine[] = []; private ui: Phaser.GameObjects.Container | null = null; private hud: Phaser.GameObjects.Text;
  private bars: Phaser.GameObjects.Graphics; private keepImg: Phaser.GameObjects.Image | null = null; private objs: Phaser.GameObjects.GameObject[] = [];
  private facility = { logs: { charges: DEFENSE.logs.charges as number, cd: 0, x: 0, y: 0 }, oil: { charges: DEFENSE.oil.charges as number, cd: 0, x: 0, y: 0 } };
  private rolling: { img: Phaser.GameObjects.Image; t0: number; x0: number; dir: number; hit: Set<Enemy> } | null = null;
  private burning: { until: number; next: number; fires: Phaser.GameObjects.Sprite[] } | null = null;
  /** 府衙大堂碰撞框（没有图时为空）。 */ private keepBox: Box[] = [];
  private done = false; private spaceKey?: Phaser.Input.Keyboard.Key; private onRampart = false;
  /** 正在砍城门 / 府衙的人（最后一次贴上来的时刻）：超过 gateCap / keepCap 的在后面排着。 */
  private atGate = new Map<Enemy, number>(); private atKeep = new Map<Enemy, number>();
  /** 测试用。 */
  readonly stats = { archerShots: 0, gateHits: 0, keepHits: 0, rams: 0, ladders: 0, climbers: 0, logs: 0, oil: 0, repairs: 0, phaseLog: [] as string[] };

  constructor(private readonly h: DefenseHost, private readonly o: DefenseOpts) {
    const D = DEFENSE, mul = 1 + D.officeBonus * Math.max(0, o.office - 1);
    this.waves = D.waves[o.dtier]; this.starts = defenseWaveStarts(this.waves);
    this.gate = { hp: Math.round(D.gateHp[o.tier] * mul), max: Math.round(D.gateHp[o.tier] * mul), open: false };
    this.keep = { hp: Math.round(D.keepHp[o.tier] * mul), max: Math.round(D.keepHp[o.tier] * mul) };
    const s = h.scene, K = this.keepPos;
    if (s.textures.exists('siege_mid_hall')) { this.keepImg = s.add.image(K.x, K.y, 'siege_mid_hall', 0).setOrigin(.5, .85).setDisplaySize(260, 260).setDepth(actorDepth(K.y)).setName('defense-keep'); this.objs.push(this.keepImg); this.keepBox = propFootprint(this.keepImg, 'siege_mid_hall#0'); this.h.block?.(this.keepBox); }
    this.objs.push(s.add.text(K.x, K.y + 30, '府衙', { fontFamily: FONT, fontSize: '16px', color: '#ffe1a0', resolution: 2, stroke: '#1a120b', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 2));
    // 马道（两头）、城头设施位（城门左侧滚木、门上热油）
    const R = o.wallLine + (D.rampart.top + D.rampart.bottom) / 2;
    for (const dx of [-560, 560]) if (s.textures.exists('siege_mid_city')) this.objs.push(s.add.image(o.gateX + dx, o.wallLine + 130, 'siege_mid_city', 4).setOrigin(.5, .8).setDisplaySize(170, 170).setFlipX(dx > 0).setDepth(actorDepth(o.wallLine + 130)));
    this.facility.logs.x = o.gateX - 260; this.facility.logs.y = R; this.facility.oil.x = o.gateX; this.facility.oil.y = R;
    for (const [k, f, label] of [['logs', this.facility.logs, '滚木'], ['oil', this.facility.oil, '热油']] as const) {
      if (s.textures.exists('siege_mid_barb') && k === 'logs') this.objs.push(s.add.image(f.x, f.y + 10, 'siege_mid_barb', 5).setDisplaySize(96, 96).setDepth(actorDepth(f.y)));
      this.objs.push(s.add.text(f.x, f.y + 40, label, { fontFamily: FONT, fontSize: '13px', color: '#ffd28a', resolution: 2, stroke: '#1a120b', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.dmgText - 2).setName('defense-slot-' + k));
    }
    const n = D.archers[o.tier] + Math.max(0, o.muster);
    for (let i = 0; i < n; i++) this.addArcher(i, n);
    this.bars = s.add.graphics().setDepth(DEPTH.dmgText - 1).setName('defense-bars'); this.objs.push(this.bars);
    this.hud = s.add.text(GAME_WIDTH / 2, 78, '', { fontFamily: FONT, fontSize: '15px', color: '#ffd98a', resolution: 2, stroke: '#1a120b', strokeThickness: 4, align: 'center' }).setOrigin(.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('defense-hud');
    this.objs.push(this.hud);
    this.spaceKey = s.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }
  get keepPos() { return { x: this.o.start.x + DEFENSE.keep.x, y: this.o.start.y + DEFENSE.keep.y }; }
  get gatePos() { return { x: this.o.gateX, y: this.o.wallLine }; }
  /** 部曲守门（默认开）：守在城门内，面朝城外。 */
  gateGuard = true; private guardSet = false;
  setGateGuard(on: boolean): void { this.gateGuard = on; this.guardSet = true; this.h.guardGate?.(on ? { x: this.o.gateX, y: this.o.wallLine + 80, facing: -Math.PI / 2 } : null); }
  /** 敌营刷兵口（墙外北面三处）。 */
  spawnPoint(): { x: number; y: number } { const S = DEFENSE.spawn, x = S.xs[Math.floor(Math.random() * S.xs.length)]; return { x: this.o.start.x + x + (Math.random() - .5) * 2 * S.jitter, y: this.o.start.y + S.y + (Math.random() - .5) * 120 }; }
  /** 攻城主将出场点：墙外正北、对着城门。 */
  bossPoint(): { x: number; y: number } { return { x: this.o.gateX, y: this.o.start.y + DEFENSE.spawn.y + 200 }; }
  /** 喘息中：场景不刷兵。 */
  get resting(): boolean { return this.phase === 'rest'; }
  private outside(y: number): boolean { return y < this.o.wallLine - 4; }

  private addArcher(i: number, n: number): void {
    const s = this.h.scene, span = 900, x = this.o.gateX - span / 2 + (n > 1 ? span * i / (n - 1) : span / 2) + (Math.abs(i - (n - 1) / 2) < .6 ? 90 : 0), y = this.o.wallLine + 34;
    const tex = s.textures.exists('shu_archer_walk_sheet') ? 'shu_archer_walk_sheet' : 'arrow';
    const img = s.add.image(x, y, tex, 0).setOrigin(.5, .85).setScale(.5).setDepth(actorDepth(y) + 1).setName('defense-archer');
    this.archers.push({ img, x, y, hp: DEFENSE.archerHp, next: this.h.now() + 600 + i * 230 });
  }

  update(dt: number): void {
    if (this.done) return;
    const D = DEFENSE, now = this.h.now(), el = this.h.elapsed(), cyc = D.attackSec + D.restSec;
    // 段落：前 n−1 波是「攻 → 喘息」，末波只有攻
    const idx = Math.min(this.waves - 1, Math.floor(el / cyc)), within = el - idx * cyc;
    const phase: Phase = idx >= this.waves - 1 ? 'final' : within < D.attackSec ? 'attack' : 'rest';
    this.wave = idx; this.phase = phase;
    const key = phase + idx;
    if (key !== this.lastPhase) { this.lastPhase = key; this.enterPhase(phase, idx); }
    if (!this.guardSet) { this.setGateGuard(true); this.h.banner('部曲守城门', false, '喘息布防时可改为随主将'); }
    { const P = this.h.player(), R = DEFENSE.rampart, on = P.y > this.o.wallLine + R.top - 10 && P.y < this.o.wallLine + R.bottom + 10; if (on !== this.onRampart) { this.onRampart = on; this.h.rampart?.(on ? 1 + R.rangeBonus : 1); } }
    if (!this.h.paused()) {
      this.fireArchers(now);
      this.useFacilities(now);
      this.updateEngines(now);
      this.updateRolling(now); this.updateBurning(now);
      if (phase === 'rest') this.channelRepair(dt);
    }
    if (phase === 'rest' && this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.skipRest();
    if (!this.gate.open && this.gate.hp <= 0) { this.gate.open = true; this.gate.hp = 0; this.h.openGate(); this.h.banner('城门被破！', true, '敌军涌进瓮城——守住府衙'); this.h.sfx('gong'); }
    if (this.keep.hp <= 0) { this.done = true; this.h.lose(); return; }
    if (phase === 'final' && el >= this.starts[this.waves - 1] + D.finalSec) { this.done = true; this.h.win(); return; }
    this.paint(el);
  }

  private enterPhase(p: Phase, i: number): void {
    this.stats.phaseLog.push(p + (i + 1));
    this.ui?.destroy(); this.ui = null;
    if (p === 'rest') { this.freeRepairUsed = false; this.channel = 0; this.h.banner(`第 ${i + 1} 波击退 · 喘息`, false, '修城门、补设施、补弓手（随军粮）· Space 跳过'); this.openPrep(); return; }
    this.h.banner(p === 'final' ? '末波 · 敌将来攻' : `第 ${i + 1}/${this.waves} 波 · 攻城`, true, p === 'final' ? '守住城门，击败攻城主将' : i === 0 ? '守住城门；府衙被破即失守' : '敌军再次攻城');
    // 中档起：每波来冲车、云梯
    const D = DEFENSE, rams = D.rams[this.o.dtier] ?? 0, ladders = D.ladders[this.o.dtier] ?? 0;
    for (let k = 0; k < rams; k++) this.h.scene.time.delayedCall(4000 + k * 9000, () => this.spawnRam());
    for (let k = 0; k < ladders; k++) this.h.scene.time.delayedCall(9000 + k * 7000, () => this.spawnLadder());
  }

  // ———— 城头弓手 ————
  private fireArchers(now: number): void {
    const D = DEFENSE, s = this.h.scene, dmg = D.archerDamage * Math.sqrt(Math.max(1, this.h.hpScale()));
    for (const a of this.archers) {
      if (a.hp <= 0 || now < a.next) continue;
      // 先射砍城门的（门前 gateFocus 以内），没有再射最近的
      let best: Enemy | null = null, bd: number = D.archerRange, focus: Enemy | null = null, fd = Infinity;
      for (const e of this.h.enemies()) { if (!e.active || e.isSupplySlot || e.hp <= 0) continue; const d = Math.hypot(e.x - a.x, e.y - a.y); if (d > D.archerRange) continue; if (d < bd) { bd = d; best = e; } const g = Math.hypot(e.x - this.o.gateX, e.y - this.o.wallLine); if (!this.gate.open && g < D.gateFocus && g < fd) { fd = g; focus = e; } }
      best = focus ?? best;
      if (!best) continue;
      a.next = now + D.archerMs; this.stats.archerShots++;
      const t = best, life = t.spawnId, arrow = s.add.image(a.x, a.y - 30, 'arrow').setDisplaySize(26, 5).setRotation(Math.atan2(t.y - a.y + 30, t.x - a.x)).setTint(0xffe0a3).setDepth(DEPTH.projectile);
      s.tweens.add({ targets: arrow, x: t.x, y: t.y - 10, duration: 260, onComplete: () => { arrow.destroy(); if (t.active && t.spawnId === life) this.h.hit(t, dmg); } });
    }
    // 爬上城头的敌兵会砍弓手
    for (const a of this.archers) if (a.hp > 0) for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && !this.outside(e.y) && Math.hypot(e.x - a.x, e.y - a.y) < 46) { a.hp -= e.def.damage * .02; if (a.hp <= 0) { a.img.setAlpha(.35).setTint(0x664444); this.h.banner('城头弓手阵亡', true, '喘息时可以补弓手'); } }
  }

  // ———— 城防设施 ————
  private useFacilities(now: number): void {
    const P = this.h.player(), L = DEFENSE.logs, O = DEFENSE.oil, f = this.facility;
    if (f.logs.charges > 0 && now >= f.logs.cd && Math.hypot(P.x - f.logs.x, P.y - f.logs.y) <= L.reach) {
      f.logs.charges--; f.logs.cd = now + L.cdMs; this.stats.logs++;
      const s = this.h.scene, img = s.add.image(f.logs.x, this.o.wallLine - 60, s.textures.exists('siege_mid_barb') ? 'siege_mid_barb' : 'arrow', 5).setDisplaySize(110, 110).setDepth(actorDepth(this.o.wallLine) + 1).setName('defense-log');
      this.rolling = { img, t0: now, x0: f.logs.x, dir: Math.random() < .5 ? -1 : 1, hit: new Set() };
      this.h.banner('滚木！', false, `沿墙脚滚过去 · 剩 ${f.logs.charges} 次`); this.h.sfx('gong');
    }
    if (f.oil.charges > 0 && now >= f.oil.cd && Math.hypot(P.x - f.oil.x, P.y - f.oil.y) <= O.reach) {
      f.oil.charges--; f.oil.cd = now + O.cdMs; this.stats.oil++;
      const s = this.h.scene, fires: Phaser.GameObjects.Sprite[] = [];
      if (s.textures.exists('ground_fire')) for (const dx of [-80, 0, 80]) { const sp = s.add.sprite(this.o.gateX + dx, this.o.wallLine - 50, 'ground_fire', 0).setOrigin(.5, .85).setDisplaySize(120, 120).setDepth(actorDepth(this.o.wallLine - 50) + .05).setName('defense-oil'); fires.push(sp); }
      this.burning = { until: now + O.tickMs * O.ticks, next: now, fires };
      this.h.banner('热油！', false, `门前一片持续烧 · 剩 ${f.oil.charges} 次`);
    }
  }
  private updateRolling(now: number): void {
    const r = this.rolling; if (!r) return; const L = DEFENSE.logs, k = (now - r.t0) / L.rollMs;
    if (k >= 1) { r.img.destroy(); this.rolling = null; return; }
    const x = r.x0 + r.dir * 700 * k; r.img.setPosition(x, this.o.wallLine - 60).setRotation(k * 12 * r.dir);
    for (const e of this.h.enemies()) if (e.active && !r.hit.has(e) && e.y < this.o.wallLine && e.y > this.o.wallLine - L.band && Math.abs(e.x - x) < 60) { r.hit.add(e); this.h.hit(e, L.damage * Math.sqrt(Math.max(1, this.h.hpScale()))); }
  }
  private updateBurning(now: number): void {
    const b = this.burning; if (!b) return; const O = DEFENSE.oil;
    b.fires.forEach((f, i) => f.setFrame(Math.floor(now / 120 + i) % 8));
    if (now >= b.until) { for (const f of b.fires) f.destroy(); this.burning = null; return; }
    if (now < b.next) return; b.next = now + O.tickMs;
    const cx = this.o.gateX, cy = this.o.wallLine - 50;
    for (const e of this.h.enemies()) if (e.active && e.hp > 0 && Math.hypot(e.x - cx, (e.y - cy) * 1.4) <= O.radius) this.h.hit(e, O.damage * (this.engines.some(g => g.e === e) ? O.engineMul : 1) * Math.sqrt(Math.max(1, this.h.hpScale())));
  }

  // ———— 攻城器械 ————
  private spawnRam(): void {
    if (this.done || this.gate.open) return; const D = DEFENSE, s = this.h.scene, x = this.o.gateX + (Math.random() - .5) * 120, y = this.o.start.y + D.spawn.y + 120;
    const e = this.h.spawnTarget(x, y, Math.round(D.ramHp * Math.sqrt(Math.max(1, this.h.hpScale()))), 170, s.textures.exists('siege_mid_ram') ? 'siege_mid_ram' : 'sishui_props_refined', 0); if (!e) return;
    const label = s.add.text(x, y - 150, '冲车', { fontFamily: FONT, fontSize: '15px', color: '#ff9c80', resolution: 2, stroke: '#1a0806', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defense-ram-label');
    this.engines.push({ e, life: e.spawnId, kind: 'ram', x, y, next: 0, label }); this.stats.rams++;
    this.h.banner('冲车来了！', true, '先拆冲车——撞门很疼（热油加倍伤害）');
  }
  private spawnLadder(): void {
    if (this.done) return; const D = DEFENSE, s = this.h.scene, x = this.o.gateX + (Math.random() < .5 ? -1 : 1) * (240 + Math.random() * 300), y = this.o.wallLine - 40;
    const warn = s.add.graphics().setDepth(DEPTH.fx).setName('defense-ladder-warn'); warn.lineStyle(3, 0xff7a5a, .9).strokeEllipse(x, y, 110, 46);
    s.tweens.add({ targets: warn, alpha: .3, duration: 300, yoyo: true, repeat: Math.ceil(D.ladderWarnMs / 600) });
    s.time.delayedCall(D.ladderWarnMs, () => {
      warn.destroy(); if (this.done) return;
      // 云梯新图待出（Gemini）：先借城内图集的马道斜坡当梯子
      const e = this.h.spawnTarget(x, y + 10, Math.round(D.ladderHp * Math.sqrt(Math.max(1, this.h.hpScale()))), 140, s.textures.exists('def_ladder') ? 'def_ladder' : 'siege_mid_city', s.textures.exists('def_ladder') ? 0 : 4); if (!e) return;
      const label = s.add.text(x, y - 120, '云梯', { fontFamily: FONT, fontSize: '15px', color: '#ff9c80', resolution: 2, stroke: '#1a0806', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.dmgText - 1).setName('defense-ladder-label');
      this.engines.push({ e, life: e.spawnId, kind: 'ladder', x, y, next: this.h.now() + D.climbMs, label, up: true }); this.stats.ladders++;
      this.h.banner('云梯架上城墙！', true, '打掉云梯才不再有人爬上城头');
    });
  }
  private updateEngines(now: number): void {
    const D = DEFENSE;
    const rest = this.phase === 'rest'; // 喘息：冲车停撞、云梯不再上人（只拆它们）
    for (const g of [...this.engines]) {
      if (!g.e.active || g.e.spawnId !== g.life || g.e.hp <= 0) { g.label.destroy(); this.engines.splice(this.engines.indexOf(g), 1); this.h.banner(g.kind === 'ram' ? '冲车被毁' : '云梯被打掉', false); continue; }
      if (g.kind === 'ram') {
        const ty = this.o.wallLine - 70;
        if (g.y < ty) { g.y = Math.min(ty, g.y + D.ramSpeed * (this.h.scene.game.loop.delta / 1000)); g.e.sprite.setPosition(g.x, g.y).setDepth(actorDepth(g.y)); g.label.setPosition(g.x, g.y - 150); }
        else if (!rest && !this.gate.open && now >= g.next) { g.next = now + D.ramMs; this.gate.hp -= D.ramDamage; this.stats.gateHits++; this.h.sfx('bossHit'); g.e.sprite.setFrame(Math.floor(now / 200) % 4); this.h.scene.cameras.main.shake(90, .002); }
      } else if (!rest && now >= g.next) {
        g.next = now + D.climbMs; const c = this.h.spawn('infantry', g.x + (Math.random() - .5) * 30, this.o.wallLine + 50); if (c) this.stats.climbers++;
      }
    }
  }

  // ———— 喘息 · 布防 ————
  private openPrep(): void {
    const s = this.h.scene, P = DEFENSE.prep, W = GAME_WIDTH, y = GAME_HEIGHT - 120;
    const root = s.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.hud + 3).setName('defense-prep'); this.ui = root;
    const bg = s.add.rectangle(W / 2, y, 560, 92, 0x120c08, .82).setStrokeStyle(1.5, 0xc9a35d, .9); root.add(bg);
    const head = s.add.text(W / 2, y - 30, '', { fontFamily: FONT, fontSize: '14px', color: '#f0d79e', resolution: 2 }).setOrigin(.5).setName('defense-prep-head'); root.add(head);
    const btn = (x: number, label: string, cost: number, name: string, fn: () => boolean) => {
      const b = s.add.rectangle(x, y + 12, 160, 40, 0x5a1f14, .95).setStrokeStyle(1.2, 0xf0c070).setInteractive({ useHandCursor: true }).setName(name);
      const t = s.add.text(x, y + 12, `${label} · ${cost} 粮`, { fontFamily: FONT, fontSize: '14px', color: '#ffe9bd', resolution: 2 }).setOrigin(.5);
      b.on('pointerup', () => { if (this.h.spend(cost) && fn()) this.h.sfx('uiClick'); else this.h.sfx('playerHurt'); });
      root.add([b, t]);
    };
    btn(W / 2 - 180, '修城门 +25%', P.repairCost, 'defense-prep-repair', () => { if (this.gate.open) return false; this.gate.hp = Math.min(this.gate.max, this.gate.hp + this.gate.max * P.repair); this.stats.repairs++; return true; });
    btn(W / 2, '补滚木 / 热油', P.refillCost, 'defense-prep-refill', () => { this.facility.logs.charges++; this.facility.oil.charges++; return true; });
    // 部曲守门 / 随主将：一行字签（不另加按钮）
    const gg = s.add.text(W / 2, y + 40, '', { fontFamily: FONT, fontSize: '12px', color: '#e8d3a6', resolution: 2 }).setOrigin(.5).setName('defense-prep-guard').setInteractive({ useHandCursor: true });
    const ggPaint = () => gg.setText(this.gateGuard ? '部曲 · 守城门（点此改为随主将）' : '部曲 · 随主将（点此改为守城门）');
    gg.on('pointerup', () => { this.setGateGuard(!this.gateGuard); ggPaint(); this.h.sfx('uiClick'); }); ggPaint(); root.add(gg);
    btn(W / 2 + 180, '补城头弓手', P.archerCost, 'defense-prep-archer', () => { const dead = this.archers.find(a => a.hp <= 0); if (dead) { dead.hp = DEFENSE.archerHp; dead.img.setAlpha(1).clearTint(); return true; } return false; });
    const tick = () => { if (!root.active) return; head.setText(`喘息 · 布防　随军粮 ${Math.floor(this.h.food())}　·　站在城门内读条免费修一点　·　Space 跳过`); };
    tick(); const ev = s.time.addEvent({ delay: 500, loop: true, callback: tick, callbackScope: this }); root.once('destroy', () => ev.remove());
  }
  private channelRepair(dt: number): void {
    if (this.freeRepairUsed || this.gate.open) return; const P = this.h.player(), D = DEFENSE.prep;
    const near = Math.abs(P.x - this.o.gateX) < D.freeReach && P.y > this.o.wallLine && P.y < this.o.wallLine + D.freeReach * 1.6;
    this.channel = near ? this.channel + dt * 1000 : 0;
    if (this.channel >= D.channelMs) { this.freeRepairUsed = true; this.gate.hp = Math.min(this.gate.max, this.gate.hp + this.gate.max * D.freeRepair); this.stats.repairs++; this.h.banner('城门补好了一些', false, `+${Math.round(D.freeRepair * 100)}%`); }
  }
  skipRest(): void { if (this.phase !== 'rest') return; this.h.skipTo(this.starts[this.wave + 1]); }

  // ———— 敌兵 / 首领步进（场景 customEnemyStep / customBossStep 转来）————
  /** 城外近战：去城门砍门（门破了就穿过门洞）；城内、离主将远的：去打府衙。远程照原样（隔墙放箭）。 */
  step(e: Enemy, dt: number): boolean {
    const D = DEFENSE, P = this.h.player();
    if (this.outside(e.y)) {
      if (isRangedSpawn(e.kind, e.def)) return false;
      const spread = ((e.spawnId % 9) - 4) * 22, gx = this.o.gateX + spread, gy = this.gate.open ? this.o.wallLine + 80 : this.o.wallLine - 46;
      const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
      if (!this.gate.open && d <= D.gateReach + 60 && !this.slot(this.atGate, e, D.gateCap) && d > D.gateReach) { e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; } // 门前挤满了：在后面等
      if (!this.gate.open && d <= D.gateReach) { if (!this.slot(this.atGate, e, D.gateCap)) { e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; } this.atGate.set(e, this.h.now()); this.gate.hp -= e.def.damage * D.contactMul * dt; this.stats.gateHits++; e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
      e.moveVx = dx / d * e.def.speed; e.moveVy = dy / d * e.def.speed; this.h.advance(e, dx / d, dy / d, dt); return true;
    }
    const K = this.keepPos, pd = Math.hypot(P.x - e.x, P.y - e.y);
    if (pd <= D.raidDist) return false;
    // 城门还没破：爬上城头的兵去城门内侧砍门（想从里面开门），不直奔府衙
    if (!this.gate.open) { const gx = this.o.gateX + ((e.spawnId % 5) - 2) * 24, gy = this.o.wallLine + 40, dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
      if (d <= D.gateReach && this.slot(this.atGate, e, D.gateCap)) { this.atGate.set(e, this.h.now()); this.gate.hp -= e.def.damage * D.contactMul * dt; this.stats.gateHits++; e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
      if (d <= D.gateReach) { e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
      e.moveVx = dx / d * e.def.speed; e.moveVy = dy / d * e.def.speed; this.h.advance(e, dx / d, dy / d, dt); return true; }
    const dx = K.x - e.x, dy = K.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d <= D.keepReach || boxDist(this.keepBox, e.x, e.y) <= e.radius + 26) { if (this.slot(this.atKeep, e, D.keepCap)) { this.atKeep.set(e, this.h.now()); this.keep.hp -= e.def.damage * D.contactMul * dt; this.stats.keepHits++; } e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    e.moveVx = dx / d * e.def.speed; e.moveVy = dy / d * e.def.speed; this.h.advance(e, dx / d, dy / d, dt); return true;
  }
  /** 还有没有位子砍（已经在砍的算有）：最近 250 毫秒内贴上来过的算在砍。 */
  private slot(m: Map<Enemy, number>, e: Enemy, cap: number): boolean {
    const now = this.h.now(); if (m.has(e) && now - (m.get(e) ?? 0) < 250) return true;
    let n = 0; for (const [k, t] of m) { if (!k.active || now - t >= 250) m.delete(k); else n++; }
    return n < cap;
  }
  /** 攻城主将：门没破先来砍门（×bossMul），破了穿门洞进城，进城后照常（返回 false 交给原招式控制器）。 */
  bossStep(e: Enemy, dt: number): boolean {
    if (!this.outside(e.y)) return false;
    const D = DEFENSE, gx = this.o.gateX, gy = this.gate.open ? this.o.wallLine + 90 : this.o.wallLine - 50, dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
    if (!this.gate.open && d <= D.gateReach + 10) { this.gate.hp -= e.def.damage * D.contactMul * D.bossMul * dt; e.moveVx = e.moveVy = 0; this.h.advance(e, 0, 0, dt); return true; }
    e.moveVx = dx / d * e.def.speed; e.moveVy = dy / d * e.def.speed; this.h.advance(e, dx / d, dy / d, dt); return true;
  }

  private paint(el: number): void {
    const D = DEFENSE, g = this.bars.clear(), bar = (x: number, y: number, w: number, k: number, c: number) => { g.fillStyle(0x140a06, .85).fillRect(x - w / 2 - 1, y - 1, w + 2, 9).fillStyle(c, 1).fillRect(x - w / 2, y, w * Math.max(0, k), 7); };
    if (!this.gate.open) bar(this.o.gateX, this.o.wallLine - 150, 140, this.gate.hp / this.gate.max, 0xd8a03a);
    const K = this.keepPos; bar(K.x, K.y - 190, 160, this.keep.hp / this.keep.max, 0xd8432a);
    const cyc = D.attackSec + D.restSec, end = this.phase === 'final' ? this.starts[this.waves - 1] + D.finalSec : this.starts[this.wave] + (this.phase === 'rest' ? cyc : D.attackSec), left = Math.max(0, Math.ceil(end - el));
    const ph = this.phase === 'rest' ? '喘息' : this.phase === 'final' ? '末波' : '攻';
    this.hud.setText(`第 ${this.wave + 1}/${this.waves} 波 · ${ph} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}　城门 ${this.gate.open ? '已破' : Math.round(this.gate.hp / this.gate.max * 100) + '%'} · 府衙 ${Math.round(Math.max(0, this.keep.hp) / this.keep.max * 100)}%`);
  }
  /** 顶部守城状态行（横幅出现时场景让它先淡出）。 */
  get hudText(): Phaser.GameObjects.Text { return this.hud; }
  /** 测试 / 舆图用。 */
  snapshot() { return { phase: this.phase, wave: this.wave, waves: this.waves, gate: Math.round(this.gate.hp), gateMax: this.gate.max, gateOpen: this.gate.open, keep: Math.round(this.keep.hp), keepMax: this.keep.max, archers: this.archers.filter(a => a.hp > 0).length, engines: this.engines.map(g => g.kind), charges: { logs: this.facility.logs.charges, oil: this.facility.oil.charges }, stats: { ...this.stats, phaseLog: [...this.stats.phaseLog] } }; }
  get facilities() { return { logs: { x: this.facility.logs.x, y: this.facility.logs.y }, oil: { x: this.facility.oil.x, y: this.facility.oil.y } }; }
  clear(): void { if (this.onRampart) this.h.rampart?.(1); if (this.gateGuard) this.h.guardGate?.(null); this.done = true; for (const o of this.objs) o.destroy(); for (const a of this.archers) a.img.destroy(); for (const g of this.engines) g.label.destroy(); this.ui?.destroy(); this.rolling?.img.destroy(); for (const f of this.burning?.fires ?? []) f.destroy(); this.objs = []; this.archers = []; this.engines = []; }
}
