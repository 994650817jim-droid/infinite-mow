import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {updateRetinue,companyWire,paySpoils,recruitCompany}=await import(pathToFileURL(resolve('server/coop-retinue.mjs')));
const players=new Map([0,1].map(slot=>[slot,{slot,starDraft:4,x:400+slot*80,y:400,hp:100,choices:['damage'],stars:['command.NR1','command.NR2']}]));
const room={players,enemies:[],run:{wave:1},phase:'draft',seconds:0};
for(let wave=1;wave<=4;wave++){
  room.run.wave=wave;paySpoils(room);
  for(const p of players.values())assert.ok(recruitCompany(room,p,{wave,receipt:p.company.receipt},()=>.3));
}
room.phase='battle';
// Fixed stationary targets and replenished HP keep the number of active actors constant for every sample.
room.enemies=Array.from({length:48},(_,i)=>({id:i+1,x:394+(i%8)*13,y:408+Math.floor(i/8)*12,hp:1e7}));
const units=[...players.values()].flatMap(p=>p.company.units);
assert.equal(units.length,24);
const samples=[],cpu=process.cpuUsage();
for(let i=0;i<3600;i++){
  room.seconds+=.05;
  for(const u of units)u.hp=u.maxHp;
  const start=performance.now();updateRetinue(room,.05);JSON.stringify(companyWire(room));samples.push(performance.now()-start);
}
const used=process.cpuUsage(cpu);samples.sort((a,b)=>a-b);
assert.ok(units.some(u=>u.strike>0)&&room.enemies.some(e=>e.hp<1e7));
console.log(JSON.stringify({ticks:samples.length,units:units.length,enemies:room.enemies.length,subsystem:'retinue simulation + ally serialization',meanMs:samples.reduce((a,b)=>a+b)/samples.length,p95ms:samples[3419],p99ms:samples[3563],cpuMsPerTick:(used.user+used.system)/1000/samples.length,allyBytes:Buffer.byteLength(JSON.stringify(companyWire(room)))},null,2));
