import { COIN_PICKUP } from '../data/coinDrops';
import { GEM_FX } from '../data/gemFx';

/**
 * 地上的钱币掉落物（2026-11-21，设计见共享笔记 coin-drops.md）：敌人倒下按 data/coinDrops.ts 掉出来，走到吸取范围内飞向主将，
 * **碰到主将那一刻入账**（onCollect）。落地 COIN_PICKUP.lifeMs 没人捡就自己飞向主将入账，所以地上的钱不会丢、常驻数量有上界。
 * - 自己的对象池（COIN_PICKUP.cap 个槽），不占经验信物的池；池满时 spawn 返回 false，调用方直接入账。
 * - 掉落抛物线、轻弹、落地浮动、吸取加速度都用经验信物的那套手感（data/gemFx.ts GEM_FX），吸取半径由调用方给（和信物同一个数）。
 * - 降级（lite）：手机布局，或两种掉落物合计超过 COIN_PICKUP.liteAbove 时新掉的——不浮动、不翻面，只是一枚静止的铜钱。
 * 这个类只管逻辑，不依赖 Phaser：画面通过 CoinView 接口（GameScene 用 coin_flip 贴图实现；测试里用空壳）。
 */
export interface CoinView { place(x: number, y: number, frame: number): void; show(on: boolean): void }
export interface CoinDrop {
  view: CoinView; active: boolean; value: number;
  /** drop 抛出落地中 / rest 在地上 / fly 飞向主将。 */
  phase: 'drop' | 'rest' | 'fly';
  /** 当前位置（世界坐标）。 */
  x: number; y: number;
  at: number; sx: number; sy: number; lx: number; ly: number; speed: number; lite: boolean; seed: number;
  /** 是不是因为 12 秒到了自己飞的（不是被吸过去的）。 */
  auto: boolean;
}
export interface CoinFieldHost {
  /** 造一枚铜钱的画面对象（池里每个槽只造一次）。 */
  view: () => CoinView;
  /** 捡到（碰到主将）：value 入账 + 表现，(x, y) 是主将处。 */
  onCollect: (value: number, x: number, y: number) => void;
  /** 另一种掉落物（经验信物）现在有几个在场，用来算降级阈值。 */
  otherLive: () => number;
  /** 一律降级（手机布局）。 */
  alwaysLite?: boolean;
  rnd?: () => number;
}
/** 铜钱翻面一圈的帧数与时长（coin_flip 6 帧；落地后隔 GEM_FX.shineEvery 翻一圈当作高光）。 */
export const COIN_FLIP = { frames: 6, ms: 430 } as const;

export class CoinDropField {
  readonly drops: CoinDrop[] = [];
  /** 统计：生成、捡到（含自动）、其中自动入囊的、池满直接入账的次数与金额。 */
  readonly stats = { spawned: 0, collected: 0, auto: 0, overflow: 0, value: 0 };
  constructor(private readonly h: CoinFieldHost) {}
  get live(): number { let n = 0; for (const c of this.drops) if (c.active) n++; return n; }
  /** 在场的钱币掉落物（机器人「顺路捡钱币」用）：坐标、面值、状态。 */
  list(): Array<{ x: number; y: number; value: number; phase: CoinDrop['phase'] }> { return this.drops.filter(c => c.active).map(c => ({ x: c.x, y: c.y, value: c.value, phase: c.phase })); }

