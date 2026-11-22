import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { DEPTH } from '../config';
import { SMY } from '../data/beifaChapter';
import { ArcBossV2, type ArcHost } from './ArcBossV2';
import type { BossDebug } from './BossKit';
import type { Strikes } from './BeifaSystems';
import { warnFx } from '../ui/WarnFx';
import { playSheet } from './SkillFxSheets';
import { castFlourish, warmCast } from './BossThemeFx';

type Move = 'surround' | 'feint' | 'thunder';
export type SimayiPhase = 'hold' | 'battle' | 'omen';
export interface SimayiExtra {
  strikes: Strikes;
  /** 摆一顶营垒（可破坏物）；返回物件。 */
  placeFort: (x: number, y: number, i: number) => Enemy | null;
}

/**
 * 12-3 五丈原 · 司马懿（最终首领，三阶段）：
 *  ① 坚守不出：营垒环绕，营垒在时司马懿不出营、几乎不受伤；伏兵箭阵（地上手绘箭雨圈）定时落向主将，伏兵从四面杀出。拆光营垒 → ②。
 *  ② 出营决战：调兵合围（一圈魏兵围上来）、假退诱敌（司马懿后撤，追过去的路上落箭雨）、落雷阵（主将周围一圈落雷）。
 *  ③ 天象异变（生命 ≤ 35%）：天色转夜，将星坠落——陨星（手绘地动预警 + 爆炸序列帧）不停砸向主将附近；招式更勤。
 * 夜空是整屏压暗（界面层），预警 / 命中都是手绘序列帧，不画像素特效。
 */
export class SimayiBoss extends ArcBossV2<Move> {
  phase: SimayiPhase = 'hold';
  forts: Enemy[] = [];
  /** 每座营垒摆下时的 spawnId：物件槽打破后会被新物件复用（同一个 Enemy 又 active），只认摆下时那一条命，否则拆光了还算「营垒在」、司马懿不出营（2026-11-22，同夷陵 10-2）。 */
  private fortLife = new Map<Enemy, number>();
  fortUp(f: Enemy): boolean { return f.active && this.fortLife.get(f) === f.spawnId; }
  private volleyAt = 0; private ambushAt = 0; private meteorAt = 0; private order = 0;
  private feintFrom = { x: 0, y: 0 }; private night?: Phaser.GameObjects.Rectangle;
  readonly metrics = { volleys: 0, ambush: 0, surround: 0, feint: 0, thunder: 0, meteors: 0, fortsDown: 0 };
  readonly debug: BossDebug = {
    moves: ['调兵合围', '假退诱敌', '落雷阵'],
    force: (i, now) => { this.beat.set(null, 'idle', now, 0); this.start((['surround', 'feint', 'thunder'] as const)[i] ?? 'surround', now); },
    phase2: now => { for (const f of this.forts) if (this.fortUp(f)) f.deactivate(); this.toBattle(now); },
  };
  constructor(h: ArcHost, tex: string, now: number, private x: SimayiExtra) { warmCast(h.scene, 'simayi');
    super(h, tex, '司马懿', now);
    const b = h.boss;
    for (let i = 0; i < SMY.forts; i++) { const a = i / SMY.forts * Math.PI * 2 + Math.PI / 4, f = x.placeFort(b.x + Math.cos(a) * SMY.fortRadius, b.y + Math.sin(a) * SMY.fortRadius * .8, i); if (f) { this.forts.push(f); this.fortLife.set(f, f.spawnId); } }
    this.volleyAt = now + 2500; this.ambushAt = now + 6000; this.remindAt = now + 6000; // 先拆营垒提醒：首领登场题字过了再说
    h.banner('司马懿坚守不出', `营垒在时司马懿不出营 · 拆掉 ${this.forts.length} 座营垒`);
  }
  get fortsAlive(): number { return this.forts.filter(f => this.fortUp(f)).length; }
  private remindAt = 0;
  /** 坚守时受伤 ×fortTakenMul；被打时每 10 秒提醒一次先拆营垒（原来只有开场横幅和血条小字，打他半天不掉血不知道为什么）。 */
  protected takenMul(): number {
    const hold = this.phase === 'hold' && this.fortsAlive > 0;
    if (hold && this.kit.now >= this.remindAt) { this.remindAt = this.kit.now + 10000; this.h.banner('司马懿坚守营中', `先拆营垒（还剩 ${this.fortsAlive} 座）· 营垒在时打他只掉一成`); }
    return hold ? SMY.fortTakenMul : 1;
  }
  get label(): string {
    if (this.state === 'dead') return '司马懿退兵';
    if (this.phase === 'hold') return `坚守不出 · 营垒 ${this.fortsAlive}/${this.forts.length} · 拆光营垒逼他出营`;
    const m = this.beat.move, names: Record<Move, string> = { surround: '调兵合围 · 冲出包围', feint: '假退诱敌 · 别追太深', thunder: '落雷阵 · 离开雷光' };
    return (this.phase === 'omen' ? '天象异变 · 将星坠落 · ' : '出营决战 · ') + (this.beat.phase === 'recover' ? '收势 · 反击机会' : m ? names[m] : '司马懿');
  }
  private now(): number { return this.kit.now; }

