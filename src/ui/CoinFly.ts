import Phaser from 'phaser';
import type { Sfx } from '../systems/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * 钱币飞入（2026-11-21 用户：「需要做个拾取到钱币的音效，然后钱币会有个动画飞去金币袋里，现在军粮变成钱币」；
 * 后改「钱币就是飞进行囊里，行囊可以看到钱币数量」）。
 *
 * 两种用法：
 *  - burst(from, amount)：通用入口——从任意点（HUD 坐标；战斗里用 GameScene.coinBurst 从世界坐标换算）飞 amount 的钱向目标。
 *    之后数值涨上来的那部分记作「已飞过」，不会再飞一遍。地上掉的铜钱（钱币掉落物，由 star-map-p1 会话实现）捡到时调它。
 *  - 盯数值：value() 一涨而又没人 burst 过，就从 from()（默认屏幕中间）飞——所有现有的得钱来源（粮袋、粮车、事件、卖装备）都自动有。
 * 表现：
 *  - 数量按这次多少分档：< 5 → 1 枚，< 20 → 3 枚，其余 5 枚；同屏飞行最多 12 枚（超出的只入账、不飞）。
 *  - 轨迹：先微微弹起（前 22% 时间往上 10px），再沿二次贝塞尔弧线加速飞到目标（约 0.45 秒，逐枚错开 55ms）；铜钱翻转帧动画 coin_flip。
 *  - 每枚到达：目标缩放回弹（行囊 1.08）+ 可选切到「鼓起」贴图 0.25 秒（行囊 bundle_full）+ 轻「落袋」声；整笔最后一枚到达时显示的数字跳到新值。
 * 数值在获得时就已入账，这里只是表现：displayLag() 给出「还在飞的那部分」，界面显示 真值 − lag。
 * 用真实时间（performance.now）驱动，不吃场景时钟——暂停 / 弹窗时不会卡住；超过 0.9 秒还没到的一律当作已到（不丢计数）。
 * 图（美术 public/assets/coins/，说明见共享笔记 coins-art.md）：飞行铜钱 coin_flip（6 帧 48² 的 2× 图）、资源图标 coin_string、行囊鼓起 bundle_full。不画程序图形。
 */
export interface CoinFlyOpts {
  /** 盯的数值。 */
  value: () => number;
  /** 目标图标（HUD 坐标）；没有时只入账不飞。 */
  purse: () => Phaser.GameObjects.Image | null;
  /** 盯数值时这次涨的钱从哪飞起（HUD 坐标）；不给就从屏幕中间。 */
  from?: () => { x: number; y: number } | null;
  sfx?: () => Sfx | null | undefined;
  depth: number;
  /** 现在能不能飞（例如战斗开打、没有弹窗）；false 时数值变化只同步、不飞（开局载入上一关带来的钱之类）。 */
  armed?: () => boolean;
  /** 每帧回调：显示值（真值 − 还在飞的）——界面用它刷新数字，到达时跳到新值。 */
  onFrame?: (shown: number) => void;
  /** 到达时目标放大多少（默认 .22；行囊 .08）。 */
  bump?: number;
  /** 到达时目标短暂切换的贴图（行囊鼓起 bundle_full），0.25 秒后切回。 */
  flashKey?: string;
  /** 飞行铜钱显示尺寸（逻辑像素）。 */
  size?: number;
}
export const COIN_ART = { flip: 'coin_flip', string: 'coin_string', bundleFull: 'bag_bundle_full' } as const;
/** 钱币美术（第一次用到时按需载入；已有的跳过）。 */
export function ensureCoinArt(scene: Phaser.Scene, done?: () => void): void {
  const L = scene.load; let n = 0;
  if (!scene.textures.exists(COIN_ART.flip)) { L.spritesheet(COIN_ART.flip, 'assets/coins/coin_flip.png', { frameWidth: 48, frameHeight: 48 }); n++; }
  if (!scene.textures.exists(COIN_ART.string)) { L.image(COIN_ART.string, 'assets/coins/coin_string.png'); n++; }
  if (!scene.textures.exists(COIN_ART.bundleFull)) { L.image(COIN_ART.bundleFull, 'assets/coins/bundle_full.png'); n++; }
  if (!n) { done?.(); return; }
  if (done) L.once('complete', done);
  if (!L.isLoading()) L.start();
}
const DUR = 450, STAGGER = 55, MAX_LIVE = 12, SETTLE_MS = 900, POP = .22, FLASH_MS = 250, CLAIM_MS = 1500;
interface Coin { img: Phaser.GameObjects.Sprite | null; t0: number; x0: number; y0: number; cx: number; cy: number; batch: Batch }
interface Batch { amount: number; t0: number; left: number }

