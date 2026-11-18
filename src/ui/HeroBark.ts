import Phaser from 'phaser';
import type { CharacterId } from '../data/characters';
import { BARK, HERO_BARKS } from '../data/heroBarks';
import { heroBarksOn } from '../systems/BattleSettings';
import type { CharacterPassives } from '../systems/CharacterPassives';
import { PASSIVE_FULL_SHOUTS, WAR_CRY_HOLD_MS, warCryText } from './PassiveShout';

/**
 * 武将台词气泡（2026-11-17 用户：「各种武将被动触发之后会说台词」；台词在 data/heroBarks.ts）。
 * - 被动大招触发（CharacterPassives.triggers 增加；黄忠进入「神射」）时按几率说一句，同一武将至少隔 BARK.gapMs；
 * - 首领登场 / 倒下：主将必说一句（有专属台词用专属的）；
 * - 表现（2026-11-17 用户：「说的台词那个形式要像马超和魏延一样类似」）：与马超 / 孙尚香被动满层战吼同一套书法大字（PassiveShout.warCryText），
 *   主将原尺寸、随从 ×0.7，跟着人走、不压顶部 HUD；魏延「谁敢杀我！」也走这里（everyTrigger，每次都喊）；
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
  /** 随从说话的字号倍率。 */
  static readonly FOLLOWER_SCALE = .7;
  /** 测试用：说过几句、最近一句、最近说话的武将。 */
  count = 0; lastLine = ''; lastHero: CharacterId | null = null;
  /** 说话几率掷骰（测试可替换；不要去改全局 Math.random，Phaser 建文字画布要用它）。 */
  rng: () => number = Math.random;
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
    if (b && !b.box.active) this.bubble = null; // 字自己播完会销毁；在那之前一直留着引用，换句 / 关掉时才能清掉
  }

  /** 首领登场 / 倒下：主将说一句（随从不说，免得抢话）。 */
  bossEvent(kind: 'bossAppear' | 'bossDown', lord: BarkSpeaker, bossName: string, now: number): void { this.say(lord, kind, now, bossName); }

  say(s: BarkSpeaker, kind: Kind, now: number, bossName = ''): boolean {
    if (!heroBarksOn() || !s.sprite.active || !s.sprite.visible) return false;
    const cfg = HERO_BARKS[s.id]; if (!cfg) return false;
    if (kind === 'trigger') {
      if (s.lord && PASSIVE_FULL_SHOUTS[s.id]) return false; // 马超 / 孙尚香主将：被动满层已有大字战吼
      if (!cfg.everyTrigger) {
        if (now - (this.lastAt.get(s.id) ?? -Infinity) < BARK.gapMs) return false;
        if (this.rng() >= (this.spoken.has(s.id) ? BARK.chance : BARK.firstChance)) return false;
      }
    }
    // 场上只留 1 个气泡：主将顶掉随从；随从不顶掉任何人
    if (this.bubble && now < this.bubble.until && (!s.lord || this.bubble.speaker.lord) && kind === 'trigger' && !cfg.everyTrigger) return false;
    const special = kind === 'bossAppear' ? cfg.vsBoss?.[bossName] : undefined;
    const pool = cfg[kind], key = s.id + ':' + kind, i = this.next.get(key) ?? 0;
    const line = special ?? pool[i % pool.length]; if (!special) this.next.set(key, i + 1);
    this.lastAt.set(s.id, now); this.spoken.add(s.id);
    this.show(s, line, now, cfg.color, s.id === 'weiyan' && kind === 'trigger' ? 'weiyan-whodares' : 'hero-bark');
    return true;
  }

  private show(s: BarkSpeaker, line: string, now: number, color = '#ffe08a', name = 'hero-bark'): void {
    this.clear();
    this.count++; this.lastLine = line; this.lastHero = s.id;
    const body = s.sprite as unknown as { active: boolean; x: number; y: number }, scale = s.lord ? 1 : HeroBark.FOLLOWER_SCALE;
    const box = warCryText(this.scene, line, color, body.x, body.y, body, scale, name);
    this.bubble = { box, speaker: s, until: now + [...line].length * 35 + 120 + WAR_CRY_HOLD_MS + 300 };
  }
  /**
   * 剧情 / 任意一句（新增可玩武将会话 Story.storyBark 用）：在 target 头顶用同一套战吼大字显示「name：text」，跟着 target 走。
   * 不看「武将台词」开关（剧情有自己的开关），会顶掉场上正在说的那一句；返回是否显示了。
   */
  sayLine(target: { x: number; y: number; active?: boolean; displayHeight?: number }, name: string, text: string, color = '#ffe08a'): boolean {
    if (target.active === false || !text) return false;
    this.clear();
    const line = name ? name + '：' + text : text, body = { get active() { return target.active !== false; }, get x() { return target.x; }, get y() { return target.y - Math.max(0, (target.displayHeight ?? 0) - 90); } }; // 高个子（首领）往上让，字不压身体
    const box = warCryText(this.scene, line, color, body.x, body.y, body, 1, 'story-bark');
    this.count++; this.lastLine = line; this.lastHero = null;
    this.bubble = { box, speaker: { id: 'zhaoyun', passive: null, sprite: box as never, lord: true }, until: Number.POSITIVE_INFINITY };
    box.once('destroy', () => { if (this.bubble?.box === box) this.bubble = null; });
    return true;
  }
  clear(): void { this.bubble?.box.destroy(); this.bubble = null; }
}
