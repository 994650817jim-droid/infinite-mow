import assert from 'node:assert/strict';
import test from 'node:test';
import {grantReward,rewardsFor} from './gauntlet.mjs';
import {pairedBattle} from './coop-fixture.mjs';
import {tryIgnite,tickBurns,fireWire} from './coop-burning.mjs';
import {EMBER,CINDERS,ignites,renewBurn} from '../src/rules/burning.ts';
const source=()=>({slot:0,hero:'zhaoyun',starDraft:4,stars:[],upgrades:{},hp:100,maxHp:100,x:10,y:10});
test('Ember draft and Cinders require actual prerequisites, old clients remain compatible',()=>{
  const p=source();grantReward(p,CINDERS.id);assert.deepEqual(p.stars,[]);assert.ok(rewardsFor(p,1).includes('ember'));
  const scarce=source();scarce.upgrades={damage:4,health:4};
  const batch=rewardsFor(scarce,1);assert.equal(batch.length,3);assert.ok(batch.includes(EMBER.id));assert.ok(batch.some(id=>id.includes('.')));
  for(let i=0;i<5;i++)grantReward(p,'ember');assert.equal(p.upgrades.ember,3);assert.ok(!rewardsFor(p,1).includes('ember'));
  p.stars=['strength.NR1','strength.NR2','bridge0.h'];assert.ok(rewardsFor(p,3).includes(CINDERS.id));
  grantReward(p,CINDERS.id);grantReward(p,CINDERS.id);assert.equal(p.stars.filter(id=>id===CINDERS.id).length,1);
  const old={...source(),starDraft:3};grantReward(old,'ember');assert.equal(old.upgrades.ember,undefined);assert.ok(!rewardsFor(old,1).includes('ember'));
  for(const [i,chance] of EMBER.chance.entries()){assert.ok(ignites(i+1,()=>chance-.001));assert.ok(!ignites(i+1,()=>chance));}
});
test('independent owners, exact ticks, duration, refresh without stacking, expired and recycled target cleanup',()=>{
 const a=source(),b={...source(),slot:1},e={id:7,x:0,y:0,hp:200};a.upgrades.ember=b.upgrades.ember=1;a.stars=[CINDERS.id];
 const room={seconds:0,players:new Map([[0,a],[1,b]]),enemies:[e]};
 tryIgnite(a,e,10,0,()=>0);tryIgnite(b,e,20,0,()=>0);tryIgnite(a,e,5,200,()=>0);
 assert.equal(a.burns.get(7).until,4200);assert.equal(b.burns.get(7).until,3000);assert.deepEqual(fireWire(room),[7]);
 room.seconds=.499;tickBurns(room);assert.equal(e.hp,200);
 room.seconds=.5;tickBurns(room);tickBurns(room);assert.ok(Math.abs(e.hp-196.8)<1e-9);
 room.seconds=3.1;tickBurns(room);assert.equal(b.burns.size,0);assert.ok(a.burns.has(7));
 e.id=9;tickBurns(room);assert.equal(a.burns.size,0);assert.equal(fireWire(room),undefined);
 const origin=renewBurn(undefined,1,100,3000,true);assert.equal(renewBurn(origin,2,200,3000,false).spread,false);
});
test('level-three fire specialist spreads once to at most two targets',()=>{
 const p=source();p.hero='zhouyu';p.upgrades.ember=3;
 const e={id:1,hp:20,x:0,y:0},others=[2,3,4].map(id=>({id,hp:20,x:3*id,y:0}));
 const r={seconds:.1,enemies:[e,...others],players:new Map([[0,p]])};
 tryIgnite(p,e,20,0,()=>0);e.hp=0;tickBurns(r);assert.deepEqual(fireWire(r),[2,3]);
 others[0].hp=0;tickBurns(r);assert.deepEqual(fireWire(r),[3]);
});
test('normal server strike ignites, disconnect freezes the pending tick, reconnect resumes and boss settlement clears it',()=>pairedBattle(4,async({room,a,b,session,connect})=>{
 const p=room.players.get(0),other=room.players.get(1);room.run.boss={id:6000,hp:0,boss:true,general:room.run.upcoming};room.enemies=[room.run.boss];
 const offer=await a.read(m=>m.type==='draft');assert.ok(offer.choices.includes('ember'));a.send({type:'reward',id:'ember'});await b.read(m=>m.type==='draft'&&m.ready===1);
 b.send({type:'reward',id:other.choices[0]});await a.read(m=>m.gauntlet?.wave===2);
 p.fireIn=0;other.x=other.y=24;room.spawnIn=999;
 const e={id:8123,x:p.x+60,y:p.y,hp:100,maxHp:100,boss:false,hitIn:999};room.enemies=[e];
 await a.read(m=>m.burning?.includes(8123));p.fireIn=999;
 a.ws.terminate();await b.read(m=>m.type==='connection'&&m.paused);const hp=e.hp,clock=room.seconds;
 await new Promise(r=>setTimeout(r,650));assert.equal(e.hp,hp);assert.equal(room.seconds,clock);
 const back=await connect();back.send({type:'resume',code:session.code,token:session.token});
 assert.deepEqual((await back.read(m=>m.type==='state')).burning,[8123]);
 await back.read(m=>m.enemies?.some(t=>t.id===8123&&t.hp<hp));assert.ok(e.hp<hp);
 e.boss=true;e.hp=0;room.run.boss=e;await back.read(m=>m.type==='draft');assert.equal(p.burns,undefined);
},{emberRandom:()=>0}));
