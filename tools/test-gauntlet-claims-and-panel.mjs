import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const repo=resolve(import.meta.dirname,'..'),out=process.env.OUT??join(tmpdir(),'gauntlet-acceptance'),{chromium}=createRequire(join(repo,'package.json'))('playwright');
mkdirSync(out,{recursive:true});
const base=(process.env.BASE??'http://127.0.0.1:5173').replace(/\/$/,'');
const browser=await chromium.launch({channel:'chrome'});
try{
 const results=[];
 for(const point of process.argv.includes('--ui')?[]:['beforeGrain','afterGrain','afterScrolls','afterFirst','delivered']){
  const p=await browser.newPage();
  await p.goto(base+'/');
  const before=await p.evaluate(async(point)=>{
   const C=await import('/src/systems/GauntletSettlement.ts'), W=await import('/src/world/WorldStore.ts'), M=await import('/src/systems/MasteryStore.ts');
   const world=W.loadWorld();const grain=world.provisions; M.addScrolls(0);
   const scrolls=JSON.parse(localStorage.getItem(M.MASTERY_KEY)).scrolls;
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){
    const fail=(point==='beforeGrain'&&k===W.WORLD_KEY)||(point==='afterGrain'&&k===M.MASTERY_KEY&&v.includes('gauntletClaim'))||
      (point==='afterScrolls'&&k==='im_gauntlet_first_clear')||(point==='afterFirst'&&k===C.CLAIM_KEY&&v.includes('"paid"'));
    if(fail)throw new Error('simulated interruption');
    return original.call(this,k,v);
   };
   try{C.settleGauntlet('gauntlet:proof',20,true);}catch{}finally{Storage.prototype.setItem=original;}
   return {grain,scrolls};
  },point);
  await p.reload();
  const result=await p.evaluate(async()=>{
    const C=await import('/src/systems/GauntletSettlement.ts'), W=await import('/src/world/WorldStore.ts'),M=await import('/src/systems/MasteryStore.ts');
    C.recoverGauntletSettlement();C.recoverGauntletSettlement();
    const paid=C.settleGauntlet('gauntlet:proof',20,true);
    return {paid,grain:W.loadWorld().provisions,scrolls:JSON.parse(localStorage.getItem(M.MASTERY_KEY)).scrolls,first:localStorage.getItem('im_gauntlet_first_clear')};
  });
  assert.equal(result.grain-before.grain,result.paid.provisions);
  assert.equal(result.scrolls-before.scrolls,result.paid.scrolls);assert.equal(result.first,'1');
  assert.ok(result.paid.provisions>0&&result.paid.scrolls>0);results.push({point,before,result});await p.close();
 }
 if(results.length)writeFileSync(join(out,'claim-proofs.json'),JSON.stringify(results,null,2));if(results.length)console.log('5/5 interrupted and replayed receipts passed');
 for(const mobile of [false,true]){
  const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720}});
  p.on('pageerror', e=>console.log('PAGE',String(e),e.stack));await p.goto(base+'/?gauntlet=1&dev=1&layout='+(mobile?'mobile':'desktop'));
  await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.sprite?.active,null,{timeout:90000});
  await p.evaluate(()=>{
   const s=window.__game.scene.getScene('GauntletGameScene');
   s.gWave=10;s.gTier='mortal';s.gKills=s.gOrder.slice(0,10);s.gCleared=true;s.gMilestones=1;
   s.openClearChoice();
  });
  const dialog=p.locator('dialog.campaign-gate');await dialog.waitFor();
  await p.screenshot({path:join(out,(mobile?'mobile':'desktop')+'-gate.png')});
  await dialog.getByRole('button',{name:/收兵/}).click();
  await p.getByRole('heading',{name:'收兵归营'}).waitFor({timeout:10000});
  await p.screenshot({path:join(out,(mobile?'mobile':'desktop')+'-result.png')});
  await p.close();
 }
}finally{await browser.close();}