  update(dt: number, now: number): void {
    const b = this.h.boss; if (this.gone || !b.active || this.state === 'dead') return;
    this.kit.update(now); this.gfx.clear();
    this.x.strikes.update();
    if (this.phase === 'hold') { this.updateHold(dt, now); return; }
    if (this.phase === 'battle' && b.hp <= b.maxHp * SMY.phase3At) this.toOmen(now);
    if (this.phase === 'omen' && now >= this.meteorAt) { this.meteorAt = now + SMY.meteorEveryMs; this.meteor(now); }
    if (this.kit.inShift) { this.pose(25, now); return; }
    const B = this.beat, p = this.h.player;
    if (B.phase === 'idle') {
      this.state = 'approach'; this.angle = Math.atan2(p.y - b.y, p.x - b.x); this.walk(dt, now, 160, .9);
      if (now >= this.next) this.start((['surround', 'feint', 'thunder'] as const)[this.order++ % 3], now);
      return;
    }
    if (B.phase === 'windup') { this.state = 'warn'; this.pose(24, now); this.kit.pose('cast', B.progress(now)); if (B.done(now)) this.release(now); return; }
    if (B.phase === 'release') {
      this.state = 'attack';
      if (B.move === 'feint') {
        // 后撤：背对主将跑开
        const a = Math.atan2(b.y - p.y, b.x - p.x); this.angle = a; b.sprite.x += Math.cos(a) * b.def.speed * SMY.feint.speedMul * dt; b.sprite.y += Math.sin(a) * b.def.speed * SMY.feint.speedMul * dt;
        this.pose((Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) < 0 ? 1 : 2) : Math.sin(a) < 0 ? 3 : 0) * 4 + Math.floor(now / 90) % 4, now);
        if (B.done(now)) { this.feintAmbush(); this.toRecover(now, 900); }
      } else { this.pose([18, 19, 20, 22, 23][Math.min(4, Math.floor(B.age(now) / 120))], now); if (B.done(now)) this.toRecover(now, 1000); }
      return;
    }
    this.pose(23, now); if (B.done(now)) this.toIdle(now, this.phase === 'omen' ? SMY.gapMs3 : SMY.gapMs);
  }

  // ---------- ① 坚守不出 ----------
  private updateHold(dt: number, now: number): void {
    void dt;
    const p = this.h.player, b = this.h.boss; this.state = 'approach';
    this.angle = Math.atan2(p.y - b.y, p.x - b.x); this.pose((Math.abs(p.x - b.x) > Math.abs(p.y - b.y) ? (p.x < b.x ? 1 : 2) : p.y < b.y ? 3 : 0) * 4, now);
    const down = this.forts.length - this.fortsAlive;
    if (down > this.metrics.fortsDown) { this.metrics.fortsDown = down; if (this.fortsAlive > 0) this.h.banner(`营垒 ${down}/${this.forts.length} 已破`, '司马懿仍坚守不出'); }
    if (this.fortsAlive === 0) { this.toBattle(now); return; }
    if (now >= this.volleyAt) {
      this.volleyAt = now + SMY.volleyEverySec * 1000; this.metrics.volleys++;
      for (let k = 0; k < SMY.volleyPoints; k++) { const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 70 + Math.random() * 120; this.x.strikes.add('arrows', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, SMY.volleyR, SMY.volleyWarnMs, SMY.playerRatio, SMY.allyDamage); }
      this.h.sfx('chargeWarn');
    }
    if (now >= this.ambushAt) {
      this.ambushAt = now + SMY.ambushEverySec * 1000; this.metrics.ambush++;
      const wf = warnFx(this.h.scene);
      for (let i = 0; i < SMY.ambushSize; i++) { const a = i / SMY.ambushSize * Math.PI * 2 + Math.random(), x = p.x + Math.cos(a) * 240, y = p.y + Math.sin(a) * 180; wf.ambush(x, y, 120); this.h.spawn(i % 2 ? 'archer' : 'infantry', x, y); }
      this.h.banner('伏兵四起', '营垒外伏兵杀出');
    }
  }
  private toBattle(now: number): void {
    if (this.phase !== 'hold') return;
    this.phase = 'battle'; this.phase2 = true; this.next = now + 2200; this.beat.set(null, 'idle', now, 0);
    this.kit.phaseShift(now, '出营决战', '营垒尽破 · 司马懿亲自出营', 0x8a6a3a, .1); this.h.sfx('bossSummon');
  }
  private toOmen(now: number): void {
    this.phase = 'omen'; this.meteorAt = now + 1500;
    this.kit.phaseShift(now, '天象异变', '将星坠落 · 陨星砸向战场', 0x1a2a5a, .12);
    const s = this.h.scene, cam = s.cameras.main;
    this.night = s.add.rectangle(cam.width / 2, cam.height / 2, cam.width * 3, cam.height * 3, 0x0a1430, 0).setScrollFactor(0).setDepth(DEPTH.fx + 2).setName('simayi-night');
    s.tweens.add({ targets: this.night, fillAlpha: .42, duration: 1600 });
  }

  // ---------- ② 出营决战 ----------
  private start(move: Move, now: number): void {
    const w = move === 'surround' ? SMY.surround.warnMs : move === 'thunder' ? 600 : 500;
    castFlourish(this.h.scene, 'simayi', this.h.boss, w, move === 'thunder');
    this.beat.set(move, 'windup', now, w); this.h.sfx(move === 'thunder' ? 'chargeWarn' : 'bossSummon');
    if (move === 'surround') { this.h.banner('调兵合围', '魏军四面围上来 · 冲出包围'); const p = this.h.player, wf = warnFx(this.h.scene); for (let i = 0; i < SMY.surround.count; i += 2) { const a = i / SMY.surround.count * Math.PI * 2; wf.ambush(p.x + Math.cos(a) * SMY.surround.radius, p.y + Math.sin(a) * SMY.surround.radius * .8, 110); } }
    if (move === 'feint') { this.h.banner('假退诱敌', '司马懿佯败后撤 · 追深了会中伏'); this.feintFrom = { x: this.h.boss.x, y: this.h.boss.y }; }
    if (move === 'thunder') {
      this.h.banner('落雷阵', '雷光落处快离开'); const p = this.h.player, T = SMY.thunder;
      for (let i = 0; i < T.count; i++) { const a = i / T.count * Math.PI * 2; this.x.strikes.add('lightning', p.x + Math.cos(a) * T.radius, p.y + Math.sin(a) * T.radius * .75, T.r, T.warnMs, SMY.playerRatio, SMY.allyDamage); }
      this.x.strikes.add('lightning', p.x, p.y, T.r, T.warnMs + 500, SMY.playerRatio, SMY.allyDamage);
    }
  }
  private release(now: number): void {
    const m = this.beat.move!, p = this.h.player;
    if (m === 'surround') { this.metrics.surround++; const S = SMY.surround; for (let i = 0; i < S.count; i++) { const a = i / S.count * Math.PI * 2; this.h.spawn(i % 3 === 2 ? 'archer' : 'infantry', p.x + Math.cos(a) * S.radius, p.y + Math.sin(a) * S.radius * .8); } this.beat.set(m, 'release', now, 500); return; }
    if (m === 'feint') { this.metrics.feint++; this.beat.set(m, 'release', now, SMY.feint.ms); return; }
    this.metrics.thunder++; this.beat.set(m, 'release', now, 700);
  }
  /** 假退收尾：主将追来的路上（司马懿原位 → 现位之间）落一排箭雨。 */
  private feintAmbush(): void {
    const b = this.h.boss, F = SMY.feint, p = this.h.player;
    for (let i = 0; i < F.arrows; i++) { const t = (i + .5) / F.arrows, x = Phaser.Math.Linear(p.x, b.x, t), y = Phaser.Math.Linear(p.y, b.y, t); this.x.strikes.add('arrows', x, y, F.r, F.warnMs, SMY.playerRatio, SMY.allyDamage); }
    this.h.banner('中伏', '追兵路上箭如雨下');
  }

  // ---------- ③ 天象异变 ----------
  private meteor(now: number): void {
    void now;
    const p = this.h.player, a = Math.random() * Math.PI * 2, r = Math.random() < .5 ? 0 : 60 + Math.random() * 140, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * .7;
    this.metrics.meteors++;
    this.x.strikes.add('meteor', x, y, SMY.meteorR, SMY.meteorWarnMs, SMY.meteorRatio, SMY.allyDamage * 1.5);
    // 将星划过：手绘疾风条从天上斜斜落向落点
    const sx = x - 260, sy = y - 420, ang = Math.atan2(y - sy, x - sx);
    playSheet(this.h.scene, 'fx_flank_streak', sx, sy, { size: 300, ms: SMY.meteorWarnMs, depth: DEPTH.fx + 3, rotation: ang, alpha: .9, tint: 0xbfd4ff, name: 'simayi-star',
      onUpdate: (img, t) => img.setPosition(Phaser.Math.Linear(sx, x, t), Phaser.Math.Linear(sy, y - 40, t)) });
  }

  protected onDefeat(): void { this.x.strikes.clear(); this.night?.destroy(); this.night = undefined; }
  snapshot() { return { phase: this.phase, forts: this.fortsAlive, pending: this.x.strikes.pending, metrics: { ...this.metrics }, strikes: { ...this.x.strikes.metrics }, night: !!this.night } ; }
}
