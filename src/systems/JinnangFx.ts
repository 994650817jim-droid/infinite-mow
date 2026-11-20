import Phaser from 'phaser';
import { DEPTH, IS_DESKTOP, actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { JinnangId } from './LevelCards';

/**
 * 锦囊激活特效（2026-11-19 用户「关于流派和道具特效做一下」）：8 个锦囊原来只有横幅 + 音效（只有火计有画面）。
 * 手绘序列帧（ChatGPT，黑底转透明，6 列 × 4 行、每格 256，行内 6 帧）：
 *  fx_jn1：伏兵 / 鸣金 / 疑兵 / 擂鼓（激活）；fx_jn2：火计 / 空城计 / 草船借箭 / 连环计（激活）；fx_jn3：擂鼓 / 空城计 / 草船借箭 的持续光罩（循环）+ 连环标记（敌人身上，循环）。
 * 激活爆发播一遍（大，按效果范围）；持续类再在主将身上套一层循环光罩，到期消失；连环计给被连住的敌人各画一个小锁链标记。缺图什么都不画。
 */
export const JINNANG_FX = {
  /** 激活爆发：图集、行、显示边长（世界像素，已按图里内容占比放大）、时长。 */
  burst: {
    ambush: { key: 'fx_jn1', row: 0, size: 200, ms: 800 }, gong: { key: 'fx_jn1', row: 1, size: 230, ms: 800 }, feint: { key: 'fx_jn1', row: 2, size: 360, ms: 900 }, drum: { key: 'fx_jn1', row: 3, size: 210, ms: 800 },
    fire: { key: 'fx_jn2', row: 0, size: 340, ms: 800 }, empty: { key: 'fx_jn2', row: 1, size: 170, ms: 700 }, arrows: { key: 'fx_jn2', row: 2, size: 230, ms: 800 }, chain: { key: 'fx_jn2', row: 3, size: 240, ms: 800 },
  } as Record<JinnangId, { key: string; row: number; size: number; ms: number }>,
  /** 持续光罩（套在主将身上循环）：行、时长（毫秒，和锦囊实际持续一致）、显示边长、透明度。 */
  sustain: { drum: { row: 0, ms: 10000, size: 150, alpha: .55 }, empty: { row: 1, ms: 2500, size: 150, alpha: .7 }, arrows: { row: 2, ms: 6000, size: 150, alpha: .6 } } as Partial<Record<JinnangId, { row: number; ms: number; size: number; alpha: number }>>,
  mark: { key: 'fx_jn3', row: 3, cap: 12, fps: 10, size: 150 }, cap: 16,
} as const;

export class JinnangFx {
  private readonly lite = !IS_DESKTOP;
  private live = 0;
  private readonly marks: Phaser.GameObjects.Image[] = [];
  private sustainImg: Phaser.GameObjects.Image | null = null; private sustainUntil = 0; private sustainRow = 0;
  readonly stats = { bursts: 0, sustains: 0, marks: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly follow: () => { x: number; y: number }) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { for (const m of this.marks) m.destroy(); this.marks.length = 0; this.sustainImg?.destroy(); this.sustainImg = null; });
  }
  has(key: string): boolean { return this.scene.textures.exists(key); }

  /** 锦囊激活：爆发 + （持续类）主将身上的循环光罩。 */
  cast(id: JinnangId, x: number, y: number, now: number): void {
    const b = JINNANG_FX.burst[id]; if (!b || !this.has(b.key)) return;
    this.stats.bursts++; this.burst(b, x, y);
    const s = JINNANG_FX.sustain[id]; if (s && this.has('fx_jn3') && !this.lite) { this.stats.sustains++; this.sustainRow = s.row; this.sustainUntil = now + s.ms; this.ensureSustain().setAlpha(s.alpha).setDisplaySize(s.size, s.size).setVisible(true); }
  }
  private burst(b: { key: string; row: number; size: number; ms: number }, x: number, y: number): void {
    if (this.live >= JINNANG_FX.cap) return;
    this.live++;
    const img = this.scene.add.image(x, y - 6, b.key, b.row * 6).setDisplaySize(b.size, b.size).setAlpha(.85).setDepth(DEPTH.fx + 2).setName('jinnang-fx');
    this.scene.tweens.addCounter({ from: 0, to: 5.99, duration: b.ms, onUpdate: tw => img.setFrame(b.row * 6 + Math.floor(tw.getValue() ?? 0)), onComplete: () => { this.live--; img.destroy(); } });
  }
  private ensureSustain(): Phaser.GameObjects.Image { return this.sustainImg ??= this.scene.add.image(0, 0, 'fx_jn3', 0).setOrigin(.5, .62).setVisible(false).setName('jinnang-sustain'); }

  /** 每帧：持续光罩跟着主将换帧；连环计给被连住的敌人画小锁链（set = GameScene.chain.set）。 */
  update(now: number, chain?: { until: number; set: Map<Enemy, number> }): void {
    const K = JINNANG_FX;
    if (this.sustainImg?.visible) {
      if (now >= this.sustainUntil) this.sustainImg.setVisible(false);
      else { const p = this.follow(); this.sustainImg.setFrame(this.sustainRow * 6 + Math.floor(now / 100) % 6).setPosition(p.x, p.y).setDepth(actorDepth(p.y) + .03); }
    }
    let n = 0;
    if (chain && chain.until > now && this.has(K.mark.key) && !this.lite) {
      for (const [e, life] of chain.set) {
        if (!e.active || e.spawnId !== life || n >= K.mark.cap) continue;
        let m = this.marks[n]; if (!m) { m = this.scene.add.image(0, 0, K.mark.key, 0).setOrigin(.5, .62).setName('jinnang-chain-mark'); this.marks.push(m); this.stats.marks++; }
        const h = Math.max(40, Math.abs(e.sprite.displayHeight) * 1.15), d = Math.max(h * 1.3, 50);
        m.setFrame(K.mark.row * 6 + Math.floor(now / (1000 / K.mark.fps)) % 6).setDisplaySize(d, d).setPosition(e.x, e.y - 6).setDepth(actorDepth(e.y) + .02).setAlpha(.85).setVisible(true); n++;
      }
    }
    for (let i = n; i < this.marks.length; i++) this.marks[i].setVisible(false);
  }
}
