import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const repo=process.env.GAME_REPO||resolve(import.meta.dirname,'..'),base=process.env.BASE||'http://127.0.0.1:5294';
const {chromium}=createRequire(join(repo,'package.json'))('playwright'),browser=await chromium.launch({channel:'chrome'});
const results=[];
try {
 for(const ending of (process.env.ENDING?[process.env.ENDING]:['victory','retreat','reload','client-closed'])){
   console.log(ending,'starting');
   const ctx=await browser.newContext();
   await ctx.route('**/__cross-mode',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Campaign / Gauntlet</title>'}));
   const a=await ctx.newPage(),b=await ctx.newPage(),url=base+'/__cross-mode';await Promise.all([a,b].map(p=>p.goto(url)));
   const id='gauntlet:cross-mode-'+ending;
   const wallet=p=>p.evaluate(async()=>{
     const W=await import('/src/world/WorldStore.ts'),M=await import('/src/systems/MasteryStore.ts');M.resetMasteryCache();
     return [W.loadWorld().provisions,M.addScrolls(0)];
   });
   const before=await wallet(a);console.log(ending,'wallet loaded');
   await a.evaluate(async()=>{await (await import('/src/systems/BattleSnapshot.ts')).openBattleCheckpoint('GameScene');
     (await import('/src/world/WorldStore.ts')).gainProvisions(17);});console.log(ending,'campaign opened');
   const deferred=await b.evaluate(async id=>{
     const c=await import('/src/systems/GauntletSettlement.ts'),h=await import('/src/systems/GauntletHistory.ts');
     await h.saveModeBest('coop-extreme',{kills:19,wave:20,ms:171000});
     return await c.settleGauntlet(id,6,false,'solo-standard',{kills:6,wave:7,ms:63000});
   },id);
   assert.equal(deferred.deferred,true);console.log(ending,'receipt deferred');
   assert.deepEqual(await wallet(a),[before[0]+17,before[1]]);
   if(ending==='client-closed')await b.close();
   if(ending==='reload'){await a.reload();}
   await a.evaluate(async ending=>{
     const s=await import('/src/systems/BattleSnapshot.ts');
     if(ending==='victory'||ending==='client-closed')s.commitBattle();else if(!s.rollbackBattle())throw Error('missing rollback');
   },ending);
   await a.waitForFunction(({id})=>JSON.parse(localStorage.getItem('im_gauntlet_paid_v2')??'{}')[id],{id},{timeout:20000,polling:50});console.log(ending,'paid');
   const after=await wallet(a);
   const replay=await a.evaluate(async id=>await (await import('/src/systems/GauntletSettlement.ts')).settleGauntlet(id,6,false),id);
   const slotScores=await a.evaluate(async()=>(await import('/src/systems/GauntletHistory.ts')).modeHistory());
   assert.deepEqual(after,[before[0]+replay.provisions+(['victory','client-closed'].includes(ending)?17:0),before[1]+replay.scrolls]);
   assert.deepEqual(await wallet(a),after);assert.equal(slotScores['solo-standard'].kills,6);assert.equal(slotScores['coop-extreme'].kills,19);
   results.push({ending,before,deferred,after,replay,slotScores});await ctx.close();
 }
 console.log(results.length,'campaign outcomes preserved earned rewards and records');
 if(process.env.PROOF)writeFileSync(process.env.PROOF,JSON.stringify(results,null,2));
}finally{await browser.close()}
