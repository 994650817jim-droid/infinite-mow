import Phaser from 'phaser';
import type { Sfx } from '../systems/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * 拾取物飞入（2026-11-21）：钱币飞进右上「行囊」，军功符（经验信物）飞向左上经验条。
 * 用户：「需要做个拾取到钱币的音效，然后钱币会有个动画飞去金币袋里」→「钱币就是飞进行囊里」→
 *       「关于军功捡起来会飞向经验条，钱币会飞向行囊。捡起来的时候不会立刻飞过去，会在身边转一下才飞过去」。
 *
 * 一枚拾取物的两段表现（数值都在碰到主将那一刻就已入账，这里只是表现）：
 *  ① 绕身：贴着主将绕转半圈到一圈（约 0.35 秒，半径 26–34px，略微上浮），转到主将身后那半圈画在主将图层之下；跟着主将走。
 *     多枚同时捡到时起始角度错开，像一小串绕着转。（需要 orbit 选项：只在战斗、电脑布局用；手机 / 降级跳过绕转。）
 *  ② 飞入：从绕转结束处沿弧线加速飞向目标（钱币约 0.45 秒，军功符约 0.38 秒）；到达时目标反馈（行囊缩放回弹 + 鼓起贴图；经验条由 onArrive 亮一下）。
 * 钱币两种来源：burst(from, amount)（通用入口）/ 盯数值 value() 一涨。数量按多少分档 1 / 3 / 5 枚。
 * 同屏上限：钱币 12 枚、军功符 10 枚（绕转阶段也算）；军功符另限每 0.1 秒最多起飞 2 枚。超出的只入账、不画。
 * displayLag()：还没到达的钱（界面显示 真值 − lag，到达时数字跳到新值）。真实时间驱动（performance.now），暂停 / 弹窗不卡；超时一律算到。
 * 图：铜钱 coin_flip（6 帧翻转）、军功符用信物自己的贴图（gem_tok_small 青玉 / gem_tok_large 金令牌）、行囊鼓起 bundle_full。不画程序图形。
 */
