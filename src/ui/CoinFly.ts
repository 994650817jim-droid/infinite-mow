import Phaser from 'phaser';
import type { Sfx } from '../systems/Sfx';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * 钱币飞入钱袋（2026-11-21 用户：「需要做个拾取到钱币的音效，然后钱币会有个动画飞去金币袋里，现在军粮变成钱币」）。
 *
 * 用法：每帧盯一个数值（战斗 = 随军钱币 legion.food，行营 / 营寨 = 钱币 provisions）。数值一涨，就从「来源点」飞几枚手绘铜钱到钱袋图标：
 *  - 数量按这次涨了多少分档：< 5 → 1 枚，< 20 → 3 枚，其余 5 枚；同屏飞行最多 12 枚（超出的只入账、不飞）。
 *  - 轨迹：先微微弹起（前 22% 时间往上 10px），再沿二次贝塞尔弧线加速飞到钱袋（约 0.45 秒，逐枚错开 55ms）。
 *  - 每枚落袋：钱袋缩放回弹一下、轻「落袋」声；整笔最后一枚到达时，显示的数字跳到新值。
 * 数值在获得时就已入账，这里只是表现：displayLag() 给出「还在飞的那部分」，界面显示 真值 − lag。
 * 用真实时间（performance.now）驱动，不吃场景时钟——暂停 / 弹窗时战斗时钟停了也不会卡住；超过 0.9 秒还没落袋的一律当作已到（不丢计数）。
 * 图：铜钱用经验宝石的青铜古钱 gem_tok_small 第 0 帧；钱袋图标由调用方给（美术出钱袋前先用营地道具图集的钱袋帧）。不画程序图形。
 */
export interface CoinFlyOpts {
  /** 盯的数值。 */
  value: () => number;
  /** 钱袋图标（屏幕 / HUD 坐标）；没有时只入账不飞。 */
  purse: () => Phaser.GameObjects.Image | null;
  /** 这次涨的钱从哪飞起（HUD 坐标）；不给就从屏幕中间。 */
  from?: () => { x: number; y: number } | null;
  sfx?: () => Sfx | null | undefined;
  depth: number;
  /** 现在能不能飞（例如战斗开打、没有弹窗）；false 时数值变化只同步、不飞（开局载入上一关带来的钱之类）。 */
  armed?: () => boolean;
  /** 每帧回调：显示值（真值 − 还在飞的）——界面用它刷新数字，落袋时跳到新值。 */
  onFrame?: (shown: number) => void;
  /** 铜钱显示尺寸（逻辑像素）。 */
  size?: number;
}
const DUR = 450, STAGGER = 55, MAX_LIVE = 12, SETTLE_MS = 900, POP = .22;
interface Coin { img: Phaser.GameObjects.Image | null; t0: number; x0: number; y0: number; cx: number; cy: number; batch: Batch }
interface Batch { amount: number; t0: number; left: number }

export class CoinFly {
  private last: number;
  private coins: Coin[] = [];
  private batches: Batch[] = [];
  private bumpAt = -1e9;
  private purseBase = -1;
  private readonly onUpdate = (): void => this.update();
  constructor(private readonly scene: Phaser.Scene, private readonly o: CoinFlyOpts) {
    this.last = o.value();
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }
  destroy(): void { this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate); for (const c of this.coins) c.img?.destroy(); this.coins = []; this.batches = []; }
  /** 还在飞、没落袋的钱（界面显示 真值 − 这个数）。 */
  displayLag(): number { const now = performance.now(); let n = 0; for (const b of this.batches) if (now - b.t0 < SETTLE_MS) n += b.amount; return n; }
  /** 数值被别处直接改小（花钱）或重置时，同步基准，不飞。 */
  resync(): void { this.last = this.o.value(); }

  private update(): void {
    const now = performance.now(), v = this.o.value();
    if (v < this.last || (v > this.last && this.o.armed && !this.o.armed())) this.last = v; // 花掉了 / 不在可飞的时候：不飞，跟上
    else if (v > this.last) { this.gain(v - this.last, now); this.last = v; }
    // 飞行
    const purse = this.o.purse(), tx = purse?.x ?? 0, ty = purse?.y ?? 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i], k = (now - c.t0) / DUR;
      if (k < 0) { c.img?.setVisible(false); continue; }
      if (k >= 1 || !purse) { this.land(c, now); this.coins.splice(i, 1); continue; }
      let x: number, y: number;
      if (k < POP) { const e = Math.sin((k / POP) * Math.PI / 2); x = c.x0; y = c.y0 - 10 * e; }
      else { const u = (k - POP) / (1 - POP), t = u * u, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t, sy = c.y0 - 10; x = a * c.x0 + b * c.cx + d * tx; y = a * sy + b * c.cy + d * ty; }
      c.img?.setVisible(true).setPosition(x, y).setScale((c.img.getData('s') as number) * (1 - .25 * Math.max(0, k - .7) / .3)).setAngle(k * 220);
    }
    // 落袋后整笔都到了或超时：清掉
    this.batches = this.batches.filter(b => b.left > 0 && now - b.t0 < SETTLE_MS);
    this.o.onFrame?.(Math.max(0, Math.round(v - this.displayLag())));
    // 钱袋回弹
    if (purse) {
      if (this.purseBase < 0) this.purseBase = purse.scaleX;
      const e = (now - this.bumpAt) / 220, s = e >= 0 && e < 1 ? 1 + .22 * Math.sin(e * Math.PI) * (1 - e * .4) : 1;
      purse.setScale(this.purseBase * s);
    }
  }
  private gain(amount: number, now: number): void {
    this.o.sfx?.()?.coin();
    const purse = this.o.purse(); if (!purse) return;
    const n = amount < 5 ? 1 : amount < 20 ? 3 : 5, room = Math.max(0, MAX_LIVE - this.coins.length), fly = Math.min(n, room);
    const batch: Batch = { amount, t0: now, left: Math.max(1, fly) };
    this.batches.push(batch);
    if (!fly) { batch.left = 0; this.bump(now); return; }
    const src = this.o.from?.() ?? { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 } /* 逻辑尺寸（画布可能是 2× 像素） */;
    const size = this.o.size ?? 16, has = this.scene.textures.exists('gem_tok_small');
    for (let i = 0; i < fly; i++) {
      const x0 = src.x + (Math.random() - .5) * 18, y0 = src.y + (Math.random() - .5) * 12;
      // 控制点：起点与钱袋连线中点往上抬，让弧线先上后下
      const cx = (x0 + purse.x) / 2 + (Math.random() - .5) * 40, cy = Math.min(y0, purse.y) - 50 - Math.random() * 30;
      let img: Phaser.GameObjects.Image | null = null;
      if (has) { img = this.scene.add.image(x0, y0, 'gem_tok_small', 0).setScrollFactor(0).setDepth(this.o.depth).setVisible(false).setName('coin-fly'); const s = size / 64 * 1.25; img.setScale(s).setData('s', s); }
      this.coins.push({ img, t0: now + i * STAGGER, x0, y0, cx, cy, batch });
    }
  }
  private land(c: Coin, now: number): void {
    c.img?.destroy(); c.batch.left--; this.bump(now);
    this.o.sfx?.()?.play('coinPurse');
  }
  private bump(now: number): void { this.bumpAt = now; }
  /** 测试用：当前在飞的铜钱数。 */
  get flying(): number { return this.coins.length; }
}
