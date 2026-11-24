import type {Enemy} from '../entities/Enemy';
import {STAR_OUTER_TUNING as T,STAR_COMBOS,STAR_COMBO_ORDER_MS,activeStarCombos,type StarOuterView,type StarOuterRow,type StarComboId} from '../data/starOuter';

export interface StarOuterHost {
 has:(id:string)=>boolean;
 position:()=>{x:number;y:number};
 query:(x:number,y:number,r:number)=>Enemy[];
 deal:(e:Enemy,raw:number,spell:boolean)=>void;
 volley:(e:Enemy,now:number,count:number,shield:boolean,accelerate:boolean)=>number;
 slow:(e:Enemy,now:number)=>void;
 fx:(id:string,x:number,y:number,angle?:number,size?:number)=>void;
}
/** Per-scene transient state only. Uses the host combat clock, damage and Legion. */
export class StarOuterCombat {
 readonly stats:Record<string,number>={};
 private target=-1;private streak=0;private hitAt=-Infinity;private surgeAt=-Infinity;private deathAt=-Infinity;
 private travel=0;private moving=false;private stoppedUntil=0;private echoAt=-Infinity;private spellAt=-Infinity;private slowAt=-Infinity;private orderAt=-Infinity;
 private marks=new Map<Enemy,{spawn:number;until:number;raw:number}>();
 private relay?:{e:Enemy;spawn:number;issued:number;due:number};
 private clock=0;private dragonAt=-Infinity;private tacticsAt=-Infinity;private volleyStamp=-Infinity;private spentVolley=-Infinity;private notice='';private noticeUntil=0;
 private echoes:Array<{e:Enemy;spawn:number;raw:number;spell:boolean;due:number;x:number;y:number;boost:boolean}>=[];
 constructor(private h:StarOuterHost){}
 private pulse(id:string,e:{x:number;y:number},angle=0,size=64):void{this.stats[id]=(this.stats[id]??0)+1;this.h.fx(id,e.x,e.y,angle,size);if(id in STAR_COMBOS){this.notice=STAR_COMBOS[id as StarComboId].name+' · 触发';this.noticeUntil=this.clock+1800;}}
 /** Actual voluntary displacement only: excludes teleports / knockback at caller. */
 movement(distance:number,dt:number,now:number):void{
  const moving=distance>.1&&distance<=Math.max(24,dt*650);
  if(this.moving&&!moving&&this.h.has('agility.NX2'))this.stoppedUntil=now+T.stopWindow;
  this.moving=moving;
  if(this.h.has('agility.K2')||this.h.has('agility.NX1'))this.travel=Math.max(0,Math.min(T.travel,moving?this.travel+distance:this.travel-T.decay*dt));else this.travel=0;
 }
 update(now:number):void{
  this.clock=now;
  for(const[e,m]of this.marks)if(!e.active||e.hp<=0||e.spawnId!==m.spawn||now>=m.until)this.marks.delete(e);
  this.flushRelay(now);
  const due=this.echoes.filter(x=>now>=x.due);this.echoes=this.echoes.filter(x=>now<x.due);
  for(const q of due)if(this.valid(q.e)&&q.e.spawnId===q.spawn&&Math.hypot(q.e.x-q.x,q.e.y-q.y)<=T.echoLeash){
   const hp=q.e.hp;this.h.deal(q.e,q.raw,q.spell);this.h.fx('agility.K2',q.e.x,q.e.y);
   if(q.boost&&this.combo('combo.dragon')&&now>=this.dragonAt&&this.target===q.spawn&&q.e.spawnId===q.spawn&&q.e.hp<hp){this.streak=Math.min(6,this.streak+1);this.dragonAt=now+STAR_COMBOS['combo.dragon'].cd;this.pulse('combo.dragon',q.e);}
  }
 }
 damageFactor(spell:boolean):number{return (spell&&this.h.has('intellect.K2')?T.spellCost:1)*(this.h.has('command.K2')?T.commandCost:1);}
 /** Called only for primary weapon hits that reached HP, never for derived hits. */
 hit(e:Enemy,raw:number,now:number,spell:boolean):void{
  this.clock=now;if(e.isSupplySlot)return;this.flushRelay(now);
  const primary=now-this.hitAt>=T.hitGap;
  if(primary){this.hitAt=now;if(this.target!==e.spawnId){this.streak=Math.floor(this.streak/2);this.target=e.spawnId;}this.streak=Math.min(999999,this.streak+1);
   if(this.h.has('strength.K2')&&this.streak>=7&&now>=this.surgeAt){this.streak=0;this.surgeAt=now+T.surgeCd;const p=this.h.position(),a=Math.atan2(e.y-p.y,e.x-p.x),dx=Math.cos(a),dy=Math.sin(a);
    this.pulse('strength.K2',e,a,T.surgeLength);let n=0;for(const o of [...this.h.query(e.x,e.y,T.surgeLength)]){const x=o.x-e.x,y=o.y-e.y,f=x*dx+y*dy;if(o===e||!this.valid(o)||f<0||f>T.surgeLength||Math.abs(x*dy-y*dx)>T.surgeWidth/2)continue;this.h.deal(o,raw*T.surgeRatio,spell);if(++n>=T.surgeTargets)break;}}
   else if(this.h.has('strength.NX1')&&this.streak%3===0&&e.hp>0){this.pulse('strength.NX1',e);this.h.deal(e,raw*T.fixedRatio,spell);}
   const key=this.h.has('agility.K2'),travel=this.travel>=(key?T.travel:T.smallTravel),stop=this.h.has('agility.NX2')&&now<this.stoppedUntil;
   if(now>=this.echoAt&&((travel&&(key||this.h.has('agility.NX1')))||stop)&&e.hp>0){const id=travel?(key?'agility.K2':'agility.NX1'):'agility.NX2';this.travel=0;this.stoppedUntil=0;this.echoAt=now+T.echoCd;this.echoes.push({e,spawn:e.spawnId,raw:raw*(travel?(key?T.echoRatio:T.smallEchoRatio):T.stopRatio),spell,due:now+T.echoDelay,x:e.x,y:e.y,boost:id==='agility.K2'&&this.combo('combo.dragon')});this.pulse(id,e);}
   if(now>=this.orderAt&&(this.h.has('command.K2')||this.h.has('command.NX1')||this.h.has('command.NX2'))&&e.hp>0){const key=this.h.has('command.K2'),count=key?T.volleyTargets:1,shield=this.h.has('command.NX2'),n=this.h.volley(e,now,count,shield,key||this.h.has('command.NX1'));if(n){this.volleyStamp=now;this.orderAt=now+T.volleyCd;this.pulse(key?'command.K2':this.h.has('command.NX1')?'command.NX1':'command.NX2',e);if(shield&&(key||this.h.has('command.NX1')))this.pulse('command.NX2',e);}}
  }
  if(e.hp<=0&&this.h.has('strength.NX2')&&now>=this.deathAt){this.deathAt=now+T.deathCd;this.pulse('strength.NX2',e);let n=0;for(const o of [...this.h.query(e.x,e.y,T.deathRadius)])if(o!==e&&this.valid(o)&&Math.hypot(o.x-e.x,o.y-e.y)<=T.deathRadius){this.h.deal(o,raw*T.deathRatio,spell);if(++n>=T.deathTargets)break;}}
  if(spell){
   if(this.h.has('intellect.NX2')&&now>=this.slowAt&&e.hp>0&&!e.controlImmune&&e.kind!=='boss'){this.slowAt=now+T.slowCd;this.h.slow(e,now);this.pulse('intellect.NX2',e);}
   const key=this.h.has('intellect.K2');if(key||this.h.has('intellect.NX1')){this.updateMarks(now);if(now>=this.spellAt){let n=0;for(const[o,m]of this.marks)if(o!==e&&this.valid(o)&&o.spawnId===m.spawn&&Math.hypot(o.x-e.x,o.y-e.y)<=T.chainRadius){this.h.deal(o,raw*(key?T.chainRatio:T.smallChainRatio),true);this.pulse(key?'intellect.K2':'intellect.NX1',o);if(++n>=(key?T.chainTargets:1))break;}if(n)this.spellAt=now+T.chainCd;}
    if(e.hp>0){if(!this.marks.has(e)&&this.marks.size>=(key?T.markTargets:2))this.marks.delete(this.marks.keys().next().value!);this.marks.set(e,{spawn:e.spawnId,until:now+T.markMs,raw});}}
  }
 }
 private combo(id:StarComboId):boolean{return STAR_COMBOS[id].keys.every(key=>this.h.has(key));}
 /** Only a real hit from a soldier carrying this volley ticket may relay a mark. */
 coordinatedHit(e:Enemy,now:number,issued:number):void{
  this.clock=now;this.updateMarks(now);
  if(!this.combo('combo.tactics')||issued!==this.volleyStamp||issued===this.spentVolley||now<issued||now-issued>STAR_COMBO_ORDER_MS||!this.valid(e))return;
  const mark=this.marks.get(e);if(!mark||mark.spawn!==e.spawnId)return;
  const due=Math.max(now,this.spellAt,this.tacticsAt);
  if(due>=Math.min(mark.until,issued+STAR_COMBO_ORDER_MS)||!this.relayTargets(e).length)return;
  this.spentVolley=issued;this.relay={e,spawn:e.spawnId,issued,due};this.flushRelay(now);
 }
 private relayTargets(e:Enemy):Enemy[]{return [...this.marks].filter(([o,m])=>o!==e&&this.valid(o)&&o.spawnId===m.spawn&&this.clock<m.until&&Math.hypot(o.x-e.x,o.y-e.y)<=T.chainRadius).slice(0,T.chainTargets).map(([o])=>o);}
 private flushRelay(now:number):void{
  const q=this.relay;if(!q)return;const m=this.marks.get(q.e);
  if(!this.combo('combo.tactics')||q.e.spawnId!==q.spawn||!this.valid(q.e)||!m||m.spawn!==q.spawn||now>=m.until||now-q.issued>STAR_COMBO_ORDER_MS){this.relay=undefined;return;}
  if(now<Math.max(q.due,this.spellAt,this.tacticsAt))return;
  this.relay=undefined;const targets=this.relayTargets(q.e);if(!targets.length)return;
  this.tacticsAt=now+STAR_COMBOS['combo.tactics'].cd;this.spellAt=now+T.chainCd;
  for(const o of targets)this.h.deal(o,m.raw*T.chainRatio,true);
  this.pulse('combo.tactics',q.e,0,96);
 }
 /** Read-only HUD projection: no timers advanced, marks refreshed, or counters consumed. */
 view(now:number):StarOuterView{
  const rows:StarOuterRow[]=[],left=(at:number)=>Math.max(0,Math.ceil((at-now)/1000));
  if(this.h.has('strength.K2')||this.h.has('strength.NX1')){const key=this.h.has('strength.K2'),count=key?Math.min(6,this.streak):this.streak%3,need=key?6:3,cd=key?left(this.surgeAt):0;rows.push({id:key?'strength.K2':'strength.NX1',label:key?'摧锋':'定锋',text:cd?count+'/'+need+' · 冷却'+cd+'秒':count>=need?'已蓄满 · 待命中':count+'/'+need+'次',progress:count/need,ready:!cd&&count>=need});}
  if(this.h.has('agility.K2')||this.h.has('agility.NX1')||this.h.has('agility.NX2')){const key=this.h.has('agility.K2'),move=key||this.h.has('agility.NX1'),p=move?Math.min(1,this.travel/(key?T.travel:T.smallTravel)):Number(now<this.stoppedUntil),cd=left(this.echoAt);rows.push({id:key?'agility.K2':move?'agility.NX1':'agility.NX2',label:move?'战意':'回身',text:cd?'冷却'+cd+'秒':p>=1?'已蓄满 · 待命中':Math.floor(p*100)+'%',progress:p,ready:!cd&&p>=1});}
  if(this.h.has('intellect.K2')||this.h.has('intellect.NX1')){const key=this.h.has('intellect.K2'),n=[...this.marks].filter(([e,m])=>this.valid(e)&&e.spawnId===m.spawn&&now<m.until).length,cd=left(this.spellAt);rows.push({id:key?'intellect.K2':'intellect.NX1',label:'印记',text:n+'/'+(key?3:2)+'枚'+(cd?' · 冷却'+cd+'秒':''),progress:n/(key?3:2),ready:!cd&&n>1});}
  if(this.h.has('command.K2')||this.h.has('command.NX1')||this.h.has('command.NX2')){const key=this.h.has('command.K2'),cd=left(this.orderAt);rows.push({id:key?'command.K2':this.h.has('command.NX1')?'command.NX1':'command.NX2',label:'协同',text:cd?'冷却'+cd+'秒':'就绪 · 需射程内士兵',progress:Math.max(0,Math.min(1,1-(this.orderAt-now)/T.volleyCd)),ready:!cd});}
  rows.sort((a,b)=>Number(b.id.endsWith('.K2'))-Number(a.id.endsWith('.K2')));
  return{rows,combos:activeStarCombos(id=>this.h.has(id)),notice:now<this.noticeUntil?this.notice:this.relay?'军师授策 · 待传导':''};
 }
 private valid(e:Enemy):boolean{return e.active&&e.hp>0&&!e.invulnerable&&!e.isSupplySlot;}
 private updateMarks(now:number):void{for(const[e,m]of this.marks)if(!this.valid(e)||e.spawnId!==m.spawn||now>=m.until)this.marks.delete(e);}
 clear():void{this.relay=undefined;this.clock=0;this.dragonAt=this.tacticsAt=this.volleyStamp=this.spentVolley=-Infinity;this.notice='';this.noticeUntil=0;this.target=-1;this.streak=this.travel=0;this.moving=false;this.stoppedUntil=0;this.hitAt=this.surgeAt=this.deathAt=this.echoAt=this.spellAt=this.slowAt=this.orderAt=-Infinity;this.marks.clear();this.echoes=[];for(const k of Object.keys(this.stats))delete this.stats[k];}
}
