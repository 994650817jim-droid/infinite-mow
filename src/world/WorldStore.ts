import {armyCapacity,TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import type {ChapterId} from '../data/chapters';
export type BuildingId='barracks'|'farm'|'clinic';
export interface WorldSave {version:5; yellowStages:number; warlordStages:number;thirdFailureBest:number; dongzhuoStages:number; legacyHulaoAccess:boolean; worldAvailable:boolean; revision:number; merits:number; provisions:number; buildings:Record<BuildingId,number>; cleared:Record<ChapterId,boolean>; failureBest:Record<ChapterId,number>; nodes:string[]; reserve:Record<string,number>; armyPlan:{capacity:number;garrison:number;priority?:TroopKind}; active:null|{id:string;chapter:ChapterId;state:'active'|'settled';arc?:'qunxiong';farm:number;stage?:number;deployed?:TroopKind[]}; receipts:Array<{id:string;merits:number;provisions:number}>;}
export const WORLD_KEY='im_world_v1',BACKUP_KEY='im_world_backup_v1';
const LEGACY='im_chapter1_cleared';
let memory:WorldSave|undefined;
export let storageUnavailable=false;
export let incompatibleSave=false;
const integer=(v:unknown,max=1_000_000)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
const defaults=():WorldSave=>({version:5,yellowStages:0,warlordStages:0,thirdFailureBest:0,dongzhuoStages:0,legacyHulaoAccess:false,worldAvailable:false,revision:0,merits:0,provisions:0,buildings:{barracks:1,farm:1,clinic:1},cleared:{huangjin:false,hulao:false},failureBest:{huangjin:0,hulao:0},nodes:['huangjin'],reserve:{},armyPlan:{capacity:2,garrison:0},active:null,receipts:[]});
function parse(raw:string|null):WorldSave|null {try{if(!raw)return null;const v=JSON.parse(raw);if(![1,2,3,4,5].includes(v.version)||!v.buildings||!v.cleared)return null;const s=defaults();s.warlordStages=integer(v.warlordStages,3);s.thirdFailureBest=integer(v.thirdFailureBest,20);s.yellowStages=integer(v.yellowStages,3);s.revision=integer(v.revision);s.merits=integer(v.merits);s.provisions=integer(v.provisions);for(const id of ['barracks','farm','clinic'] as BuildingId[])s.buildings[id]=Math.max(1,integer(v.buildings[id],3));for(const id of ['huangjin','hulao'] as ChapterId[]){s.cleared[id]=v.cleared[id]===true;s.failureBest[id]=integer(v.failureBest?.[id],20);}if(s.cleared.huangjin||s.cleared.hulao)s.yellowStages=3;
 // v1/v2 builds opened the map directly after Zhangjiao. Keep that access for existing saves;
 // new v3 runs unlock it only after Hulao is cleared.
 s.worldAvailable=v.version<3?(s.yellowStages===3||s.cleared.huangjin||s.cleared.hulao):v.worldAvailable===true;
 if(s.cleared.hulao)s.worldAvailable=true;
 s.dongzhuoStages=v.version>=4?integer(v.dongzhuoStages,3):0;
 s.legacyHulaoAccess=v.version>=4?v.legacyHulaoAccess===true:(s.cleared.huangjin||s.cleared.hulao||s.worldAvailable||localStorage.getItem(LEGACY)==='true');
 if(s.cleared.hulao)s.dongzhuoStages=3;
 if(s.dongzhuoStages===3){s.cleared.hulao=true;s.worldAvailable=true;}
s.nodes=[...new Set([...(Array.isArray(v.nodes)?v.nodes.filter((n:unknown)=>typeof n==='string').slice(0,128):[]),...(s.worldAvailable?['home','huangjin','hulao']:['huangjin'])])];for(const kind of TROOP_KINDS)s.reserve[kind]=integer(v.reserve?.[kind],999);if(v.active&&typeof v.active.id==='string'&&['huangjin','hulao'].includes(v.active.chapter)&&['active','settled'].includes(v.active.state))s.active={arc:v.active.arc==='qunxiong'?'qunxiong':undefined,stage:Math.max(1,integer(v.active.stage??3,3)),deployed:Array.isArray(v.active.deployed)?v.active.deployed.filter((k:TroopKind)=>TROOP_KINDS.includes(k)).slice(0,2):[],id:v.active.id.slice(0,100),chapter:v.active.chapter,state:v.active.state,farm:Math.max(1,integer(v.active.farm,3))};if(s.cleared.hulao&&!s.nodes.includes('qunxiong'))s.nodes.push('qunxiong');s.armyPlan.capacity=Math.max(1,integer(v.armyPlan?.capacity??2,999));s.armyPlan.garrison=integer(v.armyPlan?.garrison,999);if(TROOP_KINDS.includes(v.armyPlan?.priority))s.armyPlan.priority=v.armyPlan.priority;s.receipts=Array.isArray(v.receipts)?v.receipts.filter((r:unknown)=>r&&typeof r==='object'&&typeof (r as {id?:unknown}).id==='string').slice(-32).map((r:{id:string;merits:unknown;provisions:unknown})=>({id:r.id.slice(0,100),merits:integer(r.merits),provisions:integer(r.provisions)})):[];return s;}catch{return null;}}
export function loadWorld():WorldSave {if(storageUnavailable&&memory)return structuredClone(memory);let s:WorldSave;try{const raw=localStorage.getItem(WORLD_KEY),backup=localStorage.getItem(BACKUP_KEY);let future=false;try{future=JSON.parse(raw??'null')?.version>5;}catch{}if(future){incompatibleSave=true;storageUnavailable=true;s=memory??defaults();}else {const current=parse(raw),previous=parse(backup);s=current??previous??defaults();
 // The legacy chapter-clear flag is also written by current campaign progression.
 // Only use it to migrate saves that have no structured save at all; otherwise a
 // fresh Zhangjiao clear would incorrectly unlock the world map before Hulao.
 if(!current&&!previous&&localStorage.getItem(LEGACY)==='true'){s.cleared.huangjin=true;s.yellowStages=3;s.worldAvailable=true;s.legacyHulaoAccess=true;s.nodes=['home','huangjin','hulao'];}
 }}catch{storageUnavailable=true;s=memory??defaults();}memory=s;return structuredClone(s);}
function commit(s:WorldSave):boolean {s.revision++;if(storageUnavailable){memory=structuredClone(s);return false;}try{const old=localStorage.getItem(WORLD_KEY);if(parse(old))localStorage.setItem(BACKUP_KEY,old!);localStorage.setItem(WORLD_KEY,JSON.stringify(s));memory=structuredClone(s);return true;}catch{storageUnavailable=true;memory=structuredClone(s);return false;}}
export function saveWorld():void{commit(loadWorld());}
export function worldChapterCleared(chapter:ChapterId):boolean{return loadWorld().cleared[chapter];}
export const BUILDINGS:Record<BuildingId,{name:string;description:(level:number)=>string}>= {
 barracks:{name:'军营',description:l=>`不限制兵力 · 开局增援 ${l-1} 人`},
 farm:{name:'农田',description:l=>`战后粮草收益 +${(l-1)*8}%`},
 clinic:{name:'医馆',description:l=>`军医治疗量 +${(l-1)*6}%`},
};
export function upgradeCost(level:number):{merits:number;provisions:number}|null{return level===1?{merits:35,provisions:50}:level===2?{merits:90,provisions:140}:null;}
export function upgradeBuilding(id:BuildingId):{ok:boolean;message:string}{const s=loadWorld(),cost=upgradeCost(s.buildings[id]);if(!cost)return{ok:false,message:'已达Lv3'};if(s.merits<cost.merits||s.provisions<cost.provisions)return{ok:false,message:'资源不足，出征可获取军功与粮草'};s.merits-=cost.merits;s.provisions-=cost.provisions;s.buildings[id]++;const persisted=commit(s);return{ok:true,message:persisted?'建筑升级完成':'已在本次会话升级；浏览器存储不可用'};}
export function permanentEffects(){const b=loadWorld().buildings;return{armyCapacity:armyCapacity(b.barracks),reinforcements:b.barracks-1,healMultiplier:1+(b.clinic-1)*.06,provisionsMultiplier:1+(b.farm-1)*.08};}
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
export function beginExpedition(chapter:ChapterId,stage=3,deployed:TroopKind[]=[]):string {const s=loadWorld(),id=createExpeditionId();s.active={id,chapter,stage,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
export function settleExpedition(id:string,result:{chapter:ChapterId;victory:boolean;bossKilled:boolean;elapsed:number;kills:number;reason:string;debug:boolean;returned?:TroopKind[]}):{merits:number;provisions:number;message:string}{const s=loadWorld(),zero={merits:0,provisions:0};if(!s.active||s.active.arc==='qunxiong'||s.active.id!==id||s.active.chapter!==result.chapter||s.active.state!=='active'||s.receipts.some(r=>r.id===id))return{...zero,message:'本次奖励已结算或出征已失效'};const available=[...(s.active.deployed??[])];for(const kind of result.returned??[]){const i=available.indexOf(kind);if(i>=0){available.splice(i,1);s.reserve[kind]=Math.min(999,(s.reserve[kind]??0)+1);}}s.active.state='settled';let merits=0,provisions=0;const valid=Number.isFinite(result.elapsed)&&Number.isFinite(result.kills)&&result.elapsed>=0&&result.kills>=0&&(result.chapter!=='hulao'||((s.cleared.huangjin||s.yellowStages===3||s.legacyHulaoAccess)&&Number.isInteger(s.active.stage??3)&&(s.active.stage??3)>=1&&(s.active.stage??3)<=3&&(s.legacyHulaoAccess||(s.active.stage??3)<=s.dongzhuoStages+1)));
 if(valid&&!result.debug){const victory=result.victory&&result.bossKilled&&result.reason==='boss';const farm=1+(s.active.farm-1)*.08;if(victory){const stage=s.active.stage??3;const first=result.chapter==='huangjin'?s.yellowStages<stage:s.dongzhuoStages<stage;merits=60+Math.floor(Math.min(result.kills,1500)/100)+(first?20:0);provisions=Math.floor((90+Math.floor(Math.min(result.kills,1500)/25)+(first?30:0))*farm);if(result.chapter==='huangjin'){s.yellowStages=Math.max(s.yellowStages,stage);if(stage===3)s.cleared.huangjin=true;}else {s.dongzhuoStages=Math.max(s.dongzhuoStages,stage);if(stage===3){s.cleared.hulao=true;s.worldAvailable=true;}}s.nodes=[...new Set([...s.nodes,...(s.worldAvailable?['home','huangjin','hulao']:['huangjin'])])];}else if(!result.victory&&result.elapsed>=60&&result.kills>=20){const score=Math.min(20,Math.floor(result.kills/20)+Math.floor(result.elapsed/120)),gain=Math.max(0,score-s.failureBest[result.chapter]);merits=gain;provisions=Math.floor(gain*2*farm);s.failureBest[result.chapter]=Math.max(score,s.failureBest[result.chapter]);}}
 s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);return{merits,provisions,message:result.debug?'测试战斗 · 不发放永久资源':!persisted?'奖励仅保留本次会话（存储不可用）':merits||provisions?'已自动入库':'未超过本章失败最佳成绩，无新增奖励'};}

/** Fresh campaigns open the world after Lubu; migrated saves keep prior access. */
export function worldUnlocked():boolean{return loadWorld().worldAvailable;}
export function recruitReserve(kind:TroopKind):{ok:boolean;message:string}{const s=loadWorld();if(s.yellowStages<3)return{ok:false,message:'击败张角后开放主城招募'};if(!TROOPS[kind])return{ok:false,message:'无效兵种'};const cost=TROOPS[kind].cost;if(s.provisions<cost)return{ok:false,message:'永久粮草不足'};if((s.reserve[kind]??0)>=999)return{ok:false,message:'该兵种后备已满'};s.provisions-=cost;s.reserve[kind]=(s.reserve[kind]??0)+1;s.armyPlan.priority=kind;commit(s);return{ok:true,message:'已编入后备；下次出征最多带2名后备兵'};}
export function takeExpeditionReserve(slots=2):TroopKind[]{const s=loadWorld(),out:TroopKind[]=[];if(!Number.isSafeInteger(slots)||slots<=0)return out;if(s.yellowStages<3||!s.active||s.active.state!=='active'||s.active.deployed?.length)return out;for(const kind of [...new Set([...(s.armyPlan.priority?[s.armyPlan.priority]:[]),...TROOP_KINDS])])while((s.reserve[kind]??0)>0&&out.length<Math.min(2,slots)){s.reserve[kind]--;out.push(kind);}if(out.length){if(s.active)s.active.deployed=[...out];commit(s);}return out;}

export function yellowStageUnlocked(stage:number):boolean{return Number.isInteger(stage)&&stage>=1&&stage<=3&&stage<=loadWorld().yellowStages+1;}

/** hulao remains the economy/save chapter ID; westStage selects its three battles. */
export function dongzhuoStageUnlocked(stage:number):boolean{const s=loadWorld();return Number.isInteger(stage)&&stage>=1&&stage<=3&&(s.cleared.huangjin||s.yellowStages===3||s.legacyHulaoAccess)&&(s.legacyHulaoAccess||stage<=s.dongzhuoStages+1);}
export function nextDongzhuoStage():1|2|3{return Math.min(3,loadWorld().dongzhuoStages+1) as 1|2|3;}

/** Chapter 3 uses an explicit arc key; it never settles a legacy Hulao expedition. */
export function thirdChapterUnlocked():boolean{return loadWorld().cleared.hulao;}
export function thirdStageUnlocked(stage:number):boolean{const s=loadWorld();return Number.isInteger(stage)&&stage>=1&&stage<=3&&s.cleared.hulao&&stage<=s.warlordStages+1;}
export function beginThirdExpedition(stage:number,deployed:TroopKind[]=[]):string{if(!thirdStageUnlocked(stage))return '';const s=loadWorld(),id=createExpeditionId();s.active={id,chapter:'hulao',arc:'qunxiong',stage,state:'active',farm:s.buildings.farm,deployed:[...deployed]};commit(s);return id;}
export function settleThirdExpedition(id:string,result:{victory:boolean;bossKilled:boolean;kills:number;elapsed:number;debug:boolean;returned?:TroopKind[]}):{merits:number;provisions:number;message:string}{
 const zero={merits:0,provisions:0};if(result.debug)return{...zero,message:'测试战斗，不写入永久进度'};
 const s=loadWorld(),a=s.active;if(!a||a.arc!=='qunxiong'||a.id!==id||a.state!=='active'||s.receipts.some(r=>r.id===id)||!Number.isFinite(result.kills)||!Number.isFinite(result.elapsed)||result.kills<0||result.elapsed<0)return{...zero,message:'本场已结算或无效'};
 const stage=a.stage??1;if(!thirdStageUnlocked(stage))return{...zero,message:'关卡尚未开放'};a.state='settled';let merits=0,provisions=0;
 if(result.victory&&result.bossKilled){const first=s.warlordStages<stage;merits=60+Math.floor(Math.min(result.kills,1500)/100)+(first?20:0);provisions=Math.floor((90+Math.floor(Math.min(result.kills,1500)/25)+(first?30:0))*(1+(a.farm-1)*.08));s.warlordStages=Math.max(s.warlordStages,stage);}else if(!result.victory&&result.elapsed>=60&&result.kills>=20){const score=Math.min(20,Math.floor(result.kills/20)+Math.floor(result.elapsed/120));merits=Math.max(0,score-s.thirdFailureBest);provisions=merits*2;s.thirdFailureBest=Math.max(s.thirdFailureBest,score);}
 const available=[...(a.deployed??[])];for(const k of result.returned??[]){const i=available.indexOf(k);if(i>=0){available.splice(i,1);s.reserve[k]=Math.min(999,(s.reserve[k]??0)+1);}}
 s.merits=Math.min(1_000_000,s.merits+merits);s.provisions=Math.min(1_000_000,s.provisions+provisions);s.receipts.push({id,merits,provisions});s.receipts=s.receipts.slice(-32);const persisted=commit(s);return{merits,provisions,message:persisted?'战后奖励已入库':'已保留本次会话，存储不可用'};
}
