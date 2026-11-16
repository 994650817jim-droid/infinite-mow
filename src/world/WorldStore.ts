import {armyCapacity,TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import type {ChapterId} from '../data/chapters';
import {INTEL_INFO,intelReward,parseIntel,rollIntel,seasonIndex,type IntelEvent,type IntelReward} from './WorldIntel';
import {openChapterCount} from './ChapterTimeline';
import {territorySummary,cityAttacker,cityById,eraChanges,eraIndexFor,type FactionId} from './WorldCities';
import {type TownState,type TownBuildingId,type TaxRate,type CityFocus,type SeasonReport,TOWN_BUILDINGS,FOCUS_CHANGE_COST,FOCUS_NAME,TAX_NAME,migrateTown,parseTown,legacyLevels,settleSeason,nextCost,buildBlockers,CITY_SIZE,levyCost,LEVY_SOLDIERS,canAfford,costText,seasonLabel,buildingBattleEffects,noBoon,eventById,grainSellPrice,grainBuyPrice,caravanValue,caravanSlots,levelOf} from '../town/TownData';
/** W4 告急：某座玩家城池正被来犯；cause 为时代更替或攻城后反扑。 */
export interface CityAlert{city:string;attacker:FactionId;cause:'era'|'retaliation';}
export type BuildingId='barracks'|'farm'|'clinic';
/** 第三章起的群雄篇章：各自独立的关卡进度与失败最佳成绩。 */
export type WarlordArc='qunxiong'|'guandu'|'chibi';
export interface WorldSave {version:8;
 /** v8 城镇建设与运营（TOWN_PLAN.md）：钱、地块、季度、税率、城池发展方向。buildings 由地块推导，供旧的战斗加成使用。 */
 town:TownState; yellowStages:number; warlordStages:number;thirdFailureBest:number; guanduStages:number; guanduFailureBest:number; chibiStages:number; chibiFailureBest:number;
 /** v7 天下地图：玩家已占城池 id；已看过的时代（W4 时局变化用）。 */
 ownedCities:string[]; eraSeen:number; capturedEver:string[]; alerts:CityAlert[]; lastLost:string[]; dongzhuoStages:number; legacyHulaoAccess:boolean; worldAvailable:boolean;
 /** 天下地图上已见过的开放章节数（新篇解锁提示用）；旧存档按当前开放数迁移，不补弹提示。 */
 chapterSeen:number;
 /** 乱世难度已首通的章节（ChapterTimeline 的章节 id）。 */
 hardCleared:string[];
 /** 天下地图军情事件（WorldIntel.ts）：讨董后每季刷新；intelSeq 为事件编号计数（0 = 从未刷过）。不改存档版本，旧档读入为空。 */
 intel:IntelEvent[]; intelSeq:number; revision:number; merits:number; provisions:number; buildings:Record<BuildingId,number>; cleared:Record<ChapterId,boolean>; failureBest:Record<ChapterId,number>; nodes:string[]; reserve:Record<string,number>; armyPlan:{capacity:number;garrison:number;priority?:TroopKind}; active:null|{id:string;chapter:ChapterId;state:'active'|'settled';arc?:WarlordArc|'siege'|'defense'|'intel';cityId?:string;intelId?:string;farm:number;stage?:number;deployed?:TroopKind[]}; receipts:Array<{id:string;merits:number;provisions:number}>;}
export const WORLD_KEY='im_world_v1',BACKUP_KEY='im_world_backup_v1';
const LEGACY='im_chapter1_cleared';
let memory:WorldSave|undefined;
export let storageUnavailable=false;
export let incompatibleSave=false;
const integer=(v:unknown,max=1_000_000)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
const defaults=():WorldSave=>({version:8,town:migrateTown({barracks:1,farm:1,clinic:1}),ownedCities:[],eraSeen:0,capturedEver:[],alerts:[],lastLost:[],yellowStages:0,warlordStages:0,thirdFailureBest:0,guanduStages:0,guanduFailureBest:0,chibiStages:0,chibiFailureBest:0,dongzhuoStages:0,legacyHulaoAccess:false,worldAvailable:false,chapterSeen:1,hardCleared:[],intel:[],intelSeq:0,revision:0,merits:0,provisions:0,buildings:{barracks:1,farm:1,clinic:1},cleared:{huangjin:false,hulao:false},failureBest:{huangjin:0,hulao:0},nodes:['huangjin'],reserve:{},armyPlan:{capacity:2,garrison:0},active:null,receipts:[]});
function parse(raw:string|null):WorldSave|null {try{if(!raw)return null;const v=JSON.parse(raw);if(![1,2,3,4,5,6,7,8].includes(v.version)||!v.buildings||!v.cleared)return null;const s=defaults();s.warlordStages=integer(v.warlordStages,3);s.thirdFailureBest=integer(v.thirdFailureBest,20);
 // v6：第四章（官渡）进度；旧档默认为 0，第三章全通后开放。
 s.guanduStages=v.version>=6?integer(v.guanduStages,3):0;s.chibiStages=integer(v.chibiStages,3);s.chibiFailureBest=integer(v.chibiFailureBest,20);s.guanduFailureBest=v.version>=6?integer(v.guanduFailureBest,20):0;
 // v7：天下地图城池；旧档无城池，eraSeen=0（之后按当前时代处理）
 s.ownedCities=v.version>=7&&Array.isArray(v.ownedCities)?[...new Set(v.ownedCities.filter((c:unknown)=>typeof c==='string'&&c.length<=32))].slice(0,64) as string[]:[];s.eraSeen=v.version>=7?integer(v.eraSeen,3):0;s.capturedEver=v.version>=7&&Array.isArray(v.capturedEver)?[...new Set(v.capturedEver.filter((c:unknown)=>typeof c==='string'&&c.length<=32))].slice(0,64) as string[]:[];s.alerts=v.version>=7&&Array.isArray(v.alerts)?v.alerts.filter((a:CityAlert)=>a&&typeof a.city==='string'&&s.ownedCities.includes(a.city)&&typeof a.attacker==='string'&&a.attacker.length<=16).slice(0,16).map((a:CityAlert)=>({city:a.city,attacker:a.attacker,cause:a.cause==='era'?'era':'retaliation'})):[];s.lastLost=v.version>=7&&Array.isArray(v.lastLost)?v.lastLost.filter((c:unknown)=>typeof c==='string'&&c.length<=32).slice(0,16):[];s.yellowStages=integer(v.yellowStages,3);s.revision=integer(v.revision);s.merits=integer(v.merits);s.provisions=integer(v.provisions);for(const id of ['barracks','farm','clinic'] as BuildingId[])s.buildings[id]=Math.max(1,integer(v.buildings[id],3));s.town=parseTown(v.version>=8?v.town:null,s.buildings);s.buildings=legacyLevels(s.town);for(const id of ['huangjin','hulao'] as ChapterId[]){s.cleared[id]=v.cleared[id]===true;s.failureBest[id]=integer(v.failureBest?.[id],20);}if(s.cleared.huangjin||s.cleared.hulao)s.yellowStages=3;
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
s.nodes=[...new Set([...(Array.isArray(v.nodes)?v.nodes.filter((n:unknown)=>typeof n==='string').slice(0,128):[]),...(s.worldAvailable?['home','huangjin','hulao']:['huangjin'])])];for(const kind of TROOP_KINDS)s.reserve[kind]=integer(v.reserve?.[kind],999);if(v.active&&typeof v.active.id==='string'&&['huangjin','hulao'].includes(v.active.chapter)&&['active','settled'].includes(v.active.state))s.active={arc:['qunxiong','guandu','chibi','siege','defense','intel'].includes(v.active.arc)?v.active.arc:undefined,cityId:typeof v.active.cityId==='string'?v.active.cityId.slice(0,32):undefined,...(typeof v.active.intelId==='string'?{intelId:v.active.intelId.slice(0,32)}:{}),stage:Math.max(1,integer(v.active.stage??3,3)),deployed:Array.isArray(v.active.deployed)?v.active.deployed.filter((k:TroopKind)=>TROOP_KINDS.includes(k)).slice(0,2):[],id:v.active.id.slice(0,100),chapter:v.active.chapter,state:v.active.state,farm:Math.max(1,integer(v.active.farm,3))};if(s.cleared.hulao&&!s.nodes.includes('qunxiong'))s.nodes.push('qunxiong');if(s.warlordStages>=3&&!s.nodes.includes('guandu'))s.nodes.push('guandu');s.armyPlan.capacity=Math.max(1,integer(v.armyPlan?.capacity??2,999));s.armyPlan.garrison=integer(v.armyPlan?.garrison,999);if(TROOP_KINDS.includes(v.armyPlan?.priority))s.armyPlan.priority=v.armyPlan.priority;s.receipts=Array.isArray(v.receipts)?v.receipts.filter((r:unknown)=>r&&typeof r==='object'&&typeof (r as {id?:unknown}).id==='string').slice(-32).map((r:{id:string;merits:unknown;provisions:unknown})=>({id:r.id.slice(0,100),merits:integer(r.merits),provisions:integer(r.provisions)})):[];s.chapterSeen=typeof v.chapterSeen==='number'?Math.max(1,integer(v.chapterSeen,5)):openChapterCount(s);s.hardCleared=Array.isArray(v.hardCleared)?([...new Set(v.hardCleared.filter((c:unknown)=>typeof c==='string'&&c.length<=16))] as string[]).slice(0,8):[];s.intel=parseIntel(v.intel);s.intelSeq=integer(v.intelSeq);return s;}catch{return null;}}
export function loadWorld():WorldSave {if(storageUnavailable&&memory)return structuredClone(memory);let s:WorldSave;try{const raw=localStorage.getItem(WORLD_KEY),backup=localStorage.getItem(BACKUP_KEY);let future=false;try{future=JSON.parse(raw??'null')?.version>8;}catch{}if(future){incompatibleSave=true;storageUnavailable=true;s=memory??defaults();}else {const current=parse(raw),previous=parse(backup);s=current??previous??defaults();
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
 farm:{name:'农田',description:l=>`战后粮草收益 +${(l-1)*8}%`},
 clinic:{name:'医馆',description:l=>`军医治疗量 +${(l-1)*6}%`},
};
export function upgradeCost(level:number):{merits:number;provisions:number}|null{return level===1?{merits:35,provisions:50}:level===2?{merits:90,provisions:140}:null;}
export function upgradeBuilding(id:BuildingId):{ok:boolean;message:string}{return townUpgrade(id);}
// —— 城镇建设（英雄无敌式：每种建筑一座，点建筑建造 / 升级）——
type TownResult={ok:boolean;message:string};
const have=(s:WorldSave)=>({merits:s.merits,provisions:s.provisions,money:s.town.money});
function pay(s:WorldSave,c:{merits:number;provisions:number;money:number}){s.merits-=c.merits;s.provisions-=c.provisions;s.town.money-=c.money;}
function townCommit(s:WorldSave,message:string):TownResult{s.buildings=legacyLevels(s.town);const persisted=commit(s);return{ok:true,message:persisted?message:message+'（仅本次会话，存储不可用）'};}
/** 建造（Lv0→1）或升级一座建筑；检查城池规模、府衙前提与资源。 */
export function townUpgrade(id:TownBuildingId):TownResult{const s=loadWorld(),t=s.town,def=TOWN_BUILDINGS[id];if(!def)return{ok:false,message:'未知建筑'};
 const cost=nextCost(t,id);if(!cost)return{ok:false,message:'已达最高等级'};
 const block=buildBlockers(t,id);if(block.length)return{ok:false,message:'需要 '+block.join('、')};
 if(!canAfford(have(s),cost))return{ok:false,message:'资源不足：需要 '+costText(cost)};
 pay(s,cost);const lv=++t.levels[id];
 return townCommit(s,id==='hall'?`府衙升至 Lv${lv}，城池扩建为${CITY_SIZE[lv]}`:lv===1?def.name+'建成':`${def.name}升至 Lv${lv}`);}
export function setTaxRate(rate:TaxRate):TownResult{const s=loadWorld();if(!(rate in TAX_NAME))return{ok:false,message:'无效税率'};s.town.tax=rate;return townCommit(s,'税率改为'+TAX_NAME[rate]);}
/** 占领城池的发展方向：从“均衡”首次选择免费，之后按城池档次花钱。 */
export function setCityFocus(cityId:string,focus:CityFocus):TownResult{const s=loadWorld(),c=cityById(cityId);if(!c||!s.ownedCities.includes(cityId))return{ok:false,message:'不是你的城池'};if(!(focus in FOCUS_NAME)||focus==='balanced')return{ok:false,message:'无效方向'};
 const cur=s.town.focus[cityId]??'balanced';if(cur===focus)return{ok:false,message:'已是'+FOCUS_NAME[focus]};const cost=cur==='balanced'?0:FOCUS_CHANGE_COST[c.tier];
 if(s.town.money<cost)return{ok:false,message:`钱不足：改方向需要 ${cost}`};s.town.money-=cost;s.town.focus[cityId]=focus;return townCommit(s,`${c.name}改为${FOCUS_NAME[focus]}`);}
/** 处理待决事件（0 / 1 号选项）。 */
export function resolveTownEvent(choice:number):TownResult{const s=loadWorld(),t=s.town,ev=t.pendingEvent?eventById(t.pendingEvent):undefined;if(!ev)return{ok:false,message:'没有待处理的事件'};const opt=ev.options[choice===1?1:0],e=opt.effect;
 s.town.money=Math.max(0,t.money+(e.money??0));s.provisions=Math.max(0,s.provisions+(e.provisions??0));s.merits=Math.max(0,s.merits+(e.merits??0));
 if(e.taxMul)t.mods.taxMul=Math.max(.2,Math.min(3,t.mods.taxMul*e.taxMul));if(e.grainMul)t.mods.grainMul=Math.max(.2,Math.min(3,t.mods.grainMul*e.grainMul));if(e.badRisk)t.mods.badRisk=Math.max(-1,Math.min(3,t.mods.badRisk+e.badRisk));
 t.boon.attributePoints=Math.min(5,t.boon.attributePoints+(e.attributePoints??0));t.boon.damage=Math.max(-.3,Math.min(.5,t.boon.damage+(e.damage??0)));t.boon.maxHp=Math.max(-.3,Math.min(.5,t.boon.maxHp+(e.maxHp??0)));
 for(const [k,n] of Object.entries(e.reserve??{}))if(TROOP_KINDS.includes(k as TroopKind))s.reserve[k]=Math.min(999,(s.reserve[k]??0)+n);
 t.pendingEvent=null;return townCommit(s,`${ev.title} · ${opt.label}`);}
/** 市集买卖粮：sell=true 卖粮换钱，否则花钱买粮。需要市集。 */
/** 粮仓「开仓募兵」：每季一次，粮草与钱换后备刀盾 / 长枪兵。 */
export function granaryLevy():TownResult{const s=loadWorld(),t=s.town,lv=levelOf(t,'granary');if(!lv)return{ok:false,message:'需要先建粮仓'};const key=t.year+'-'+t.season;if(t.levied===key)return{ok:false,message:'本季已开仓募兵，下季再来'};
 const cost=levyCost(lv);if(!canAfford(have(s),cost))return{ok:false,message:'资源不足：需要 '+costText(cost)};pay(s,cost);const n=LEVY_SOLDIERS[lv];for(let i=0;i<n;i++){const k=i%2?'spearman':'swordsman';s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}t.levied=key;
 return townCommit(s,`开仓募兵：后备兵 +${n}（${costText(cost)}）`);}
export function tradeGrain(sell:boolean,amount:number):TownResult{const s=loadWorld(),t=s.town;if(!levelOf(t,'market'))return{ok:false,message:'需要先建市集'};const n=Math.max(1,Math.floor(amount));
 if(sell){if(s.provisions<n)return{ok:false,message:'粮草不足'};const gain=Math.floor(n*grainSellPrice(t));s.provisions-=n;t.money+=gain;return townCommit(s,`卖粮 ${n}，得钱 ${gain}`);}
 const cost=Math.ceil(n*grainBuyPrice(t));if(t.money<cost)return{ok:false,message:`钱不足：需要 ${cost}`};t.money-=cost;s.provisions=Math.min(1_000_000,s.provisions+n);return townCommit(s,`买粮 ${n}，花钱 ${cost}`);}
/** 驿站派商队：带粮去己方城池，下季结算时带钱回来（可能被劫）。 */
export function sendCaravan(cityId:string,cargo:number):TownResult{const s=loadWorld(),t=s.town,c=cityById(cityId);if(!caravanSlots(t))return{ok:false,message:'需要先建驿站'};if(!c||!s.ownedCities.includes(cityId))return{ok:false,message:'只能派往己方城池'};
 if(t.caravans.length>=caravanSlots(t))return{ok:false,message:`驿站 Lv${caravanSlots(t)} 每季最多 ${caravanSlots(t)} 支商队`};if(t.caravans.some(x=>x.to===cityId))return{ok:false,message:c.name+'已有商队在途'};
 const n=Math.max(10,Math.floor(cargo));if(s.provisions<n)return{ok:false,message:'粮草不足'};const value=caravanValue(n,c.tier,t.focus[cityId]??'balanced');s.provisions-=n;t.caravans.push({to:cityId,cargo:n,value});return townCommit(s,`商队载粮 ${n} 前往${c.name}，预计下季带回 ${value} 钱`);}
export type {TownState,TownBuildingId,TaxRate,CityFocus,SeasonReport};
/** 主城建筑 + W3 大城特产的出征开局效果。 */
export function permanentEffects(){const s=loadWorld(),b=s.buildings,be=buildingBattleEffects(s.town),sp=territorySummary(s.ownedCities).specialties.map(x=>x.specialty),sum=(k:'damage'|'maxHp'|'reserveSlots'|'attributePoints'|'provisions'|'reinforcements')=>sp.reduce((n,x)=>n+(x[k]??0),0);
 return{armyCapacity:armyCapacity(b.barracks),reinforcements:b.barracks-1+sum('reinforcements'),healMultiplier:1+(b.clinic-1)*.06,provisionsMultiplier:1+(b.farm-1)*.08,
  damageBonus:sum('damage')+be.damage+s.town.boon.damage,maxHpBonus:Math.max(-.2,sum('maxHp')+be.maxHp+s.town.boon.maxHp),reserveSlots:2+sum('reserveSlots'),attributePoints:sum('attributePoints')+be.attributePoints+s.town.boon.attributePoints,provisionsBonus:sum('provisions')};}
/**
 * 结算时（胜利或坚持 60 秒以上）过一个季度（TOWN_PLAN.md · T1）：农田产粮、市集收税、城池按发展方向产出、扣后备兵军粮。
 * 寿春特产仍提高本次全部粮草收益。返回的 provisions 已是净值（含产粮与开销）；钱直接记入 town.money。
 */
function applyIncome(s:WorldSave,eligible:boolean,merits:number,provisions:number):{merits:number;provisions:number;cityMerits:number;cityProvisions:number;season:SeasonReport|null}{
 const t=territorySummary(s.ownedCities),bonus=1+t.specialties.reduce((n,x)=>n+(x.specialty.provisions??0),0),battle=Math.round(provisions*bonus);
 if(!eligible)return{merits,provisions:battle,cityMerits:0,cityProvisions:0,season:null};
 const cities=s.ownedCities.map(id=>cityById(id)).filter((c):c is NonNullable<typeof c>=>!!c).map(c=>({tier:c.tier,focus:s.town.focus[c.id]??'balanced' as CityFocus,mult:raidedNow(s).includes(c.id)?.5:1}));
 const troops=Object.values(s.reserve).reduce((n,v)=>n+(v||0),0),raided=raidedNow(s).map(id=>cityById(id)?.name??id);
 const r=settleSeason(s.town,{troops,cities,provisionsHave:s.provisions+battle,provisionsMultiplier:bonus});s.town.boon=noBoon();if(raided.length)r.raided=raided;refreshIntel(s);
 return{merits:merits+r.cityMerits,provisions:battle+r.grain+r.cityProvisions-r.upkeep,cityMerits:r.cityMerits,cityProvisions:r.cityProvisions,season:r};}
/** 结算面板上的“城池产出”一行（无产出时为空）。 */
export function cityIncomeLine(r:{cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null}):string{const q=r.season;if(!q)return r.cityMerits||r.cityProvisions?`\n城池产出 · 军功 +${r.cityMerits??0} / 粮草 +${r.cityProvisions??0}`:'';
 const city=q.cityMerits||q.cityProvisions||q.cityMoney?` · 城池 功+${q.cityMerits} 粮+${q.cityProvisions} 钱+${q.cityMoney}`:'';
 return `\n${seasonLabel(q.year,q.season)} · 农田 +${q.grain} 粮 · 税 +${q.tax} 钱${city} · 军粮 −${q.upkeep}${q.shortage?`（缺 ${q.shortage}）`:''}${q.raided?.length?`\n流寇未平 · ${q.raided.join('、')}本季产出减半`:''}`;}
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
 if(valid&&!result.debug){const victory=result.victory&&result.bossKilled&&result.reason==='boss';const farm=1+(s.active.farm-1)*.08;if(victory){const stage=s.active.stage??3;const first=result.chapter==='huangjin'?s.yellowStages<stage:s.dongzhuoStages<stage;merits=60+Math.floor(Math.min(result.kills,1500)/100)+(first?20:0);provisions=Math.floor((90+Math.floor(Math.min(result.kills,1500)/25)+(first?30:0))*farm);if(result.chapter==='huangjin'){s.yellowStages=Math.max(s.yellowStages,stage);if(stage===3){s.cleared.huangjin=true;s.worldAvailable=true;}}else {s.dongzhuoStages=Math.max(s.dongzhuoStages,stage);if(stage===3){s.cleared.hulao=true;s.worldAvailable=true;}}s.nodes=[...new Set([...s.nodes,...(s.worldAvailable?['home','huangjin','hulao']:['huangjin'])])];}else if(!result.victory&&result.elapsed>=60&&result.kills>=20){const score=Math.min(20,Math.floor(result.kills/20)+Math.floor(result.elapsed/120)),gain=Math.max(0,score-s.failureBest[result.chapter]);merits=gain;provisions=Math.floor(gain*2*farm);s.failureBest[result.chapter]=Math.max(score,s.failureBest[result.chapter]);}}
 const inc=applyIncome(s,valid&&!result.debug&&(result.victory||result.elapsed>=60),merits,provisions);merits=inc.merits;provisions=inc.provisions;
 s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,message:result.debug?'测试战斗 · 不发放永久资源':!persisted?'奖励仅保留本次会话（存储不可用）':merits||provisions?'已自动入库':'未超过本章失败最佳成绩，无新增奖励'};}

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
 s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
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
 s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
 return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,held,message:persisted?(held?'城池守住了':'守城失利，城池仍告急'):'已保留本次会话，存储不可用'};
}
/** Fresh campaigns open the world after Lubu; migrated saves keep prior access. */
export function worldUnlocked():boolean{return loadWorld().worldAvailable;}
/** 天下地图：返回自上次查看以来新开放的章节数，并记为已见。 */
export function takeNewChapters():number{const s=loadWorld(),open=openChapterCount(s),fresh=Math.max(0,open-s.chapterSeen);if(open!==s.chapterSeen){s.chapterSeen=open;commit(s);}return fresh;}
/** 乱世难度：该章是否已首通。 */
export function hardChapterCleared(id:string):boolean{return loadWorld().hardCleared.includes(id);}
/** 乱世难度首通：记入存档并发一次性军功 / 粮草；已首通返回 false。 */
export function recordHardClear(id:string,reward:{merits:number;provisions:number}):boolean{const s=loadWorld();if(s.hardCleared.includes(id))return false;s.hardCleared.push(id);s.merits+=reward.merits;s.provisions+=reward.provisions;commit(s);return true;}
export function recruitReserve(kind:TroopKind):{ok:boolean;message:string}{const s=loadWorld();if(s.yellowStages<3)return{ok:false,message:'击败张角后开放主城招募'};if(!TROOPS[kind])return{ok:false,message:'无效兵种'};const cost=TROOPS[kind].cost;if(s.provisions<cost)return{ok:false,message:'永久粮草不足'};if((s.reserve[kind]??0)>=999)return{ok:false,message:'该兵种后备已满'};s.provisions-=cost;s.reserve[kind]=(s.reserve[kind]??0)+1;s.armyPlan.priority=kind;commit(s);return{ok:true,message:'已编入后备；下次出征最多带2名后备兵'};}
export function takeExpeditionReserve(slots=2):TroopKind[]{const s=loadWorld(),out:TroopKind[]=[];if(!Number.isSafeInteger(slots)||slots<=0)return out;if(s.yellowStages<3||!s.active||s.active.state!=='active'||s.active.deployed?.length)return out;for(const kind of [...new Set([...(s.armyPlan.priority?[s.armyPlan.priority]:[]),...TROOP_KINDS])])while((s.reserve[kind]??0)>0&&out.length<Math.min(5,slots)){s.reserve[kind]--;out.push(kind);}if(out.length){if(s.active)s.active.deployed=[...out];commit(s);}return out;}