export interface CoinFlyOpts {
  /** 盯的数值（军功符那一个实例不盯，给 () => 0）。 */
  value: () => number;
  /** 目标图标（HUD 坐标）；没有时只入账不飞。 */
  purse: () => Phaser.GameObjects.Image | null;
  /** 盯数值时这次涨的钱从哪飞起（HUD 坐标；orbit = 是主将自己捡的，先绕身）；不给就从屏幕中间。 */
  from?: () => { x: number; y: number; orbit?: boolean } | null;
  sfx?: () => Sfx | null | undefined;
  depth: number;
  /** 现在能不能飞；false 时数值变化只同步、不飞。 */
  armed?: () => boolean;
  /** 每帧回调：显示值（真值 − 还没到的）。 */
  onFrame?: (shown: number) => void;
  /** 到达时目标放大多少（默认 .22；行囊 .08；0 = 不缩放）。 */
  bump?: number;
  /** 到达时目标短暂切换的贴图（行囊鼓起 bundle_full），0.25 秒后切回。 */
  flashKey?: string;
  /** 每枚到达时的额外反馈（经验条亮一下）。 */
  onArrive?: () => void;
  /** 到达时播不播「落袋」声（钱币播；军功符不加新声音）。 */
  landSound?: boolean;
  /** 绕身阶段（战斗、电脑布局）：主将世界坐标与图层、世界 → HUD 坐标换算。 */
  orbit?: { anchor: () => { x: number; y: number; depth: number; /** 1 世界像素 = 多少 HUD 逻辑像素（半径、尺寸按屏幕算） */ k: number } | null; toUi: (x: number, y: number) => { x: number; y: number } };
  /** 钱币显示尺寸（逻辑像素）。 */
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
const COIN_DUR = 450, TOKEN_DUR = 380, STAGGER = 55, COIN_MAX = 12, SETTLE_MS = 1500, POP = .22, FLASH_MS = 250, CLAIM_MS = 1500;
const ORBIT_MS = 350, ORBIT_SWEEP = Math.PI * 1.5, ORBIT_RISE = 10, ORBIT_SQUASH = .45, ORBIT_LIFT = 20;
const TOKEN_WINDOW = 100, TOKEN_PER_WINDOW = 2, TOKEN_MAX = 10;
interface Batch { amount: number; t0: number; left: number }
interface Flyer {
  kind: 'coin' | 'token'; key: string; frame: number; size: number; flip: boolean;
  phase: 'orbit' | 'fly'; t0: number; a0: number; r: number;
  world: Phaser.GameObjects.Image | null; hud: Phaser.GameObjects.Image | null;
  x0: number; y0: number; cx: number; cy: number; batch: Batch | null; orbited: boolean;
}

export class CoinFly {
  private last: number;
  private flyers: Flyer[] = [];
  private batches: Batch[] = [];
  private claims: Array<{ amount: number; t: number }> = [];
  private tokenLaunches: number[] = [];
  private bumpAt = -1e9;
  private flashUntil = 0; private flashBase = '';
  private purseBase = -1; private baseFor: Phaser.GameObjects.Image | null = null;
  private orbitSeed = Math.random() * Math.PI * 2;
  private readonly onUpdate = (): void => this.update();
  constructor(private readonly scene: Phaser.Scene, private readonly o: CoinFlyOpts) {
    this.last = o.value();
    ensureCoinArt(scene);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }
  destroy(): void { this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate); for (const f of this.flyers) { f.world?.destroy(); f.hud?.destroy(); } this.flyers = []; this.batches = []; }
  /** 还没到达的钱（界面显示 真值 − 这个数）。 */
  displayLag(): number { const now = performance.now(); let n = 0; for (const b of this.batches) if (now - b.t0 < SETTLE_MS) n += b.amount; return n; }
  resync(): void { this.last = this.o.value(); }
  /** 测试用。 */
  get flying(): number { return this.flyers.filter(f => f.kind === 'coin').length; }
  get tokensFlying(): number { return this.flyers.filter(f => f.kind === 'token').length; }
  get orbiting(): number { return this.flyers.filter(f => f.phase === 'orbit').length; }
  tokensLaunched = 0; flashes = 0; arrivals = 0; orbitsSeen = 0; lastLand: { x: number; y: number } | null = null;

  /** 钱币通用入口：钱应当已经（或马上）加进数值里；这里只管表现。 */
  burst(from: { x: number; y: number }, amount: number, orbit = true): void {
    if (!(amount > 0)) return;
    this.claims.push({ amount, t: performance.now() });
    this.coins(from, amount, performance.now(), orbit);
  }
  /** 军功符：从 from（HUD 坐标；有 orbit 时从主将身边起转）飞一枚信物到目标；超过限流就不画。返回是否起飞。 */
  token(from: { x: number; y: number }, key: string, frame: number, size: number): boolean {
    const now = performance.now();
    this.tokenLaunches = this.tokenLaunches.filter(t => now - t < TOKEN_WINDOW);
    if (!this.o.purse() || !this.scene.textures.exists(key) || this.tokensFlying >= TOKEN_MAX || this.tokenLaunches.length >= TOKEN_PER_WINDOW) return false;
    this.tokenLaunches.push(now); this.tokensLaunched++;
    this.spawn('token', key, frame, size, false, from, now, 0, 1, null, true);
    return true;
  }

