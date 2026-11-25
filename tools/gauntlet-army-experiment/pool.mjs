import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {evidenceDir as root} from './paths.mjs';
const read=async(...names)=>JSON.parse(await readFile(join(root,...names),'utf8'));
const all=await read('index.json'), runs=all.filter(r=>!r.checkpoint&&r.route==='standard');
const result={runs:runs.map(x=>x.name),byKind:{},byGroup:{},byOrder:{},deathsByCause:{}},ages={};
const zero=()=>({units:0,killed:0,censored:0,cost:0,dealt:0,shields:0,received:0,seconds:0});
for(const run of runs){
  const [s,a]=await Promise.all([read(run.name,'summary.json'),read(run.name,'army.json')]);
  for(const [field,source] of [['byKind',s.byKind],['byGroup',s.byGroup],['byOrder',s.byOrder]]){
    for(const [id,b] of Object.entries(source)){
      const target=result[field][id]??=zero();
      for(const [key,value] of Object.entries({units:b.units,killed:b.killed,censored:b.censored,cost:b.cost,dealt:b.dealt,shields:b.shield,received:b.taken,seconds:b.soldierSeconds}))target[key]+=value;
    }
  }
  for(const [key,value] of Object.entries(s.byCause))result.deathsByCause[key]=(result.deathsByCause[key]??0)+value;
  for(const u of a.units)(ages[u.kind]??=[]).push({t:(u.death?.t??a.clock.t)-u.start.t,dead:!!u.death});
}
for(const m of [result.byKind,result.byGroup,result.byOrder])for(const v of Object.values(m)){
  v.received=+v.received.toFixed(2);v.seconds=+v.seconds.toFixed(2);v.perSecond=+(v.dealt/v.seconds).toFixed(2);
  v.per100Coins=v.cost?+(100*v.dealt/v.cost).toFixed(2):null;
  v.lossPer100Seconds=+(100*v.killed/v.seconds).toFixed(2);
}
for(const [kind,lives] of Object.entries(ages)){
  let remaining=lives.length,survival=1,median=null;
  for(const time of [...new Set(lives.map(l=>l.t))].sort((a,b)=>a-b)){
    const ending=lives.filter(l=>l.t===time);survival*=1-ending.filter(l=>l.dead).length/remaining;
    if(median===null&&survival<=.5)median=+time.toFixed(2);remaining-=ending.length;
  }
  result.byKind[kind].medianKM=median;
}
await writeFile(join(root,'pooled-natural.json'),JSON.stringify(result,null,2)+'\n');
console.log(result);
