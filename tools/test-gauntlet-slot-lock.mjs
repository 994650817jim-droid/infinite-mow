import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({channel:'chrome'});
try {
  for (const fallback of [false,true]) {
    const ctx = await browser.newContext();
    try {
      if (fallback) await ctx.addInitScript(() => Object.defineProperty(navigator,'locks',{value:undefined}));
      await ctx.route('**/wallet-probe.html', r=>r.fulfill({contentType:'text/html',body:'<title>Storage QA</title>'}));
      const a=await ctx.newPage(), b=await ctx.newPage();
      for(const p of [a,b]) await p.goto(base+'/wallet-probe.html');
      for(const p of [a,b]) await p.evaluate(async()=>{
        window.M=await import('/src/systems/MasteryStore.ts');
        window.C=await import('/src/systems/GauntletSettlement.ts');
        window.S=await import('/src/systems/SaveSlots.ts');
      });
      await a.evaluate(()=>M.scrolls());
      const paid=await b.evaluate(()=>C.settleGauntlet('gauntlet:stale-wallet-proof',20,true));
      assert.ok(paid.scrolls>0);
      await a.waitForFunction(n=>JSON.parse(localStorage.getItem(M.MASTERY_KEY)).scrolls===n,paid.scrolls);
      const after=await a.evaluate(()=>{
        M.addMerit(1);
        return JSON.parse(localStorage.getItem(M.MASTERY_KEY));
      });
      assert.equal(after.scrolls,paid.scrolls, 'ordinary merit write must preserve latest reward');
      assert.equal(after.gauntletClaim.id,'gauntlet:stale-wallet-proof');
      assert.equal(after.merit,1);
      const reread=await b.evaluate(async()=>{
        await C.settleGauntlet('gauntlet:stale-wallet-proof',20,true);
        return M.scrolls();
      });
      assert.equal(reread,paid.scrolls);
      console.log(fallback?'IDB':'Web Locks','wallet passed');

      // Keep a real browser lock or IDB transaction alive from a separate JS agent.
      async function hold() {
        await a.evaluate(async(fallback)=>{
          window.releaseProbe=undefined;
          if (!fallback) {
            void navigator.locks.request('im-gauntlet-save',()=>new Promise(done=>window.releaseProbe=done));
          } else {
            const init=await import('/src/systems/GauntletSaveLock.ts');await init.withGauntletLock(()=>{});
            const db=await new Promise(res=>{const r=indexedDB.open('im-gauntlet-mutex',1);r.onsuccess=()=>res(r.result)});
            const tx=db.transaction('lock','readwrite'),store=tx.objectStore('lock');
            let keep=true; window.releaseProbe=()=>{keep=false};tx.oncomplete=()=>db.close();
            const loop=()=>{if(keep)store.get(0).onsuccess=loop;};loop();
          }
        },fallback);
        await a.waitForFunction(()=>typeof releaseProbe==='function');
      }
      await hold();
      await b.evaluate(()=>{window.switchFinished=false;window.switchResult=S.switchSlotSafely(1).then(v=>{window.switchFinished=true;return v});});
      await b.waitForTimeout(200);
      assert.equal(await b.evaluate(()=>window.switchFinished),false);
      assert.equal(await b.evaluate(()=>S.activeSlot()),0);
      await a.evaluate(()=>releaseProbe());
      assert.equal(await b.evaluate(()=>window.switchResult),true);
      assert.equal(await b.evaluate(()=>S.activeSlot()),1);
      assert.equal(await b.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('im_slot_0'))[M.MASTERY_KEY]).scrolls),paid.scrolls);
      await hold();
      await b.evaluate(()=>{window.deleted=S.deleteSlotSafely(0).then(()=>true,()=>false);});
      await a.evaluate(()=>{
        const slot=JSON.parse(localStorage.getItem('im_slot_0'));slot.im_last_hero='zhangfei';
        localStorage.setItem('im_slot_0',JSON.stringify(slot));
      });
      await b.waitForFunction(()=>JSON.parse(localStorage.getItem('im_slot_0')).im_last_hero==='zhangfei');
      await a.evaluate(()=>releaseProbe());
      assert.equal(await b.evaluate(()=>window.deleted),false);
      assert.ok(await b.evaluate(()=>localStorage.getItem('im_slot_0')));
      console.log(fallback?'IDB':'Web Locks','switch and delete passed');

      // Simulate a crash before the slot pointer commit. The app must restore before game module evaluation.
      await a.evaluate(()=>{
        localStorage.setItem('im_slot_1',JSON.stringify({im_last_hero:'guanyu'}));
        localStorage.setItem('im_slot_transfer',JSON.stringify({from:1,to:0}));
        localStorage.setItem('im_last_hero','wrong-live-value');
      });
      await hold();
      const boot=await ctx.newPage();
      boot.on('pageerror', e=>console.error('boot:',e.stack));
      await boot.route(url=>url.pathname==='/src/main.ts',r=>r.fulfill({contentType:'text/javascript',body:'window.loadedGameWith=localStorage.getItem("im_last_hero")'}));
      await boot.goto(base+'/',{waitUntil:'domcontentloaded'});
      await boot.waitForTimeout(250);
      assert.equal(await boot.evaluate(()=>window.loadedGameWith),undefined);
      assert.equal(await a.evaluate(()=>localStorage.getItem('im_last_hero')),'wrong-live-value');
      await a.evaluate(()=>releaseProbe());
      try { await boot.waitForFunction(()=>window.loadedGameWith==='guanyu',null,{timeout:45000}); }
      catch (e) {
        console.error('boot state',await boot.evaluate(()=>({marker:window.loadedGameWith,body:document.body.innerText.slice(0,200),
          hero:localStorage.getItem('im_last_hero'),journal:localStorage.getItem('im_slot_transfer'),
          modules:performance.getEntriesByType('resource').map(r=>r.name).filter(n=>/startup|SnapshotBoot|\/main\.ts/.test(n))})));
        throw e;
      }
      assert.equal(await boot.evaluate(()=>localStorage.getItem('im_slot_transfer')),null);
      assert.equal(await b.evaluate(()=>S.switchSlotSafely(0)),true);
      assert.equal(await b.evaluate(()=>M.scrolls()),paid.scrolls);
      const owner=await a.evaluate(async()=>{
        const life=await import('/src/systems/BattlePageOwner.ts');
        const {beginBattle}=await import('/src/systems/BattleSnapshot.ts');
        await life.registerBattlePage();
        localStorage.setItem('im_last_hero','before-campaign');beginBattle('chapter');
        localStorage.setItem('im_last_hero','live-campaign');
        return JSON.parse(localStorage.getItem('im_battle_snapshot')).owner;
      });
      assert.match(owner,/^[a-f0-9]{32}$/);
      await boot.reload({waitUntil:'domcontentloaded'});
      await boot.waitForFunction(()=>window.loadedGameWith==='live-campaign');
      assert.ok(await boot.evaluate(()=>localStorage.getItem('im_battle_snapshot')));
      // Changing another tab's view now leaves the live campaign and its original keys in place.
      assert.equal(await b.evaluate(()=>S.switchSlotSafely(1)),true);
      assert.equal(await a.evaluate(()=>S.activeSlot()),0);
      assert.equal(await a.evaluate(()=>localStorage.getItem('im_last_hero')),'live-campaign');
      await a.close();
      await boot.reload({waitUntil:'domcontentloaded'});
      await boot.waitForFunction(()=>window.loadedGameWith==='before-campaign');
      assert.equal(await boot.evaluate(()=>localStorage.getItem('im_battle_snapshot')),null);
      await b.evaluate(()=>{
        localStorage.setItem('im_battle_snapshot',JSON.stringify({slot:0,keys:{im_last_hero:'legacy-save'}}));
      });
      await boot.reload({waitUntil:'domcontentloaded'});
      await boot.waitForFunction(()=>window.loadedGameWith==='legacy-save');
      console.log(fallback?'IndexedDB':'Web Locks','wallet/replay, locked switch/boot, stale deletion, active owner, closed owner and legacy recovery passed');
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
