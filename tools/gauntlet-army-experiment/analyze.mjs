import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {evidenceDir as dir} from './paths.mjs';
const read=async(path)=>JSON.parse(await readFile(path,'utf8'));
const round=n=>Math.round(n*100)/100;
const initials=()=>({units:0,censored:0,killed:0,cost:0,dealt:0,shield:0,taken:0,healed:0,soldierSeconds:0});
const add=(a,key)=>a[key]??=initials();
const initialWave=w=>({wave:w,boss:null,born:0,carry:0,cost:0,dead:0,atClear:null,opening:null,closing:null,damage:0,taken:0,
  byCause:{},byKind:{},byOrder:{},bossHP:null,playerHP:null,playerMinHP:null,playerMinRatio:null,clearSec:null});
const bump=(map,key,n=1)=>{map[key]=(map[key]??0)+n;};
const results=[];
for(const d of (await readdir(dir,{withFileTypes:true})).filter(d=>d.isDirectory())){
  const path=join(dir,d.name);
  let meta;
  try{meta=await read(join(path,'progress.json'));}catch{continue;}
  if(!['completed','natural-defeat','observation-limit'].includes(meta.terminal))continue;
  const [a,r]=await Promise.all([read(join(path,'army.json')),read(join(path,'route.json'))]);
  const entry=meta.config.gateFile?await read(join(path,'entry.json')):null;
  const byId=Object.fromEntries(a.units.map(u=>[u.id,u])),byKind={},byGroup={},byOrder={};
  const byCause={},incoming={},waves={},lifeTables={},deathsByKindCause={},damageByKindTarget={};
  const wave=w=>waves[w]??=initialWave(w);
  const end=a.clock.t;
  for(const u of a.units){
    const stop=u.death?.t??end,age=stop-u.start.t,w=wave(u.start.w);
    if(u.origin==='checkpoint')w.carry++;else w.born++;
    w.cost+=u.cost;
    for(const [map,k] of [[byKind,u.kind],[byGroup,u.group]]){
      const b=add(map,k);b.units++;b.cost+=u.cost;b.dealt+=u.dealt;b.shield+=u.shields;b.taken+=u.received;b.healed+=u.healed;b.soldierSeconds+=age;
      if(u.death)b.killed++;else b.censored++;
    }
    if(u.origin!=='checkpoint')(lifeTables[u.kind]??=[]).push({age:round(age),death:!!u.death});
    if(u.death){const row=wave(u.death.w);row.dead++;bump(row.byCause,u.death.cause);bump(byCause,u.death.cause);bump(deathsByKindCause[u.kind]??={},u.death.cause);add(byOrder,u.death.order).killed++;}
    for(let i=0;i<a.orderLog.length;i++){
      const from=Math.max(u.start.t,a.orderLog[i].t),to=Math.min(stop,a.orderLog[i+1]?.t??end);
      if(to>from)add(byOrder,a.orderLog[i].order).soldierSeconds+=to-from;
    }
  }
  for(const e of a.events){
    const u=byId[e.id],w=wave(e.w),o=add(byOrder,e.order);
    const kind=add(w.byKind,u.kind),order=add(w.byOrder,e.order);
    if(e.action==='out'){w.damage+=e.hp;bump(damageByKindTarget[u.kind]??={},e.target,e.hp);for(const b of [o,kind,order]){b.dealt+=e.hp;b.shield+=e.shield;}}
    if(e.action==='in'){w.taken+=e.hp;bump(incoming,e.cause,e.hp);for(const b of [o,kind,order])b.taken+=e.hp;}
    if(e.action==='heal')for(const b of [o,kind,order])b.healed+=e.hp;
  }
  for(const sample of [...r.transitions,...r.rows,r.current]){
    const w=wave(sample.wave);
    if(sample.phase==='mow'&&w.opening===null)w.opening=sample.army;
    if(sample.phase==='clear'&&w.atClear===null){w.atClear=sample.army;w.clearSec=sample.time;}
    if(sample.phase==='boss'||sample.phase==='clear'){w.boss=sample.boss;w.bossHP=sample.bossHp;}
    w.playerMinHP=Math.min(w.playerMinHP??Infinity,sample.hp);w.playerMinRatio=Math.min(w.playerMinRatio??Infinity,sample.hp/sample.maxHp);
  }
  for(const row of Object.values(waves)){row.closing=waves[row.wave+1]?.opening??(r.current.wave===row.wave?r.current.army:null);}
  for(const map of [byKind,byGroup,byOrder]){
    for(const b of Object.values(map)){
      b.soldierSeconds=round(b.soldierSeconds);b.damagePerSoldierSecond=round(b.dealt/(b.soldierSeconds||1));b.lossesPer100SoldierSeconds=round(100*b.killed/(b.soldierSeconds||1));
      b.per100Coins=b.cost?round(100*b.dealt/b.cost):null;
      b.taken=round(b.taken);b.dealt=round(b.dealt);b.shield=round(b.shield);b.cost=round(b.cost);b.healed=round(b.healed);
    }
  }
  // Kaplan-Meier median. Concluding a sample while soldiers remain alive is right censoring.
  const lifetime={};
  for(const [kind,people] of Object.entries(lifeTables)){
    const deaths=people.filter(x=>x.death).sort((a,b)=>a.age-b.age);
    let risk=people.length,survival=1,median=null;
    for(const age of [...new Set(people.map(x=>x.age))].sort((a,b)=>a-b)){
      const group=people.filter(x=>x.age===age);
      survival*=1-group.filter(x=>x.death).length/risk;
      if(survival<=.5&&median===null)median=age;
      risk-=group.length;
    }
    lifetime[kind]={observed:people.length,deaths:deaths.length,censored:people.length-deaths.length,kmMedianSeconds:median};
  }
  const minMarchHP=Math.min(...[...r.rows,...r.transitions].map(x=>x.hp/x.maxHp));
  const divineRows=r.rows.filter(x=>x.tier==='divine');
  const result={name:d.name,hero:meta.config.hero,seed:meta.config.seed,build:meta.config.build,route:meta.config.route??'standard',order:meta.config.order,arm:meta.config.arm,checkpoint:!!entry,
    terminal:meta.terminal,gate:!!entry||r.transitions.some(x=>x.tier==='divine'),cleared:r.current.cleared,lastWave:r.current.wave,lastHP:r.current.hp,
    maxHP:r.current.maxHp,lowestSampledHPRatio:round(minMarchHP),divineMinSampledHPRatio:divineRows.length?round(Math.min(...divineRows.map(x=>x.hp/x.maxHp))):null,
    terminalPhase:r.current.phase,terminalBoss:r.current.boss,terminalBossHP:r.current.bossHp,milestones:r.current.milestones,kit:{weapon:r.current.weapon,stars:r.current.stars,attributes:r.current.attributes,followers:r.current.followers},
    grossDamage:r.current.damage-r.beginning.damage,enemyKills:r.current.kills-r.beginning.kills,gold:r.current.food,spent:a.notes.reduce((n,v)=>n+v.cost,0),
    endTime:r.current.time,observedWallSeconds:round((Date.parse(meta.ended)-Date.parse(meta.started))/1000),starting: r.beginning,
    byKind,byGroup,byOrder,byCause,incoming,deathsByKindCause,damageByKindTarget,lifetime,waves:Object.values(waves),units:a.units.length,deaths:a.units.filter(u=>u.death).length,remaining:a.totals.army};
  assert.equal(result.units-result.deaths,result.remaining);
  const eventDamage=a.events.filter(e=>e.action==='out').reduce((n,e)=>n+e.hp,0);
  assert.ok(Math.abs(a.units.reduce((n,u)=>n+u.dealt,0)-eventDamage)<.001);
  assert.ok(Math.abs(a.units.reduce((n,u)=>n+u.cost,0)-a.notes.reduce((n,u)=>n+u.cost,0))<.001);
  results.push(result);await writeFile(join(path,'summary.json'),JSON.stringify(result,null,2));
}
await writeFile(join(dir,'index.json'),JSON.stringify(results.map(({starting,waves,byKind,byGroup,byOrder,incoming,byCause,lifetime,deathsByKindCause,damageByKindTarget,...x})=>x),null,2));
console.log(results.map(r=>[r.name,r.terminal,r.lastWave,r.units,r.deaths]));
