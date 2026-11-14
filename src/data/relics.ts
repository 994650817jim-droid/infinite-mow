import type { Player } from '../entities/Player';

export type RelicSchool = 'wushuang' | 'shenshe' | 'lieyan' | 'tiebi';

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  school: RelicSchool;
  desc: string;
  /** 获得时立刻生效；每局只获得一次。 */
  apply: (player: Player) => void;
}

export const SCHOOL_NAMES: Record<RelicSchool, string> = {
  wushuang: '无双',
  shenshe: '神射',
  lieyan: '烈焰',
  tiebi: '铁壁',
};

/** 2 件套效果：获得第二件同流派遗物时应用一次。 */
export function applySetBonus(player: Player, school: RelicSchool): void {
  if (school === 'wushuang') player.stats.meleeMul += 0.08;
  else if (school === 'shenshe') player.stats.arrowMul += 0.08;
  else if (school === 'lieyan') player.stats.fireMul += 0.1;
  else if (school === 'tiebi') {
    const base = player.maxHp;
    const bonus = Math.round(base * 0.1);
    player.stats.maxHpBonus += bonus;
    player.hp += bonus;
  }
}

export const RELICS: RelicDef[] = [
  {id:'human_seal',name:'人公将印',icon:'item_drum',school:'wushuang',desc:'伤害增加12%。每命中12次，震击附近最多4名敌人。',apply:p=>{p.stats.damageMul*=1.12;}},
  {id:'heaven_ember',name:'赤霄火珠',icon:'item_torch',school:'lieyan',desc:'火焰伤害增加15%。武器命中时生成残火，每5秒一次。',apply:p=>{p.stats.fireMul+=.15;}},
  {id:'army_jade',name:'护军玉璧',icon:'item_armor',school:'tiebi',desc:'受到伤害减少10%。击杀时为自己和受伤友军回复少量生命，每秒一次。',apply:p=>{p.stats.damageTakenMul*=.9;}},
  {
    id: 'drum',
    name: '战鼓',
    icon: 'item_drum',
    school: 'wushuang',
    desc: '武器冷却 -6%',
    apply: (p) => { p.stats.cooldownMul *= 0.94; },
  },
  {
    id: 'whetstone',
    name: '磨刀石',
    icon: 'item_whetstone',
    school: 'wushuang',
    desc: '所有武器伤害 +8%',
    apply: (p) => { p.stats.damageMul *= 1.08; },
  },
  {
    id: 'ring',
    name: '鹰眼扳指',
    icon: 'item_ring',
    school: 'shenshe',
    desc: '暴击率 +5%',
    apply: (p) => { p.stats.critChance += 0.05; },
  },
  {
    id: 'quiver',
    name: '羽箭囊',
    icon: 'item_quiver',
    school: 'shenshe',
    desc: '箭类伤害 +12%',
    apply: (p) => { p.stats.arrowMul += 0.12; },
  },
  {
    id: 'oil',
    name: '火油',
    icon: 'item_oil',
    school: 'lieyan',
    desc: '火焰伤害 +12%',
    apply: (p) => { p.stats.fireMul += 0.12; },
  },
  {
    id: 'torch',
    name: '火折子',
    icon: 'item_torch',
    school: 'lieyan',
    desc: '火焰范围 +10%',
    apply: (p) => { p.stats.fireAreaMul += 0.1; },
  },
  {
    id: 'armor',
    name: '铁甲',
    icon: 'item_armor',
    school: 'tiebi',
    desc: '受到伤害 -8%',
    apply: (p) => { p.stats.damageTakenMul *= 0.92; },
  },
  {
    id: 'wine',
    name: '酒壶',
    icon: 'item_wine',
    school: 'tiebi',
    desc: '每秒回复 +0.4 生命',
    apply: (p) => { p.stats.regen += 0.4; },
  },
];

export const RELIC_BY_ID = new Map(RELICS.map((r) => [r.id, r]));

/** 遗物出现概率（按单张卡）。 */
export function relicChanceForLevel(level: number): number {
  if (level <= 2) return 0;
  if (level <= 4) return 0.15;
  if (level <= 7) return 0.2;
  return 0.25;
}
