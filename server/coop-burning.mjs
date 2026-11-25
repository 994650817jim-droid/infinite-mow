import {EMBER,CINDERS,burnBonus,ignites,renewBurn} from '../src/rules/burning.ts';
import {SCHOOL_TIER,heroAffinity,tierOf} from '../src/data/schools.ts';
import {troopHit} from './coop-roster.mjs';
export const fireLevel=p=>p.upgrades?.ember??0;
const tier=p=>tierOf(fireLevel(p)+Number(heroAffinity(p.hero)[0]==='fire'));
const bonus=p=>burnBonus(!!p.stars?.includes(CINDERS.id));
function apply(p,e,damage,now,spread){
  if(e.hp<=0||e.escaped)return;
  const burns=p.burns??=new Map(),key=e.id,prev=burns.get(key);
  if(!prev&&burns.size>=EMBER.cap)return;
  const ms=EMBER.duration+(tier(p)>=2?SCHOOL_TIER.fire.burnExtraMs:0)+bonus(p).extraMs;
  burns.set(key,{enemy:e,...renewBurn(prev?.enemy===e?prev:undefined,damage,now,ms,spread)});
}
export function tryIgnite(p,e,raw,now,rng=Math.random){
  if(p.starDraft>=4 && e.hp>0 && ignites(fireLevel(p),rng))apply(p,e,raw*EMBER.ratio,now,false);
}
export function tickBurns(room){
  const now=room.seconds*1000;
  for(const p of room.players.values())if(p.burns?.size){
    const mul=bonus(p).mul*(tier(p)>=2?1+SCHOOL_TIER.fire.fireDmg:1);
    for(const [id,b] of p.burns){
      if(b.enemy.id!==id||b.enemy.escaped||now>b.until){p.burns.delete(id);continue;}
      if(b.enemy.hp>0&&now>=b.next){b.next=now+EMBER.period;troopHit(room,b.enemy,p,b.damage*mul);}
    }
  }
  for(const p of room.players.values())if(p.burns?.size){
    for(const [id,b] of p.burns){
      if(b.enemy.hp>0)continue;p.burns.delete(id);
      if(b.spread||tier(p)<4)continue;
      let targets=0;
      for(const e of room.enemies){
        if(e.hp<=0||e.escaped||Math.hypot(e.x-b.enemy.x,e.y-b.enemy.y)>SCHOOL_TIER.fire.liaoyuanR)continue;
        apply(p,e,b.damage*SCHOOL_TIER.fire.liaoyuanRatio,now,true);
        if(++targets>=SCHOOL_TIER.fire.liaoyuanTargets)break;
      }
    }
  }
}
export function fireWire(room){
  const ids=new Set();for(const p of room.players.values())if(p.burns)for(const [id,b] of p.burns)if(b.enemy.hp>0)ids.add(id);
  return ids.size?[...ids]:undefined;
}
