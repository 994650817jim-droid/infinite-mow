import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { DEPTH } from '../config';
import { YS } from '../data/bossRedesign';
import { ArcBossV2, type ArcHost } from './ArcBossV2';
import { ensureMoves, type BossDebug } from './BossKit';
import { groundCracks } from '../ui/Telegraph';
import { bossFxImage, ensureBossFx, fxFrame, playBossFx } from './BossFx';
import { castFlourish } from './BossThemeFx';

type Move = 'flags' | 'coins' | 'guards';
interface Flag { e: Enemy; life: number; x: number; y: number; nextSpawn: number; label: Phaser.GameObjects.Text }
interface Coin { x: number; y: number; at: number; due: number; img?: Phaser.GameObjects.Image | null }

/**
 * 3-3 袁术「仲家天子」（重设计样板）：应对方式 = 清召唤 / 拆物件。
 *  玉玺号令：举玉玺 → 场上 3 处立「伪诏」旗，旗在就每 5 秒各召 2 兵；打掉旗子才停。
 *  金钱开路：撒一把金币 → 金光闪烁 1.5 秒 → 炸开（离开金光）。
 *  亲军护驾：亲军 6 人围成一圈，身边亲军 ≥3 人时袁术受伤 -60%，先清亲军。
 *  二阶段（30%）「蜜水」：袁术崩溃逃跑，沿途丢金币陷阱，限时 25 秒追杀；逃掉就回 15% 血并重召亲军。
 */
export class YuanshuBoss extends ArcBossV2<Move> {
  private flags: Flag[] = []; private coins: Coin[] = []; private guards: { e: Enemy; life: number }[] = [];
  private order = 0; private fleeUntil = 0; private fleeDone = false; private coinAt = 0;
  private propGfx: Phaser.GameObjects.Graphics;
  readonly metrics = { flags: 0, coins: 0, guards: 0, coinHits: 0, fled: 0, escaped: 0, flagSummons: 0, honeyCoins: 0 };
  readonly debug: BossDebug = {
    moves: ['玉玺号令', '金钱开路', '亲军护驾'],
    force: (i, now) => { this.beat.set(null, 'idle', now, 0); this.start((['flags', 'coins', 'guards'] as const)[i] ?? 'flags', now); },
    phase2: (now) => { const b = this.h.boss; if (b.hp > b.maxHp * YS.honey.at) b.hp = Math.floor(b.maxHp * YS.honey.at); this.enterHoney(now); },
  };
  constructor(h: ArcHost, tex: string, now: number) {
    super(h, tex, '袁术', now);
    this.propGfx = h.scene.add.graphics().setDepth(DEPTH.enemy + 1).setName('yuanshu-props');
    ensureMoves(h.scene, 'yuanshu_moves');
    ensureBossFx(h.scene, ['ys_coin', 'ys_flag', 'kit_shift', 'kit_recover']);
  }
  get guarded(): boolean { const b = this.h.boss; return this.aliveGuards().filter(g => Math.hypot(g.e.x - b.x, g.e.y - b.y) <= YS.guards.shieldRange).length >= YS.guards.minGuards; }
  protected takenMul(): number { return this.guarded ? YS.guards.takenMul : 1; }
  get label(): string {
    const now = this.kit.now;
    if (this.state === 'dead') return '袁术负伤退走';
    if (this.kit.inShift) return '拿蜜水来！';
    if (this.fleeUntil > now) return '蜜水 · 追杀 ' + Math.ceil((this.fleeUntil - now) / 1000) + ' 秒';
    const flags = this.flags.length ? ' · 伪诏 ' + this.flags.length : '', guard = this.guarded ? ' · 亲军护驾（先清亲军）' : '';
    const m = this.beat.move, names: Record<Move, string> = { flags: '玉玺号令', coins: '金钱开路', guards: '亲军护驾' };
    return (this.beat.phase === 'recover' ? '收势 · 反击机会' : m ? names[m] + (this.beat.phase === 'windup' ? ' · 起手' : '') : '仲家天子') + flags + guard;
  }

