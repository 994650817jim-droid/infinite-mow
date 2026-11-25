import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [repo=process.env.GAME_REPO??resolve(import.meta.dirname,'..'),base=process.env.BASE??'http://127.0.0.1:5286',label='star-retention']=process.argv.slice(2);
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const dir=resolve(process.env.GAUNTLET_EVIDENCE??'output/gauntlet-experience/perf');mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']});
try{
 const p=await browser.newPage({viewport:{width:1280,height:720}});await p.routeWebSocket(/127\.0\.0\.1/,()=>{});
 await p.goto(base+'/?gauntlet=1&dev=1&layout=desktop',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:120000});
 const setup=await p.evaluate(()=>{
   const s=window.__game.scene.getScene('GauntletGameScene'),g=s.player.growth;
   s.player.damageImmune=true;
   const card=s.extraCards().find(c=>c.option.id==='gauntlet_star_command.K2')?.option;
   if(!card)throw Error('Specified normal star reward is missing from the current pool');
   const prior=[...g.stars];s.showLoot('测试战利品','固定抽到一张正常卡',[card],()=>{});s.chooseUpgrade(0);
   const afterReward=[...g.stars];g.unallocated=1;
   s.pointsButton.emit('pointerdown');return {reward:card.id,prior,afterReward,mode:s.mode};
 });
 assert.ok(setup.afterReward.includes('command.K2'));
 await p.waitForFunction(()=>window.__game.scene.getScene('GauntletGameScene').starPanel?.built);
 const result=await p.evaluate(()=>{
   const s=window.__game.scene.getScene('GauntletGameScene'),g=s.player.growth,panel=s.starPanel;
   const choice=[...panel.nodes.values()].find(v=>v.n.region==='strength'&&panel.block(v.n.id)===null);
   const before=g.unallocated;choice.hit.emit('pointerup',{upTime:s.time.now});panel.lightBtn.hit.emit('pointerup');
   return {paidNode:choice.n.id,spent:before-g.unallocated,afterSpend:[...g.stars],offeredAgain:s.extraCards().some(c=>c.option.id==='gauntlet_star_command.K2')};
 });
 writeFileSync(join(dir,label+'.json'),JSON.stringify({...setup,...result},null,2));
 assert.equal(result.spent,1);assert.ok(result.afterSpend.includes('command.K2'),'unconnected reward disappeared after a star-map purchase');
 assert.equal(result.offeredAgain,false,'owned reward re-entered the pool');
}finally{await browser.close();}
