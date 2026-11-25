import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {rewardsFor,grantReward} from '../server/gauntlet.mjs';
import {paySpoils,recruitCompany,OWNER_CAP} from '../server/coop-retinue.mjs';
const waves=[10,15,20,30], samples={};
const baselineRandom=Math.random;
function stream(seed){
 return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
try {
 for(let seed=1;seed<=128;seed++){
   Math.random=stream(seed);
   const players=new Map([0,1].map(slot=>[slot,{slot,hero:slot?'zhugeliang':'zhaoyun',starDraft:4,stars:[],upgrades:{},hp:100,maxHp:100,x:0,y:0}]));
   const room={players,phase:'draft',run:{wave:0}};
   for(let wave=1;wave<=30;wave++){
     room.run.wave=wave;paySpoils(room);
     for(const p of players.values()){
       p.choices=rewardsFor(p,wave);
       while(recruitCompany(room,p,{wave,receipt:p.company.receipt})){/* spend only what the server allows */}
       const star=p.choices.find(x=>x.includes('.'));
       const preferences=p.slot?[star,'ember','damage','haste','health','speed']:['damage','haste',star,'health','speed','ember'];
       const chosen=preferences.find(k=>k && p.choices.includes(k))??p.choices[0];
       if(chosen)grantReward(p,chosen);
       if(waves.includes(wave)){
         assert.ok(p.company.units.length<=OWNER_CAP && p.company.coins>=0);
         const group=(p.slot?'star':'weapon')+'-'+wave;
         (samples[group]??=[]).push({stars:p.stars.length,damageRanks:p.upgrades.damage??0,hasteRanks:p.upgrades.haste??0,hp:p.maxHp,soldiers:p.company.units.length,coins:p.company.coins});
       }
     }
   }
 }
}finally{Math.random=baselineRandom;}
const summary={};
for(const [key,rows] of Object.entries(samples)){
  const cols={};
  for(const name of Object.keys(rows[0])){
    const a=rows.map(r=>r[name]).sort((x,y)=>x-y);
    cols[name]=[.1,.5,.9].map(p=>a[Math.floor((a.length-1)*p)]);
  }
  summary[key]=cols;
}
const evidence={method:'128 fixed seeds. Two co-op owners, one normal reward per cleared wave, production draft, treasury and recruitment. Perfect survival, no battle simulation or DPS measurements. P10/50/90. Phase-entry comparison uses after waves 15 and 20 of the same sequence.',summary};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(evidence,null,2));
console.log(JSON.stringify(summary));
