import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import type { CharacterId } from '../data/characters';
import type { CharacterPassives } from '../systems/CharacterPassives';

/**
 * 被动满层台词：被动刚攒满（下一击要强化）的那一刻，在武将头顶飘一句台词，人物身上闪一下金光，配一声短鼓。
 * 2026-11-16 技能提示方案 C：除首领大招外地上不画圈，所以不画脚下光圈。
 * 只在「未满 → 满」的那一帧触发；同一武将喊过后 cooldownMs（默认 PASSIVE_SHOUT_COOLDOWN_MS）内再攒满不喊（被动效果照常触发），避免刷屏。
 * 想给别的武将配台词，往 PASSIVE_FULL_SHOUTS 里加一行即可（不配就不喊）。
 */
/** 默认：同一武将两次喊话的最短间隔（2026-11-16 用户：台词不要太频繁 → 60 秒）。单个武将可用 cooldownMs 覆盖。 */
export const PASSIVE_SHOUT_COOLDOWN_MS = 60000;
export interface PassiveFullShout { lines: readonly string[]; color: string; cooldownMs?: number; }
export const PASSIVE_FULL_SHOUTS: Partial<Record<CharacterId, PassiveFullShout>> = {
  // 2026-11-16 用户选定台词：马超「西凉铁骑」满 6 层、下一枪要冲锋时喊一句，三句轮流；
  // 用户：「马超可以被动好了就出发台词」→ 不设冷却，每次攒满都喊
  machao: { lines: ['吾乃西凉马孟起！', '铁骑踏阵，片甲不留！', '锦马超在此，谁敢一战！'], color: '#ffd77a', cooldownMs: 0 },
  // 2026-11-16 用户定稿台词：孙尚香「侍婢执刀」疾步满 6 层、下一次掷刀召侍婢时喊一句，三句轮流
  sunshangxiang: { lines: ['侍婢何在，随我执刀！', '弓腰姬在此，谁敢近前！', '江东孙尚香，岂输男儿！'], color: '#ffb8a0' },
};

export class PassiveShout {
  private wasReady = false; private triggers = 0; private character: CharacterId | null = null;
  private lastAt = -Infinity; private next = 0;
  /** 测试用：累计喊了几次、最近一句。 */
  count = 0; lastLine = '';
  constructor(private readonly scene: Phaser.Scene, private readonly sfx?: () => void) {}
  /** 每帧调用。x / y 为武将脚底位置，now 为战斗时间（毫秒）；body 为武将身体图（用来闪金光）。 */
  update(passive: CharacterPassives, now: number, x: number, y: number, visible: boolean, body?: Phaser.GameObjects.Image): void {
    const id = passive.characterId;
    const snap = passive.snapshot(now);
    if (id !== this.character) { this.character = id; this.wasReady = false; this.triggers = snap.triggers; this.lastAt = -Infinity; this.next = 0; }
    // 刚攒满；或同一帧里攒满又立刻放出（没看到满层就多了一次触发）也算
    const ready = snap.ready, rose = (ready && !this.wasReady) || (snap.triggers > this.triggers && !this.wasReady);
    this.wasReady = ready; this.triggers = snap.triggers;
    const cfg = PASSIVE_FULL_SHOUTS[id];
    if (!rose || !cfg || !visible || now - this.lastAt < (cfg.cooldownMs ?? PASSIVE_SHOUT_COOLDOWN_MS)) return;
    this.lastAt = now;
    this.shout(cfg.lines[this.next++ % cfg.lines.length], cfg.color, x, y, body);
  }
  private shout(line: string, color: string, x: number, y: number, body?: Phaser.GameObjects.Image): void {
    this.count++; this.lastLine = line;
    const text = this.scene.add.text(x, y - 66, line, { fontFamily: FONT, fontSize: '13px', color, stroke: '#2a1608', strokeThickness: 3, resolution: 2 })
      .setOrigin(.5, 1).setDepth(DEPTH.dmgText + 2).setAlpha(0).setScale(.85).setName('passive-shout');
    this.scene.tweens.add({ targets: text, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: text, y: y - 78, alpha: 0, delay: 1300, duration: 450, ease: 'Sine.In', onComplete: () => text.destroy() });
    // 人物身上闪一下金光：叠一层同帧的金色剪影（叠加混合），跟着人物走，0.45 秒淡出；不画在地上
    if (body?.active && body.visible) {
      const glow = this.scene.add.image(body.x, body.y, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY)
        .setDisplaySize(body.displayWidth, body.displayHeight).setFlipX(body.flipX).setTintFill(0xffd77a).setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(body.depth + .001).setAlpha(.75).setName('passive-shout-glow');
      this.scene.tweens.add({ targets: glow, alpha: 0, duration: 450, ease: 'Quad.Out',
        onUpdate: () => { if (body.active) glow.setPosition(body.x, body.y).setFrame(body.frame.name).setFlipX(body.flipX); },
        onComplete: () => glow.destroy() });
    }
    this.sfx?.();
  }
}
