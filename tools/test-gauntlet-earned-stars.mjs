import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch({channel:'chrome',args:['--mute-audio']});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  const errors = [];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(base+'/?gauntlet=1&dev=1&layout=desktop', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:120000});
  const id='command.K2';
  const award=await page.evaluate(id=>{
    const scene=window.__game.scene.getScene('GauntletGameScene'), growth=scene.player.growth;
    window.oldGrowth=growth;
    const option=scene.extraCards().find(c=>c.option.id==='gauntlet_star_'+id)?.option;
    if (!option) throw Error('Reward missing from initial pool');
    const free=growth.unallocated;
    scene.showLoot('测试战利品','', [option], ()=>{});
    scene.chooseUpgrade(0);
    scene.lightCardStar(id); // The same reward delivered twice must remain one card.
    const spent=free-growth.unallocated;
    growth.unallocated=2;
    scene.pointsButton.emit('pointerdown');
    return {count:growth.stars.filter(x=>x===id).length, spent};
  },id);
  assert.deepEqual(award,{count:1,spent:0});
  await page.waitForFunction(()=>window.__game.scene.getScene('GauntletGameScene').starPanel?.built);
  const result=await page.evaluate(async id=>{
    const {STAR_BY_ID,canLight,orderStars,planStarPath,starMapOn}=await import('/src/data/starMap.ts');
    const {RunGrowth}=await import('/src/systems/RunGrowth.ts');
    const {heroStars}=await import('/src/systems/HeroProgress.ts');
    const scene=window.__game.scene.getScene('GauntletGameScene'), g=scene.player.growth, panel=scene.starPanel;
    const buy=target=>{
      const item=panel.nodes.get(target);
      item.hit.emit('pointerup',{upTime:scene.time.now});
      const hint=panel.rStatus.text;
      const before=g.unallocated;
      panel.lightBtn.hit.emit('pointerup');
      return {target,hint,cost:before-g.unallocated};
    };
    const fromGate=[...panel.nodes.values()].find(v=>v.n.region==='strength' && canLight([],v.n.id,g.starGate));
    if (!fromGate) throw Error('Expected a legal gate purchase');
    const gatePurchase=buy(fromGate.n.id);
    const afterGate=[...g.stars];
    const next=STAR_BY_ID.get(id).links.find(n=>panel.block(n)===null && !canLight([fromGate.n.id],n,g.starGate));
    if (!next) throw Error('Expected an adjacent star requiring the earned card');
    const route=planStarPath(g.stars,next,g.starGate);
    const adjacent=buy(next);
    // Re-rendering and replaying the validated list must retain previously purchased neighbors.
    g.setStars([...g.stars,'not-a-real-star']);
    const afterAdjacent=[...g.stars];
    const alreadyBlocked=panel.block(next);
    const blockedWhenEmpty=[...panel.nodes.values()].some(v=>canLight(g.stars,v.n.id,g.starGate) && !!panel.block(v.n.id));
    const regular=new RunGrowth(g.character);
    regular.unallocated=1;
    const ordinaryAward=regular.grantCardStar(id);
    regular.setStars([id,next]);
    const ordinaryBlocked=!regular.lightStar(scene.player,next);
    return {starMapOn:starMapOn(),gatePurchase,afterGate,route,adjacent,afterAdjacent,alreadyBlocked,blockedWhenEmpty,
      offeredAgain:scene.extraCards().some(c=>c.option.id==='gauntlet_star_'+id),persisted:heroStars(g.character).includes(id),
      ordinaryAward,ordinaryBlocked,ordinaryStars:regular.stars,ordinaryFree:regular.unallocated,strictOrder:orderStars([id,next],g.starGate)};
  },id);
  assert.ok(result.starMapOn);
  assert.equal(result.gatePurchase.cost,1);
  assert.ok(result.afterGate.includes(id));
  assert.deepEqual(result.route,{path:[result.adjacent.target],cost:1,block:null});
  assert.match(result.adjacent.hint,/1 星/);
  assert.equal(result.adjacent.cost,1);
  assert.deepEqual(new Set(result.afterAdjacent),new Set([id,result.gatePurchase.target,result.adjacent.target]));
  assert.equal(result.alreadyBlocked,'已点亮');
  assert.equal(result.blockedWhenEmpty,true);
  assert.equal(result.offeredAgain,false);
  assert.equal(result.persisted,false);
  assert.equal(result.ordinaryAward,false);
  assert.equal(result.ordinaryBlocked,true);
  assert.deepEqual(result.ordinaryStars,[]);
  assert.deepEqual(result.strictOrder,[]);
  assert.equal(result.ordinaryFree,1);
  await page.evaluate(()=>{ window.__game.scene.getScene('GauntletGameScene').scene.restart(); });
  await page.waitForFunction(()=>{
    const scene=window.__game.scene.getScene('GauntletGameScene');
    return scene.player?.alive && scene.player.growth!==window.oldGrowth && scene.player.growth.cardStars;
  },null,{timeout:120000});
  const fresh=await page.evaluate(id=>{
    const scene=window.__game.scene.getScene('GauntletGameScene');
    return {stars:scene.player.growth.stars,offered:scene.extraCards().some(c=>c.option.id==='gauntlet_star_'+id)};
  },id);
  assert.deepEqual(fresh,{stars:[],offered:true});
  assert.deepEqual(errors,[]);
  console.log('Reward survives gate and adjacent paid purchases; deduplication, zero points, restart and regular campaign validation passed');
  if (process.argv[2]) writeFileSync(process.argv[2],JSON.stringify({award,result,fresh,errors},null,2));
} finally { await browser.close(); }

