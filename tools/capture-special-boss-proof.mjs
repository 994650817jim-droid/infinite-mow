import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(resolve('package.json'))('playwright');
const [base,out,...ids]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try{for(const id of ids){
 const p=await browser.newPage({viewport:{width:960,height:600}});
 try{
 await p.goto(base+'/?dev=1&gauntlet=1&story=off');
 await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player,null,{timeout:60000});
 const rows=await p.evaluate(async id=>{
 const s=window.__game.scene.getScene('GauntletGameScene'),g=s.game,bosses=await import('/src/data/gauntlet.ts');
 const target=bosses.GAUNTLET_POOL.find(b=>b.id===id);s.gWave=1;s.gOrder[0]=target;
 let dong;const {DongzhuoBoss}=await import('/src/systems/DongzhuoBoss.ts');const original=DongzhuoBoss.prototype.update;
 DongzhuoBoss.prototype.update=function(t){dong=this;return original.call(this,t)};
 s.startBoss();g.loop.sleep();let clock=g.loop.now;
 function tick(){if(s.mode==='levelup')s.chooseUpgrade(0);if(s.mode==='recruit')s.__DEV_ACTIONS?.closePopup?.();g.step(clock+=35,35)}
 const b=s.boss,px=s.player.x,py=s.player.y;s.player.damageImmune=true;
 for(let i=0;i<62;i++)tick();
 const c=(id==='dongzhuo'?dong:null)??(s.dual?.entries?.find(e=>e.id===id)?.ctrl)??s.gCtrl??s.zhangjiao??s.huaxiong??s.xurong;
 const actor=c?.h?.boss??b;
 const named={huaxiong:['破军横扫','铁甲冲锋','裂地重斩','裂地震环'],xurong:['骑兵突袭','弓弩箭雨','伏兵号令'],yanliang:['斩将突进','大刀回旋','号令攻城'],wenchou:['回马枪','骑射','劫粮'],dongzhuo:['纵火','号令西凉铁骑','迁都与飞熊军']};
 const moves=named[id]??c.debug.moves,rows=[];
 for(const [i,name] of moves.entries()){
  actor.sprite.setPosition(px-(id==='huaxiong'&&i===1?150:90),py);s.player.sprite.setPosition(px,py);
  const now=s.combatNow,frames={},timing={};let oldRot=c.metrics?.rotations,thunder=c.metrics?.chainStrikes;
  if(id==='huaxiong'){c.state='approach';for(const key of ['nextSweep','nextCharge','nextSlam','nextQuake'])c[key]=Infinity;c[['nextSweep','nextCharge','nextSlam','nextQuake'][i]]=now;}
  else if(id==='xurong'){c.state='approach';c.order=i;c.next=now}
  else if(id==='dongzhuo'){c.nextFire=i===0?now:Infinity;c.nextRaid=i===1?now:Infinity}
  else if(id==='yanliang'||id==='wenchou'){c.index=i;c.begin(now)}
  else {if(id==='simayi'||(id==='caoren'&&i===2))c.debug.phase2(now);c.debug.force(i,now);if(id==='caoren'&&i===2){c.rotateAt=now+1000;oldRot=c.metrics.rotations;}}
  let lastWind=false;
  for(let n=0;n<480;n++){b.hp=b.maxHp*(id==='dongzhuo'&&i===2?.2:.85);tick();const t=s.combatNow;
   if(s.mode!=='none'||s.levelPanel?.visible||!actor.active)continue;
   let part;const age=t-now;
   if(id==='huaxiong')part=c.state.endsWith('Warn')?(c.until-t<220?'windup':'warning'):['quake','slam','charge','sweep'].includes(c.state)?'impact':c.state==='recover'?'recovery':null;
   else if(id==='xurong'){const released=i===0?c.lanes.some(l=>t>=l.at):i===1?c.rain.some(r=>r.done):c.signaled;part=!frames.warning&&c.state==='command'?'warning':!frames.windup&&c.state==='command'&&age>280?'windup':released&&!frames.impact?'impact':frames.impact&&!c.lanes.length&&!c.rain.length&&c.state==='approach'?'recovery':null;}
   else if(id==='yanliang'||id==='wenchou')part=c.state==='warn'?(c.until-t<c.warnLen*.35?'windup':'warning'):c.state==='attack'?'impact':c.state==='recover'?'recovery':null;
   else if(id==='dongzhuo'&&i===1){part=c.nextRaid>now+1000&&!frames.impact?'impact':null;if(frames.impact)break;}else if(id==='dongzhuo'&&i===2){part=c.retreated?(c.boss.invulnerable?'impact':'recovery'):null;if(frames.recovery)break;}else if(id==='dongzhuo'){const f=c.fires[0];part=f?(f.warnUntil>t?(f.warnUntil-t<300?'windup':'warning'):'impact'):frames.impact?'recovery':null;if(frames.warning)c.nextFire=Infinity;}
   else if(id==='caoren'&&i===2){
    part=c.metrics.rotations>oldRot?(frames.impact&&age>1270?'recovery':'impact'):(c.rotateAt-t<300?'windup':'warning');
   }else {const beat=c.beat;
    const expected={zhangjiao:['rain','thunder','heaven','grid'],caoren:['wall','hold'],simayi:['surround','feint','thunder'],yuanshu:['flags','coins','guards']}[id]?.[i];
    if(expected&&beat.move!==expected)continue;
    part=id==='zhangjiao'&&i===3&&c.wave>0&&!frames.impact?'impact':id==='zhangjiao'&&i===1&&c.metrics.chainStrikes>thunder&&!frames.impact?'impact':['windup','warn'].includes(beat.phase)?(frames.warning&&(beat.progress(t)>.66||beat.phase==='warn')?'windup':'warning'):beat.phase==='release'?'impact':beat.phase==='recover'?'recovery':null;}
   if(!part||frames[part])continue;
   if(!s.cameras.main.worldView.contains(actor.x,actor.y)){s.cameras.main.centerOn(actor.x,actor.y);s.cameras.main.preRender()}
   frames[part]=await new Promise(r=>{g.renderer.snapshot(im=>r(im.src.split(',')[1]),'image/jpeg',.78);g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender()});timing[part]=t;
   if(Object.keys(frames).length===4)break;
  }
  rows.push({i,name,frames,timing});
 }
 return rows;
 },id);
 for(const r of rows){for(const [phase,img] of Object.entries(r.frames))writeFileSync(join(out,id+'-'+r.i+'-'+phase+'.jpg'),Buffer.from(img,'base64'));delete r.frames}
 results.push({id,rows});console.log(id,rows.map(r=>[r.name,Object.keys(r.timing).length]));
 }catch(e){results.push({id,error:String(e)});console.log(id,String(e))}finally{await p.close()}
}}finally{writeFileSync(join(out,'evidence.json'),JSON.stringify(results,null,2));await browser.close()}
