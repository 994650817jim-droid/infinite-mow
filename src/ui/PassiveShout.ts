import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import type { CharacterId } from '../data/characters';
import type { CharacterPassives } from '../systems/CharacterPassives';

/**
 * 被动满层台词：被动刚攒满（下一击要强化）的那一刻，在武将头顶飘一句台词，配脚下一圈淡金光和一声短鼓。
 * 只在「未满 → 满」的那一帧触发；同一武将两次之间至少隔 minGapMs，避免连续攒满时刷屏。
 * 想给别的武将配台词，往 PASSIVE_FULL_SHOUTS 里加一行即可（不配就不喊）。
 */
export interface PassiveFullShout { lines: readonly string[]; color: string; minGapMs: number; }
export const PASSIVE_FULL_SHOUTS: Partial<Record<CharacterId, PassiveFullShout>> = {
  // 2026-11-16 用户选定台词：马超「西凉铁骑」满 6 层、下一枪要冲锋时喊一句，三句轮流
  machao: { lines: ['吾乃西凉马孟起！', '铁骑踏阵，片甲不留！', '锦马超在此，谁敢一战！'], color: '#ffd77a', minGapMs: 15000 },
};

export class PassiveShout {
  private wasReady = false; private character: CharacterId | null = null;
  private lastAt = -Infinity; private next = 0;
  /** 测试用：累计喊了几次、最近一句。 */
  count = 0; lastLine = '';
  constructor(private readonly scene: Phaser.Scene, private readonly sfx?: () => void) {}
  /** 每帧调用。x / y 为武将脚底位置，now 为战斗时间（毫秒）。 */
  update(passive: CharacterPassives, now: number, x: number, y: number, visible: boolean): void {
    const id = passive.characterId;
    if (id !== this.character) { this.character = id; this.wasReady = false; this.lastAt = -Infinity; this.next = 0; }
    const ready = passive.snapshot(now).ready, rose = ready && !this.wasReady;
    this.wasReady = ready;
    const cfg = PASSIVE_FULL_SHOUTS[id];
    if (!rose || !cfg || !visible || now - this.lastAt < cfg.minGapMs) return;
    this.lastAt = now;
    this.shout(cfg.lines[this.next++ % cfg.lines.length], cfg.color, x, y);
  }
  private shout(line: string, color: string, x: number, y: number): void {
    this.count++; this.lastLine = line;
    const text = this.scene.add.text(x, y - 66, line, { fontFamily: FONT, fontSize: '13px', color, stroke: '#2a1608', strokeThickness: 3, resolution: 2 })
      .setOrigin(.5, 1).setDepth(DEPTH.dmgText + 2).setAlpha(0).setScale(.85).setName('passive-shout');
    this.scene.tweens.add({ targets: text, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: text, y: y - 78, alpha: 0, delay: 1300, duration: 450, ease: 'Sine.In', onComplete: () => text.destroy() });
    // 脚下一圈淡金光：一次，0.45 秒散开
    const ring = this.scene.add.graphics().setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setName('passive-shout-ring');
    const r = { t: 0 };
    this.scene.tweens.add({ targets: r, t: 1, duration: 450, ease: 'Quad.Out',
      onUpdate: () => { ring.clear().lineStyle(3 - r.t * 2, 0xffd77a, .55 * (1 - r.t)).strokeEllipse(x, y, 40 + r.t * 70, (40 + r.t * 70) * .45); },
      onComplete: () => ring.destroy() });
    this.sfx?.();
  }
}
