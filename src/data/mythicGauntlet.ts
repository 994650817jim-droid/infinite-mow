import type { GauntletBoss } from './gauntlet';

export type MythicTier = 'ghost' | 'divine';
export type GauntletRunTier = 'mortal' | MythicTier | 'endless';
export type ChallengeChoice = MythicTier | 'endless';
export type MythicVisual = 'blade' | 'dragon' | 'cross' | 'seal';
export type MythicShape = 'line' | 'sweep' | 'ring' | 'circle';
export type Point = { x: number; y: number };

type Strike = {
  kind: MythicShape;
  name: string;
  radius: number;
  power: number;
  windup: number;
  innerRadius?: number;
  lanes?: number;
  spread?: number;
  halfWidth?: number;
  visual?: MythicVisual;
  angleOffset?: number;
  side?: number;
};

export type BladeScar = Point & {
  kind: 'line' | 'sweep'; radius: number; angle: number; halfWidth?: number;
  createdAt: number; lightsAt: number;
};

export interface MythicWarning extends Point {
  constellation?: StarField;
  closing?: boolean;
  transit?: { start: number; to: Point; cast: number; harmless: boolean };
  scar?: BladeScar;
  retracesScar?: boolean;
  kind: MythicShape;
  name: string;
  radius: number;
  angle: number;
  face: number;
  power: number;
  startsAt: number;
  endsAt: number;
  resolved: boolean;
  innerRadius?: number;
  lanes?: number;
  spread?: number;
  halfWidth?: number;
  mythic: MythicTier;
  visual?: MythicVisual;
  action?: 'attack' | 'cast';
}

const line = (name: string, radius: number, halfWidth: number, lanes = 1, spread = 0, side = 0, angleOffset = 0): Strike =>
  ({kind:'line', name, radius, halfWidth, lanes, spread, side, angleOffset, power:.88, windup:.93});
const sweep = (name: string, radius: number, angleOffset = 0): Strike =>
  ({kind:'sweep', name, radius, angleOffset, power:1, windup:.85});
const ring = (name: string, radius: number, innerRadius: number): Strike =>
  ({kind:'ring', name, radius, innerRadius, power:.82, windup:1});
const spot = (name: string, radius: number, side = 0): Strike =>
  ({kind:'circle', name, radius, side, power:.83, windup:1});

interface MythicBoss extends GauntletBoss {
  tierName: MythicTier;
  art: 'animated' | 'actions' | 'pose';
  ink: number;
  title: string;
  moves: readonly [readonly Strike[], readonly Strike[]];
  phaseMove: Strike;
}

function boss(tierName: MythicTier, id: string, name: string, title: string, ink: number,
  first: readonly Strike[], second: readonly Strike[], phaseMove: Strike, art: MythicBoss['art']='actions'): MythicBoss {
  return { id: tierName+'_'+id, name, title, ink, tierName, art, moves:[first,second], phaseMove,
    chapter:2, arc:'hulao', stage:3, ctrl:'moveset', tier:'late', clearKey:'' };
}
const ghost = (...args: Parameters<typeof boss> extends [unknown, ...infer Rest] ? Rest : never) => boss('ghost', ...args);
const divine = (...args: Parameters<typeof boss> extends [unknown, ...infer Rest] ? Rest : never) => boss('divine', ...args);

