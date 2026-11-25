import test from 'node:test';
import assert from 'node:assert/strict';
import {paySpoils,companyStatus,recruitCompany,updateRetinue,strikeRetainer,companyWire,OWNER_CAP} from './coop-retinue.mjs';
import {rewardsFor,grantReward} from './gauntlet.mjs';
import {GAUNTLET} from '../src/data/gauntlet.ts';
import {recruitCost} from '../src/data/gauntletRecruit.ts';
import {TROOPS} from '../src/data/legion.ts';
import {allyHp,allyAttack} from '../src/rules/retinue.ts';
import {pairedBattle} from './coop-fixture.mjs';
const init=()=>{const a={slot:0,hero:'zhaoyun',hp:100,maxHp:100,starDraft:3,x:400,y:300,upgrades:{},choices:['damage'],stars:[]},b={...a,slot:1,x:800,stars:[]};return {a,b,r:{seconds:1,phase:'draft',run:{wave:1},players:new Map([[0,a],[1,b]]),enemies:[]}};};
test('separate purses and troop caps, repeated messages cannot duplicate a purchase or payout',()=>{
 const {r,a,b}=init();b.starDraft=1;paySpoils(r);assert.equal(a.company,undefined);b.starDraft=3;
 for(let wave=1;wave<=10;wave++){r.run.wave=wave;paySpoils(r);const before=a.company.coins;paySpoils(r);assert.equal(a.company.coins,before);const cmd={wave,receipt:a.company.receipt};
 const purchased=recruitCompany(r,a,cmd,()=>0);assert.equal(a.company.coins,before-(purchased?recruitCost(wave):0));assert.equal(recruitCompany(r,a,cmd,()=>0),false);}
 assert.equal(a.company.units.length,OWNER_CAP);assert.equal(b.company.units.length,0);assert.ok(b.company.coins>a.company.coins);
 assert.equal(companyWire(r).length,OWNER_CAP);assert.equal(new Set(companyWire(r).map(row=>row[0])).size,OWNER_CAP);
});
test('two clients recruit their own soldiers, preserve resources, HP and orders across reconnection',()=>pairedBattle(3,async({room,a,b,session,connect})=>{
  const defeated={id:4500,boss:true,hp:0,general:room.run.upcoming};room.enemies=[defeated];room.run.boss=defeated;
  const offers=await a.read(m=>m.type==='draft'),mate=await b.read(m=>m.type==='draft');
  const purchase={type:'recruit',wave:1,receipt:0};a.send({...purchase,owner:1});a.send(purchase);
  const paid=await b.read(m=>m.type==='draft'&&m.party[0].company?.men===3);
  assert.equal(paid.party[0].company.coins,10);assert.equal(paid.party[1].company.coins,80);
  a.send({type:'reward',id:offers.choices[0]});b.send({type:'reward',id:mate.choices[0]});
  const next=await b.read(m=>m.gauntlet?.wave===2);assert.equal(next.retainers.length,3);
  a.send({type:'order',order:'sortie',owner:1});await b.read(m=>m.players?.[0].order==='sortie');
  room.players.get(0).company.units[0].hp=15;a.ws.terminate();await b.read(m=>m.type==='connection'&&m.paused);
  const clock=room.seconds;await new Promise(r=>setTimeout(r,150));assert.equal(room.seconds,clock);
  const back=await connect();back.send({type:'resume',code:session.code,token:session.token});
  const state=await back.read(m=>m.type==='state');assert.equal(state.retainers[0][5],15);assert.equal(state.players[0].order,'sortie');
  assert.ok(state.retainers.every(u=>u[1]===0));assert.equal(room.players.get(0).company.coins,10);
}));
test('guard, sortie, damage, owner stars, dead soldiers and the next muster use real HP',()=>{
 const {r,a,b}=init();paySpoils(r);assert.equal(a.company.coins,GAUNTLET.loot.food+GAUNTLET.loot.foodPerWave);
 assert.ok(recruitCompany(r,a,{wave:1,receipt:0},()=>0));assert.ok(recruitCompany(r,b,{wave:1,receipt:0},()=>0));
 const u=a.company.units[0],old=u.maxHp;u.hp=old/2;grantReward(a,'command.NR1');grantReward(a,'command.NR1');
 assert.equal(u.maxHp,allyHp(TROOPS.swordsman.hp,1,1.15));assert.equal(u.hp,u.maxHp/2);assert.equal(b.company.units[0].maxHp,old);
 assert.ok(strikeRetainer(r,u,100,true));assert.equal(u.hp,u.maxHp/2-Math.round(100*.4*.85-2));
 const t={id:300,hp:100,x:a.x+230,y:a.y};r.enemies=[t];r.phase='battle';r.seconds=2;
 updateRetinue(r,.1);assert.equal(t.hp,100);const guardX=u.x;a.company.order='sortie';
 for(let i=0;i<7;i++){r.seconds+=.1;updateRetinue(r,.1);}assert.ok(u.x>guardX);
 grantReward(a,'command.NR2');t.x=u.x+1;const before=t.hp;r.seconds+=2;updateRetinue(r,.05);
 assert.ok(before-t.hp>=allyAttack(TROOPS.swordsman.damage,1)*3/22*1.12-.00001);
 const bhp=b.company.units[0].hp;r.seconds+=2;strikeRetainer(r,u,999);strikeRetainer(r,u,999);
 updateRetinue(r,.05);assert.equal(a.company.deaths,1);assert.equal(a.company.units.length,2);assert.equal(b.company.units[0].hp,bhp);
 assert.equal(companyStatus(a,1).order,'sortie');assert.ok(!companyWire(r).some(row=>row[0]===u.id));assert.ok(rewardsFor(a,3).every(v=>v!=='command.NR1'));
});
