import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(resolve('package.json'));
const {chromium}=require('playwright');
const [base,out,...requested]=process.argv.slice(2);
if(!base||!out||!requested.length)throw Error('usage: node tools/capture-mythic-proof.mjs BASE OUTPUT ID...');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
try{
for(const id of requested){
 const dir=join(out,id);mkdirSync(dir,{recursive:true});
 const p=await browser.newPage({viewport:{width:960,height:600}});
 try{
 await p.addInitScript(()=>{let v=39021;Math.random=()=>((v=(Math.imul(v,1664525)+1013904223)>>>0)/4294967296);});
 await p.goto(base+'/?gauntlet=1&dev=1&layout=desktop&mythic='+id,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(id=>{const s=window.__game?.scene.getScene('GauntletGameScene');if(s?.mode==='levelup')s.chooseUpgrade(0);return s?.gCur?.id===id&&s.boss?.active&&s.textures.exists('mythic_'+id+'_fx')&&s.mode==='none'&&!s.levelPanel?.visible},id,{timeout:90000});
 const result=await p.evaluate(async({id,video})=>{
 const s=window.__game.scene.getScene('GauntletGameScene'),g=s.game,c=s.gCtrl,b=s.boss;
 g.loop.sleep();let clock=g.loop.now||performance.now();let index=0;
 const screens=[],clip=[],counts=new Set(),defs=c.definition,damage=[];
 const take=s.player.takeDamage.bind(s.player);s.player.takeDamage=(...args)=>{const hp=s.player.hp;const val=take(...args);damage.push({at:s.combatNow,hpBefore:hp,hpAfter:s.player.hp});return val};
 const x=s.player.x,y=s.player.y;
 b.sprite.setPosition(x-96,y);c.casts=0;c.queue=[];c.next=s.combatNow/1000+.6;
 const snap=()=>new Promise(resolve=>{g.renderer.snapshot(image=>resolve(image.src.split(',')[1]),'image/jpeg',.8);step();});
 function step(){if(s.mode==='levelup')s.chooseUpgrade(0);else if(s.mode==='recruit')s.__DEV_ACTIONS?.closePopup?.();g.step(clock+=25,25)}
 const recorded=(w,part)=>w.name+'-'+part;
 const expected=new Set([...defs.moves.flat(),defs.phaseMove].map(v=>v.name));
 let last=null;let pendingRecovery=null;let hits=0;let captureMotion=false;
 for(let ticks=0;ticks<1700;ticks++){
   step();
   if(s.gCur?.id!==id||!b.active||b.hp<=0||s.over)throw Error('target lost '+id);
   if(s.mode!=='none'||s.levelPanel?.visible)continue;
   if(c.casts>=2&&!c.phase2&&!c.queue.length)b.hp=Math.floor(b.maxHp*.45);
   if(!c.queue.length){b.sprite.setPosition(x-96,y);s.player.sprite.setPosition(x,y);}
   const now=s.combatNow/1000,w=c.queue[0],active=w&&now>=w.startsAt;
   if(active&&!w.resolved){const a=w.angle-((w.lanes??1)-1)*(w.spread??0)/2,r=w.kind==='circle'?0:w.kind==='ring'?(w.radius+w.innerRadius)/2:w.radius*.48;
     s.player.sprite.setPosition(w.x+Math.cos(a)*r,w.y+Math.sin(a)*r);}
   if(s.player.hp<s.player.maxHp*.65)s.player.hp=s.player.maxHp;
   const phase=active?(!w.resolved?(now>w.endsAt-.19?'windup':'warning'):now>=w.endsAt+.075?'impact':null):null;
   const record=async(w,part)=>{const k=recorded(w,part);if(counts.has(k))return;
     if(s.mode!=='none'||s.levelPanel?.visible||!b.sprite.visible||!s.player.sprite.visible)throw Error('occluded frame');
     const cam=s.cameras.main;if(!cam.worldView.contains(b.x,b.y)||!cam.worldView.contains(s.player.x,s.player.y))throw Error('actor outside viewport');
     const frame={name:w.name,part,clock:s.combatNow,kind:w.kind,cast:c.casts,bossHp:b.hp,mode:s.mode,texture:b.sprite.texture.key,frame:b.sprite.frame.name,fx:c.signature.visible,damageCalls:damage.length};
     const img=await snap();if(s.mode!=='none'||s.levelPanel?.visible)throw Error('modal on render');
     screens.push({...frame,img});counts.add(k)};
   if(pendingRecovery&&(!active||w!==pendingRecovery)){await record(pendingRecovery,'recovery');pendingRecovery=null;}
   if(phase){await record(w,phase);if(phase==='impact'){pendingRecovery=w;last=w;hits++}}
   if(video&&c.casts===1&&clip.length<60&&ticks%2===0){clip.push(await snap());captureMotion=true;}
   if(captureMotion&&c.casts>=2)captureMotion=false;
   if([...expected].every(name=>['warning','windup','impact','recovery'].every(part=>counts.has(name+'-'+part))))break;
 }
 const missing=[...expected].filter(name=>!['warning','windup','impact','recovery'].every(part=>counts.has(name+'-'+part)));
 return {screens,clip,damage,missing};
 },{id,video:true});
 for(const [i,f] of result.screens.entries()){const file=String(i).padStart(3,'0')+'-'+f.part+'.jpg';writeFileSync(join(dir,file),Buffer.from(f.img,'base64'));delete f.img;f.file=file;}
 const clipdir=join(dir,'motion');mkdirSync(clipdir,{recursive:true});result.clip.forEach((v,i)=>writeFileSync(join(clipdir,String(i).padStart(3,'0')+'.jpg'),Buffer.from(v,'base64')));delete result.clip;
 writeFileSync(join(dir,'evidence.json'),JSON.stringify(result,null,2));console.log(id,result.screens.length,'missing',result.missing);
 assert.deepEqual(result.missing,[]);assert.ok(result.damage.some(m=>m.hpAfter<m.hpBefore));
 }finally{await p.close()}
}
}finally{await browser.close()}
