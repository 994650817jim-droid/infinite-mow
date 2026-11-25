import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
import {updateRetinue} from './coop-retinue.mjs';
import {mythicBoss,mythicHit,mythicTransit,mythicSequence} from '../src/data/mythicGauntlet.ts';
import {lockHalberdCharge,halberdExit} from '../src/data/ghostLubu.ts';
const id='ghost_lubu', origin={x:370,y:280}, target={x:500,y:280}, clear=()=>true;
const create=(phase2=false,pass=clear)=>mythicSequence(mythicBoss(id),origin,target,0,phase2,0,pass);
function lock(w,aim){lockHalberdCharge(w,aim,w.halberd.lockAt,clear);}
for(const phase of [false,true]){
  const route=create(phase),charge=route.at(-1),h=charge.halberd;
  assert.equal(route.length,phase?3:2);
  assert.equal(mythicHit(charge,origin),false);
  lockHalberdCharge(charge,h,h.lockAt-.01,clear);assert.equal(h.locked,false);
  lock(charge,h);assert.equal(h.collision,true);
  assert.ok(Math.abs(Math.hypot(charge.transit.to.x-h.x,charge.transit.to.y-h.y)-24)<.01);
  const locked=JSON.stringify(charge);lock(charge,{x:1,y:2});assert.equal(JSON.stringify(charge),locked);
  assert.equal(mythicHit(charge,h),false);
  assert.deepEqual(mythicTransit(charge,charge.endsAt),charge.transit.to);
  assert.ok(Math.abs(h.recoverUntil-charge.endsAt-3.2)<.001);
  const miss=create(phase).at(-1);lock(miss,target);assert.equal(miss.halberd.collision,false);
  const retreat=halberdExit(miss,target,clear);assert.ok(retreat);assert.equal(mythicHit(miss,retreat),false);
  assert.ok(Math.hypot(retreat.x-target.x,retreat.y-target.y)<50);
  assert.ok(halberdExit(miss,target,(_,p)=>p.y<target.y).y<target.y);
  assert.ok(Math.abs(miss.halberd.recoverUntil-miss.endsAt-1.55)<.001);
  assert.equal(create(phase,()=>false).some(w=>w.charge),false);
  const wall=create(phase).at(-1);lockHalberdCharge(wall,target,wall.halberd.lockAt,()=>false);
  assert.equal(wall.transit.harmless,true);assert.equal(mythicHit(wall,target),false);
}
const troopWarning=create().at(-1);lock(troopWarning,target);
const soldier={...target,id:2,owner:0,hp:70,level:1,kind:'spearman',fireAt:0};
const company={units:[soldier],order:'guard'};
const troopRoom={run:{warning:troopWarning,wave:15},seconds:troopWarning.halberd.lockAt,enemies:[],
  players:new Map([[0,{...target,company,hp:110}]])};
for(let i=0;i<18;i++){updateRetinue(troopRoom,.05);troopRoom.seconds+=.05;}
assert.ok(Math.abs(soldier.y-target.y)>=36);
assert.equal(mythicHit(troopWarning,soldier),false);
const rooms=new Map(),sockets=[];
const server=createCoopServer({rooms,gauntletWarmup:.1});
async function peer(url){
  const ws=new WebSocket(url.replace('http:','ws:')+'/coop-socket',{origin:url}),messages=[];
  sockets.push(ws);ws.on('message',data=>messages.push(JSON.parse(data)));
  await once(ws,'open');
  return {ws,send:m=>ws.send(JSON.stringify(m)),async until(fn){
    const limit=Date.now()+7000;
    while(Date.now()<limit){const i=messages.findIndex(fn);if(i>=0)return messages.splice(0,i+1).at(-1);await wait(15);}
    throw Error('Missing message '+fn+'; last '+JSON.stringify(messages.at(-1)?.gauntlet?.warning));
  }};
}
try{
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const url='http://127.0.0.1:'+server.http.address().port;
  const a=await peer(url);let b=await peer(url);
  a.send({type:'create',heroes:['zhaoyun'],starDraft:4});
  const {code}=await a.until(m=>m.type==='lobby');
  b.send({type:'join',code,heroes:['guanyu'],starDraft:4});
  const session=await b.until(m=>m.type==='session');
  a.send({type:'pickHero',hero:'zhaoyun'});b.send({type:'pickHero',hero:'guanyu'});
  await a.until(m=>m.type==='lobby'&&m.picks.every(v=>v.hero));
  const room=rooms.get(code);
  room.run.wave=15;room.run.tier='ghost';room.run.cleared=14;
  a.send({type:'start'});
  await a.until(m=>m.type==='state'&&m.gauntlet.general?.id===id);
  const boss=room.run.boss,host=room.players.get(0),guest=room.players.get(1);
  Object.assign(boss,origin);Object.assign(host,target);guest.x=target.x+90;guest.y=target.y;
  room.run.attackAt=room.seconds+.05;
  const first=await a.until(m=>m.type==='state'&&m.gauntlet.warning?.halberd);
  const mark=first.gauntlet.warning.halberd;
  // Set up a bait line with normal movement after the replicated planting warning.
  const hold=()=>a.send({type:'input',dx:0,dy:1});
  hold(); const keepAlive=setInterval(hold,60);
  try {await a.until(m=>m.type==='state'&&m.players[0].y>target.y+48);}
  finally {clearInterval(keepAlive);a.send({type:'input',dx:0,dy:0});}
  const live=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.charge&&m.gauntlet.warning.halberd.locked);
  assert.equal(live.gauntlet.warning.halberd.collision,true);
  const pinned=live.gauntlet.warning;
  b.ws.terminate();await a.until(m=>m.type==='connection'&&m.paused);
  const pause=room.seconds;await wait(330);assert.equal(room.seconds,pause);
  b=await peer(url);b.send({type:'resume',code,token:session.token});
  const resume=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.charge);
  assert.deepEqual(resume.gauntlet.warning,pinned);
  const impact=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.halberd?.broken);
  const w=impact.gauntlet.warning;
  assert.equal(w.name,'残戟已断 · 反击');assert.equal(room.run.attackAt,w.halberd.recoverUntil);
  const frozen={x:boss.x,y:boss.y},hp=boss.hp;
  await a.until(m=>m.type==='state'&&m.seconds>w.endsAt+2);
  assert.equal(room.run.warning.halberd.broken,true);
  assert.deepEqual({x:boss.x,y:boss.y},frozen);
  assert.ok(boss.hp<hp,'normal player attacks must damage the halted boss');
  assert.equal(w.halberd.x,mark.x);assert.equal(w.halberd.y,mark.y);
  console.log(JSON.stringify({geometry:'both phases, collision, dodge, blocked exit, immutability',reconnect:true,broken:true,
    retainerSideTravel:Math.abs(soldier.y-target.y),stance:true,bossHpAtImpact:hp,bossHpDuringRecovery:boss.hp,crashSeconds:w.halberd.recoverUntil-w.endsAt,missSeconds:1.55}));
}finally{for(const ws of sockets)ws.terminate();await server.close();}
