import Phaser from 'phaser';
import { safeWorldPoint } from '../ui/SafeLabel';
import { DEPTH, FONT, HEADING_FONT, actorDepth } from '../config';
import { DEFECTOR, DEFECTOR_LINES, rollDefector, type DefectorInfo } from '../data/fortunes';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';

/** 降将的宿主（BattleFortunes 的宿主上多出的几样）。 */
export interface DefectorHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number; alive?: boolean };
  chapter: () => number;
  place: (x: number, y: number) => { x: number; y: number };
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  /** 小首领：副将一档生命的精锐（StagePhaseRunner.lieutenantDef）。 */
  duelist: (x: number, y: number) => Enemy | null;
  officerTexture: () => string | undefined;
  troopTexture: () => string | undefined;
  now: () => number;
  /** 不倒地地撤下（归附那一刻）。 */
  retire: (e: Enemy) => void;
  /** 本关临时随从（随行系统），返回随从（名牌、血量、倒地）。 */
  joinAlly: (d: DefectorInfo, x: number, y: number) => { sprite: Phaser.GameObjects.Image; downed: boolean; label?: Phaser.GameObjects.Text } | null;
  /** 左下角电影感对话卡（剧情关掉时宿主不出）。 */
  card: (name: string, text: string) => void;
  banner: (title: string, danger: boolean, sub?: string) => void;
  sfx: (key: string) => void;
}
export type DefectorPhase = 'arrive' | 'wait' | 'duel' | 'kneel' | 'ally' | 'gone';
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * 机缘「降将来投」的一位降将（data/fortunes.ts DEFECTOR）：
 * arrive 带亲兵从远处走来 → wait 插旗、头顶「来投」等主将走近 → duel 以一战相试（名牌 + 血条，副将一档）→ kneel 残血跪地请降 → ally 本关随你作战。
 */
export class FortuneDefector {
  phase: DefectorPhase = 'arrive';
  readonly info: DefectorInfo;
  x: number; y: number;
  private props: Phaser.GameObjects.Image[] = [];
  private head?: Phaser.GameObjects.Text;
  private flag?: Phaser.GameObjects.Image;
  private e: Enemy | null = null; private life = 0;
  private tag?: Phaser.GameObjects.Text; private bar?: Phaser.GameObjects.Graphics;
  private kneelAt = 0;
  private ally: ReturnType<DefectorHost['joinAlly']> = null;
  private barks = 0; private barkAt = 0; private lastT = 0;
  /** 测试用。 */
  readonly stats = { lines: [] as string[], allied: false, duelHp: 0 };