export const GHOST_GENERALS: readonly MythicBoss[] = [
  ghost('huaxiong','鬼华雄','断首先锋',0x73ceb9,[sweep('断首横刀',145),sweep('残痕回斩',146,-.35)],[line('幽焰裂地',220,24)],ring('震落碎甲',155,94)),
  ghost('zhangxiu','鬼张绣','百枪怨影',0xbb98ef,[line('百枪·真身',248,18),line('怨影重刺',248,18,1,0,68)],[line('岔影封步',218,15,3,.36)],line('怨影返刺',244,17,1,0,-66)),
  ghost('yanliang','鬼颜良','断阵凶锋',0xffab65,[line('断阵重刃',300,34)],[sweep('正面压阵',162)],sweep('回身崩甲',160,Math.PI)),
  ghost('wenchou','鬼文丑','索魂奔袭',0x9ac87a,[line('索魂锁道',265,17,1,0,-62),line('链尾折袭',265,21,1,0,49,-.48)],[ring('锁阵收紧',176,122),ring('锁阵压入',117,66)],line('断链穿刺',248,25)),
  ghost('guanyu','鬼关羽','麦城怨刃',0x50deca,[
    {...sweep('麦城拖刀',224),visual:'blade'}, {...line('残刃交错',250,23,2,.72),visual:'blade'},
  ],[{...line('鬼龙循痕',290,26),visual:'dragon'}],{...line('龙魂追斩',280,20,1,0,-65),visual:'dragon'},'animated'),
  ghost('huangzhong','鬼黄忠','落日冥弓',0x83dbd7,[line('落日冥矢',320,12,4,.26),line('冥箭回阵',320,12,3,.34,0,.18)],[spot('钉魂箭阵',68),spot('箭阵余响',62,-78)],line('穿隙鬼矢',330,16,2,.28)),
  ghost('dianwei','鬼典韦','死守孤门',0xea8496,[sweep('双戟封门',124),sweep('反手断戟',126,.55)],[ring('孤门震地',185,96)],sweep('死守重劈',159)),
  ghost('zhouyu','鬼周瑜','烬海余恨',0xf99f67,[line('逆风火带',295,21,1,0,-75),line('顺风火带',295,21,1,0,75)],[spot('余烬爆散',86)],line('风火合流',285,25)),
  ghost('zhangjiao','鬼张角','黄天残梦',0xd5a0ff,[spot('残符引雷',62,-78),spot('残符二雷',62,78)],[line('黄天雷网',265,14,4,.35)],spot('雷网收束',76)),
  ghost('lubu','鬼吕布','修罗无双',0xf48384,[sweep('修罗戟斩',169),line('方天锁路',305,29)],[line('残影夺阵',275,24,2,.66),sweep('无双回环',142,-.62)],ring('修罗震地',172,83)),
];

export const DIVINE_GENERALS: readonly MythicBoss[] = [
  divine('zhaoyun','神赵云','游龙镇阵',0xa3e6fa,[line('游龙穿阵',325,19,2,.36),line('龙胆贯军',340,24)],[sweep('银枪回锋',146)],line('白龙追芒',338,20,2,.54)),
  divine('huangzhong','神黄忠','百步天弓',0xffdb7f,[line('天弓贯矢',350,15)],[line('雁列箭雨',304,12,5,.24),line('回弦封隙',312,15,2,.24)],spot('落日照军',77)),
  divine('zhangfei','神张飞','长坂天威',0xd4c4f5,[ring('长坂喝阵',142,67),ring('天威外震',225,165)],[sweep('蛇矛横江',168)],line('一夫当关',248,35)),
  divine('sunshangxiang','神孙尚香','烈弓破晓',0xf2a5a5,[line('双翼侧射',286,15,1,0,66),line('飞羽返射',286,15,1,0,-66)],[spot('破晓爆矢',74)],line('赤羽流星',315,14,3,.22)),
  divine('zhouyu','神周瑜','赤壁天火',0xffaf69,[line('东风起旗',325,23,2,.76),line('东风扫浦',305,21,1,0,68)],[spot('赤壁落火',68,-61),spot('天火渡江',68,65)],line('江火合阵',305,27)),
  divine('guanyu','神关羽','武圣裁阵',0xb3edd0,[sweep('武圣裁锋',234),line('十字裁阵',218,23,2,Math.PI/2)],[ring('龙甲镇地',165,97)],sweep('回锋封阵',164,-.66)),
  divine('caocao','神曹操','魏武军势',0xffcc77,[line('虎豹分道',320,21,1,0,-65),line('军势并进',320,21,1,0,65)],[sweep('魏武盾势',132),line('魏武弓势',305,13,4,.24)],ring('军令肃阵',187,119)),
  divine('sunquan','神孙权','江东镇海',0x7ddbeb,[line('江东盾墙',222,34,1,0,-72),line('吴弓乘隙',298,16,1,0,68)],[ring('镇海潮阵',188,122)],sweep('虎踞回潮',157)),
  divine('zhugeliang','神诸葛亮','七星天枢',0xd4c1fa,[spot('天枢落星',54,-90),spot('玉衡落星',54,90)],[line('七星连芒',305,13,5,.31)],spot('归星阵眼',74)),
  divine('liubei','神刘备','昭烈归心',0xffda85,[
    {...line('雌雄交锋',270,21,2,.74),visual:'cross'}, {...sweep('昭烈收剑',154),visual:'cross'},
  ],[{...ring('仁旗肃阵',184,117),visual:'seal'}],{...line('关张英魂',290,22,2,.52),visual:'cross'},'animated'),
];

