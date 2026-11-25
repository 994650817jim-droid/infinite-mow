import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const [oldRun,newRun,oldRepo,newRepo]=process.argv.slice(2);
if(!newRepo)throw Error('Supply baseline run, treated run, baseline archive and treated archive');
const hash=text=>createHash('sha256').update(text).digest('hex');
async function sourceTree(root){
  const files={};
  async function walk(rel){
    const entries=await readdir(join(root,rel),{withFileTypes:true});
    for(const e of entries){
      const path=rel+'/'+e.name;
      if(e.isDirectory())await walk(path);
      else if(e.isFile())files[path]=hash((await readFile(join(root,path),'utf8')).replaceAll('\r\n','\n'));
    }
  }
  await walk('src');
  return {files,sha256:hash(Object.keys(files).sort().map(k=>k+' '+files[k]).join('\n'))};
}
const sources=await Promise.all([oldRepo,newRepo].map(sourceTree));
const changed=Array.from(new Set([...Object.keys(sources[0].files),...Object.keys(sources[1].files)])).sort()
  .filter(f=>sources[0].files[f]!==sources[1].files[f]).map(path=>({path,before:sources[0].files[path]??null,after:sources[1].files[path]??null}));
const provenance={treeHashMethod:'sorted logical path and SHA256 of LF-normalized UTF-8 under src',before:sources[0].sha256,after:sources[1].sha256,
  beforeCount:Object.keys(sources[0].files).length,afterCount:Object.keys(sources[1].files).length,changed};
await writeFile(join(newRun,'source-diff.json'),JSON.stringify(provenance,null,2));
if(process.argv.includes('--source-only')){console.log(provenance.before,provenance.after,changed.map(item=>item.path));process.exit(0);}
const load=async(dir,f)=>JSON.parse(await readFile(join(dir,f+'.json'),'utf8'));
const [a,b]=await Promise.all([oldRun,newRun].map(async dir=>{
  const [m,r,army,s]=await Promise.all(['progress','route','army','summary'].map(f=>load(dir,f)));
  const q=r.beginning;
  const opening=Object.fromEntries(['hero','hp','maxHp','level','xp','weapon','overlevels','stars','attributes','army','fallen','food','recruits','followers','position'].map(k=>[k,q[k]]));
  assert.ok(['completed','natural-defeat'].includes(m.terminal)&&!r.current.revivalUsed);
  const byPhase=r.transitions.filter(x=>x.phase==='boss').map(x=>({wave:x.wave,boss:x.boss,time:x.time,hp:x.hp,maxHp:x.maxHp,army:x.army}));
  const purchase=a=>a.notes.map(n=>({wave:n.w,kind:a.units.find(u=>u.id===n.ids[0])?.kind,cost:n.cost,time:n.t}));
  return {dir,m,r,army,s,opening,byPhase,purchases:purchase(army)};
}));
for(const k of ['hero','seed','order','build','route'])assert.equal(a.m.config[k],b.m.config[k]);
assert.deepEqual(a.opening,b.opening);assert.deepEqual(a.r.roster,b.r.roster);
const compact=(row,fields)=>row?Object.fromEntries(fields.map(k=>[k,row[k]])):null;
const firstDiff=(aa,bb,key,fields)=>{
  for(let i=0;i<Math.max(aa.length,bb.length);i++)if(JSON.stringify(aa[i]&&key(aa[i]))!==JSON.stringify(bb[i]&&key(bb[i])))
    return {oneBased:i+1,before:compact(aa[i],fields),after:compact(bb[i],fields)};
  return null;
};
// Charm instance IDs contain a wall-clock component. Compare card family for the
// offer and the displayed name as well for a chosen charm. Keep raw IDs as evidence.
const cardFamily=id=>id.startsWith('gauntlet_charm_')?'gauntlet_charm':id;
const decision=(a,b)=>firstDiff(a,b,v=>[cardFamily(v.choice),v.name],['time','wave','name','choice','offered']);
const offered=(a,b)=>firstDiff(a,b,v=>v.offered.map(cardFamily),['time','wave','name','choice','offered']);
const purchase=(a,b)=>firstDiff(a,b,v=>[v.wave,v.kind,v.cost],['time','wave','kind','cost']);
const makeWave=(run,w)=>{
  const s=run.s.waves.find(v=>v.wave===w);if(!s)return null;
  const pay=run.purchases.filter(v=>v.wave===w),picks=run.r.picks.filter(v=>v.wave===w);
  return {boss:run.byPhase.find(v=>v.wave===w)?.boss??null,spawn:run.byPhase.find(v=>v.wave===w)??null,
    cost:s.cost,recruited:s.born,deaths:s.dead,opening:s.opening,atClear:s.atClear,end:s.closing,body:s.damage,
    bought:pay.map(v=>v.kind),choices:picks.map(v=>v.name)};
};
const outcome=x=>({terminal:x.s.terminal,clear:x.s.cleared,lastWave:x.s.lastWave,boss:x.s.terminalBoss,bossHP:x.s.terminalBossHP,
  time:x.s.endTime,spent:x.s.spent,wallet:x.s.gold,units:x.s.units,dead:x.s.deaths,remaining:x.s.remaining,
  body:x.army.units.reduce((n,u)=>n+u.dealt,0),shield:x.army.units.reduce((n,u)=>n+u.shields,0),byKind:x.s.byKind,lifetime:x.s.lifetime});
const output={provenance,config:{hero:a.m.config.hero,seed:a.m.config.seed,route:a.m.config.route,build:a.m.config.build,order:a.m.config.order},
  opening:a.opening,roster:a.r.roster,firstObserved:{firstSample:[a.r.beginning.time,b.r.beginning.time],
    firstDamageToHero:[a.r.hits[0]??null,b.r.hits[0]??null],firstCardOfferDifference:offered(a.r.picks,b.r.picks),firstChoiceDifference:decision(a.r.picks,b.r.picks),
    firstPurchaseDifference:purchase(a.purchases,b.purchases),firstSoldier:[a.army.units[0]?.start,b.army.units[0]?.start]},
  before:outcome(a),after:outcome(b),waves:Array.from({length:Math.max(a.s.lastWave,b.s.lastWave)},(_,i)=>({wave:i+1,before:makeWave(a,i+1),after:makeWave(b,i+1)}))};
await writeFile(join(newRun,'revision-comparison.json'),JSON.stringify(output,null,2));
console.log('Compared',resolve(oldRun),'and',resolve(newRun),'changed sources:',changed.length);
