import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {WebSocket} from 'ws';
import {createCoopServer} from './coop.mjs';
import {updateRetinue} from './coop-retinue.mjs';
import {resolveBossWarning} from './gauntlet.mjs';
import {windSequence,windPoint,windBand,inWind,windContact} from '../src/data/divineZhouyu.ts';
const origin={x:360,y:320},target={x:455,y:320},pass=()=>true;
const [first,quiet,second]=windSequence(origin,target,0,true,1,pass);
const clock=first.wind.ignite+.72;
assert.ok(first.wind.ignite-first.startsAt>=1.4);
assert.equal(windBand(first,first.wind.ignite-.001),undefined);
assert.equal(windBand(first,first.endsAt),undefined);
assert.ok(second.startsAt-first.endsAt>=1.8);
assert.ok(second.wind.ignite-first.endsAt>=3);
assert.ok(Math.abs(second.angle-first.angle)>1);
const front=windPoint(first,98,0),ember=windPoint(first,52,0),later=clock+.14;
assert.ok(inWind(first,front,clock));assert.ok(inWind(first,ember,later));
const doses=new Map();
const hit=p=>()=>{doses.set(p,(doses.get(p)??0)+1);return true;};
for(const p of [front,ember]){
  assert.equal(windContact(first,p,clock,1,()=>false),false);
  for(const time of [clock,clock+.02,clock+.08])windContact(first,p,time,1,hit(p));
  assert.equal(doses.get(p),1);
  assert.ok(windContact(first,p,clock+.09,2,hit(p)));
}
const up=windPoint(first,-26,0),outside=windPoint(first,108,first.wind.shoulder);
for(let t=first.startsAt;t<first.endsAt+.1;t+=.05){assert.equal(inWind(first,up,t),false);assert.equal(inWind(first,outside,t),false);}
for(let t=first.endsAt;t<second.wind.ignite;t+=.03){assert.equal(windBand(first,t),undefined);assert.equal(windBand(quiet,t),undefined);assert.equal(windBand(second,t),undefined);}
const narrow=windSequence(origin,target,0,true,0,(a,b)=>[a,b].every(p=>Math.abs(p.y-origin.y)<7));
assert.ok(narrow.every(w=>w.wind.calm));
const soldier={id:42,owner:0,hp:80,maxHp:80,level:1,kind:'spearman',fireAt:0,...target};
const unitRoom={run:{warning:first,wave:25},seconds:first.startsAt,enemies:[],players:new Map([[0,{...target,hp:100,company:{units:[soldier],order:'guard'}}]])};
for(let t=first.startsAt;t<first.endsAt;t+=.04){unitRoom.seconds=t;updateRetinue(unitRoom,.04);assert.equal(inWind(first,soldier,t),false);}
// Route two soldiers through the authority's live contact resolver, including late entry into coals.
const s1={...front,hp:40,owner:0},s2={...outside,hp:40,owner:1},authority={boss:{hp:200,general:{id:'divine_zhouyu'}},mythicQueue:[first],warning:first};
for(const t of [clock,clock+.03])resolveBossWarning(authority,[s1,s2],t,p=>{p.hp-=4;return true;});
Object.assign(s2,ember);
for(const t of [later,later+.01])resolveBossWarning(authority,[s1,s2],t,p=>{p.hp-=4;return true;});
assert.equal(s1.hp,36);assert.equal(s2.hp,36);
const rooms=new Map(),sockets=[],server=createCoopServer({rooms,gauntletWarmup:.1});
async function peer(url){
  const ws=new WebSocket(url.replace('http:','ws:')+'/coop-socket',{origin:url}),inbox=[];sockets.push(ws);
  ws.on('message',raw=>inbox.push(JSON.parse(raw)));await once(ws,'open');
  return {ws,send:m=>ws.send(JSON.stringify(m)),async until(fn){
    const end=Date.now()+11000;
    while(Date.now()<end){const i=inbox.findIndex(fn);if(i>=0)return inbox.splice(0,i+1).at(-1);await delay(10);}
    throw Error('Missing packet '+fn+'; last warning '+JSON.stringify(inbox.at(-1)?.gauntlet?.warning));
  }};
}
try{
  server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
  const url='http://127.0.0.1:'+server.http.address().port,a=await peer(url);let b=await peer(url);
  a.send({type:'create',extreme:true,heroes:['zhaoyun'],starDraft:4});const {code}=await a.until(m=>m.type==='lobby');
  b.send({type:'join',code,heroes:['guanyu'],starDraft:4});const session=await b.until(m=>m.type==='session');
  a.send({type:'pickHero',hero:'zhaoyun'});b.send({type:'pickHero',hero:'guanyu'});
  await a.until(m=>m.type==='lobby'&&m.picks.every(x=>x.hero));
  const room=rooms.get(code);room.run.wave=25;room.run.cleared=24;room.run.tier='divine';
  a.send({type:'start'});await a.until(m=>m.type==='state'&&m.gauntlet.general?.id==='divine_zhouyu');
  const boss=room.run.boss,host=room.players.get(0),guest=room.players.get(1);
  Object.assign(boss,origin);Object.assign(host,target);Object.assign(guest,{x:target.x,y:target.y+105});
  boss.hp=Math.floor(boss.maxHp*.48);room.run.attackAt=room.seconds+.12;
  const flag=await a.until(m=>m.type==='state'&&m.gauntlet.warning?.wind);
  const w=flag.gauntlet.warning,hp=host.hp;
  const struck=await b.until(m=>m.type==='state'&&m.players[0].hp<hp&&m.gauntlet.warning?.wind);
  assert.ok(struck.seconds>=w.wind.ignite&&struck.seconds<w.endsAt);
  // A soldier steps into the same burning tile with a prior boss i-frame still active.
  const recruit={...soldier,id:506,owner:0,x:host.x,y:host.y,hp:80,maxHp:80,hurtAt:0,bossAt:room.seconds+.13,strike:0};
  host.company??={coins:0,order:'guard',units:[],receipt:0,paid:0,deaths:0};host.company.units.push(recruit);
  const landed=await a.until(m=>m.type==='state' && m.gauntlet.warning?.startsAt===w.startsAt && m.retainers?.some(u=>u[0]===506 && u[5]<80));
  assert.ok(landed.seconds< w.endsAt);assert.ok(recruit.hp<80);
  const after=host.hp; b.ws.terminate();await a.until(m=>m.type==='connection'&&m.paused);
  const paused=room.seconds;await delay(320);assert.equal(room.seconds,paused);
  b=await peer(url);b.send({type:'resume',code,token:session.token});
  const resumed=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.wind);
  assert.deepEqual(resumed.gauntlet.warning,w);assert.equal(resumed.players[0].hp,after);
  const lull=await b.until(m=>m.type==='state'&&m.gauntlet.warning?.wind?.calm);
  assert.equal(lull.players[0].hp,after);
  const turn=await a.until(m=>m.type==='state'&&m.gauntlet.warning?.name==='东风转旗 · 再辨风向');
  assert.ok(turn.gauntlet.warning.startsAt-w.endsAt>=1.8);
  assert.notEqual(turn.gauntlet.warning.angle,w.angle);
  console.log(JSON.stringify({geometry:'advancing crest, lingering coals, one hit per life and field, two safe routes, blocked terrain stands down',
    authority:'2 soldiers each damaged once; one entered still-live coals',postImmunitySoldierHp:recruit.hp,retainerClear:true,joinedPeers:2,paused,reconnect:true,
    hostHp:[hp,after,lull.players[0].hp],fireFreeSeconds:turn.gauntlet.warning.wind.ignite-w.endsAt}));
}finally{for(const ws of sockets)ws.terminate();await server.close();}
