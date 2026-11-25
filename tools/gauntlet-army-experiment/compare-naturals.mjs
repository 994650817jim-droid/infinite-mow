import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {evidenceDir} from './paths.mjs';

const round=x=>Math.round(x*100)/100;
const load=async (run,file)=>JSON.parse(await readFile(join(evidenceDir,run,file+'.json'),'utf8'));
function classify(hit){
  const d=hit.impact;
  if(!d)return hit.cause==='projectile'?'unknown-projectile':hit.cause;
  if(d.category==='trait-arrow')return d.category+'/'+(d.trait??'unknown-trait');
  return d.category==='mythic-skill'?d.category+'/'+d.boss+'/'+d.move:d.category;
}
function countHit(counters,key,hp,dead){
  const row=counters[key]??={hits:0,hp:0,deaths:0};
  row.hits++;row.hp+=hp;if(dead)row.deaths++;
}
const pairs=[];
for(const hero of ['zhangfei','huangzhong']){
  const samples=[];
  for(const strategy of ['army','personal']){
    const run=hero+'-'+strategy;
    const [s,r,a,p]=await Promise.all(['summary','route','army','progress'].map(f=>load(run,f)));
    assert.ok(['completed','natural-defeat'].includes(s.terminal));
    assert.ok(!p.errors.length&&!r.current.revivalUsed&&!s.checkpoint);
    assert.equal(s.units-s.deaths,s.remaining);
    assert.equal(s.waves.reduce((n,w)=>n+w.dead,0),s.deaths);
    assert.equal(s.waves.reduce((n,w)=>n+w.born,0),s.units);
    assert.equal(s.waves.reduce((n,w)=>n+w.cost,0),s.spent);
    if(strategy==='personal')assert.equal(s.spent,0);
    const body=a.units.reduce((n,u)=>n+u.dealt,0),shields=a.units.reduce((n,u)=>n+u.shields,0);
    const incoming={},playerProjectiles={},projectileTexture={},recruitOrigins={};
    for(const unit of a.units){
      const row=recruitOrigins[unit.origin]??={units:0,body:0,dead:0,spent:0};
      row.units++;row.body+=unit.dealt;row.spent+=unit.cost;if(unit.death)row.dead++;
    }
    for(const hit of a.events.filter(e=>e.action==='in')){
      countHit(incoming,classify(hit),hit.hp,hit.after<=0);
      if(hit.impact?.texture)countHit(projectileTexture,hit.impact.texture,hit.hp,hit.after<=0);
    }
    for(const row of Object.values(incoming))row.hp=round(row.hp);
    for(const hit of a.playerBullets)countHit(playerProjectiles,classify({impact:hit}),hit.hp,false);
    for(const row of Object.values(playerProjectiles))row.hp=round(row.hp);
    assert.equal(Object.values(incoming).reduce((n,v)=>n+v.deaths,0),s.deaths);
    const starting=r.beginning;
    const opening=Object.fromEntries(['wave','tier','phase','hp','maxHp','hero','weapon','overlevels','stars','attributes','army','food','followers','recruits','level','xp','position'].map(key=>[key,starting[key]]));
    const decisionPicks=r.picks.filter(pick=>pick.armyOffered.length);
    const combatStart=r.transitions.find(x=>x.phase==='boss')?.time??null;
    const outcomes={clear:s.cleared,lastWave:s.lastWave,terminal:s.terminal,endTime:s.endTime,firstBossAt:combatStart,
      endingBoss:s.terminalBoss,endingBossHP:s.terminalBossHP,playerHP:s.lastHP,maxHP:s.maxHP,lastLevel:r.current.level,
      reachedGhost:r.transitions.some(x=>x.tier==='ghost'),reachedDivine:s.gate,lowestHPFraction:s.lowestSampledHPRatio,
      spend:s.spent,wallet:s.gold,recruited:s.units,dead:s.deaths,remaining:s.remaining,enemyBody:round(body),enemyShields:round(shields),
      per100Coins:s.spent?round(100*body/s.spent):null,armyEligiblePicks:decisionPicks.length,armyPicks:decisionPicks.filter(v=>v.armyChosen).length,
      allPicks:r.picks.length,armyKit:{weapon:r.current.weapon,overlevels:r.current.overlevels,attributes:r.current.attributes,followers:r.current.followers},
      incoming,playerProjectiles,projectileTexture,recruitOrigins,byKind:s.byKind,lifetime:s.lifetime};
    samples.push({run,opening,roster:r.roster,source:p.sourceSHA256,seed:s.seed,order:s.order,route:s.route,outcomes});
  }
  const [army,personal]=samples;
  for(const key of ['opening','roster','source','seed','order','route'])assert.deepEqual(army[key],personal[key],hero+' mismatched '+key);
  pairs.push({hero,seed:army.seed,order:army.order,route:army.route,source:army.source,opening:army.opening,roster:army.roster,
    army:army.outcomes,personal:personal.outcomes});
}
await writeFile(join(evidenceDir,'paired-natural.json'),JSON.stringify(pairs,null,2));
console.log(pairs.map(p=>[p.hero,p.army.clear,p.personal.clear,p.army.per100Coins]));
