import {CHARACTERS} from '../src/data/characters.ts';
import {SPELL_WEAPONS} from '../src/data/attributes.ts';
import {STAR_OUTER_TUNING} from '../src/data/starOuter.ts';
import {applySpellMark,expireMarks} from '../src/rules/starMarks.ts';
import {troopHit} from './coop-roster.mjs';

const casters=new Set(CHARACTERS.filter(hero=>SPELL_WEAPONS.has(hero.startWeapon)).map(hero=>hero.id));
const host={valid:enemy=>enemy.hp>0&&!enemy.escaped,identity:enemy=>enemy.id};
export const canDraftMark=player=>player.starDraft===2 && casters.has(player.hero);

export function strikeSpellMark(room,player,target,power){
  if(!canDraftMark(player) || !player.stars?.includes('intellect.NX1'))return;
  const casting=player.casting??={marks:new Map(),readyAt:-Infinity};
  casting.readyAt=applySpellMark(casting.marks,target,power,room.seconds*1000,casting.readyAt,false,STAR_OUTER_TUNING,host,(other,damage)=>{
    troopHit(room,other,player,damage);
    const effects=room.troopEffects??=[];
    if(effects.length<48) effects.push({kind:'spell-chain',fromX:target.x,fromY:target.y,x:other.x,y:other.y,radius:0,until:room.seconds+.35});
  });
}
export function visibleSpellMarks(room){
  const ids=new Set();
  for(const player of room.players.values()){
    if(!player.casting)continue;
    expireMarks(player.casting.marks,room.seconds*1000,host);
    for(const enemy of player.casting.marks.keys())ids.add(enemy.id);
  }
  return ids.size?[...ids]:undefined;
}
