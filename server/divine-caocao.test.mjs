import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
import {mythicBoss, mythicHit, mythicSequence} from '../src/data/mythicGauntlet.ts';
import {weiAdvance, weiBowExit, weiPoint} from '../src/data/divineCaocao.ts';
import {beginBossWarning, bossStats, resolveBossWarning} from './gauntlet.mjs';
import {updateRetinue} from './coop-retinue.mjs';

const id='divine_caocao', origin={x:610,y:350}, target={x:762,y:410,hp:110,slot:0};
const definition=mythicBoss(id);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const at=(w,forward,side)=>weiPoint(w,forward,side);
for(const clear of [()=>false,(a,b)=>Math.abs(a.y-origin.y)<35 && Math.abs(b.y-origin.y)<35]){
  const closed=mythicSequence(definition,origin,target,1,true,10,clear);
  assert.deepEqual(closed.map(w=>w.wei.stance),['standDown']);
  assert.equal(mythicHit(closed[0],origin),false);
  assert.equal(weiAdvance(closed[0],target,origin,10.5),undefined);
}
for(const phase of [false,true]){
  const moves=mythicSequence(definition,origin,target,1,phase,10);
  assert.deepEqual(moves.map(w=>w.wei.stance),phase?['shield','bow','bow']:['shield','bow']);
  const [s,b,reply]=moves;
  const p=at(s,105,0), time=s.startsAt+.8;
  const front=weiAdvance(s,p,at(s,85,0),time);
  near(Math.hypot(front.x-p.x,front.y-p.y),6);
  assert.equal(weiAdvance(s,p,at(s,105,24),time),undefined);
  assert.equal(weiAdvance(s,p,at(s,125,0),time),undefined);
  assert.equal(weiAdvance(s,at(s,105,140),at(s,85,140),time),undefined);
  assert.equal(weiAdvance(s,p,at(s,85,0),s.endsAt+.01),undefined);
  assert.equal(weiAdvance(b,p,at(s,85,0),b.startsAt+.2),undefined);
  for(const w of moves.slice(1)){
    for(const side of [w.wei.gap-12,w.wei.gap,w.wei.gap+12,180,-180]){
      for(let u=14;u<=w.radius;u+=6)assert.equal(mythicHit(w,at(w,u,side)),false);
    }
    for(const offset of w.wei.lanes){
      const standing=at(w,90,offset);
      assert.equal(mythicHit(w,standing),true);
      assert.equal(mythicHit(w,weiBowExit(w,standing,()=>true)),false);
      assert.equal(weiBowExit(w,standing,()=>false),undefined);
    }
  }
  if(reply){assert.notEqual(b.wei.gap,reply.wei.gap);assert.ok(reply.startsAt>b.endsAt);}
  const run={wave:22,boss:{...origin,hp:100,enraged:phase,general:{id},attacks:1},mythicQueue:[]};
  assert.equal(beginBossWarning(run,target,10),true);
  for(const [i,w] of run.mythicQueue.slice().entries()){
    const victim=at(w,82,w.wei.lanes?.[0]??0);victim.hp=100;
    const ally={...victim,owner:0};let strikes=0;
    const hit=(v,amount)=>{strikes++;near(amount,bossStats(22,id).power*(phase?1.1:1)*[1,.88,.82][i]);};
    for(const time of [w.startsAt,w.endsAt,w.endsAt+.08,w.endsAt+.31])resolveBossWarning(run,[victim,ally],time,hit);
    assert.equal(strikes,2,'one hit each per release');
  }
  const soldier={...at(b,91,b.wei.lanes[0]),id:1,owner:0,hp:80,kind:'spearman',level:1,fireAt:0};
  const company={units:[soldier],order:'guard'};
  const room={run:{warning:b,wave:22},seconds:b.startsAt,enemies:[],players:new Map([[0,{...soldier,company}]])};
  for(let i=0;i<12;i++){updateRetinue(room,.05);room.seconds+=.05;}
  assert.equal(mythicHit(b,soldier),false);
}
console.log('PASS 神曹操两阶段 · 盾势方向与时限 · 近战通廊/外绕 · 部曲撤离 · 服务端逐击单次结算');

