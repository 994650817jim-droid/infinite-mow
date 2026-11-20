import type {Enemy} from '../entities/Enemy';
import type {BuildState,TacticId} from '../data/builds';
import {SCHOOL_TIER as T} from '../data/schools';
import {activeCombos,COMBO_VALUES as CV,type ComboId} from '../data/schoolCombos';
import {type BuffProgress,countProgress,distanceProgress,chargeProgress,timerProgress} from '../ui/BuffProgress';
interface Mark {chain:number;last:number;vulnerable:number;vulnAmt:number;}
interface Burn {enemy:Enemy;spawn:number;until:number;next:number;damage:number;spread:boolean;}
/**
 * 战法 / 流派档位 / 合击的命中派发（2026-11-19 流派重做，数值在 data/schools.ts SCHOOL_TIER、data/schoolCombos.ts COMBO_VALUES）。
 * 只吃本命武器的原始命中；派生伤害（追击、震荡、火油、灼烧、爆燃）不再进 onHit（不会连锁）。
 * - 冲势（骑突）：主动移动攒槽（满 = SCHOOL_TIER.chargeFull ≈ 6 个身位；骑突 2 势攒得快 50%），被「蓄势冲锋」/ 骑突 4 势「冲阵」/ 沉锋玉打出后清空。
 * - 连击层（猛将）：连打同一敌人叠层；连环每层 +2/3/4%（最多 5 层），猛将 2 势「鏖战」每层至少 +2%、上限 8 层。
 * - 破甲（弓弩）：断金 / 弓弩 4 势暴击打上，受到的伤害 +x%（3 秒）。
 * - 合击（两派都到 2 势）：这里管跟命中 / 灼烧 / 冲势有关的 10 个；部曲、伏兵、背水一战等在 SchoolSynergy。
 */
