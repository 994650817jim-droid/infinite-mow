import type {Enemy} from '../entities/Enemy';
import type {BuildState,TacticId} from '../data/builds';
import {type BuffProgress,countProgress,distanceProgress,chargeProgress,timerProgress} from '../ui/BuffProgress';
interface Mark {chain:number;last:number;vulnerable:number;}
interface Burn {enemy:Enemy;spawn:number;until:number;next:number;damage:number;spread:boolean;}
/** One bounded proc dispatcher. Generated damage never re-enters onHit. */
export class BuildCombat {
 private marks=new WeakMap<Enemy,Mark&{spawn:number}>();private burns=new Map<number,Burn>();
 private clock=0;private idle=0;private still=0;private heavyAt=0;private focusAt=0;private jadeAt=0;
 private pendingEcho:{x:number;y:number;at:number;damage:number}|null=null;
 private position:()=>{x:number;y:number}=()=>({x:0,y:0});
 setOrigin(origin:()=>{x:number;y:number}):void{this.position=origin;}
 private hits=0;private kills=0;private killUntil=0;private distances={windstep:0,flank:0,horse:0};private moving=false;private procAt=0;private slayerAt=0;
 constructor(private state:BuildState,private nearby:(x:number,y:number,r:number)=>Enemy[],private deal:(e:Enemy,n:number,fire:boolean)=>void,private fx:(e:Enemy,fire:boolean)=>void){}
 charged():boolean{return this.idle>=2000;}
 /** 迂回袭蓄力（表现层 FlankFx 用，只读）：等级与进度 0–1。 */
 flankCharge():{level:number;ratio:number}{const l=this.lv('flank');return{level:l,ratio:l?Math.min(1,this.distances.flank/[200,170,140][l-1]):0};}
 /** 迂回袭触发时通知表现层被波及的敌人（只管画面）。 */
 onFlank?:(targets:Enemy[])=>void;
 /** 踏风步蓄力（表现层 WindstepFx 用，只读）与触发通知（只管画面）。 */
 windstepCharge():{level:number;ratio:number}{const l=this.lv('windstep');return{level:l,ratio:l?Math.min(1,this.distances.windstep/120):0};}
 onWindstep?:(e:Enemy)=>void;
 naturalBurn(e:Enemy,now:number):boolean{const b=this.burns.get(e.spawnId);return !!b&&b.enemy===e&&b.until>=now&&!b.spread;}
 igniteDerived(e:Enemy,damage:number,now:number):void{this.burn(e,damage,now,true);}
 private lv(id:TacticId):number{return this.state.level(id);}
 private has(id:string):boolean{return this.state.treasures.includes(id as never);}
 movement(d:number):void{this.moving=d>.5;this.distances.windstep=Math.min(120,this.distances.windstep+d);this.distances.flank=Math.min(200,this.distances.flank+d);this.distances.horse=Math.min(150,this.distances.horse+d);}
 criticalBonus():number{const n=this.lv('eagle'),m=this.lv('swift');return(this.state.tags().critical>=2?.03:0)+(n?[.03,.05,.07][n-1]:0)+(m&&this.moving?[.03,.05,.07][m-1]:0);}
 damage(e:Enemy,raw:number,crit:boolean,now:number):number{
 const m=this.marks.get(e),valid=m?.spawn===e.spawnId;const tags=this.state.tags();let bonus=(tags.combo>=2?.05:0)+(tags.flame>=2&&this.burns.has(e.spawnId)?.05:0)+(tags.charge>=2&&this.idle>=2000?.1:0);
 if(valid&&now-m.last<1500)bonus+=Math.min(5,m.chain)*.01*(1+this.lv('chain'))*(this.lv('chain')?1:0);
 if(valid&&m.vulnerable>now)bonus+=[0,.06,.09,.12][this.lv('sunder')];
 if(now<this.killUntil)bonus+=this.kills*.01*(2+this.lv('momentum'))*(this.lv('momentum')?1:0);
 if(this.burns.has(e.spawnId))bonus+=[0,.1,.15,.2][this.lv('hotwind')];
 if(crit&&(e.kind==='elite'||e.kind==='boss'))bonus+=[0,.1,.15,.2][this.lv('reap')];
 if(this.lv('windstep')&&this.distances.windstep>=120){bonus+=[0,.1,.15,.2][this.lv('windstep')];this.distances.windstep=0;this.onWindstep?.(e);}
 if(this.idle>=2000)bonus+=[0,.2,.35,.5][this.lv('stored_edge')];
 return raw*(1+Math.min(1.5,bonus));
 }
 private targets(e:Enemy,r:number):Enemy[]{return this.nearby(e.x,e.y,r).filter(t=>t.active&&!t.isSupplySlot&&t!==e&&Math.hypot(t.x-e.x,t.y-e.y)<=r);}
 private burn(e:Enemy,damage:number,now:number,spread=false):void{
 if(!e.active||e.isSupplySlot)return;const old=this.burns.get(e.spawnId);if(!old&&this.burns.size>=160)return;
 this.burns.set(e.spawnId,{enemy:e,spawn:e.spawnId,until:now+2000,next:old?.next??now+500,damage:Math.max(old?.damage??0,damage),spread:old?old.spread&&spread:spread});
 }
 onHit(e:Enemy,raw:number,crit:boolean,now:number):void{
 const charged=this.idle>=2000;this.idle=0;
 if(charged&&this.lv('heavy_break')&&now>=this.heavyAt){this.heavyAt=now+3000;for(const t of this.targets(e,75).slice(0,1+this.lv('heavy_break'))){this.fx(t,false);this.deal(t,raw*[0,.2,.3,.4][this.lv('heavy_break')],false);}}
 if(this.still>=1500&&this.lv('concentration')&&now>=this.focusAt){this.still=0;this.focusAt=now+2000;const origin=this.position(),dx=e.x-origin.x,dy=e.y-origin.y,len=Math.hypot(dx,dy)||1;const targets=this.targets(e,160).filter(t=>{const x=t.x-e.x,y=t.y-e.y,along=(x*dx+y*dy)/len,side=Math.abs(x*dy-y*dx)/len;return along>=0&&along<=160&&side<=18+t.radius;}).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));for(const t of targets.slice(0,this.lv('concentration'))){this.fx(t,false);this.deal(t,raw*[0,.25,.35,.45][this.lv('concentration')],false);}}
 if(charged&&this.has('stored_jade')&&now>=this.jadeAt){this.jadeAt=now+4000;const jr=.15*this.state.power('stored_jade');for(const t of this.targets(e,75).slice(0,3)){this.fx(t,false);this.deal(t,raw*jr,false);}this.pendingEcho={x:e.x,y:e.y,at:now+250,damage:raw*jr};}
 this.hits++;const old=this.marks.get(e);this.marks.set(e,{spawn:e.spawnId,chain:old?.spawn===e.spawnId&&now-old.last<1500?Math.min(5,old.chain+1):1,last:now,vulnerable:crit&&this.lv('sunder')?now+3000:old?.spawn===e.spawnId?old.vulnerable:0});
 if(this.lv('ember')&&Math.random()<[.15,.22,.3][this.lv('ember')-1]||this.has('wildfire_lamp'))this.burn(e,raw*(this.lv('ember')?.1:.06*this.state.power('wildfire_lamp')),now);
 const level=this.lv('pursuit'),pursuit=level&&this.hits%[6,5,4][level-1]===0,bell=this.has('soul_bell')&&this.hits%8===0;
 const flank=this.lv('flank')&&this.distances.flank>=[200,170,140][this.lv('flank')-1],horse=this.has('horse_order')&&this.distances.horse>=150,jade=this.has('breaker_jade')&&this.hits%10===0;
 if(now>=this.procAt&&(pursuit||bell||flank||horse||jade)){
 this.procAt=now+400;const area=flank||horse||jade,ratio=Math.max(pursuit?[.25,.35,.45][level-1]:0,bell?.4*this.state.power('soul_bell'):0,flank?[.35,.45,.55][this.lv('flank')-1]:0,horse?.25*this.state.power('horse_order'):0,jade?.35*this.state.power('breaker_jade'):0);
 if(flank)this.distances.flank=0;if(horse)this.distances.horse=0;
 const targets=this.targets(e,area?70:160);if(flank)this.onFlank?.(targets.slice(0,3));for(let i=0;i<Math.min(area?3:1,targets.length);i++){this.fx(targets[i],false);this.deal(targets[i],raw*ratio,false);}
 }
 if(crit&&this.has('slayer_tally')&&(e.kind==='elite'||e.kind==='boss')&&now>=this.slayerAt&&e.active){this.slayerAt=now+500;this.fx(e,false);this.deal(e,raw*.25*this.state.power('slayer_tally'),false);}
 }
 /** 增益图标的触发进度（只读，供 BuffHud 显示「还差多少」；不改任何触发规则）。id 同 BuffHud 条目 id。 */
 progress(id:string,now:number):BuffProgress|null{
 switch(id){
 case 'tactic_pursuit':{const l=this.lv('pursuit');if(!l)return null;const n=[6,5,4][l-1];return countProgress(this.hits%n,n,'下一击追击');}
 case 'treasure_soul_bell':return countProgress(this.hits%8,8,'下一击追魂');
 case 'treasure_breaker_jade':return countProgress(this.hits%10,10,'下一击震击');
 case 'tactic_windstep':return distanceProgress(this.distances.windstep,120,'下一击增伤');
 case 'tactic_flank':{const l=this.lv('flank');return l?distanceProgress(this.distances.flank,[200,170,140][l-1],'下一击范围追击'):null;}
 case 'treasure_horse_order':return distanceProgress(this.distances.horse,150,'下一击追加伤害');
 case 'tactic_stored_edge':return chargeProgress(this.idle,2000,'下一击增伤');
 case 'tactic_heavy_break':return now<this.heavyAt?timerProgress(this.heavyAt,3000,now,'','冷却'):chargeProgress(this.idle,2000,'下一击冲击');
 case 'treasure_stored_jade':return now<this.jadeAt?timerProgress(this.jadeAt,4000,now,'','冷却'):chargeProgress(this.idle,2000,'下一击释放冲击');
 case 'tactic_concentration':return now<this.focusAt?timerProgress(this.focusAt,2000,now,'','冷却'):chargeProgress(this.still,1500,'下一击贯穿','静止');
 }
 return null;
 }
 onKill(e:Enemy,now:number):void{
 this.kills=Math.min(5,now<this.killUntil?this.kills+1:1);this.killUntil=now+3000;
 const burn=this.burns.get(e.spawnId);this.burns.delete(e.spawnId);
 if(!burn||burn.spread||burn.until<now)return;const count=Math.max(this.lv('spread'),this.has('wildfire_lamp')?2:0);
 const targets=this.targets(e,85);for(let i=0;i<Math.min(count,targets.length);i++)this.burn(targets[i],burn.damage*.4,now,true);
 }
 update(now:number):void{const dt=Math.max(0,Math.min(100,now-this.clock));this.clock=now;this.idle=Math.min(2000,this.idle+dt);this.still=Math.max(0,Math.min(1500,this.still+dt*(this.moving?-2:1)));
 const echo=this.pendingEcho;if(echo&&now>=echo.at){this.pendingEcho=null;for(const t of this.nearby(echo.x,echo.y,75).filter(t=>t.active&&!t.isSupplySlot&&Math.hypot(t.x-echo.x,t.y-echo.y)<=75).slice(0,3)){this.fx(t,false);this.deal(t,echo.damage,false);}}
 for(const [id,b]of this.burns){if(!b.enemy.active||b.enemy.spawnId!==b.spawn||now>b.until){this.burns.delete(id);continue;}if(now>=b.next){b.next=now+500;this.fx(b.enemy,true);this.deal(b.enemy,b.damage,true);}}}
}
