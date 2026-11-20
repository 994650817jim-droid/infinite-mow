import {TACTICS,TAG_NAMES,tacticDescription,tacticSchool,tacticGeneral,type TacticId,type BuildTag} from './builds';
import {SCHOOLS,SCHOOL_IDS,OFFER,heroAffinity} from './schools';
import {COMBOS,COMBO_AT} from './schoolCombos';
import { BALANCE } from '../config';
import type { Player } from '../entities/Player';
import { WEAPON_DEFS, SPEAR_PIERCE, GUANDAO_TABLE, crossbowExtraArrows, zhenbeiCracks, lianhuanLinksPerMine, sunOrbitKnives, sunThrowCount, sunThrowPierce, diaochanFanCount } from '../weapons/registry';
import type { UpgradeOption, WeaponId, WeaponState } from '../types';
import { getCharacter } from './characters';
import { ATTRIBUTE_INFO, dragBodyLengths, type AttributeId, type PotionId, type RunGrowth, MARTIALS, type MasteryId } from '../systems/RunGrowth';
import { applyStageBuff } from '../systems/StageBuffs';
import { WEAPON_OVER, branchById, branchesFor, type WeaponBranch } from './weaponBranches';
import { hotkeyLabel } from './hotkeys';
import { lvbuThrustLen, lvbuSweepRadius } from '../weapons/lvbuWeapon';
import { zhangliaoReach } from '../weapons/zhangliaoWeapon';
import { zhouyuBlast } from '../weapons/zhouyuWeapon';

export const WEAPON_META: Record<WeaponId, { name: string; desc: string }> = {
  spear_orbit: { name: '七探盘龙枪', desc: '银枪自动索敌，向不同敌人突刺' },
  guandao: { name: '青龙偃月斩', desc: '前方 120° 扇形劈砍，最多命中 8 人' },
  crossbow: { name: '连弩齐射', desc: '自动射向最近敌人，命中后弹射；每级多射 1 支分射其他敌人' },
  flame_banner: { name: '七星灯 · 天火', desc: '在目标脚下标出星位，0.8 秒后天火落下：首领 / 精锐单点重创（溅射 30%）；没有时落进怪堆中心，溅射 40%；算无遗策那一发落地留下 4.5 秒星火焦土，灼烧范围内所有敌人' },
  zhenbei_blade: { name: '镇北环首刀', desc: '朝敌群重劈，地面裂开直线冲击波，穿透全部敌人；贴身伤害更高' },
  lianhuan_mines: { name: '凤雏连环令', desc: '边走边在脚下落火雷，雷与雷之间拉起烧红的铁索：碰到铁索的敌人减速，踩雷引爆并连环引爆附近的雷' },
  sun_knives: { name: '弓腰姬飞刀', desc: '身边环绕飞刀割伤近敌，并不断掷出飞刀穿透远敌；移动中掷得更快' },
  baodiao_bow: { name: '宝雕弓', desc: '向远处最强的敌人射出重箭，重创并击退，再穿透身后 2 人；首领、精锐优先' },
  dangyang_roar: { name: '丈八蛇矛·当阳喝断', desc: '朝前大喝，越推越宽的弧形声浪向前推进，伤害并一路推后敌人' },
  zhanjin_lance: { name: '虎头湛金枪', desc: '一枪把敌人挑飞，落地时砸出范围伤害；铁骑满层后向前冲锋破阵' },
  shuanggu_swords: { name: '双股剑', desc: '双剑同时出手，分别在两名敌人身上斩出「×」形交叉斩；仁德满层时攻速提高' },
  fangtian_ji: { name: '方天画戟', desc: '两次长突穿透一线，接一次 360° 横扫，循环；无双狂暴时每次出手打两次' },
  pozhen_shuangji: { name: '破阵双戟', desc: '左右双戟极快连斩身前一扇；每击叠震慑，3 层溃逃 2 秒（溃兵受伤 +25%）' },
  huochuan_ling: { name: '火船令', desc: '朝敌群放出 2 艘小火船，撞上敌兵或到尽头爆燃，留下短火场' },
  diaochan_fans: { name: '双花扇', desc: '掷出回旋团扇，去回各打一次；被扇中 2 次的敌人倒戈（3 秒内转而攻击同伴）' },
};
/** 武器显示名：张飞用同一套长枪，叫丈八蛇矛。 */
export function weaponName(id: WeaponId, character?: string): string { return character === 'zhangfei' && id === 'spear_orbit' ? '丈八蛇矛' : character === 'zhangfei' && id === 'dangyang_roar' ? '丈八蛇矛' : character === 'huangyueying' ? '机关连弩' : character === 'pangtong' && id === 'lianhuan_mines' ? '凤雏连环令' : character === 'liubei' ? '双股剑' : character === 'weiyan' && id === 'zhenbei_blade' ? '镇北环首刀' : character === 'machao' ? '虎头湛金枪' : character === 'sunshangxiang' && id === 'sun_knives' ? '弓腰姬飞刀' : character === 'diaochan' && id === 'diaochan_fans' ? '双花扇' : WEAPON_META[id].name; }

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

