import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openExperiment,restoreGate} from './gate.mjs';
import {installGateCapture} from './capture.mjs';
import {evidenceDir} from './paths.mjs';
const [repo,base='http://127.0.0.1:5286']=process.argv.slice(2);
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--disable-gpu']});
const result={fixture:'eligibility only, arranged gate and weapon tier. No survival or encounter outcome.',checks:[],errors:[]};
try{
  const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(String(e)));
  await page.route(/\/src\/main\.ts(?:\?|$)/,async route=>{
    const response=await route.fetch(),content=await response.text();
    assert.equal(content.split('type: Phaser.AUTO,').length,2);
    await route.fulfill({response,body:content.replace('type: Phaser.AUTO,','type: Phaser.CANVAS, fps:{target:30,limit:30},')});
  });
  await page.routeWebSocket(/127\.0\.0\.1/,()=>{});
  await page.addInitScript(()=>{localStorage.setItem('im_last_hero','zhangfei');window.armyConfig={hero:'zhangfei',seed:177,build:'command'};
    window.seededRng=seed=>{let v=seed;return()=>((v=v*16807%2147483647)/2147483647);};});
  await page.goto(base+'/?gauntlet=1&unlock=real&layout=desktop',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:120000});
  for(const [arm,cap] of [['weapon',false],['star',true],['troops',true],['A',true]]){
    if(result.checks.length){
      await page.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene');window.prevPlayer=s.player;s.scene.restart();});
      await page.waitForFunction(()=>{const s=window.__game.scene.getScene('GauntletGameScene');return s.player!==window.prevPlayer&&s.player?.alive&&s.gWave===1;},null,{timeout:45000});
    }
    await page.evaluate(cap=>{
      const s=window.__game.scene.getScene('GauntletGameScene'),w=s.player.weapons[0];
      if(cap)Object.assign(w,{level:5,branch:'zf_duanqiao',over:2});
      s.gPhase='clear';s.gTier='ghost';s.gWave=15;s.gMilestones=2;s.gKills=[...s.gOrder,...s.roster.ghost];s.gCur=s.gKills.at(-1);s.gLootShown=true;
      s.openClearChoice();
    },cap);
    const reply=await page.evaluate(openExperiment,arm);
    const slots=reply.offers.map(x=>x.slot);
    assert.deepEqual(slots,arm==='A'?[]:cap?['star','troops']:['weapon','star','troops']);
    assert.equal(reply.selected?.slot??null,arm==='A'?null:arm);
    result.checks.push({arm,capped:cap,...reply});
    console.log('checked',arm,slots);
  }
  await page.evaluate(installGateCapture);
  const snapshot=await page.evaluate(()=>{
    const s=window.__game.scene.getScene('GauntletGameScene');
    s.gWave=15;s.gMilestones=2;s.gTier='ghost';s.gPhase='clear';s.legion.train('archer',true);s.legion.train('archer',true);s.legion.recruit('archer',3,true);
    s.legion.units[0].hp-=9;s.takeFollower(s.gOrder[0]);
    const star=s.extraCards().map(v=>v.option).find(o=>o.id.includes('command.NC'));
    s.showLoot('资格夹具','',[star],()=>{});s.chooseUpgrade(0);window.captureGate();return window.gateSnapshot;
  });
  await page.evaluate(()=>{const s=window.__game.scene.getScene('GauntletGameScene');window.prevPlayer=s.player;s.scene.restart();});
  await page.waitForFunction(()=>{const s=window.__game.scene.getScene('GauntletGameScene');return s.player!==window.prevPlayer&&s.player?.alive&&s.gWave===1;},null,{timeout:45000});
  const restored=await page.evaluate(restoreGate,snapshot);
  assert.deepEqual(restored.stars,snapshot.stars);assert.equal(restored.hp,snapshot.life.hp);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.troops)),snapshot.soldiers);
  assert.deepEqual(restored.followers,snapshot.followers.map(f=>[f.boss,f.hp]));
  result.checkpointRestore={stars:restored.stars,army:restored.army,troops:restored.troops,followers:restored.followers,heroHP:restored.hp};
  assert.deepEqual(result.errors,[]);
}finally{await browser.close();await writeFile(join(evidenceDir,'eligible-rewards.json'),JSON.stringify(result,null,2)+'\n');}
console.log(result.checks.map(x=>[x.arm,x.offers.map(y=>y.slot),x.selected?.id]));
