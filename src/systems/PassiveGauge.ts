import Phaser from 'phaser';
import { IS_DESKTOP, actorDepth } from '../config';
import { HZ_SHARP } from '../data/heroMechanics';
import { PASSIVE_GAUGE as P, PASSIVE_GAUGE_LOOKS, type GaugeLook } from '../data/passiveGauge';
import type { CharacterPassives } from './CharacterPassives';
import { ZhaoyunPassiveFx } from './ZhaoyunPassiveFx';

/** 被动刻度的读数：value / max（层数），ready = 满层待发（黄忠为神射中）。 */
export interface GaugeReading { value: number; max: number; ready: boolean; triggers: number; }

/** 把各武将被动的状态统一折算成刻度读数（黄忠：蓄势 0–5；神射中按剩余时间显示、ready）。 */
export function gaugeReading(passive: CharacterPassives, now: number): GaugeReading {
  const s = passive.snapshot(now);
  if (s.character === 'huangzhong') {
    const need = HZ_SHARP.need;
    return { value: s.ready ? Math.max(0, s.calmProgress) * need : s.stacks, max: need, ready: s.ready, triggers: s.triggers };
  }
  return { value: s.stacks, max: Math.max(1, s.maxStacks), ready: s.ready, triggers: s.triggers };
}

type Mode = 'idle' | 'pop' | 'lit' | 'out';

/**
 * 武将脚下被动刻度（共用组件；参数与图集说明见 src/data/passiveGauge.ts）。
 * 前半圈一排手绘小图标：积层点亮（放大回弹）、掉层淡出、满层两帧流光交替、被动触发时一齐亮起放大再收回。
 * 赵云沿用自带龙鳞序列帧的 ZhaoyunPassiveFx（这里只转发）。缺图时什么都不画。只给主将用（随从没有被动层数）。
 */
export class PassiveGauge {
  readonly zhaoyun: ZhaoyunPassiveFx;
  /** 测试用计数。 */
  readonly stats = { lit: 0, out: 0, flashes: 0 };
  private icons: Phaser.GameObjects.Sprite[] = [];
  private mode: Mode[] = []; private at: number[] = [];
  private hero = ''; private shown = -1; private lastTriggers = -1; private flashAt = -Infinity;
  private look: GaugeLook | undefined;
  private last: GaugeReading = { value: 0, max: 1, ready: false, triggers: 0 };

  constructor(private readonly scene: Phaser.Scene) { this.zhaoyun = new ZhaoyunPassiveFx(scene); }

  /** 脚下现在有没有刻度（赵云龙鳞或通用刻度）：骑马耐力条据此决定贴马蹄还是让到刻度下面。 */
  get showing(): boolean { return this.on; }
  private on = false;
  /** 每帧调用。x / y 为主将原点，now 为战斗时间（毫秒）。 */
  update(passive: CharacterPassives, now: number, x: number, y: number, visible: boolean): void {
    this.zhaoyun.update(passive, now, x, y, visible);
    const id = passive.characterId, look = id === 'zhaoyun' ? undefined : PASSIVE_GAUGE_LOOKS[id];
    if (id !== this.hero) this.reset(id, look);
    const on = visible && !!look && this.scene.textures.exists(look.tex) && !passive.snapshot(now).stopped;
    this.on = on || (id === 'zhaoyun' && visible);
    if (!on || !look) { for (const s of this.icons) s.setVisible(false); this.shown = -1; return; }
    const r = gaugeReading(passive, now); this.last = r;
    const n = Math.max(0, Math.min(look.slots, Math.floor(r.value * look.slots / r.max + 1e-6)));
    if (this.lastTriggers >= 0 && r.triggers > this.lastTriggers) { this.flashAt = now; this.stats.flashes++; }
    this.lastTriggers = r.triggers;
    if (this.shown < 0) { for (let i = 0; i < look.slots; i++) { this.mode[i] = i < n ? 'lit' : 'idle'; this.at[i] = -Infinity; } this.shown = n; }
    if (n > this.shown) for (let i = this.shown; i < n; i++) { this.mode[i] = 'pop'; this.at[i] = now; this.stats.lit++; }
    if (n < this.shown) for (let i = n; i < this.shown; i++) { this.mode[i] = 'out'; this.at[i] = now; this.stats.out++; }
    this.shown = n;
    const base = look.row * 4, size = IS_DESKTOP ? look.size : Math.round(look.size * .87), depth = actorDepth(y) - .02, fy = y + P.footDy;
    const span = P.step * (look.slots - 1), from = Math.PI / 2 - span / 2;
    const fk = (now - this.flashAt) / P.flashMs, flashing = fk >= 0 && fk < 1;
    const shimmer = Math.floor(now / 1000 * P.shimmerFps);
    for (let i = 0; i < look.slots; i++) {
      const s = this.icons[i], a = look.slots > 1 ? from + span * i / (look.slots - 1) : Math.PI / 2;
      let scale = 1, alpha: number = P.idleAlpha, col = 0;
      if (this.mode[i] === 'pop') { const k = (now - this.at[i]) / P.popMs; if (k >= 1) this.mode[i] = 'lit'; else { scale = P.popScale - (P.popScale - 1) * Phaser.Math.Easing.Quadratic.Out(k); alpha = P.litAlpha; col = 2; } }
      else if (this.mode[i] === 'out') { const k = (now - this.at[i]) / P.outMs; if (k >= 1) this.mode[i] = 'idle'; else { col = 1; alpha = P.litAlpha - (P.litAlpha - P.idleAlpha) * k; scale = 1 - .15 * k; } }
      if (this.mode[i] === 'lit') { alpha = P.litAlpha; col = r.ready ? 2 + (shimmer + i) % 2 : 1; }
      if (flashing) { const e = 1 - Phaser.Math.Easing.Quadratic.Out(fk); scale = Math.max(scale, 1 + (P.flashScale - 1) * e); col = 3; alpha = 1; }
      s.setFrame(base + col).setAlpha(alpha).setPosition(x + Math.cos(a) * P.rx, fy + Math.sin(a) * P.ry).setDisplaySize(size * scale, size * scale).setDepth(depth).setVisible(true);
    }
  }

  private reset(id: string, look: GaugeLook | undefined): void {
    for (const s of this.icons) s.destroy();
    this.icons = []; this.mode = []; this.at = []; this.hero = id; this.look = look; this.shown = -1; this.lastTriggers = -1; this.flashAt = -Infinity;
    if (!look || !this.scene.textures.exists(look.tex)) return;
    for (let i = 0; i < look.slots; i++) { this.icons.push(this.scene.add.sprite(0, 0, look.tex, look.row * 4).setName(`passive-gauge-${i}`).setVisible(false)); this.mode.push('idle'); this.at.push(-Infinity); }
  }

  /** 测试用：当前刻度状态。 */
  debug(): { hero: string; base: number; slots: number; lit: number; ready: boolean; value: number; max: number; frames: number[]; visible: boolean; flashing: boolean; stats: { lit: number; out: number; flashes: number } } {
    return { hero: this.hero, base: (this.look?.row ?? 0) * 4, slots: this.look?.slots ?? 0, lit: Math.max(0, this.shown), ready: this.last.ready, value: this.last.value, max: this.last.max,
      frames: this.icons.map(s => Number(s.frame.name)), visible: this.icons.some(s => s.visible), flashing: this.icons.some(s => s.displayWidth > (this.look?.size ?? 99) * 1.2), stats: { ...this.stats } };
  }
}
