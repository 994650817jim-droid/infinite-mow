import { BALANCE } from '../config';
import type { Player } from '../entities/Player';
import { RELICS, relicChanceForLevel } from './relics';
import { WEAPON_DEFS, SPEAR_PIERCE, GUANDAO_TABLE } from '../weapons/registry';
import type { UpgradeOption, WeaponId, WeaponState } from '../types';

export const WEAPON_META: Record<WeaponId, { name: string; desc: string }> = {
  spear_orbit: { name: '七探盘龙枪', desc: '银枪自动索敌，向不同敌人突刺' },
  guandao: { name: '青龙偃月斩', desc: '前方 120° 扇形劈砍，最多命中 8 人' },
  crossbow: { name: '连弩齐射', desc: '自动射向最近敌人，命中后弹射' },
  flame_banner: { name: '烈焰战旗', desc: '前方爆发烈焰，范围灼烧' },
};

const WEAPON_IDS: WeaponId[] = ['spear_orbit', 'crossbow', 'flame_banner', 'guandao'];

const PASSIVES: UpgradeOption[] = [
  { id: 'p_atk', name: '武勇', desc: '攻击力 +10%', kind: 'passive', apply: (p) => { p.stats.damageMul += 0.1; } },
  { id: 'p_move', name: '疾行', desc: '移动速度 +8%', kind: 'passive', apply: (p) => { p.stats.moveMul += 0.08; } },
  {
    id: 'p_hp',
    name: '体魄',
    desc: '生命上限 +20，并回复 20',
    kind: 'passive',
    apply: (p) => {
      p.stats.maxHpBonus += 20;
      p.heal(20);
    },
  },
  { id: 'p_regen', name: '回春', desc: '每秒回复 +0.6 生命', kind: 'passive', apply: (p) => { p.stats.regen += 0.6; } },
  { id: 'p_pickup', name: '磁石', desc: '拾取范围 +20%', kind: 'passive', apply: (p) => { p.stats.pickupRadius *= 1.2; } },
  {
    id: 'p_cd',
    name: '疾风',
    desc: '武器冷却 -8%',
    kind: 'passive',
    apply: (p) => {
      p.stats.cooldownMul = Math.max(0.4, p.stats.cooldownMul * 0.92);
    },
  },
  { id: 'p_crit', name: '锐目', desc: '暴击率 +5%', kind: 'passive', apply: (p) => { p.stats.critChance += 0.05; } },
  { id: 'p_armor', name: '护甲', desc: '受到伤害 -2', kind: 'passive', apply: (p) => { p.stats.armor += 2; } },
];

function weaponUpgrade(weapon: WeaponState, player: Player): UpgradeOption {
  const def = WEAPON_DEFS[weapon.id];
  const next = Math.min(def.maxLevel, weapon.level + 1);
  const damage = (level: number): string => def.damage(level, player.stats).toFixed(1).replace(/\.0$/, '');
  let desc = `伤害 ${damage(weapon.level)} → ${damage(next)} · 冷却 ${def.cooldown(weapon.level, player.stats).toFixed(2)} → ${def.cooldown(next, player.stats).toFixed(2)}秒`;
  if (weapon.id === 'spear_orbit') desc += `\n枪数 ${weapon.level} → ${next}，穿透 ${SPEAR_PIERCE[next - 1].len}`;
  if (weapon.id === 'guandao') desc += `\n范围 ${GUANDAO_TABLE[next - 1].radius}${weapon.level < 3 && next >= 3 ? '，解锁二段刀气' : ''}`;
  return {
    id: `up_${weapon.id}`,
    name: `${WEAPON_META[weapon.id].name} 强化`,
    desc,
    kind: 'weapon',
    weaponId: weapon.id,
    apply: (_p, weapons) => {
      const target = weapons.find((w) => w.id === weapon.id);
      if (target && target.level < def.maxLevel) target.level += 1;
    },
  };
}

function newWeaponOption(id: WeaponId): UpgradeOption {
  return {
    id: `new_${id}`,
    name: WEAPON_META[id].name,
    desc: WEAPON_META[id].desc,
    kind: 'weapon',
    weaponId: id,
    apply: (_p, weapons) => {
      if (!weapons.some((w) => w.id === id) && weapons.length < BALANCE.maxWeapons) {
        weapons.push({ id, level: 1, cooldownLeft: 0 });
      }
    },
  };
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function relicOption(def: (typeof RELICS)[number]): UpgradeOption {
  return {
    id: `relic_${def.id}`,
    name: def.name,
    desc: def.desc,
    kind: 'relic',
    relicId: def.id,
    school: def.school,
    icon: def.icon,
    apply: (p) => {
      p.addRelic(def.id);
    },
  };
}

/** 生成三张不重复的升级卡；不足三张时用保底卡补齐。 */
export function buildUpgradeOptions(player: Player, weapons: WeaponState[]): UpgradeOption[] {
  const pool: UpgradeOption[] = [];
  for (const w of weapons) {
    if (w.level < WEAPON_DEFS[w.id].maxLevel) pool.push(weaponUpgrade(w, player));
  }
  for (const id of WEAPON_IDS) {
    if (!weapons.some((w) => w.id === id) && weapons.length < BALANCE.maxWeapons) pool.push(newWeaponOption(id));
  }
  pool.push(...PASSIVES);
  if (weapons.some((w) => w.level < WEAPON_DEFS[w.id].maxLevel)) {
    pool.push({
      id: 'rare_all',
      name: '武神附体',
      desc: '全部武器等级 +1',
      kind: 'rare',
      apply: (_p, ws) => {
        for (const w of ws) w.level = Math.min(WEAPON_DEFS[w.id].maxLevel, w.level + 1);
      },
    });
  }

  // 遗物：按等级概率逐张抽取，同局不重复；已有同流派一件时权重 ×1.5
  const picks: UpgradeOption[] = [];
  const availableRelics = RELICS.filter((r) => !player.relics.includes(r.id));
  const chance = relicChanceForLevel(player.level);
  const normalPool = shuffle(pool);
  for (let slot = 0; slot < 3; slot += 1) {
    if (availableRelics.length > 0 && Math.random() < chance) {
      const weights = availableRelics.map((r) => (player.schoolCount(r.school) === 1 ? 1.5 : 1));
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * total;
      let idx = 0;
      for (; idx < availableRelics.length; idx += 1) {
        roll -= weights[idx];
        if (roll <= 0) break;
      }
      idx = Math.min(idx, availableRelics.length - 1);
      const [def] = availableRelics.splice(idx, 1);
      picks.push(relicOption(def));
    } else {
      const next = normalPool.pop();
      if (next) picks.push(next);
    }
  }
  while (picks.length < 3) {
    const next = normalPool.pop();
    if (next) picks.push(next);
    else break;
  }
  const fallback: UpgradeOption = {
    id: 'fallback_heal',
    name: '干粮',
    desc: '回复 30% 生命',
    kind: 'passive',
    apply: (p) => p.heal(Math.round(p.maxHp * 0.3)),
  };
  while (picks.length < 3) picks.push(fallback);
  return picks;
}