const rooms=new Map(), sockets=[];
const server=createCoopServer({rooms,gauntletWarmup:.1});
async function peer(url){
  const ws=new WebSocket(url.replace('http:','ws:')+'/coop-socket',{origin:url}),messages=[];
  ws.on('message',data=>messages.push(JSON.parse(data)));sockets.push(ws);
  await once(ws,'open');
  return {ws,send:m=>ws.send(JSON.stringify(m)),async until(test){
    const limit=Date.now()+8000;
    while(Date.now()<limit){
      const i=messages.findIndex(test);
      if(i>=0)return messages.splice(0,i+1).at(-1);
      await wait(12);
    }
    throw Error('Missing room event: '+test);
  }};
}
try{
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const url='http://127.0.0.1:'+server.http.address().port;
  const host=await peer(url);let guest=await peer(url);
  host.send({type:'create',heroes:['zhaoyun'],starDraft:4});
  const {code}=await host.until(m=>m.type==='lobby');
  guest.send({type:'join',code,heroes:['guanyu'],starDraft:4});
  const {token}=await guest.until(m=>m.type==='session');
  host.send({type:'pickHero',hero:'zhaoyun'});guest.send({type:'pickHero',hero:'guanyu'});
  await host.until(m=>m.type==='lobby'&&m.picks.every(p=>p.hero));
  const room=rooms.get(code),run=room.run;
  run.wave=16;run.tier='divine';run.roster.divine[0]=definition;run.cleared=15;
  host.send({type:'start'});
  await host.until(m=>m.type==='state'&&m.gauntlet.general?.id===id);
  Object.assign(run.boss,{x:470,y:340,enraged:true});run.boss.hp=.48*run.boss.maxHp;
  Object.assign(room.players.get(0),{x:575,y:340});Object.assign(room.players.get(1),{x:579,y:340});
  run.attackAt=room.seconds+.05;
  const shield=await host.until(m=>m.gauntlet?.warning?.wei?.stance==='shield');
  assert.deepEqual(shield.gauntlet.warning,(await guest.until(m=>m.gauntlet?.warning?.wei?.stance==='shield')).gauntlet.warning);
  function hold(){host.send({type:'input',dx:-1,dy:0});guest.send({type:'input',dx:0,dy:1});}
  hold(); const keepAlive=setInterval(hold,60);
  let step;
  try {step=await host.until(m=>m.players?.[1]?.y>=375);}
  finally {
    clearInterval(keepAlive);
    host.send({type:'input',dx:0,dy:0});guest.send({type:'input',dx:0,dy:0});
  }
  const inward=575-step.players[0].x, sideways=step.players[1].y-340;
  assert.ok(inward>0 && inward<sideways*.5);
  const bow=await guest.until(m=>m.gauntlet?.warning?.wei?.stance==='bow');
  guest.ws.terminate();await host.until(m=>m.type==='connection'&&m.paused);
  const paused=room.seconds;await wait(250);assert.equal(room.seconds,paused);
  guest=await peer(url);guest.send({type:'resume',code,token});
  const again=await guest.until(m=>m.gauntlet?.warning?.wei?.stance==='bow');
  assert.deepEqual(again.gauntlet.warning,bow.gauntlet.warning);
  const switched=await host.until(m=>m.gauntlet?.warning?.wei?.stance==='bow'&&m.gauntlet.warning.startsAt>bow.gauntlet.warning.endsAt);
  assert.notEqual(switched.gauntlet.warning.wei.gap,bow.gauntlet.warning.wei.gap);
  console.log(JSON.stringify({frontTravel:inward,sideTravel:sideways,pausedSeconds:paused,reconnected:true,
    gap:bow.gauntlet.warning.wei.gap,nextGap:switched.gauntlet.warning.wei.gap}));
}finally{for(const ws of sockets)ws.terminate();await server.close();}
