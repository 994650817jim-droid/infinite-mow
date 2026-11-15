import {TACTICS,TREASURES,TAG_NAMES,tacticDescription,type TacticId,type TreasureId,type BuildTag} from './builds';
import {AWAKENINGS} from './awakenings';
import { BALANCE } from '../config';
import type { Player } from '../entities/Player';
import { RELICS, relicChanceForLevel } from './relics';
import { WEAPON_DEFS, SPEAR_PIERCE, GUANDAO_TABLE, crossbowExtraArrows } from '../weapons/registry';
import type { UpgradeOption, WeaponId, WeaponState } from '../types';
import { getCharacter } from './characters';
import { ATTRIBUTE_INFO, type AttributeId, type PotionId, type RunGrowth, type TrinketId, MARTIALS, type MasteryId } from '../systems/RunGrowth';

export const WEAPON_META: Record<WeaponId, { name: string; desc: string }> = {
  spear_orbit: { name: '七探盘龙枪', desc: '银枪自动索敌，向不同敌人突刺' },
  guandao: { name: '青龙偃月斩', desc: '前方 120° 扇形劈砍，最多命中 8 人' },
  crossbow: { name: '连弩齐射', desc: '自动射向最近敌人，命中后弹射；每级多射 1 支分射其他敌人' },
  flame_banner: { name: '烈焰战旗', desc: '前方爆发烈焰，范围灼烧' },
};
/** 武器显示名：张飞用同一套长枪，叫丈八蛇矛。 */
export function weaponName(id: WeaponId, character?: string): string { return character === 'zhangfei' && id === 'spear_orbit' ? '丈八蛇矛' : character === 'liubei' ? '双股剑' : character === 'weiyan' ? '镇北大刀' : character === 'machao' ? '虎头湛金枪' : WEAPON_META[id].name; }

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
  // 只列出真正变化的数值；伤害附提升百分比，攻击间隔不变时不显示。
  const d0 = def.damage(weapon.level, player.stats), d1 = def.damage(next, player.stats);
  const c0 = def.cooldown(weapon.level, player.stats), c1 = def.cooldown(next, player.stats);
  let desc = `每次伤害 ${damage(weapon.level)} → ${damage(next)}（+${Math.round((d1 / Math.max(.01, d0) - 1) * 100)}%）`;
  if (Math.abs(c1 - c0) >= .005) desc += `\n攻击间隔 ${c0.toFixed(2)} → ${c1.toFixed(2)}秒`;
  if (weapon.id === 'spear_orbit') desc += `\n枪数 ${weapon.level} → ${next}，每枪穿透${SPEAR_PIERCE[weapon.level - 1].cap === SPEAR_PIERCE[next - 1].cap ? SPEAR_PIERCE[next - 1].cap : SPEAR_PIERCE[weapon.level - 1].cap + '→' + SPEAR_PIERCE[next - 1].cap}人
枪长 ${SPEAR_PIERCE[weapon.level - 1].len} → ${SPEAR_PIERCE[next - 1].len}`;
  if (weapon.id === 'crossbow') desc += `\n每轮 ${1 + crossbowExtraArrows(weapon.level)} → ${1 + crossbowExtraArrows(next)} 支箭（多出的箭分射其他敌人，70%伤害）`;
  if (weapon.id === 'guandao') desc += `\n范围${GUANDAO_TABLE[weapon.level - 1].radius} → ${GUANDAO_TABLE[next - 1].radius}${weapon.level < 3 && next >= 3 ? '，解锁二段刀气' : ''}`;
  return {
    id: `signature_weapon_${weapon.id}`,
    name: `本命武器强化 · Lv.${weapon.level}→${next}`,
    desc,
    kind: 'weapon',
    categoryLabel: '本命武器',
    weaponId: weapon.id,
    apply: (_p, weapons, growth) => {
      if (growth && getCharacter(growth.character).startWeapon !== weapon.id) return;
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

const POTIONS: Record<PotionId, { name: string; desc: string }> = {
  rejuvenation: { name: '回春丹', desc: '立即恢复最大生命值的 30%' },
  berserk: { name: '狂战丹', desc: '10 秒内武器伤害 +25%，攻速 +20%' },
};
const TRINKETS: Record<TrinketId, { name: string; desc: string }> = {
  tiger_tally: { name: '虎符', desc: '全体蜀军造成的伤害 +20%' },
  heart_mirror: { name: '护心镜', desc: '武将受到的伤害 -15%' },
  wind_boots: { name: '疾风靴', desc: '移动速度 +10%' },
};

export function martialDescription(id:MasteryId,level:number):string {
 const n=Math.max(1,Math.min(3,level)),i=n-1;
 const descriptions:Record<MasteryId,string>={
 dragon_gallop:'枪刺攻击速度提高'+(8*n)+'%。\n出枪更快，最多强化3级。',
 cloud_pierce:'枪刺长度增加'+(10*n)+'%，多穿透'+n+'名敌人。\n适合攻击密集敌群。',
 dragon_charge:'普通挥刀4次后，下一刀造成'+[140,165,190][i]+'%伤害。'+(n===3?'\n这一刀还能击退普通敌人。':''),
 dragging_blade:'主动移动约'+['5','4','3'][i]+'个身位后，下次挥刀追加半月刀气。'+(n===3?'\n再追加一道较弱的回旋刀气。':''),
 steady_aim:'站立蓄势，最多5秒提高'+[15,20,25][i]+'个百分点暴击率。\n自动射击不打断，移动会逐渐失去蓄势。',
 pearl_volley:'每射击'+[5,4,3][i]+'次，自动多射一发70%伤害的箭。'+(n===3?'\n追加箭可再弹射一次。':''),
 wildfire:'战旗爆炸后，留下'+[1,1.8,2.5][i]+'秒残火。\n每半秒烧伤一次。'+(n===3?'燃烧范围也变大。':''),
 eight_trigrams:'每施放3次战旗，生成减速法阵，随后爆炸。\n减速'+[35,45,50][i]+'%。'+(n>=2?'敌人会向阵心聚集。':'')+(n===3?'爆炸再扩散一次。':''),
 };
 return descriptions[id];
}
function martialOption(id:MasteryId,level:number):UpgradeOption {
 const n=level+1;return {id:'martial_'+id+'_'+n,name:MARTIALS[id].name+' · Lv.'+n,desc:martialDescription(id,n),kind:'martial',categoryLabel:'专属武艺',apply:(_p,_w,g)=>{g?.learn(id);}};
}


function potionOption(id: PotionId): UpgradeOption {
  return { id: `potion_${id}`, name: POTIONS[id].name, desc: POTIONS[id].desc, kind: 'potion', categoryLabel: '宝药',
    apply: (player, _weapons, growth) => growth?.usePotion(id, player, (player.scene as unknown as { combatNow?: number }).combatNow ?? player.scene.time.now) };
}

export function canOfferRejuvenation(player: Player): boolean {
  if (!(player.hp < player.maxHp)) return false;
  const amount = Math.round(player.maxHp * .3);
  return Math.min(player.maxHp, player.hp + amount) > player.hp;
}

function trinketOption(id: TrinketId, growth: RunGrowth, replace?: TrinketId): UpgradeOption {
  const detail = TRINKETS[id];
  const old = replace ? TRINKETS[replace].name : '';
  return { id: replace ? `trinket_replace_${replace}_${id}` : `trinket_${id}`,
    name: detail.name, desc: replace ? `${detail.desc} · 替换${old}` : detail.desc,
    kind: 'trinket', categoryLabel: replace ? '替换饰品' : '通用饰品',
    apply: (_player, _weapons, current) => current?.equipTrinket(id, replace) };
}

/** 保底选项：原数值（+5生命/+5%拾取/+0.1回复）几乎无感，提高到可感知并各附带一个即时效果。 */
export function foundationOptions():UpgradeOption[]{
  return [
    {id:'foundation_hp',name:'固本培元',desc:'最大生命+12\n并立即回复12生命',kind:'foundation',categoryLabel:'基础成长',apply:p=>{p.stats.maxHpBonus+=12;p.heal(12);}},
    {id:'foundation_pickup',name:'搜集辎重',desc:'拾取范围+15%\n并立刻收拢全场军功宝石',kind:'foundation',categoryLabel:'基础成长',apply:p=>{p.stats.pickupRadius*=1.15;const s=p.scene as unknown as {gemMagnetUntil?:number;combatNow?:number};s.gemMagnetUntil=(s.combatNow??0)+2500;}},
    {id:'foundation_recovery',name:'调息养元',desc:'每秒生命恢复+0.3\n并立即回复15%生命',kind:'foundation',categoryLabel:'基础成长',apply:p=>{p.stats.regen+=.3;p.heal(Math.round(p.maxHp*.15));}},
  ];
}

/**
 * 战法卡上的流派说明（原“1→2/4 · 2基础 / 4觉醒”难懂）：一件 = 该流派的一个战法或宝物。
 * 同流派集齐 4 件觉醒；或与搭档流派各 2 件双系觉醒。升级已学战法不增加件数。
 */
export function schoolLabel(tag:BuildTag,tags:Record<BuildTag,number>,learned:boolean):string{
  const name=TAG_NAMES[tag],now=tags[tag];
  if(learned)return name+'流派 · 升级（仍为'+Math.min(4,now)+'/4件）';
  const next=now+1;if(next>=4)return name+'流派 第'+Math.min(4,next)+'/4件 · 觉醒';
  const pair=AWAKENINGS.find(a=>a.tags.length===2&&(a.tags as readonly BuildTag[]).includes(tag)),partner=pair?(pair.tags as readonly BuildTag[]).find(t=>t!==tag):undefined;
  if(partner&&next>=2&&tags[partner]>=2)return name+'流派 第'+next+'/4件 · 与'+TAG_NAMES[partner]+'各2件，双系觉醒';
  if(partner&&next>=1)return name+'流派 第'+next+'/4件 · 集齐4件，或与'+TAG_NAMES[partner]+'各2件觉醒';
  return name+'流派 第'+next+'/4件 · 集齐4件觉醒';
}
/** 只从当前角色可用的局内成长中抽取三张唯一奖励；绝不授予其他武将的武器。 */
export function buildUpgradeOptions(player: Player, weapons: WeaponState[], growth: RunGrowth = player.growth): UpgradeOption[] {
  const pool: UpgradeOption[] = [];
  const ownWeaponId = getCharacter(growth.character).startWeapon;
  const ownWeapon = weapons.find(weapon => weapon.id === ownWeaponId);
  if (ownWeapon && ownWeapon.level < WEAPON_DEFS[ownWeaponId].maxLevel) pool.push(weaponUpgrade(ownWeapon, player));
  for (const id of Object.keys(MARTIALS) as MasteryId[]) if (growth.canLearn(id)) pool.push(martialOption(id,growth.masteries[id]));
  // 属性点改为每次升级自动 +1（Player.gainXp），三选一不再出现「通脉修习」
  // Reserve a core progression choice whenever one remains available.
  const core=pool.length?shuffle(pool)[0]:undefined;
  const b=growth.build,tags=b.tags();
  if(canOfferRejuvenation(player))pool.push(potionOption('rejuvenation'));
  for(const id of Object.keys(TACTICS)as TacticId[])if(b.canLearn(id)){
    const d=TACTICS[id],n=b.level(id)+1;
    pool.push({id:'tactic_'+id,name:d.name+' · Lv.'+n,desc:tacticDescription(id,n),kind:'tactic',icon:'build_icon_'+id,categoryLabel:schoolLabel(d.tag,tags,!!b.level(id)),apply:(_p,_w,g)=>{g?.build.learn(id);}});
  }
  // Treasures are rare, and share two slots with the existing trinkets.
  if(Math.random()<.18)for(const id of Object.keys(TREASURES)as TreasureId[])if(!b.treasures.includes(id)){
    const old=b.treasures[0],legacy=growth.trinkets[0],full=b.treasures.length+growth.trinkets.length>=2,d=TREASURES[id];
    const replaced=full?(old?TREASURES[old].name:TRINKETS[legacy].name):'';
    pool.push({id:'treasure_'+id,name:d.name,desc:d.desc+(replaced?' · 替换'+replaced:''),kind:'treasure',icon:'build_icon_'+id,categoryLabel:TAG_NAMES[d.tag]+'宝物 · 稀有',apply:(_p,_w,g)=>{
      if(!g||g.build.treasures.includes(id))return;
      if(g.build.treasures.length+g.trinkets.length>=2){
        if(old&&g.build.treasures.includes(old))g.build.treasures.splice(g.build.treasures.indexOf(old),1);
        else if(legacy&&g.trinkets.includes(legacy))g.trinkets.splice(g.trinkets.indexOf(legacy),1);else return;
      }
      g.build.treasures.push(id);
    }});
  }
  // Potions leave the normal pool. Valid, non-healing fallback choices avoid exhausted-pool deadlocks.
  const foundations=foundationOptions();
  if(!core)pool.push(foundations[0]);
  const guaranteed=core??foundations[0];
  const weight=(option:UpgradeOption):number=>{const id=option.id.replace('tactic_','')as TacticId;return option.kind==='tactic'?1+Math.min(2,tags[TACTICS[id].tag]*.5):1;};
  const rest=pool.filter(o=>o.id!==guaranteed.id).map(o=>({o,key:Math.pow(Math.random(),1/weight(o))})).sort((a,b)=>b.key-a.key).map(v=>v.o);
  for(const f of foundations)if(rest.length<2&&f.id!==guaranteed.id&&!rest.some(o=>o.id===f.id))rest.push(f);
  return shuffle([guaranteed,...rest.slice(0,2)]);
}
