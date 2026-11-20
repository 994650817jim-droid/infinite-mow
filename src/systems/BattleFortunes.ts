import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import { EVENT_FORTUNES, FORTUNE, FORTUNE_EVENT, firstFortunes, type FortuneEventKind } from '../data/fortunes';
import type { PhasePlan } from '../data/stagePhases';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';
import { ordersOf } from './BattleOrders';
import { FortuneDefector, type DefectorHost } from './FortuneDefector';

/**
 * 战场机缘事件（wave-progression-redesign.md §2.1b；设计表 stage-event-rewards.md，2026-11-19）：
 * 每关 2 次——精锐段从「粮车 / 军械库 / 传令兵」抽一个，事件段从「义军被围 / 降将来投 / 烽燧」抽一个。
 * - 刷在离主将 600–900 的可走处（试 16 个方向，夹进场地、避开水 / 树 / 墙；小场地取最远处），奖励按距离 ×1–1.25。
 * - 占点（粮车 / 烽燧 3 秒、军械库 4 秒）、击破（义军被围）、走到身边（降将）、追击（传令兵 15 秒内追上）。
 * - 各类事件奖励不同（host.reward）：粮车 军粮 + 回春丹；军械库 兵装；传令兵 多一次军略三选一；义军 随冲 + 补员；降将 机缘三选一；烽燧 刷兵减半 + 回血。
 * - 屏幕标记（不依赖默认收起的军令面板）：出现横幅、地上「图标 + 名字 + 剩余秒数」与进度弧、屏外金色箭头（图标 + 距离）、军令表 side 条目（舆图小旗）。
 */
export interface FortuneHost extends DefectorHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number; alive?: boolean };
  elapsed: () => number;
  chapter: () => number;
  /** 场景可放东西的位置（夹进场地、避开水 / 树）。 */
  place: (x: number, y: number) => { x: number; y: number };
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  /** 本章精锐 / 骑兵行走图（降将、传令兵用）。 */
  officerTexture: () => string | undefined;
  riderTexture: () => string | undefined;
  banner: (title: string, danger: boolean, sub?: string) => void;
  sfx: (key: string) => void;
  /** 完成：按事件发奖（mult = 距离倍率，x / y = 事件位置），返回横幅小字。 */
  reward: (kind: FortuneEventKind, mult: number, x: number, y: number) => string;
  /** 画面有没有被全屏面板挡着（挡着时屏外箭头先藏）。 */
  overlay: () => boolean;
}
interface Live {
  kind: FortuneEventKind; x: number; y: number; born: number; life: number; hold: number; done: boolean; gone: boolean; mult: number; dist: number;
  guards: Array<{ e: Enemy; life: number }>;
  ring: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; icon?: Phaser.GameObjects.Image; props: Phaser.GameObjects.GameObject[];
  arrow: Phaser.GameObjects.Container;
  /** 传令兵：开跑时刻（-1 = 还没看到你）。 */
  fleeAt: number;
  /** 降将来投：出场 → 试阵 → 跪降 → 随战（systems/FortuneDefector.ts）。 */
  defector?: FortuneDefector;
}

export class BattleFortunes {
  private readonly schedule: Array<{ at: number; kind: FortuneEventKind; fired: boolean }> = [];
  private live: Live[] = [];
  /** 测试用。 */
  readonly stats = { spawned: [] as string[], done: [] as string[], lost: [] as string[], dist: [] as number[], rewards: [] as string[] };
  /** 已归附、本关随战的降将（随战台词、关末告别）。 */
  readonly allies: FortuneDefector[] = [];
  /** 测试：当前 / 最近一位降将。 */
  defector: FortuneDefector | null = null;

  constructor(private readonly h: FortuneHost, plan: PhasePlan, rnd: () => number = Math.random) {
    const at = (k: string) => plan.phases.find(p => p.kind === k)?.start;
    const elite = at('elite'), event = at('event'), first = firstFortunes(plan.chapter);
    if (elite !== undefined && plan.phases.length > 3) this.schedule.push({ at: elite + FORTUNE.cartDelay, kind: first[Math.floor(rnd() * first.length)], fired: false });
    if (event !== undefined) this.schedule.push({ at: event + FORTUNE.eventDelay, kind: EVENT_FORTUNES[Math.floor(rnd() * EVENT_FORTUNES.length)], fired: false });
  }

