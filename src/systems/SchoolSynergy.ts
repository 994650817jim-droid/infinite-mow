import type Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {BuildCombat} from './BuildCombat';
import {SCHOOLS,SCHOOL_IDS,type SchoolId} from '../data/schools';
import {AWAKEN,COMBOS,COMBO_VALUES as CV,type ComboId} from '../data/schoolCombos';
import {type BuffProgress,timerProgress} from '../ui/BuffProgress';

/** SchoolSynergy 要的场景接口（GameScene 接）。 */
export interface SynergyHost {
 scene:Phaser.Scene; player:Player; combat:BuildCombat;
 nearby(x:number,y:number,r:number):Enemy[];
 deal(e:Enemy,n:number,fire:boolean):void;
 notice(text:string):void;
 controlled(e:Enemy,now:number):boolean;
 slowArea(x:number,y:number,r:number,slow:number,ms:number,now:number):number;
 /** 在 (x,y) 冒出 n 名助战兵，lifeMs 后散去；返回实际出了几个。 */
 escort(x:number,y:number,n:number,lifeMs:number):number;
 /** 表现：style 同 BuildVfx；flame = 手绘火焰；wind = 风刃一阵。 */
 vfx(style:string,x:number,y:number,size:number,angle?:number,ms?:number):void;
 flame(x:number,y:number,r:number):void;
 wind(x:number,y:number,angle:number,size:number):void;
 shake():void;
}
interface Wake{at:number;run:()=>void}
interface Field{x:number;y:number;r:number;until:number;next:number}
interface AwakeState{reachedAt:number;used:number;cdUntil:number}
/**
 * 流派重做第 2 期（2026-11-19）：合击里跟部曲 / 伏兵 / 冲势 / 生命有关的 5 个 + 六派觉醒（数值 data/schoolCombos.ts）。
 * - 合击第一次触发时打横幅「合击 · 名字」（BuildCombat.onCombo / noteCombo 都汇到 note）。
 * - 觉醒：某派到 6 势后，过 firstDelayMs、身边（minRange）有 minEnemies 个敌人时自动放；每派每关最多 perStage 次、间隔 cooldownMs。
 *   每关 = 一个 GameScene 实例（换关重建，次数清零）。
 */
export class SchoolSynergy{
 readonly seen=new Set<string>();
 readonly awake:Partial<Record<SchoolId,AwakeState>>={};
 /** 测试 / 平衡用：各觉醒放了几次、伏兵 / 骑卒出了几个。 */
 readonly stats={awaken:{} as Partial<Record<SchoolId,number>>,hits:{} as Partial<Record<SchoolId,number>>,ambush:0,cavalry:0,leech:0,feint:0};
 /** 觉醒打到的敌人（统计用）。 */
 private hitBy(s:SchoolId,e:Enemy,n:number,fire:boolean):void{this.stats.hits[s]=(this.stats.hits[s]??0)+1;this.h.deal(e,n,fire);}
 private wakes:Wake[]=[];private fields:Field[]=[];private ambushes:number[]=[];private ambushAt=0;
 private guardUntil=0;private allyBoost={from:0,until:0};private frenzyAt=0;private leechWindow={at:0,used:0};private lastAwaken=-1e9;private clock=0;
 constructor(private h:SynergyHost){}
 private combo(id:ComboId):boolean{return this.h.combat.combo(id);}
 /** 合击触发：第一次打横幅。 */
 note(id:ComboId):void{if(this.seen.has(id))return;this.seen.add(id);const c=COMBOS.find(x=>x.id===id);if(c)this.h.notice('合击 · '+c.name+'！'+SCHOOLS[c.a].name+' × '+SCHOOLS[c.b].name);}
 private enemiesNear(x:number,y:number,r:number):Enemy[]{return this.h.nearby(x,y,r).filter(e=>e.active&&!e.isSupplySlot&&e.hp>0&&Math.hypot(e.x-x,e.y-y)<=r);}
 /** r 内敌人最密的一点（以敌人为候选）。 */
 private densest(r:number,range:number=AWAKEN.minRange):{x:number;y:number}{const p=this.h.player,near=this.enemiesNear(p.x,p.y,range);if(!near.length)return{x:p.x,y:p.y};let best=near[0],bn=-1;for(const c of near.slice(0,60)){let n=0;for(const o of near)if(Math.hypot(o.x-c.x,o.y-c.y)<=r)n++;if(n>bn){bn=n;best=c;}}return{x:best.x,y:best.y};}
 private lastStand():boolean{const p=this.h.player;return this.combo('last_stand')&&p.hp>0&&p.hp<p.maxHp*CV.lastStandHp;}