  constructor(private readonly h: DefectorHost, x: number, y: number) {
    this.info = rollDefector(h.chapter()); this.x = x; this.y = y;
    // 出场：从事件点再往外 approach 处，带亲兵走过来（行走帧轮换）
    const P = h.player(), d = Math.hypot(x - P.x, y - P.y) || 1, from = h.place(x + (x - P.x) / d * DEFECTOR.approach, y + (y - P.y) / d * DEFECTOR.approach);
    const s = h.scene, dirKey = from.x > x ? 'left' : 'right';
    const mk = (tex: string | undefined, dx: number, dy: number, scale: number, name: string): void => {
      if (!tex || !s.textures.exists(tex)) return; const t = s.textures.get(tex), f0 = t.has(dirKey + '_0') ? dirKey + '_0' : t.has('down_0') ? 'down_0' : undefined;
      const o = s.add.image(from.x + dx, from.y + dy, tex, f0).setOrigin(.5, .92).setScale(scale).setDepth(actorDepth(from.y + dy)).setName(name);
      o.setData('dx', dx).setData('dy', dy).setData('dir', dirKey); this.props.push(o);
    };
    mk(h.officerTexture(), 0, 0, .66, 'defector-officer');
    for (let i = 0; i < DEFECTOR.guards; i++) mk(h.troopTexture(), (i - 1) * 34, 30 + (i % 2) * 10, .5, 'defector-guard');
    const lead = this.props[0];
    lead?.setTint(0xfff0c8);
    this.head = s.add.text(from.x, from.y - 90, this.info.title + ' · ' + this.info.name, { fontFamily: FONT, fontSize: '13px', color: '#ffe3a0', resolution: 2, stroke: '#1f1206', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 2).setName('defector-name');
    let step = 0;
    const walk = s.time.addEvent({ delay: 140, loop: true, callback: () => { step = (step + 1) % 4; for (const o of this.props) { const t = o.texture, k = o.getData('dir') + '_' + step; if (t.has(k)) o.setFrame(k); } } });
    s.tweens.addCounter({ from: 0, to: 1, duration: DEFECTOR.walkMs, ease: 'Sine.easeInOut',
      onUpdate: tw => { const k = tw.getValue() ?? 0, cx = from.x + (x - from.x) * k, cy = from.y + (y - from.y) * k; for (const o of this.props) o.setPosition(cx + o.getData('dx'), cy + o.getData('dy') + Math.sin(k * 30 + o.getData('dx')) * 1.5).setDepth(actorDepth(cy + o.getData('dy'))); this.head?.setPosition(cx, cy - 90); },
      onComplete: () => { walk.remove(); this.arrived(); } });
  }
  /** 到了：插旗、头顶「来投」。 */
  private arrived(): void {
    if (this.phase !== 'arrive') return; this.phase = 'wait';
    const s = this.h.scene;
    for (const o of this.props) { const t = o.texture; if (t.has('down_0')) o.setFrame('down_0'); }
    if (s.textures.exists('yellow_props')) { this.flag = s.add.image(this.x + 40, this.y - 40, 'yellow_props', 7).setOrigin(.5, .9).setDisplaySize(70, 70).setDepth(actorDepth(this.y + 6)).setTint(0xf2efe6).setName('defector-flag'); s.tweens.add({ targets: this.flag, y: this.y + 6, duration: 260, ease: 'Back.easeOut' }); }
    this.head?.setText('来投 · ' + this.info.name).setFontFamily(HEADING_FONT).setFontSize(20).setColor('#ffd870');
    if (this.head) s.tweens.add({ targets: this.head, scale: { from: 1.4, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    this.h.sfx('waveDrum');
  }
  /** 每帧；返回 'yield'（归附，宿主发奖）/ null。 */
  tick(t: number): 'yield' | null {
    this.lastT = t; const P = this.h.player();
    if (this.phase === 'wait' && Math.hypot(P.x - this.x, P.y - this.y) <= DEFECTOR.duelRange && P.alive !== false) this.startDuel();
    if (this.phase === 'duel') {
      const e = this.e!, alive = e.active && e.spawnId === this.life && e.hp > 0;
      if (!alive) { this.startKneel(); return null; } // 万一被别的系统直接打死：照样跪降（位置用最后一帧）
      this.x = e.x; this.y = e.y; this.drawTag();
      if (e.hp <= e.maxHp * DEFECTOR.kneelAt) this.startKneel();
    }
    if (this.phase === 'kneel') {
      const e = this.e; if (e?.active) { e.stunUntil = this.h.now() + 600; e.invulnerable = true; }
      if (this.h.now() >= this.kneelAt + DEFECTOR.kneelMs) return this.join();
    }
    return null;
  }
  /** 随战中：偶尔一句（节流）。 */
  allyTick(t: number): void {
    if (this.phase !== 'ally' || !this.ally || this.ally.downed || this.barks >= DEFECTOR.barkMax || t - this.barkAt < DEFECTOR.barkGap) return;
    this.barkAt = t; this.barks++; this.say(pick(DEFECTOR_LINES.fight));
  }
  /** 本关结束：告别一句。 */
  farewell(): void { if (this.phase === 'ally' && this.ally && !this.ally.downed) this.say(pick(DEFECTOR_LINES.farewell)); }
  /** 致命一击：试阵中不让他死，改跪地请降。 */
  preventKill(e: Enemy): boolean {
    if (this.phase !== 'duel' || e !== this.e) return false;
    e.hp = Math.max(1, Math.floor(e.maxHp * .05)); this.startKneel(); return true;
  }
  /** 挡在屏外箭头 / 地上标记的文字。 */
  label(): string {
    return this.phase === 'arrive' ? '降将来投 · 正在赶来' : this.phase === 'wait' ? '降将来投 · 走近应战' : this.phase === 'duel' ? this.info.name + ' · 以一战相试' : this.info.name + ' · 请降';
  }
  get waiting(): boolean { return this.phase === 'arrive' || this.phase === 'wait'; }

  private startDuel(): void {
    this.phase = 'duel';
    const s = this.h.scene, at = { x: this.props[0]?.x ?? this.x, y: this.props[0]?.y ?? this.y };
    for (const o of this.props) o.destroy(); this.props = []; this.head?.destroy(); this.head = undefined;
    this.e = this.h.duelist(at.x, at.y);
    if (!this.e) { this.phase = 'wait'; return; }
    this.life = this.e.spawnId; this.stats.duelHp = Math.round(this.e.maxHp);
    this.e.sprite.setTint(0xfff0c8);
    for (let i = 0; i < DEFECTOR.guards; i++) { const a = i / DEFECTOR.guards * Math.PI * 2; this.h.spawn('infantry', at.x + Math.cos(a) * 60, at.y + Math.sin(a) * 42); }
    this.tag = s.add.text(at.x, at.y, this.info.title + ' · ' + this.info.name, { fontFamily: FONT, fontSize: '13px', color: '#ffe3a0', resolution: 2, stroke: '#2a0c06', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 1).setName('defector-tag');
    this.bar = s.add.graphics().setDepth(DEPTH.dmgText - 1).setName('defector-bar');
    this.say(pick(DEFECTOR_LINES.intro));
    this.h.banner('降将试阵 · ' + this.info.name, true, '击败他，他就本关随你作战'); this.h.sfx('bossSummon');
  }
  private drawTag(): void {
    const e = this.e; if (!e || !this.tag || !this.bar) return;
    const sp = e.sprite, top = sp.y - sp.displayHeight * sp.originY - 12, w = 58, k = Math.max(0, e.hp / Math.max(1, e.maxHp));
    const q = safeWorldPoint(this.h.scene, e.x, top, Math.max(w / 2, this.tag.displayWidth / 2), this.tag.displayHeight + 10); // 靠屏幕边时往内收
    this.tag.setPosition(q.x, q.y);
    this.bar.clear().fillStyle(0x140a06, .8).fillRect(q.x - w / 2 - 1, q.y + 2, w + 2, 6).fillStyle(0xe0b040, 1).fillRect(q.x - w / 2, q.y + 3, w * k, 4);
  }
  private startKneel(): void {
    if (this.phase !== 'duel') return;
    this.phase = 'kneel'; this.kneelAt = this.h.now();
    const s = this.h.scene, e = this.e;
    this.bar?.destroy(); this.bar = undefined; this.tag?.setText(this.info.name + ' · 请降').setColor('#bfe8a8');
    if (e?.active) {
      e.invulnerable = true; e.stunUntil = this.h.now() + DEFECTOR.kneelMs + 400; this.x = e.x; this.y = e.y;
      const sp = e.sprite, sy = sp.scaleY; s.tweens.add({ targets: sp, scaleY: sy * .78, duration: 220, ease: 'Quad.easeOut' }); // 跪地：身子一矮
    }
    this.say(pick(DEFECTOR_LINES.yield)); this.h.sfx('kneel');
  }
  private join(): 'yield' {
    this.phase = 'ally';
    const e = this.e; if (e?.active) { this.x = e.x; this.y = e.y; this.h.retire(e); }
    this.tag?.destroy(); this.tag = undefined; this.flag?.destroy(); this.flag = undefined;
    this.ally = this.h.joinAlly(this.info, this.x, this.y); this.stats.allied = !!this.ally;
    this.barkAt = this.lastT;
    return 'yield';
  }
  private say(text: string): void { this.stats.lines.push(text); this.h.card(this.info.name, text); }
  /** 事件过期（没去应战）：降将离去。 */
  leave(): void { const s = this.h.scene; const objs = [...this.props, ...(this.head ? [this.head] : []), ...(this.flag ? [this.flag] : [])]; this.props = []; this.head = undefined; this.flag = undefined; this.phase = 'gone'; s.tweens.add({ targets: objs, alpha: 0, duration: 600, onComplete: () => { for (const o of objs) o.destroy(); } }); }
  clear(): void { for (const o of this.props) o.destroy(); this.props = []; this.head?.destroy(); this.flag?.destroy(); this.tag?.destroy(); this.bar?.destroy(); }
}