/**
 * 卡面文案统一格式（2026-11-19 用户「关于技能3选一描述需要检查优化一下」）：第一行写效果和关键数字，其后写条件；有效范围在卡底徽记（scope）。
 * 电脑卡说明区约 15 字 × 4 行（16 号字）；数字由卡面自动高亮（ui/CardRichText）。数值一律取代码里的表 / 常量。
 */
export function weaponUpgrade(weapon: WeaponState, player: Player): UpgradeOption {
  const def = WEAPON_DEFS[weapon.id];
  const next = Math.min(def.maxLevel, weapon.level + 1);
  const damage = (level: number): string => def.damage(level, player.stats).toFixed(1).replace(/\.0$/, '');
  // 只列出真正变化的数值；伤害附提升百分比，攻击间隔不变时不显示。
  const d0 = def.damage(weapon.level, player.stats), d1 = def.damage(next, player.stats);
  const c0 = def.cooldown(weapon.level, player.stats), c1 = def.cooldown(next, player.stats);
  let desc = `伤害 ${damage(weapon.level)} → ${damage(next)}（+${Math.round((d1 / Math.max(.01, d0) - 1) * 100)}%）`;
  if (Math.abs(c1 - c0) >= .005) desc += `\n间隔 ${c0.toFixed(2)} → ${c1.toFixed(2)} 秒`;
  if (weapon.id === 'spear_orbit') { const a = SPEAR_PIERCE[weapon.level - 1], z = SPEAR_PIERCE[next - 1]; desc += `\n枪数 ${weapon.level} → ${next} · 枪长 ${a.len} → ${z.len}\n每枪穿透 ${a.cap === z.cap ? z.cap : a.cap + ' → ' + z.cap} 人`; }
  if (weapon.id === 'crossbow') desc += `\n每轮 ${1 + crossbowExtraArrows(weapon.level)} → ${1 + crossbowExtraArrows(next)} 支（多的分射他敌 70%）`;
  if (weapon.id === 'zhenbei_blade' && [1, 3, 5].includes(next) && next !== weapon.level) desc += `\n裂波 ${zhenbeiCracks(weapon.level)} → ${zhenbeiCracks(next)} 道`;
  // 庞统·铁索连环：每级一项新能力（数值见 PASSIVE_RULES.tether* / loop*）
  if (weapon.id === 'lianhuan_mines') desc += ['', '', '\n新增「铁索灼伤」：碰到铁索\n每 0.5 秒受 30% 伤害', '\n新增「火走铁索」：链上敌人\n受 60% 伤害；落雷更快', `\n双链：每枚雷连 ${lianhuanLinksPerMine(next)} 条铁索\n火雷上限 +2`, '\n铁索连舟：铁索围成一圈\n3 秒后整圈齐爆；火雷上限 +2'][next] ?? '';
  // 孙尚香：环绕飞刀与穿透同一行，掷刀一行（卡面最多 4 行）
  if (weapon.id === 'sun_knives') {
    const L = weapon.level, parts = [sunOrbitKnives(next) !== sunOrbitKnives(L) ? `环绕飞刀 ${sunOrbitKnives(L)} → ${sunOrbitKnives(next)}` : '', sunThrowPierce(next) !== sunThrowPierce(L) ? `穿透 ${sunThrowPierce(L)} → ${sunThrowPierce(next)} 人` : ''].filter(Boolean);
    if (parts.length) desc += '\n' + parts.join(' · ');
    if (sunThrowCount(next) !== sunThrowCount(L)) desc += `\n每次掷 ${sunThrowCount(L)} → ${sunThrowCount(next)} 把（多的 60%）`;
  }
  if (weapon.id === 'huochuan_ling') desc += `\n爆燃半径 ${zhouyuBlast(weapon.level)} → ${zhouyuBlast(next)}`;
  if (weapon.id === 'pozhen_shuangji') desc += `\n连斩距离 ${zhangliaoReach(weapon.level)} → ${zhangliaoReach(next)}`;
  if (weapon.id === 'fangtian_ji') desc += `\n长突 ${lvbuThrustLen(weapon.level)} → ${lvbuThrustLen(next)} · 横扫半径 ${lvbuSweepRadius(weapon.level, 0)} → ${lvbuSweepRadius(next, 0)}`;
  if (weapon.id === 'diaochan_fans' && diaochanFanCount(next) !== diaochanFanCount(weapon.level)) desc += `\n每次掷扇 ${diaochanFanCount(weapon.level)} → ${diaochanFanCount(next)} 柄`;
  if (weapon.id === 'guandao') desc += `\n范围 ${GUANDAO_TABLE[weapon.level - 1].radius} → ${GUANDAO_TABLE[next - 1].radius}${weapon.level < 3 && next >= 3 ? '\n解锁二段刀气' : ''}`;
  return {
    id: `signature_weapon_${weapon.id}`,
    name: `${weaponName(weapon.id, player.growth?.character)} · Lv.${weapon.level}→${next}`,
    desc,
    kind: 'weapon',
    categoryLabel: '本命武器',
    scope: 'run',
    weaponId: weapon.id,
    apply: (_p, weapons, growth) => {
      if (growth && getCharacter(growth.character).startWeapon !== weapon.id) return;
      const target = weapons.find((w) => w.id === weapon.id);
      if (target && target.level < def.maxLevel) target.level += 1;
    },
  };
}

