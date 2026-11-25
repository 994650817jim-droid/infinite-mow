// Isolated browser profiles and explicit scene fixtures. This checks the live UI/transaction path, not balance.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=new URL(process.argv[2] ?? 'http://127.0.0.1:5327');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
try {
  for (const [tier,wave,size,continueTo] of [
    ['mortal',10,5,'ghost'],['ghost',15,5,'divine'],['divine',20,5,'endless'],['divine',30,10,null],
  ]) {
    const page=await browser.newPage();
    page.on('pageerror',e=>console.error(e.message));
    await page.goto(base+'?gauntlet=1&story=off&dev=1&challenge='+(size===10?'extreme':'standard'),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:90000});
    const blocked=await page.evaluate(({tier,wave,size})=>{
      const s=window.__qa=window.__game.scene.getScene('GauntletGameScene');
      s.gPhase='boss'; s.gTier=tier; s.gWave=wave; if(s.mythicSize!==size)throw Error('Fixture roster size');
      s.gCur=s.waveBoss(); s.setMode('none'); s.legion.food=2000; s.legion.recruit('guardian',2,true);
      s.onBossDown(); s.paintRecruit();
      const funds=s.legion.food, count=s.legion.count;
      return {offer:s.recruitOpen(),visible:!!s.gRecruitBtn?.visible,bought:s.recruitTroops(),funds,count,after:s.legion.food};
    },{tier,wave,size});
    assert.equal(blocked.offer,false,'no purchases before the checkpoint decision, wave '+wave);
    assert.equal(blocked.visible,false);
    assert.equal(blocked.bought,false);
    assert.equal(blocked.after,blocked.funds);
    await page.evaluate(()=>{const s=window.__qa;s.gLootShown=true;s.gAt=s.elapsed-12;});
    await page.waitForFunction(()=>window.__qa.gPhase==='choice',null,{timeout:15000});
    await page.evaluate(next=>{const s=window.__qa;const id=next?'gauntlet_'+next:'gauntlet_settle';
      const i=s.upgradeOptions.findIndex(o=>o.id===id);if(i<0)throw Error('Missing choice '+id);s.chooseUpgrade(i);},continueTo);
    if (continueTo) {
      const after=await page.evaluate(()=>{const s=window.__qa;const n=s.legion.count;
        const bought=s.recruitTroops();return {bought,added:s.legion.count-n};});
      assert.deepEqual(after,{bought:true,added:3});
      await page.evaluate(()=>{const s=window.__qa;s.gAt=s.elapsed-12;});
      await page.waitForFunction(w=>window.__qa.gWave===w+1,wave);
      assert.equal(await page.evaluate(()=>window.__qa.recruitTroops()),false);
    } else {
      const figures=page.locator('.report-figures');
      await page.getByText('斩将时部曲',{exact:true}).waitFor();
      assert.equal(await figures.locator('div').filter({has:page.getByText('斩将时部曲',{exact:true})}).locator('dd').textContent(),String(blocked.count));
      assert.equal(await figures.locator('div').filter({has:page.getByText('战后新募',{exact:true})}).locator('dd').textContent(),'0');
      assert.equal(await page.evaluate(()=>window.__qa.legion.count),blocked.count);
    }
    console.log('PASS',tier,wave,continueTo??'settle');await page.close();
  }
} finally {await browser.close();}
