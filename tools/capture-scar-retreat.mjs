import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(resolve('package.json'))('playwright');
const [base,out]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});try{
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await p.goto(base+'/?gauntlet=1&dev=1&layout=mobile&mythic=ghost_guanyu');
 await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.gCur?.id==='ghost_guanyu',null,{timeout:60000});
 const result=await p.evaluate(async()=>{
  const s=window.__game.scene.getScene('GauntletGameScene'),g=s.game,c=s.gCtrl,b=s.boss;
  const {mythicHit}=await import('/src/data/mythicGauntlet.ts');
  const x=s.player.x,y=s.player.y,L=s.legion;
  // Match the campaign Wuchao night tint, using the real boss, AI and arrow-tower strike system.
  s.add.rectangle(x,y,4000,4000,0x0a1428,.14).setDepth(18);
  g.loop.sleep();let clock=g.loop.now;
  const tick=()=>{if(s.mode==='levelup')s.chooseUpgrade(0);g.step(clock+=25,25)};
  function image(){return new Promise(r=>{g.renderer.snapshot(im=>r(im.src.split(',')[1]),'image/jpeg',.85);g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender()})}
  b.sprite.setPosition(x-100,y);b.hp=b.maxHp*.46;c.casts=1;c.queue=[];c.next=s.combatNow/1000+.2;
  L.recruit('spearman',8,true,true);if(L.order==='guard')L.cycleOrder();
  for(let i=0;i<L.units.length;i++)L.units[i].setPosition(x+i%4*5,y+Math.floor(i/4)*5);
  for(let i=0;i<24;i++){const a=i*Math.PI/12;s.spawnEnemy('infantry',x+Math.cos(a)*116,y+Math.sin(a)*105,1,true)}
  const pics={},rows=[],clip=[];let marked=null,arrowY=null;
  for(let i=0;i<300;i++){
   tick();if(s.mode!=='none'||s.levelPanel?.visible)continue;
   const w=c.queue[0],now=s.combatNow/1000;
   if(w&&i%2===0)clip.push(await image());if(!w?.retracesScar||now<w.startsAt)continue;
   const inLane=u=>u.active&&mythicHit(w,u);
   if(!marked){marked=L.units.filter(inLane);if(L.order==='sortie')L.cycleOrder();s.debugMoveActive=true;s.debugMove.set(0,1);
    arrowY=s.player.y-16;s.gStrikes.add('arrows',s.player.x,arrowY,55,(w.endsAt-now)*1000,.1,4);}
   const phase=w.resolved?'return':now>=w.scar.lightsAt?'lit':'dormant';
   if(!pics[phase]){pics[phase]=await image();rows.push({phase,at:now,marked:marked.length,stillInLane:marked.filter(inLane).length,surviving:marked.filter(u=>u.active).length,playerInLane:mythicHit(w,s.player),arrowFired:s.gStrikes.metrics.fired,arrowPlayerHits:s.gStrikes.metrics.playerHits,order:L.order});}
   if(phase==='return')break;
  }
  return {rows,pics,clip};
 });
 const dir=join(out,'motion');mkdirSync(dir,{recursive:true});result.clip.forEach((frame,i)=>writeFileSync(join(dir,String(i).padStart(3,'0')+'.jpg'),Buffer.from(frame,'base64')));
 for(const [k,img] of Object.entries(result.pics))writeFileSync(join(out,k+'.jpg'),Buffer.from(img,'base64'));
 writeFileSync(join(out,'result.json'),JSON.stringify(result.rows,null,2));console.log(result.rows);
 if(result.rows.length!==3||!result.rows[0].marked||result.rows[2].playerInLane||!result.rows[2].arrowFired)process.exitCode=1;
}finally{await browser.close()}
