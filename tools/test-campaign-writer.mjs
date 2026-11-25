import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const root=process.env.GAME_REPO ?? resolve(import.meta.dirname,'..');
const {chromium}=createRequire(join(root,'package.json'))('playwright');
const base=process.env.BASE ?? 'http://127.0.0.1:5294';
const browser=await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const evidence=[];
try {
  for(const fallback of [false,true]) {
    const ctx=await browser.newContext();
    if(fallback)await ctx.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
    await ctx.route(/\/__writer(?:\?|$)/,r=>r.fulfill({contentType:'text/html',body:'<meta charset=utf-8><title>Isolated save test</title>'}));
    const boot=async (p,dev=false)=>{
      await p.goto(base+'/__writer'+(dev?'?dev=1':''));
      await p.evaluate(async()=>{
        if(location.search)await import('/src/dev/TestSave.ts');
        window.S=await import('/src/systems/SaveSlots.ts');
        window.B=await import('/src/systems/BattleSnapshot.ts');
        window.pay=await import('/src/systems/GauntletSettlement.ts');
        S.installSlotView?.();
        await (await import('/src/systems/BattleSnapshotBoot.ts')).recoverBeforeBoot();
      });
    };
    const open=async p=>p.evaluate(async()=>{try{await B.openBattleCheckpoint('GameScene');return 'entered'}catch(e){return e.message}});
    const val=p=>p.evaluate(()=>localStorage.getItem('im_last_hero'));
    const a=await ctx.newPage(),b=await ctx.newPage();
    await boot(a);await boot(b);
    await a.evaluate(()=>localStorage.setItem('im_last_hero','zhaoyun'));
    const starts=await Promise.all([open(a),open(b)]);
    assert.deepEqual([...starts].sort(),['entered','该存档已有战役进行中'].sort(),JSON.stringify(starts));
    const [owner,other]=starts[0]==='entered'?[a,b]:[b,a];
    await owner.evaluate(()=>localStorage.setItem('im_last_hero','guanyu'));
    assert.equal(await other.evaluate(()=>B.rollbackBattle()),false);
    await other.evaluate(()=>B.commitBattle());
    assert.equal(await open(other),'该存档已有战役进行中');
    assert.equal(await val(owner),'guanyu');
    const deferred=await other.evaluate(()=>pay.settleGauntlet('gauntlet:writer-'+S.activeSlot(),6,false));
    assert.equal(deferred.deferred,true);
    await owner.evaluate(()=>B.commitBattle(true)); // battle won, camp remains open
    assert.equal(await open(other),'该存档已有战役进行中');
    await owner.waitForFunction(()=>JSON.parse(localStorage.getItem('im_gauntlet_paid_v2')||'{}')['gauntlet:writer-0']?.scrolls===3);
    await other.evaluate(()=>S.switchSlotSafely(1));await boot(other);
    assert.equal(await other.evaluate(()=>S.activeSlot()),1);
    assert.equal(await val(other),null);
    await other.evaluate(()=>localStorage.setItem('im_last_hero','huangzhong'));
    assert.equal(await open(other),'entered');
    await other.evaluate(()=>localStorage.setItem('im_last_hero','zhugeliang'));
    assert.equal(await val(owner),'guanyu');
    assert.equal(await open(owner),'entered');
    await owner.evaluate(()=>localStorage.setItem('im_last_hero','zhangfei'));
    const third=await ctx.newPage();await boot(third);
    if(await third.evaluate(()=>S.activeSlot())!==1) {
      await third.evaluate(()=>S.switchSlotSafely(1));await boot(third);
    }
    assert.equal(await open(third),'该存档已有战役进行中');
    const blockedDelete=await owner.evaluate(()=>S.deleteSlotSafely(1).then(()=>false,()=>true));
    assert.equal(blockedDelete,true);
    if(!fallback){
      const cdp=await ctx.newCDPSession(other);
      const crashed=other.waitForEvent('crash');
      void cdp.send('Page.crash').catch(()=>{});
      await crashed;
    }
    await other.close(); // no explicit game rollback
    assert.equal(await open(third),'entered');
    assert.equal(await val(third),'huangzhong');
    assert.equal(await val(owner),'zhangfei');
    await third.evaluate(()=>localStorage.setItem('im_last_hero','new-saved-progress'));
    await third.evaluate(()=>B.commitBattle());
    await boot(third);await boot(third);
    assert.equal(await val(third),'new-saved-progress');
    await boot(owner); // reload must restore only its own pending fight
    assert.equal(await val(owner),'guanyu');
    assert.equal(await open(owner),'entered');
    await owner.evaluate(()=>localStorage.setItem('im_last_hero','transient'));
    await owner.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    const next=await ctx.newPage();await boot(next);
    if(await next.evaluate(()=>S.activeSlot())!==0) {
      await next.evaluate(()=>S.switchSlotSafely(0));await boot(next);
    }
    assert.equal(await open(next),'entered');
    await owner.evaluate(()=>{try{localStorage.setItem('im_last_hero','stale')}catch{};B.commitBattle();B.rollbackBattle();});
    assert.equal(await val(next),'guanyu');
    assert.equal(await next.evaluate(()=>B.battleInProgress()),'GameScene');
    await next.evaluate(()=>B.rollbackBattle());
    await next.evaluate(()=>{
      localStorage.setItem('im_battle_snapshot',JSON.stringify({slot:1,label:'legacy',at:0,keys:{im_last_hero:'stale-other-slot'}}));
    });
    await boot(next);
    assert.equal(await val(next),'guanyu');
    assert.equal(await next.evaluate(()=>B.battleInProgress()),null);
    assert.equal(await open(next),'entered');
    const dev=await ctx.newPage();await boot(dev,true);
    assert.equal(await dev.evaluate(()=>B.battleInProgress()),null,'DEV must not inherit a live campaign');
    assert.equal(await open(dev),'entered');
    await dev.evaluate(()=>localStorage.setItem('im_last_hero','dev-only'));
    await dev.evaluate(()=>B.rollbackBattle());
    assert.equal(await next.evaluate(()=>B.battleInProgress()),'GameScene');
    assert.equal(await val(next),'guanyu');
    await next.evaluate(()=>B.commitBattle());
    await ctx.close();
    evidence.push({lock:fallback?'IndexedDB':'Web Locks',starts,otherSlot:'independent',ownerExit:fallback?'closed':'renderer crash',closedOwnerRecovered:true,staleOwnerRejected:true,gauntletPaid:true});
  }
  if(process.env.PROOF)writeFileSync(process.env.PROOF,JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence));
}finally{await browser.close()}
