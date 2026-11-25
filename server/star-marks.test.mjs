import test from 'node:test';
import assert from 'node:assert/strict';
import {canDraftMark,strikeSpellMark,visibleSpellMarks} from './coop-marks.mjs';
import {rewardsFor,grantReward} from './gauntlet.mjs';
import {FIELD_STARS} from '../src/data/coopStars.ts';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
const mark='intellect.NX1';
const enemy=(id,x)=>({id,x,y:0,hp:100});
const caster=()=>({starDraft:2,hero:'zhuge',hp:100,maxHp:100,x:0,y:0,upgrades:{},stars:FIELD_STARS.map(s=>s.id)});

test('mark draft requires a compatible version, a spell weapon and a free source',()=>{
  const p=caster();
  assert.ok(rewardsFor(p,3).includes(mark));grantReward(p,mark);grantReward(p,mark);
  assert.equal(p.stars.filter(id=>id===mark).length,1);assert.ok(!rewardsFor(p,6).includes(mark));
  for(const member of [{...caster(),hero:'zhaoyun'},{...caster(),starDraft:1}]){
    assert.ok(!canDraftMark(member));assert.ok(!rewardsFor(member,3).includes(mark));grantReward(member,mark);assert.ok(!member.stars.includes(mark));
  }
});

test('one caster conducts once per combat cooldown, inclusive range; expiry, capacity and generations are independent',()=>{
  const p=caster(),q=caster();grantReward(p,mark);grantReward(q,mark);
  const room={players:new Map([[0,p],[1,q]]),seconds:0,enemies:[]},a=enemy(1,0),b=enemy(2,180),c=enemy(3,361);
  const hit=(e,t,who=p)=>{room.seconds=t;strikeSpellMark(room,who,e,20);};
  hit(a,0);hit(b,.1);assert.equal(a.hp,98);assert.equal(b.hp,100);
  hit(a,.5);assert.equal(b.hp,100);
  hit(a,1.3);assert.equal(b.hp,98);
  hit(c,1.4);assert.deepEqual(visibleSpellMarks(room),[2,3]);assert.equal(c.hp,100);
  hit(c,2.6);assert.equal(b.hp,98); // 181px
  hit(a,2.7,q);assert.equal(c.hp,100);assert.equal(q.casting.marks.size,1);
  b.id=8;assert.ok(!visibleSpellMarks(room).includes(8));assert.equal(room.troopEffects.length,2);
  room.seconds=5.7;assert.equal(visibleSpellMarks(room),undefined);
});

test('authoritative live room marks the first target, conducts on the next, pauses and clears the wave',async()=>{
  const rooms=new Map(),server=createCoopServer({rooms,gauntletWarmup:300,reconnectMs:8000});
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const host='127.0.0.1:'+server.http.address().port,clients=[];
  async function client(){
    const ws=new WebSocket('ws://'+host+'/coop-socket',{origin:'http://'+host});clients.push(ws);
    const messages=[];ws.on('message',packet=>messages.push(JSON.parse(packet)));
    await once(ws,'open');
    return {ws,send:msg=>ws.send(JSON.stringify(msg)),async read(check){
      const until=Date.now()+6000;
      while(Date.now()<until){
        const i=messages.findIndex(check);if(i>=0)return messages.splice(0,i+1).pop();
        await new Promise(r=>setTimeout(r,15));
      }
      throw Error('expected room update timed out');
    }};
  }
  try{
    const a=await client();a.send({type:'create',heroes:['zhuge'],starDraft:2});
    const session=await a.read(m=>m.type==='session'),room=rooms.get(session.code);
    const b=await client();b.send({type:'join',code:session.code,heroes:['guanyu']});
    await b.read(m=>m.type==='session');a.send({type:'pickHero',hero:'zhuge'});b.send({type:'pickHero',hero:'guanyu'});
    await a.read(m=>m.picks?.every(p=>p.hero));a.send({type:'start'});await a.read(m=>m.type==='state');
    const p=room.players.get(0),other=room.players.get(1);
    room.run.wave=3;room.run.history=[room.run.upcoming];room.phase='draft';p.choices=[mark];other.choices=['speed'];
    a.send({type:'reward',id:mark});await b.read(m=>m.type==='draft'&&m.ready===1);
    b.send({type:'reward',id:'speed'});await a.read(m=>m.gauntlet?.wave===4);
    other.x=other.y=24;room.spawnIn=999;
    const first={...enemy(9001,p.x+60),y:p.y,hitIn:999},second={...enemy(9002,p.x+95),y:p.y,hitIn:999};
    room.enemies=[first,second];p.fireIn=0;
    await a.read(m=>m.spellMarks?.includes(first.id));
    second.x=p.x+1;p.fireIn=0;
    const snap=await a.read(m=>m.troopEffects?.some(f=>f.kind==='spell-chain'));
    assert.ok(Math.abs(snap.enemies.find(e=>e.id===first.id).hp-96.7)<1e-8);
    assert.deepEqual(new Set(snap.spellMarks),new Set([first.id,second.id]));
    a.ws.terminate();await b.read(m=>m.type==='connection'&&m.paused);
    const clock=room.seconds;await new Promise(r=>setTimeout(r,180));assert.equal(room.seconds,clock);
    const resumed=await client();resumed.send({type:'resume',code:session.code,token:session.token});
    const state=await resumed.read(m=>m.type==='state');assert.deepEqual(state.spellMarks,snap.spellMarks);
    room.run.boss=first;first.boss=true;first.hp=0;
    await resumed.read(m=>m.type==='draft');assert.equal(p.casting,undefined);
  }finally{for(const ws of clients)ws.terminate();await server.close();}
});
