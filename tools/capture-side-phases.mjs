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
 const regular=process.env.REGULAR==='1';const stages=regular?await p.evaluate(async()=>{const {GAUNTLET_POOL}=await import('/src/data/gauntlet.ts');return GAUNTLET_POOL.filter(b=>b.ctrl==='moveset'||b.id==='lubu').map(b=>({route:b.id,stage:1,scene:'GauntletGameScene',name:b.name,boss:b.name,regular:true}))}):await p.evaluate(async()=>{const {SIDE_ROUTES,sideSceneFor,SIDE_STAGE_KEY}=await import('/src/data/sideRoutes.ts');return SIDE_ROUTES.flatMap(r=>r.stages.map((s,i)=>({route:r.id,stage:i+1,name:s.name,boss:s.boss.name,partner:s.partner?.name,scene:sideSceneFor(r.id,i+1),key:SIDE_STAGE_KEY(r.id)})))});
 for(const st of stages.filter((s,i)=>(!process.env.PROOF_ID||s.route===process.env.PROOF_ID)&&i%Number(process.env.GROUPS||1)===Number(process.env.GROUP||0))){
   await p.evaluate(st=>{
    const g=window.__game;for(const s of g.scene.getScenes(true))g.scene.stop(s.sys.settings.key);
    if(st.key)g.registry.set(st.key,st.stage);g.registry.set('runConfig',{character:'zhaoyun'});
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
     await play();s.player.damageImmune=true;if(st.regular){const {GAUNTLET_POOL}=await import('/src/data/gauntlet.ts');s.gWave=1;s.gOrder[0]=GAUNTLET_POOL.find(b=>b.id===st.route);s.startBoss();if(s.gCur.id!==st.route)throw Error('wrong target')}else s.spawnBoss();
     if(s.dual)s.dual.update(s.combatNow+1250);
     if(st.scene==='SideLubuGameScene')for(let i=0;i<600&&!s.chengong;i++){await play();await next();}
     await play();const b=s.boss,cs=s.dual?s.dual.entries.map(e=>e.ctrl):[s.gCtrl??s.controller??s.lubu??s.moveset];
     if(s.cgCtrl)cs.push(s.cgCtrl);
     const results=[];game.loop.sleep();let stamp=game.loop.now;const px=s.player.x,py=s.player.y;
     function step(){if(s.mode==='levelup')s.chooseUpgrade(0);if(s.mode==='recruit')s.__DEV_ACTIONS?.closePopup?.();game.step(stamp+=35,35)}
     for(let warm=0;warm<65;warm++)step();
     for(const [actorIndex,c] of cs.entries()){
       const native=!c.beat&&!!c.host?.boss;if(!native&&(!c.def||!c.beat)){results.push({actorIndex,custom:true});continue}
       const actor=native?c.host.boss:c.h.boss,seen=new Set();
       for(const phase of [1,2]){
        if(phase===2)c.debug.phase2(s.combatNow);
        for(const [i,m] of (native?c.debug.moves.map(name=>({name})):c.phaseDef.moves).entries()){
         if(native&&((phase===1&&i===4)||(phase===2&&i===3)))continue;if(!native&&seen.has(m.name+JSON.stringify(m)))continue;seen.add(m.name+JSON.stringify(m));
         actor.hp=actor.maxHp*(phase===2?.42:.97);s.player.sprite.setPosition(px,py);actor.sprite.setPosition(px-90,py-20);
         c.debug.force(i,s.combatNow);
         const frames={};
         for(let tick=0;tick<280;tick++){
          if(actor.active&&actor.hp>0)actor.hp=actor.maxHp*(phase===2?.42:.97);step();if(!actor.active||actor.hp<=0)break;
          if(s.mode!=='none'||s.levelPanel?.visible)continue;
          const beat=c.beat,progress=beat?.progress(s.combatNow);
          const part=native?(/Windup$/.test(c.state)?(c.until-s.combatNow<180?'windup':'warning'):['hop','ultTakeoff'].includes(c.state)?'warning':['aim','ultAirborne'].includes(c.state)?'windup':['combo','zig','shot','spin','ultLanding'].includes(c.state)?'impact':c.state==='recover'?'recovery':null):(c.dash&&s.combatNow>c.dash.t0+50||c.ride&&s.combatNow>c.ride.t0+50)?'impact':beat.phase==='windup'?(progress>.67?'windup':'warning'):beat.phase==='release'&&beat.age(s.combatNow)>65?'impact':beat.phase==='recover'?'recovery':null;
          if(part&&!frames[part]){
           const cam=s.cameras.main;if(!cam.worldView.contains(actor.x,actor.y)){cam.centerOn(actor.x,actor.y);cam.preRender()}
           if(!cam.worldView.contains(actor.x,actor.y))continue;
           const image=await new Promise(done=>{game.renderer.snapshot(im=>done(im.src.split(',')[1]),'image/jpeg',.73);game.renderer.preRender();game.scene.render(game.renderer);game.renderer.postRender()});
           if(s.mode==='none'&&!s.levelPanel?.visible)frames[part]=image
          }
          if(Object.keys(frames).length===4||beat?.phase==='idle')break;
         }
         results.push({actorIndex,phase,i,name:m.name,frames});
        }
       }
     }
     return results;
   },st);
   for(const r of result){if(r.frames){const prefix=st.route+'-'+st.stage+'-'+r.actorIndex+'-'+r.phase+'-'+r.i;for(const [stage,data] of Object.entries(r.frames))await writeFile(join(out,prefix+'-'+stage+'.jpg'),Buffer.from(data,'base64'));r.parts=Object.keys(r.frames);delete r.frames;}}
   await p.evaluate(()=>window.__game.loop.wake());rows.push({...st,result});console.log(st.route,st.stage,result.filter(r=>r.parts?.length===4).length,result.length);
 }
 if(errors.length||rows.some(v=>v.result.some(r=>!r.custom&&r.parts.length!==4)))process.exitCode=1;
}finally{await writeFile(join(out,'evidence.json'),JSON.stringify({rows,errors},null,2));await browser.close()}
