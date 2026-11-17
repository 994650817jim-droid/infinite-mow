import Phaser from 'phaser';
import { DEPTH } from '../config';
import { CR } from '../data/bossRedesign';
import { ArcBossV2, type ArcHost } from './ArcBossV2';
import type { BossDebug } from './BossKit';
import { bossFxImage, ensureBossFx } from './BossFx';

type Move = 'wall' | 'hold';
type Gate = 'live' | 'dead' | 'none';
/** 八门：休 生 伤 杜 景 死 惊 开（按顺时针排在八个方位）。 */
const GATE_NAMES = ['休', '生', '伤', '杜', '景', '死', '惊', '开'] as const;
/** 扇区起始偏 22.5°：阵盘图的卦位居中在正北，分界在 ±22.5°，让八门分界对上图里的辐条。 */
export const GATE_OFFSET = Math.PI / 8;

/**
 * 5-3 曹仁「八门金锁」（重设计样板）：应对方式 = 场地机制。
 *  八门金锁（常驻）：以曹仁为中心的阵分八门，1 个生门（绿）、3 个死门（红），每 10 秒轮转（提前 1.5 秒闪下一轮）。
 *                    站死门持续掉血；站生门时打曹仁伤害 +20%。
 *  铁壁：举盾 4 秒，正面几乎免伤，盾面慢慢转向主将 → 绕到背后打。
 *  坚守：4 名盾兵在曹仁与主将之间排成一道墙。
 *  二阶段（40%）「破阵」：八门 5 秒一转，只剩 1 个生门、4 个死门。
 */
