import test from 'node:test';
import assert from 'node:assert/strict';
import {mythicBoss,mythicSequence,mythicHit} from '../src/data/mythicGauntlet.ts';
import {resolveBossWarning,clearBossAttack} from './gauntlet.mjs';

for (const cast of [0,1]) test('ghost Guan Yu locks the original trace, cast '+cast,()=>{
  const boss=mythicBoss('ghost_guanyu'),origin={x:21,y:32},target={x:111,y:32};
  assert.ok(mythicSequence(boss,origin,target,cast,false,10).every(w=>!w.scar));
  const queue=mythicSequence(boss,origin,target,cast,true,10);
  const first=queue[0],back=queue.at(-1);
  assert.ok(back.retracesScar);assert.ok(back.scar.lightsAt>back.startsAt);
  assert.ok(back.endsAt-back.scar.lightsAt>=1.14);
  for(const key of ['kind','x','y','angle','radius','halfWidth'])assert.equal(first[key],back[key]);
  assert.ok(queue.slice(1).every((w,i)=>w.startsAt>queue[i].endsAt+.31));
  origin.x=999;target.y=999;
  const inside={x:90,y:32,hp:100},escaped={x:21,y:109,hp:100,owner:0};
  assert.ok(mythicHit(back,inside));assert.equal(mythicHit(back,escaped),false);
  const run={boss:{general:boss,hp:100},mythicQueue:[back],warning:null},hits=[];
  for(const t of [back.startsAt,back.scar.lightsAt-.01,back.scar.lightsAt+.10,back.endsAt-.01]){
    resolveBossWarning(run,[inside,escaped],t,p=>hits.push(p));assert.equal(hits.length,0);
    const wire = JSON.parse(JSON.stringify(run.warning));
    assert.deepEqual(wire.scar,JSON.parse(JSON.stringify(back.scar)));
    assert.equal(mythicHit(wire,inside),true);
    assert.equal(mythicHit(wire,escaped),false);
  }
  for(const t of [back.endsAt+.06,back.endsAt+.12,back.endsAt+.4])resolveBossWarning(run,[inside,escaped],t,p=>hits.push(p));
  assert.deepEqual(hits,[inside]);clearBossAttack(run);assert.equal(run.warning,null);assert.deepEqual(run.mythicQueue,[]);
});