const all = [...GHOST_GENERALS, ...DIVINE_GENERALS];
export function mythicBoss(id: string): MythicBoss | undefined { return all.find(b => b.id === id); }
export const tierTitle: Record<GauntletRunTier,string> = {mortal:'凡将十阵',ghost:'幽冥鬼将',divine:'天界神将',endless:'无尽'};

/** A roster is drawn once per battle. Legacy 30-wave runs retain catalog order. */
export function mythicRoster(extreme = false, random = Math.random) {
  function tier(pool: readonly MythicBoss[], gateId: string) {
    if (extreme) return pool.slice();
    const options = pool.filter(b => b.id !== gateId);
    for (let i=0; i<4; i++) {
      const j=i+Math.floor(random()*(options.length-i));
      [options[i],options[j]]=[options[j],options[i]];
    }
    return [...options.slice(0,4),pool.find(b=>b.id===gateId)!];
  }
  return {ghost:tier(GHOST_GENERALS,'ghost_lubu'), divine:tier(DIVINE_GENERALS,'divine_liubei')};
}

export function challengeChoices(tier: GauntletRunTier, wave: number, size: number, mythicSize = size): ChallengeChoice[] {
  if (tier === 'endless' || wave !== (tier === 'mortal' ? size : tier === 'ghost' ? size + mythicSize : size + mythicSize * 2)) return [];
  if (tier === 'mortal') return ['ghost','endless'];
  if (tier === 'ghost') return ['divine','endless'];
  return ['endless'];
}

export function challengeBoss(tier: GauntletRunTier, wave: number, size: number, roster?: ReturnType<typeof mythicRoster>): MythicBoss | undefined {
  if (tier === 'ghost') return (roster?.ghost ?? GHOST_GENERALS)[wave-size-1];
  if (tier === 'divine') return (roster?.divine ?? DIVINE_GENERALS)[wave-size-(roster?.ghost.length ?? size)-1];
  return undefined;
}

export function challengeWave(tier: GauntletRunTier, wave: number, size: number, mythicSize = size): number {
  return wave - (tier === 'ghost' ? size : tier === 'divine' ? size+mythicSize : 0);
}

/** Lock both origin and aim for the complete sequence. Each strike has its own warning. */
export interface StarField {
  id: number; center: Point; eye: Point; rotation: number; radius:number;
  opens: number; closes: number; hp: number; broken: boolean;
}
export function starEyeOpen(field: StarField, now: number) {
  return !field.broken && field.hp>0 && now>=field.opens && now<field.closes;
}
export function hitStarEye(field: StarField, now: number) {
  if (!starEyeOpen(field,now)) return false;
  field.hp--;
  field.broken = field.hp === 0;
  return true;
}