/** 兵器专职卡（二选一，选定后本次征程锁定）。 */
export function branchOption(weapon: WeaponState, b: WeaponBranch): UpgradeOption {
  return { id: 'branch_' + b.id, name: '专职 · ' + b.name, desc: b.desc + '\n二选一 · 选定后本次征程锁定', kind: 'weapon', weaponId: weapon.id, categoryLabel: '兵器专职 · ' + SCHOOLS[b.school].name + '派', icon: b.icon, scope: 'run',
    apply: (_p, weapons) => { const w = weapons.find(x => x.id === weapon.id); if (w && !w.branch) w.branch = b.id; } };
}
/** 本命 Lv6 / 7（沿所选分支加深；第四章 / 第八章开放）。 */
export function overOption(weapon: WeaponState, b: WeaponBranch, character: string): UpgradeOption {
  const lv = 5 + (weapon.over ?? 0) + 1;
  return { id: 'weapon_over_' + lv, name: weaponName(weapon.id, character) + ' · Lv.' + lv, desc: (lv === 6 ? b.lv6 : b.lv7) + '\n本命伤害 +' + Math.round(WEAPON_OVER.damagePer * 100) + '%' + (lv === 7 ? '\n该派 4 势时进阶「' + b.finalName + '」' : ''), kind: 'weapon', weaponId: weapon.id, categoryLabel: '本命专职 · ' + b.name, scope: 'run',
    apply: (_p, weapons) => { const w = weapons.find(x => x.id === weapon.id); if (w && (w.over ?? 0) < 2) w.over = (w.over ?? 0) + 1; } };
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

const POTIONS: Record<PotionId, { name: string; desc: string }> = {
  rejuvenation: { name: '回春丹', desc: '回复 30% 生命\n收入药囊，按 ' + hotkeyLabel('potion') + ' 服用\n药囊满时立即服用' },
  berserk: { name: '狂战丹', desc: '10 秒内武器伤害 +25%、攻速 +20%' },
};
export function martialDescription(id:MasteryId,level:number):string {
 const n=Math.max(1,Math.min(3,level)),i=n-1;
 const descriptions:Record<MasteryId,string>={
 // 2026-11-19 三选一文案审校：先写效果和数字、再写条件，每行约 15 字、最多 4 行；数值按代码（同 11-17 审校）
 dragon_gallop:'枪刺攻速 +'+(8*n)+'%',
 cloud_pierce:'枪刺长度 +'+(10*n)+'%\n多穿透 '+n+' 名敌人',
 dragon_charge:'每挥 4 刀，下一刀 '+[140,165,190][i]+'% 伤害'+(n===3?'\n这一刀还击退普通敌人':''),
 dragging_blade:'移动约 '+dragBodyLengths(i+1)+' 个身位后\n下一刀追加半月刀气'+(n===3?'\n再加一道回旋刀气':''),
 steady_aim:'站定时暴击率渐增\n5 秒内最多 +'+[15,20,25][i]+'%\n移动会慢慢失去加成',
 pearl_volley:'每射 '+[5,4,3][i]+' 次，多射一支 70% 的箭'+(n===3?'\n这支箭还能弹射一次':''),
 wildfire:'每第 4 发天火放出东风火龙\n直线扫过：'+[60,75,90][i]+'% 伤害并吹开敌人\n无首领 / 精锐时每第 3 发',
 eight_trigrams:'算无遗策处布八阵 '+[2,2.5,3][i]+' 秒\n阵内减速 40%、受伤 +15%\n每 0.5 秒受天火 '+[15,20,25][i]+'% 伤害'+(n===3?'\n阵内首领出招间隔 +25%':''),
 kaishan:'每劈 4 刀，下一刀重劈\n伤害 '+[150,170,190][i]+'%、裂波加宽 50%',
 gujun:'身边每有 1 名敌人\n伤害 +'+[1.5,2,2.5][i]+'%（最多算 15 名）',
 fulei:'火雷上限 +'+(2*n)+'\n每枚多留 '+(2*n)+' 秒',
 lianying:'火雷连锁引爆距离 +'+(15*n)+'%'+(n===3?'\n被连锁引爆的雷伤害 +20%':''),
 huishen:'移动中掷出的飞刀\n多穿透 '+n+' 名敌人',
 baibi:'执刀侍婢上限 +'+n+'\n每名多护卫 '+(2*n)+' 秒',
 nichang:'飞扇飞行距离 +'+(15*n)+'%'+(n===3?'\n每次多掷 1 柄团扇':''),
 meirenji:'倒戈的敌人\n多倒戈 '+(0.5*n)+' 秒',
 jingxin:'神射持续 '+[7,8,9][i]+' 秒（原 6 秒）\n神射中重箭伤害 +'+[20,22,25][i]+'%'+(n===3?'\n首箭变扇形三连重箭':''),
 laoji:'本关每杀 10 敌，射速 +2.5%\n最多 +'+[15,20,25][i]+'%'+(n===3?'\n神射中斩精锐 / 首领：\n回复 4% 生命、神射 +2 秒':''),
 wanrendi:'声浪推进距离 +'+(12*n)+'%',
 dahe:'断桥多留 '+(0.5*n)+' 秒\n震慑（敌人不能动）多 '+(0.2*n).toFixed(1)+' 秒',
 jinma:'挑飞落地范围 +'+(15*n)+'%'+(n===3?'\n落地后再震一次（50%）':''),
 tieqi:'铁骑冲锋距离 +'+(20*n)+'%\n冲锋伤害 +'+(10*n)+'%',
 taoyuan:'交叉斩溅射范围 +'+(10*n)+'（基础 30）'+(n===3?'\n三剑分击，同时斩三人':''),
 xiemin:'仁德回复量 +'+(25*n)+'%\n自身与部曲都算',
 chitu:'无双狂暴时每 '+[3.5,3,2.5][i]+' 秒朝前冲刺\n穿过沿途敌兵造成 '+[60,80,100][i]+'% 伤害',
 huaji:'横扫范围 +'+(15*n)+'%',
 xiandeng:'每 '+[5,4.5,4][i]+' 秒先突进到敌前\n再连斩 '+[2,2,3][i]+' 击',
 yaliang:'英发少攒 '+(15*n)+'%\n（满 '+Math.round(20*(1-.15*n))+' 层刮东风）',
 lianchuan:'每轮火船 +'+n+' 艘',
 weiming:'震慑 2 层就溃逃'+(n>=2?'\n溃逃再久 '+[0,.5,1][i]+' 秒':''),
 };
 return descriptions[id];
}
export function martialOption(id:MasteryId,level:number):UpgradeOption {
 const n=level+1;return {id:'martial_'+id+'_'+n,name:MARTIALS[id].name+' · Lv.'+n,desc:n>=4?'精熟：全伤害 +4%\n武艺效果已满（同 Lv.3）':martialDescription(id,n),kind:'martial',categoryLabel:n>=4?'专属武艺 · 精熟':'专属武艺',scope:'run',apply:(_p,_w,g)=>{g?.learn(id);}};
}


export function potionOption(id: PotionId): UpgradeOption {
  return { id: `potion_${id}`, name: POTIONS[id].name, desc: POTIONS[id].desc, kind: 'potion', categoryLabel: '宝药', scope: 'once',
    apply: (player, _weapons, growth) => growth?.usePotion(id, player, (player.scene as unknown as { combatNow?: number }).combatNow ?? player.scene.time.now) };
}

export function canOfferRejuvenation(player: Player): boolean {
  if (!(player.hp < player.maxHp)) return false;
  const amount = Math.round(player.maxHp * .3);
  return Math.min(player.maxHp, player.hp + amount) > player.hp;
}

/** 保底选项：原数值（+5生命/+5%拾取/+0.1回复）几乎无感，提高到可感知并各附带一个即时效果。 */
export function foundationOptions():UpgradeOption[]{
  return [
    // 2026-11-19（wave-progression-redesign.md P0）：改为本关有效（记在 StageBuffs，征程构筑存档时扣掉），永久生命由「体魄」按等级给
    {id:'foundation_hp',name:'固本培元',desc:'生命上限 +12\n立即回复 12 生命',kind:'foundation',categoryLabel:'基础成长',scope:'stage',apply:p=>{applyStageBuff(p,s=>{s.maxHpBonus+=12;});p.heal(12);}},
    {id:'foundation_pickup',name:'搜集辎重',desc:'拾取范围 +15%\n立即收拢全场军功宝石',kind:'foundation',categoryLabel:'基础成长',scope:'stage',apply:p=>{applyStageBuff(p,s=>{s.pickupRadius*=1.15;});const s=p.scene as unknown as {gemMagnetUntil?:number;combatNow?:number};s.gemMagnetUntil=(s.combatNow??0)+2500;}},
    {id:'foundation_recovery',name:'调息养元',desc:'每秒回复 +0.3 生命\n立即回复 15% 生命',kind:'foundation',categoryLabel:'基础成长',scope:'stage',apply:p=>{applyStageBuff(p,s=>{s.regen+=.3;});p.heal(Math.round(p.maxHp*.15));}},
  ];
}

/**
 * 战法卡上的流派说明（2026-11-19 流派重做）：「火攻 · 势 3 → 4　解锁【燎原】」。
 * 势 = 本派战法等级之和（学新战法、升级都 +1）+ 亲和 / 随行 / 信物 / 名马；2 / 4 / 6 势各解锁一档（6 势 = 觉醒）。
 */
export function schoolLabel(tag:BuildTag,tags:Record<BuildTag,number>,_learned=false):string{
  const d=SCHOOLS[tag],now=tags[tag],next=now+1,step=([2,4,6] as const).find(t=>now<t&&next>=t);
  const name=d.name+' · 势 '+now+' → '+next;
  if(step===6)return name+'　觉醒【'+d.tiers[6].name+'】！';
  if(step===2){const combo=COMBOS.find(c=>(c.a===tag&&tags[c.b]>=COMBO_AT)||(c.b===tag&&tags[c.a]>=COMBO_AT));if(combo)return name+'　解锁【'+d.tiers[2].name+'】· 合击【'+combo.name+'】';}
  if(step)return name+'　解锁【'+d.tiers[step].name+'】';
  const goal=([2,4,6] as const).find(t=>next<t);
  return goal?name+'　（'+goal+' 势：'+d.tiers[goal].name+'）':name;
}
/** 只从当前角色可用的局内成长中抽取三张唯一奖励；绝不授予其他武将的武器。 */
/** 新卡来源（五段主线关由 GameScene 给，systems/LevelCards）：战法位按概率换新卡；核心位只剩固本培元时也换。 */
export interface NewCardSource { replaceChance: number; draw: (n: number) => UpgradeOption[] }
export function buildUpgradeOptions(player: Player, weapons: WeaponState[], growth: RunGrowth = player.growth, extra?: NewCardSource): UpgradeOption[] {
  const pool: UpgradeOption[] = [];
  const ownWeaponId = getCharacter(growth.character).startWeapon;
  const ownWeapon = weapons.find(weapon => weapon.id === ownWeaponId);
  if (ownWeapon && ownWeapon.level < WEAPON_DEFS[ownWeaponId].maxLevel) pool.push(weaponUpgrade(ownWeapon, player));
  // 兵器专职：已选分支且本章开放了 Lv6 / 7 → 沿分支加深
  const myBranch = ownWeapon ? branchById(ownWeapon.branch) : undefined;
  if (ownWeapon && myBranch && (ownWeapon.over ?? 0) < WEAPON_OVER.cap) pool.push(overOption(ownWeapon, myBranch, growth.character));
  for (const id of Object.keys(MARTIALS) as MasteryId[]) if (growth.canLearn(id)) pool.push(martialOption(id,growth.masteryRank(id)));
  // 属性点改为每次升级自动 +1（Player.gainXp），三选一不再出现「通脉修习」
  // Reserve a core progression choice whenever one remains available.
  const core=pool.length?shuffle(pool)[0]:undefined;
  const b=growth.build,tags=b.tags();
  if(canOfferRejuvenation(player))pool.push(potionOption('rejuvenation'));
  // 战法卡（流派重做：三选一 = 1 张本命 / 武艺 + 2 张战法）；卸力 / 以战养战是「基础成长」，不占战法卡位
  const tacticCards:UpgradeOption[]=[];
  for(const id of Object.keys(TACTICS)as TacticId[])if(b.canLearn(id)){
    const d=TACTICS[id],n=b.rank(id)+1,school=tacticSchool(id); // 精研 Lv4 / 5（按章开放）显示实际等级
    const option:UpgradeOption={id:'tactic_'+id,name:d.name+' · Lv.'+n,desc:tacticDescription(id,n),kind:'tactic',scope:'run',icon:'build_icon_'+id,categoryLabel:school?schoolLabel(school,tags):'基础成长',apply:(_p,_w,g)=>{g?.build.learn(id);}};
    if(school&&!tacticGeneral(id))tacticCards.push(option);else pool.push(option);
  }
  // Potions leave the normal pool. Valid, non-healing fallback choices avoid exhausted-pool deadlocks.
  const foundations=foundationOptions();
  if(!core)pool.push(foundations[0]);
  const guaranteed=core??foundations[0];
  // 武将谱「战法心得」：心得战法权重 ×2；开局第一次升级保证出一张心得卡（xindeFirst）
  const isXinde=(option:UpgradeOption)=>option.kind==='tactic'&&growth.xinde.includes(option.id.replace('tactic_','')as TacticId);
  // 权重：1 + min(上限, 势 × 系数)，亲和派 ×1.5，心得 ×2（data/schools.ts OFFER）
  const affinity=heroAffinity(growth.character),schoolOf=(o:UpgradeOption)=>tacticSchool(o.id.replace('tactic_','')as TacticId);
  const weight=(o:UpgradeOption):number=>{const sc=o.kind==='tactic'?schoolOf(o):null;if(!sc)return 1;return (1+Math.min(OFFER.weightMax,tags[sc]*OFFER.weightPer))*(affinity.includes(sc)?OFFER.affinityWeight:1)*(myBranch&&myBranch.school===sc?2:1)*(isXinde(o)?2:1);};
  const draw=(list:UpgradeOption[])=>list.map(o=>({o,key:Math.pow(Math.random(),1/weight(o))})).sort((x,y)=>y.key-x.key).map(v=>v.o);
  // 专精卡位：有一派到 OFFER.specialtyAt 势后，两张战法卡里必有一张是势最高那派的
  const top=[...SCHOOL_IDS].sort((x,y)=>tags[y]-tags[x])[0],picked:UpgradeOption[]=[];
  if(tags[top]>=OFFER.specialtyAt){const own=draw(tacticCards.filter(o=>schoolOf(o)===top));if(own[0])picked.push(own[0]);}
  for(const o of draw(tacticCards))if(picked.length<OFFER.tacticCards&&!picked.includes(o))picked.push(o);
  if(growth.xindeFirst){const xd=tacticCards.find(isXinde);if(xd||isXinde(guaranteed)){growth.xindeFirst=false;if(xd&&!picked.includes(xd)){picked.pop();picked.unshift(xd);}}}
  // 战法卡不够两张：从其余（另一张本命 / 武艺、药、基础成长）补
  const rest=draw(pool.filter(o=>o.id!==guaranteed.id&&!picked.includes(o)));
  for(const o of rest)if(picked.length<2)picked.push(o);
  for(const f of foundations)if(picked.length<2&&f.id!==guaranteed.id&&!picked.some(o=>o.id===f.id))picked.push(f);
  const final=[guaranteed,...picked.slice(0,2)];
  // 兵器专职二选一：本命 Lv5、还没选分支、分支派任一到 2 势 → 两张专职卡占前两格
  if(ownWeapon&&ownWeapon.level>=WEAPON_DEFS[ownWeaponId].maxLevel&&!ownWeapon.branch){const bs=branchesFor(ownWeaponId);if(bs.length===2&&bs.every(x=>x.ready)&&bs.some(x=>tags[x.school]>=2))return shuffle([branchOption(ownWeapon,bs[0]),branchOption(ownWeapon,bs[1])]).concat(final.filter(o=>o.kind!=='weapon').slice(-1));}
  // 2026-11-19 新卡池（wave-progression-redesign.md §4.2）：固本培元一类的保底卡、以及按概率的战法位，换成新卡（战场机缘 / 锦囊 / 兵源 / 军资 / 心法）
  if(extra){const slots:number[]=[];final.forEach((o,i)=>{if(o.kind==='foundation'||(i>0&&o.kind==='tactic'&&Math.random()<extra.replaceChance))slots.push(i);});
    // 不出「三张都没用的」：核心位已不是永久成长时，至少留一张战法（2026-11-19 池子深度）
    if(final[0].kind==='foundation'){const keep=slots.filter(i=>i>0&&final[i].kind==='tactic');if(keep.length&&keep.length===final.filter((o,i)=>i>0&&o.kind==='tactic').length)slots.splice(slots.indexOf(keep[0]),1);}
    if(slots.length){const fresh=extra.draw(slots.length);slots.forEach((k,j)=>{if(fresh[j])final[k]=fresh[j];});}}
  return shuffle(final);
}
