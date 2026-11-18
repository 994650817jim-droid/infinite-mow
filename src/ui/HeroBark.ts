import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import type { CharacterId } from '../data/characters';
import { BARK, HERO_BARKS } from '../data/heroBarks';
import { heroBarksOn } from '../systems/BattleSettings';
import type { CharacterPassives } from '../systems/CharacterPassives';
import { PASSIVE_FULL_SHOUTS } from './PassiveShout';

/**
 * 武将台词气泡（2026-11-17 用户：「各种武将被动触发之后会说台词」；台词在 data/heroBarks.ts）。
 * - 被动大招触发（CharacterPassives.triggers 增加；黄忠进入「神射」）时按几率说一句，同一武将至少隔 BARK.gapMs；
 * - 首领登场 / 倒下：主将必说一句（有专属台词用专属的）；
 * - 头顶一个小水墨气泡（深底、象牙字、细金边），弹出 → 停 1.6 秒 → 淡出，跟着人走；
 * - 场上最多 1 个气泡：主将的可以顶掉随从的，随从的不顶掉任何人；
 * - 战斗设置「武将台词」关掉时都不说。
 */
export interface BarkSpeaker { id: CharacterId; passive: CharacterPassives | null; sprite: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.GetBounds & { active: boolean; visible: boolean }; lord: boolean; }
type Kind = 'trigger' | 'bossAppear' | 'bossDown';

export class HeroBark {
  private seen = new Map<CharacterPassives, { triggers: number; ready: boolean }>();
  private lastAt = new Map<CharacterId, number>();
  private spoken = new Set<CharacterId>();
  private next = new Map<string, number>();
  private bubble: { box: Phaser.GameObjects.Container; speaker: BarkSpeaker; until: number } | null = null;
  /** 测试用：说过几句、最近一句、最近说话的武将。 */
  count = 0; lastLine = ''; lastHero: CharacterId | null = null;
  constructor(private readonly scene: Phaser.Scene) {}

  /** 每帧调用：检测各武将被动大招触发，并让气泡跟着人走。visible = 战斗进行中（没有弹窗）。 */
  update(speakers: readonly BarkSpeaker[], now: number, visible: boolean): void {
    for (const s of speakers) {
      const p = s.passive; if (!p) continue;
      const snap = p.snapshot(now), prev = this.seen.get(p);
      this.seen.set(p, { triggers: snap.triggers, ready: snap.ready });
      if (!prev) continue;
      // 黄忠的神射是一种状态（静止蓄满进入），按「进入神射」那一刻算触发
      const fired = s.id === 'huangzhong' ? snap.ready && !prev.ready : snap.triggers > prev.triggers;
      if (fired && visible) this.say(s, 'trigger', now);
    }
    const b = this.bubble;
    if (b) { if (!b.speaker.sprite.active) this.clear(); else this.place(b.box, b.speaker); }
  }

  /** 首领登场 / 倒下：主将说一句（随从不说，免得抢话）。 */
  bossEvent(kind: 'bossAppear' | 'bossDown', lord: BarkSpeaker, bossName: string, now: number): void { this.say(lord, kind, now, bossName); }

  say(s: BarkSpeaker, kind: Kind, now: number, bossName = ''): boolean {
    if (!heroBarksOn() || !s.sprite.active || !s.sprite.visible) return false;
    const cfg = HERO_BARKS[s.id]; if (!cfg) return false;
    if (kind === 'trigger') {
      if (s.lord && PASSIVE_FULL_SHOUTS[s.id]) return false; // 马超 / 孙尚香主将：被动满层已有大字战吼
      if (now - (this.lastAt.get(s.id) ?? -Infinity) < BARK.gapMs) return false;
      if (Math.random() >= (this.spoken.has(s.id) ? BARK.chance : BARK.firstChance)) return false;
    }
    // 场上只留 1 个气泡：主将顶掉随从；随从不顶掉任何人
    if (this.bubble && now < this.bubble.until && (!s.lord || this.bubble.speaker.lord) && kind === 'trigger') return false;
    const special = kind === 'bossAppear' ? cfg.vsBoss?.[bossName] : undefined;
    const pool = cfg[kind], key = s.id + ':' + kind, i = this.next.get(key) ?? 0;
    const line = special ?? pool[i % pool.length]; if (!special) this.next.set(key, i + 1);
    this.lastAt.set(s.id, now); this.spoken.add(s.id);
    this.show(s, line, now);
    return true;
  }

  private show(s: BarkSpeaker, line: string, now: number): void {
    this.clear();
    this.count++; this.lastLine = line; this.lastHero = s.id;
    const sc = this.scene, t = sc.add.text(0, 0, line, { fontFamily: FONT, fontSize: '15px', color: '#f3e6c8', resolution: 2 }).setOrigin(.5, .5).setStroke('#120904', 2);
    const w = Math.ceil(t.width) + 22, h = 30, g = sc.add.graphics();
    // 深色水墨底 + 细金边 + 指向头顶的小尖
    g.fillStyle(0x1b120b, .9).fillRoundedRect(-w / 2, -h / 2, w, h, 8).lineStyle(1.5, 0xc9a35e, .9).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(0x1b120b, .9).fillTriangle(-7, h / 2 - 1, 7, h / 2 - 1, 0, h / 2 + 8).lineStyle(1.5, 0xc9a35e, .9).lineBetween(-7, h / 2, 0, h / 2 + 8).lineBetween(7, h / 2, 0, h / 2 + 8);
    const box = sc.add.container(0, 0, [g, t]).setDepth(DEPTH.dmgText + 2).setName('hero-bark').setScale(.6).setAlpha(0);
    this.place(box, s);
    const total = BARK.popMs + BARK.holdMs + BARK.fadeMs;
    this.bubble = { box, speaker: s, until: now + total };
    sc.tweens.add({ targets: box, scale: 1, alpha: 1, duration: BARK.popMs, ease: 'Back.Out' });
    sc.tweens.add({ targets: box, alpha: 0, delay: BARK.popMs + BARK.holdMs, duration: BARK.fadeMs, onComplete: () => { if (this.bubble?.box === box) this.bubble = null; box.destroy(); } });
  }
  /** 放在头顶上方，不压住身体，也不压住主将头上的「主将」小字。 */
  private place(box: Phaser.GameObjects.Container, s: BarkSpeaker): void {
    const r = s.sprite.getBounds(); box.setPosition(r.centerX, r.top - (s.lord ? 46 : 28));
  }
  clear(): void { this.bubble?.box.destroy(); this.bubble = null; }
}
