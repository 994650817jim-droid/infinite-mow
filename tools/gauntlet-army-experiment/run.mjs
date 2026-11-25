import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {readFile,writeFile,mkdir,rename,access,unlink} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {attachObserver,instrument} from './observe.mjs';
import {restoreGate,openExperiment} from './gate.mjs';
import {evidenceDir} from './paths.mjs';
import {attachDriver} from './controls.mjs';
import {installGateCapture} from './capture.mjs';

const [repo,hero='zhangfei',seedText='177',build='weapon',order='guard',name=hero+'-'+seedText,base='http://127.0.0.1:5286',limitText='0',gateFile='',arm='A',rosterProfile='historical']=process.argv.slice(2);
const seed=Number(seedText),limit=Number(limitText);
assert.ok(Number.isInteger(seed)&&seed>0&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.ok(['guard','sortie','alternate','reverse'].includes(order));
assert.ok(['weapon','command','agility','army','personal'].includes(build));
const dir=resolve(evidenceDir,name);await mkdir(dir,{recursive:true});
assert.ok(['historical','cohort'].includes(rosterProfile));
const route=process.env.GAUNTLET_ARMY_ROUTE??'standard';
assert.ok(['standard','extreme'].includes(route)&&(!gateFile||route==='standard'));
const config={hero,seed,build,order,name,limit,gateFile,arm,rosterProfile,route};
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const opts={channel:'chrome',args:['--mute-audio','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding']};
const pauseFlag=join(evidenceDir,'PAUSE');
while(await access(pauseFlag).then(()=>true,()=>false))await new Promise(resolve=>setTimeout(resolve,1200));
const browser=await chromium.launch(opts);const errors=[];
const meta={config,browser:browser.version(),started:new Date().toISOString(),errors,renderer:'Canvas, no-op world draw after boot; camera preRender and native updates kept',terminal:null};
const save=async(file,obj)=>{
  const out=join(dir,file),temp=out+'.tmp';
  await writeFile(temp,JSON.stringify(obj));
  for(let attempt=0;;attempt++){
    try{await rename(temp,out);return;}
    catch(error){
      if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=40)throw error;
      await new Promise(resolve=>setTimeout(resolve,Math.min(1500,75*(attempt+1))));
    }
  }
};
try{
  const sourceFiles=['src/scenes/GameScene.ts','src/systems/EnemyTraits.ts','src/systems/MythicBossController.ts','src/systems/BeifaSystems.ts','src/systems/Legion.ts','src/systems/LegionProjectiles.ts','src/systems/LegionTactics.ts','src/scenes/GauntletGameScene.ts','src/data/gauntletRecruit.ts','src/data/gauntletCards.ts','src/data/mythicGauntlet.ts'];
  meta.sourceSHA256=Object.fromEntries(await Promise.all(sourceFiles.map(async rel=>[rel,createHash('sha256').update(await readFile(join(repo,rel))).digest('hex')])));
  const p=await browser.newPage({viewport:{width:960,height:540}});
  p.on('pageerror',e=>errors.push(String(e.stack??e)));
  await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
  await instrument(p);
  await p.route(/\/src\/main\.ts(?:\?|$)/,async route=>{
    const res=await route.fetch(), src=await res.text();
    assert.equal(src.split('type: Phaser.AUTO,').length,2);
    await route.fulfill({response:res,body:src.replace('type: Phaser.AUTO,','type: Phaser.CANVAS, fps:{target:60,limit:60},')});
  });
  await p.addInitScript(cfg=>{
    window.armyConfig=cfg;
    localStorage.setItem('im_last_hero',cfg.hero);
    if(cfg.hero==='huangzhong'){
      localStorage.setItem('im_world_v1',JSON.stringify({version:10,buildings:{barracks:1,farm:1,clinic:1},cleared:{huangjin:true,hulao:true},jingnanStages:3}));
      localStorage.setItem('im_story_v1',JSON.stringify({version:1,flags:{spared_huangzhong:true}}));
    }
    window.seededRng=seed=>{let v=seed;return()=>((v=v*16807%2147483647)/2147483647);};
    Math.random=window.seededRng(cfg.seed);
  },config);
  await p.goto(base+'/?gauntlet=1&unlock=real&layout=desktop'+(route==='extreme'?'&challenge=extreme':''),{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:150000});
  await p.evaluate(async()=>{
    const game=window.__game,s=game.scene.getScene('GauntletGameScene'),p=s.player,c=window.armyConfig;
    const [rules,mythic]=await Promise.all([import('/src/data/gauntlet.ts'),import('/src/data/mythicGauntlet.ts')]);
    const rosterRng=window.seededRng(c.seed);
    s.gOrder=rules.pickBosses(s.gPool,rosterRng);s.roster=mythic.mythicRoster(c.route==='extreme',rosterRng);
    const battleSeed=window.seededRng(c.seed+1701); Math.random=battleSeed;
    game.renderer.render=()=>{};
    window.applyArmyOrder=()=>{
      const order=c.order==='alternate'?(s.gWave%2?'guard':'sortie'):c.order==='reverse'?(s.gWave%2?'sortie':'guard'):c.order;
      if(s.legion.order!==order&&s.legionUI.order.input?.enabled){
        s.legionUI.order.emit('pointerdown');s.legionUI.order.emit('pointerup');
      }
    };

  });
  await p.evaluate(installGateCapture);
  let baseCounts={recruited:0,dead:0,army:0};
  if(gateFile){
    const snap=JSON.parse(await readFile(gateFile,'utf8'));
    const before=await p.evaluate(restoreGate,snap);await save('entry.json',before);
    assert.deepEqual([before.hp,before.maxHp,before.level,before.stars,before.army,before.food],[snap.life.hp,snap.life.maxHp,snap.life.level,snap.stars,snap.soldiers.length,snap.pack.army.food]);
    const soldiers=army=>army.map(u=>[u.kind,u.hp,u.max,!!u.reserveSoldier]).sort((a,b)=>a[0].localeCompare(b[0])||a[1]-b[1]||a[2]-b[2]||Number(a[3])-Number(b[3]));
    assert.deepEqual(soldiers(before.troops),soldiers(snap.soldiers));
    assert.deepEqual(before.followers,snap.followers.map(f=>[f.boss,f.hp]));
    assert.deepEqual(before.roster,snap.roster);
    baseCounts={recruited:snap.pack.army.recruited,dead:snap.pack.army.dead,army:snap.soldiers.length};
    if(rosterProfile==='cohort'){
      assert.equal(arm,'A');
      baseCounts=await p.evaluate(async()=>{
        const s=window.__game.scene.getScene('GauntletGameScene'),l=s.legion;
        const {GAUNTLET_RECRUIT,recruitTier}=await import('/src/data/gauntletRecruit.ts'),tier=recruitTier(15);
        l.clear();for(const kind of tier.kinds){
          while(l.levels[kind]<tier.level)if(!l.train(kind,true))throw Error('Invalid cohort training');
          l.recruit(kind,GAUNTLET_RECRUIT.per,true);
        }
        l.recruited=l.dead+l.count;
        return {recruited:l.recruited,dead:l.dead,army:l.count};
      });
      await save('cohort-entry.json',await p.evaluate(()=>window.__game.scene.getScene('GauntletGameScene').legion.exportState()));
    }
  }
  await p.evaluate(attachObserver);
  if(gateFile){const reward=await p.evaluate(openExperiment,arm);await save('reward.json',reward);}
  await p.evaluate(attachDriver);
  let gateSaved=false,lastTime=-10,unchanged=0;
  while(true){
    await p.waitForTimeout(4500);
    const pause=pauseFlag;
    if(await access(pause).then(()=>true,()=>false)){
      await p.evaluate(()=>{window.qaPaused=true;window.__game.loop.sleep();});
      await save('paused.json',{at:new Date().toISOString(),gameLoopStopped:true});
      while(await access(pause).then(()=>true,()=>false))await p.waitForTimeout(1200);
      await p.evaluate(()=>{window.__game.loop.wake();window.qaPaused=false;});
      await unlink(join(dir,'paused.json'));
    }
    const data=await p.evaluate(()=>({route:window.challengeState(),army:window.armyObserver.snapshot(),gate:!!window.gateSnapshot}));
    if(data.gate&&!gateSaved){await save('gate.json',await p.evaluate(()=>window.gateSnapshot));gateSaved=true;}
    const cur=data.route.current; meta.current=cur;
    if(data.route.fault||errors.length)throw Error(data.route.fault??errors.join('\n'));
    if(cur.gameOver||!cur.alive){
      if(cur.phase==='done'&&cur.cleared===(route==='extreme'?30:20))meta.terminal='completed';
      else if(!cur.alive&&cur.hp<=0)meta.terminal='natural-defeat';
      else throw Error('Unexpected live non-settlement terminal '+JSON.stringify(cur));
    }
    else if(limit&&cur.time>=limit)meta.terminal='observation-limit';
    unchanged=cur.time===lastTime?unchanged+1:0;lastTime=cur.time;if(unchanged>15)throw Error('stalled '+JSON.stringify(cur));
    await save('progress.json',meta);
    await save('route.json',data.route);await save('army.json',data.army);
    if(meta.terminal){
      assert.equal(data.army.units.filter(u=>u.death).length,data.army.totals.dead-baseCounts.dead);
      assert.equal(data.army.units.length,data.army.totals.recruited-baseCounts.recruited+baseCounts.army);
      assert.equal(cur.revivalUsed,false);break;
    }
  }
}catch(e){errors.push(String(e.stack??e));meta.terminal='error';throw e;}
finally{meta.ended=new Date().toISOString();try{await save('progress.json',meta);}finally{await browser.close();}}
console.log(name,meta.terminal,meta.current?.wave,meta.current?.time);