  update(dt: number, now: number): void {
    const b = this.h.boss; if (this.gone || !b.active || this.state === 'dead') return;
    this.kit.update(now); this.gfx.clear(); this.updateProps(now); this.art(now);
    if (!this.fleeDone && !this.phase2 && b.hp <= b.maxHp * YS.honey.at) this.enterHoney(now);
    if (this.kit.inShift) { this.pose(25, now); return; }
    if (this.fleeUntil > now) { this.flee(dt, now); return; }
    if (this.fleeUntil && !this.fleeDone) this.escape(now);
    const B = this.beat, prog = B.progress(now), p = this.h.player;
    this.angle = Math.atan2(p.y - b.y, p.x - b.x);
    if (B.phase === 'idle') { this.state = 'approach'; this.walk(dt, now, 170); if (now >= this.next) this.start(this.pick(), now); return; }
    if (B.phase === 'windup') {
      this.state = 'warn'; this.pose(B.move === 'coins' ? 17 : 24, now); this.kit.pose(B.move === 'coins' ? 'rear' : 'cast', prog);
      if (B.move === 'flags') this.seal(now, prog);
      if (B.done(now)) this.release(now);
      return;
    }
    if (B.phase === 'release') { this.state = 'attack'; this.pose([18, 19, 20, 22, 23][Math.min(4, Math.floor(B.age(now) / 120))], now); this.kit.pose('lean', 1 - prog); if (B.done(now)) this.toRecover(now, B.move === 'coins' ? YS.coins.recoverMs : B.move === 'flags' ? YS.flags.recoverMs : YS.guards.recoverMs); return; }
    this.pose(23, now); if (B.done(now)) this.toIdle(now, this.phase2 ? YS.gapMs2 : YS.gapMs);
  }

