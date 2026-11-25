import assert from 'node:assert/strict';
import {updateRetinue} from './coop-retinue.mjs';
import {hits} from './gauntlet.mjs';
import {armyExit,insideArmyThreat} from '../src/rules/retinueTactics.ts';

const metrics={};
function simulate(name,kind,order,enemy,where,warning,seconds=1){
  const u={...where,id:7,owner:0,hp:100,maxHp:100,kind,level:1,fireAt:0,hurtAt:0,bossAt:0,strike:0};
  const leader={x:300,y:300,slot:0,hp:110,company:{units:[u],order,deaths:0}};
  const foe={...enemy,id:52,hp:2000,maxHp:2000,boss:true,kind:'boss',retinueAt:999};
  const room={run:{wave:12,boss:foe,warning},seconds:1,enemies:[foe],players:new Map([[0,leader]])};
  for(let i=0;i<Math.round(seconds/.05);i++){updateRetinue(room,.05);room.seconds+=.05;}
  metrics[name]={x:+u.x.toFixed(2),y:+u.y.toFixed(2),range:+Math.hypot(u.x-foe.x,u.y-foe.y).toFixed(2),hits:u.strike,threatened:warning?hits(warning,u):false};
  return metrics[name];
}
const lane={kind:'line',x:320,y:300,angle:0,radius:220,halfWidth:17,endsAt:3,resolved:false};
simulate('warned','spearman','sortie',{x:470,y:300},{x:400,y:300},lane,.95);
simulate('ranged','archer','sortie',{x:394,y:300},{x:420,y:300},null,1.35);
simulate('sortie','swordsman','sortie',{x:659,y:300},{x:375,y:300},null,2.5);
simulate('guard','swordsman','guard',{x:659,y:300},{x:375,y:300},null,2.5);
const ring={kind:'ring',x:450,y:300,angle:0,radius:146,innerRadius:86,endsAt:3,resolved:false};
simulate('ring','spearman','sortie',{x:450,y:300},{x:545,y:300},ring,.75);
const harmless={...lane,mythic:'divine',transit:{harmless:true}};
simulate('harmless','spearman','sortie',{x:470,y:300},{x:400,y:300},harmless,.95);
console.log(JSON.stringify(metrics));
assert.equal(metrics.warned.threatened,false,'leave and stay out of the announced real lane');
assert.equal(metrics.ring.threatened,false,'escape into the reachable ring hole');
assert.ok(metrics.ranged.range>=130 && metrics.ranged.hits>0,'back out of boss contact while retaining fire');
assert.ok(metrics.sortie.hits>0 && metrics.guard.hits===0,'sortie pursues out to the existing solo leash; guard remains home');
assert.ok(metrics.harmless.hits>0,'harmless reposition is an attack opportunity');
const cross={kind:'line',x:410,y:180,angle:Math.PI/2,radius:220,halfWidth:15};
const both=[lane,cross],start={x:410,y:300},open=(_,p)=>p.x>=400 && p.y>=300;
const exit=armyExit(both,start,6,open,4);
assert.ok(exit && open(start,exit) && both.every(w=>!insideArmyThreat(w,exit,6)),'both overlapping lanes and arena wall');
assert.equal(armyExit(both,start,6,()=>false,4),undefined,'cannot teleport across a sealed wall');
const sector={kind:'sweep',x:350,y:300,angle:0,arc:Math.PI/3,radius:120};
assert.ok(insideArmyThreat(sector,{x:405,y:305}));assert.equal(insideArmyThreat(sector,{x:290,y:305}),false);
const soldiers=[6,7,8].map(id=>({id,x:375,y:300,owner:0,hp:100,maxHp:100,kind:'swordsman',level:1,fireAt:0,strike:0}));
const boss={x:560,y:300,hp:2000,maxHp:2000,boss:true,retinueAt:999};
const room={run:{wave:12,warning:null,boss},enemies:[boss],seconds:1,players:new Map([[0,{x:300,y:300,hp:100,company:{units:soldiers,order:'sortie'}}]])};
for(let i=0;i<52;i++){updateRetinue(room,.05);room.seconds+=.05;}
const spread=Math.max(...soldiers.map(u=>u.y))-Math.min(...soldiers.map(u=>u.y));
console.log(JSON.stringify({flankSpread:spread,strikes:soldiers.map(u=>u.strike)}));
assert.ok(spread>42 && soldiers.every(u=>u.strike>0));
