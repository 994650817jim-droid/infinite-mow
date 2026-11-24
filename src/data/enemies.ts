import type { EnemyKind } from '../types';
import type { TraitDef } from './enemyRoster';

export interface EnemyDef {
  kind: EnemyKind;
  texture: string;
  tint?: number;
  /** Chapter-specific walk art; presentation only. */
  /** matched：行走 / 攻击表已按同一比例绘制与对齐（如黄巾长枪兵 v5），直接用 scale，不做逐帧身高校正。 */
  walkVisual?: { texture: string; scale: number; groundY: number; matched?: boolean; /** v2 图集的额外显示倍数（默认 1；新兵种四足兽等用，Enemy.applyFrame 乘在 V2_TROOP_SCALE 上） */ v2Mul?: number };
  attackVisual?: string;
  behavior?: "spear" | "shaman" | "halberd" | "thunder" | "wall" | "supply";
  /** 章节专属兵种（不走第一章 behavior 逻辑）：feixiong = 第二章飞熊军（XiliangBattle）；hubao = 第五章虎豹骑（HubaoBattle）。 */
  variant?: "feixiong" | "hubao";
  /** 各章新兵种（data/enemyRoster）：机制与兵种 id，由 systems/EnemyTraits 驱动。 */
  trait?: TraitDef;
  roster?: string;
  hp: number;
  speed: number;
  damage: number;
  /** Single-player survivor opt-in; omitted by story bosses and ordinary enemies. */
  survivorBoss?: { fixedSkillMul: number; phase2Signature: boolean };
  xp: number;
  radius: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  infantry: { kind: 'infantry', texture: 'enemy_infantry', hp: 18, speed: 85, damage: 5, xp: 1, radius: 14 },
  shield: { kind: 'shield', texture: 'enemy_shield', hp: 38, speed: 64, damage: 8, xp: 2, radius: 16 },
  archer: { kind: 'archer', texture: 'enemy_archer', hp: 15, speed: 58, damage: 5, xp: 2, radius: 13 },
  cavalry: { kind: 'cavalry', texture: 'enemy_cavalry', hp: 28, speed: 78, damage: 7, xp: 3, radius: 16 },
  elite: { kind: 'elite', texture: 'enemy_elite', hp: 240, speed: 42, damage: 14, xp: 8, radius: 22 },
  boss: { kind: 'boss', texture: 'boss_zhangjiao', hp: 2400, speed: 30, damage: 20, xp: 50, radius: 34 },
};

/** 波次强度：0 → 1 随 6 分钟推进。 */
export function waveRatio(elapsed: number): number {
  return Math.max(0, Math.min(1, elapsed / 360));
}

export function spawnInterval(elapsed: number): number {
  if (elapsed < 20) return 0.75;
  if (elapsed < 40) return 0.55;
  if (elapsed < 60) return 0.35;
  if (elapsed < 120) return 0.42;
  if (elapsed < 180) return 0.5;
  if (elapsed < 240) return 0.45;
  if (elapsed < 300) return 0.4;
  return 0.38;
}

export function pickEnemyKind(elapsed: number): EnemyKind {
  const r = Math.random();
  if (elapsed < 15) return 'infantry';
  if (elapsed < 25) return r < 0.8 ? 'infantry' : 'shield';
  if (elapsed < 40) {
    if (r < 0.5) return 'infantry';
    if (r < 0.78) return 'shield';
    return 'archer';
  }
  if (elapsed < 55) {
    if (r < 0.4) return 'infantry';
    if (r < 0.64) return 'shield';
    if (r < 0.84) return 'archer';
    return 'cavalry';
  }
  if (r < 0.3) return 'infantry';
  if (r < 0.5) return 'shield';
  if (r < 0.7) return 'archer';
  return 'cavalry';
}

/** 生命成长：随时间变强，但保持前 2 分钟可割草。 */
export function enemyHpScale(elapsed: number): number {
  return 1 + elapsed / 300;
}

/** 每次刷新的数量上限（低端机可通过 quality 降级）。 */
export function spawnBurst(elapsed: number): number {
  if (elapsed < 20) return 1;
  if (elapsed < 60) return 1;
  if (elapsed < 120) return 2;
  if (elapsed < 180) return 2;
  return 3;
}
