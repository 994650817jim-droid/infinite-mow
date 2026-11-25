import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=process.env.GAME_REPO||resolve(import.meta.dirname,'..'),base=process.env.BASE||'http://127.0.0.1:5294';
const {chromium}=createRequire(join(root,'package.json'))('playwright'),browser=await chromium.launch({channel:'chrome'});
try{
 const ctx=await browser.newContext(),campaign=await ctx.newPage(),reward=await ctx.newPage();
 for(const [i,p] of [campaign,reward].entries()){
   p.on('pageerror',e=>console.log('game error',i,String(e),e.stack));
   p.on('console',m=>{if(m.type()==='error') console.log('console',i,m.text().slice(0,220));});
   p.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')console.log('request failed',i,r.url().slice(-100),r.failure())});
 }
 const url=base+'/?gauntlet=1&layout=desktop';
 const open=async p=>{
   await p.goto(url,{waitUntil:'domcontentloaded'});console.log('loaded html',p===campaign?'campaign':'claimant');
   let changed=Date.now(),last='',lastPrint=0;
   for(;;){
     const state=await p.evaluate(()=>{
       const g=window.__game;
       return {ready:!!g?.scene.getScene('GauntletGameScene')?.player?.alive,
         loader:g?.scene.scenes.filter(s=>s.sys.settings.status>1 && s.sys.settings.status<8).map(s=>[s.sys.settings.key,s.sys.settings.status,s.load.totalComplete,s.load.totalFailed,s.load.list.size,s.load.inflight.size])??[],
         requests:performance.getEntriesByType('resource').length};
     });
     if(state.ready)return;
     const key=JSON.stringify(state);if(key!==last){last=key;changed=Date.now();}
     if(Date.now()-lastPrint>15000){console.log('boot progress',key);lastPrint=Date.now();}
     assert.ok(Date.now()-changed<65000,'loader stopped advancing: '+key);
     await p.waitForTimeout(1600);
   }
 };
 await open(campaign);
 await campaign.evaluate(()=>{const g=window.__game;g.registry.set('runConfig',{character:'zhaoyun',chapter:'huangjin',stage:1});g.scene.getScene('GauntletGameScene').scene.start('GameScene')});
 await campaign.waitForFunction(()=>window.__game?.scene.getScene('GameScene')?.player?.alive && JSON.parse(localStorage.getItem('im_battle_snapshot')||'null')?.owner,null,{timeout:120000,polling:100});
 const owner=await campaign.evaluate(()=>JSON.parse(localStorage.getItem('im_battle_snapshot')).owner);
 await open(reward);
 assert.equal(await reward.evaluate(()=>JSON.parse(localStorage.getItem('im_battle_snapshot')).owner),owner,'opening a second game must not roll back the live campaign');
 const id=await reward.evaluate(async()=>{const s=window.__game.scene.getScene('GauntletGameScene');s.gKills=s.gOrder.slice(0,6);s.gWave=7;await s.finish(false,'death');return s.claimId});
 await reward.getByText('战报已保存 · 普通战役结束后入账').waitFor();
 await campaign.evaluate(()=>window.__game.scene.getScene('GameScene').leaveBattle('MenuScene',null));
 await reward.getByText(/已入账.*240.*3/).waitFor({timeout:40000});
 const evidence=await reward.evaluate(id=>({receipt:JSON.parse(localStorage.getItem('im_gauntlet_paid_v2'))[id],feedback:document.querySelector('.report-reward').innerText,score:JSON.parse(localStorage.getItem('im_gauntlet_modes_v1'))}),id);
 assert.equal(evidence.receipt.scrolls,3);assert.equal(evidence.receipt.provisions,240);assert.equal(evidence.score['solo-standard'].kills,6);
 if(process.env.PROOF)writeFileSync(process.env.PROOF,JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence));
}finally{await browser.close()}