function sevenStars(origin: Point,target: Point,cast:number,phase2:boolean,now:number,clear:CanTravel): MythicWarning[] {
  const facing=Math.atan2(target.y-origin.y,target.x-origin.x);
  const center={x:target.x,y:target.y};
  let r=56, angle=facing+Math.PI*.5;
  const position=(a:number,dist:number)=>({x:center.x+Math.cos(a)*dist,y:center.y+Math.sin(a)*dist});
  let placed=false;
  for (const radius of [56,40,24]) {
    for(let i=0;i<7;i++){
      const a=angle+i*2*Math.PI/7;
      if(clear(center,position(a,radius)) && clear(center,position(a+Math.PI,100))){
        r=radius;angle=a;placed=true;break;
      }
    }
    if(placed)break;
  }
  const eye=position(angle,r);
  const field:StarField={id:cast,center,eye,rotation:angle,radius:r,opens:now+1,closes:now+2.96,hp:phase2&&placed?2:0,broken:false};
  const line=(tilt:number,start:number,name:string):MythicWarning=>({kind:'line',name,x:eye.x,y:eye.y,angle:angle+Math.PI+tilt,face:facing,radius:144,halfWidth:13,
    startsAt:start,endsAt:start+1.1,power:.83,resolved:false,mythic:'divine',visual:'seal',action:'cast',constellation:field});
  const warnings=[line(-.41,now,'七星显阵 · 天枢'),line(.41,now+1.5,'玉衡引线')];
  if(phase2 && placed) warnings.push({kind:'ring',name:'七星合阵',x:center.x,y:center.y,radius:105,innerRadius:46,angle,face:facing,
    startsAt:now+3.02,endsAt:now+4.15,power:.84,resolved:false,mythic:'divine',visual:'seal',action:'cast',constellation:field,closing:true});
  return warnings;
}

type CanTravel = (from: Point, to: Point) => boolean;

function spearRoute(origin: Point, target: Point, cast: number, phase2: boolean, now: number, clear: CanTravel): MythicWarning[] {
  const face = Math.atan2(target.y-origin.y,target.x-origin.x);
  const dx = Math.cos(face), dy = Math.sin(face);
  const length = Math.min(300, Math.hypot(target.x-origin.x,target.y-origin.y) + 65);
  const point = (along: number, side = 0): Point => ({x:origin.x+dx*along-dy*side,y:origin.y+dy*along+dx*side});
  let reach = length;
  while (reach > 0 && !clear(origin,point(reach))) reach = Math.max(0,reach-16);
  const end = point(reach);
  const route: MythicWarning[] = [];
  function leg(from: Point, to: Point, name: string, windup: number, harmless: boolean) {
    const angle = Math.atan2(to.y-from.y,to.x-from.x), startsAt = route.length ? route[route.length-1].endsAt+.36 : now;
    route.push({kind:'line', name, x:from.x,y:from.y,angle,face:angle, radius:Math.hypot(to.x-from.x,to.y-from.y),
      halfWidth:20,lanes:1, power:harmless?0:.88, startsAt,endsAt:startsAt+windup+.22, mythic:'divine',
      visual:'dragon',action:'attack',resolved:false,transit:{start:startsAt+windup,to,cast:cast+1,harmless}});
  }
  leg(origin,end,'七进七出 · 穿阵',.95,reach<30);
  const bent = phase2 && (cast+1)%3===0 && reach>80;
  if (bent) {
    for (const side of [62,-62]) {
      const mark=point(reach*.52,side), exit=point(reach*.52,-side);
      if (clear(end,mark) && clear(mark,origin) && clear(point(reach*.52),exit)) {
        leg(end,mark,'龙胆印 · 折锋',1.12,false);
        leg(mark,origin,'七进七出 · 归枪',1.12,false);
        return route;
      }
    }
  }
  leg(end,origin,'收枪归位',.45,true);
  return route;
}