 // ---------- 伤害修正（GameScene.hitEnemy 调） ----------
 /** 敌人受到的伤害倍率：八门金锁阵里加深、背水一战全军 +25%、铁壁军阵之后全军冲杀 ×2。 */
 incoming(e:Enemy,fromAlly:boolean,now:number):number{
  let k=1;for(const f of this.fields)if(now<f.until&&Math.hypot(e.x-f.x,e.y-f.y)<=f.r+e.radius){k*=1+AWAKEN.stratagem.taken;break;}
  if(this.lastStand()){k*=1+CV.lastStandDmg;this.h.combat.noteCombo('last_stand');}
  if(fromAlly&&now>=this.allyBoost.from&&now<this.allyBoost.until)k*=AWAKEN.formation.allyDmgMul;
  return k;
 }
 /** 合击「弩阵」：部曲 / 随行 / 义军也会暴击（主将暴击率 × crossbowLineCritShare）。 */
 allyCrit(playerCrit:number):boolean{if(!this.combo('crossbow_line')||Math.random()>=playerCrit*CV.crossbowLineCritShare)return false;this.h.combat.noteCombo('crossbow_line');return true;}
 /** 合击「背水一战」：武器命中吸血（每秒最多回 lastStandLeechCapPerSec × 最大生命）。 */
 leech(damage:number,now:number):void{if(!this.lastStand())return;const p=this.h.player,w=this.leechWindow;if(now-w.at>=1000){w.at=now;w.used=0;}const cap=p.maxHp*CV.lastStandLeechCapPerSec-w.used;const heal=Math.min(cap,damage*CV.lastStandLeech,p.maxHp-p.hp);if(heal<=0)return;p.hp+=heal;w.used+=heal;this.stats.leech+=heal;}
 /** 部曲受到的伤害倍率（铁壁军阵结阵中减半）。 */
 allyIncoming(now:number):number{return now<this.guardUntil?AWAKEN.formation.guardMul:1;}

 // ---------- 合击回调 ----------
 /** 冲势打出：声东击西（身边减速）、铁骑冲阵（2 名骑卒随冲）。 */
 onCharge(e:Enemy,now:number):void{const p=this.h.player;
  if(this.combo('feint')){const n=this.h.slowArea(p.x,p.y,CV.feintR,CV.feintSlow,CV.feintMs,now);if(n){this.stats.feint+=n;this.h.combat.noteCombo('feint');this.h.vfx('control',p.x,p.y,CV.feintR*2,0,400);}}
  if(this.combo('iron_cavalry')){const n=this.h.escort((p.x+e.x)/2,(p.y+e.y)/2,CV.ironCavalryN,CV.ironCavalryLifeMs);if(n){this.stats.cavalry+=n;this.h.combat.noteCombo('iron_cavalry');}}
 }
 /** 敌人被眩晕：十面埋伏（身边冒 1 名伏兵砍 5 秒，场上最多 6 名）。 */
 onStun(e:Enemy,now:number):void{
  if(!this.combo('ambush_ten')||now<this.ambushAt)return;this.ambushes=this.ambushes.filter(t=>t>now);if(this.ambushes.length>=CV.ambushTenCap)return;
  const a=Math.random()*Math.PI*2,n=this.h.escort(e.x+Math.cos(a)*40,e.y+Math.sin(a)*30,1,CV.ambushTenLifeMs);if(!n)return;
  this.ambushAt=now+CV.ambushTenCdMs;this.ambushes.push(now+CV.ambushTenLifeMs);this.stats.ambush++;this.h.combat.noteCombo('ambush_ten');
 }
 /** 武器命中：猛将觉醒狂斗中每击带一圈小冲击波。 */
 onHit(e:Enemy,raw:number,now:number):void{
  if(now>=this.h.player.growth.frenzyUntil||now<this.frenzyAt)return;this.frenzyAt=now+150;const W=AWAKEN.warrior;this.h.vfx('pure_combo',e.x,e.y-6,W.shockR*2,0,260);
  for(const t of this.enemiesNear(e.x,e.y,W.shockR).slice(0,5)){this.h.deal(t,raw*W.shockRatio,false);if(t!==e)this.h.combat.knock(t,e,18,now);}
 }