export function yellowStageUnlocked(stage:number):boolean{return Number.isInteger(stage)&&stage>=1&&stage<=3&&stage<=loadWorld().yellowStages+1;}

/** hulao remains the economy/save chapter ID; westStage selects its three battles. */
export function dongzhuoStageUnlocked(stage:number):boolean{const s=loadWorld();return Number.isInteger(stage)&&stage>=1&&stage<=3&&(s.cleared.huangjin||s.yellowStages===3||s.legacyHulaoAccess)&&(s.legacyHulaoAccess||stage<=s.dongzhuoStages+1);}
export function nextDongzhuoStage():1|2|3{return Math.min(3,loadWorld().dongzhuoStages+1) as 1|2|3;}

/** 群雄篇章（第三章 qunxiong、第四章 guandu）用显式 arc 键结算，不会结算旧的虎牢出征。 */
const ARC_FIELDS:Record<WarlordArc,{stages:'warlordStages'|'guanduStages'|'chibiStages';best:'thirdFailureBest'|'guanduFailureBest'|'chibiFailureBest'}>={qunxiong:{stages:'warlordStages',best:'thirdFailureBest'},guandu:{stages:'guanduStages',best:'guanduFailureBest'},chibi:{stages:'chibiStages',best:'chibiFailureBest'}};
export function arcStages(arc:WarlordArc):number{return loadWorld()[ARC_FIELDS[arc].stages];}
export function arcUnlocked(arc:WarlordArc):boolean{const s=loadWorld();return arc==='qunxiong'?s.cleared.hulao:arc==='guandu'?s.cleared.hulao&&s.warlordStages>=3:s.cleared.hulao&&s.guanduStages>=3;}
export function arcStageUnlocked(arc:WarlordArc,stage:number):boolean{return Number.isInteger(stage)&&stage>=1&&stage<=3&&arcUnlocked(arc)&&stage<=arcStages(arc)+1;}
export function beginArcExpedition(arc:WarlordArc,stage:number,deployed:TroopKind[]=[]):string{if(!arcStageUnlocked(arc,stage))return '';const s=loadWorld(),id=createExpeditionId();refundStaleExpedition(s);loseAlerted(s);s.active={id,chapter:'hulao',arc,stage,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
export function settleArcExpedition(arc:WarlordArc,id:string,result:{victory:boolean;bossKilled:boolean;kills:number;elapsed:number;debug:boolean;returned?:TroopKind[]}):{merits:number;provisions:number;cityMerits?:number;cityProvisions?:number;season?:SeasonReport|null;message:string}{
 const zero={merits:0,provisions:0};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active,F=ARC_FIELDS[arc];if(!a||a.arc!==arc||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id)||!Number.isFinite(result.kills)||!Number.isFinite(result.elapsed)||result.kills<0||result.elapsed<0)return{...zero,message:'本场已结算或无效'};
 const stage=a.stage??1;if(!arcStageUnlocked(arc,stage))return{...zero,message:'关卡尚未开放'};a.state='settled';let merits=0,provisions=0;
 if(result.victory&&result.bossKilled){const first=s[F.stages]<stage;merits=60+Math.floor(Math.min(result.kills,1500)/100)+(first?20:0);provisions=Math.floor((90+Math.floor(Math.min(result.kills,1500)/25)+(first?30:0))*(1+(a.farm-1)*.08));s[F.stages]=Math.max(s[F.stages],stage);if(arc==='qunxiong'&&s.warlordStages>=3&&!s.nodes.includes('guandu'))s.nodes.push('guandu');if(arc==='guandu'&&s.guanduStages>=3&&!s.nodes.includes('chibi'))s.nodes.push('chibi');}else if(!result.victory&&result.elapsed>=60&&result.kills>=20){const score=Math.min(20,Math.floor(result.kills/20)+Math.floor(result.elapsed/120));merits=Math.max(0,score-s[F.best]);provisions=merits*2;s[F.best]=Math.max(s[F.best],score);}
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 const inc=applyIncome(s,result.victory||result.elapsed>=60,merits,provisions);merits=inc.merits;provisions=inc.provisions;
 s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);return{merits,provisions,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,message:persisted?'战后奖励已入库':'已保留本次会话，存储不可用'};
}
/** 第三章旧接口（保持不变的调用点与测试）。 */
export function thirdChapterUnlocked():boolean{return arcUnlocked('qunxiong');}
export function thirdStageUnlocked(stage:number):boolean{return arcStageUnlocked('qunxiong',stage);}
export function beginThirdExpedition(stage:number,deployed:TroopKind[]=[]):string{return beginArcExpedition('qunxiong',stage,deployed);}
export function settleThirdExpedition(id:string,result:{victory:boolean;bossKilled:boolean;kills:number;elapsed:number;debug:boolean;returned?:TroopKind[]}):ReturnType<typeof settleArcExpedition>{return settleArcExpedition('qunxiong',id,result);}
/** W4：有告急城池时，出征别处前的警示语（无告急为空串）。 */
export function alertLossWarning():string{const names=loadWorld().alerts.map(a=>cityById(a.city)?.name).filter(Boolean);return names.length?`⚠ ${names.join('、')}告急：此时出征别处，${names.length>1?'这些城池':'该城'}将失守`:'';}
/** 道具分解所得的钱记入主城（ItemStore 调用）。 */
export function addTownMoney(amount:number):void{const n=Math.floor(amount);if(!(n>0))return;const s=loadWorld();s.town.money=Math.min(9999999,s.town.money+n);commit(s);}

