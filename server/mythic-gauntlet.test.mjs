import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
import {challengeChoices,challengeBoss,GHOST_GENERALS,DIVINE_GENERALS,mythicHit,mythicSequence} from '../src/data/mythicGauntlet.ts';

const rooms=new Map();
const server=createCoopServer({rooms,gauntletWarmup:.1,gauntletLineup:Array(10).fill('zhangliang')});
const clients=[];
let checks=0;
function equal(a,b){assert.deepEqual(a,b);checks++;}
async function peer(origin){
  const ws=new WebSocket(origin.replace('http:','ws:')+'/coop-socket',{origin}),messages=[];
  clients.push(ws);
  ws.on('message',data=>messages.push(JSON.parse(data.toString())));
  await once(ws,'open');
  return {ws,send:obj=>ws.send(JSON.stringify(obj)), async until(fn,timeout=5000){
    const end=Date.now()+timeout;
    while(Date.now()<end){const found=messages.findIndex(fn);if(found>=0)return messages.splice(0,found+1).at(-1);await delay(10);}
    throw new Error('Missing packet: '+String(fn)+' tail='+messages.slice(-2).map(m=>[m.type,m.wave,m.gauntlet?.wave]));
  }};
}

try{
  const roster=[...GHOST_GENERALS,...DIVINE_GENERALS];
  equal(new Set(roster.map(b=>b.id)).size,20);
  for(const def of roster)for(const cast of [0,1]){
    const first=mythicSequence(def,{x:100,y:100},{x:200,y:100},cast,false,0);
    const second=mythicSequence(def,{x:100,y:100},{x:200,y:100},cast,true,0);
    equal(second.length,first.length+1);
    for(const [i,w] of second.entries()){
      equal(w.endsAt-w.startsAt>=.84,true);
      if(i>0)equal(w.startsAt>second[i-1].endsAt,true);
      equal(mythicHit(w,{x:9999,y:9999}),false);
    }
  }
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const origin='http://127.0.0.1:'+server.http.address().port;
  const a=await peer(origin);let b=await peer(origin);
  a.send({type:'create',heroes:['zhaoyun']});
  const {code}=await a.until(m=>m.type==='lobby');
  b.send({type:'join',code,heroes:['guanyu']});
  await b.until(m=>m.type==='lobby'&&m.count===2);
  a.send({type:'pickHero',hero:'zhaoyun'});b.send({type:'pickHero',hero:'guanyu'});
  await a.until(m=>m.type==='lobby'&&m.picks.every(p=>p.hero));
  a.send({type:'start'});
  const room=rooms.get(code),checkpoints=[];
  for(let wave=1;wave<=30;wave++){
    const tier=wave<=10?'mortal':wave<=20?'ghost':'divine';
    const active=await a.until(m=>m.type==='state'&&m.gauntlet.wave===wave&&m.gauntlet.general);
    const partner=await b.until(m=>m.type==='state'&&m.gauntlet.wave===wave&&m.gauntlet.general);
    equal(active.gauntlet.tier,tier);
    equal(partner.gauntlet.general,active.gauntlet.general);
    if(wave>10)equal(active.gauntlet.general.id,challengeBoss(tier,wave,10).id);
    if(wave===15){
      const boss=room.run.boss, host=room.players.get(0), guest=room.players.get(1);
      const {x,y}=host;
      boss.hp=Math.floor(boss.maxHp*.47);boss.x=x-100;boss.y=y;boss.attacks=1;
      host.fireIn=90;guest.fireIn=90;room.run.attackAt=room.seconds;
      const dormant=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.retracesScar);
      const scar=dormant.gauntlet.warning.scar;
      equal(dormant.seconds<scar.lightsAt,true);
      b.ws.terminate();await a.until(m=>m.type==='connection'&&m.paused);
      const time=room.seconds;await delay(250);equal(room.seconds,time);
      b=await peer(origin);b.send({type:'resume',code,token:guest.token});
      const restored=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.retracesScar);
      equal(restored.gauntlet.warning.scar,scar);
      // Cross the locked line with normal movement input after a simulated late reaction.
      await delay(180);b.send({type:'input',dx:0,dy:1});
      const hit=await a.until(m=>m.type==='state'&&m.gauntlet.warning?.retracesScar&&m.gauntlet.warning.resolved);
      equal(hit.gauntlet.warning.scar,scar);
      equal(mythicHit(hit.gauntlet.warning,hit.players.find(p=>p.slot===1)),false);
      b.send({type:'input',dx:0,dy:0});
    }
    if(wave===11||wave===21){
      const boss=room.run.boss;
      boss.hp=Math.floor(boss.maxHp*.49);
      const host=room.players.get(0),guest=room.players.get(1);
      boss.x=host.x-105;boss.y=host.y;
      guest.x=host.x+310;guest.y=host.y+200;
      host.hurtUntil=0;host.fireIn=90;guest.fireIn=90;
      room.run.attackAt=room.seconds;
      const warn=await a.until(m=>m.type==='state'&&m.gauntlet.warning?.mythic===tier);
      equal(warn.enemies.find(e=>e.boss).enraged,true);
      equal((await b.until(m=>m.type==='state'&&m.gauntlet.warning?.mythic===tier)).gauntlet.warning.endsAt,warn.gauntlet.warning.endsAt);
      const hp=host.hp;
      const hit=await a.until(m=>m.type==='state'&&m.gauntlet.warning?.resolved);
      equal(hit.players[0].hp<hp,true);
      equal(hit.players[1].hp,guest.hp);
      equal(room.run.mythicQueue.length>=2,true);
    }
    // Deterministic fixture. The authoritative tick, draft messages and next-wave transitions still run normally.
    room.run.boss.hp=0;
    let draftA=await a.until(m=>m.type==='draft'&&m.wave===wave),draftB=await b.until(m=>m.type==='draft'&&m.wave===wave);
    if(wave%10===0){
      const options=challengeChoices(tier,wave,10);
      equal(draftA.continuation,options);equal(draftB.continuation,options);
      equal(room.run.mythicQueue.length,0);checkpoints.push(tier);
      if(wave===30){
        a.send({type:'finish',wave});
        equal((await a.until(m=>m.type==='result')).milestones,3);
        equal((await b.until(m=>m.type==='result')).generals,30);
        break;
      }
      b.send({type:'challenge',tier:options[0],wave});
      b.send({type:'challenge',tier:options[0],wave});
      a.send({type:'challenge',tier:wave===10?'divine':'ghost',wave});
      a.send({type:'challenge',tier:options[0],wave:wave-1});
      await delay(110);
      equal(room.phase,'checkpoint');
      a.send({type:'challenge',tier:options[0],wave});
      draftA=await a.until(m=>m.type==='draft'&&m.wave===wave&&!m.checkpoint);
      draftB=await b.until(m=>m.type==='draft'&&m.wave===wave&&!m.checkpoint);
    }
    if(draftA.choices.length)a.send({type:'reward',id:draftA.choices[0]});
    if(draftB.choices.length)b.send({type:'reward',id:draftB.choices[0]});
  }
  equal(checkpoints,['mortal','ghost','divine']);
  console.log('Mythic network checks: '+checks+' passed, 30 waves, two WebSocket peers.');
}finally{for(const ws of clients)ws.terminate();await server.close();}