 // ---------- 觉醒 ----------
 /** 觉醒能不能放 / 还要等多久（BuffHud 的「awakening_<派>」条目）。 */
 progress(id:string,now:number):BuffProgress|null{
  if(!id.startsWith('awakening_'))return null;const s=id.slice(10) as SchoolId,st=this.awake[s];if(!st)return null;
  const left=AWAKEN.perStage-st.used;
  if(left<=0)return{cur:0,max:1,seg:0,ready:false,text:'本关觉醒已用完（'+AWAKEN.perStage+'/'+AWAKEN.perStage+'）'};
  const at=Math.max(st.cdUntil,st.reachedAt+AWAKEN.firstDelayMs);
  if(now<at)return timerProgress(at,st.used?AWAKEN.cooldownMs:AWAKEN.firstDelayMs,now,'','本关还剩 '+left+' 次 · 冷却');
  return{cur:1,max:1,seg:0,ready:true,text:'就绪：身边敌人聚多了自动释放（本关还剩 '+left+' 次）'};
 }
 /** 测试 / 开发：立即放某派觉醒（不看次数、冷却、敌人数）。 */
 force(s:SchoolId,now:number=this.clock):void{this.fire(s,now);}
 private fire(s:SchoolId,now:number):void{
  const st=this.awake[s]??(this.awake[s]={reachedAt:now,used:0,cdUntil:0});st.used++;st.cdUntil=now+AWAKEN.cooldownMs;this.lastAwaken=now;this.stats.awaken[s]=(this.stats.awaken[s]??0)+1;
  this.h.notice('觉醒 · '+SCHOOLS[s].tiers[6].name+'！');this.h.shake();
  const raw=this.h.combat.rawBase(),p=this.h.player,cam=this.h.scene.cameras.main.worldView;
  switch(s){
  case 'fire':{const F=AWAKEN.fire,w=cam.width/F.columns,dir=Math.random()<.5?1:-1;this.h.combat.burnBoost={until:now+F.takenMs,mul:F.takenMul};
   for(let i=0;i<F.columns;i++){const col=dir>0?i:F.columns-1-i,x=cam.x+(col+.5)*w;this.wakes.push({at:now+i*F.sweepMs/F.columns,run:()=>{
    for(let k=0;k<4;k++)this.h.flame(x+(Math.random()-.5)*w*.5,cam.y+(k+.5)*cam.height/4,w*.6);
    for(const e of this.h.nearby(x,cam.centerY,Math.max(w,cam.height))){if(!e.active||e.isSupplySlot||Math.abs(e.x-x)>w/2+e.radius||e.y<cam.y-20||e.y>cam.bottom+20)continue;
     const k=e.kind==='boss'?.35:e.kind==='elite'?.6:1;this.hitBy('fire',e,raw*F.ratio*k,true);this.h.combat.igniteDerived(e,raw*.15,this.clock,F.burnMs);}}});}
   break;}
  case 'stratagem':{const S=AWAKEN.stratagem,c=this.densest(S.r);if(this.fields.length>=2)this.fields.shift();this.fields.push({x:c.x,y:c.y,r:S.r,until:now+S.ms,next:now});this.h.vfx('iron_army',c.x,c.y,S.r*1.6,0,600);break;}
  case 'archery':{const A=AWAKEN.archery,c=this.densest(A.r);
   for(let i=0;i<A.waves;i++)this.wakes.push({at:now+i*A.waveMs,run:()=>{
    for(let k=0;k<7;k++){const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*A.r;this.h.vfx('critical',c.x+Math.cos(a)*d,c.y+Math.sin(a)*d*.8,60,0,320);}
    this.h.vfx('peerless',c.x,c.y,A.r*1.6,0,420);
    for(const e of this.enemiesNear(c.x,c.y,A.r)){this.hitBy('archery',e,raw*A.ratio*(e.kind==='boss'?.4:1),false);this.h.combat.vulnerable(e,A.sunder,this.clock);}}});
   break;}
  case 'cavalry':{const C=AWAKEN.cavalry,c=this.densest(C.width,C.len*.8),ang=Math.atan2(c.y-p.y,c.x-p.x)||0,ux=Math.cos(ang),uy=Math.sin(ang);p.invulnUntil=Math.max(p.invulnUntil,now+C.invulnMs);
   for(let i=0;i<6;i++)this.wakes.push({at:now+i*70,run:()=>{const d=C.len*(i+.5)/6;this.h.wind(p.x+ux*d,p.y+uy*d-12,ang,110);this.h.vfx('roaming_break',p.x+ux*d,p.y+uy*d-8,120,ang,320);}});
   for(const e of this.enemiesNear(p.x,p.y,C.len)){const x=e.x-p.x,y=e.y-p.y,along=x*ux+y*uy,side=Math.abs(x*uy-y*ux);if(along<-20||along>C.len||side>C.width/2+e.radius)continue;
    this.wakes.push({at:now+Math.max(0,along)/C.len*420,run:()=>{if(!e.active)return;this.hitBy('cavalry',e,raw*C.ratio*(e.kind==='boss'?.4:1),false);this.h.combat.knock(e,{x:e.x-ux,y:e.y-uy},C.push,this.clock,ang);}});}
   break;}
  case 'warrior':{const W=AWAKEN.warrior,g=p.growth;g.frenzyUntil=now+W.ms;g.frenzyHaste=W.haste;this.h.vfx('pure_combo',p.x,p.y-10,150,0,600);break;}
  case 'formation':{const F=AWAKEN.formation;this.guardUntil=now+F.guardMs;this.allyBoost={from:now+F.guardMs,until:now+F.guardMs+F.allyDmgMs};p.invulnUntil=Math.max(p.invulnUntil,now+1000);
   this.h.escort(p.x,p.y+40,F.soldiers,F.lifeMs);this.h.vfx('iron_army',p.x,p.y-8,180,0,700);break;}
  }
 }
 update(now:number):void{this.clock=now;
  const tags=this.h.player.growth.build.tags();
  for(const s of SCHOOL_IDS){if(tags[s]<6)continue;const st=this.awake[s]??(this.awake[s]={reachedAt:now,used:0,cdUntil:0});
   if(st.used>=AWAKEN.perStage||now<st.cdUntil||now<st.reachedAt+AWAKEN.firstDelayMs||now-this.lastAwaken<3000)continue;
   const p=this.h.player;if(this.enemiesNear(p.x,p.y,AWAKEN.minRange).length<AWAKEN.minEnemies)continue;this.fire(s,now);break;}
  if(this.wakes.length){const due=this.wakes.filter(w=>now>=w.at);this.wakes=this.wakes.filter(w=>now<w.at);for(const w of due)w.run();}
  const S=AWAKEN.stratagem;for(let i=this.fields.length-1;i>=0;i--){const f=this.fields[i];if(now>=f.until){this.fields.splice(i,1);continue;}if(now<f.next)continue;f.next=now+S.tickMs;
   this.h.vfx('pure_control',f.x,f.y,f.r*2,0,S.tickMs);for(const e of this.enemiesNear(f.x,f.y,f.r)){this.h.combat.stun(e,S.stunMs,now);this.stats.hits.stratagem=(this.stats.hits.stratagem??0)+1;}}
 }
 clear():void{this.wakes=[];this.fields=[];this.ambushes=[];this.guardUntil=0;this.allyBoost={from:0,until:0};}
}
