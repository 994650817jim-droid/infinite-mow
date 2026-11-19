import Phaser from 'phaser';
import { DEPTH, FONT, actorDepth } from '../config';
import { EVENT_FORTUNES, FORTUNE, FORTUNE_EVENT, type FortuneEventKind } from '../data/fortunes';
import type { PhasePlan } from '../data/stagePhases';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';
import { ordersOf } from './BattleOrders';

/**
 * 战场机缘事件（wave-progression-redesign.md §2.1b）：每关 2 次——精锐段的「敌军粮车」，事件段的「义军被围 / 降将来投 / 烽燧」之一。
 * - 粮车 / 烽燧：站进圈里 3 秒；义军被围：打掉围着的敌兵（之后义军随你冲阵 30 秒）；降将：走到他身边。
 * - 完成后由场景弹「战场机缘 · 本关有效」三选一（host.offer）；40 秒没理会就消失（「机缘已失」）。
 * - 地上画互动圈与进度弧（Graphics，只是标记，不是特效）；道具用营寨道具图（yellow_props：粮车 + 粮袋、火盆、军旗），降将用本章精锐行走图首帧。
 * - 军令表里挂一条「机缘」（屏外时有箭头指过去）。
 */
export interface FortuneHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number; alive?: boolean };
  elapsed: () => number;
  /** 场景可放东西的位置（夹进场地、避开水 / 树）。 */
  place: (x: number, y: number) => { x: number; y: number };
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  escort: (x: number, y: number, n: number, ms: number) => number;
  /** 本章精锐行走图（降将用）。 */
  officerTexture: () => string | undefined;
  banner: (title: string, danger: boolean, sub?: string) => void;
  sfx: (key: string) => void;
  /** 完成：场景在空闲时弹机缘三选一。 */
  offer: (kind: FortuneEventKind) => void;
}
interface Live {
  kind: FortuneEventKind; x: number; y: number; born: number; hold: number; done: boolean; gone: boolean;
  guards: Array<{ e: Enemy; life: number }>;
  ring: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; props: Phaser.GameObjects.GameObject[];
}

export class BattleFortunes {
  private readonly schedule: Array<{ at: number; kind: FortuneEventKind; fired: boolean }> = [];
  private live: Live[] = [];
  /** 测试用。 */
  readonly stats = { spawned: [] as string[], done: [] as string[], lost: [] as string[] };

  constructor(private readonly h: FortuneHost, plan: PhasePlan, rnd: () => number = Math.random) {
    const at = (k: string) => plan.phases.find(p => p.kind === k)?.start;
    const elite = at('elite'), event = at('event');
    if (elite !== undefined && plan.phases.length > 3) this.schedule.push({ at: elite + FORTUNE.cartDelay, kind: 'cart', fired: false });
    if (event !== undefined) this.schedule.push({ at: event + FORTUNE.eventDelay, kind: EVENT_FORTUNES[Math.floor(rnd() * EVENT_FORTUNES.length)], fired: false });
  }

  private lastT = -1;
  update(bossOn: boolean): void {
    const t = this.h.elapsed(), dt = this.lastT < 0 ? 0 : Math.max(0, Math.min(.1, t - this.lastT)); this.lastT = t;
    for (const s of this.schedule) if (!s.fired && t >= s.at && !bossOn) { s.fired = true; this.spawn(s.kind); }
    for (const L of this.live) if (!L.done && !L.gone) this.tick(L, t, dt);
    this.live = this.live.filter(L => !L.gone);
  }

