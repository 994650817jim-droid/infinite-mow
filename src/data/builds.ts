import {awakeningProgress} from './awakenings';
/** Phase20A: content data only; tag thresholds deliberately reserved for Phase20C. */
export type BuildTag='combo'|'critical'|'skirmish'|'flame'|'charge'|'control'|'command'|'bulwark';
export const TAG_NAMES:Record<BuildTag,string>={combo:'连击',critical:'暴击',skirmish:'游击',flame:'烈焰',charge:'蓄势',control:'控场',command:'军令',bulwark:'铁壁'};
export const TACTICS={
 deflect:{name:'卸力',tag:'bulwark',desc:'下一次受伤减伤25/35/45%，消耗后8/7/6秒准备下一次格挡，Boss攻击也可格挡'},
 rebound:{name:'反震',tag:'bulwark',desc:'格挡后反击身边约2/2/2.5个身位内最多3/4/5名敌人，伤害为格挡前伤害35/50/65%。单独学习提供15%基础格挡，冷却8秒'},
 watch:{name:'守望',tag:'bulwark',desc:'附近士兵受伤后，为周围最低血量1/2/3人提供15/20/25%减伤，持续1.5/1.8/2.1秒，冷却5秒'},
 coordination:{name:'协击',tag:'command',desc:'命中标记附近2/3/4名士兵优先集火2/2.5/3秒；冷却4/3.5/3秒，不强迫撤退或军医参战'},
 rally:{name:'整军',tag:'command',desc:'每6/5/4秒治疗附近最低生命的2/3/4名士兵，恢复各自最大生命6/9/12%'},
 breakout:{name:'破围令',tag:'command',desc:'士兵被至少3名敌人包围时，把最多3/4/5名敌人推开约1/1/1.5个身位，冷却8/7/6秒，Boss免疫'},
 snare:{name:'绊阵',tag:'control',desc:'命中普通敌人减速18/26/34%，持续1/1.3/1.6秒；精锐效果减半，Boss免疫'},
 traction:{name:'牵机',tag:'control',desc:'把命中点附近2/3/4名敌人拉向命中点0.7秒，拉力弱/中/强，冷却4/3.5/3秒；Boss免疫'},
 confinement:{name:'困军',tag:'control',desc:'被控制的敌人死亡时，把15/22/30%减速传给附近2/3/4人，持续0.7/1/1.3秒；传出去的减速不会再传，冷却0.6秒'},
 stored_edge:{name:'沉锋',tag:'charge',desc:'未命中蓄势2秒，下一次本命命中伤害提高20/35/50%，命中后重新蓄势'},
 heavy_break:{name:'破阵重击',tag:'charge',desc:'未命中蓄势2秒，下一次命中冲击附近2/3/4名敌人，造成20/30/40%伤害，冷却3秒'},
 concentration:{name:'凝神',tag:'charge',desc:'静止蓄势1.5秒，移动以两倍速度衰减；下一击沿攻击方向贯穿1/2/3名敌人，伤害25/35/45%，冷却2秒'},
 pursuit:{name:'追袭',tag:'combo',desc:'每6/5/4次命中，追击附近另一目标，造成25/35/45%伤害'},
 chain:{name:'连环',tag:'combo',desc:'1.5秒内连续命中同一目标，每层增伤2/3/4%，最多5层'},
 momentum:{name:'乘胜',tag:'combo',desc:'击杀后3秒内每层增伤3/4/5%，最多5层'},
 eagle:{name:'鹰眼',tag:'critical',desc:'暴击率增加3/5/7个百分点，遵守65%总上限'},
 sunder:{name:'断金',tag:'critical',desc:'暴击造成3秒破绽，后续本命命中增伤6/9/12%，不叠层'},
 reap:{name:'夺魄',tag:'critical',desc:'对精锐和Boss的暴击额外增伤10/15/20%'},
 windstep:{name:'踏风步',tag:'skirmish',desc:'主动移动约3个身位后，下一次命中增伤10/15/20%'},
 flank:{name:'迂回袭',tag:'skirmish',desc:'主动移动约5/4/3.5个身位后，下一次命中产生35/45/55%范围追击'},
 swift:{name:'疾行印',tag:'skirmish',desc:'移速增加3/5/7%；主动移动时暴击率增加3/5/7个百分点'},
 ember:{name:'火种',tag:'flame',desc:'命中15/22/30%概率灼烧2秒，每0.5秒造成该次基础伤害10%'},
 spread:{name:'蔓延',tag:'flame',desc:'燃烧敌人死亡时，引燃附近1/2/3人；传染火焰不再传染'},
 hotwind:{name:'焚风',tag:'flame',desc:'本命命中燃烧目标增伤10/15/20%'},
 warfeed:{name:'以战养战',tag:'bulwark',desc:'每击杀12/10/8名敌人（含部下击杀），回复最大生命2/2.5/3%'},
} as const;
export type TacticId=keyof typeof TACTICS;
export const TREASURES={
 iron_mirror:{name:'玄铁镜',tag:'bulwark',desc:'格挡后反震额外增加25%伤害；未学反震时反击3人20%伤害，并提供15%基础格挡（冷却8秒）'},
 army_seal:{name:'守军印',tag:'bulwark',desc:'守望额外保护1人、减伤提高10个百分点；单独触发为附近2人提供25%减伤。与回军鼓仅取较强效果，冷却5秒'},
 general_tally:{name:'点将符',tag:'command',desc:'命中后指挥附近2名士兵集火该目标2秒；已学协击时多指挥1人、集火延长1秒，与协击共用冷却'},
 return_drum:{name:'回军鼓',tag:'command',desc:'每6秒治疗附近2名最低生命士兵5%最大生命；已学整军时沿用更强治疗。受治疗者获得2.5秒20%减伤，不叠加'},
 control_disk:{name:'镇军盘',tag:'control',desc:'命中处生成约4个身位宽的阵法，持续1.8秒；阵内最多6名普通敌人减速25%并被慢慢吸向阵心，冷却6秒，Boss免疫'},
 stored_jade:{name:'沉锋玉',tag:'charge',desc:'蓄势2秒后的命中释放弱冲击，0.25秒后再冲击一次；每次15%伤害，最多3人，冷却4秒'},
 soul_bell:{name:'追魂铃',tag:'combo',desc:'每8次本命命中，追击另一目标，造成40%伤害'},
 slayer_tally:{name:'斩将虎符',tag:'critical',desc:'对精锐/Boss暴击后追加25%基础伤害；每0.5秒一次'},
 horse_order:{name:'走马令',tag:'skirmish',desc:'主动移动约4个身位后，下次命中对周围敌人追加25%伤害'},
 wildfire_lamp:{name:'燎原灯',tag:'flame',desc:'命中必定附加弱灼烧；燃烧的敌人死亡时点燃附近2人，传出去的火不会再传'},
 breaker_jade:{name:'破军佩',tag:'combo',desc:'每10次本命命中，震击目标附近3人，造成35%伤害'},
 revival_jade:{name:'回生玉佩',tag:'skirmish',desc:'每关首次致命伤害保留1生命，并获得1秒无敌'},
 blood_jade:{name:'饮血佩',tag:'bulwark',desc:'本命武器命中时，回复造成伤害的5%生命；每秒最多回复最大生命的3%'},
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
 deflect:'下一次受伤减少'+[25,35,45][i]+'%伤害，随后冷却'+[8,7,6][i]+'秒。不会免疫伤害，Boss攻击也可格挡。',
 rebound:'格挡后反击身边约'+['2','2','2.5'][i]+'个身位内的'+[3,4,5][i]+'名敌人，造成格挡前伤害的'+[35,50,65][i]+'%。单独学习提供15%基础格挡。',
 watch:'附近士兵受伤后，为周围最低血量'+[1,2,3][i]+'人提供'+[15,20,25][i]+'%减伤，持续'+[1.5,1.8,2.1][i]+'秒，冷却5秒。',
 coordination:'命中后，附近'+[2,3,4][i]+'名士兵优先集火该目标'+[2,2.5,3][i]+'秒。冷却'+[4,3.5,3][i]+'秒，保留撤退与护阵限制。',
 rally:'每'+[6,5,4][i]+'秒治疗附近最低生命的'+[2,3,4][i]+'名士兵，恢复其最大生命的'+[6,9,12][i]+'%。',
 breakout:'士兵被至少3名敌人包围时，把最多'+[3,4,5][i]+'名敌人推开约'+['1','1','1.5'][i]+'个身位。冷却'+[8,7,6][i]+'秒，Boss免疫。',
 snare:'命中使普通敌人减速'+[18,26,34][i]+'%，持续'+[1,1.3,1.6][i]+'秒。精锐效果减半，Boss免疫。',
 traction:'命中时把附近'+[2,3,4][i]+'名敌人拉向命中点，持续0.7秒，拉力'+['弱','中','强'][i]+'。冷却'+[4,3.5,3][i]+'秒，Boss免疫。',
 confinement:'被控制的敌人死亡时，向附近'+[2,3,4][i]+'人传递'+[15,22,30][i]+'%减速，持续'+[.7,1,1.3][i]+'秒。传出去的减速不会再传。',
 stored_edge: '未命中蓄势2秒，下一击伤害提高'+[20,35,50][i]+'%。命中后重新蓄势。',
 heavy_break:'未命中蓄势2秒，下次命中冲击附近'+[2,3,4][i]+'人，造成'+[20,30,40][i]+'%伤害。冷却3秒。',
 concentration:'静止蓄势1.5秒，下次命中沿攻击方向贯穿'+n+'人，造成'+[25,35,45][i]+'%伤害。移动会失去蓄势，冷却2秒。',
 pursuit:`命中${[6,5,4][i]}次，自动追击旁边1名敌人。\n追击伤害：本次攻击的${[25,35,45][i]}%。`,
 chain:`持续攻击同一个敌人，每次伤害增加${[2,3,4][i]}%，最多5层。\n超过1.5秒没打中，重新叠层。`,
 momentum:`击杀敌人后，伤害提高${[3,4,5][i]}%，持续3秒。\n最多叠5层，继续击杀会刷新时间。`,
 eagle:`暴击率增加${[3,5,7][i]}个百分点。\n暴击就是打出更高伤害，总概率最高65%。`,
 sunder:`暴击后，让敌人露出破绽3秒。\n你后续的武器攻击对它多造成${[6,9,12][i]}%伤害。`,
 reap:`暴击精锐或Boss时，额外提高${[10,15,20][i]}%伤害。\n适合专门击杀强敌。`,
 windstep:`主动移动约3个身位后，下一次命中伤害提高${[10,15,20][i]}%。\n触发后需要重新移动蓄力。`,
 flank:`主动移动约${['5','4','3.5'][i]}个身位后，下一击波及附近最多3人。\n额外伤害：本次攻击的${[35,45,55][i]}%。`,
 swift:`移动速度增加${[3,5,7][i]}%。\n移动时，暴击率再增加${[3,5,7][i]}个百分点。`,
 ember:`命中有${[15,22,30][i]}%概率点燃敌人2秒。\n每半秒烧伤一次，每次为攻击伤害的10%。`,
 spread:`燃烧的敌人死亡后，再点燃附近${n}人。\n传过去的火焰较弱，且不会继续传染。`,
 hotwind:`攻击正在燃烧的敌人时，伤害增加${[10,15,20][i]}%。\n搭配「火种」或「燎原灯」使用。`,
 warfeed:`每击杀${[12,10,8][i]}名敌人（部下击杀也算），回复最大生命的${[2,2.5,3][i]}%。\n以战养战，越打越稳。`,
 };return descriptions[id];
}
