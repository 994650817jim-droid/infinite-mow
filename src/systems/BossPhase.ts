import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';

/** 首领阶段切换事件名（scene.events）。顿帧、慢动作、首领踉跄等打击感（武将会话）都接这一个事件。 */
export const BOSS_PHASE = 'boss-phase';
export interface BossPhaseEvent { boss: Enemy; phase: 2 | 3; /** 这次切换是否坠马（骑马首领一阶段 → 步战）。 */ dismount: boolean; name: string }

/** 发出阶段切换事件（每位首领每个阶段只发一次）。 */
const sent = new WeakMap<Enemy, Set<string>>();
export function emitBossPhase(scene: Phaser.Scene, e: BossPhaseEvent): void {
  // 敌人对象池会复用：按出生编号区分
  const key = e.boss.spawnId + ':' + e.phase, set = sent.get(e.boss) ?? new Set<string>();
  if (set.has(key)) return;
  set.add(key); sent.set(e.boss, set);
  scene.events.emit(BOSS_PHASE, e);
}

/**
 * 统一的阶段监视：每帧看当前首领控制器的 phase2 标记，翻转时发 boss-phase。
 * 已有的专属控制器（张角、华雄、吕布、袁术、曹仁、官渡三将、通用 ThirdBoss……）不用逐个改，都从这里发事件；
 * 新招式框架（BossMoveset）自己切阶段时也调 emitBossPhase（同一首领同一阶段只发一次）。
 */
export function watchBossPhase(scene: Phaser.Scene, current: () => { boss: Enemy | null; phase2: boolean; phase3?: boolean; name: string; mounted?: boolean } | null): () => void {
  const tick = (): void => {
    const c = current(); if (!c?.boss?.active) return;
    if (c.phase2) emitBossPhase(scene, { boss: c.boss, phase: 2, dismount: !!c.mounted, name: c.name });
    if (c.phase3) emitBossPhase(scene, { boss: c.boss, phase: 3, dismount: false, name: c.name });
  };
  scene.events.on('postupdate', tick);
  const off = (): void => { scene.events.off('postupdate', tick); };
  scene.events.once('shutdown', off);
  return off;
}