export class CoinFly {
  private last: number;
  private coins: Coin[] = [];
  private batches: Batch[] = [];
  /** burst 过、还没在数值上体现的钱（避免盯数值时再飞一遍）。 */
  private claims: Array<{ amount: number; t: number }> = [];
  private bumpAt = -1e9;
  private flashUntil = 0; private flashBase = '';
  private purseBase = -1; private baseFor: Phaser.GameObjects.Image | null = null;
  private readonly onUpdate = (): void => this.update();
  constructor(private readonly scene: Phaser.Scene, private readonly o: CoinFlyOpts) {
    this.last = o.value();
    ensureCoinArt(scene);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }
  destroy(): void { this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate); for (const c of this.coins) c.img?.destroy(); this.coins = []; this.batches = []; }
  /** 还在飞、没到达的钱（界面显示 真值 − 这个数）。 */
  displayLag(): number { const now = performance.now(); let n = 0; for (const b of this.batches) if (now - b.t0 < SETTLE_MS) n += b.amount; return n; }
  /** 数值被别处直接改了（读档、重置）时同步基准，不飞。 */
  resync(): void { this.last = this.o.value(); }
  /** 测试用：当前在飞的铜钱数。 */
  get flying(): number { return this.coins.length; }
  /** 测试用：目标切到「鼓起」贴图的次数。 */
  flashes = 0;

  /** 通用入口：从 from（HUD 坐标）飞 amount 的钱到目标。钱应当已经（或马上）加进数值里；这里只管表现。 */
  burst(from: { x: number; y: number }, amount: number): void {
    if (!(amount > 0)) return;
    this.claims.push({ amount, t: performance.now() });
    this.fly(from, amount, performance.now());
  }

  private update(): void {
    const now = performance.now(), v = this.o.value();
    this.claims = this.claims.filter(c => now - c.t < CLAIM_MS && c.amount > 0);
    if (v < this.last || (v > this.last && this.o.armed && !this.o.armed())) { this.last = v; this.claims = []; } // 花掉了 / 不在可飞的时候：不飞，跟上
    else if (v > this.last) {
      let d = v - this.last; this.last = v;
      for (const c of this.claims) { const k = Math.min(c.amount, d); c.amount -= k; d -= k; if (!d) break; } // burst 过的那部分不再飞
      if (d > 0) this.fly(this.o.from?.() ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }, d, now);
    }
    const purse = this.o.purse(), tx = purse?.x ?? 0, ty = purse?.y ?? 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i], k = (now - c.t0) / DUR;
      if (k < 0) { c.img?.setVisible(false); continue; }
      if (k >= 1 || !purse) { this.land(c, now); this.coins.splice(i, 1); continue; }
      let x: number, y: number;
      if (k < POP) { const e = Math.sin((k / POP) * Math.PI / 2); x = c.x0; y = c.y0 - 10 * e; }
      else { const u = (k - POP) / (1 - POP), t = u * u, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t, sy = c.y0 - 10; x = a * c.x0 + b * c.cx + d * tx; y = a * sy + b * c.cy + d * ty; }
      c.img?.setVisible(true).setPosition(x, y).setScale((c.img.getData('s') as number) * (1 - .25 * Math.max(0, k - .7) / .3));
      if (c.img && this.scene.textures.exists(COIN_ART.flip)) c.img.setFrame(Math.floor((now - c.t0) / 70) % 6); // 约 14 帧 / 秒翻转
    }
    this.batches = this.batches.filter(b => b.left > 0 && now - b.t0 < SETTLE_MS);
    this.o.onFrame?.(Math.max(0, Math.round(v - this.displayLag())));
    if (purse) {
      // 基准缩放按目标对象记（目标会换：行囊没开放时是铜钱图标、开放后是行囊）；目标自己被别处改了大小（悬停放大等）也重新记
      if (purse !== this.baseFor || this.purseBase < 0 || Math.abs(purse.scaleX - this.purseBase) > this.purseBase * .5) { this.purseBase = purse.scaleX; this.baseFor = purse; }
      const amp = this.o.bump ?? .22, e = (now - this.bumpAt) / 220, s = e >= 0 && e < 1 ? 1 + amp * Math.sin(e * Math.PI) * (1 - e * .4) : 1;
      purse.setScale(this.purseBase * s);
      // 行囊鼓起：切到鼓起贴图 0.25 秒再切回（同尺寸同角度）
      if (this.flashBase && now >= this.flashUntil) { if (purse.texture.key === this.o.flashKey) purse.setTexture(this.flashBase); this.flashBase = ''; }
    }
  }
  private fly(src: { x: number; y: number }, amount: number, now: number): void {
    this.o.sfx?.()?.coin();
    const purse = this.o.purse(); if (!purse) return;
    const n = amount < 5 ? 1 : amount < 20 ? 3 : 5, room = Math.max(0, MAX_LIVE - this.coins.length), fly = Math.min(n, room);
    const batch: Batch = { amount, t0: now, left: Math.max(1, fly) };
    this.batches.push(batch);
    if (!fly) { batch.left = 0; this.bump(now); return; }
    const size = this.o.size ?? 18, flip = this.scene.textures.exists(COIN_ART.flip);
    for (let i = 0; i < fly; i++) {
      const x0 = src.x + (Math.random() - .5) * 18, y0 = src.y + (Math.random() - .5) * 12;
      // 控制点：起点与目标连线中点往上抬，让弧线先上后下
      const cx = (x0 + purse.x) / 2 + (Math.random() - .5) * 40, cy = Math.min(y0, purse.y) - 50 - Math.random() * 30;
      let img: Phaser.GameObjects.Sprite | null = null;
      if (flip) { img = this.scene.add.sprite(x0, y0, COIN_ART.flip, Math.floor(Math.random() * 6)).setScrollFactor(0).setDepth(this.o.depth).setVisible(false).setName('coin-fly'); const s = size / 48; img.setScale(s).setData('s', s); }
      this.coins.push({ img, t0: now + i * STAGGER, x0, y0, cx, cy, batch });
    }
  }
  private land(c: Coin, now: number): void {
    c.img?.destroy(); c.batch.left--; this.bump(now);
    this.o.sfx?.()?.play('coinPurse');
  }
  private bump(now: number): void {
    this.bumpAt = now;
    const purse = this.o.purse(), fk = this.o.flashKey;
    if (purse && fk && this.scene.textures.exists(fk)) { if (purse.texture.key !== fk) { this.flashBase = purse.texture.key; purse.setTexture(fk); this.flashes++; } this.flashUntil = now + FLASH_MS; }
  }
}