export class BuildCombat {
 private marks=new WeakMap<Enemy,Mark&{spawn:number}>();private burns=new Map<number,Burn>();
 private clock=0;private still=0;private focusAt=0;private jadeAt=0;private napalmAt=0;private gustAt=0;private hoofAt=0;private lastRaw=0;
 private pendingEcho:{x:number;y:number;at:number;damage:number}|null=null;
 private position:()=>{x:number;y:number}=()=>({x:0,y:0});
 setOrigin(origin:()=>{x:number;y:number}):void{this.position=origin;}
 private hits=0;private kills=0;private killUntil=0;private distances={windstep:0,flank:0,horse:0,charge:0};private moving=false;private procAt=0;private slayerAt=0;private shockHits=0;private shockAt=-1e9;
 /** 测试 / 平衡用：各档位效果触发次数。 */
 readonly stats={burnTicks:0,liaoyuan:0,charge:0,shock:0,heavy:0,sunder:0,napalm:0,gust:0,focus:0};
 /** 测试 / 平衡用：各合击触发次数。 */
 readonly comboStats:Record<string,number>={};
 /** 觉醒「火烧连天」之后一段时间灼烧更痛：截止时刻与倍率（SchoolSynergy 设）。 */
 burnBoost={until:0,mul:1,bossMul:1};
 constructor(private state:BuildState,private nearby:(x:number,y:number,r:number)=>Enemy[],private deal:(e:Enemy,n:number,fire:boolean)=>void,private fx:(e:Enemy,fire:boolean)=>void){}
 /** 奇谋 2 势「牵制」：被控制的敌人受伤加深（GameScene 接 ControlBuild.isControlled）。 */
 controlled?:(e:Enemy,now:number)=>boolean;
 /** 表现层回调（只管画面）：震荡 / 冲阵一圈、火油罐落点、疾风一阵、燎原爆火。 */
 onShock?:(x:number,y:number,r:number)=>void;
 /** 手绘特效钩子（GameScene 接 BuildVfx）：style = 图集里的额外样式 ember / stun_burst / sunder_hit / heavy。 */
 onFx?:(style:string,x:number,y:number,size:number)=>void;
 onNapalm?:(x:number,y:number,r:number,tickDamage:number,level:number)=>void;
 onGust?:(x:number,y:number,angle:number,len:number)=>void;
 /** 合击「烈马」：脚下一小团火（GameScene 用 MartialFields 画火、扣血）。 */
 onFirePatch?:(x:number,y:number,r:number,tickDamage:number,ms:number)=>void;
 /** 冲势打出（声东击西 / 铁骑冲阵在 SchoolSynergy 接）。 */
 onCharge?:(e:Enemy,now:number)=>void;
 /** 这里眩晕了一个敌人（十面埋伏在 SchoolSynergy 接）。 */
 onStun?:(e:Enemy,now:number)=>void;
 /** 合击触发一次（第一次打横幅）。 */
 onCombo?:(id:ComboId)=>void;
 /** 疾风吹到的敌人（风状态，火借风势用）：enemy.uid → 截止时刻。 */
 readonly windUntil=new Map<number,number>();
 private winds=new Map<Enemy,{spawn:number;until:number;next:number}>();
 private combos=new Set<string>();private comboStamp=-1;
 private lv(id:TacticId):number{return this.state.level(id);}
 private has(id:string):boolean{return this.state.treasures.includes(id as never);}
 private tier(s:'fire'|'stratagem'|'archery'|'cavalry'|'warrior'|'formation'):number{return this.state.tier(s);}
 /** 合击生效没有（两派都到 COMBO_AT 势）；每帧刷新一次，测试改了构筑后也会在下一次查询时刷新。 */
 combo(id:ComboId):boolean{if(this.comboStamp!==this.clock){this.comboStamp=this.clock;this.combos=new Set(activeCombos(this.state.tags()).map(c=>c.id));}return this.combos.has(id);}
 /** 记一次合击触发（统计 + 首次横幅）。 */
 noteCombo(id:ComboId):void{this.comboStats[id]=(this.comboStats[id]??0)+1;this.onCombo?.(id);}
 /** 冲势满了没有（骑突）。 */
 charged():boolean{return this.distances.charge>=T.chargeFull;}
 chargeRatio():number{return Math.min(1,this.distances.charge/T.chargeFull);}
 isMoving():boolean{return this.moving;}
 /** 觉醒伤害的基数：最近一次武器原始命中。 */
 rawBase():number{return Math.max(8,this.lastRaw);}
 /** 迂回袭蓄力（表现层 FlankFx 用，只读）：等级与进度 0–1。 */
 flankCharge():{level:number;ratio:number}{const l=this.lv('flank');return{level:l,ratio:l?Math.min(1,this.distances.flank/[200,170,140][l-1]):0};}
 onFlank?:(targets:Enemy[])=>void;
 /** 踏风步蓄力（表现层 WindstepFx 用，只读）与触发通知（只管画面）。 */
 windstepCharge():{level:number;ratio:number}{const l=this.lv('windstep');return{level:l,ratio:l?Math.min(1,this.distances.windstep/120):0};}
 onWindstep?:(e:Enemy)=>void;
 naturalBurn(e:Enemy,now:number):boolean{const b=this.burns.get(e.spawnId);return !!b&&b.enemy===e&&b.until>=now&&!b.spread;}
 /** 破甲（断金 / 弓弩 4 势暴击打上的易伤）还在不在：StatusFx 画标记用。 */
 isSundered(e:Enemy,now:number):boolean{const m=this.marks.get(e);return !!m&&m.spawn===e.spawnId&&m.vulnerable>now;}
 isBurning(e:Enemy,now:number):boolean{const b=this.burns.get(e.spawnId);return !!b&&b.enemy===e&&b.until>=now;}
 igniteDerived(e:Enemy,damage:number,now:number,ms?:number):void{this.burn(e,damage,now,true,ms);}
 movement(d:number):void{
  this.moving=d>.5;const gain=d*(this.tier('cavalry')>=2?T.cavalry.chargeGain:1);
  this.distances.windstep=Math.min(120,this.distances.windstep+gain);this.distances.flank=Math.min(200,this.distances.flank+gain);this.distances.horse=Math.min(150,this.distances.horse+gain);
  this.distances.charge=Math.min(T.chargeFull,this.distances.charge+gain);
 }
 /** 暴击率加成；带上敌人时再算合击「伏弩」（打被控制的）与「骑射」（移动中）。 */
 criticalBonus(e?:Enemy,now=this.clock):number{const n=this.lv('eagle'),m=this.lv('swift');let c=(this.tier('archery')>=2?T.archery.crit:0)+(n?[.05,.08,.12][n-1]:0)+(m&&this.moving?[.03,.05,.07][m-1]:0);
  if(e&&this.combo('ambush_bolt')&&this.controlled?.(e,now)){c+=CV.ambushCrit;this.noteCombo('ambush_bolt');}if(e&&this.moving&&this.combo('horse_archer')){c+=CV.horseArcherCrit;this.noteCombo('horse_archer');}return c;}
 /** 弓弩 2 势「神射」：暴击伤害额外倍率（GameScene 暴击时乘上）。 */
 critDamageBonus():number{return this.tier('archery')>=2?T.archery.critDmg:0;}
 /** 连击层：每层加成与上限（连环 / 猛将 2 势；合击「破甲连击」打破甲的敌人上限再 +3）。 */
 private stack(m?:Mark,now=this.clock):{per:number;cap:number}{const c=this.lv('chain'),w=this.tier('warrior')>=2;const pierce=m&&m.vulnerable>now&&this.combo('pierce_combo')?CV.pierceComboCap:0;return{per:Math.max(c?[.02,.03,.04][c-1]:0,w?T.warrior.stackPct:0),cap:(w?T.warrior.stackCap:5)+pierce};}
 /** 这一击会不会打出冲势（damage 在 onHit 之前算）。 */
 private releases(now:number):boolean{return this.charged()&&(this.lv('stored_edge')>0||this.tier('cavalry')>=4||(this.has('stored_jade')&&now>=this.jadeAt));}
 damage(e:Enemy,raw:number,crit:boolean,now:number):number{
  const m=this.marks.get(e),valid=m?.spawn===e.spawnId;let bonus=0;
  if(valid){const st=this.stack(m,now);if(now-m.last<1500&&st.per)bonus+=Math.min(st.cap,m.chain)*st.per;}
  if(valid&&m.vulnerable>now)bonus+=m.vulnAmt;
  if(now<this.killUntil&&this.lv('momentum'))bonus+=this.kills*[.04,.06,.08][this.lv('momentum')-1];
  const burning=this.isBurning(e,now);
  if(burning)bonus+=[0,.15,.22,.3][this.lv('hotwind')];
  if(burning&&this.combo('fire_arrow'))bonus+=CV.fireArrowBonus;
  if(crit&&(e.kind==='elite'||e.kind==='boss'))bonus+=[0,.1,.15,.2][this.lv('reap')];
  if(this.lv('windstep')&&this.distances.windstep>=120){bonus+=[0,.1,.15,.2][this.lv('windstep')];this.distances.windstep=0;this.onWindstep?.(e);}
  if(this.charged()&&this.lv('stored_edge'))bonus+=[0,.3,.45,.6][this.lv('stored_edge')];
  if((e.kind==='elite'||e.kind==='boss')&&this.combo('take_general')&&this.releases(now)){bonus+=CV.takeGeneral;this.noteCombo('take_general');}
  if(this.tier('stratagem')>=2&&this.controlled?.(e,now))bonus+=T.stratagem.controlledTaken;
  return raw*(1+Math.min(1.5,bonus));
 }
 private targets(e:{x:number;y:number},r:number,except?:Enemy):Enemy[]{return this.nearby(e.x,e.y,r).filter(t=>t.active&&!t.isSupplySlot&&t!==except&&Math.hypot(t.x-e.x,t.y-e.y)<=r);}
 private burnMs():number{return 3000+(this.tier('fire')>=2?T.fire.burnExtraMs:0);}
 private burn(e:Enemy,damage:number,now:number,spread=false,ms=this.burnMs()):void{
  if(!e.active||e.isSupplySlot)return;const old=this.burns.get(e.spawnId);if(!old&&this.burns.size>=160)return;if(!old)this.onFx?.('ember',e.x,e.y-6,56);
  this.burns.set(e.spawnId,{enemy:e,spawn:e.spawnId,until:Math.max(old?.until??0,now+ms),next:old?.next??now+500,damage:Math.max(old?.damage??0,damage),spread:old?old.spread&&spread:spread});
 }
 /** 震退（不对首领、免控、城头的）：0.25 秒滑开 push 像素（不瞬移），update 里逐帧推。 */
 private shoves=new Map<Enemy,{spawn:number;vx:number;vy:number;until:number}>();
 knock(t:Enemy,from:{x:number;y:number},push:number,now:number,ang=Math.atan2(t.y-from.y,t.x-from.x)):void{
  if(t.kind==='boss'||t.controlImmune||t.def.behavior==='wall'||!t.active||(!this.shoves.has(t)&&this.shoves.size>=80))return;
  const v=2*push/.25;this.shoves.set(t,{spawn:t.spawnId,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,until:now+250});t.hitRecoil(now,ang,0,180);
 }
 stun(t:Enemy,ms:number,now:number):void{if(t.kind==='boss'||t.controlImmune||t.def.behavior==='wall'||!t.active)return;t.stunUntil=Math.max(t.stunUntil,now+ms);this.onFx?.('stun_burst',t.x,t.y-8,64);this.onStun?.(t,now);}
 /** 破甲：受到的伤害 +amt（3 秒）；没被主将打过的敌人也能挂上（觉醒「万箭齐发」）。 */
 vulnerable(e:Enemy,amt:number,now:number,ms:number=T.archery.sunderMs):void{let m=this.marks.get(e);if(!m||m.spawn!==e.spawnId){m={spawn:e.spawnId,chain:0,last:0,vulnerable:0,vulnAmt:0};this.marks.set(e,m);}if(m.vulnerable<=now)this.onFx?.('sunder_hit',e.x,e.y-8,64);if(amt>=m.vulnAmt||m.vulnerable<=now)m.vulnAmt=amt;m.vulnerable=Math.max(m.vulnerable,now+ms);this.stats.sunder++;}
 /** 合击「爆燃」：震荡 / 重击打到燃烧的敌人，炸开再受一次伤并点燃身边的人。 */
 private burst(t:Enemy,raw:number,now:number,hot:boolean):void{
  if(!hot||!this.combo('fire_burst'))return;this.noteCombo('fire_burst');this.onShock?.(t.x,t.y,CV.burstR*.8);
  if(t.active){this.fx(t,true);this.deal(t,raw*CV.burstRatio,true);}for(const o of this.targets(t,CV.burstR,t).slice(0,CV.burstTargets)){this.fx(o,true);this.burn(o,raw*.1,now,true);}
 }
 onHit(e:Enemy,raw:number,crit:boolean,now:number):void{
  this.lastRaw=raw;this.hits++;
  const old=this.marks.get(e),same=old?.spawn===e.spawnId,keep=same&&now-old.last<1500;
  // 合击「乘乱」：打被控制的敌人连击层一次叠 2 层
  const chaos=this.combo('chaos_strike')&&!!this.controlled?.(e,now),step=chaos?CV.chaosStacks:1;if(chaos&&this.lv('chain')+this.tier('warrior')>0)this.noteCombo('chaos_strike');
  const base={spawn:e.spawnId,chain:0,last:now,vulnerable:same?old.vulnerable:0,vulnAmt:same?old.vulnAmt:0};base.chain=Math.min(this.stack(base,now).cap,(keep?old.chain:0)+step);this.marks.set(e,base);if(base.vulnerable>now&&base.chain>this.stack(undefined,now).cap&&this.combo('pierce_combo'))this.noteCombo('pierce_combo');
  // 冲势：蓄势冲锋 / 骑突 4 势冲阵 / 沉锋玉
  if(this.charged()){
   const edge=this.lv('stored_edge'),ring=this.tier('cavalry')>=4,jade=this.has('stored_jade')&&now>=this.jadeAt;
   if(edge||ring||jade){this.distances.charge=0;this.stats.charge++;
    if(edge)this.knock(e,this.position(),40,now);
    if(ring){const C=T.cavalry;this.onShock?.(e.x,e.y,C.ringR);for(const t of this.targets(e,C.ringR,e).slice(0,C.targets)){this.fx(t,false);this.deal(t,raw*C.splash,false);this.knock(t,e,C.push,now);}}
    if(jade){this.jadeAt=now+4000;const jr=.15*this.state.power('stored_jade');for(const t of this.targets(e,75,e).slice(0,3)){this.fx(t,false);this.deal(t,raw*jr,false);}this.pendingEcho={x:e.x,y:e.y,at:now+250,damage:raw*jr};this.onFx?.('charge',e.x,e.y,96);}
    this.onCharge?.(e,now);
   }
  }
  // 破阵重击：每 8/7/6 次命中一次重击（震伤 + 震退）
  const hb=this.lv('heavy_break');if(hb&&this.hits%[8,7,6][hb-1]===0){this.stats.heavy++;this.onFx?.('heavy',e.x,e.y,120);for(const t of this.targets(e,80,e).slice(0,1+hb)){const hot=this.isBurning(t,now);this.fx(t,false);this.deal(t,raw*[.3,.4,.5][hb-1],false);this.knock(t,e,30,now);this.burst(t,raw,now,hot);}}
  // 猛将 4 势「震荡」：每第 6 次命中一圈冲击波（眩晕 + 震退）
  if(this.tier('warrior')>=4&&++this.shockHits>=T.warrior.every&&now-this.shockAt>=T.warrior.minGapMs){this.shockHits=0;this.shockAt=now;this.stats.shock++;const W=T.warrior;this.onShock?.(e.x,e.y,W.r);for(const t of this.targets(e,W.r).slice(0,W.targets)){const hot=this.isBurning(t,now);if(t!==e)this.fx(t,false);this.deal(t,raw*W.ratio,false);this.stun(t,W.stunMs,now);if(t!==e)this.knock(t,e,W.push,now);this.burst(t,raw,now,hot);}}
  // 凝神：站定 1 秒（或每 2.5 秒）下一击沿攻击方向贯穿
  const cc=this.lv('concentration');if(cc&&(this.still>=1000||now-this.focusAt>=2500)&&now-this.focusAt>=800){this.still=0;this.focusAt=now;this.stats.focus++;const origin=this.position(),dx=e.x-origin.x,dy=e.y-origin.y,len=Math.hypot(dx,dy)||1;
   const line=this.targets(e,160,e).filter(t=>{const x=t.x-e.x,y=t.y-e.y,along=(x*dx+y*dy)/len,side=Math.abs(x*dy-y*dx)/len;return along>=0&&along<=160&&side<=18+t.radius;}).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y));
   for(const t of line.slice(0,cc)){this.fx(t,false);this.deal(t,raw*[.25,.35,.45][cc-1],false);}}
  // 断金 / 弓弩 4 势：暴击破甲；弓弩 4 势再溅射旁边 1 人
  if(crit){const s=this.lv('sunder'),a4=this.tier('archery')>=4;if(s||a4)this.vulnerable(e,Math.max(s?[.08,.12,.15][s-1]:0,a4?T.archery.sunder:0),now);
   if(a4){const t=this.targets(e,T.archery.splashR,e)[0];if(t){this.fx(t,false);this.deal(t,raw*T.archery.splashRatio,false);}}
   // 合击「火箭」：暴击点燃
   if(this.combo('fire_arrow')){this.burn(e,raw*.1,now);this.noteCombo('fire_arrow');}}
  // 火种 / 燎原灯：点燃
  const em=this.lv('ember');if(em&&Math.random()<[.2,.3,.4][em-1]||this.has('wildfire_lamp'))this.burn(e,raw*(em?.1:.06*this.state.power('wildfire_lamp')),now);
  const level=this.lv('pursuit'),pursuit=level&&this.hits%[6,5,4][level-1]===0,bell=this.has('soul_bell')&&this.hits%8===0;
  const flank=this.lv('flank')&&this.distances.flank>=[200,170,140][this.lv('flank')-1],horse=this.has('horse_order')&&this.distances.horse>=150,jade=this.has('breaker_jade')&&this.hits%10===0;
  if(now>=this.procAt&&(pursuit||bell||flank||horse||jade)){
   this.procAt=now+400;if(bell)this.onFx?.('sunder_hit',e.x,e.y,84);if(horse)this.onFx?.('skirmish',e.x,e.y,90);if(jade)this.onFx?.('heavy',e.x,e.y,100);const area=flank||horse||jade,ratio=Math.max(pursuit?[.25,.35,.45][level-1]:0,bell?.4*this.state.power('soul_bell'):0,flank?[.35,.45,.55][this.lv('flank')-1]:0,horse?.25*this.state.power('horse_order'):0,jade?.35*this.state.power('breaker_jade'):0);
   if(flank)this.distances.flank=0;if(horse)this.distances.horse=0;
   const targets=this.targets(e,area?70:160,e);if(flank)this.onFlank?.(targets.slice(0,3));for(let i=0;i<Math.min(area?3:1,targets.length);i++){this.fx(targets[i],false);this.deal(targets[i],raw*ratio,false);}
  }
  if(crit&&this.has('slayer_tally')&&(e.kind==='elite'||e.kind==='boss')&&now>=this.slayerAt&&e.active){this.slayerAt=now+500;this.onFx?.('peerless',e.x,e.y,110);this.fx(e,false);this.deal(e,raw*.25*this.state.power('slayer_tally'),false);}
 }
 /** 合击「火牛阵」：部曲 / 随行 / 义军的攻击有概率点燃（GameScene 的 fromAlly 命中调这里）。 */
 allyHit(e:Enemy,now:number):void{if(!e.active||!this.combo('fire_ox')||Math.random()>=CV.fireOxChance)return;this.burn(e,this.rawBase()*.08,now,true);this.noteCombo('fire_ox');}
 /** 增益图标的触发进度（只读，供 BuffHud 显示「还差多少」；不改任何触发规则）。id 同 BuffHud 条目 id。 */
 progress(id:string,now:number):BuffProgress|null{
  switch(id){
  case 'tactic_pursuit':{const l=this.lv('pursuit');if(!l)return null;const n=[6,5,4][l-1];return countProgress(this.hits%n,n,'下一击追击');}
  case 'treasure_soul_bell':return countProgress(this.hits%8,8,'下一击追魂');
  case 'treasure_breaker_jade':return countProgress(this.hits%10,10,'下一击震击');
  case 'tactic_windstep':return distanceProgress(this.distances.windstep,120,'下一击增伤');
  case 'tactic_flank':{const l=this.lv('flank');return l?distanceProgress(this.distances.flank,[200,170,140][l-1],'下一击范围追击'):null;}
  case 'treasure_horse_order':return distanceProgress(this.distances.horse,150,'下一击追加伤害');
  case 'tactic_stored_edge':return distanceProgress(this.distances.charge,T.chargeFull,'冲势已满 · 下一击增伤');
  case 'tactic_heavy_break':{const l=this.lv('heavy_break');if(!l)return null;const n=[8,7,6][l-1];return countProgress(this.hits%n,n,'下一击重击');}
  case 'treasure_stored_jade':return now<this.jadeAt?timerProgress(this.jadeAt,4000,now,'','冷却'):distanceProgress(this.distances.charge,T.chargeFull,'下一击释放冲击');
  case 'tactic_concentration':return chargeProgress(Math.max(this.still,(now-this.focusAt)*.4),1000,'下一击贯穿','静止');
  case 'tactic_napalm':{const l=this.lv('napalm');return l?timerProgress(this.napalmAt,[9000,8000,7000][l-1],now,'','下次'):null;}
  case 'tactic_gust':{const l=this.lv('gust');return l?timerProgress(this.gustAt,[10000,9000,8000][l-1],now,'','下次'):null;}
  case 'combo_fire_hoof':return this.moving?timerProgress(this.hoofAt,CV.hoofEveryMs,now,'跑动中留火'):{cur:0,max:1,seg:0,ready:false,text:'跑起来才留火'};
  }
  return null;
 }
 onKill(e:Enemy,now:number):void{
  this.kills=Math.min(5,now<this.killUntil?this.kills+1:1);this.killUntil=now+3000;
  const burn=this.burns.get(e.spawnId);this.burns.delete(e.spawnId);this.windUntil.delete(e.uid);this.winds.delete(e);
  if(!burn||burn.spread||burn.until<now)return;
  // 蔓延 / 燎原灯 / 火攻 4 势「燎原」：传出去的火不会再传
  const f4=this.tier('fire')>=4,count=Math.max(this.lv('spread'),this.has('wildfire_lamp')?2:0,f4?T.fire.liaoyuanTargets:0);
  if(f4){this.stats.liaoyuan++;this.onShock?.(e.x,e.y,T.fire.liaoyuanR*.7);}
  const targets=this.targets(e,f4?T.fire.liaoyuanR:85,e);for(let i=0;i<Math.min(count,targets.length);i++){if(f4)this.fx(targets[i],true);this.burn(targets[i],burn.damage*(f4?Math.max(.4,T.fire.liaoyuanRatio):.4),now,true);}
 }
 update(now:number):void{const dt=Math.max(0,Math.min(100,now-this.clock));this.clock=now;this.still=Math.max(0,Math.min(1500,this.still+dt*(this.moving?-2:1)));
  const echo=this.pendingEcho;if(echo&&now>=echo.at){this.pendingEcho=null;for(const t of this.targets(echo,75).slice(0,3)){this.fx(t,false);this.deal(t,echo.damage,false);}}
  const boosted=now<this.burnBoost.until,fireMul=(1+(this.tier('fire')>=2?T.fire.fireDmg:0))*(boosted?this.burnBoost.mul:1),windFire=this.combo('fire_wind');
  for(const [id,b]of this.burns){if(!b.enemy.active||b.enemy.spawnId!==b.spawn||now>b.until){this.burns.delete(id);continue;}if(now>=b.next){b.next=now+500;this.stats.burnTicks++;
   // 合击「火借风势」：被控制的燃烧敌人灼烧 ×2
   const ctl=windFire&&!!this.controlled?.(b.enemy,now);if(ctl)this.noteCombo('fire_wind');
   this.fx(b.enemy,true);this.deal(b.enemy,b.damage*fireMul*(boosted&&b.enemy.kind==='boss'?this.burnBoost.bossMul/this.burnBoost.mul:1)*(ctl?CV.fireWindBurnMul:1),true);}}
  for(const [id,t] of this.windUntil)if(t<now)this.windUntil.delete(id);
  // 合击「火借风势」：被风吹开的燃烧敌人一路点着撞到的人
  for(const [e,w] of this.winds){if(!e.active||e.spawnId!==w.spawn||now>w.until){this.winds.delete(e);continue;}if(!windFire||now<w.next||!this.isBurning(e,now))continue;w.next=now+200;
   const src=this.burns.get(e.spawnId);let lit=0;for(const o of this.targets(e,CV.fireWindIgniteR,e).slice(0,3))if(!this.isBurning(o,now)){this.fx(o,true);this.burn(o,(src?.damage??this.rawBase()*.1)*.7,now,true);lit++;}if(lit)this.noteCombo('fire_wind');}
  for(const [e,v] of this.shoves){if(!e.active||e.spawnId!==v.spawn||now>=v.until){this.shoves.delete(e);continue;}const k=(v.until-now)/250,sec=dt/1000;e.sprite.x+=v.vx*k*sec;e.sprite.y+=v.vy*k*sec;}
  const raw=this.rawBase(),pos=this.position();
  // 火油罐：每 9/8/7 秒往身边敌人最密处扔（320 内），地上烧 3 秒（GameScene 用 MartialFields 画火、扣血），落点内的人先点燃
  const np=this.lv('napalm');if(np&&now>=this.napalmAt){const near=this.targets(pos,320);if(near.length){this.napalmAt=now+[9000,8000,7000][np-1];this.stats.napalm++;
   let best=near[0],bn=-1;for(const c of near.slice(0,40)){let n=0;for(const o of near)if(Math.hypot(o.x-c.x,o.y-c.y)<=70)n++;if(n>bn){bn=n;best=c;}}
   this.onNapalm?.(best.x,best.y,70,raw*.25*fireMul,np);for(const t of this.targets(best,70))this.burn(t,raw*.1,now,true);}}
  // 疾风：每 10/9/8 秒朝最近的敌人方向吹一阵风，一条线（长 280、宽 70）上的普通敌人被推开
  const gs=this.lv('gust');if(gs&&now>=this.gustAt){const near=this.targets(pos,280);if(near.length){this.gustAt=now+[10000,9000,8000][gs-1];this.stats.gust++;
   const tgt=near.sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y))[0],ang=Math.atan2(tgt.y-pos.y,tgt.x-pos.x),ux=Math.cos(ang),uy=Math.sin(ang),len=280,push=[80,100,120][gs-1];
   this.onGust?.(pos.x,pos.y,ang,len);
   for(const t of near){const x=t.x-pos.x,y=t.y-pos.y,along=x*ux+y*uy,side=Math.abs(x*uy-y*ux);if(along<0||along>len||side>35+t.radius||t.kind==='boss'||t.controlImmune)continue;this.knock(t,pos,push,now,ang);this.windUntil.set(t.uid,now+1200);this.winds.set(t,{spawn:t.spawnId,until:now+1200,next:now});}}}
  // 合击「烈马」：跑动时每 0.7 秒脚下留一小团火
  if(this.moving&&now>=this.hoofAt&&this.combo('fire_hoof')){this.hoofAt=now+CV.hoofEveryMs;this.onFirePatch?.(pos.x,pos.y+6,CV.hoofR,raw*CV.hoofRatio*fireMul,CV.hoofMs);this.noteCombo('fire_hoof');}
 }
}