  private lastT = -1;
  update(bossOn: boolean): void {
    const t = this.h.elapsed(), dt = this.lastT < 0 ? 0 : Math.max(0, Math.min(.1, t - this.lastT)); this.lastT = t;
    for (const s of this.schedule) if (!s.fired && t >= s.at && !bossOn) { s.fired = true; this.spawn(s.kind); }
    for (const L of this.live) if (!L.done && !L.gone) this.tick(L, t, dt);
    for (const d of this.allies) d.allyTick(t);
    this.live = this.live.filter(L => !L.gone);
  }
  /** 测试 / 调试：立刻刷一个指定事件。 */
  force(kind: FortuneEventKind): void { this.spawn(kind); }

  /** 远处选点：试 16 个方向、目标 900，夹进场地后挑 ≥ 600 的随机一个；都不够就取最远。 */
  private farPoint(): { x: number; y: number; d: number } {
    const P = this.h.player(), F = FORTUNE.far, a0 = Math.random() * Math.PI * 2, cands: Array<{ x: number; y: number; d: number }> = [];
    for (let i = 0; i < F.tries; i++) { const a = a0 + i / F.tries * Math.PI * 2, p = this.h.place(P.x + Math.cos(a) * F.target, P.y + Math.sin(a) * F.target); cands.push({ ...p, d: Math.hypot(p.x - P.x, p.y - P.y) }); }
    const far = cands.filter(c => c.d >= F.min);
    return far.length ? far[Math.floor(Math.random() * far.length)] : cands.reduce((a, b) => (b.d > a.d ? b : a));
  }

