import {armyCapacity,TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import {rosterFreshUnlock} from '../systems/RosterStore';
import type {ChapterId} from '../data/chapters';
import {LUBU_CHALLENGE} from '../data/dongzhuo';
import {INTEL_INFO,intelReward,parseIntel,rollIntel,seasonIndex,type IntelEvent,type IntelReward} from './WorldIntel';
import {openChapterCount,citySiegeOpen} from './ChapterTimeline';
import {territorySummary,cityAttacker,cityById,eraChanges,eraIndexFor,type FactionId} from './WorldCities';
import {type TownState,type TownBuildingId,type CityFocus,type SeasonReport,type TownProgress,TOWN_BUILDINGS,FOCUS_CHANGE_COST,FOCUS_NAME,migrateTown,parseTown,legacyLevels,settleSeason,nextCost,buildBlockers,CITY_SIZE,CITY_TITLE,levyCost,LEVY_SOLDIERS,costText,buildingBattleEffects,levelOf,focusOpen,MERIT_TO_GRAIN,MONEY_TO_GRAIN,STABLE_HORSES,drillCap,drillCost,drillMultiplier,DRILL_MAX} from '../town/TownData';
import {TECHS,techTotals,techBlockers,type TechId} from '../data/tech';
import {TROOP_UNLOCK,troopUnlocked,barracksReinforcements} from '../data/barracks';
import {CITY_BUILDINGS,cityBuildCost,cityBuildBlockers,cityIncome,emptyCityLevels,parseCityLevels,type CityBuildingId,type CityLevels} from '../data/cityBuildings';
/**
 * 城池建设读档（v10）。v9 及更早：原「城池发展」迁移——重农 → 屯田 1 级、重军 → 募兵所 1 级（都免费），
 * 并按该城档次退还一次改方向的军粮（首次选择免费、之后改方向收费，旧档没有记录，按一次全额退，宁多勿少）；
 * 所有已占城池府衙 1 级。每城产出不低于原来（见 cityBuildings 注释）。
 */
function parseCities(s:WorldSave,v:{version?:number;cities?:unknown}):void{
 s.cities={};
 if((v.version??0)>=10&&v.cities&&typeof v.cities==='object'){for(const [id,lv] of Object.entries(v.cities as Record<string,unknown>).slice(0,64)){const c=cityById(id);if(c)s.cities[id]=parseCityLevels(lv,c.tier);}}
 else{let refund=0;for(const [id,f] of Object.entries(s.town.focus??{})){const c=cityById(id);if(!c||f==='balanced')continue;const lv=emptyCityLevels();if(f==='farm')lv.tuntian=1;else if(f==='military')lv.muster=1;s.cities[id]=parseCityLevels(lv,c.tier);refund+=FOCUS_CHANGE_COST[c.tier];}
  s.provisions=Math.min(1_000_000,s.provisions+refund);s.town.focus={};}
 for(const id of s.ownedCities){const c=cityById(id);if(c&&!s.cities[id])s.cities[id]=emptyCityLevels();}
}
/** W4 告急：某座玩家城池正被来犯；cause 为时代更替或攻城后反扑。 */
export interface CityAlert{city:string;attacker:FactionId;cause:'era'|'retaliation';}
export type BuildingId='barracks'|'farm'|'clinic';
/** 第三章起的群雄篇章：各自独立的关卡进度与失败最佳成绩。 */
export type WarlordArc='qunxiong'|'guandu'|'chibi'|'jingnan'|'hanzhong';
export interface WorldSave {version:10;
 /** v10 城池建设（city-build-proposal.md）：各占领城池的建筑等级，键为城池 id；失守的城也保留，夺回后原样恢复。 */
 cities:Record<string,CityLevels>;
 /** v9 营寨简化（city-simplify-proposal.md）：只剩军粮（provisions），merits 恒为 0（旧档军功与钱读入时折成军粮）；town 含建筑、科技、城池发展方向。buildings 供旧的战斗加成使用。 */
 town:TownState; yellowStages:number; warlordStages:number;thirdFailureBest:number; guanduStages:number; guanduFailureBest:number; chibiStages:number; chibiFailureBest:number; jingnanStages:number; jingnanFailureBest:number; hanzhongStages:number; hanzhongFailureBest:number;
 /** v7 天下地图：玩家已占城池 id；已看过的时代（W4 时局变化用）。 */
 ownedCities:string[]; eraSeen:number; capturedEver:string[]; alerts:CityAlert[]; lastLost:string[]; dongzhuoStages:number; legacyHulaoAccess:boolean; worldAvailable:boolean;
 /** 天下地图上已见过的开放章节数（新篇解锁提示用）；旧存档按当前开放数迁移，不补弹提示。 */
 chapterSeen:number;
 /** 乱世难度已首通的章节（ChapterTimeline 的章节 id）。 */
 hardCleared:string[];
 /** 天下地图军情事件（WorldIntel.ts）：讨董后每季刷新；intelSeq 为事件编号计数（0 = 从未刷过）。不改存档版本，旧档读入为空。 */
 intel:IntelEvent[]; intelSeq:number;
 /** 天下地图挑战关「虎牢关 · 三英战吕布」胜场数（首胜得赤兔）。 */
 lubuClears:number; revision:number; merits:number; provisions:number; buildings:Record<BuildingId,number>; cleared:Record<ChapterId,boolean>; failureBest:Record<ChapterId,number>; nodes:string[]; reserve:Record<string,number>; armyPlan:{capacity:number;garrison:number;priority?:TroopKind}; active:null|{id:string;chapter:ChapterId;state:'active'|'settled';arc?:WarlordArc|'siege'|'defense'|'intel'|'lubu';cityId?:string;intelId?:string;farm:number;stage?:number;deployed?:TroopKind[]}; receipts:Array<{id:string;merits:number;provisions:number}>;}
export const WORLD_KEY='im_world_v1',BACKUP_KEY='im_world_backup_v1';
const LEGACY='im_chapter1_cleared';
let memory:WorldSave|undefined;
export let storageUnavailable=false;
export let incompatibleSave=false;
const integer=(v:unknown,max=1_000_000)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
const defaults=():WorldSave=>({version:10,cities:{},town:migrateTown({barracks:1,farm:1,clinic:1}),ownedCities:[],eraSeen:0,capturedEver:[],alerts:[],lastLost:[],yellowStages:0,warlordStages:0,thirdFailureBest:0,guanduStages:0,guanduFailureBest:0,chibiStages:0,jingnanStages:0,jingnanFailureBest:0,hanzhongStages:0,hanzhongFailureBest:0,chibiFailureBest:0,dongzhuoStages:0,legacyHulaoAccess:false,worldAvailable:false,chapterSeen:1,hardCleared:[],intel:[],intelSeq:0,lubuClears:0,revision:0,merits:0,provisions:0,buildings:{barracks:1,farm:1,clinic:1},cleared:{huangjin:false,hulao:false},failureBest:{huangjin:0,hulao:0},nodes:['huangjin'],reserve:{},armyPlan:{capacity:2,garrison:0},active:null,receipts:[]});
function parse(raw:string|null):WorldSave|null {try{if(!raw)return null;const v=JSON.parse(raw);if(![1,2,3,4,5,6,7,8,9,10].includes(v.version)||!v.buildings||!v.cleared)return null;const s=defaults();s.warlordStages=integer(v.warlordStages,3);s.thirdFailureBest=integer(v.thirdFailureBest,20);
 // v6：第四章（官渡）进度；旧档默认为 0，第三章全通后开放。
 s.guanduStages=v.version>=6?integer(v.guanduStages,3):0;s.chibiStages=integer(v.chibiStages,3);s.jingnanStages=integer(v.jingnanStages,3);s.jingnanFailureBest=integer(v.jingnanFailureBest,20);s.hanzhongStages=integer(v.hanzhongStages,3);s.hanzhongFailureBest=integer(v.hanzhongFailureBest,20);s.chibiFailureBest=integer(v.chibiFailureBest,20);s.guanduFailureBest=v.version>=6?integer(v.guanduFailureBest,20):0;
 // v7：天下地图城池；旧档无城池，eraSeen=0（之后按当前时代处理）
 s.ownedCities=v.version>=7&&Array.isArray(v.ownedCities)?[...new Set(v.ownedCities.filter((c:unknown)=>typeof c==='string'&&c.length<=32))].slice(0,64) as string[]:[];s.eraSeen=v.version>=7?integer(v.eraSeen,3):0;s.capturedEver=v.version>=7&&Array.isArray(v.capturedEver)?[...new Set(v.capturedEver.filter((c:unknown)=>typeof c==='string'&&c.length<=32))].slice(0,64) as string[]:[];s.alerts=v.version>=7&&Array.isArray(v.alerts)?v.alerts.filter((a:CityAlert)=>a&&typeof a.city==='string'&&s.ownedCities.includes(a.city)&&typeof a.attacker==='string'&&a.attacker.length<=16).slice(0,16).map((a:CityAlert)=>({city:a.city,attacker:a.attacker,cause:a.cause==='era'?'era':'retaliation'})):[];s.lastLost=v.version>=7&&Array.isArray(v.lastLost)?v.lastLost.filter((c:unknown)=>typeof c==='string'&&c.length<=32).slice(0,16):[];s.yellowStages=integer(v.yellowStages,3);s.revision=integer(v.revision);s.provisions=integer(v.provisions);for(const id of ['barracks','farm','clinic'] as BuildingId[])s.buildings[id]=Math.max(1,integer(v.buildings[id],3));
 // v9：统一军粮。旧档的军功、钱（含在途商队）与已删建筑的退还一并折成军粮；v9 存档 merits 恒为 0。
 {const pt=parseTown(v.version>=8?v.town:null,s.buildings);s.town=pt.town;s.provisions=Math.min(1_000_000,s.provisions+Math.round(integer(v.merits)*MERIT_TO_GRAIN)+Math.round(pt.money*MONEY_TO_GRAIN)+pt.refund);s.merits=0;}if(!(v.town?.levels&&typeof v.town.levels==='object'&&'talent' in v.town.levels)){try{const r=JSON.parse(localStorage.getItem('im_roster_v1')??'null');s.town.levels.talent=Math.max(1,Math.min(3,integer(r?.hall,3)));}catch{s.town.levels.talent=1;}}s.buildings=legacyLevels(s.town);for(const id of ['huangjin','hulao'] as ChapterId[]){s.cleared[id]=v.cleared[id]===true;s.failureBest[id]=integer(v.failureBest?.[id],20);}if(s.cleared.huangjin||s.cleared.hulao)s.yellowStages=3;
 // v1/v2 builds opened the map directly after Zhangjiao. Keep that access for existing saves;
 // v3–v8 builds opened it only after Hulao; since the chapter timeline it opens after Zhangjiao (see below).
 s.worldAvailable=v.version<3?(s.yellowStages===3||s.cleared.huangjin||s.cleared.hulao):v.worldAvailable===true;
 if(s.cleared.hulao)s.worldAvailable=true;
 s.dongzhuoStages=v.version>=4?integer(v.dongzhuoStages,3):0;
 s.legacyHulaoAccess=v.version>=4?v.legacyHulaoAccess===true:(s.cleared.huangjin||s.cleared.hulao||s.worldAvailable||localStorage.getItem(LEGACY)==='true');
 if(s.cleared.hulao)s.dongzhuoStages=3;
 if(s.dongzhuoStages===3){s.cleared.hulao=true;s.worldAvailable=true;}
 // 天下地图改为通关第一章（黄巾之乱）即开启：已通关黄巾的旧存档同样开放，章节在地图上按时间线逐步解锁。
 if(s.cleared.huangjin||s.yellowStages>=3)s.worldAvailable=true;
s.nodes=[...new Set([...(Array.isArray(v.nodes)?v.nodes.filter((n:unknown)=>typeof n==='string').slice(0,128):[]),...(s.worldAvailable?['home','huangjin','hulao']:['huangjin'])])];for(const kind of TROOP_KINDS)s.reserve[kind]=integer(v.reserve?.[kind],999);if(v.active&&typeof v.active.id==='string'&&['huangjin','hulao'].includes(v.active.chapter)&&['active','settled'].includes(v.active.state))s.active={arc:['qunxiong','guandu','chibi','jingnan','hanzhong','siege','defense','intel','lubu'].includes(v.active.arc)?v.active.arc:undefined,cityId:typeof v.active.cityId==='string'?v.active.cityId.slice(0,32):undefined,...(typeof v.active.intelId==='string'?{intelId:v.active.intelId.slice(0,32)}:{}),stage:Math.max(1,integer(v.active.stage??3,3)),deployed:Array.isArray(v.active.deployed)?v.active.deployed.filter((k:TroopKind)=>TROOP_KINDS.includes(k)).slice(0,2):[],id:v.active.id.slice(0,100),chapter:v.active.chapter,state:v.active.state,farm:Math.max(1,integer(v.active.farm,3))};if(s.cleared.hulao&&!s.nodes.includes('qunxiong'))s.nodes.push('qunxiong');if(s.warlordStages>=3&&!s.nodes.includes('guandu'))s.nodes.push('guandu');s.armyPlan.capacity=Math.max(1,integer(v.armyPlan?.capacity??2,999));s.armyPlan.garrison=integer(v.armyPlan?.garrison,999);if(TROOP_KINDS.includes(v.armyPlan?.priority))s.armyPlan.priority=v.armyPlan.priority;s.receipts=Array.isArray(v.receipts)?v.receipts.filter((r:unknown)=>r&&typeof r==='object'&&typeof (r as {id?:unknown}).id==='string').slice(-32).map((r:{id:string;merits:unknown;provisions:unknown})=>({id:r.id.slice(0,100),merits:integer(r.merits),provisions:integer(r.provisions)})):[];s.chapterSeen=typeof v.chapterSeen==='number'?Math.max(1,integer(v.chapterSeen,5)):openChapterCount(s);s.hardCleared=Array.isArray(v.hardCleared)?([...new Set(v.hardCleared.filter((c:unknown)=>typeof c==='string'&&c.length<=16))] as string[]).slice(0,8):[];s.intel=parseIntel(v.intel);s.intelSeq=integer(v.intelSeq);parseCities(s,v);s.lubuClears=integer(v.lubuClears,9999);return s;}catch{return null;}}
export function loadWorld():WorldSave {if(storageUnavailable&&memory)return structuredClone(memory);let s:WorldSave;try{const raw=localStorage.getItem(WORLD_KEY),backup=localStorage.getItem(BACKUP_KEY);let future=false;try{future=JSON.parse(raw??'null')?.version>10;}catch{}if(future){incompatibleSave=true;storageUnavailable=true;s=memory??defaults();}else {const current=parse(raw),previous=parse(backup);s=current??previous??defaults();
 // The legacy chapter-clear flag is also written by current campaign progression.
 // Only use it to migrate saves that have no structured save at all; otherwise a
 // fresh Zhangjiao clear would incorrectly unlock the world map before Hulao.
 if(!current&&!previous&&localStorage.getItem(LEGACY)==='true'){s.cleared.huangjin=true;s.yellowStages=3;s.worldAvailable=true;s.legacyHulaoAccess=true;s.nodes=['home','huangjin','hulao'];}
 }}catch{storageUnavailable=true;s=memory??defaults();}memory=s;return structuredClone(s);}
function commit(s:WorldSave):boolean {s.revision++;if(storageUnavailable){memory=structuredClone(s);return false;}try{const old=localStorage.getItem(WORLD_KEY);if(parse(old))localStorage.setItem(BACKUP_KEY,old!);localStorage.setItem(WORLD_KEY,JSON.stringify(s));localStorage.setItem('im_slot_touched',String(Date.now()));memory=structuredClone(s);return true;}catch{storageUnavailable=true;memory=structuredClone(s);return false;}}
export function saveWorld():void{commit(loadWorld());}
export function worldChapterCleared(chapter:ChapterId):boolean{return loadWorld().cleared[chapter];}
export const BUILDINGS:Record<BuildingId,{name:string;description:(level:number)=>string}>= {
 barracks:{name:'军营',description:l=>`不限制兵力 · 开局增援 ${l-1} 人`},
 farm:{name:'农田',description:l=>`战后军粮收益 +${(l-1)*8}%`},
 clinic:{name:'医馆',description:()=>'已并入讲武堂科技「医术」'},
};
/** 旧接口（phase11 测试）：军营 / 农田升级的军粮价。 */
export function upgradeCost(level:number):{merits:number;provisions:number}|null{const c=level===1?TOWN_BUILDINGS.barracks.upgrade?.[0]:level===2?TOWN_BUILDINGS.barracks.upgrade?.[1]:undefined;return c===undefined?null:{merits:0,provisions:c};}
export function upgradeBuilding(id:BuildingId):{ok:boolean;message:string}{return id==='clinic'?{ok:false,message:'医馆已并入讲武堂科技'}:townUpgrade(id);}
// —— 义军营寨（每种建筑一座，点建筑建造 / 升级；一律花军粮）——
type TownResult={ok:boolean;message:string};
/** 主帐扩建的章节前提：第二章（讨董）通关 → 县城；第三章通关或占领一座城池 → 州府。 */
export function townProgress(s:WorldSave=loadWorld()):TownProgress{return{hulao:s.cleared.hulao,bigCity:s.warlordStages>=3||s.ownedCities.length>0};}
function townCommit(s:WorldSave,message:string):TownResult{s.buildings=legacyLevels(s.town);const persisted=commit(s);return{ok:true,message:persisted?message:message+'（仅本次会话，存储不可用）'};}
/** 建造（Lv0→1）或升级一座建筑；检查规模、章节前提与军粮。 */
export function townUpgrade(id:TownBuildingId):TownResult{const s=loadWorld(),t=s.town,def=TOWN_BUILDINGS[id];if(!def)return{ok:false,message:'未知建筑'};
 const cost=nextCost(t,id);if(cost===null)return{ok:false,message:'已达最高等级'};
 const block=buildBlockers(t,id,townProgress(s));if(block.length)return{ok:false,message:'需要 '+block.join('、')};
 if(s.provisions<cost)return{ok:false,message:'军粮不足：需要 '+cost};
 s.provisions-=cost;const lv=++t.levels[id];
 return townCommit(s,id==='hall'?`主帐扩建，营寨升为${CITY_TITLE[lv]}`:lv===1?def.name+'建成':`${def.name}升至 Lv${lv}`);}
/** 讲武堂研究科技。 */
export function researchTech(id:TechId):TownResult{const s=loadWorld(),t=s.town,def=TECHS[id];if(!def)return{ok:false,message:'未知科技'};
 const block=techBlockers(id,t.tech,levelOf(t,'academy'));if(block.length)return{ok:false,message:block[0]==='已研究'?'已研究':'需要 '+block.join('、')};
 if(s.provisions<def.cost)return{ok:false,message:'军粮不足：需要 '+def.cost};
 s.provisions-=def.cost;t.tech=[...t.tech,id];return townCommit(s,`研究完成：${def.name}`);}
/** 已研究科技的合计效果。 */
export function techEffects(){return techTotals(loadWorld().town.tech);}
/** 马厩等级（0 = 未建）与可养马数，供坐骑 / 马厩界面使用。 */
/** 招贤馆等级（1–3），招募系统读它代替 RosterSave.hall；升级走 townUpgrade('talent')（花军粮，价目即 RECRUIT.hallUpgrade）。 */
export function talentLevel():number{return Math.max(1,Math.min(3,levelOf(loadWorld().town,'talent')));}
/** 军营「练兵」：当前等级、上限（随已开放章节）、下一级价格（满了为 null）。 */
export function drillInfo(s:WorldSave=loadWorld()):{level:number;cap:number;cost:number|null;multiplier:number;next:number}{const level=s.town.drill??0,cap=drillCap(openChapterCount(s));return{level,cap,cost:level<cap?drillCost(level+1):null,multiplier:drillMultiplier(level),next:drillMultiplier(level+1)};}
/** 练兵升一级：花军粮，受章节上限限制。 */
export function trainTroops():TownResult{const s=loadWorld(),d=drillInfo(s);if(d.cost===null)return{ok:false,message:d.level>=DRILL_MAX?'练兵已满级':`练兵上限 ${d.cap} 级，开放新章节后提高`};if(s.provisions<d.cost)return{ok:false,message:'军粮不足：需要 '+d.cost};s.provisions-=d.cost;s.town.drill=d.level+1;return townCommit(s,`练兵升至 ${d.level+1} 级：部曲生命、伤害 ×${drillMultiplier(d.level+1).toFixed(2)}`);}
export function stableLevel():number{return levelOf(loadWorld().town,'stable');}
export function stableCapacity():number{return STABLE_HORSES[stableLevel()]??0;}
/** 城池建筑等级（未占领过的城为默认：府衙 1 级）。 */
export function cityLevels(cityId:string,s:WorldSave=loadWorld()):CityLevels{return s.cities[cityId]??emptyCityLevels();}
/** 城池建造 / 升级：须为我方城池；检查档次上限、府衙前提与军粮。 */
export function cityBuild(cityId:string,id:CityBuildingId):TownResult{const s=loadWorld(),c=cityById(cityId);if(!c||!s.ownedCities.includes(cityId))return{ok:false,message:'不是我方城池'};const def=CITY_BUILDINGS[id];if(!def)return{ok:false,message:'未知建筑'};
 const lv={...cityLevels(cityId,s)},block=cityBuildBlockers(id,c.tier,lv);if(block.length)return{ok:false,message:block[0]==='已达最高等级'||block[0]==='此档城池不能建'?block[0]:'需要 '+block.join('、')};
 const cost=cityBuildCost(id,c.tier,lv[id])!;if(s.provisions<cost)return{ok:false,message:'军粮不足：需要 '+cost};s.provisions-=cost;lv[id]++;s.cities[cityId]=lv;return townCommit(s,`${c.name}${def.name}${lv[id]===1&&id!=='office'?'建成':`升至 Lv${lv[id]}`}`);}
/** 粮仓「开仓募兵」：每季一次，军粮换后备刀盾 / 长枪兵。 */
export function granaryLevy():TownResult{const s=loadWorld(),t=s.town,lv=levelOf(t,'granary');if(!lv)return{ok:false,message:'需要先建粮仓'};const key=t.year+'-'+t.season;if(t.levied===key)return{ok:false,message:'本轮已开仓募兵，打完下一仗再来'};
 const cost=levyCost(lv);if(s.provisions<cost)return{ok:false,message:'军粮不足：需要 '+cost};s.provisions-=cost;const n=LEVY_SOLDIERS[lv];for(let i=0;i<n;i++){const k=i%2?'spearman':'swordsman';s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}t.levied=key;
 return townCommit(s,`开仓募兵：后备兵 +${n}（${costText(cost)}）`);}
export type {TownState,TownBuildingId,CityFocus,SeasonReport};
/** 营寨建筑、讲武堂科技 + W3 大城特产的出征开局效果。 */
export function permanentEffects(){const s=loadWorld(),b=s.buildings,be=buildingBattleEffects(s.town),tech=techTotals(s.town.tech),sp=territorySummary(s.ownedCities).specialties.map(x=>x.specialty),sum=(k:'damage'|'maxHp'|'reserveSlots'|'attributePoints'|'provisions'|'reinforcements')=>sp.reduce((n,x)=>n+(x[k]??0),0);
 return{armyCapacity:armyCapacity(b.barracks),reinforcements:barracksReinforcements(b.barracks)+sum('reinforcements'),healMultiplier:1+tech.heal,provisionsMultiplier:1+(b.farm-1)*.08,
  damageBonus:sum('damage')+be.damage+tech.damage,maxHpBonus:Math.max(-.2,sum('maxHp')+be.maxHp+tech.maxHp),reserveSlots:2+sum('reserveSlots'),attributePoints:sum('attributePoints')+be.attributePoints+tech.attributePoints,provisionsBonus:sum('provisions'),
  /** 讲武堂：开局药囊里的回血药、开局即升级的兵种。 */
  potions:tech.potions,troopLevels:tech.troopLevels,
  /** 军营练兵：全体部曲生命、伤害倍率。 */
  troopDrill:drillMultiplier(s.town.drill??0)};}
/** 军功 / 钱折成军粮（奖励表仍按旧字段给出）。 */
const grainOf=(merits:number,money=0)=>Math.round(merits*MERIT_TO_GRAIN+money*MONEY_TO_GRAIN);
/** 奖励表（军功 / 粮草 / 钱）折成的军粮总数，界面显示用。 */
export function rewardGrain(merits:number,provisions:number,money=0):number{return Math.round(provisions)+grainOf(merits,money);}
/** 记入存档：所有奖励只进军粮。返回 {merits:0, provisions:实得军粮}。 */
function bank(s:WorldSave,merits:number,provisions:number,money=0):{merits:number;provisions:number}{const g=provisions+grainOf(merits,money);s.provisions=Math.max(0,Math.min(1_000_000,s.provisions+g));s.merits=0;return{merits:0,provisions:g};}
/**
 * 结算时（胜利或坚持 60 秒以上）营寨收一次粮：农田产粮、城池按发展方向产出（军粮与后备兵）、扣后备兵口粮。
 * 寿春特产与「屯田」科技提高本场战斗军粮。返回的 provisions 已是净值；merits 已折进 provisions（恒为 0）。
 */
function applyIncome(s:WorldSave,eligible:boolean,merits:number,provisions:number):{merits:number;provisions:number;cityMerits:number;cityProvisions:number;season:SeasonReport|null}{
 const t=territorySummary(s.ownedCities),bonus=1+t.specialties.reduce((n,x)=>n+(x.specialty.provisions??0),0),tech=techTotals(s.town.tech),battle=Math.round((provisions*bonus+grainOf(merits))*(1+tech.grain));
 if(!eligible)return{merits:0,provisions:battle,cityMerits:0,cityProvisions:0,season:null};
 const cities=s.ownedCities.map(id=>cityById(id)).filter((c):c is NonNullable<typeof c>=>!!c).map(c=>({...cityIncome(c.tier,s.cities[c.id]??emptyCityLevels()),mult:raidedNow(s).includes(c.id)?.5:1}));
 const troops=Object.values(s.reserve).reduce((n,v)=>n+(v||0),0),raided=raidedNow(s).map(id=>cityById(id)?.name??id);
 const farmList=s.ownedCities.map(id=>{const c=cityById(id);if(!c)return null;const f=cityIncome(c.tier,s.cities[id]??emptyCityLevels()).farm;return f?{city:c.name,grain:Math.round(f*(raidedNow(s).includes(id)?.5:1)*bonus)}:null;}).filter((x):x is {city:string;grain:number}=>!!x);
 const r=settleSeason(s.town,{troops,cities,provisionsHave:s.provisions+battle,provisionsMultiplier:bonus});if(raided.length)r.raided=raided;if(farmList.length)r.farms=farmList;refreshIntel(s);
 for(let i=0;i<r.cityTroops;i++){const k=i%2?'spearman':'swordsman';s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}
 return{merits:0,provisions:battle+r.grain+r.cityGrain-r.upkeep,cityMerits:0,cityProvisions:r.cityGrain,season:r};}
/** 结算面板上的营寨收成一行（无结算时为空）。 */
export function cityIncomeLine(r:{cityProvisions?:number;season?:SeasonReport|null}):string{const q=r.season;if(!q)return r.cityProvisions?`\n城池产出 · 军粮 +${r.cityProvisions}`:'';
 return `\n营寨 · 农田 +${q.grain}${q.cityGrain?` · 城池 +${q.cityGrain}`:''}${q.cityTroops?` · 后备兵 +${q.cityTroops}`:''} · 口粮 −${q.upkeep}${q.shortage?`（缺 ${q.shortage}）`:''}${q.farms?.length?`\n屯田供粮：${q.farms.map(f=>`${f.city} +${f.grain}`).join('、')}`:''}${q.raided?.length?`\n流寇未平 · ${q.raided.join('、')}本次产出减半`:''}`;}
let expeditionSequence=0;
/** LAN HTTP may omit randomUUID. IDs are local receipt keys, not authentication tokens. */
export function createExpeditionId():string {
 const cryptoApi=globalThis.crypto;
 if(typeof cryptoApi?.randomUUID==='function')return cryptoApi.randomUUID();
 const words=new Uint32Array(4);
 if(typeof cryptoApi?.getRandomValues==='function')cryptoApi.getRandomValues(words);
 else for(let i=0;i<words.length;i++)words[i]=Math.floor(Math.random()*0x100000000);
 return Date.now().toString(36)+'-'+(++expeditionSequence).toString(36)+'-'+Array.from(words,n=>n.toString(16).padStart(8,'0')).join('');
}
/** 归还未结算出征中仍在的后备兵；只改 reserve 与 state，不发奖励。返回是否有改动。 */
function returnDeployed(s:WorldSave,kinds:readonly TroopKind[]):boolean{const a=s.active;if(!a||a.state!=='active')return false;const available=[...(a.deployed??[])];for(const kind of kinds){const i=available.indexOf(kind);if(i>=0){available.splice(i,1);s.reserve[kind]=Math.min(999,(s.reserve[kind]??0)+1);}}a.state='settled';return true;}
/** 新出征覆盖前：上一场若从未结算（关页面、崩溃、被系统杀后台），退还它带出的后备兵。 */
function refundStaleExpedition(s:WorldSave):void{if(s.active?.state==='active')returnDeployed(s,s.active.deployed??[]);}
/** 战斗中主动退出：归还仍存活的后备兵，本场作废、不发奖励。id 不匹配或已结算时不做任何事。 */
export function abandonExpedition(id:string,returned:TroopKind[]):void{if(!id)return;const s=loadWorld();if(s.active?.id!==id||s.receipts.some(r=>r.id===id))return;if(returnDeployed(s,returned))commit(s);}
export function beginExpedition(chapter:ChapterId,stage=3,deployed:TroopKind[]=[]):string {const s=loadWorld(),id=createExpeditionId();refundStaleExpedition(s);loseAlerted(s);s.active={id,chapter,stage,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
export function settleExpedition(id:string,result:{chapter:ChapterId;victory:boolean;bossKilled:boolean;elapsed:number;kills:number;reason:string;debug:boolean;returned?:TroopKind[]}):{merits:number;provisions:number;cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;message:string}{const s=loadWorld(),zero={merits:0,provisions:0};if(!s.active||s.active.arc||s.active.id!==id||s.active.chapter!==result.chapter||s.active.state!=='active'||s.receipts.some(r=>r.id===id))return{...zero,message:'本次奖励已结算或出征已失效'};const available=[...(s.active.deployed??[])];for(const kind of result.returned??[]){const i=available.indexOf(kind);if(i>=0){available.splice(i,1);s.reserve[kind]=Math.min(999,(s.reserve[kind]??0)+1);}}s.active.state='settled';let merits=0,provisions=0;const valid=Number.isFinite(result.elapsed)&&Number.isFinite(result.kills)&&result.elapsed>=0&&result.kills>=0&&(result.chapter!=='hulao'||((s.cleared.huangjin||s.yellowStages===3||s.legacyHulaoAccess)&&Number.isInteger(s.active.stage??3)&&(s.active.stage??3)>=1&&(s.active.stage??3)<=3&&(s.legacyHulaoAccess||(s.active.stage??3)<=s.dongzhuoStages+1)));
 if(valid&&!result.debug){const victory=result.victory&&result.bossKilled&&result.reason==='boss';const farm=1+(s.active.farm-1)*.08;if(victory){const stage=s.active.stage??3;const first=result.chapter==='huangjin'?s.yellowStages<stage:s.dongzhuoStages<stage;merits=60+Math.floor(Math.min(result.kills,1500)/100)+(first?20:0);provisions=Math.floor((90+Math.floor(Math.min(result.kills,1500)/25)+(first?30:0))*farm);if(stage===3&&!s.worldAvailable)rosterFreshUnlock();if(result.chapter==='huangjin'){s.yellowStages=Math.max(s.yellowStages,stage);if(stage===3){s.cleared.huangjin=true;s.worldAvailable=true;}}else {s.dongzhuoStages=Math.max(s.dongzhuoStages,stage);if(stage===3){s.cleared.hulao=true;s.worldAvailable=true;}}s.nodes=[...new Set([...s.nodes,...(s.worldAvailable?['home','huangjin','hulao']:['huangjin'])])];}else if(!result.victory&&result.elapsed>=60&&result.kills>=20){const score=Math.min(20,Math.floor(result.kills/20)+Math.floor(result.elapsed/120)),gain=Math.max(0,score-s.failureBest[result.chapter]);merits=gain;provisions=Math.floor(gain*2*farm);s.failureBest[result.chapter]=Math.max(score,s.failureBest[result.chapter]);}}
 const inc=applyIncome(s,valid&&!result.debug&&(result.victory||result.elapsed>=60),merits,provisions);merits=inc.merits;provisions=inc.provisions;
 ({merits,provisions}=bank(s,merits,provisions));s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,message:result.debug?'测试战斗 · 不发放永久资源':!persisted?'奖励仅保留本次会话（存储不可用）':merits||provisions?'已自动入库':'未超过本章失败最佳成绩，无新增奖励'};}

/** 天下地图：玩家已占城池（W2 攻城后写入）。 */
export function ownedCities():string[]{return loadWorld().ownedCities;}
/** 攻城出征：调用方先校验城池可攻打（相邻）；记录目标城池以便结算。 */
export function beginSiege(cityId:string,attackable:boolean,deployed:TroopKind[]=[]):string{if(!attackable||loadWorld().ownedCities.includes(cityId))return '';const s=loadWorld(),id=createExpeditionId();refundStaleExpedition(s);loseAlerted(s);s.active={id,chapter:'hulao',arc:'siege',cityId,stage:1,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
/** 攻城结算：胜利（击败守将）即占领该城并发放奖励，首次攻占额外 bonus；失败不丢东西。 */
export function settleSiege(id:string,result:{victory:boolean;bossKilled:boolean;debug:boolean;elapsed?:number;reward:{merits:number;provisions:number};firstBonus:number;returned?:TroopKind[]}):{merits:number;provisions:number;cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;captured:boolean;first:boolean;alert?:CityAlert|null;message:string}{
 const zero={merits:0,provisions:0,captured:false,first:false};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active;if(!a||a.arc!=='siege'||!a.cityId||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id))return{...zero,message:'本场已结算或无效'};
 a.state='settled';let merits=0,provisions=0,captured=false,first=false,alert:CityAlert|null=null;
 // 城池产出按出征前的领地计算（本场新占的城下次才产出）
 const inc=applyIncome(s,result.victory||(result.elapsed??0)>=60,0,0);
 if(result.victory&&result.bossKilled&&!s.ownedCities.includes(a.cityId)){first=!s.capturedEver.includes(a.cityId);const k=first?1+result.firstBonus:1;merits=Math.round(result.reward.merits*k);provisions=Math.round(result.reward.provisions*k*(1+(a.farm-1)*.08));s.ownedCities=[...s.ownedCities,a.cityId];if(first)s.capturedEver=[...s.capturedEver,a.cityId];captured=true;alert=retaliate(s,a.cityId);}
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 {const bonus=1+territorySummary(s.ownedCities.filter(c=>c!==a.cityId||!captured)).specialties.reduce((n,x)=>n+(x.specialty.provisions??0),0);provisions=Math.round(provisions*bonus);}
 merits+=inc.merits;provisions+=inc.provisions; // 季度净收益：城池产出 + 农田产粮 − 军粮（攻城本身奖励不受寿春加成以外的影响）
 ({merits,provisions}=bank(s,merits,provisions));s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
 return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,captured,first,alert,message:persisted?(captured?'城池已归入版图':'未能破城'):'已保留本次会话，存储不可用'};
}
/* —— W4：时局变化与反攻 —— */
/** 随机源（测试可替换）。 */
// 存在全局上：开发热更新后测试动态导入的模块副本与游戏内副本可能不同，全局键保证二者共用
const RANDOM_KEY='__imWorldRandom',random=():number=>((globalThis as Record<string,unknown>)[RANDOM_KEY] as (()=>number)|undefined)?.()??Math.random();
export function setWorldRandom(f?:()=>number):void{(globalThis as Record<string,unknown>)[RANDOM_KEY]=f;}
const eraOf=(s:WorldSave)=>eraIndexFor({hulaoCleared:s.cleared.hulao,warlordStages:s.warlordStages,guanduStages:s.guanduStages});
export function currentEra():1|2|3{return eraOf(loadWorld());}
/** 攻城后反扑概率（按被占城池档位）。 */
export const RETALIATION_CHANCE={small:.25,medium:.4,large:.6} as const;
function retaliate(s:WorldSave,cityId:string):CityAlert|null{const c=cityById(cityId);if(!c||s.alerts.some(a=>a.city===cityId))return null;const attacker=cityAttacker(cityId,eraOf(s),s.ownedCities);if(!attacker||random()>=RETALIATION_CHANCE[c.tier])return null;const alert:CityAlert={city:cityId,attacker,cause:'retaliation'};s.alerts=[...s.alerts,alert];return alert;}
/** 有告急城池时出征别处（章节 / 群雄篇 / 攻城）：告急城池失守。守城战不触发。 */
function loseAlerted(s:WorldSave):void{if(!s.alerts.length)return;const lost=s.alerts.map(a=>a.city).filter(c=>s.ownedCities.includes(c));s.ownedCities=s.ownedCities.filter(c=>!lost.includes(c));s.alerts=[];s.lastLost=lost;}
export function cityAlerts():CityAlert[]{return loadWorld().alerts;}
/** 地图读取一次“上次失守”提示后清空。 */
export function takeLostNotice():string[]{const s=loadWorld();if(!s.lastLost.length)return[];const lost=s.lastLost;s.lastLost=[];commit(s);return lost;}
export interface EraAdvance{from:1|2|3;to:1|2|3;changes:Array<{city:string;from:FactionId;to:FactionId}>;fallen:FactionId[];alerts:CityAlert[];}
/**
 * 打开地图时调用：时代前进则生成时局变化信息与告急（1–3 座与大势力接壤的边城）。
 * 旧档首次（eraSeen=0）静默记为当前时代。无变化返回 null。
 */
export function advanceEra():EraAdvance|null{const s=loadWorld(),to=eraOf(s);if(s.eraSeen===0){s.eraSeen=to;commit(s);return null;}if(to<=s.eraSeen)return null;
 const from=Math.max(1,Math.min(3,s.eraSeen)) as 1|2|3,{changes,fallen}=eraChanges(from,to,s.ownedCities);
 const border=s.ownedCities.filter(c=>!s.alerts.some(a=>a.city===c)).map(c=>({city:c,attacker:cityAttacker(c,to,s.ownedCities)})).filter((x):x is {city:string;attacker:FactionId}=>!!x.attacker);
 for(let i=border.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[border[i],border[j]]=[border[j],border[i]];}
 const alerts=border.slice(0,Math.min(border.length,1+Math.floor(random()*3))).map(x=>({...x,cause:'era' as const}));
 s.alerts=[...s.alerts,...alerts];s.eraSeen=to;commit(s);return{from,to,changes,fallen,alerts};}
/** 守城出征：须为告急中的我方城池；不触发失守。 */
export function beginDefense(cityId:string,deployed:TroopKind[]=[]):string{const s=loadWorld();if(!s.ownedCities.includes(cityId)||!s.alerts.some(a=>a.city===cityId))return '';const id=createExpeditionId();refundStaleExpedition(s);s.active={id,chapter:'hulao',arc:'defense',cityId,stage:1,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
/** 守城结算：胜利解除告急并发放攻城奖励的一半；失败城池仍在、告急不变。 */
export function settleDefense(id:string,result:{victory:boolean;bossKilled:boolean;debug:boolean;elapsed?:number;reward:{merits:number;provisions:number};returned?:TroopKind[]}):{merits:number;provisions:number;cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;held:boolean;message:string}{
 const zero={merits:0,provisions:0,held:false};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active;if(!a||a.arc!=='defense'||!a.cityId||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id))return{...zero,message:'本场已结算或无效'};
 a.state='settled';let merits=0,provisions=0,held=false;
 if(result.victory&&result.bossKilled&&s.alerts.some(x=>x.city===a.cityId)){s.alerts=s.alerts.filter(x=>x.city!==a.cityId);held=true;merits=Math.round(result.reward.merits/2);provisions=Math.round(result.reward.provisions/2*(1+(a.farm-1)*.08));}
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 const inc=applyIncome(s,result.victory||(result.elapsed??0)>=60,merits,provisions);merits=inc.merits;provisions=inc.provisions;
 ({merits,provisions}=bank(s,merits,provisions));s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
 return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,held,message:persisted?(held?'城池守住了':'守城失利，城池仍告急'):'已保留本次会话，存储不可用'};
}
/** Fresh campaigns open the world after Lubu; migrated saves keep prior access. */
export function worldUnlocked():boolean{return loadWorld().worldAvailable;}
/** 天下地图：返回自上次查看以来新开放的章节数，并记为已见。 */
export function takeNewChapters():number{const s=loadWorld(),open=openChapterCount(s),fresh=Math.max(0,open-s.chapterSeen);if(open!==s.chapterSeen){s.chapterSeen=open;commit(s);}return fresh;}
/** 乱世难度：该章是否已首通。 */
export function hardChapterCleared(id:string):boolean{return loadWorld().hardCleared.includes(id);}
/** 乱世难度首通：记入存档并发一次性军功 / 粮草；已首通返回 false。 */
export function recordHardClear(id:string,reward:{merits:number;provisions:number}):boolean{const s=loadWorld();if(s.hardCleared.includes(id))return false;s.hardCleared.push(id);bank(s,reward.merits,reward.provisions);commit(s);return true;}
/** 招募价（军粮）：兵种基础价，讲武堂「募兵有方」打折。 */
export function recruitCost(kind:TroopKind,s:WorldSave=loadWorld()):number{return Math.max(1,Math.round(TROOPS[kind].cost*(1-techTotals(s.town.tech).recruitDiscount)));}
/** 军营等级（1–6）与已解锁兵种：营寨招募、战斗支援招兵都只用已解锁的。 */
export function barracksLevel(s:WorldSave=loadWorld()):number{return Math.max(1,levelOf(s.town,'barracks'));}
export function unlockedTroopKinds(s:WorldSave=loadWorld()):TroopKind[]{const lv=barracksLevel(s);return TROOP_KINDS.filter(k=>troopUnlocked(k,lv));}
export function troopUnlockLevel(kind:TroopKind):number{return TROOP_UNLOCK[kind]??1;}
export function recruitReserve(kind:TroopKind):{ok:boolean;message:string}{const s=loadWorld();if(TROOPS[kind]&&!troopUnlocked(kind,barracksLevel(s)))return{ok:false,message:`军营 Lv.${TROOP_UNLOCK[kind]} 解锁`};if(s.yellowStages<3)return{ok:false,message:'击败张角后开放营寨招募'};if(!TROOPS[kind])return{ok:false,message:'无效兵种'};const cost=recruitCost(kind,s);if(s.provisions<cost)return{ok:false,message:"军粮不足：需要 "+cost};if((s.reserve[kind]??0)>=999)return{ok:false,message:'该兵种后备已满'};s.provisions-=cost;s.reserve[kind]=(s.reserve[kind]??0)+1;s.armyPlan.priority=kind;commit(s);return{ok:true,message:'已编入后备；下次出征最多带2名后备兵'};}
export function takeExpeditionReserve(slots=2):TroopKind[]{const s=loadWorld(),out:TroopKind[]=[];if(!Number.isSafeInteger(slots)||slots<=0)return out;if(s.yellowStages<3||!s.active||s.active.state!=='active'||s.active.deployed?.length)return out;for(const kind of [...new Set([...(s.armyPlan.priority?[s.armyPlan.priority]:[]),...TROOP_KINDS])])while((s.reserve[kind]??0)>0&&out.length<Math.min(5,slots)){s.reserve[kind]--;out.push(kind);}if(out.length){if(s.active)s.active.deployed=[...out];commit(s);}return out;}

export function yellowStageUnlocked(stage:number):boolean{return Number.isInteger(stage)&&stage>=1&&stage<=3&&stage<=loadWorld().yellowStages+1;}

/** hulao remains the economy/save chapter ID; westStage selects its three battles. */
export function dongzhuoStageUnlocked(stage:number):boolean{const s=loadWorld();return Number.isInteger(stage)&&stage>=1&&stage<=3&&(s.cleared.huangjin||s.yellowStages===3||s.legacyHulaoAccess)&&(s.legacyHulaoAccess||stage<=s.dongzhuoStages+1);}
export function nextDongzhuoStage():1|2|3{return Math.min(3,loadWorld().dongzhuoStages+1) as 1|2|3;}

/** 群雄篇章（第三章 qunxiong、第四章 guandu）用显式 arc 键结算，不会结算旧的虎牢出征。 */
const ARC_FIELDS:Record<WarlordArc,{stages:'warlordStages'|'guanduStages'|'chibiStages'|'jingnanStages'|'hanzhongStages';best:'thirdFailureBest'|'guanduFailureBest'|'chibiFailureBest'|'jingnanFailureBest'|'hanzhongFailureBest'}>={qunxiong:{stages:'warlordStages',best:'thirdFailureBest'},guandu:{stages:'guanduStages',best:'guanduFailureBest'},chibi:{stages:'chibiStages',best:'chibiFailureBest'},jingnan:{stages:'jingnanStages',best:'jingnanFailureBest'},hanzhong:{stages:'hanzhongStages',best:'hanzhongFailureBest'}};
export function arcStages(arc:WarlordArc):number{return loadWorld()[ARC_FIELDS[arc].stages];}
/** 第八章接在第七章「入蜀」（arc 'shu'，走路动画会话）之后：存档里有 shuStages 就要求它 ≥3；入蜀还没合进来时退回要求第六章荆南三关。 */
function hanzhongPrereq(s:WorldSave):boolean{const shu=(s as unknown as {shuStages?:number}).shuStages;return shu===undefined?s.jingnanStages>=3:shu>=3;}
export function arcUnlocked(arc:WarlordArc):boolean{const s=loadWorld();return arc==='qunxiong'?s.cleared.hulao:arc==='guandu'?s.cleared.hulao&&s.warlordStages>=3:arc==='jingnan'?s.cleared.hulao&&s.chibiStages>=3:arc==='hanzhong'?s.cleared.hulao&&hanzhongPrereq(s):s.cleared.hulao&&s.guanduStages>=3;}
export function arcStageUnlocked(arc:WarlordArc,stage:number):boolean{return Number.isInteger(stage)&&stage>=1&&stage<=3&&arcUnlocked(arc)&&stage<=arcStages(arc)+1;}
export function beginArcExpedition(arc:WarlordArc,stage:number,deployed:TroopKind[]=[]):string{if(!arcStageUnlocked(arc,stage))return '';const s=loadWorld(),id=createExpeditionId();refundStaleExpedition(s);loseAlerted(s);s.active={id,chapter:'hulao',arc,stage,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
export function settleArcExpedition(arc:WarlordArc,id:string,result:{victory:boolean;bossKilled:boolean;kills:number;elapsed:number;debug:boolean;returned?:TroopKind[]}):{merits:number;provisions:number;cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;message:string}{
 const zero={merits:0,provisions:0};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active,F=ARC_FIELDS[arc];if(!a||a.arc!==arc||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id)||!Number.isFinite(result.kills)||!Number.isFinite(result.elapsed)||result.kills<0||result.elapsed<0)return{...zero,message:'本场已结算或无效'};
 const stage=a.stage??1;if(!arcStageUnlocked(arc,stage))return{...zero,message:'关卡尚未开放'};a.state='settled';let merits=0,provisions=0;
 if(result.victory&&result.bossKilled){const first=s[F.stages]<stage;merits=60+Math.floor(Math.min(result.kills,1500)/100)+(first?20:0);provisions=Math.floor((90+Math.floor(Math.min(result.kills,1500)/25)+(first?30:0))*(1+(a.farm-1)*.08));s[F.stages]=Math.max(s[F.stages],stage);if(arc==='qunxiong'&&s.warlordStages>=3&&!s.nodes.includes('guandu'))s.nodes.push('guandu');if(arc==='guandu'&&s.guanduStages>=3&&!s.nodes.includes('chibi'))s.nodes.push('chibi');}else if(!result.victory&&result.elapsed>=60&&result.kills>=20){const score=Math.min(20,Math.floor(result.kills/20)+Math.floor(result.elapsed/120));merits=Math.max(0,score-s[F.best]);provisions=merits*2;s[F.best]=Math.max(s[F.best],score);}
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 const inc=applyIncome(s,result.victory||result.elapsed>=60,merits,provisions);merits=inc.merits;provisions=inc.provisions;
 ({merits,provisions}=bank(s,merits,provisions));s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,message:persisted?'战后奖励已入库':'已保留本次会话，存储不可用'};
}
/** 第三章旧接口（保持不变的调用点与测试）。 */
export function thirdChapterUnlocked():boolean{return arcUnlocked('qunxiong');}
export function thirdStageUnlocked(stage:number):boolean{return arcStageUnlocked('qunxiong',stage);}
export function beginThirdExpedition(stage:number,deployed:TroopKind[]=[]):string{return beginArcExpedition('qunxiong',stage,deployed);}
export function settleThirdExpedition(id:string,result:{victory:boolean;bossKilled:boolean;kills:number;elapsed:number;debug:boolean;returned?:TroopKind[]}):ReturnType<typeof settleArcExpedition>{return settleArcExpedition('qunxiong',id,result);}
/** W4：有告急城池时，出征别处前的警示语（无告急为空串）。 */
export function alertLossWarning():string{const names=loadWorld().alerts.map(a=>cityById(a.city)?.name).filter(Boolean);return names.length?`⚠ ${names.join('、')}告急：此时出征别处，${names.length>1?'这些城池':'该城'}将失守`:'';}
/** 道具分解所得（旧称“钱”）折成军粮记入营寨（ItemStore 调用）。 */
/** 招贤馆等花费：一律扣军粮。旧参数 merits / money 按折算系数并入军粮（招贤馆已只传 provisions）；不够返回 false 且不扣。 */
/** 直接加军粮（第六章劝降：降城府库）。 */
export function gainProvisions(n:number):void{if(!(n>0))return;const s=loadWorld();s.provisions+=Math.floor(n);commit(s);}
export function spendWorld(c:{provisions?:number;merits?:number;money?:number}):boolean{const need=Math.max(0,Math.floor(c.provisions??0))+grainOf(Math.max(0,Math.floor(c.merits??0)),Math.max(0,Math.floor(c.money??0)));const s=loadWorld();if(s.provisions<need)return false;s.provisions-=need;commit(s);return true;}
/** 直接发军粮（如武将经验满级折军粮）。返回发放数。 */
export function addProvisions(amount:number):number{const n=Math.floor(amount);if(!(n>0))return 0;const s=loadWorld();bank(s,0,n);commit(s);return n;}
export function addTownMoney(amount:number):void{const n=Math.floor(amount);if(!(n>0))return;const s=loadWorld();bank(s,0,0,n);commit(s);}

/* —— 天下地图 · 军情事件（WorldIntel.ts）—— */
/** 仍有效的军情：未过期；悬赏所在城未被我方占领；流寇所在城仍属我方。 */
function liveIntel(s:WorldSave):IntelEvent[]{const now=seasonIndex(s.town);return s.intel.filter(e=>e.expires>=now&&(e.kind==='bounty'?!s.ownedCities.includes(e.city):e.kind==='bandit'?s.ownedCities.includes(e.city):true));}
/** 本季流寇未平的我方城池（季度结算时产出减半）。 */
function raidedNow(s:WorldSave):string[]{return liveIntel(s).filter(e=>e.kind==='bandit').map(e=>e.city);}
function spawnIntel(s:WorldSave,first=false):IntelEvent[]{if(!s.cleared.hulao)return[];const fresh=rollIntel({era:eraOf(s),owned:s.ownedCities,alerts:s.alerts.map(a=>a.city),existing:s.intel,season:seasonIndex(s.town),seq:s.intelSeq,random,noBandit:first,bountyOpen:id=>citySiegeOpen(id,s)});s.intel=[...s.intel,...fresh];s.intelSeq+=Math.max(1,fresh.length);return fresh;}
/** 季度推进后：清掉过期 / 失效的军情，再刷新一批。 */
function refreshIntel(s:WorldSave):void{s.intel=liveIntel(s);spawnIntel(s);}
/** 打开天下地图时调用：讨董后首次进入（从未刷过军情）先刷一批，免得要等下一季；这一批不刷流寇（本季来不及应对就减产不公平）。返回是否有新军情。 */
export function ensureIntel():boolean{const s=loadWorld();if(!s.cleared.hulao||s.intelSeq>0)return false;const fresh=spawnIntel(s,true);commit(s);return fresh.length>0;}
export function intelEvents():IntelEvent[]{return liveIntel(loadWorld());}
/** 军情出征：事件须仍有效。与攻城一样算“出征别处”（告急城池失守）。 */
export function beginIntel(eventId:string,deployed:TroopKind[]=[]):string{const s=loadWorld(),e=liveIntel(s).find(x=>x.id===eventId);if(!e)return '';const id=createExpeditionId();refundStaleExpedition(s);loseAlerted(s);s.active={id,chapter:'hulao',arc:'intel',cityId:e.city,intelId:e.id,stage:1,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
/**
 * 军情结算：success（击败敌将 / 寇首，或商车抵达）发放奖励并移除事件；商车被毁（lost）事件也移除（商队被劫）；
 * 其余失败事件保留到过期。胜利或坚持 60 秒以上照常过一季（流寇事件若已平定则不减产）。
 * 悬赏兵装由战斗场景按返回的 item 生成入行囊（避免 WorldStore 与 ItemStore 互相引用）。
 */
export function settleIntel(id:string,result:{success:boolean;lost?:boolean;victory:boolean;debug:boolean;elapsed:number;returned?:TroopKind[]}):{merits:number;provisions:number;money:number;item?:IntelReward['item'];cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;resolved:boolean;event?:IntelEvent;message:string}{
 const zero={merits:0,provisions:0,money:0,resolved:false};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active;if(!a||a.arc!=='intel'||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id))return{...zero,message:'本场已结算或无效'};
 a.state='settled';const e=s.intel.find(x=>x.id===a.intelId);let merits=0,provisions=0,money=0,item:IntelReward['item'],resolved=false;
 if(e&&result.success){const r=intelReward(e);merits=r.merits;provisions=Math.round(r.provisions*(1+(a.farm-1)*.08));money=r.money;item=r.item;resolved=true;s.intel=s.intel.filter(x=>x.id!==e.id);}
 else if(e&&e.kind==='escort'&&result.lost)s.intel=s.intel.filter(x=>x.id!==e.id);
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 const inc=applyIncome(s,result.victory||result.elapsed>=60,merits,provisions);merits=inc.merits;provisions=inc.provisions;
 ({merits,provisions}=bank(s,merits,provisions,money));money=0;s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
 const name=e?INTEL_INFO[e.kind].name:'军情';
 return{merits,provisions,money,item,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,resolved,event:e,message:!persisted?'已保留本次会话，存储不可用':resolved?name+'告成':e?.kind==='escort'&&result.lost?'商队被劫，此事作罢':name+'未成，可在期限内再战'};
}

/* —— 天下地图挑战关「虎牢关 · 三英战吕布」（data/dongzhuo.ts LUBU_CHALLENGE）—— */
/** 讨董第二关（荥阳）告捷后开放；旧存档已通关讨董的同样开放。 */
export function lubuChallengeOpen():boolean{const s=loadWorld();return s.cleared.hulao||s.dongzhuoStages>=LUBU_CHALLENGE.unlockAfter||s.legacyHulaoAccess;}
export function lubuClears():number{return loadWorld().lubuClears;}
export function beginLubuChallenge(deployed:TroopKind[]=[]):string{if(!lubuChallengeOpen())return '';const s=loadWorld(),id=createExpeditionId();refundStaleExpedition(s);loseAlerted(s);s.active={id,chapter:'hulao',arc:'lubu',stage:3,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
/** 挑战结算：击败吕布发奖（首胜多发并返回 first，由战斗场景发赤兔）；胜利或坚持 60 秒照常过季。 */
export function settleLubuChallenge(id:string,result:{victory:boolean;bossKilled:boolean;debug:boolean;elapsed:number;returned?:TroopKind[]}):{merits:number;provisions:number;first:boolean;cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;message:string}{
 const zero={merits:0,provisions:0,first:false};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active;if(!a||a.arc!=='lubu'||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id))return{...zero,message:'本场已结算或无效'};
 a.state='settled';let merits=0,provisions=0,first=false;
 if(result.victory&&result.bossKilled){first=s.lubuClears===0;const r=first?LUBU_CHALLENGE.reward:LUBU_CHALLENGE.repeatReward;merits=r.merits;provisions=Math.round(r.provisions*(1+(a.farm-1)*.08));s.lubuClears=Math.min(9999,s.lubuClears+1);}
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 const inc=applyIncome(s,result.victory||result.elapsed>=60,merits,provisions);merits=inc.merits;provisions=inc.provisions;
 ({merits,provisions}=bank(s,merits,provisions));s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
 return{merits,provisions,first,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,message:!persisted?'已保留本次会话，存储不可用':first?'首次击败吕布':result.victory?'再胜吕布':'挑战未成，可再战'};
}