/* —— 天下地图 · 军情事件（WorldIntel.ts）—— */
/** 仍有效的军情：未过期；悬赏所在城未被我方占领；流寇所在城仍属我方。 */
function liveIntel(s:WorldSave):IntelEvent[]{const now=seasonIndex(s.town);return s.intel.filter(e=>e.expires>=now&&(e.kind==='bounty'?!s.ownedCities.includes(e.city):e.kind==='bandit'?s.ownedCities.includes(e.city):true));}
/** 本季流寇未平的我方城池（季度结算时产出减半）。 */
function raidedNow(s:WorldSave):string[]{return liveIntel(s).filter(e=>e.kind==='bandit').map(e=>e.city);}
function spawnIntel(s:WorldSave,first=false):IntelEvent[]{if(!s.cleared.hulao)return[];const fresh=rollIntel({era:eraOf(s),owned:s.ownedCities,alerts:s.alerts.map(a=>a.city),existing:s.intel,season:seasonIndex(s.town),seq:s.intelSeq,random,noBandit:first});s.intel=[...s.intel,...fresh];s.intelSeq+=Math.max(1,fresh.length);return fresh;}
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
 s.town.money=Math.min(9999999,s.town.money+money);s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);
 const name=e?INTEL_INFO[e.kind].name:'军情';
 return{merits,provisions,money,item,cityMerits:inc.cityMerits,cityProvisions:inc.cityProvisions,season:inc.season,resolved,event:e,message:!persisted?'已保留本次会话，存储不可用':resolved?name+'告成':e?.kind==='escort'&&result.lost?'商队被劫，此事作罢':name+'未成，可在期限内再战'};
}