  /** 在 (x, y) 掉一堆面值 value 的钱。池满返回 false（没生成，调用方直接入账）。 */
  spawn(x: number, y: number, value: number, now: number): boolean {
    let c = this.drops.find(d => !d.active);
    if (!c) {
      if (this.drops.length >= COIN_PICKUP.cap) { this.stats.overflow++; return false; }
      c = { view: this.h.view(), active: false, value: 0, phase: 'drop', x, y, at: 0, sx: 0, sy: 0, lx: 0, ly: 0, speed: 0, lite: false, seed: 0, auto: false };
      this.drops.push(c);
    }
    const rnd = this.h.rnd ?? Math.random, live = this.live;
    Object.assign(c, { active: true, value, phase: 'drop', at: now, sx: x, sy: y - GEM_FX.lift, lx: x + (rnd() - .5) * 2 * GEM_FX.spread, ly: y + (rnd() - .5) * GEM_FX.spread * .7, speed: 0, auto: false,
      lite: !!this.h.alwaysLite || live + this.h.otherLive() > COIN_PICKUP.liteAbove, seed: rnd() * 10000 });
    c.x = c.sx; c.y = c.sy; c.view.place(c.x, c.y, 0); c.view.show(true);
    this.stats.spawned++;
    return true;
  }

  /** 每帧：now 毫秒（战斗时钟）、dt 秒、主将位置、吸取半径（和经验信物同一个）。 */
  update(now: number, dt: number, px: number, py: number, radius: number): void {
    for (const c of this.drops) {
      if (!c.active) continue;
      if (c.phase === 'drop') {
        const t = now - c.at;
        if (t < GEM_FX.dropMs) { const k = t / GEM_FX.dropMs; c.x = c.sx + (c.lx - c.sx) * k; c.y = c.sy + (c.ly - c.sy) * k - Math.sin(Math.PI * k) * GEM_FX.arc; c.view.place(c.x, c.y, c.lite ? 0 : Math.floor(k * COIN_FLIP.frames) % COIN_FLIP.frames); }
        else if (t < GEM_FX.dropMs + GEM_FX.bounceMs) { const k = (t - GEM_FX.dropMs) / GEM_FX.bounceMs; c.x = c.lx; c.y = c.ly - Math.sin(Math.PI * k) * GEM_FX.bounce; c.view.place(c.x, c.y, 0); }
        else { c.x = c.lx; c.y = c.ly; c.phase = 'rest'; c.at = now; c.view.place(c.x, c.y, 0); }
        continue;
      }
      const dx = px - c.x, dy = py - c.y, dist = Math.hypot(dx, dy) || 1;
      if (c.phase === 'rest') {
        const expired = now - c.at >= COIN_PICKUP.lifeMs;
        if (dist < radius || expired) { c.phase = 'fly'; c.speed = GEM_FX.flyStart; c.auto = expired && dist >= radius; }
        else {
          if (!c.lite) { // 落地：正面朝上轻轻浮动，隔一会儿翻一圈（高光）
            const ph = now + c.seed, st = ph % GEM_FX.shineEvery;
            c.y = c.ly - GEM_FX.bobPx + Math.sin(ph / GEM_FX.bobMs * Math.PI * 2) * GEM_FX.bobPx;
            c.view.place(c.x, c.y, st < COIN_FLIP.ms ? Math.floor(st / COIN_FLIP.ms * COIN_FLIP.frames) % COIN_FLIP.frames : 0);
          }
          continue;
        }
      }
      // 飞向主将：碰到的那一刻入账
      if (dist < GEM_FX.arriveDist) { this.take(c, px, py); continue; }
      c.speed = Math.min(GEM_FX.flyMax, c.speed + GEM_FX.flyAccel * dt);
      const step = Math.min(dist, c.speed * dt); c.x += dx / dist * step; c.y += dy / dist * step;
      c.view.place(c.x, c.y, c.lite ? 0 : Math.floor(now / 60) % COIN_FLIP.frames);
    }
  }
  private take(c: CoinDrop, px: number, py: number): void {
    c.active = false; c.view.show(false);
    this.stats.collected++; this.stats.value += c.value; if (c.auto) this.stats.auto++;
    this.h.onCollect(c.value, px, py);
  }
  /** 一关打完 / 进行营 / 结算前：地上还没捡的全部入账（不播表现），返回总额。 */
  collectAll(): number {
    let sum = 0;
    for (const c of this.drops) if (c.active) { c.active = false; c.view.show(false); sum += c.value; this.stats.collected++; this.stats.value += c.value; }
    return sum;
  }
}
