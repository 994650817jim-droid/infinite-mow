import test from 'node:test';
import assert from 'node:assert/strict';
import {pairedBattle} from './coop-fixture.mjs';
import {strikeRetainer} from './coop-retinue.mjs';
import {challengeBoss} from '../src/data/mythicGauntlet.ts';

test('each commander keeps their actual survivors at the final blow, including on reconnect',()=>pairedBattle(4,async({room,a,b,session,connect})=>{
  function defeatUpcoming(){
    const defeated={id:4500,boss:true,hp:0,general:room.run.upcoming};
    room.enemies=[defeated]; room.run.boss=defeated;
  }
  defeatUpcoming();
  const [first,second]=await Promise.all([a,b].map(peer=>peer.read(m=>m.type==='draft')));
  a.send({type:'recruit',wave:1,receipt:0});
  await b.read(m=>m.type==='draft'&&m.party[0].company?.men===3);
  a.send({type:'reward',id:first.choices[0]}); b.send({type:'reward',id:second.choices[0]});
  await a.read(m=>m.gauntlet?.wave===2);
  // Fixture shortcut for the encounter; recruitment, casualties, checkpoint and result use server logic.
  const run=room.run; run.wave=20; run.tier='divine'; run.cleared=19;
  run.upcoming=challengeBoss('divine',20,10,run.roster);
  assert.equal(strikeRetainer(room,room.players.get(0).company.units[0],99999),true);
  defeatUpcoming();
  await b.read(m=>m.type==='draft'&&m.checkpoint);
  b.send({type:'recruit',wave:20,receipt:0});
  b.send({type:'finish',wave:20});
  const receipt=await a.read(m=>m.type==='result');
  assert.deepEqual(receipt.party.map(p=>[p.men,p.lost,p.atBossFall,p.afterBossRecruits]),[[2,1,2,0],[0,0,0,0]]);
  a.ws.terminate();
  const back=await connect(); back.send({type:'resume',code:session.code,token:session.token});
  assert.deepEqual(await back.read(m=>m.type==='result'),receipt);
}));
