// Run from the game repository with BASE pointing to its local Vite dev server.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const require = createRequire(resolve('package.json'));
const {chromium} = require('playwright');
const url = new URL(process.env.BASE ?? 'http://127.0.0.1:5216/');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
url.search = 'dev=1&gauntlet=1&layout=desktop';
const browser = await chromium.launch({channel:'chrome', args:['--mute-audio','--enable-precise-memory-info']});
const page = await browser.newPage({viewport:{width:1280,height:720}});
const cdp = await page.context().newCDPSession(page);
const record = {environment:'Desktop Chrome, headless, 1280x720, local Vite DEV. Automated accelerated encounter transitions; protected player, normal rendered frames.', browser:browser.version(),waves:[],errors:[]};
const save = () => writeFileSync(process.env.RESULT ?? 'stability-30.json',JSON.stringify(record,null,2));
page.on('pageerror',e=>record.errors.push(e.stack));
try {
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:120000});
  await page.evaluate(()=>{
    const s=window.__game.scene.getScene('GauntletGameScene');
    window.benchScene=s;
    s.player.damageImmune=true;
    // Keep the first ten waves reproducible; ghost and divine rosters remain native.
    s.gOrder=Array(10).fill(s.gPool.find(b=>b.id==='zhangliang'));
    window.frameDeltas=[];
    let last;
    const sampleFrame=()=>{
      const now=performance.now();
      if(s.mode==='levelup' && s.upgradeOptions.length) s.chooseUpgrade(0);
      if(s.mode==='branch') s.chooseBranch(0);
      if(s.mode==='attributes') s.setMode(s.attributeReturn??'none');
      if(last!==undefined && s.gPhase==='boss' && s.mode==='none') window.frameDeltas.push(now-last);
      last=now;
    };
    s.game.events.on('postrender',sampleFrame);
    s.events.once('shutdown',()=>s.game.events.off('postrender',sampleFrame));
  });
  for(let wave=1;wave<=30;wave++){
    await page.waitForFunction(w=>{
      const s=window.benchScene;
      if(s.mode==='levelup' || (s.mode==='bossloot' && s.gPhase==='clear' && /^奇遇/.test(s.levelPanel.getByName('upgrade-title')?.text??''))) s.chooseUpgrade(0);
      if(s.gWave===w && s.gPhase==='mow' && s.mode==='none') s.gAt=s.elapsed-200;
      return s.gWave===w && s.gPhase==='boss' && s.boss?.active;
    },wave,{timeout:60000});
    await page.evaluate(()=>{window.frameDeltas.length=0;});
    await page.waitForTimeout(Number(process.env.WAVE_MS??6500));
    const row=await page.evaluate(()=>{
      const s=window.benchScene, times=window.frameDeltas.slice().sort((a,b)=>a-b);
      const n=times.length, sum=times.reduce((a,b)=>a+b,0);
      const at=p=>times[Math.min(n-1,Math.ceil(p*n)-1)];
      const tail=times.slice(-Math.max(1,Math.ceil(n*.01)));
      const keys=s.textures.getTextureKeys();
      return {wave:s.gWave,tier:s.gTier,id:s.gCur.id,frames:n,sampleMs:sum,fps:1000*n/sum,p50ms:at(.50),p95ms:at(.95),p99ms:at(.99),
        onePctLow:1000*tail.length/tail.reduce((a,b)=>a+b,0),enemies:s.enemies.filter(e=>e.active).length,allies:s.allies.filter(a=>a.active).length,
        displayObjects:s.children.length,textures:keys.length,mythicTextures:keys.filter(k=>k.startsWith('mythic_')).length,tweens:s.tweens.getTweens().length};
    });
    if(!row.frames)throw Error('no rendered combat frames: '+JSON.stringify(await page.evaluate(()=>{const s=window.benchScene;return [s.mode,s.gPhase,s.gWave,s.game.loop.actualFps,s.game.loop.running,s.upgradeOptions.map(o=>o.id)];})));
    row.jsHeapMiB=(await cdp.send('Runtime.getHeapUsage')).usedSize/1048576;
    record.waves.push(row);save();
    await page.evaluate(()=>{const s=window.benchScene;if(s.gPhase==='boss'&&s.boss?.active){s.boss.hp=0;s.killEnemy(s.boss);}s.gAt=s.elapsed-10;});
    await page.waitForFunction(()=>{
      const s=window.benchScene;if(s.mode==='levelup')s.chooseUpgrade(0);
      if(s.mode!=='bossloot'||s.gPhase!=='clear')return false;
      const i=s.upgradeOptions.findIndex(o=>o.id==='gauntlet_spoils');if(i<0)return false;
      s.chooseUpgrade(i);
      if(s.gWave%3===0 && s.recruitOpen()) s.recruitTroops();
      return true;
    },null,{timeout:30000});
    if(wave%10===0){
      const choice=wave===10?'gauntlet_ghost':wave===20?'gauntlet_divine':'gauntlet_settle';
      await page.waitForFunction(id=>{
        const s=window.benchScene;
        if(s.mode==='levelup'||(s.mode==='bossloot'&&s.gPhase==='clear'&&s.upgradeOptions.length))s.chooseUpgrade(0);
        if(s.mode!=='bossloot'||s.gPhase!=='choice')return false;
        const i=s.upgradeOptions.findIndex(o=>o.id===id);if(i<0)return false;
        s.chooseUpgrade(i);return true;
      },choice,{timeout:30000});
    }
  }
  await page.waitForFunction(()=>window.benchScene.over,null,{timeout:30000});
  record.finished=await page.evaluate(()=>{const s=window.benchScene;return s.over&&s.gKills.length===30&&s.gMilestones===3;});
  assert.ok(record.finished);assert.deepEqual(record.errors,[]);
  await page.evaluate(()=>{window.benchScene.scene.start('MenuScene');});
  await page.waitForFunction(()=>window.__game.scene.isActive('MenuScene'));
  await page.waitForTimeout(1000);
  record.afterExit=await page.evaluate(()=>{const s=window.benchScene;return {battleActive:s.sys.isActive(),textures:s.game.textures.getTextureKeys().length,
    battleChildren:s.children.length,extraBossSheets:s.game.textures.getTextureKeys().filter(k=>k.endsWith('_stride')&&k.startsWith('mythic_')).length};});
  record.afterExit.jsHeapMiB=(await cdp.send('Runtime.getHeapUsage')).usedSize/1048576; assert.equal(record.afterExit.battleActive,false); assert.equal(record.afterExit.battleChildren,0); assert.equal(record.afterExit.extraBossSheets,0);assert.deepEqual(record.errors,[]);
} catch(e){record.failure=String(e);record.debug=await page.evaluate(()=>{const s=window.benchScene;return s&&{wave:s.gWave,mode:s.mode,phase:s.gPhase,over:s.over,choices:s.upgradeOptions.map(o=>o.id)};}).catch(()=>null);throw e;} finally {save();await browser.close();}