  private pick(): Move {
    const cycle: Move[] = ['flags', 'coins', 'guards', 'coins'];
    for (let i = 0; i < cycle.length; i++) {
      const m = cycle[this.order++ % cycle.length];
      if (m === 'flags' && this.flags.length >= YS.flags.cap) continue;
      if (m === 'guards' && this.aliveGuards().length >= YS.guards.minGuards) continue;
      return m;
    }
    return 'coins';
  }
  private start(move: Move, now: number): void {
    const ms = move === 'flags' ? YS.flags.windupMs : move === 'coins' ? YS.coins.windupMs : YS.guards.windupMs;
    castFlourish(this.h.scene, 'yuanshu', this.h.boss, ms, move === 'coins');
    this.beat.set(move, 'windup', now, ms); this.h.sfx(move === 'coins' ? 'chargeWarn' : 'bossSummon');
    if (move === 'flags') this.h.banner('玉玺号令', '打掉「伪诏」旗，援兵才会停');
  }
  private release(now: number): void {
    const b = this.h.boss, p = this.h.player, m = this.beat.move!;
    if (m === 'flags') {
      this.metrics.flags++;
      const n = Math.min(YS.flags.count, YS.flags.cap - this.flags.length), a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI * 2 / n, x = p.x + Math.cos(a) * YS.flags.ring, y = p.y + Math.sin(a) * YS.flags.ring * .8;
        const e = this.spawnProp(x, y, YS.flags.hp, 0xffd36b);
        if (e) this.flags.push({ e, life: e.spawnId, x, y, nextSpawn: now + 1500, label: this.h.scene.add.text(x, y - 76, '伪诏', { fontFamily: 'serif', fontSize: '13px', color: '#ffe7a8', stroke: '#1a1310', strokeThickness: 3 }).setOrigin(.5).setDepth(DEPTH.enemy + 2) });
      }
    } else if (m === 'coins') {
      this.metrics.coins++;
      for (let i = 0; i < YS.coins.count; i++) {
        const a = Math.random() * Math.PI * 2, r = i === 0 ? 30 : YS.coins.min + Math.random() * (YS.coins.max - YS.coins.min);
        this.coins.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * .8, at: now, due: now + YS.coins.fuseMs + i * 60 });
      }
      this.h.sfx('allySlash');
    } else {
      this.metrics.guards++; this.summonGuards();
    }
    void b; this.beat.set(m, 'release', now, 600);
  }
  private summonGuards(): void {
    const b = this.h.boss;
    this.guards = this.aliveGuards();
    for (let i = 0; i < YS.guards.count; i++) { const a = i * Math.PI * 2 / YS.guards.count, e = this.h.spawn('shield', b.x + Math.cos(a) * YS.guards.ring, b.y + Math.sin(a) * YS.guards.ring); if (e) this.guards.push({ e, life: e.spawnId }); }
  }
  private aliveGuards(): { e: Enemy; life: number }[] { return this.guards.filter(g => g.e.active && g.e.spawnId === g.life); }

  /** 招式图集帧。 */
  private art(now: number): void {
    const B = this.beat, p = this.h.player, b = this.h.boss, dir = p.x < b.x ? -1 : 1, K = 'yuanshu_moves', prog = B.progress(now);
    let f = -1;
    // 起手：玉玺 0–1 / 甩袖 2–3；出手：撒钱 4–5 / 指挥 6–7；收招 8–11；蜜水：瘫坐 12、逃跑 13
    if (this.kit.inShift) f = 12;
    else if (this.fleeUntil > now) f = 13;
    else if (B.phase === 'windup') f = B.move === 'coins' ? 2 + Math.min(1, Math.floor(prog * 2)) : Math.min(1, Math.floor(prog * 2));
    else if (B.phase === 'release') f = B.move === 'coins' ? 4 + Math.min(1, Math.floor(prog * 2)) : 6 + Math.min(1, Math.floor(prog * 2));
    else if (B.phase === 'recover') f = 8 + Math.min(3, Math.floor(prog * 4));
    if (f >= 0) this.kit.move(K, f, dir);
  }

  // ---------- 二阶段：蜜水 ----------
  private enterHoney(now: number): void {
    if (this.phase2) return;
    this.phase2 = true; this.metrics.fled++; this.beat.set(null, 'idle', now, 0);
    this.kit.phaseShift(now, '拿蜜水来！', '二阶段 · 袁术逃跑：25 秒内追上他', 0x3a2410, .14);
    this.fleeUntil = now + 1500 + YS.honey.fleeMs; this.coinAt = now + 1500;
  }
  private flee(dt: number, now: number): void {
    const b = this.h.boss, p = this.h.player, dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    // 背离主将跑；太远就绕着走，不跑出画面
    const away = d < 420 ? 1 : 0, tx = -dy / d, ty = dx / d, sp = b.def.speed * YS.honey.speedMul * dt;
    b.sprite.x += (dx / d * away + tx * (1 - away * .4)) * sp; b.sprite.y += (dy / d * away + ty * (1 - away * .4)) * sp;
    this.angle = Math.atan2(dy, dx); this.state = 'approach';
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0; this.pose(dir * 4 + Math.floor(now / 90) % 4, now); this.kit.pose('lean', .6, dx < 0 ? -1 : 1);
    if (now >= this.coinAt) { this.coinAt = now + YS.honey.coinEveryMs; this.metrics.honeyCoins++; this.coins.push({ x: b.x, y: b.y, at: now, due: now + YS.coins.fuseMs }); }
  }
  private escape(now: number): void {
    const b = this.h.boss; this.fleeDone = true; this.fleeUntil = 0; this.metrics.escaped++;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * YS.honey.healPct); this.summonGuards();
    this.h.banner('袁术逃脱', '喝上蜜水 · 亲军再聚'); this.toIdle(now, 800);
  }

  // ---------- 物件 ----------
  private updateProps(now: number): void {
    const g = this.propGfx, p = this.h.player; g.clear();
    for (const f of [...this.flags]) {
      if (!f.e.active || f.e.spawnId !== f.life) { f.label.destroy(); this.flags.splice(this.flags.indexOf(f), 1); this.h.sfx('hitHeavy'); continue; }
      f.e.sprite.setAlpha(0);
      if (now >= f.nextSpawn) { f.nextSpawn = now + YS.flags.spawnEveryMs; for (let i = 0; i < YS.flags.spawnEach; i++) { this.h.spawn(i ? 'archer' : 'infantry', f.x + (i ? 26 : -26), f.y + 22); this.metrics.flagSummons++; } }
      // 像素旗：深色旗杆 + 黄底红边旗面，随风抖动
      const x = Math.round(f.x), y = Math.round(f.y), w = Math.sin(now / 140 + f.x) * 3;
      g.fillStyle(0x1a1310, 1).fillRect(x - 3, y - 72, 6, 74); g.fillStyle(0x6d4c33, 1).fillRect(x - 2, y - 70, 4, 70);
      g.fillStyle(0x1a1310, 1).fillRect(x + 1, y - 70, 34, 28); g.fillStyle(0xc0392b, 1).fillRect(x + 2, y - 68 + w * .3, 32, 24); g.fillStyle(0xf2c27a, 1).fillRect(x + 5, y - 65 + w * .3, 26 + Math.round(w), 18);
      g.fillStyle(0x1a1310, .35).fillEllipse(x, y + 2, 26, 8);
    }
    for (const c of [...this.coins]) {
      const prog = (now - c.at) / Math.max(1, c.due - c.at);
      if (now >= c.due) {
        c.img?.destroy();
        // 手绘金币：炸开 3–5；没图时用通用地动
        // 收敛（用户「首领的攻击特效也需要兼容适应」）：炸开从 3 倍半径缩到 2.4 倍、0.32 秒
        if (!playBossFx(this.h.scene, 'ys_coin', c.x, c.y, YS.coins.radius * 2.4, DEPTH.ground + 6, 3, 5, 320)) groundCracks(this.gfx, c.x, c.y, YS.coins.radius, 1, 0, Math.PI * 2, 0, true, 'slam');
        if (Math.hypot(p.x - c.x, p.y - c.y) <= YS.coins.radius + p.radius && p.takeDamage(YS.coins.damage, now)) this.metrics.coinHits++;
        this.h.army.hurtArea(c.x, c.y, YS.coins.radius, YS.coins.troopDamage, now);
        this.coins.splice(this.coins.indexOf(c), 1); continue;
      }
      // 金币是埋在地上的雷：贴地（原来和人物同层会盖住人）、缩到 2.2 倍半径、略调淡
      if (c.img === undefined) c.img = bossFxImage(this.h.scene, 'ys_coin', DEPTH.ground + 5)?.setPosition(c.x, c.y).setDisplaySize(YS.coins.radius * 2.2, YS.coins.radius * 2.2).setAlpha(.85) ?? null;
      // 手绘金币：地上闪烁 0–2，越接近爆炸闪得越快
      if (c.img) { c.img.setFrame(prog < .6 ? Math.floor(now / 220) % 2 : 2 - Math.floor(now / 90) % 2); continue; }
      groundCracks(this.gfx, c.x, c.y, YS.coins.radius, prog, 0, Math.PI * 2, 0, false, 'slam');
      // 占位（图到前）：方孔钱，越接近爆炸闪得越快
      const blink = Math.floor(now / (220 - 170 * prog)) % 2, x = Math.round(c.x), y = Math.round(c.y);
      g.fillStyle(0x1a1310, 1).fillRect(x - 7, y - 7, 14, 14); g.fillStyle(blink ? 0xffe7a8 : 0xf2c27a, 1).fillRect(x - 6, y - 6, 12, 12); g.fillStyle(0x1a1310, 1).fillRect(x - 2, y - 2, 4, 4);
    }
    if (this.guarded) { const b = this.h.boss; g.lineStyle(2, 0xf2c27a, .5); for (const gd of this.aliveGuards()) if (Math.hypot(gd.e.x - b.x, gd.e.y - b.y) <= YS.guards.shieldRange) g.lineBetween(b.x, b.y - 20, gd.e.x, gd.e.y - 14); }
  }
  /** 起手：玉玺金光（头顶一方像素印）。 */
  private seal(now: number, p: number): void {
    const b = this.h.boss, x = Math.round(b.x), y = Math.round(b.y - 104 - 8 * p);
    this.gfx.fillStyle(0x1a1310, 1).fillRect(x - 10, y - 10, 20, 20); this.gfx.fillStyle(0xf2c27a, .7 + .3 * Math.sin(now / 60)).fillRect(x - 8, y - 8, 16, 16); this.gfx.fillStyle(0xc0392b, 1).fillRect(x - 4, y - 4, 8, 8);
  }
  protected onDefeat(): void {
    for (const f of this.flags) { f.label.destroy(); if (f.e.active && f.e.spawnId === f.life) { f.e.hp = 0; f.e.deactivate(); } }
    this.flags = []; for (const c of this.coins) c.img?.destroy(); this.coins = []; if (!this.gone) this.propGfx.clear(); else this.propGfx.destroy();
  }
  snapshot() { return { move: this.beat.move, phase: this.beat.phase, phase2: this.phase2, fleeing: this.fleeUntil > this.kit.now, flags: this.flags.length, coins: this.coins.length, guards: this.aliveGuards().length, guarded: this.guarded, metrics: { ...this.metrics } }; }
}