export function mythicTransit(w: MythicWarning, now: number): Point | undefined {
  const m = w.transit;
  if (!m || now < m.start) return;
  const t = Math.min(1,(now-m.start)/(w.endsAt-m.start));
  return {x:w.x+(m.to.x-w.x)*t, y:w.y+(m.to.y-w.y)*t};
}

export function mythicSequence(boss: MythicBoss, origin: Point, target: Point, cast: number, phase2: boolean, now: number, clear: CanTravel = () => true) {
  if (boss.id === 'divine_zhugeliang') return sevenStars(origin,target,cast,phase2,now,clear);
  if (boss.id === 'divine_zhaoyun') return spearRoute(origin,target,cast,phase2,now,clear);
  const face = Math.atan2(target.y-origin.y,target.x-origin.x);
  const moves = boss.moves[cast%2];
  const sequence = phase2 ? [...moves,boss.phaseMove] : moves;
  let startsAt = now;
  const primaryUsesWeapon=boss.moves[0].some(move=>move.kind==='line'||move.kind==='sweep');
  const warnings = sequence.map((strike,index): MythicWarning => {
    const isWeapon=index<moves.length&&primaryUsesWeapon===(cast%boss.moves.length===0);
    const base = strike.kind === 'circle' ? target : origin;
    const offset = strike.side ?? 0;
    const endsAt = startsAt + strike.windup;
    const warning: MythicWarning = { ...strike, x:base.x-Math.sin(face)*offset, y:base.y+Math.cos(face)*offset,
      angle:face+(strike.angleOffset??0), face, startsAt, endsAt, resolved:false, mythic:boss.tierName, action:isWeapon?'attack':'cast' };
    startsAt = endsAt + .36;
    return warning;
  });
  if (phase2 && boss.id === 'ghost_guanyu') {
    // The first swing cuts the trail. Later movement of the caster or target cannot bend it.
    const first = warnings[0], back = warnings[warnings.length - 1];
    const kind = first.kind;
    if (kind === 'line' || kind === 'sweep') {
      const scar: BladeScar = { kind, x:first.x, y:first.y, angle:first.angle,
        radius:first.radius, halfWidth:first.halfWidth, createdAt:first.endsAt,
        lightsAt:back.startsAt + .45 };
      for (const w of warnings) w.scar = scar;
      Object.assign(back, { kind, x:scar.x, y:scar.y, angle:scar.angle, face:scar.angle,
        radius:scar.radius, halfWidth:scar.halfWidth, lanes:1, spread:0, retracesScar:true,
        visual:kind === 'sweep' ? 'blade' : 'dragon', endsAt:scar.lightsAt + 1.15 });
    }
  }
  return warnings;
}

export function mythicHit(w: MythicWarning, p: Point): boolean {
  if (w.transit?.harmless || (w.closing && w.constellation?.broken)) return false;
  const x=p.x-w.x, y=p.y-w.y, distance=Math.hypot(x,y);
  if(w.kind==='circle'||w.kind==='ring') return distance<=w.radius&&distance>=(w.innerRadius??0);
  if(w.kind==='sweep') return distance<=w.radius&&Math.abs(Math.atan2(y*Math.cos(w.angle)-x*Math.sin(w.angle),x*Math.cos(w.angle)+y*Math.sin(w.angle)))<=Math.PI/3;
  for(let i=0,n=w.lanes??1;i<n;i++){
    const a=w.angle+(i-(n-1)/2)*(w.spread??0);
    const forward=x*Math.cos(a)+y*Math.sin(a);
    if(forward>=0&&forward<=w.radius&&Math.abs(y*Math.cos(a)-x*Math.sin(a))<=(w.halfWidth??25))return true;
  }
  return false;
}

export const mythicArtKey = (id: string, action='walk') => 'mythic_'+id+'_'+action;
export const mythicArtUrl = (id: string, action='walk') => 'assets/mythic-gauntlet/'+id+'-'+action+'.png';
