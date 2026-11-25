import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
const require=createRequire(resolve('package.json'));
const {chromium}=require('playwright');
const [base,out]=process.argv.slice(2);if(!base||!out)throw Error('usage: BASE OUTPUT');mkdirSync(out,{recursive:true});
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
const rows=[],errors=[];
try{
 const p=await browser.newPage({viewport:{width:1100,height:700}});
 p.on('pageerror',e=>errors.push(e.stack));
 await p.goto(base+'/?dev=1&layout=desktop&story=off',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__game?.scene.isActive('MenuScene'),null,{timeout:90000});
 const stages=await p.evaluate(async()=>{const {SIDE_ROUTES,sideSceneFor,SIDE_STAGE_KEY}=await import('/src/data/sideRoutes.ts');return SIDE_ROUTES.flatMap(r=>r.stages.map((s,i)=>({route:r.id,stage:i+1,name:s.name,boss:s.boss.name,partner:s.partner?.name,scene:sideSceneFor(r.id,i+1),key:SIDE_STAGE_KEY(r.id)})))});
 for(const st of stages.filter(s=>!process.env.WHITE_ONLY||s.scene==='SideLubuGameScene')){
   await p.evaluate(st=>{
    const g=window.__game;for(const s of g.scene.getScenes(true))g.scene.stop(s.sys.settings.key);
    g.registry.set(st.key,st.stage);g.registry.set('runConfig',{character:'zhaoyun'});
    if(g.registry.get('battleReady'))g.scene.start(st.scene);
    else{g.registry.set('loadBattle',true);g.registry.set('pendingWarlord',st.scene);g.scene.start('BootScene');}
   },st);
   await p.waitForFunction(st=>{const s=window.__game.scene.getScene(st.scene);return s?.sys.isActive()&&!!s?.player&&(!s.thirdStage||s.thirdStage===st.stage)},st,{timeout:45000});
   const result=await p.evaluate(async st=>{
     const s=window.__game.scene.getScene(st.scene),game=s.game;
     const next=()=>new Promise(resolve=>requestAnimationFrame(resolve));
     async function play(){
       for(let i=0;i<180;i++){
         if(s.mode==='levelup')s.chooseUpgrade(0);
         else if(s.mode==='recruit'||s.mode==='pause')s.__DEV_ACTIONS?.closePopup?.();
         if(s.mode==='none'&&!s.levelPanel?.visible&&!s.time.paused)return;
         await next();
       }
       throw Error('modal remains '+s.mode);
     }
     await play();s.player.damageImmune=true;s.spawnBoss();
     if(s.dual)s.dual.update(s.combatNow+1250);
     if(st.scene==='SideLubuGameScene')for(let i=0;i<600&&!s.chengong;i++){await play();await next();}
     await play();const b=s.boss,cs=s.dual?s.dual.entries.map(e=>e.ctrl):[s.controller??s.lubu??s.moveset];
     if(s.cgCtrl)cs.push(s.cgCtrl);
     const poses=[];
     for(const [i,c] of cs.entries()){
       if(!c?.debug?.moves?.length)throw Error('missing controller '+st.name);
       const actor=c.h?.boss??(i?s.chengong:b);
       actor.sprite.setPosition(s.player.x+(i?90:-90),s.player.y-20);
       c.debug.force(0,s.combatNow);poses.push(c.debug.moves[0]);
     }
     const t=s.combatNow;
     for(let i=0;i<200&&s.combatNow<t+140;i++){await play();await next();}
     await play();
     if(!b.active||b.hp<=0||!s.cameras.main.worldView.contains(b.x,b.y)||s.combatNow<t+140)throw Error('invalid actor/clock');
     if(!cs.some(c=>c.state==='warn'||c.state==='attack'||c.cur||c.beat?.move||c.label?.includes(c.debug.moves[0])))throw Error('missing cast');
     game.loop.sleep();
     return {alive:b.active,poses,texture:b.sprite.texture.key,mode:s.mode,modal:s.levelPanel.visible,clock:s.combatNow,expects:st.partner?2:1};
   },st);
   await p.screenshot({path:join(out,'side-'+st.route+'-'+st.stage+'.png')});await p.evaluate(()=>window.__game.loop.wake());rows.push({...st,...result});console.log(st.route,st.stage,st.boss,JSON.stringify(result));
 }
 if(errors.length||rows.some(v=>!v.alive||v.texture==='__MISSING'||v.poses.length<v.expects))process.exitCode=1;
}finally{await writeFile(join(out,'evidence.json'),JSON.stringify({rows,errors},null,2));await browser.close()}
