import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {evidenceDir as root} from './paths.mjs';
const read=async(...parts)=>JSON.parse(await readFile(join(root,...parts),'utf8'));
const cases=[];
for(const item of (await readdir(root,{withFileTypes:true})).filter(f=>f.isDirectory())){
  let summary;try{summary=await read(item.name,'summary.json');}catch{continue;}
  if(!summary.checkpoint)continue;
  const [entry,reward,progress]=await Promise.all(['entry.json','reward.json','progress.json'].map(f=>read(item.name,f)));
  cases.push({summary,entry,reward,progress});
}
const pairs=[];
for(const b of cases.filter(v=>v.reward.arm!=='A')){
  const matches=cases.filter(v=>v.reward.arm==='A'&&v.progress.config.rosterProfile===b.progress.config.rosterProfile&&v.progress.config.gateFile===b.progress.config.gateFile&&v.summary.seed===b.summary.seed&&v.summary.build===b.summary.build&&v.summary.order===b.summary.order);
  if(!matches.length)continue;
  assert.equal(matches.length,1,'Expected one control per gate/seed/order/policy');
  const [a]=matches;
  assert.deepEqual(a.entry,b.entry,'Pre-intervention entry mismatch');
  assert.deepEqual(a.reward.before,b.reward.before,'Native gate reward inputs differ');
  const gameplayHashes=record=>Object.fromEntries(Object.entries(record).filter(([path])=>path.startsWith('src/')));
  assert.deepEqual(gameplayHashes(a.progress.sourceSHA256),gameplayHashes(b.progress.sourceSHA256),'Compared different versions of the gameplay source');
  const measure=v=>{
    const s=v.summary;
    return {clear:s.cleared,finished:s.terminal==='completed',hp:s.lastHP,maxHP:s.maxHP,minHPRatio:s.divineMinSampledHPRatio,
      divineSeconds:Math.round((s.endTime-v.entry.timer)*100)/100,kills:s.enemyKills,grossDamage:s.grossDamage,
      armyBodyDamage:Math.round(Object.values(s.byKind).reduce((n,b)=>n+b.dealt,0)),armyLost:s.deaths,armyEnd:s.remaining,goldEnd:s.gold,
      recruitExpense:s.spent,deathBoss:s.terminal==='natural-defeat'?s.terminalBoss:null};
  };
  pairs.push({control:a.summary.name,treatment:b.summary.name,seed:b.summary.seed,hero:b.summary.hero,order:b.summary.order,build:b.summary.build,
    offers:b.reward.offers,selected:b.reward.selected,entryEqual:true,sourceEqual:true,A:measure(a),B:measure(b)});
}
await writeFile(join(root,'paired-results.json'),JSON.stringify(pairs,null,2)+'\n');
console.log(pairs);
