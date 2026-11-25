import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {installGateCapture} from './capture.mjs';
import {evidenceDir,historyFile} from './paths.mjs';
const [repo,base='http://127.0.0.1:5286']=process.argv.slice(2);
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const original=JSON.parse(await readFile(historyFile,'utf8'));
const entry=original.transitions.find(r=>r.wave===15&&r.phase==='choice');
const data={entry,order:original.randomLineup,bosses:original.transitions.filter(r=>r.phase==='boss').map(r=>r.boss),
  picks:original.picks.filter(r=>r.wave<=15),buys:original.recruits.filter(r=>r.wave<=15).length};
const {chromium}=createRequire(join(resolve(repo),'package.json'))('playwright');
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--disable-gpu']});
try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.routeWebSocket(/127\.0\.0\.1/,()=>{});
  await page.route(/\/src\/main\.ts(?:\?|$)/,async route=>{
    const res=await route.fetch(),src=await res.text();
    assert(src.includes('type: Phaser.AUTO,'));
    await route.fulfill({response:res,body:src.replace('type: Phaser.AUTO,','type: Phaser.CANVAS,')});
  });
  await page.addInitScript(()=>{window.armyConfig={hero:'zhangfei',seed:177,build:'weapon'};localStorage.setItem('im_last_hero','zhangfei');});
  await page.goto(base+'/?gauntlet=1&unlock=real&layout=desktop',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.scene.getScene('GauntletGameScene')?.player?.alive,null,{timeout:120000});
  await page.evaluate(installGateCapture);
  const frozen=await page.evaluate(async d=>{
    const s=window.__game.scene.getScene('GauntletGameScene'),p=s.player,g=p.growth,v=d.entry;
    const [R,M,U,B,H,attr]=await Promise.all([import('/src/data/gauntlet.ts'),import('/src/data/mythicGauntlet.ts'),import('/src/data/upgrades.ts'),import('/src/data/weaponBranches.ts'),import('/src/data/mounts.ts'),import('/src/data/attributes.ts')]);
    const pool=[...R.GAUNTLET_POOL,...M.GHOST_GENERALS,...M.DIVINE_GENERALS];
    const find=(key,value)=>{const b=pool.find(x=>x[key]===value);if(!b)throw Error('Unknown historical boss '+value);return b;};
    const formation=d.bosses.map(n=>find('name',n));
    s.gWave=15;s.gTier='ghost';s.gPhase='choice';s.gMilestones=2;s.gOrder=d.order.map(id=>find('id',id));s.roster={ghost:formation.slice(10,15),divine:formation.slice(15)};
    s.gKills=formation.slice(0,15);s.gCur=s.gKills.at(-1);s.elapsed=v.time;s.combatNow=v.time*1000;
    s.kills=v.kills;s.damageDealt=v.damage;s.allyDamageDealt=0;s.playerDamageDealt=0;
    p.sprite.setPosition(...v.position);p.level=v.level;p.xp=v.xp;s.heroLv=v.level;g.heroLevel=v.level;g.attrMax=attr.attributeCap(v.level);p.softLevel=s.stageSuggestedLevel();p.xpNext=p.needFor(v.level);g.unallocated=0;
    const w=p.weapons[0],branch=B.branchById(v.weapon[0][2]);
    while(w.level<v.weapon[0][1])U.weaponUpgrade(w,p).apply(p,p.weapons,g);
    U.branchOption(w,branch).apply(p,p.weapons,g);
    g.build.branchSchool=branch.school;
    U.overOption(w,branch,v.hero).apply(p,p.weapons,g);U.overOption(w,branch,v.hero).apply(p,p.weapons,g);g.weaponOver=w.over;
    for(const pick of d.picks){
      const id=pick.choice;
      if(id.startsWith('martial_')){const mastery=id.replace(/^martial_/,'').replace(/_\d+$/,'');if(!g.learn(mastery))throw Error('Invalid historical mastery '+id);}
      if(id.startsWith('tactic_')){if(!g.build.learn(id.replace('tactic_','')))throw Error('Invalid historical tactic '+id);}
      if(id.startsWith('gauntlet_star_')&&v.stars.includes(id.replace('gauntlet_star_','')))g.grantCardStar(id.replace('gauntlet_star_',''));
    }
    g.setStars(v.stars);if(v.stars.some(id=>!g.stars.includes(id)))throw Error('Historical stars no longer legal');
    g.stars=[...v.stars];Object.assign(g.attributes,v.attributes);p.passive.areaMul=g.areaMultiplier();
    s.gHorse=H.HORSES.find(h=>h.id==='chitu');s.refreshGear();s.equipMount(s.gHorse);
    for(const b of formation.slice(0,3))s.takeFollower(b);
    for(const [kind,count] of [['spearman',2],['archer',3]]){
      s.legion.train(kind,true);s.legion.train(kind,true);s.legion.recruit(kind,count,true);
    }
    const veteran=s.legion.units.filter(u=>u.kind==='spearman');for(const u of veteran)u.hp=u.maxHp/2;
    s.legion.food=v.food;s.legion.dead=v.fallen;s.legion.recruited=v.recruits;s.gRecruits={men:v.recruits,times:d.buys};
    s.gBuildLog=d.picks.filter(q=>q.choice.startsWith('gauntlet_star_')&&v.stars.includes(q.choice.replace('gauntlet_star_',''))).map(q=>({id:q.choice,name:q.name,cat:'star',rarity:'rare'}));
    p.hp=p.maxHp*(v.hp/v.maxHp);s.pendingLevels=0;s.supplies.pouch.splice(0);s.legion.order='guard';
    window.captureGate();return window.gateSnapshot;
  },data);
  assert.deepEqual(errors,[]);
  assert.deepEqual([frozen.life.level,frozen.stars,frozen.pack.army.food,frozen.followers.length,frozen.soldiers.length],[25,entry.stars,128,3,5]);
  frozen.provenance={fixture:'Reconstructed subset of a historical natural gate, normalized for counterfactuals',recorded:entry,
    fixedAssumptions:['Native reconstructed maximum HP, set fully healthy to match the recorded full-health fraction',
    'Retain recorded native weapon branch and both over-level rewards, martial ranks, current 25 stars, tactics and Red Hare',
    'Random affixes, equipment and charms omitted; temporary pickups, fields, potions, stochastic procs and cooldowns reset',
    'Three recorded named followers at full HP; two level-3 spearmen at 50% and three level-3 archers at full HP, under the legal wave-15 recruit pool',
    'No formation, default guard order; initial field cleared. Run cumulative damage split and carried XP totals not available; subsequent measurements are deltas',
    'Both arms start with identical full JSON. The historical gross damage and original hero position are copied for comparison only.']};
  await writeFile(join(evidenceDir,'historic-gate-fixture.json'),JSON.stringify(frozen,null,2)+'\n');
  console.log({level:frozen.life.level,hp:frozen.life.hp,stars:frozen.stars.length,weapon:frozen.weapons,roster:frozen.roster,army:frozen.soldiers});
}finally{await browser.close();}
