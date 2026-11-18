import {awakeningProgress} from './awakenings';
/** Phase20A: content data only; tag thresholds deliberately reserved for Phase20C. */
export type BuildTag='combo'|'critical'|'skirmish'|'flame'|'charge'|'control'|'command'|'bulwark';
export const TAG_NAMES:Record<BuildTag,string>={combo:'连击',critical:'暴击',skirmish:'游击',flame:'烈焰',charge:'蓄势',control:'控场',command:'军令',bulwark:'铁壁'};
export const TACTICS={
 // 2026-11-17 文案审校（用户「3选一和很多道具技能描述…让玩家容易懂」）：先写效果、后写条件；Boss 统一叫「首领」；数值按代码
 deflect:{name:'卸力',tag:'bulwark',desc:'下一次受到的伤害 -25/35/45%，冷却8/7/6秒；首领的攻击也能卸'},
 rebound:{name:'反震',tag:'bulwark',desc:'受伤时反击身边3/4/5名敌人，伤害为所受伤害的35/50/65%；单独学习时受伤 -15%（冷却8秒）'},
 watch:{name:'守望',tag:'bulwark',desc:'士兵受伤时，给周围血最少的1/2/3名士兵减伤15/20/25%，持续1.5/1.8/2.1秒，冷却5秒'},
 coordination:{name:'协击',tag:'command',desc:'命中后附近2/3/4名士兵集火该敌人2/2.5/3秒，冷却4/3.5/3秒'},
 rally:{name:'整军',tag:'command',desc:'每6/5/4秒治疗附近血最少的2/3/4名士兵，各回复生命上限6/9/12%'},
 breakout:{name:'破围令',tag:'command',desc:'士兵被3名以上敌人围住时，推开最多3/4/5名敌人约0.8/1/1.4个身位，冷却8/7/6秒；对首领无效'},
 snare:{name:'绊阵',tag:'control',desc:'命中时普通敌人减速18/26/34%，持续1/1.3/1.6秒；精锐减半，对首领无效'},
 traction:{name:'牵机',tag:'control',desc:'命中时把周围2/3/4名敌人拉向命中点（0.7秒）并减速12%，每级拉得更快；冷却4/3.5/3秒，对首领无效'},
 confinement:{name:'困军',tag:'control',desc:'被减速的敌人死亡时，把15/22/30%减速传给附近2/3/4名敌人，持续0.7/1/1.3秒；传过去的不会再传'},
 stored_edge:{name:'沉锋',tag:'charge',desc:'2秒没打中敌人即蓄满势，下一击伤害 +20/35/50%；打中后重新蓄势'},
 heavy_break:{name:'破阵重击',tag:'charge',desc:'蓄满势（2秒没打中）后的下一击，震伤附近2/3/4名敌人，造成20/30/40%伤害，冷却3秒'},
 concentration:{name:'凝神',tag:'charge',desc:'站着不动1.5秒，下一击沿攻击方向贯穿1/2/3名敌人，造成25/35/45%伤害；移动会失去蓄势，冷却2秒'},
 pursuit:{name:'追袭',tag:'combo',desc:'每命中6/5/4次，追击旁边1名敌人，造成25/35/45%伤害'},
 chain:{name:'连环',tag:'combo',desc:'连续打同一个敌人，每次伤害 +2/3/4%，最多5层；1.5秒没打中就重新计'},
 momentum:{name:'乘胜',tag:'combo',desc:'击杀后3秒内伤害 +3/4/5%，最多叠5层'},
 eagle:{name:'鹰眼',tag:'critical',desc:'暴击率 +3/5/7%（暴击率最高65%）'},
 sunder:{name:'断金',tag:'critical',desc:'暴击后，该敌人3秒内受到你的武器伤害 +6/9/12%'},
 reap:{name:'夺魄',tag:'critical',desc:'暴击精锐或首领时，伤害再 +10/15/20%'},
 windstep:{name:'踏风步',tag:'skirmish',desc:'主动移动约3个身位后，下一击伤害 +10/15/20%'},
 flank:{name:'迂回袭',tag:'skirmish',desc:'主动移动约5/4/3.5个身位后，下一击波及附近3名敌人，额外造成35/45/55%伤害'},
 swift:{name:'疾行印',tag:'skirmish',desc:'移速 +3/5/7%；移动中暴击率再 +3/5/7%'},
 ember:{name:'火种',tag:'flame',desc:'命中有15/22/30%概率点燃敌人2秒，每半秒灼烧一次（该次伤害的10%）'},
 spread:{name:'蔓延',tag:'flame',desc:'燃烧的敌人死亡时，点燃附近1/2/3名敌人；传过去的火不会再传'},
 hotwind:{name:'焚风',tag:'flame',desc:'攻击燃烧中的敌人时伤害 +10/15/20%'},
 warfeed:{name:'以战养战',tag:'bulwark',desc:'每击杀12/10/8名敌人（含部下击杀），回复生命上限2/2.5/3%'},
} as const;
export type TacticId=keyof typeof TACTICS;
export const TREASURES={
 iron_mirror:{name:'玄铁镜',tag:'bulwark',desc:'「反震」伤害再 +25%；没学反震时，受伤反击身边3名敌人（20%伤害）并减伤15%（冷却8秒）'},
 army_seal:{name:'守军印',tag:'bulwark',desc:'守望额外保护1人、减伤提高10个百分点；单独触发为附近2人提供25%减伤。与回军鼓仅取较强效果，冷却5秒'},
 general_tally:{name:'点将符',tag:'command',desc:'命中后指挥附近2名士兵集火该目标2秒；已学协击时多指挥1人、集火延长1秒，与协击共用冷却'},
 return_drum:{name:'回军鼓',tag:'command',desc:'每6秒治疗附近2名最低生命士兵5%最大生命；已学整军时沿用更强治疗。受治疗者获得2.5秒20%减伤，不叠加'},
 control_disk:{name:'镇军盘',tag:'control',desc:'命中处生成约4个身位宽的阵法，持续1.8秒：阵内最多6名普通敌人减速25%、被慢慢吸向阵心；冷却6秒，对首领无效'},
 stored_jade:{name:'沉锋玉',tag:'charge',desc:'蓄势2秒后的命中释放弱冲击，0.25秒后再冲击一次；每次15%伤害，最多3人，冷却4秒'},
 soul_bell:{name:'追魂铃',tag:'combo',desc:'武器每命中8次，追击另一名敌人，造成40%伤害'},
 slayer_tally:{name:'斩将虎符',tag:'critical',desc:'暴击精锐或首领时，追加25%伤害（每0.5秒最多一次）'},
 horse_order:{name:'走马令',tag:'skirmish',desc:'主动移动约4个身位后，下次命中对周围敌人追加25%伤害'},
 wildfire_lamp:{name:'燎原灯',tag:'flame',desc:'命中必定附加弱灼烧；燃烧的敌人死亡时点燃附近2人，传出去的火不会再传'},
 breaker_jade:{name:'破军佩',tag:'combo',desc:'武器每命中10次，震伤目标附近3名敌人，造成35%伤害'},
 revival_jade:{name:'回生玉佩',tag:'skirmish',desc:'每关首次致命伤害保留1生命，并获得1秒无敌'},
 blood_jade:{name:'饮血佩',tag:'bulwark',desc:'武器命中时回复所造成伤害5%的生命（每秒最多回复生命上限的3%）'},
} as const;
export type TreasureId=keyof typeof TREASURES;
/** 构筑存档：只存战法（2026-11-17 宝物并入信物库，开局由穿着的信物注入；旧档里的 treasures 读档时迁移成信物，见 Campaign.ts）。 */
export interface BuildSnapshot {tactics:Partial<Record<TacticId,number>>;treasures?:TreasureId[];}
export class BuildState {
 tactics:Partial<Record<TacticId,number>>={};
 /** 本局生效的宝物 = 穿着的机制类信物（CharmEffects 注入），不再从升级 / 商人获得。 */
 treasures:TreasureId[]=[];
 /** 宝物强度（信物品质：蓝 0.8 / 紫 0.9 / 橙 1.0），没写为 1。 */
 treasurePower:Partial<Record<TreasureId,number>>={};
 /** 额外计入的构筑标签（护心镜计铁壁、虎钮印计统御）。 */
 extraTags:BuildTag[]=[];
 power(id:TreasureId):number{return this.treasurePower[id]??1;}
 level(id:TacticId):number{return this.tactics[id]??0;}
 canLearn(id:TacticId):boolean{return this.level(id)<3&&(this.level(id)>0||Object.keys(this.tactics).length<6);}
 learn(id:TacticId):boolean{if(!this.canLearn(id))return false;this.tactics[id]=this.level(id)+1;return true;}
 tags():Record<BuildTag,number>{const out={combo:0,critical:0,skirmish:0,flame:0,charge:0,control:0,command:0,bulwark:0};for(const id of Object.keys(this.tactics)as TacticId[])if(TACTICS[id]&&this.level(id)>0)out[TACTICS[id].tag]++;for(const id of new Set(this.treasures))if(TREASURES[id])out[TREASURES[id].tag]++;for(const t of this.extraTags)if(t in out)out[t]++;return out;}
 snapshot():BuildSnapshot{return{tactics:{...this.tactics}};}
 restore(data?:BuildSnapshot):void{this.tactics={...data?.tactics};}
 label():string{return `战法 ${Object.keys(this.tactics).length}/6  宝物 ${this.treasures.length}/2\n`+(Object.keys(this.tactics)as TacticId[]).map(id=>TACTICS[id].name+' Lv'+this.level(id)).join(' · ')+'\n'+this.treasures.map(id=>TREASURES[id].name).join(' · ')+'\n'+Object.entries(this.tags()).map(([k,n])=>TAG_NAMES[k as BuildTag]+' '+n+'/2 /4').join('  ')+'\n'+awakeningProgress(this.tags())+'\n2来源基础加成：连击伤害+5%、暴击率+3点、游击移速+4%、烈焰对燃烧目标伤害+5%、满蓄势伤害+10%、控场减速+5点、军令友军伤害+5%、铁壁受伤-5%' ;}
}
/** Player-facing descriptions show only the level being offered. */
export function tacticDescription(id:TacticId,level:number):string{
 const n=Math.max(1,Math.min(3,level)),i=n-1;
 const descriptions:Record<TacticId,string>={
 // 卡面：先写效果、后写条件，最多两行（2026-11-17 文案审校）
 deflect:'下一次受到的伤害 -'+[25,35,45][i]+'%。\n冷却'+[8,7,6][i]+'秒，首领的攻击也能卸。',
 rebound:'受伤时反击身边'+[3,4,5][i]+'名敌人，伤害为所受伤害的'+[35,50,65][i]+'%。\n单独学习时，受伤也 -15%（冷却8秒）。',
 watch:'士兵受伤时，给周围血最少的'+[1,2,3][i]+'名士兵减伤'+[15,20,25][i]+'%，持续'+[1.5,1.8,2.1][i]+'秒。\n冷却5秒。',
 coordination:'命中后，附近'+[2,3,4][i]+'名士兵集火该敌人'+[2,2.5,3][i]+'秒。\n冷却'+[4,3.5,3][i]+'秒。',
 rally:'每'+[6,5,4][i]+'秒治疗附近血最少的'+[2,3,4][i]+'名士兵，\n各回复生命上限的'+[6,9,12][i]+'%。',
 breakout:'士兵被3名以上敌人围住时，推开最多'+[3,4,5][i]+'名敌人约'+['0.8','1','1.4'][i]+'个身位。\n冷却'+[8,7,6][i]+'秒，对首领无效。',
 snare:'命中时普通敌人减速'+[18,26,34][i]+'%，持续'+[1,1.3,1.6][i]+'秒。\n精锐效果减半，对首领无效。',
 traction:'命中时把周围'+[2,3,4][i]+'名敌人拉向命中点（0.7秒），并减速12%。\n冷却'+[4,3.5,3][i]+'秒，对首领无效。',
 confinement:'被减速的敌人死亡时，把'+[15,22,30][i]+'%减速传给附近'+[2,3,4][i]+'名敌人，持续'+[.7,1,1.3][i]+'秒。\n传过去的减速不会再传。',
 stored_edge:'2秒没打中敌人即蓄满势，下一击伤害 +'+[20,35,50][i]+'%。\n打中后重新蓄势。',
 heavy_break:'蓄满势（2秒没打中）后的下一击，震伤附近'+[2,3,4][i]+'名敌人，造成'+[20,30,40][i]+'%伤害。\n冷却3秒。',
 concentration:'站着不动1.5秒，下一击沿攻击方向贯穿'+n+'名敌人，造成'+[25,35,45][i]+'%伤害。\n移动会失去蓄势，冷却2秒。',
 pursuit:`每命中${[6,5,4][i]}次，追击旁边1名敌人，造成${[25,35,45][i]}%伤害。`,
 chain:`连续打同一个敌人，每次伤害 +${[2,3,4][i]}%（最多5层）。\n1.5秒没打中就重新计算。`,
 momentum:`击杀后3秒内伤害 +${[3,4,5][i]}%，最多叠5层。\n继续击杀会刷新时间。`,
 eagle:`暴击率 +${[3,5,7][i]}%。\n暴击伤害更高；暴击率最高65%。`,
 sunder:`暴击后，该敌人3秒内受到你的武器伤害 +${[6,9,12][i]}%。`,
 reap:`暴击精锐或首领时，伤害再 +${[10,15,20][i]}%。`,
 windstep:`主动移动约3个身位后，下一击伤害 +${[10,15,20][i]}%。\n触发后需要重新移动。`,
 flank:`主动移动约${['5','4','3.5'][i]}个身位后，下一击波及附近3名敌人，\n额外造成${[35,45,55][i]}%伤害。`,
 swift:`移速 +${[3,5,7][i]}%。\n移动中暴击率再 +${[3,5,7][i]}%。`,
 ember:`命中有${[15,22,30][i]}%概率点燃敌人2秒。\n每半秒灼烧一次，每次为该次伤害的10%。`,
 spread:`燃烧的敌人死亡时，点燃附近${n}名敌人。\n传过去的火较弱，不会再传。`,
 hotwind:`攻击燃烧中的敌人时伤害 +${[10,15,20][i]}%。\n搭配「火种」或「燎原灯」。`,
 warfeed:`每击杀${[12,10,8][i]}名敌人（含部下击杀），\n回复生命上限的${[2,2.5,3][i]}%。`,
 };return descriptions[id];
}
