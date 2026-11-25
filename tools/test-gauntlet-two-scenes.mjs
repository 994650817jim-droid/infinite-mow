import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {writeFileSync} from 'node:fs';
const repo=process.env.GAME_REPO || resolve(import.meta.dirname,'..'),base=process.env.BASE||'http://127.0.0.1:5294';
const {chromium}=createRequire(join(repo,'package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome'});
const errors=[];
try {
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const a=await ctx.newPage(),b=await ctx.newPage();
 async function open(p,extreme=false) {
   p.on('pageerror',e=>errors.push(String(e)));
   await p.goto(base+'/?gauntlet=1'+(extreme?'&challenge=extreme':''));
   await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.sprite?.active,null,{timeout:120000});
 }
 await open(a);await open(b,true);
 const wallet=()=>a.evaluate(async()=>{
   const W=await import('/src/world/WorldStore.ts'),M=await import('/src/systems/MasteryStore.ts');
   M.resetMasteryCache(); M.addScrolls(0);
   return [W.loadWorld().provisions,JSON.parse(localStorage.getItem(M.MASTERY_KEY)).scrolls];
 });
 assert.equal(await a.evaluate(()=>localStorage.getItem('im_battle_snapshot')),null);
 const before=await wallet();
 const end=(p,n)=>p.evaluate(async n=>{
   const s=window.__game.scene.getScene('GauntletGameScene');
   // Only the battle outcome is injected. Use its ordinary result scene, save and wallet code.
   s.gKills=s.gOrder.slice(0,n);s.gWave=n+1;s.gPhase='done';
   await s.finish(false,'death');
   return {kills:n,id:s.claimId,title:document.querySelector('dialog h2')?.textContent??document.querySelector('dialog h1')?.textContent};
 },n);
 const ends=await Promise.all([end(a,6),end(b,4)]);
 const after=await wallet(),ledger=await a.evaluate(()=>JSON.parse(localStorage.getItem('im_gauntlet_paid_v2')));
 for(const e of ends)assert.match(e.title,/沙场败退/);
 assert.deepEqual(after,before.map((n,i)=>n+Object.values(ledger).reduce((v,p)=>v+p[['provisions','scrolls'][i]],0)));
 await b.reload();await b.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.sprite?.active,null,{timeout:120000});
 assert.deepEqual(await wallet(),after);
 const modes=await a.evaluate(()=>JSON.parse(localStorage.getItem('im_gauntlet_modes_v1')));assert.equal(modes['solo-standard'].kills,6);assert.equal(modes['solo-extreme'].kills,4);
 assert.equal(errors.length,0,errors.join('\n'));
 const evidence={input:'two real Phaser scenes, controlled defeats, one shared temporary save',before,after,ends,modes,errors};
 if(process.env.PROOF)writeFileSync(process.env.PROOF,JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));
}finally{await browser.close();}
