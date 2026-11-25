import assert from 'node:assert/strict';
import test from 'node:test';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
import {rewardsFor,grantReward} from './gauntlet.mjs';
import {FIELD_STARS} from '../src/data/coopStars.ts';

test('stars use one reward slot, only for compatible clients and never repeat',()=>{
  const p={hp:40,maxHp:100,upgrades:{},stars:[]};
  assert.ok(rewardsFor(p,1).every(id=>!id.includes('.')));
  assert.ok(rewardsFor({...p,stars:undefined},3).every(id=>!id.includes('.')));
  for(let n=0;n<3;n++){
    const cards=rewardsFor(p,3),star=cards.find(id=>id.includes('.'));
    assert.equal(new Set(cards).size,3);assert.ok(!p.stars.includes(star));
    grantReward(p,star);grantReward(p,star);
    assert.equal(p.stars.length,n+1);
  }
  assert.equal(p.maxHp,108);assert.equal(p.hp,43);
  grantReward(p,'health');assert.equal(p.maxHp,124);
  assert.ok(rewardsFor(p,6).every(id=>!id.includes('.')));
});

test('server applies star damage, recovery and snapshot ownership through two actual sockets',async()=>{
  const rooms=new Map(), server=createCoopServer({rooms,gauntletWarmup:200,reconnectMs:4000});
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const host='127.0.0.1:'+server.http.address().port;
  const clients=[];
  async function connect(){
    const ws=new WebSocket('ws://'+host+'/coop-socket',{origin:'http://'+host});clients.push(ws);
    const queue=[];ws.on('message',d=>queue.push(JSON.parse(d)));
    await once(ws,'open');
    return {ws,send:m=>ws.send(JSON.stringify(m)),async read(f){
      const end=Date.now()+4000;
      while(Date.now()<end){const i=queue.findIndex(f);if(i!==-1)return queue.splice(0,i+1).at(-1);await new Promise(r=>setTimeout(r,10));}
      throw Error('expected session message timed out');
    }};
  }
  try {
    const a=await connect();a.send({type:'create',heroes:['zhaoyun'],starDraft:1,stars:['strength.NR2']});
    const session=await a.read(m=>m.type==='session'), room=rooms.get(session.code);
    const b=await connect();b.send({type:'join',code:session.code,heroes:['guanyu']});
    await b.read(m=>m.type==='session');a.send({type:'pickHero',hero:'zhaoyun'});b.send({type:'pickHero',hero:'guanyu'});
    await a.read(m=>m.picks?.every(p=>p.hero));a.send({type:'start'});const initial=await a.read(m=>m.type==='state');
    assert.deepEqual(initial.players[0].stars,[]);assert.equal(initial.players[1].stars,undefined);
    const p=room.players.get(0), other=room.players.get(1);
    // Seed a legal third-wave draft, keep the real reward, tick and snapshot handlers.
    room.run.wave=3;room.run.history=[room.run.upcoming];room.phase='draft';p.choices=['strength.NR2'];other.choices=['speed'];
    a.send({type:'reward',id:'bridge0.h'});a.send({type:'reward',id:'strength.NR2'});a.send({type:'reward',id:'strength.NR2'});
    const draft=await b.read(m=>m.type==='draft'&&m.ready===1);
    assert.deepEqual(draft.party[0].stars,['strength.NR2']);b.send({type:'reward',id:'speed'});
    const next=await a.read(m=>m.type==='state'&&m.gauntlet.wave===4);assert.deepEqual(next.players[0].stars,['strength.NR2']);
    a.ws.terminate();await b.read(m=>m.type==='connection'&&m.paused);
    const back=await connect();back.send({type:'resume',code:session.code,token:session.token,stars:['bridge0.h']});
    const resumed=await back.read(m=>m.type==='state');assert.deepEqual(resumed.players[0].stars,['strength.NR2']);
    // Exercise authoritative combat with a stationary adjacent normal enemy.
    p.hp=30;grantReward(p,'bridge0.h');grantReward(p,'strength.NR1');p.fireIn=0;p.hurtUntil=0;
    // Wave 12 has an 11-point contact hit, so 5% reduction survives integer rounding.
    other.x=24;other.y=24;room.spawnIn=999;room.run.wave=12;
    const target={id:999,x:p.x+1,y:p.y,hp:100,maxHp:100,boss:false,hitIn:0};
    room.enemies=[target];
    const snap=await b.read(m=>m.type==='state'&&m.enemies.some(e=>e.id===999&&e.hp<100));
    const attacker=snap.players[0],enemy=snap.enemies.find(e=>e.id===999);
    assert.equal(enemy.hp,100-3*1.06*1.15);
    assert.equal(attacker.hp,32-Math.round(11*.95));
    assert.ok(p.fireIn>0&&p.fireIn<=.55/1.06);
    assert.deepEqual(new Set(attacker.stars),new Set(FIELD_STARS.map(s=>s.id)));
  }finally{for(const ws of clients)ws.terminate();await server.close();}
});