export class CaorenBoss extends ArcBossV2<Move> {
  private gates: Gate[] = []; private nextGates: Gate[] = []; private cx = 0; private cy = 0; private rotateAt = 0; private tickAt = 0;
  private facing = 0; private order = 0; private lastAt = 0;
  private texts: Phaser.GameObjects.Text[] = []; private arena: Phaser.GameObjects.Graphics; private disc: Phaser.GameObjects.Image | null | undefined;
  readonly metrics = { rotations: 0, wall: 0, hold: 0, deadTicks: 0, frontBlocks: 0, phase2: 0 };
  readonly debug: BossDebug = {
    moves: ['铁壁', '坚守', '八门轮转'],
    force: (i, now) => { if (i === 2) { this.rotateAt = now; return; } this.beat.set(null, 'idle', now, 0); this.start((['wall', 'hold'] as const)[i] ?? 'wall', now); },
    phase2: (now) => { const b = this.h.boss; if (b.hp > b.maxHp * CR.phase2At) b.hp = Math.floor(b.maxHp * CR.phase2At); this.enterPhase2(now); },
  };
  constructor(h: ArcHost, tex: string, now: number) {
    super(h, tex, '曹仁', now);
    this.arena = h.scene.add.graphics().setDepth(DEPTH.ground + 3).setName('caoren-gates');
    ensureBossFx(h.scene, ['cr_bagua', 'kit_shift', 'kit_recover']);
    for (let i = 0; i < 8; i++) this.texts.push(h.scene.add.text(0, 0, '', { fontFamily: 'serif', fontSize: '20px', color: '#ffe7a8', stroke: '#1a1310', strokeThickness: 4 }).setOrigin(.5).setDepth(DEPTH.ground + 4));
    this.cx = h.boss.x; this.cy = h.boss.y; this.gates = this.roll(); this.nextGates = this.roll(); this.rotateAt = now + CR.gates.rotateMs; this.tickAt = now;
    this.next = now + 2500; h.banner('八门金锁', '站生门（绿）打曹仁，别站死门（红）');
  }
  private roll(): Gate[] {
    const G = CR.gates, dead = this.phase2 ? G.dead2 : G.dead, idx = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - .5), out: Gate[] = Array(8).fill('none');
    out[idx[0]] = 'live'; for (let i = 1; i <= dead; i++) out[idx[i]] = 'dead';
    return out;
  }
  private sectorOf(x: number, y: number): number { const a = Math.atan2((y - this.cy) / .8, x - this.cx) - GATE_OFFSET; return ((Math.floor((a + Math.PI) / (Math.PI / 4)) % 8) + 8) % 8; }
  private inArena(x: number, y: number): boolean { return Math.hypot(x - this.cx, (y - this.cy) / .8) <= CR.gates.radius; }
  get playerGate(): Gate { const p = this.h.player; return this.inArena(p.x, p.y) ? this.gates[this.sectorOf(p.x, p.y)] : 'none'; }
  /** 举盾时，主将在盾面正前方 → 几乎免伤；站生门 → +20%。 */
  private get front(): boolean { const b = this.h.boss, p = this.h.player; return this.beat.move === 'wall' && this.beat.phase === 'release' && Math.cos(Math.atan2(p.y - b.y, p.x - b.x) - this.facing) >= Math.cos(CR.wall.frontDeg * Math.PI / 360); }
  protected takenMul(): number { if (this.front) { this.metrics.frontBlocks++; return CR.wall.frontTakenMul; } return this.playerGate === 'live' ? CR.gates.liveTakenMul : 1; }
  get label(): string {
    const now = this.kit.now;
    if (this.state === 'dead') return '曹仁弃城北撤';
    if (this.kit.inShift) return '此阵何人可破！';
    const gate = this.playerGate, where = gate === 'live' ? ' · 你在生门（伤害提高）' : gate === 'dead' ? ' · 你在死门！快离开' : '';
    const turn = ' · ' + Math.max(0, Math.ceil((this.rotateAt - now) / 1000)) + ' 秒后轮转';
    const m = this.beat.move, names: Record<Move, string> = { wall: '铁壁 · 绕到背后', hold: '坚守' };
    return (this.beat.phase === 'recover' ? '收势 · 反击机会' : m ? names[m] : (this.phase2 ? '破阵' : '八门金锁')) + where + turn;
  }

  update(dt: number, now: number): void {
    const b = this.h.boss; if (this.gone || !b.active || this.state === 'dead') return;
    this.kit.update(now); this.gfx.clear();
    if (!this.phase2 && b.hp <= b.maxHp * CR.phase2At) this.enterPhase2(now);
    this.updateGates(now);
    if (this.kit.inShift) { this.pose(25, now); return; }
    const B = this.beat, prog = B.progress(now), p = this.h.player, want = Math.atan2(p.y - b.y, p.x - b.x);
    if (B.phase === 'idle') { this.state = 'approach'; this.angle = want; this.walk(dt, now, 140, .8); if (now >= this.next) this.start(this.order++ % 2 ? 'hold' : 'wall', now); return; }
    if (B.phase === 'windup') {
      this.state = 'warn'; this.angle = this.facing = want; this.pose(B.move === 'wall' ? 17 : 24, now); this.kit.pose(B.move === 'wall' ? 'crouch' : 'cast', prog);
      if (B.done(now)) this.release(now);
      return;
    }
    if (B.phase === 'release') {
      this.state = 'attack';
      if (B.move === 'wall') {
        // 盾面慢慢转向主将
        let d = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing)); const turn = CR.wall.turnPerSec * dt; d = Math.max(-turn, Math.min(turn, d)); this.facing += d; this.angle = this.facing;
        this.pose(17, now); this.kit.pose('crouch', .6); this.drawShield(now);
        if (B.done(now)) this.toRecover(now, CR.wall.recoverMs);
      } else { this.pose([18, 19, 20, 22, 23][Math.min(4, Math.floor(B.age(now) / 120))], now); if (B.done(now)) this.toRecover(now, CR.hold.recoverMs); }
      return;
    }
    this.pose(23, now); if (B.done(now)) this.toIdle(now, this.phase2 ? CR.gapMs2 : CR.gapMs);
  }
  private start(move: Move, now: number): void {
    if (move === 'wall') { this.metrics.wall++; this.beat.set('wall', 'windup', now, CR.wall.windupMs); this.h.sfx('chargeWarn'); }
    else { this.metrics.hold++; this.beat.set('hold', 'windup', now, CR.hold.windupMs); this.h.sfx('bossSummon'); }
  }
  private release(now: number): void {
    if (this.beat.move === 'wall') { this.beat.set('wall', 'release', now, CR.wall.holdMs); this.h.banner('铁壁', '正面刀枪不入 · 绕到背后'); return; }
    const b = this.h.boss, p = this.h.player, a = Math.atan2(p.y - b.y, p.x - b.x), H = CR.hold, mx = b.x + Math.cos(a) * H.ahead, my = b.y + Math.sin(a) * H.ahead;
    for (let i = 0; i < H.count; i++) { const o = (i - (H.count - 1) / 2) * H.spacing; this.h.spawn('shield', mx - Math.sin(a) * o, my + Math.cos(a) * o); }
    this.beat.set('hold', 'release', now, 600);
  }

  // ---------- 八门 ----------
  private updateGates(now: number): void {
    const G = CR.gates, every = this.phase2 ? G.rotateMs2 : G.rotateMs, p = this.h.player;
    if (now >= this.rotateAt) {
      this.metrics.rotations++; this.gates = this.nextGates; this.nextGates = this.roll(); this.rotateAt = now + every;
      this.h.sfx('gong');
    }
    // 阵心平滑跟着曹仁：生门 / 死门 = 站在曹仁的哪一侧
    { const b = this.h.boss, k = Math.min(1, (now - (this.lastAt || now)) / 1000 * 2.5); this.cx += (b.x - this.cx) * k; this.cy += (b.y - this.cy) * k; this.lastAt = now; }
    const warning = this.rotateAt - now <= G.warnMs;
    // 死门伤害：主将与部曲
    if (now >= this.tickAt) {
      this.tickAt = now + G.deadTickMs;
      if (this.playerGate === 'dead' && p.takeDamage(G.deadDamage, now)) this.metrics.deadTicks++;
      for (const u of this.h.army.grid.query(this.cx, this.cy, G.radius)) if (u.active && this.inArena(u.x, u.y) && this.gates[this.sectorOf(u.x, u.y)] === 'dead') this.h.army.hurtByBoss(u, G.deadDamage, now);
    }
    this.drawGates(now, warning);
  }
  /** 阵图：八条像素分界（方块虚线）+ 生门浅绿、死门暗红底；轮转前 1.5 秒下一轮的门闪烁。八门阵图素材到位后换图。 */
  private drawGates(now: number, warning: boolean): void {
    const g = this.arena, R = CR.gates.radius, step = Math.PI / 4; g.clear();
    // 手绘阵盘（图到后）：浮现 0–1 → 发光循环 2–4；扇区的生 / 死只用淡色铺底 + 门名
    if (!this.disc) this.disc = bossFxImage(this.h.scene, 'cr_bagua', DEPTH.ground + 2);
    if (this.disc) this.disc.setPosition(this.cx, this.cy).setDisplaySize(R * 2.3, R * 2.3 * .8).setFrame(2 + Math.floor(now / 200) % 3).setAlpha(.36);
    for (let i = 0; i < 8; i++) {
      const a0 = -Math.PI + i * step + GATE_OFFSET, a1 = a0 + step, kind = this.gates[i], nk = this.nextGates[i];
      const blink = warning && Math.floor(now / 160) % 2 === 0, show = blink ? nk : kind;
      if (show !== 'none') {
        const col = show === 'live' ? 0x5fae5a : 0xb8382a, al = show === 'live' ? .2 : .22;
        g.fillStyle(col, al);
        for (let k = 0; k < 6; k++) { const t0 = a0 + step * k / 6, t1 = a0 + step * (k + 1) / 6; g.fillTriangle(this.cx, this.cy, this.cx + Math.cos(t0) * R, this.cy + Math.sin(t0) * R * .8, this.cx + Math.cos(t1) * R, this.cy + Math.sin(t1) * R * .8); }
      }
      // 占位分界（阵盘图到之前）：每 18px 一个 4px 方块
      if (!this.disc) for (let r = 30; r <= R; r += 18) { const x = this.cx + Math.cos(a0) * r, y = this.cy + Math.sin(a0) * r * .8; g.fillStyle(0x1a1310, .55).fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); g.fillStyle(0xf2c27a, .6).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); }
      // 外缘：每 10° 一个方块
      if (!this.disc) for (let t = a0; t < a1; t += Math.PI / 18) { const x = this.cx + Math.cos(t) * R, y = this.cy + Math.sin(t) * R * .8; g.fillStyle(0xf2c27a, .45).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); }
      const mid = a0 + step / 2, tx = this.cx + Math.cos(mid) * R * .78, ty = this.cy + Math.sin(mid) * R * .78 * .8;
      this.texts[i].setPosition(tx, ty).setText(show === 'live' ? '生门' : show === 'dead' ? '死门' : GATE_NAMES[i]).setColor(show === 'live' ? '#c8f0b0' : show === 'dead' ? '#ffb3a0' : '#e8d7b0').setAlpha(show === 'none' ? .45 : 1).setFontSize(show === 'none' ? 15 : 20);
    }
  }
  /** 铁壁：盾面一排像素盾牌（深轮廓 + 铁灰面 + 金边），朝 facing。 */
  private drawShield(now: number): void {
    const b = this.h.boss, r = b.radius + 20, half = CR.wall.frontDeg * Math.PI / 360;
    for (let k = -3; k <= 3; k++) {
      const a = this.facing + half * k / 3.5, x = Math.round(b.x + Math.cos(a) * r), y = Math.round(b.y - 18 + Math.sin(a) * r * .8);
      this.gfx.fillStyle(0x1a1310, 1).fillRect(x - 7, y - 10, 14, 20); this.gfx.fillStyle(0x7d7468, 1).fillRect(x - 6, y - 9, 12, 18); this.gfx.fillStyle(0xf2c27a, .6 + .3 * Math.sin(now / 100 + k)).fillRect(x - 6, y - 9, 12, 3);
    }
  }
  private enterPhase2(now: number): void {
    if (this.phase2) return;
    this.phase2 = true; this.metrics.phase2++; this.beat.set(null, 'idle', now, 0);
    this.kit.phaseShift(now, '此阵何人可破！', '二阶段 · 破阵：5 秒一轮转，死门更多', 0x2a1608, .16);
    this.nextGates = this.roll(); this.rotateAt = now + 1500;
  }
  protected onDefeat(): void { this.disc?.destroy(); this.disc = null; this.arena.clear(); for (const t of this.texts) t.setVisible(false); if (this.gone) { this.arena.destroy(); for (const t of this.texts) t.destroy(); this.texts = []; } }
  snapshot() { return { move: this.beat.move, phase: this.beat.phase, phase2: this.phase2, gates: [...this.gates], playerGate: this.playerGate, front: this.front, metrics: { ...this.metrics } }; }
}