  private update(): void {
    const now = performance.now(), v = this.o.value();
    this.claims = this.claims.filter(c => now - c.t < CLAIM_MS && c.amount > 0);
    if (v < this.last || (v > this.last && this.o.armed && !this.o.armed())) { this.last = v; this.claims = []; }
    else if (v > this.last) {
      let d = v - this.last; this.last = v;
      for (const c of this.claims) { const k = Math.min(c.amount, d); c.amount -= k; d -= k; if (!d) break; }
      if (d > 0) { const fr = this.o.from?.() ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }; this.coins(fr, d, now, !!fr.orbit); }
    }
    const purse = this.o.purse(), anchor = this.o.orbit?.anchor() ?? null;
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      if (f.phase === 'orbit') {
        const k = (now - f.t0) / ORBIT_MS;
        if (k < 0) { f.world?.setVisible(false); continue; }
        if (k < 1 && anchor && f.world) {
          // 贴身绕转：椭圆（俯视透视），转到上半圈（主将身后）画在主将图层之下；跟着主将走；略微上浮
          const e = k < .5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k), a = f.a0 + ORBIT_SWEEP * e, sy = Math.sin(a);
          f.world.setVisible(true).setPosition(anchor.x + Math.cos(a) * f.r, anchor.y - (ORBIT_LIFT + ORBIT_RISE * k) / anchor.k + sy * f.r * ORBIT_SQUASH).setDepth(anchor.depth + (sy < 0 ? -.01 : .01));
          if (f.flip) f.world.setFrame(Math.floor((now - f.t0) / 70) % 6);
          continue;
        }
        // 绕转结束（或主将没了）：换成 HUD 上的飞行
        const p = f.world && this.o.orbit ? this.o.orbit.toUi(f.world.x, f.world.y) : { x: f.x0, y: f.y0 };
        f.world?.destroy(); f.world = null;
        this.toFly(f, p, now, purse);
        continue;
      }
      const dur = f.kind === 'coin' ? COIN_DUR : TOKEN_DUR, k = (now - f.t0) / dur;
      if (k < 0) { f.hud?.setVisible(false); continue; }
      if (k >= 1 || !purse) { this.land(f, now); this.flyers.splice(i, 1); continue; }
      let x: number, y: number;
      const pop = f.kind === 'coin' && !f.orbited ? POP : 0; // 没有绕身阶段时先弹起一点再飞
      if (k < pop) { const e = Math.sin((k / pop) * Math.PI / 2); x = f.x0; y = f.y0 - 10 * e; }
      else { const u = pop ? (k - pop) / (1 - pop) : k, t = u * u, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t, sy = f.y0 - (pop ? 10 : 0); x = a * f.x0 + b * f.cx + d * purse.x; y = a * sy + b * f.cy + d * purse.y; }
      f.hud?.setVisible(true).setPosition(x, y).setScale((f.hud.getData('s') as number) * (1 - .25 * Math.max(0, k - .7) / .3));
      if (f.flip && f.hud) (f.hud as Phaser.GameObjects.Sprite).setFrame(Math.floor((now - f.t0) / 70) % 6);
    }
    this.batches = this.batches.filter(b => b.left > 0 && now - b.t0 < SETTLE_MS);
    this.o.onFrame?.(Math.max(0, Math.round(v - this.displayLag())));
    if (purse && (this.o.bump ?? .22) > 0) {
      if (purse !== this.baseFor || this.purseBase < 0 || Math.abs(purse.scaleX - this.purseBase) > this.purseBase * .5) { this.purseBase = purse.scaleX; this.baseFor = purse; }
      const amp = this.o.bump ?? .22, e = (now - this.bumpAt) / 220, s = e >= 0 && e < 1 ? 1 + amp * Math.sin(e * Math.PI) * (1 - e * .4) : 1;
      purse.setScale(this.purseBase * s);
      if (this.flashBase && now >= this.flashUntil) { if (purse.texture.key === this.o.flashKey) purse.setTexture(this.flashBase); this.flashBase = ''; }
    }
  }
  /** 一笔钱：捡到的铜钱声 + 1 / 3 / 5 枚（同屏 ≤ 12）。 */
  private coins(src: { x: number; y: number }, amount: number, now: number, orbit: boolean): void {
    this.o.sfx?.()?.coin();
    if (!this.o.purse()) return;
    const n = amount < 5 ? 1 : amount < 20 ? 3 : 5, room = Math.max(0, COIN_MAX - this.flying), fly = Math.min(n, room);
    const batch: Batch = { amount, t0: now, left: Math.max(1, fly) };
    this.batches.push(batch);
    if (!fly) { batch.left = 0; this.bump(now); return; }
    const flip = this.scene.textures.exists(COIN_ART.flip);
    for (let i = 0; i < fly; i++) this.spawn('coin', COIN_ART.flip, Math.floor(Math.random() * 6), this.o.size ?? 18, flip, src, now + i * STAGGER, i, fly, batch, orbit);
  }
  private spawn(kind: Flyer['kind'], key: string, frame: number, size: number, flip: boolean, src: { x: number; y: number }, t0: number, idx: number, of: number, batch: Batch | null, orbit: boolean): void {
    const anchor = orbit ? this.o.orbit?.anchor() ?? null : null, has = this.scene.textures.exists(key);
    // 起始角度：每笔轮换一个基准，同一笔内平均错开，像一小串绕着转
    if (idx === 0) this.orbitSeed += 2.1;
    const k = anchor?.k ?? 1, a0 = this.orbitSeed - idx * (1.6 / Math.max(1, of)), r = (26 + Math.random() * 8) / k;
    const f: Flyer = { kind, key, frame, size, flip, phase: anchor ? 'orbit' : 'fly', t0, a0, r, world: null, hud: null, x0: src.x, y0: src.y, cx: 0, cy: 0, batch, orbited: false };
    if (anchor && has) {
      // 世界坐标里的贴图（跟主将同一个镜头，才能前后遮挡）；尺寸按世界像素（镜头会放大）
      const img = kind === 'coin' && flip ? this.scene.add.sprite(anchor.x, anchor.y, key, frame) : this.scene.add.image(anchor.x, anchor.y, key, frame);
      img.setVisible(false).setName(kind === 'coin' ? 'coin-orbit' : 'token-orbit'); img.setScale(size / k / Math.max(1, img.width)); f.world = img; f.orbited = true; this.orbitsSeen++;
    } else f.phase = 'fly';
    if (f.phase === 'fly') this.toFly(f, src, t0, this.o.purse());
    this.flyers.push(f);
  }
  private toFly(f: Flyer, p: { x: number; y: number }, now: number, purse: Phaser.GameObjects.Image | null): void {
    f.phase = 'fly'; f.t0 = Math.max(f.t0, now); f.x0 = p.x; f.y0 = p.y;
    const tx = purse?.x ?? p.x, ty = purse?.y ?? p.y;
    f.cx = (p.x + tx) / 2 + (Math.random() - .5) * 40; f.cy = Math.min(p.y, ty) - 45 - Math.random() * 25;
    if (!this.scene.textures.exists(f.key)) return;
    const img = f.kind === 'coin' && f.flip ? this.scene.add.sprite(p.x, p.y, f.key, f.frame) : this.scene.add.image(p.x, p.y, f.key, f.frame);
    img.setScrollFactor(0).setDepth(this.o.depth).setVisible(false).setName(f.kind === 'coin' ? 'coin-fly' : 'token-fly');
    const s = f.size / Math.max(1, img.width); img.setScale(s).setData('s', s); f.hud = img;
  }
  private land(f: Flyer, now: number): void {
    if (f.hud) this.lastLand = { x: f.hud.x, y: f.hud.y };
    f.hud?.destroy(); f.world?.destroy(); this.arrivals++;
    if (f.batch) f.batch.left--;
    this.bump(now); this.o.onArrive?.();
    if (this.o.landSound !== false && f.kind === 'coin') this.o.sfx?.()?.play('coinPurse');
  }
  private bump(now: number): void {
    this.bumpAt = now;
    const purse = this.o.purse(), fk = this.o.flashKey;
    if (purse && fk && this.scene.textures.exists(fk)) { if (purse.texture.key !== fk) { this.flashBase = purse.texture.key; purse.setTexture(fk); this.flashes++; } this.flashUntil = now + FLASH_MS; }
  }
}
