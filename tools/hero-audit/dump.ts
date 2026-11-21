import { CHARACTERS } from '../../src/data/characters';
import { WEAPON_DEFS } from '../../src/weapons/registry';
import { HERO_STATS } from '../../src/data/heroStats';
import { primaryAttribute } from '../../src/data/attributes';
const stats = { damageMul: 1, cooldownMul: 1, moveMul: 1, critChance: .05, regen: .25, pickupRadius: 95, armor: 0, maxHpBonus: 0, meleeMul: 1, arrowMul: 1, fireMul: 1, fireAreaMul: 1, damageTakenMul: 1 };
for (const c of CHARACTERS) {
  const d = (WEAPON_DEFS as any)[c.startWeapon];
  const dm = [1, 2, 3, 4, 5].map(l => +(d.damage(l, stats)).toFixed(1)), cd = [1, 2, 3, 4, 5].map(l => +(d.cooldown(l, stats)).toFixed(2));
  console.log([c.id, c.name, c.startWeapon, 'hp×' + c.hpMul, 'spd×' + c.speedMul, 'dmg×' + c.damageMul, 'prim=' + primaryAttribute(c.id), 'stats=' + HERO_STATS[c.id].base.join('/'), 'dmg=' + dm.join(','), 'cd=' + cd.join(','), 'max=' + d.maxLevel].join(' | '));
}
