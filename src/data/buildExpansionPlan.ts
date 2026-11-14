/** Phase 20B planning contract. Deliberately not registered in the live reward pool yet. */
export const FUTURE_BUILD_TAGS=['combo','critical','skirmish','flame','charge','control','command','bulwark','thunder','poison','mechanism','soul'] as const;
export type PlannedBuildTag=typeof FUTURE_BUILD_TAGS[number];
export interface HybridPlan {id:string;name:string;tags:readonly [PlannedBuildTag,PlannedBuildTag];cooldownMs:number;maxTargets:number;effect:string;}
export const HYBRID_PLANS:readonly HybridPlan[]=[
{id:'stormfire',name:'雷火天罚',tags:['thunder','flame'],cooldownMs:6000,maxTargets:6,effect:'雷击燃烧目标触发一次落雷爆焰；派生伤害不再触发雷印或点火'},
{id:'venom_bolts',name:'万毒连弩',tags:['poison','mechanism'],cooldownMs:4000,maxTargets:4,effect:'机关命中中毒目标释放一次毒弩齐射；每目标每轮至多一击'},
{id:'thunder_pursuit',name:'雷霆追击',tags:['thunder','combo'],cooldownMs:3000,maxTargets:3,effect:'连击追击携带一次链雷；链雷不能再触发追击'},
{id:'engine_fire',name:'机关火海',tags:['mechanism','flame'],cooldownMs:6000,maxTargets:8,effect:'机关附近生成短时火区；同系火区共享每目标伤害间隔'},
{id:'peerless_echo',name:'无双幻影',tags:['soul','combo'],cooldownMs:10000,maxTargets:6,effect:'积满战魂后幻影模仿一次本命攻击，不积累连击或战魂'},
{id:'last_stand',name:'绝境血战',tags:['charge','bulwark'],cooldownMs:12000,maxTargets:5,effect:'低生命受击蓄出防御反击；不提供无限无敌或递归反伤'},
{id:'piercing_aim',name:'神射穿云',tags:['charge','critical'],cooldownMs:5000,maxTargets:4,effect:'完成蓄势后的暴击追加穿透冲击，沿原攻击方向去重'},
{id:'eight_engines',name:'八门机关',tags:['control','mechanism'],cooldownMs:8000,maxTargets:6,effect:'控场触发短时陷阱群；限制同时存在的陷阱数'},
{id:'soul_legion',name:'战魂军团',tags:['soul','command'],cooldownMs:12000,maxTargets:3,effect:'军令激活时召唤短时幻影援护；幻影不占永久军团人数'},
{id:'roaming_thunder',name:'游龙雷影',tags:['skirmish','thunder'],cooldownMs:5000,maxTargets:4,effect:'主动移动蓄满后下一击释放雷影，位移或击退不积累'},
{id:'venom_fire',name:'毒火焚城',tags:['poison','flame'],cooldownMs:5000,maxTargets:5,effect:'毒火共存目标死亡扩散一次弱毒焰；传播不递归'},
{id:'iron_legion',name:'铁壁军阵',tags:['bulwark','command'],cooldownMs:10000,maxTargets:5,effect:'防御成功后为附近士兵提供短时护佑；不恢复旧军阵或更改双模式'},
];
export function plannedBuildProgress(tags:Partial<Record<PlannedBuildTag,number>>){
 return{basic:FUTURE_BUILD_TAGS.filter(t=>(tags[t]??0)>=2),pure:FUTURE_BUILD_TAGS.filter(t=>(tags[t]??0)>=4),hybrid:HYBRID_PLANS.filter(p=>p.tags.every(t=>(tags[t]??0)>=2)).map(p=>p.id)};
}
