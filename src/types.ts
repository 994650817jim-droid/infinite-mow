import type { Player } from './entities/Player';

export type EnemyKind = 'infantry' | 'shield' | 'archer' | 'cavalry' | 'elite' | 'boss';

export type WeaponId = 'spear_orbit' | 'crossbow' | 'flame_banner' | 'guandao';

export interface WeaponState {
  id: WeaponId;
  level: number;
  cooldownLeft: number;
}

export interface PlayerStats {
  damageMul: number;
  cooldownMul: number;
  moveMul: number;
  critChance: number;
  regen: number;
  pickupRadius: number;
  armor: number;
  maxHpBonus: number;
  /** 近战伤害倍率（枪影/无双套装）。 */
  meleeMul: number;
  /** 箭类伤害倍率（连弩/神射）。 */
  arrowMul: number;
  /** 火焰伤害倍率（烈焰战旗）。 */
  fireMul: number;
  /** 火焰范围倍率。 */
  fireAreaMul: number;
  /** 受到伤害倍率（铁甲）。 */
  damageTakenMul: number;
}

export interface UpgradeOption {
  id: string;
  name: string;
  desc: string;
  kind: 'weapon' | 'passive' | 'rare' | 'relic';
  weaponId?: WeaponId;
  relicId?: string;
  school?: string;
  icon?: string;
  apply: (player: Player, weapons: WeaponState[]) => void;
}

export type RunEndReason = 'boss' | 'death' | 'timeout';

export interface RunStats {
  victory: boolean;
  reason: RunEndReason;
  elapsed: number;
  kills: number;
  level: number;
  damageDealt: number;
  bossKilled: boolean;
}