  private spawn(kind: FortuneEventKind): void {
    const at = this.farPoint(), s = this.h.scene, ev = FORTUNE_EVENT[kind], F = FORTUNE.far;
    const mult = Math.min(F.bonusMax, Math.max(1, 1 + (at.d - F.min) / (F.target - F.min) * (F.bonusMax - 1)));
    const ring = s.add.graphics().setDepth(DEPTH.ground + 3).setName('fortune-ring');
    const label = s.add.text(at.x, at.y - 104, '', { fontFamily: FONT, fontSize: '13px', color: '#ffe3a0', align: 'center', resolution: 2, stroke: '#1f1206', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 2).setName('fortune-label');
    const icon = s.textures.exists(ev.icon) ? s.add.image(at.x, at.y - 134, ev.icon).setDisplaySize(30, 30).setDepth(DEPTH.dmgText - 2).setName('fortune-icon') : undefined;
    const props = this.props(kind, at.x, at.y);
    const L: Live = { kind, x: at.x, y: at.y, born: this.h.elapsed(), life: kind === 'armory' ? FORTUNE.armoryLifeSec : FORTUNE.lifeSec, hold: 0, done: false, gone: false, mult, dist: Math.round(at.d),
      guards: [], ring, label, icon, props, arrow: this.makeArrow(ev.icon), fleeAt: -1 };
    const guard = (k: EnemyKind, n: number, r: number) => { for (let i = 0; i < n; i++) { const g = i / n * Math.PI * 2 + Math.random() * .3, e = this.h.spawn(k, at.x + Math.cos(g) * r, at.y + Math.sin(g) * r * .7); if (e) L.guards.push({ e, life: e.spawnId }); } };
    if (kind === 'defector') { L.defector = this.defector = new FortuneDefector(this.h, at.x, at.y); }
    if (kind === 'cart') guard('infantry', FORTUNE.cartGuards, 64);
    else if (kind === 'rescue') { guard('infantry', FORTUNE.rescueGuards - 2, 64); guard('shield', 2, 70); }
    else if (kind === 'armory') { guard('elite', FORTUNE.armoryElites, 80); guard('shield', FORTUNE.armoryShields, 96); }
    this.live.push(L); this.stats.spawned.push(kind); this.stats.dist.push(L.dist);
    ordersOf(s)?.set('fortune-' + kind, { label: '机缘 · ' + ev.name, kind: 'side', at: () => (L.gone ? null : { x: L.x, y: L.y }) });
    this.h.banner('机缘 · ' + ev.name + '出现', false, ev.hint + ' · 赏：' + ev.reward); this.h.sfx('waveDrum');
  }

  private props(kind: FortuneEventKind, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const s = this.h.scene, out: Phaser.GameObjects.GameObject[] = [], has = s.textures.exists('yellow_props');
    const img = (f: number, dx: number, dy: number, size: number) => { if (!has) return null; const i = s.add.image(x + dx, y + dy, 'yellow_props', f).setOrigin(.5, .9).setDisplaySize(size, size).setDepth(actorDepth(y + dy)); out.push(i); return i; };
    const sprite = (tex: string | undefined, dx: number, scale: number, name: string) => { if (!tex || !s.textures.exists(tex)) return null; const f = s.textures.get(tex).has('down_0') ? 'down_0' : undefined; const o = s.add.image(x + dx, y + 8, tex, f).setOrigin(.5, .92).setScale(scale).setDepth(actorDepth(y + 8)).setName(name); out.push(o); return o; };
    if (kind === 'cart') { img(24, 0, 10, 112); img(16, -6, -14, 70); }
    else if (kind === 'armory') { img(19, -40, 6, 92); img(20, 36, 6, 92); img(14, 0, 22, 84); }
    else if (kind === 'beacon') img(29, 0, 8, 96)?.setTint(0x6a6058).setName('fortune-beacon');
    else if (kind === 'rescue') img(4, 0, 6, 84);
    else if (kind === 'courier') { const r = sprite(this.h.riderTexture(), 0, .6, 'fortune-courier'); if (!r) img(7, 0, 8, 64)?.setName('fortune-courier'); }
    // 降将：人和旗由 FortuneDefector 自己画（走过来、插旗）
    return out;
  }

  /** 屏外箭头（屏幕坐标）：金色小三角 + 事件图标 + 「名字 · 距离」。 */
  private makeArrow(iconKey: string): Phaser.GameObjects.Container {
    const s = this.h.scene, g = s.add.graphics().setName('fa-g');
    const parts: Phaser.GameObjects.GameObject[] = [g];
    if (s.textures.exists(iconKey)) parts.push(s.add.image(0, 0, iconKey).setDisplaySize(24, 24).setName('fa-icon'));
    parts.push(s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#ffe3a0', resolution: 2, stroke: '#1a0e06', strokeThickness: 4 }).setOrigin(.5).setName('fa-text'));
    return s.add.container(0, 0, parts).setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('fortune-arrow').setVisible(false);
  }
  private drawArrow(L: Live): void {
    const s = this.h.scene, cam = s.cameras.main, v = cam.worldView, kx = GAME_WIDTH / v.width, ky = GAME_HEIGHT / v.height;
    const sx = (L.x - v.x) * kx, sy = (L.y - v.y) * ky, pad = 40;
    if (this.h.overlay() || (sx >= pad && sy >= pad && sx <= GAME_WIDTH - pad && sy <= GAME_HEIGHT - pad)) { L.arrow.setVisible(false); return; }
    // 避开顶部战况线 / 计时器（上 100）、底部首领血条（下 100）、右侧圆钮列（右 140）
    const top = 100, bottom = GAME_HEIGHT - 100, left = 48, right = GAME_WIDTH - 140, /* 右 140：原 110 时箭头圆圈 + 字压到右列加点 / 护阵圆钮（第二章检查 11-20） */ cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2, a = Math.atan2(sy - cy, sx - cx), dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity);
    let ax = cx + dx * t; const ay = cy + dy * t, r = 12, g = L.arrow.getByName('fa-g') as Phaser.GameObjects.Graphics;
    if (ax < 250 && ay < 260) ax = 250; // 左上角是主将血条 / 随军粮 / 增益图标：箭头往右让开
    L.arrow.setPosition(ax, ay).setVisible(true);
    g.clear().fillStyle(0x1a0e08, .6).fillCircle(0, 0, 17).lineStyle(1.5, 0xf3d48a, .95).strokeCircle(0, 0, 17)
      .fillStyle(0xf0c060, 1).fillTriangle(dx * (r + 14), dy * (r + 14), Math.cos(a + 2.6) * 10 + dx * 18, Math.sin(a + 2.6) * 10 + dy * 18, Math.cos(a - 2.6) * 10 + dx * 18, Math.sin(a - 2.6) * 10 + dy * 18);
    const P = this.h.player(), d = Math.round(Math.hypot(L.x - P.x, L.y - P.y));
    (L.arrow.getByName('fa-text') as Phaser.GameObjects.Text).setText(FORTUNE_EVENT[L.kind].name.replace('敌军', '') + ' · ' + d + ' 步').setPosition(-dx * 46, -dy * 30 + (Math.abs(dy) < .5 ? 22 : 0));
  }

  private tick(L: Live, t: number, dt: number): void {
    if (L.defector) { this.tickDefector(L, L.defector, t); return; }
    const P = this.h.player(), alive = P.alive !== false;
    // 传令兵：看到主将就往远处跑；chaseSec 秒内追到身边截下，否则逃走
    if (L.kind === 'courier') {
      const d = Math.hypot(P.x - L.x, P.y - L.y), C = FORTUNE.courier;
      if (L.fleeAt < 0 && d <= C.spot) { L.fleeAt = t; this.h.banner('传令兵发现你了', true, C.chaseSec + ' 秒内追上他'); }
      if (L.fleeAt >= 0) { const ux = (L.x - P.x) / (d || 1), uy = (L.y - P.y) / (d || 1), np = this.h.place(L.x + ux * C.speed * dt, L.y + uy * C.speed * dt); const mx = np.x - L.x, my = np.y - L.y; L.x = np.x; L.y = np.y; for (const o of L.props) (o as Phaser.GameObjects.Image).setPosition?.((o as Phaser.GameObjects.Image).x + mx, (o as Phaser.GameObjects.Image).y + my); }
    }
    const inside = Math.hypot(P.x - L.x, P.y - L.y) <= (L.kind === 'courier' ? FORTUNE.courier.catch : FORTUNE.radius) && alive;
    const guardsLeft = L.guards.filter(g => g.e.active && g.e.spawnId === g.life && g.e.hp > 0).length;
    let ok = false, k = 0;
    if (L.kind === 'cart' || L.kind === 'beacon' || L.kind === 'armory') { const need = L.kind === 'armory' ? FORTUNE.armoryHoldSec : FORTUNE.holdSec; L.hold = inside ? L.hold + dt : Math.max(0, L.hold - dt / 2); k = Math.min(1, L.hold / need); ok = k >= 1; }
    else if (L.kind === 'rescue') { k = L.guards.length ? 1 - guardsLeft / L.guards.length : 1; ok = guardsLeft === 0; }
    else { ok = inside; k = inside ? 1 : 0; }
    // 地上：互动圈 + 进度弧（传令兵是跟着跑的小圈）
    const pulse = .6 + .25 * Math.sin(t * 4), R = L.kind === 'courier' ? FORTUNE.courier.catch : FORTUNE.radius;
    L.ring.clear().fillStyle(0xf0c060, .08).fillEllipse(L.x, L.y, R * 2, R * 1.4).lineStyle(2, 0xf0c060, pulse).strokeEllipse(L.x, L.y, R * 2, R * 1.4);
    if (k > 0) { L.ring.lineStyle(5, 0xffd870, .95).beginPath(); for (let i = 0; i <= 40 * k; i++) { const a = -Math.PI / 2 + i / 40 * Math.PI * 2; const px = L.x + Math.cos(a) * R, py = L.y + Math.sin(a) * R * .7; if (i === 0) L.ring.moveTo(px, py); else L.ring.lineTo(px, py); } L.ring.strokePath(); }
    // 地上标记：图标 + 名字 + 剩余秒数（传令兵开跑后改数追击秒数）
    const ev = FORTUNE_EVENT[L.kind], left = L.kind === 'courier' && L.fleeAt >= 0 ? Math.max(0, Math.ceil(FORTUNE.courier.chaseSec - (t - L.fleeAt))) : Math.max(0, Math.ceil(L.life - (t - L.born)));
    const extra = L.kind === 'rescue' && guardsLeft ? `\n击退围兵 ${L.guards.length - guardsLeft}/${L.guards.length}` : L.kind === 'armory' && guardsLeft ? `\n守军 ${guardsLeft}` : '';
    L.label.setText(ev.name + ' · ' + left + ' 秒' + extra).setPosition(L.x, L.y - 104); L.icon?.setPosition(L.x, L.y - 134 - (extra ? 16 : 0));
    this.drawArrow(L);
    if (ok) { this.complete(L); return; }
    const expired = L.kind === 'courier' && L.fleeAt >= 0 ? t - L.fleeAt > FORTUNE.courier.chaseSec : t - L.born > L.life;
    if (expired) this.lose(L);
  }

  /** 降将：出场 / 等你走近时画圈与倒计时；试阵、跪降时标记跟着他；归附即完成（发三选一）。 */
  private tickDefector(L: Live, D: FortuneDefector, t: number): void {
    const r = D.tick(t); L.x = D.x; L.y = D.y;
    if (r === 'yield') { this.allies.push(D); this.complete(L, D.info.name + '本关随你作战'); return; }
    const pulse = .6 + .25 * Math.sin(t * 4), R = 150;
    L.ring.clear(); if (D.waiting) L.ring.fillStyle(0xf0c060, .06).fillEllipse(L.x, L.y, R * 2, R * 1.4).lineStyle(2, 0xf0c060, pulse).strokeEllipse(L.x, L.y, R * 2, R * 1.4);
    const left = Math.max(0, Math.ceil(L.life - (t - L.born)));
    L.label.setText(D.waiting ? D.label() + ' · ' + left + ' 秒' : '').setPosition(L.x, L.y - 118); L.icon?.setVisible(D.waiting).setPosition(L.x, L.y - 148);
    this.drawArrow(L);
    if (D.waiting && t - L.born > L.life) this.lose(L);
  }
  /** 致命一击：试阵中的降将不死，改跪地请降。 */
  preventKill(e: Enemy): boolean { for (const L of this.live) if (L.defector?.preventKill(e)) return true; return false; }
  /** 本关结束：随战的降将告别一句。 */
  farewell(): void { for (const d of this.allies) d.farewell(); }
  private complete(L: Live, lead = ''): void {
    L.done = true; this.stats.done.push(L.kind); const ev = FORTUNE_EVENT[L.kind], s = this.h.scene;
    ordersOf(s)?.done('fortune-' + L.kind, ev.done);
    const beacon = L.props.find(o => o.name === 'fortune-beacon') as Phaser.GameObjects.Image | undefined; beacon?.clearTint();
    const got = this.h.reward(L.kind, L.mult, L.x, L.y); this.stats.rewards.push(L.kind + ':' + got);
    this.h.sfx('gong'); this.h.banner('机缘 · ' + ev.done, false, (lead ? lead + ' · ' : '') + got);
    this.fade(L, 900);
  }
  private lose(L: Live): void {
    L.done = true; this.stats.lost.push(L.kind); ordersOf(this.h.scene)?.remove('fortune-' + L.kind); L.defector?.leave();
    this.h.banner('机缘已失', false, FORTUNE_EVENT[L.kind].name + (L.kind === 'courier' ? ' 跑掉了' : ' 已经离去')); this.fade(L, 600);
  }
  private fade(L: Live, delay: number): void {
    const s = this.h.scene, objs: Phaser.GameObjects.GameObject[] = [L.ring, L.label, ...L.props, ...(L.icon ? [L.icon] : [])];
    L.arrow.destroy();
    s.tweens.add({ targets: objs, alpha: 0, delay, duration: 700, onComplete: () => { for (const o of objs) o.destroy(); L.gone = true; ordersOf(s)?.remove('fortune-' + L.kind); } });
  }
  clear(): void { for (const d of this.allies) d.clear(); this.allies.length = 0; for (const L of this.live) { L.defector?.clear(); L.ring.destroy(); L.label.destroy(); L.icon?.destroy(); L.arrow.destroy(); for (const o of L.props) o.destroy(); ordersOf(this.h.scene)?.remove('fortune-' + L.kind); } this.live = []; }
}
