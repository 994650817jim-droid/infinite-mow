import assert from 'node:assert/strict';
import test from 'node:test';
import {mythicBoss,mythicSequence,mythicTransit,mythicHit,starEyeOpen,hitStarEye} from '../src/data/mythicGauntlet.ts';
import {beginBossWarning,resolveBossWarning,clearBossAttack,newGauntlet} from './gauntlet.mjs';
const start={x:250,y:320}, player={x:360,y:320,hp:100,slot:0};
function cast(id,n=0,phase=false,clear){return mythicSequence(mythicBoss('divine_'+id),start,player,n,phase,0,clear);}
test('Zhao Yun stays put until windup, travels through the midpoint and returns without damage',()=>{
  const [out,back]=cast('zhaoyun');
  assert.equal(mythicTransit(out,.9),undefined);
  assert.ok(mythicTransit(out,1.05).x>start.x&&mythicTransit(out,1.05).x<out.transit.to.x);
  assert.deepEqual(mythicTransit(back,back.endsAt),start);assert.equal(mythicHit(back,start),false);
  assert.equal(cast('zhaoyun',2,true).length,3);
  const blocked=cast('zhaoyun',2,true,(_,b)=>b.x<310);
  assert.ok(blocked.every(w=>w.transit.to.x<310));assert.equal(blocked.length,2);
});
test('Zhuge Liang uses one shared eye; a simultaneous third hit cannot claim another break',()=>{
  const seq=cast('zhugeliang',2,true),f=seq[0].constellation;
  assert.equal(starEyeOpen(f,.95),false);assert.equal(hitStarEye(f,1),true);
  assert.equal(hitStarEye(f,1.8),true);assert.equal(hitStarEye(f,1.8),false);
  const last=seq.at(-1);assert.equal(last.constellation,f);assert.equal(mythicHit(last,{x:last.x+70,y:last.y}),false);
  const intact=cast('zhugeliang',0,true).at(-1);
  assert.equal(mythicHit(intact,player),false);assert.equal(mythicHit(intact,{x:intact.x+70,y:intact.y}),true);
  assert.equal(cast('zhugeliang',0,true,()=>false).some(w=>w.closing),false);
});
test('Liu Bei alternates distinct spirits and leaves time to change position',()=>{
  const [blade,roar]=cast('liubei',0,true);
  assert.equal(blade.spirit,'guanyu');assert.equal(roar.spirit,'zhangfei');
  assert.equal(cast('liubei',1)[0].spirit,'zhangfei');
  assert.equal(mythicHit(blade,{x:blade.x-75,y:blade.y}),false);
  assert.equal(mythicHit(roar,roar),false);assert.equal(mythicHit(roar,{x:roar.x+112,y:roar.y}),true);
  assert.ok(roar.endsAt-blade.endsAt>=1.2);assert.deepEqual(blade.nextFlag,{x:roar.x,y:roar.y});
});
test('authoritative transit freezes on an unchanged clock, and death clears queued casts',()=>{
  const run=newGauntlet(.1);run.boss={...start,hp:100,general:{id:'divine_zhaoyun'}};
  assert.ok(beginBossWarning(run,player,0));
  resolveBossWarning(run,[player],1.05,()=>{});const x=run.boss.x;assert.ok(x>start.x);
  resolveBossWarning(run,[player],1.05,()=>{});assert.equal(run.boss.x,x);
  run.boss.hp=0;resolveBossWarning(run,[player],1.5,()=>assert.fail());assert.equal(run.warning,null);
  assert.deepEqual(run.mythicQueue,[]);clearBossAttack(run);
});
