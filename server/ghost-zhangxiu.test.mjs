import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
import assert from 'node:assert/strict';
import {mythicBoss,mythicSequence,mythicHit,mythicTransit} from '../src/data/mythicGauntlet.ts';
import {shadowExit,shadowPosition} from '../src/data/ghostZhangxiu.ts';
import {beginBossWarning,resolveBossWarning} from './gauntlet.mjs';
import {updateRetinue} from './coop-retinue.mjs';

const id='ghost_zhangxiu',boss=mythicBoss(id), origin={x:430,y:340},target={x:576,y:340,hp:100,slot:0};
const cast=(n,phase,clear=()=>true)=>mythicSequence(boss,origin,target,n,phase,5,clear);
const along=(w,p,d,side=0)=>({x:p.x+d*Math.cos(w.angle)-side*Math.sin(w.angle),y:p.y+d*Math.sin(w.angle)+side*Math.cos(w.angle)});
for(const n of [0,1])for(const phase of [false,true]){
  const seq=cast(n,phase),first=seq[0];
  assert.equal(seq.length,(n===0?2:1)+(phase?1:0));
  for(const w of seq){
    assert.ok(w.shadow && !w.shadow.folded);
    for(let t=0;t<=w.radius;t+=5)assert.equal(mythicHit(w,along(w,w.shadow.fake,t)),false);
    assert.equal(mythicHit(w,along(w,w,110)),true);
    assert.equal(mythicHit(w,along(w,w,110,40)),false);
    assert.deepEqual(shadowPosition(w,w.shadow.plantAt,false),{x:w.x,y:w.y});
    assert.deepEqual(mythicTransit(w,w.endsAt),along(w,w,w.radius));
    assert.equal(shadowExit(w,along(w,w.shadow.fake,65),()=>true),undefined);
    const danger=along(w,w,65),exit=shadowExit(w,danger,()=>true);
    assert.ok(exit && !mythicHit(w,exit));
    assert.equal(shadowExit(w,danger,()=>false),undefined);
  }
  if(phase){const end=seq.at(-1), prior=seq.at(-2);assert.ok(end.shadow.switchStep);assert.ok(Math.abs(Math.cos(end.angle-prior.angle)+1)<1e-6);}
  assert.ok(Math.hypot(first.shadow.fake.x-first.x,first.shadow.fake.y-first.y)<=84);
  const s={...along(first,first,90),hp:90,kind:'spearman',level:1,id:1,owner:0,fireAt:0};
  const safe={...along(first,first.shadow.fake,92),hp:90,kind:'spearman',level:1,id:2,owner:0,fireAt:0};
  const company={units:[s],order:'guard'};
  const room={run:{wave:12,warning:first},seconds:first.startsAt,enemies:[],players:new Map([[0,{...s,company}]])};
  for(let k=0;k<9;k++){updateRetinue(room,.05);room.seconds+=.05;}
  assert.ok(!mythicHit(first,s));assert.equal(shadowExit(first,safe,()=>true),undefined);
  const run={wave:12,boss:{...origin,hp:100,general:{id},enraged:phase,attacks:n},mythicQueue:[]};
  assert.ok(beginBossWarning(run,target,5));
  for(const w of run.mythicQueue.slice()){
    const real={...along(w,w,93),hp:100},fake={...along(w,w.shadow.fake,93),hp:100},troop={...real,owner:0};
    const hit=[];
    for(const t of [w.startsAt,w.shadow.plantAt,w.endsAt,w.endsAt+.18,w.endsAt+.31])resolveBossWarning(run,[real,fake,troop],t,p=>hit.push(p));
    assert.deepEqual(hit,[real,troop]);
  }
}
assert.notEqual(cast(0,false)[0].shadow.side,cast(1,false)[0].shadow.side);
const closed=cast(0,true,(a,b)=>Math.abs(a.y-origin.y)<18 && Math.abs(b.y-origin.y)<18);
assert.equal(closed.length,1);assert.ok(closed[0].shadow.folded);assert.equal(mythicHit(closed[0],origin),false);
console.log('PASS 两阶段真假枪道、回刺换步、近身空门、远距侧避、部曲和堵路收枪');

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
  run.wave=11;run.tier='ghost';run.roster.ghost[0]=boss;run.cleared=10;
  host.send({type:'start'});await host.until(m=>m.type==='state'&&m.gauntlet.general?.id===id);
  Object.assign(run.boss,{...origin,enraged:true,attacks:1});run.boss.hp=run.boss.maxHp*.48;
  const a=room.players.get(0),b=room.players.get(1);
  Object.assign(a,target);b.x=target.x+12;b.y=target.y;
  run.attackAt=room.seconds+.05;
  const state=await host.until(m=>m.gauntlet?.warning?.shadow),first=state.gauntlet.warning;
  const other=await guest.until(m=>m.gauntlet?.warning?.shadow);
  assert.deepEqual(other.gauntlet.warning,first);
  assert.ok(Math.abs(first.angle)<.001);
  const moveY=async(peer,actor,y)=>{
    const end=Date.now()+1600;
    while(Math.abs(y-actor.y)>3 && Date.now()<end){
      const dy=Math.max(-1,Math.min(1,(y-actor.y)/28));
      peer.send({type:'input',dx:0,dy});
      await wait(35);
    }
    peer.send({type:'input',dx:0,dy:0});
    assert.ok(Math.abs(actor.y-y)<14,'the real input must arrive');
  };
  await Promise.all([moveY(host,a,first.y),moveY(guest,b,first.shadow.fake.y)]);
  assert.ok(mythicHit(first,a));assert.equal(mythicHit(first,b),false);
  const hpReal=a.hp,hpFake=b.hp;
  guest.ws.terminate();await host.until(m=>m.type==='connection'&&m.paused);
  const pause=room.seconds;await wait(240);assert.equal(room.seconds,pause);
  guest=await peer(url);guest.send({type:'resume',code,token});
  const resumed=await guest.until(m=>m.gauntlet?.warning?.shadow);
  assert.deepEqual(resumed.gauntlet.warning,first);
  const impact=await guest.until(m=>m.gauntlet?.warning?.resolved);
  assert.ok(impact.players[0].hp<hpReal);assert.equal(impact.players[1].hp,hpFake);
  const reply=(await host.until(m=>m.gauntlet?.warning?.shadow?.switchStep)).gauntlet.warning;
  await moveY(host,a,reply.y);
  assert.ok(mythicHit(reply,a),'in the newly marked return lane');
  await moveY(host,a,reply.y+46);
  assert.equal(mythicHit(reply,a),false);
  const escaped=await guest.until(m=>m.gauntlet?.warning?.shadow?.switchStep && m.gauntlet.warning.resolved);
  assert.equal(escaped.players[0].hp,impact.players[0].hp);assert.equal(escaped.players[1].hp,hpFake);
  console.log(JSON.stringify({realHp:[hpReal,impact.players[0].hp],fakeHp:[hpFake,impact.players[1].hp],
    afterReturn:escaped.players[0].hp,restored:true,pausedClock:pause,switchedFoot:reply.y-first.y}));
}finally{for(const ws of sockets)ws.terminate();await server.close();}
