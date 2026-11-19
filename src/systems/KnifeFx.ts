import Phaser from 'phaser';
import { DEPTH } from '../config';

/**
 * 祝融夫人飞刀特效（2026-11-18，ChatGPT 手绘序列帧，tools/prepare-black-fx.mjs 去黑底）：
 *  - 飞行：8 帧旋转飞刀 + 红橙羽毛状火焰拖尾（帧 0–7，每帧多转 45°，转一圈无缝循环；图里刀尖朝右 = 飞行方向，整张按飞行方向旋转）；
 *  - 命中：6 帧火花爆开（帧 8–13：闪光 → 火焰环 → 余烬）。
 * 图集 fx_zhurong_knife：1024×1024，4×4，每格 256，SKILL_FX 登记、loadSkillFx 预载；缺图时什么都不画、命中回调照样触发（不影响玩法）。
 * 只管表现：伤害 / 判定由首领招式自己做，在 onHit(x, y) 里接。
 */
export const KNIFE_FX = {
  key: 'fx_zhurong_knife', knifeFrames: 8, hitFrom: 8, hitFrames: 6,
  /** 飞行速度 px/s；旋转帧率；命中动画时长（ms）；显示边长（世界像素，格子 256，刀约占格宽 43%、火花约 80%）。 */
  speed: 360, spinFps: 18, hitMs: 420, knifeSize: 86, hitSize: 130, cap: 48,
} as const;

interface Knife { img: Phaser.GameObjects.Image; active: boolean; phase: 'fly' | 'hit'; t: number; x0: number; y0: number; x1: number; y1: number; dur: number; onHit?: (x: number, y: number) => void; size: number }

export interface KnifeOpts {
  /** 飞行速度 px/s（默认 KNIFE_FX.speed）。 */ speed?: number;
  /** 刀显示边长倍率（默认 1）。 */ scale?: number;
  /** 到达目标时回调（只调一次）：伤害判定放这里。 */ onHit?: (x: number, y: number) => void;
  /** 到了目标不播命中火花（例如穿过去的飞刀）。 */ noImpact?: boolean;
}

export class KnifeFx {
  private readonly pool: Knife[] = [];
  private readonly bound: (t: number, dt: number) => void;
  readonly stats = { fired: 0, hits: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.bound = (_t, dt) => this.update(dt * (((this.scene as unknown as { devTimeScale?: number }).devTimeScale) ?? 1));
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.bound);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get ready(): boolean { return this.scene.textures.exists(KNIFE_FX.key); }
  get activeCount(): number { let n = 0; for (const k of this.pool) if (k.active) n++; return n; }
  /** 场上还在飞 / 还在爆的刀（测试用）。 */
  get live(): readonly Knife[] { return this.pool.filter(k => k.active); }

  /** 从 (x0,y0) 朝 (x1,y1) 扔一把飞刀；飞到后在目标点爆开火花。 */
  fire(x0: number, y0: number, x1: number, y1: number, o: KnifeOpts = {}): void {
    this.stats.fired++;
    const dist = Math.hypot(x1 - x0, y1 - y0), speed = o.speed ?? KNIFE_FX.speed, size = KNIFE_FX.knifeSize * (o.scale ?? 1);
    let k = this.pool.find(p => !p.active);
    if (!k) {
      if (this.pool.length >= KNIFE_FX.cap) { o.onHit?.(x1, y1); this.stats.hits++; return; }   // 池满：不画，判定照给
      k = { img: this.scene.add.image(0, 0, KNIFE_FX.key, 0).setVisible(false).setName('zhurong-knife'), active: false, phase: 'fly', t: 0, x0, y0, x1, y1, dur: 1, size };
      this.pool.push(k);
    }
    k.active = true; k.phase = 'fly'; k.t = 0; k.x0 = x0; k.y0 = y0; k.x1 = x1; k.y1 = y1; k.dur = Math.max(1, dist / speed * 1000); k.size = size; k.onHit = o.onHit;
    (k as Knife & { noImpact?: boolean }).noImpact = !!o.noImpact;
    if (this.ready) k.img.setFrame(0).setDisplaySize(size, size).setPosition(x0, y0).setRotation(Math.atan2(y1 - y0, x1 - x0)).setAlpha(1).setDepth(DEPTH.projectile + 1).setVisible(true);
  }

  /** 扇形扔 n 把（中心线朝 (tx,ty)，相邻夹角 spreadDeg，射程 range）。 */
  fan(x0: number, y0: number, tx: number, ty: number, n: number, spreadDeg: number, range: number, o: KnifeOpts = {}): void {
    const base = Math.atan2(ty - y0, tx - x0);
    for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * spreadDeg * Math.PI / 180; this.fire(x0, y0, x0 + Math.cos(a) * range, y0 + Math.sin(a) * range, o); }
  }

  private update(dtMs: number): void {
    const D = KNIFE_FX;
    for (const k of this.pool) {
      if (!k.active) continue;
      k.t += dtMs;
      if (k.phase === 'fly') {
        const u = Math.min(1, k.t / k.dur);
        if (this.ready) { const f = Math.floor(k.t / 1000 * D.spinFps) % D.knifeFrames; k.img.setFrame(f).setPosition(k.x0 + (k.x1 - k.x0) * u, k.y0 + (k.y1 - k.y0) * u); }
        if (u >= 1) {
          this.stats.hits++; k.onHit?.(k.x1, k.y1);
          if ((k as Knife & { noImpact?: boolean }).noImpact || !this.ready) { k.active = false; k.img.setVisible(false); continue; }
          k.phase = 'hit'; k.t = 0; k.img.setFrame(D.hitFrom).setRotation(0).setDisplaySize(D.hitSize * k.size / D.knifeSize, D.hitSize * k.size / D.knifeSize).setPosition(k.x1, k.y1);
        }
      } else {
        const u = k.t / D.hitMs;
        if (u >= 1) { k.active = false; k.img.setVisible(false); continue; }
        k.img.setFrame(D.hitFrom + Math.min(D.hitFrames - 1, Math.floor(u * D.hitFrames)));
      }
    }
  }

  destroy(): void { this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.bound); for (const k of this.pool) k.img.destroy(); this.pool.length = 0; }
}
