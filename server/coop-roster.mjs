import roster from '../src/coop/roster.json' with { type: 'json' };
import world from '../src/coop/arena.json' with { type: 'json' };
export const TYPES = roster.types;
// Co-op only: retain shared troop traits/art; account for two heroes' 3–7 damage hits.
export const COOP_TROOP_BALANCE = Object.freeze({
  hpBonus: Object.freeze({ support: 7, ranged: 4, lancer: 8, heavy: 9, courier: 5, aura: 7 }),
  minimumHeal: 2,
});
export const waveRoster = wave => roster.waves[wave <= 10 ? Math.max(0, wave - 1) : 7 + (wave - 11) % 3];
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const living = room => room.enemies.filter(e=>e.hp>0&&!e.escaped);
export function chooseTroop(room, random=Math.random) {
  if(room.seconds-room.run.started<12)return;
  const all=living(room), special=all.filter(e=>e.troop);
  if(special.length>=Math.max(1,Math.floor(all.length*.2)))return;
  const ids=waveRoster(room.run.wave).filter(id=>all.filter(e=>e.troop===id).length<TYPES[id].cap);
  const roll=random();if(!ids.length||roll>=.12)return;
  return ids[Math.min(ids.length-1,Math.floor(roll/.12*ids.length))];
}
export function initTroop(e,id,seconds) {
  const def=TYPES[id];if(!def)return e;
  e.troop=id;e.hp=e.maxHp=Math.max(2,Math.round(e.maxHp*def.mul.hp)+(COOP_TROOP_BALANCE.hpBonus[def.role]??0));
  e.skillAt=seconds+1;e.bornAt=seconds;e.face=0;e.used=false;
  return e;
}
export function troopHit(room,e,player,damage) {
  const t=TYPES[e.troop]?.trait;
  if(t?.kind==='brace'&&e.cue){const angle=Math.atan2(player.y-e.y,player.x-e.x);if(Math.cos(angle-e.face)>.5)damage*=1-t.front;}
  if(t?.kind==='guard'&&living(room).some(b=>b.boss&&distance(b,e)<t.radius))damage*=t.mul;
  const before=e.hp;
  e.hp-=damage;
  const owner=room.players?.get?.(player.slot ?? player.owner);
  if(owner && before>0){
    owner.damage=(owner.damage??0)+Math.max(0,before-Math.max(0,e.hp));
    if(e.hp<=0)owner.defeats=(owner.defeats??0)+1;
  }
  if(e.cue&&(t?.kind==='signal'||t?.kind==='healer')){e.cue=null;e.skillAt=room.seconds+(t.retryMs??t.everyMs)/1000;}
}
function move(e,target,speed,dt,away=false){const d=distance(e,target);if(!d)return;const step=Math.min(d,speed*dt)*(away?-1:1);e.x=Math.max(24,Math.min(world.width-24,e.x+(target.x-e.x)*step/d));e.y=Math.max(24,Math.min(world.height-24,e.y+(target.y-e.y)*step/d));}
function cue(e,room,kind,seconds,range,width=20){e.cue={kind,x:e.x,y:e.y,angle:e.face,range,width,endsAt:room.seconds+seconds};}
function effect(room,e,kind,radius=24){room.troopEffects??=[];if(room.troopEffects.length<48)room.troopEffects.push({kind,x:e.x,y:e.y,radius,until:room.seconds+.5});}
function shoot(room,e,angle,speed,damage,range,slow){room.shots??=[];if(room.shots.length>=64)return;room.shots.push({x:e.x,y:e.y,angle,speed,damage:damage*(e.damageBuff??1),slow,left:range/speed,hit:[]});}
/** Server owns all timers, projectiles and buffs. Called only on advancing battle ticks. */
export function prepareTroops(room,dt,hurt,now) {
  if(dt<=0)return;
  room.troopEffects=(room.troopEffects??[]).filter(f=>f.until>room.seconds);
  const all=living(room);for(const e of all){e.speedBuff=1;e.damageBuff=1;}
  for(const e of all){const t=TYPES[e.troop]?.trait;if(t?.kind!=='aura')continue;
    for(const a of all.filter(a=>a!==e&&!a.boss&&distance(a,e)<t.radius).sort((a,b)=>distance(a,e)-distance(b,e)).slice(0,t.maxTargets??6)){a.speedBuff=Math.max(a.speedBuff,t.speedMul);a.damageBuff=Math.max(a.damageBuff,t.damageMul);}
  }
  room.shots=(room.shots??[]).filter(s=>{
    if(s.left<=0)return false;
    const step=Math.min(dt,s.left),ox=s.x,oy=s.y;s.x+=Math.cos(s.angle)*s.speed*step;s.y+=Math.sin(s.angle)*s.speed*step;s.left=Math.max(0,s.left-step);
    for(const p of room.players.values())if(p.hp>0&&!s.hit.includes(p.slot)){
      const dx=s.x-ox,dy=s.y-oy,q=Math.max(0,Math.min(1,((p.x-ox)*dx+(p.y-oy)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(p.x-ox-dx*q,p.y-oy-dy*q)<16){s.hit.push(p.slot);if(hurt(p,s.damage,now)&&s.slow){p.slowUntil=room.seconds+s.slow.seconds;p.slow=s.slow.amount;}s.left=0;break;}
    }return s.left>0;
  });
}
export function stepTroop(room,e,target,dt,{hurt,now,spawn,cap}) {
  const def=TYPES[e.troop];if(!def)return false;
  const t=def.trait,time=room.seconds,d=distance(e,target),speed=64*def.mul.speed*(e.speedBuff??1);
  if(e.cue){
    if(time<e.cue.endsAt)return true;
    const c=e.cue;e.cue=null;e.skillAt=time+(t.everyMs??t.retryMs??4000)/1000;
    if(t.kind==='signal'){e.used=true;for(let i=0;i<t.reinforcements&&room.enemies.length<cap;i++)spawn();effect(room,e,'signal',36);}
    if(t.kind==='healer')for(const a of living(room).filter(a=>a!==e&&!a.boss&&a.hp<a.maxHp&&distance(e,a)<t.radius).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).slice(0,t.maxTargets??3)){a.hp=Math.min(a.maxHp,a.hp+Math.max(COOP_TROOP_BALANCE.minimumHeal,a.maxHp*t.share));effect(room,a,'heal');}
    if(t.kind==='brace'){
      effect(room,e,'stab',t.range);
      for(const p of room.players.values())if(p.hp>0){const dx=p.x-c.x,dy=p.y-c.y,along=dx*Math.cos(c.angle)+dy*Math.sin(c.angle),cross=Math.abs(-dx*Math.sin(c.angle)+dy*Math.cos(c.angle));if(along>=0&&along<=c.range&&cross<=c.width/2)hurt(p,t.damage,now);}
    }
    if(t.kind==='fanarcher')for(const off of [-t.spread,0,t.spread])shoot(room,e,c.angle+off,t.speed,Math.max(2,Math.min(11,5+Math.floor(room.run.wave/2))*t.damageMul),c.range);
    if(t.kind==='net')shoot(room,e,c.angle,230,t.hitDamage,c.range,{amount:t.slow,seconds:t.slowMs/1000});
    if(t.kind==='javelin')shoot(room,e,c.angle,t.speed,Math.max(3,Math.min(11,5+Math.floor(room.run.wave/2))*def.mul.damage),c.range);
    return true;
  }
  e.face=Math.atan2(target.y-e.y,target.x-e.x);
  if(t.kind==='courier'){
    move(e,target,speed,dt,true);
    if(time-e.bornAt>=t.runMs/1000){e.escaped=true;e.hp=0;for(let i=0;i<t.reinforce&&room.enemies.length<cap;i++)spawn();}
    return true;
  }
  if(t.kind==='guard'){
    const boss=living(room).find(a=>a.boss);if(boss&&d>t.engage){if(distance(e,boss)>65)move(e,boss,speed,dt);return true;}return false;
  }
  if(t.kind==='aura'||t.kind==='healer'){
    if(t.kind==='healer'&&time>=e.skillAt&&living(room).some(a=>!a.boss&&a!==e&&a.hp<a.maxHp&&distance(a,e)<t.radius))cue(e,room,'heal',t.channelMs/1000,t.radius);
    else if(d<t.keepAway*.75)move(e,target,speed,dt,true);else if(d>t.keepAway)move(e,target,speed,dt);
    return true;
  }
  if(t.kind==='signal'){
    if(!e.used&&time>=e.skillAt&&d<t.range){cue(e,room,'signal',t.warnMs/1000,36);return true;}return false;
  }
  const range=t.range;
  if(time>=e.skillAt&&d<range){cue(e,room,t.kind==='brace'?'line':t.kind==='fanarcher'?'fan':t.kind==='net'?'net':'line',(t.warnMs??650)/1000,range,t.width??16);if(e.cue&&t.kind==='fanarcher')e.cue.spread=t.spread;return true;}
  if(t.kind==='brace'){if(d>range*.8)move(e,target,speed,dt);return true;}
  if(d<range*.4)move(e,target,speed,dt,true);else if(d>range*.8)move(e,target,speed,dt);
  return true;
}
export function clearTroops(room){room.shots=[];room.troopEffects=[];for(const p of room.players.values()){p.slowUntil=0;p.slow=0;}}