  private spawn(kind: FortuneEventKind): void {
    const P = this.h.player(), [d0, d1] = FORTUNE.distance, a = Math.random() * Math.PI * 2, d = d0 + Math.random() * (d1 - d0);
    const at = this.h.place(P.x + Math.cos(a) * d, P.y + Math.sin(a) * d), s = this.h.scene, ev = FORTUNE_EVENT[kind];
    const ring = s.add.graphics().setDepth(DEPTH.ground + 3).setName('fortune-ring');
    const label = s.add.text(at.x, at.y - 96, ev.name + '\n' + ev.hint, { fontFamily: FONT, fontSize: '13px', color: '#ffe3a0', align: 'center', resolution: 2, stroke: '#1f1206', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 2).setName('fortune-label');
    const props = this.props(kind, at.x, at.y);
    const L: Live = { kind, x: at.x, y: at.y, born: this.h.elapsed(), hold: 0, done: false, gone: false, guards: [], ring, label, props };
    const n = kind === 'cart' ? FORTUNE.cartGuards : kind === 'rescue' ? FORTUNE.rescueGuards : 0;
    for (let i = 0; i < n; i++) { const g = i / n * Math.PI * 2, e = this.h.spawn(i % 3 === 2 ? 'shield' : 'infantry', at.x + Math.cos(g) * 64, at.y + Math.sin(g) * 44); if (e) L.guards.push({ e, life: e.spawnId }); }
    this.live.push(L); this.stats.spawned.push(kind);
    ordersOf(s)?.set('fortune-' + kind, { label: '机缘 · ' + ev.name, kind: 'side', at: () => (L.gone ? null : { x: L.x, y: L.y }) });
    this.h.banner('战场机缘 · ' + ev.name, false, ev.hint); this.h.sfx('waveDrum');
  }

  private props(kind: FortuneEventKind, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const s = this.h.scene, out: Phaser.GameObjects.GameObject[] = [], has = s.textures.exists('yellow_props');
    const img = (f: number, dx: number, dy: number, size: number) => { if (!has) return null; const i = s.add.image(x + dx, y + dy, 'yellow_props', f).setOrigin(.5, .9).setDisplaySize(size, size).setDepth(actorDepth(y + dy)); out.push(i); return i; };
    if (kind === 'cart') { img(24, 0, 10, 112); img(16, -6, -14, 70); }
    else if (kind === 'beacon') img(29, 0, 8, 96)?.setTint(0x6a6058).setName('fortune-beacon');
    else if (kind === 'rescue') img(4, 0, 6, 84);
    else {
      const tex = this.h.officerTexture();
      if (tex && s.textures.exists(tex)) { const f = s.textures.get(tex).has('down_0') ? 'down_0' : undefined; const o = s.add.image(x, y + 8, tex, f).setOrigin(.5, .92).setScale(.62).setDepth(actorDepth(y + 8)).setName('fortune-defector'); out.push(o); }
      img(7, 34, 8, 64)?.setTint(0xf2efe6);
    }
    return out;
  }

  private tick(L: Live, t: number, dt: number): void {
    const P = this.h.player(), inside = Math.hypot(P.x - L.x, P.y - L.y) <= FORTUNE.radius && P.alive !== false;
    const guardsLeft = L.guards.filter(g => g.e.active && g.e.spawnId === g.life && g.e.hp > 0).length;
    let ok = false, k = 0;
    if (L.kind === 'cart' || L.kind === 'beacon') { L.hold = inside ? L.hold + dt : Math.max(0, L.hold - dt / 2); k = Math.min(1, L.hold / FORTUNE.holdSec); ok = k >= 1; }
    else if (L.kind === 'rescue') { k = L.guards.length ? 1 - guardsLeft / L.guards.length : 1; ok = guardsLeft === 0; }
    else { ok = inside; k = inside ? 1 : 0; }
    // 圈与进度弧（每帧重画一个圈，成本很低）
    const pulse = .6 + .25 * Math.sin(t * 4);
    L.ring.clear().fillStyle(0xf0c060, .08).fillEllipse(L.x, L.y, FORTUNE.radius * 2, FORTUNE.radius * 1.4).lineStyle(2, 0xf0c060, pulse).strokeEllipse(L.x, L.y, FORTUNE.radius * 2, FORTUNE.radius * 1.4);
    if (k > 0) { L.ring.lineStyle(5, 0xffd870, .95).beginPath(); for (let i = 0; i <= 40 * k; i++) { const a = -Math.PI / 2 + i / 40 * Math.PI * 2; const px = L.x + Math.cos(a) * FORTUNE.radius, py = L.y + Math.sin(a) * FORTUNE.radius * .7; if (i === 0) L.ring.moveTo(px, py); else L.ring.lineTo(px, py); } L.ring.strokePath(); }
    if (L.kind === 'rescue') L.label.setText(FORTUNE_EVENT.rescue.name + '\n' + (guardsLeft ? `击退围困的敌兵 ${L.guards.length - guardsLeft}/${L.guards.length}` : ''));
    if (ok) { this.complete(L); return; }
    if (t - L.born > FORTUNE.lifeSec) this.lose(L);
  }

  private complete(L: Live): void {
    L.done = true; this.stats.done.push(L.kind); const ev = FORTUNE_EVENT[L.kind], s = this.h.scene;
    ordersOf(s)?.done('fortune-' + L.kind, ev.done);
    if (L.kind === 'rescue') this.h.escort(L.x, L.y, FORTUNE.rescueEscort, FORTUNE.rescueEscortMs);
    const beacon = L.props.find(o => o.name === 'fortune-beacon') as Phaser.GameObjects.Image | undefined; beacon?.clearTint();
    this.h.sfx('gong'); this.h.offer(L.kind);
    this.fade(L, 900);
  }
  private lose(L: Live): void {
    L.done = true; this.stats.lost.push(L.kind); ordersOf(this.h.scene)?.remove('fortune-' + L.kind);
    this.h.banner('机缘已失', false, FORTUNE_EVENT[L.kind].name + ' 已经离去'); this.fade(L, 600);
  }
  private fade(L: Live, delay: number): void {
    const s = this.h.scene, objs = [L.ring, L.label, ...L.props];
    s.tweens.add({ targets: objs, alpha: 0, delay, duration: 700, onComplete: () => { for (const o of objs) o.destroy(); L.gone = true; ordersOf(s)?.remove('fortune-' + L.kind); } });
  }
  clear(): void { for (const L of this.live) { L.ring.destroy(); L.label.destroy(); for (const o of L.props) o.destroy(); ordersOf(this.h.scene)?.remove('fortune-' + L.kind); } this.live = []; }
}
