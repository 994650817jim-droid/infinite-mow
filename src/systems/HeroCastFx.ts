/**
 * 武将出招起手特效（2026-11-19 用户：「还要增加适合的攻击技能释放特效 boss和我方角色都要」；首领那边归死亡特效会话）：
 * 12 名可玩武将放招牌技 / 专属武艺（都会播 skill 动作）和被动触发（觉醒满层、神射、算无遗策……）的那一刻，
 * 在武将身上亮一下手绘起手特效（每人一套主题：关羽青龙气焰、张飞咆哮冲击环、赵云银白枪芒、诸葛亮七星符……）。
 * - 普通攻击不放：只挂在 Player.playAction('skill') 与 CharacterPassives 的触发计数上。
 * - 同一帧既放招又触发被动（叠满层那一下）只放一次「被动」版（大一号、脚下多一圈压扁的同款光作法阵）。
 * - 招牌技有冷却（SKILL_CD），连发时不刷屏；特效跟着武将走、0.42 秒放完。
 * - 图：public/assets/hero-fx/cast/cast_<武将>.png（ChatGPT 黑底 6×4 出图，tools/build-hero-cast-fx.mjs 去底切条），SKILL_FX 的 fx_cast_<武将>；缺图时什么都不画。
 */
import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import { playSheet } from './SkillFxSheets';
import { lastBranchBurst } from './BranchFinalFx';
import { DEPTH } from '../config';
import { sceneSfx } from './ContentSfx';

// 2026-11-20 攻击特效检查：被动触发版 196 → 176（白色 / 金色光柱整块盖住主将）；yieldMs：兵器专职进阶爆发刚播过就不再叠招牌技起手
export const HERO_CAST = { skillCd: 900, ms: 420, skillSize: 150, passiveSize: 176, sigilSize: 200, sigilFlat: .42, passiveAlpha: .85, yieldMs: 400 } as const;

export class HeroCastFx {
  private pendingSkill = false;
  private lastTriggers = 0;
  private lastSkillAt = -Infinity;
  /** 测试 / 统计：放过几次（skill / passive） */
  readonly stats = { skill: 0, passive: 0 };
  /** 跟哪个主将对象（场景重开会换新的 Player，GameScene 据此重建） */
  readonly owner: Player;
  constructor(private readonly scene: Phaser.Scene, private readonly player: Player, private readonly hero: string) {
    this.owner = player;
    this.lastTriggers = player.passive.triggerCount();
  }
  /** Player.playAction('skill') 时调（招牌技 / 专属武艺出手）；真正放不放在 update 里定（同一帧可能还有被动触发）。 */
  markSkill(): void { this.pendingSkill = true; }
  /** 每帧（武器结算之后）调一次。 */
  update(now: number): void {
    const tr = this.player.passive.triggerCount(), passive = tr > this.lastTriggers;
    this.lastTriggers = tr;
    if (passive) { this.play('passive'); this.lastSkillAt = now; }
    else if (this.pendingSkill && now - this.lastSkillAt >= HERO_CAST.skillCd && this.scene.time.now - lastBranchBurst.at >= HERO_CAST.yieldMs) { this.play('skill'); this.lastSkillAt = now; } // 进阶爆发刚播过：让路，不在同一点叠两层
    this.pendingSkill = false;
  }
  private play(kind: 'skill' | 'passive'): void {
    const key = 'fx_cast_' + this.hero, s = this.scene, p = this.player;
    if (!s.textures.exists(key) || !p.alive) return;
    this.stats[kind]++;
    sceneSfx(s, 'cast_' + this.hero); if (kind === 'passive') sceneSfx(s, 'cast_sigil'); // 出招起手音（ContentSfx）
    const follow = (y: number) => (img: Phaser.GameObjects.Image): void => { if (p.sprite.active) img.setPosition(p.x, p.y + y); };
    const size = kind === 'passive' ? HERO_CAST.passiveSize : HERO_CAST.skillSize;
    playSheet(s, key, p.x, p.y - 18, { size, ms: HERO_CAST.ms, depth: DEPTH.fx + .2, add: true, alpha: kind === 'passive' ? HERO_CAST.passiveAlpha : 1, name: 'hero-cast-' + kind, onUpdate: follow(-18) });
    if (kind === 'passive') {
      // 被动触发：脚下再铺一圈压扁的同款光，当法阵
      playSheet(s, key, p.x, p.y + 8, { size: HERO_CAST.sigilSize, sizeH: HERO_CAST.sigilSize * HERO_CAST.sigilFlat, ms: HERO_CAST.ms + 120, depth: DEPTH.ground + 3, add: true, alpha: .8, name: 'hero-cast-sigil', onUpdate: follow(8) });
    }
  }
}
