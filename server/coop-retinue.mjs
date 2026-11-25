import {shadowExit} from '../src/data/ghostZhangxiu.ts';
import {weiAdvance,weiBowExit} from '../src/data/divineCaocao.ts';
import {GAUNTLET} from '../src/data/gauntlet.ts';
import {GAUNTLET_RECRUIT,recruitCost,recruitTier} from '../src/data/gauntletRecruit.ts';
import {TROOPS,LEGION,BOSS_VS_TROOPS,BOSS_VS_ALLY} from '../src/data/legion.ts';
import {allyHp,allyAttack,retinueStarHp,retinueBossTaken,nearOrderBonus} from '../src/rules/retinue.ts';
import {windExit} from '../src/data/divineZhouyu.ts';
import {halberdExit} from '../src/data/ghostLubu.ts';
import {troopHit,TYPES} from './coop-roster.mjs';
import arena from '../src/coop/arena.json' with {type:'json'};

export const UNIT_POOL=GAUNTLET_RECRUIT.tiers.flatMap(t=>t.kinds).filter((v,i,a)=>a.indexOf(v)===i);
export const OWNER_CAP=LEGION.squadSize;
const has=(p,id)=>p.stars?.includes(id)??false;
export const retinueEnabled=room=>room.players.size===2 && [...room.players.values()].every(p=>p.starDraft>=3);
export function paySpoils(room){
  if(!retinueEnabled(room))return;
  for(const p of room.players.values()){
    p.company??={coins:0,order:'guard',units:[],receipt:0,paid:0,deaths:0};
    if(p.company.paid===room.run.wave)continue;
    p.company.paid=room.run.wave;p.company.coins+=GAUNTLET.loot.food+GAUNTLET.loot.foodPerWave*room.run.wave;
  }
}
export function companyStatus(p,wave){
  const c=p.company;
  return c && {coins:c.coins,men:c.units.length,cap:OWNER_CAP,order:c.order,deaths:c.deaths,receipt:c.receipt,cost:recruitCost(wave)};
}
export function recruitCompany(room,p,cmd,rng=Math.random){
  const c=p.company,w=room.run.wave,cost=recruitCost(w),tier=recruitTier(w);
  if(!retinueEnabled(room)||!c||room.phase!=='draft'||!p.choices?.length||cmd.wave!==w||cmd.receipt!==c.receipt||
    c.coins<cost||c.units.length+GAUNTLET_RECRUIT.per>OWNER_CAP)return false;
  const kind=tier.kinds[Math.floor(rng()*tier.kinds.length)];
  c.coins-=cost;c.receipt++;
  for(const u of c.units)if(u.kind===kind && u.level<tier.level){
    const hp=allyHp(TROOPS[kind].hp,tier.level,retinueStarHp(has(p,'command.NR1')));
    u.hp+=hp-u.maxHp;u.maxHp=hp;u.level=tier.level;
  }
  for(let i=0;i<GAUNTLET_RECRUIT.per;i++){
    const id=room.nextAllyId=(room.nextAllyId??0)+1,hp=allyHp(TROOPS[kind].hp,tier.level,retinueStarHp(has(p,'command.NR1')));
    c.units.push({id,owner:p.slot,kind,level:tier.level,x:p.x,y:p.y,hp,maxHp:hp,dir:0,fireAt:0,hurtAt:0,bossAt:0,strike:0});
  }
  return true;
}
export function refreshRetinueHp(p){
  for(const u of p.company?.units??[]){const hp=allyHp(TROOPS[u.kind].hp,u.level,retinueStarHp(has(p,'command.NR1')));u.hp=(u.hp/u.maxHp)*hp;u.maxHp=hp;}
}
function advance(u,x,y,speed,dt){
  const dx=x-u.x,dy=y-u.y,len=Math.hypot(dx,dy);if(len<3)return;
  const k=Math.min(1,dt*speed/len);
  u.x=Math.max(16,Math.min(arena.width-16,u.x+dx*k));u.y=Math.max(16,Math.min(arena.height-16,u.y+dy*k));
  u.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?1:2):(dy<0?3:0);
}
export function strikeRetainer(room,u,raw,boss=false,deathFloor=0){
  const p=room.players.get(u.owner),now=room.seconds;
  if(!p||u.hp<=0||now<u.hurtAt||(boss&&now<u.bossAt))return false;
  const def=TROOPS[u.kind],armor=def.armor+(u.kind==='guardian'&&u.level===3?5:0);
  const adjusted=boss?raw*BOSS_VS_ALLY.mul*retinueBossTaken(has(p,'command.NR1')):raw;
  u.hp=Math.max(deathFloor,u.hp-Math.max(1,Math.round(adjusted-armor)));
  u.hurtAt=now+.45;if(boss)u.bossAt=now+BOSS_VS_ALLY.immuneMs/1000;
  if(!u.hp)p.company.deaths++;
  return true;
}
export function updateRetinue(room,dt){
  for(const p of room.players.values()){
    const c=p.company;if(!c)continue;
    c.units=c.units.filter(u=>u.hp>0);
    for(const [i,u] of c.units.entries()){
      const def=TROOPS[u.kind],sortie=c.order==='sortie'&&p.hp>0;
      const fx=p.x+((i%4)-1.5)*26,fy=p.y+30+Math.floor(i/4)*24;
      const wei=room.run.warning;
      if(wei?.shadow){
        const exit=shadowExit(wei,u,(_,p)=>p.x>=16&&p.y>=16&&p.x<=arena.width-16&&p.y<=arena.height-16);
        if(exit){advance(u,exit.x,exit.y,def.speed,dt);continue;}
      }
      if(wei?.wind){
        const exit=windExit(wei,u,room.seconds,(_,to)=>to.x>=16 && to.y>=16 && to.x<=arena.width-16 && to.y<=arena.height-16);
        if(exit){advance(u,exit.x,exit.y,def.speed,dt);continue;}
      }
      if(wei?.wei?.stance==='bow'){
        const exit=weiBowExit(wei,u,(_,to)=>to.x>=16 && to.y>=16 && to.x<=arena.width-16 && to.y<=arena.height-16);
        if(exit){advance(u,exit.x,exit.y,def.speed,dt);continue;}
      }
      const before=wei?.wei?.stance==='shield'?{x:u.x,y:u.y}:undefined;
      if(room.run.warning?.charge){
        const exit=halberdExit(room.run.warning,u,(_,to)=>to.x>=12&&to.y>=12&&to.x<=arena.width-12&&to.y<=arena.height-12);
        if(exit){advance(u,exit.x,exit.y,def.speed,dt);continue;}
      }
      let target,dist=Infinity;
      for(const e of room.enemies){
        if(e.hp<=0 || Math.hypot(e.x-p.x,e.y-p.y)>(sortie?320:150))continue;
        const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<dist){dist=d;target=e;}
      }
      const range=def.range*(u.kind==='halberdier'&&u.level===3?1.25:1);
      if(target&&dist<=range&&p.hp>0){
        if(room.seconds>=u.fireAt){
          u.fireAt=room.seconds+def.cooldown;u.strike++;
          const bonus=nearOrderBonus(has(p,'command.NR2'),u.x-p.x,u.y-p.y,0);
          const attacks=u.level===3&&['swordsman','archer','rider'].includes(u.kind)?(u.kind==='rider'?3:2):1;
          const victims=[target];
          if(attacks>1)for(const e of room.enemies){if(victims.length>=attacks)break;if(e!==target&&e.hp>0&&Math.hypot(e.x-u.x,e.y-u.y)<=range)victims.push(e);}
          for(const e of victims){
            const cavalry=TYPES[e.troop]?.base==='cavalry'||e.troop==='cavalry';
            // The arena's base hero strike is 3 HP; solo's base spear is 22 HP.
            troopHit(room,e,u,allyAttack(def.damage,u.level)*(3/22)*bonus*(u.kind==='spearman'&&u.level===3&&cavalry?2:1));
          }
        }
      }else if(sortie&&target)advance(u,target.x,target.y,def.speed,dt);
      else advance(u,fx,fy,def.speed,dt);
      const held=before && weiAdvance(wei,before,u,room.seconds);
      if(held){u.x=Math.max(16,Math.min(arena.width-16,held.x));u.y=Math.max(16,Math.min(arena.height-16,held.y));}
    }
  }
  // Use each attacker's own contact timer. A regular attacker chooses only one nearby soldier.
  for(const e of room.enemies){
    if(e.hp<=0||room.seconds<(e.retinueAt??0))continue;
    if(e===room.run.boss&&room.run.warning?.shadow)continue;
    if(e===room.run.boss&&room.run.warning?.charge&&room.run.warning.resolved)continue;
    let hits=0,kills=0;
    for(const p of room.players.values())for(const u of p.company?.units??[]){
      if((!e.boss&&hits)||u.hp<=0||Math.hypot(e.x-u.x,e.y-u.y)>(e.boss?BOSS_VS_TROOPS.sweepReach:23))continue;
      const base=Math.min(11,5+Math.floor(room.run.wave/2))*(TYPES[e.troop]?.mul.damage??1)*(e.damageBuff??1);
      if(strikeRetainer(room,u,base*(e.boss?BOSS_VS_TROOPS.contactMul:1),!!e.boss,kills>=BOSS_VS_ALLY.killCapPerCast?1:0)){hits++;if(!u.hp)kills++;}
    }
    if(hits)e.retinueAt=room.seconds+(e.boss?1:.85);
  }
}
export function companyWire(room){
  const rows=[];for(const p of room.players.values())for(const u of p.company?.units??[])if(u.hp>0)
    rows.push([u.id,u.owner,UNIT_POOL.indexOf(u.kind),Math.round(u.x),Math.round(u.y),Math.ceil(u.hp),u.maxHp,u.dir,u.strike]);
  return rows.length?rows:undefined;
}
