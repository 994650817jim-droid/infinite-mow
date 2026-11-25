import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {writeFileSync} from 'node:fs';
const repo=process.env.GAME_REPO || resolve(import.meta.dirname,'..');
const {chromium}=createRequire(join(repo,'package.json'))('playwright');
const base=process.env.BASE || 'http://127.0.0.1:5294';
const browser=await chromium.launch({channel:'chrome'});
const checks=[];
try {
 const ctx=await browser.newContext();
 await ctx.route('**/__receipt-check',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Receipt test</title>'}));
 const pages=await Promise.all([ctx.newPage(),ctx.newPage(),ctx.newPage()]);
 await Promise.all(pages.map(p=>p.goto(base+'/__receipt-check')));
 const wallet=()=>pages[0].evaluate(async()=>{
   const w=await import('/src/world/WorldStore.ts'),m=await import('/src/systems/MasteryStore.ts');
   m.resetMasteryCache(); m.addScrolls(0);
   return [w.loadWorld().provisions,JSON.parse(localStorage.getItem(m.MASTERY_KEY)).scrolls];
 });
 const settle=(page,id,kills=1,clear=false)=>page.evaluate(async([id,k,c])=>(await import('/src/systems/GauntletSettlement.ts')).settleGauntlet('gauntlet:'+id,k,c),[id,kills,clear]);
 const before=await wallet();
 const a=await settle(pages[0],'first',10,true),b=await settle(pages[1],'second',12,true);
 const after=await wallet();
 await settle(pages[2],'first',10,true);
 assert.deepEqual(await wallet(),after,'retrying an earlier receipt after another tab settled must not issue anything');checks.push('replay older receipt');
 assert.equal(a.first,true);assert.equal(b.first,false);
 assert.deepEqual(after,before.map((v,i)=>v+a[['provisions','scrolls'][i]]+b[['provisions','scrolls'][i]]));checks.push('distinct payouts');
 const c=await Promise.all(pages.map(p=>settle(p,'same',9)));
 assert.deepEqual(c[0],c[1]);assert.deepEqual(await wallet(),[after[0]+c[0].provisions,after[1]+c[0].scrolls]);checks.push('simultaneous identical result');
 const next=await wallet(),v=await Promise.all(pages.map((p,i)=>settle(p,'multi'+i,3+i)));
 assert.deepEqual(await wallet(),next.map((n,i)=>v.reduce((sum,r)=>sum+r[['provisions','scrolls'][i]],n)));checks.push('simultaneous distinct results');
 await pages[0].evaluate(()=>localStorage.clear());
 const firsts=await Promise.all(pages.map((p,i)=>settle(p,'clear'+i,20,true)));
 assert.equal(firsts.filter(v=>v.first).length,1);checks.push('simultaneous first clear');
 // Queue a second award behind a held lock and close its tab before payment.
 await pages[0].evaluate(async()=>{await new Promise(resolve=>navigator.locks.request('im-gauntlet-save',async()=>{resolve();await new Promise(release=>window.releaseLock=release)}))});
 const p=pages[2];void settle(p,'abandoned',8).catch(()=>{});
 await p.waitForFunction(()=>Object.keys(localStorage).some(k=>k.includes('abandoned')));
 await p.close();await pages[0].evaluate(()=>window.releaseLock());
 const beforeRecovery=await wallet();await pages[1].evaluate(async()=>await (await import('/src/systems/GauntletSettlement.ts')).recoverGauntletSettlement());
 const paid=await settle(pages[0],'abandoned',8);assert.deepEqual(await wallet(),[beforeRecovery[0]+paid.provisions,beforeRecovery[1]+paid.scrolls]);checks.push('closed waiting tab recovered exactly once');
 const write=(p,key,kills,test=false)=>p.evaluate(async([k,n,t])=>(await import('/src/systems/GauntletHistory.ts')).saveModeBest(k,{kills:n,wave:n+1,ms:n*100},t),[key,kills,test]);
 await pages[0].evaluate(()=>localStorage.setItem('im_gauntlet_best',JSON.stringify({kills:41,wave:42,ms:34000})));
 const keys=['solo-standard','solo-extreme','coop-standard','coop-extreme','solo-standard-endless','solo-extreme-endless','coop-standard-endless','coop-extreme-endless'];
 for(const [i,key] of keys.entries())await write(pages[0],key,i+2);
 await Promise.all([write(pages[0],keys[0],12),write(pages[1],keys[0],18)]);
 await write(pages[1],keys[0],333,true);
 const stats=await pages[0].evaluate(async()=>{const h=await import('/src/systems/GauntletHistory.ts');return [h.modeHistory(),h.modeHistory(true)]});
 keys.forEach((k,i)=>assert.equal(stats[0][k].kills,i===0?18:i+2));assert.equal(stats[0].legacy.kills,41);assert.equal(stats[1][keys[0]].kills,333);checks.push('eight distinct records, concurrent maximum, preserved legacy, DEV isolation');
 // Legacy claims may predate both the new ledger and the categorized score.
 await pages[1].evaluate(async()=>{
   const c=await import('/src/systems/GauntletSettlement.ts');
   localStorage.setItem(c.CLAIM_KEY,JSON.stringify({id:'gauntlet:legacy',kills:8,cleared:false,first:false,paid:{provisions:29,scrolls:3}}));
   await c.recoverGauntletSettlement();
 });
 const legacyWallet=await wallet(),legacy=await settle(pages[0],'legacy',8);
 assert.equal(legacy.provisions,29);assert.equal(legacy.scrolls,3);assert.deepEqual(await wallet(),legacyWallet);checks.push('v1 paid receipt migration');
 for(const p of pages.slice(0,2))await p.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
 const httpBefore=await wallet(),httpPaid=await Promise.all(pages.slice(0,2).map(p=>settle(p,'http',7)));
 assert.deepEqual(httpPaid[0],httpPaid[1]);assert.deepEqual(await wallet(),[httpBefore[0]+httpPaid[0].provisions,httpBefore[1]+httpPaid[0].scrolls]);checks.push('IndexedDB serializer on LAN browsers without Web Locks');
 const slotCheck=await pages[0].evaluate(async()=>{
   const slots=await import('/src/systems/SaveSlots.ts'),c=await import('/src/systems/GauntletSettlement.ts'),h=await import('/src/systems/GauntletHistory.ts');
   if(!slots.switchSlot(1))throw Error('switch 0→1');
   const clean=h.modeHistory();const first=localStorage.getItem('im_gauntlet_first_clear');
   let deferred=false;try{await c.settleGauntlet('gauntlet:slot0',7,false,undefined,undefined,0);}catch{deferred=true;}
   const cleanLedger=localStorage.getItem('im_gauntlet_paid_v2');if(!slots.switchSlot(0))throw Error('switch 1→0');
   await c.recoverGauntletSettlement();return {clean,first,deferred,cleanLedger,score:h.modeHistory()['solo-standard'].kills,paid:JSON.parse(localStorage.getItem('im_gauntlet_paid_v2'))['gauntlet:slot0']};
 });
 assert.ok(!slotCheck.clean['solo-standard'] && slotCheck.clean.legacy.kills===41 && slotCheck.deferred && slotCheck.cleanLedger===null && slotCheck.score===18 && slotCheck.paid && slotCheck.first==='1');
 checks.push('switch slots while reward queued; preserve old global first clear and legacy best');
 console.log(JSON.stringify({checks},null,2));if(process.env.PROOF)writeFileSync(process.env.PROOF,JSON.stringify({checks},null,2));
}finally{await browser.close()}
