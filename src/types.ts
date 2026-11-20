import type { Player } from './entities/Player';
import type { RunGrowth } from './systems/RunGrowth';

export type EnemyKind = 'infantry' | 'shield' | 'archer' | 'cavalry' | 'elite' | 'boss';

export type WeaponId = 'spear_orbit' | 'crossbow' | 'flame_banner' | 'guandao' | 'zhenbei_blade' | 'lianhuan_mines' | 'sun_knives' | 'diaochan_fans' | 'baodiao_bow' | 'dangyang_roar' | 'zhanjin_lance' | 'shuanggu_swords' | 'fangtian_ji' | 'pozhen_shuangji' | 'huochuan_ling' | 'donglai_ji' | 'yitian_jian' | 'jinfan_gou' | 'shuang_tieji' | 'guding_dao' | 'nanman_dao';

export interface WeaponState {
  id: WeaponId;
  level: number;
  cooldownLeft: number;
  /** 兵器专职分支（data/weaponBranches，本命 Lv5 后二选一，随征程构筑保存）。 */
  branch?: string;
  /** 选的是「契合」那条专职（分支效果 ×BRANCH_FIT.fitMul）。 */
  attuned?: boolean;
  /** 本命超出 Lv5 的级数（Lv6 = 1、Lv7 = 2；level 本身停在 5，原武器查表不越界）。 */
  over?: number;
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
  kind: 'tactic' | 'treasure' | 'weapon' | 'passive' | 'rare' | 'relic' | 'martial' | 'attribute' | 'potion' | 'trinket' | 'foundation';
  categoryLabel?: string;
  /** 有效范围（卡底徽记）：本关有效 / 本次征程 / 一次性 / 永久；不写按 kind 推（ui/CardRichText cardScope）。 */
  scope?: 'stage' | 'run' | 'once' | 'forever';
  weaponId?: WeaponId;
  relicId?: string;
  school?: string;
  icon?: string;
  apply: (player: Player, weapons: WeaponState[], growth?: RunGrowth) => void;
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
