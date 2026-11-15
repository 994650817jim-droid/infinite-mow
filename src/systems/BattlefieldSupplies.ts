import {mayMirrorProp} from '../data/sceneArt';
import Phaser from 'phaser';
import {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import {ENEMY_DEFS} from '../data/enemies';
import {DEPTH,actorDepth} from '../config';
import type {BattlefieldProp} from './BattlefieldDetails';
import type {Ally} from '../entities/Ally';
export const MAX_PROP_SLOTS=40;

const CELL=640,MAX_CRATES=3,HEAL_TOTAL=10,HEAL_RATE=2;
// These loose materials and braziers already read cleanly against the ground;
// keep the original art unobstructed instead of adding a contact-shadow overlay.
const NO_PROP_SHADOW=new Set([16,27,28,29,30,31,35]);
interface Crate {enemy:Enemy;shadow:Phaser.GameObjects.Image;cell:string|null;life:number;frame:number;halfW:number;halfH:number;offsetX:number;offsetY?:number;spiked?:boolean;/** 回血道具：酒罐 / 药篓，打碎掉落对应补给。 */heal?:HealProp;}
export type HealProp='wine'|'herb';
/** 回血道具（heal_props 图集帧：0 酒罐 / 1 药篓 / 2 酒葫芦 / 3 草药包）；回复量按最大生命比例，2.5 秒内回完。 */
export const HEAL_PROPS:Record<HealProp,{name:string;frame:number;drop:number;ratio:number;size:number}>={wine:{name:'酒罐',frame:0,drop:2,ratio:.08,size:70},herb:{name:'药篓',frame:1,drop:3,ratio:.12,size:66}};
interface Potion {image:Phaser.GameObjects.Image;until:number;active:boolean;amount?:number;}
/** 药囊里的一份药：回复量（未设则为原药瓶的固定 10 点）与图标。 */
export interface PouchItem {amount?:number;texture:string;frame?:number;name:string;}
export const POUCH_MAX=3;
interface BrazierFire {x:number;y:number;started:number;nextHit:number;active:boolean;tripod?:boolean;}
/** Rare, deterministic breakables share weapon hit detection, but not enemy slots/rewards. */
export class BattlefieldSupplies {
 randomGeneration=true;
 /** 关闭随机物件的关卡（第三/四章、攻城）仍会稀疏生成酒罐/药篓。 */
 healGeneration=true;
 /** 场景障碍（房屋、城墙等）；回血道具不放进去。 */
 healBlocked?:(x:number,y:number,r:number)=>boolean;
 private healRate=HEAL_RATE;
 /** 药囊：拾取的药先收起，玩家按“用药”按钮（或 Q 键）才回血。 */
 readonly pouch:PouchItem[]=[];
 readonly crates:Crate[]=[];
 readonly potions:Potion[]=[];
 private readonly breakFx:Array<{image:Phaser.GameObjects.Image;start:number;row:number;active:boolean}>=[];
 private readonly broken=new Set<string>();
 private readonly spikeContacts=new Map<string,WeakMap<object,number>>();
 private readonly remains:Array<{x:number;y:number;size:number;row:number;at:number}>=[];
 private readonly debrisImages:Phaser.GameObjects.Image[]=[];
 private readonly brazierBreak:Phaser.GameObjects.Image[]=[];
 private readonly groundFlame:Phaser.GameObjects.Image[]=[];
 private readonly fires:BrazierFire[]=[];
 private readonly burnCooldown=new Map<number,{spawn:number;until:number}>();
 private nextDebrisCheck=0;
 private playerBurnAt=0;
 private readonly allyBurn=new Map<Ally,{life:number;until:number}>();
 private healRemaining=0;
 private devId=0;
 private pushX=0;private pushY=0;
 private readonly coals:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene,private player:Player,private enemies:Enemy[],private now:()=>number,private onPickup:()=>void){
  this.coals=scene.add.graphics().setDepth(DEPTH.fx);
  if(!scene.textures.exists('healing_potion')){
   const g=scene.make.graphics({x:0,y:0});
   g.fillStyle(0x211c16).fillRect(10,2,12,8).fillRect(7,11,18,23);
   g.fillStyle(0xb8975a).fillRect(11,3,10,4);
   g.fillStyle(0xd4d3b4).fillRect(11,8,10,6).fillRect(8,15,16,16);
   g.fillStyle(0x913f33).fillRect(10,19,12,11).fillStyle(0xd66c4b).fillRect(11,19,3,7);
   g.fillStyle(0xf1dfad).fillRect(14,19,4,9).fillRect(12,22,8,3);
   g.generateTexture('healing_potion',32,38);g.destroy();
   const keys=scene.registry.get('battleTextureKeys') as string[]|undefined;if(keys&&!keys.includes('healing_potion'))keys.push('healing_potion');
  }
  for(let i=0;i<48;i++)this.debrisImages.push(scene.add.image(0,0,'prop_debris',0).setDepth(DEPTH.ground+1.5).setOrigin(.5,2/3).setAlpha(.82).setVisible(false));
  for(let i=0;i<8;i++)this.breakFx.push({image:scene.add.image(0,0,'prop_break_fx',0).setDepth(DEPTH.fx).setVisible(false),start:0,row:0,active:false});
  for(let i=0;i<4;i++){this.brazierBreak.push(scene.add.image(0,0,'brazier_breaking',0).setDepth(DEPTH.fx+1).setVisible(false));this.groundFlame.push(scene.add.image(0,0,'ground_fire',0).setDepth(DEPTH.ground+2).setVisible(false));this.fires.push({x:0,y:0,started:0,nextHit:0,active:false});}
  for(let i=0;i<MAX_CRATES;i++){const enemy=new Enemy(scene);enemy.isSupplySlot=true;enemies.push(enemy);const shadow=scene.add.image(0,0,'yellow_contact_shadow',0).setOrigin(.5,.9375).setVisible(false);this.crates.push({enemy,shadow,cell:null,life:0,frame:18,halfW:26,halfH:12,offsetX:0});}
 }
 private hash(x:number,y:number):number {let h=Math.imul(x,73856093)^Math.imul(y,19349663)^0x65df03;h=Math.imul(h^(h>>>16),0x45d9f3b);return(h^(h>>>16))>>>0;}
 private place(slot:Crate,cell:string,x:number,y:number,frame=18,size=92,flip=false):void {
  flip=flip&&mayMirrorProp(frame);
  slot.spiked=false;slot.offsetY=undefined;slot.heal=undefined;
  slot.enemy.spawn(x,y,{...ENEMY_DEFS.shield,behavior:'supply',texture:'yellow_props',hp:frame===18?24:frame<4?80:frame<10?18:frame<14?45:frame>=24&&frame<=28?50:36,speed:0,damage:0,xp:0,radius:Math.max(14,size*.32)},1,this.now());
  slot.enemy.walkSheet='';slot.enemy.attackSheet='';slot.enemy.sprite.setTexture(frame===35?'brazier_burning':'yellow_props',frame===35?0:frame).setOrigin(.5,.9375).setDisplaySize(size,size).setFlipX(flip);
  slot.enemy.shadow.setVisible(false);
  slot.shadow.setTexture('yellow_contact_shadow',frame===35?30:frame).setPosition(x,y+Math.min(1,size*.008)).setOrigin(.5,.9375).setDisplaySize(size,size).setFlipX(flip).setAlpha(1).setDepth(actorDepth(y)-.01).setVisible(!NO_PROP_SHADOW.has(frame));
  slot.cell=cell;slot.life=slot.enemy.spawnId;slot.frame=frame;slot.halfW=size*(frame<4?.34:frame<10?.12:frame<14?.43:frame>=24&&frame<=28?.37:.28);slot.halfH=size*(frame<4?.17:.12);slot.offsetX=frame>=4&&frame<=9?[-.20,0,-.20,0,-.08,-.12][frame-4]*size*(flip?-1:1):0;
  if(frame>=25&&frame<=28){slot.halfW=size*.39;slot.halfH=size*(frame===27?.18:.25);slot.offsetY=-size*(frame===27?.17:.25);}
 }
 /** 放置回血道具：沿用补给箱的命中与碎裂，贴图换成 heal_props。 */
 private placeHeal(slot:Crate,cell:string,x:number,y:number,kind:HealProp):void {
  const d=HEAL_PROPS[kind];this.place(slot,cell,x,y,18,d.size);slot.heal=kind;
  slot.enemy.sprite.setTexture('heal_props',d.frame).setOrigin(.5,.92).setDisplaySize(d.size,d.size).setDepth(actorDepth(y)).setFlipX(false);
  slot.enemy.hp=slot.enemy.maxHp=kind==='wine'?18:24;slot.shadow.setVisible(false);slot.halfW=d.size*.24;slot.halfH=d.size*.1;
 }
 get healArt():boolean{return this.scene.textures.exists('heal_props');}
 /** 正在按疗程回血（上一份药未回完）。 */
 get healing():boolean{return this.healRemaining>.00001;}
 /** 能否用药：药囊非空、未满血、上一份药已回完、主角存活。 */
 get canUsePotion():boolean{return this.pouch.length>0&&this.player.alive&&this.player.hp<this.player.maxHp-.01&&!this.healing;}
 /** 用掉药囊里最早的一份；按原规则在一段时间内回血（药瓶 10 点 / 每秒 2 点，酒葫芦与草药包 2.5 秒回完）。 */
 usePotion():PouchItem|null{if(!this.canUsePotion)return null;const item=this.pouch.shift()!;this.healRemaining=item.amount??HEAL_TOTAL;this.healRate=item.amount?item.amount/2.5:HEAL_RATE;return item;}
 /** DEV / 测试：在主角附近放一个回血道具。 */
 spawnHealForTest(kind:HealProp,dx=90,dy=0):Enemy|null{if(!this.healArt)return null;const slot=this.freeSlot();if(!slot)return null;this.placeHeal(slot,'dev-heal-'+(this.devId++),this.player.x+dx,this.player.y+dy,kind);return slot.enemy;}
 /** Explicit DEV fixture; ordinary generation remains rare. */
 spawnForTest(frame=18):boolean {const slot=this.freeSlot();if(!slot)return false;const i=this.devId++,angle=i*2.399963;this.place(slot,`dev-${i}`,this.player.x+Math.cos(angle)*110,this.player.y+Math.sin(angle)*90,frame);return true;}
 /** Fixed preview props use existing weapon targeting, wooden break animation and persistent debris. */
 spawnSishui(frame:3|4|5|6|7,x:number,y:number,size:number):boolean {
  const slot=this.freeSlot();if(!slot)return false;
  this.place(slot,`fixed-sishui-${frame}-${x},${y}`,x,y,frame===7?35:frame===3?10:frame===4?14:frame===6?4:19,size);
  slot.enemy.sprite.setTexture('sishui_props_refined',frame).setOrigin(.5,1).setDepth(actorDepth(y));
  slot.spiked=frame===3;
  slot.enemy.def={...slot.enemy.def,radius:size*(frame===3?.4:.3)};
  slot.halfW=size*(frame===6?.09:frame===3?.4:.30);slot.halfH=size*(frame===6?.07:.12);slot.shadow.setVisible(false);
  return true;
 }
 /** Enemy tents share original weapon targeting, footprint, break FX and persistent remains. */
 spawnCamp(x:number,y:number,hp:number):Enemy|null {
  const slot=this.freeSlot();if(!slot)return null;
  this.place(slot,`fixed-camp-${x},${y}`,x,y,2,190);
  slot.enemy.sprite.setTexture('sishui_props_refined',2).setOrigin(.5,1).setDepth(actorDepth(y));
  slot.enemy.hp=slot.enemy.maxHp=hp;slot.enemy.def={...slot.enemy.def,hp,radius:65};
  slot.halfW=58;slot.halfH=22;slot.offsetY=-20;slot.shadow.setVisible(false);
  return slot.enemy;
 }
 /** 第四章袁军粮草（粮仓 frame 1 / 粮垛 frame 16 / 辎重车 frame 24）：与敌营同一套武器命中、碰撞、破坏特效与残骸。 */
 spawnDepot(x:number,y:number,hp:number,frame:1|16|24,size:number):Enemy|null {
  const slot=this.freeSlot();if(!slot)return null;
  this.place(slot,`fixed-depot-${x},${y}`,x,y,frame,size);
  slot.enemy.hp=slot.enemy.maxHp=hp;slot.enemy.def={...slot.enemy.def,hp,radius:size*.34};
  return slot.enemy;
 }
 /** 攻城战大城城门（汜水关城门物件 frame 0）：可被武器攻击的高耐久物件，碰撞框与原城门一致。 */
 spawnGate(x:number,y:number,hp:number,size:number):Enemy|null {
  const slot=this.freeSlot();if(!slot)return null;
  this.place(slot,`fixed-gate-${x},${y}`,x,y,2,size);
  slot.enemy.sprite.setTexture('sishui_props_refined',0).setOrigin(.5,1).setDepth(actorDepth(y));
  slot.enemy.hp=slot.enemy.maxHp=hp;slot.enemy.def={...slot.enemy.def,hp,radius:size*.32};
  slot.halfW=size*.33;slot.halfH=size*.1;slot.offsetY=-size*.06;slot.shadow.setVisible(false);
  return slot.enemy;
 }
 onBroken(enemy:Enemy):void {
  const crate=this.crates.find(c=>c.enemy===enemy&&c.life===enemy.spawnId);if(!crate||!crate.cell||this.broken.has(crate.cell))return;
  this.broken.add(crate.cell);crate.cell=null;crate.shadow.setVisible(false);
  const material=crate.heal==='herb'?0:crate.frame===18?1:crate.frame===29||crate.frame===30||crate.frame===32||crate.frame===33?2:crate.frame<10||crate.frame===34?3:0;
  if(crate.frame===35){const index=this.fires.findIndex(f=>!f.active);if(index>=0){const fire=this.fires[index];fire.x=enemy.x;fire.y=enemy.y;fire.started=this.now();fire.nextHit=this.now()+640;fire.active=true;fire.tripod=enemy.sprite.texture.key.startsWith('sishui_props');
    if(fire.tripod){this.remains.push({x:enemy.x,y:enemy.y,size:enemy.sprite.displayWidth*.8,row:2,at:this.now()+440});this.nextDebrisCheck=0;const fx=this.breakFx.find(f=>!f.active);if(fx){fx.active=true;fx.start=this.now();fx.row=2;fx.image.setTexture('prop_break_fx',12).setPosition(enemy.x,enemy.y).setOrigin(.5,.85).setDisplaySize(85,85).setAlpha(1).setVisible(true);}this.brazierBreak[index].setVisible(false);}
    else this.brazierBreak[index].setTexture('brazier_breaking',0).setPosition(enemy.x,enemy.y).setOrigin(.5,.92).setDisplaySize(92,92).setVisible(true);
  }return;}
  this.remains.push({x:enemy.x,y:enemy.y,size:enemy.sprite.displayWidth*.85,row:material,at:this.now()+440});this.nextDebrisCheck=0;
  const fx=this.breakFx.find(f=>!f.active);if(fx){fx.active=true;fx.start=this.now();fx.row=material;fx.image.setTexture('prop_break_fx',fx.row*6).setPosition(enemy.x,enemy.y).setOrigin(.5,.85).setDisplaySize(enemy.sprite.displayWidth*1.15,enemy.sprite.displayWidth*1.15).setAlpha(1).setVisible(true);}
  if(crate.frame!==18)return;
  const heal=crate.heal?HEAL_PROPS[crate.heal]:undefined;crate.heal=undefined;
  let potion=this.potions.find(p=>!p.active);
  if(!potion){if(this.potions.length>=12)return;potion={image:this.scene.add.image(0,0,'healing_potion').setDepth(DEPTH.gem+1),until:0,active:false};this.potions.push(potion);}
  potion.active=true;potion.until=this.now()+60000;
  if(heal){potion.amount=this.player.maxHp*heal.ratio;potion.image.setTexture('heal_props',heal.drop).setPosition(enemy.x,enemy.y+6).setDisplaySize(34,34).setAlpha(1).setVisible(true);}
  else{potion.amount=undefined;potion.image.setTexture('healing_potion').setPosition(enemy.x,enemy.y+10).setDisplaySize(24,29).setAlpha(1).setVisible(true);}
 }
 update(dt:number,now:number,placements:readonly BattlefieldProp[]=[],burn:(enemy:Enemy,damage:number)=>void=()=>{},allies:readonly Ally[]=[],hurtAlly:(ally:Ally,damage:number,now:number)=>void=()=>{}):void {
  this.updateDebris(now);
  this.coals.clear();
  for(const c of this.crates)if(c.enemy.active&&c.frame===35&&c.enemy.sprite.texture.key==='sishui_props'){
   const x=c.enemy.x,y=c.enemy.y-c.enemy.sprite.displayHeight*.68;
   for(let i=-1;i<=1;i++){const h=7+Math.floor((Math.sin(now/130+i*2)+1)*3);this.coals.fillStyle(i===0?0xffc66c:0xd76b2c,.8).fillTriangle(x+i*4-3,y,x+i*4+3,y,x+i*4,y-h);}
  }
  for(const c of this.crates){if(!c.enemy.active)c.shadow.setVisible(false);else if(c.frame===35&&c.enemy.sprite.texture.key==='brazier_burning')c.enemy.sprite.setFrame(Math.floor(now/110)%8);}
  for(let i=0;i<this.fires.length;i++){const f=this.fires[i];if(!f.active)continue;const age=now-f.started;if(age<640){this.brazierBreak[i].setFrame(Math.min(7,Math.floor(age/80)));continue;}this.brazierBreak[i].setVisible(false);if(age>=5640){f.active=false;this.groundFlame[i].setVisible(false);continue;}const frame=Math.floor((age-640)/110)%8,img=this.groundFlame[i];img.setFrame(frame).setPosition(f.x,f.y+2).setOrigin(.5,.82).setDisplaySize(94,48).setVisible(true);
   if(now>=f.nextHit){f.nextHit=now+500;for(const enemy of this.enemies){if(!enemy.active||enemy.isSupplySlot||enemy.kind==='boss'||Math.hypot(enemy.x-f.x,enemy.y-(f.y-7))>34+enemy.radius)continue;const last=this.burnCooldown.get(enemy.uid);if(last&&last.spawn===enemy.spawnId&&now<last.until)continue;this.burnCooldown.set(enemy.uid,{spawn:enemy.spawnId,until:now+500});burn(enemy,Math.max(2,enemy.maxHp*.035));}
    if(this.player.alive&&now>=this.playerBurnAt&&Math.hypot(this.player.x-f.x,this.player.y-(f.y-7))<=34+this.player.radius){this.playerBurnAt=now+500;this.player.takeDamage(Math.max(2,this.player.maxHp*.035),now);}
    for(const ally of allies){if(!ally.active||Math.hypot(ally.x-f.x,ally.y-(f.y-7))>34+ally.radius)continue;const last=this.allyBurn.get(ally);if(last&&last.life===ally.lifeId&&now<last.until)continue;this.allyBurn.set(ally,{life:ally.lifeId,until:now+500});hurtAlly(ally,Math.max(2,ally.maxHp*.035),now);}
   }
  }
  for(const f of this.breakFx)if(f.active){const age=Math.max(0,now-f.start);if(age>=560){f.active=false;f.image.setVisible(false);}else f.image.setFrame(f.row*6+Math.min(5,Math.floor(age/80))).setAlpha(Math.min(1,(560-age)/120));}
  const desired=new Set(placements.map(p=>p.key));
  for(const c of this.crates)if(c.enemy.active&&c.cell?.startsWith('prop-')&&!desired.has(c.cell)){c.enemy.deactivate();c.shadow.setVisible(false);c.cell=null;}
  for(const p of placements){if(this.broken.has(p.key)||this.crates.some(c=>c.enemy.active&&c.cell===p.key)||!this.placementClear(p.x,p.y,p.size))continue;const slot=this.freeSlot();if(!slot)break;this.place(slot,p.key,p.x,p.y,p.texture?p.frame===4?4:p.frame===5?10:14:p.frame,p.size,p.flip);
   if(p.texture){slot.spiked=p.frame===5;slot.enemy.sprite.setTexture(p.texture,String(p.frame)).setOrigin(.5,.92).setPosition(p.x,p.y+p.size*.17).setDepth(actorDepth(p.y+p.size*.17)).clearTint();slot.shadow.setVisible(false);slot.offsetX=p.frame===4?-p.size*.24*(p.flip?-1:1):0;slot.halfW=p.size*(p.frame===4?.08:.39);slot.halfH=p.size*(p.frame===4?.06:.13);}
  }
  if(this.healRemaining>0&&this.player.alive){const n=Math.min(this.healRemaining,this.healRate*dt);this.player.heal(n);this.healRemaining=Math.max(0,this.healRemaining-n);}
  for(const p of this.potions){if(!p.active)continue;if(now>=p.until){p.active=false;p.image.setVisible(false);continue;}
   if(this.player.alive&&this.pouch.length<POUCH_MAX&&Math.hypot(p.image.x-this.player.x,p.image.y-this.player.y)<30){p.active=false;p.image.setVisible(false);const heal=p.image.texture.key==='heal_props';this.pouch.push({amount:p.amount,texture:p.image.texture.key,frame:heal?Number(p.image.frame.name):undefined,name:heal?(Number(p.image.frame.name)===2?'酒葫芦':'草药包'):'疗伤药'});this.onPickup();}
  }
  for(const c of this.crates)if(c.enemy.active&&!c.cell?.startsWith('fixed-')&&Math.hypot(c.enemy.x-this.player.x,c.enemy.y-this.player.y)>1400){c.enemy.deactivate();c.shadow.setVisible(false);c.cell=null;}
  this.generateHealProps();
  if(!this.randomGeneration)return;
  const cx=Math.floor(this.player.x/CELL),cy=Math.floor(this.player.y/CELL);
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
   const h=this.hash(x,y),cell=`${x},${y}`;if(h%12!==3||this.broken.has(cell)||this.crates.some(c=>c.enemy.active&&c.cell===cell))continue;
   const px=x*CELL+120+(h>>>8)%400,py=y*CELL+120+(h>>>16)%400;if(Math.hypot(px-this.player.x,py-this.player.y)>1250||!this.placementClear(px,py,92))continue;
   if(this.crates.filter(c=>c.enemy.active&&c.cell&&!c.cell.startsWith('prop-')).length>=MAX_CRATES)return;const slot=this.freeSlot();if(!slot)return;this.place(slot,cell,px,py);
  }
 }
 private updateDebris(now:number):void {
  if(now<this.nextDebrisCheck)return;this.nextDebrisCheck=now+200;for(const r of this.remains)if(r.at>now&&r.at<this.nextDebrisCheck)this.nextDebrisCheck=r.at;
  const x=this.player.x,y=this.player.y;
  const nearby=this.remains.filter(r=>r.at<=now&&Math.abs(r.x-x)<1000&&Math.abs(r.y-y)<1000).sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2));
  for(let i=0;i<this.debrisImages.length;i++){const image=this.debrisImages[i],r=nearby[i];if(!r){image.setVisible(false);continue;}image.setFrame(r.row).setPosition(r.x,r.y).setDisplaySize(r.size,r.size).setVisible(true);}
 }
 /** Reserve visible silhouettes as well as footprints; keep small walking gaps. */
 /** 酒罐 / 药篓：按格子哈希稀疏、确定地生成（打碎后该格不再生成），避开障碍与其他物件。 */
 private generateHealProps():void {
  if(!this.healGeneration||!this.healArt)return;
  const cx=Math.floor(this.player.x/CELL),cy=Math.floor(this.player.y/CELL),every=this.randomGeneration?12:9;
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
   const h=this.hash(x+9173,y-4421),cell='heal-'+x+','+y;if(h%every!==5||this.broken.has(cell)||this.crates.some(c=>c.enemy.active&&c.cell===cell))continue;
   const px=x*CELL+120+(h>>>8)%400,py=y*CELL+120+(h>>>16)%400,kind:HealProp=(h>>>4)%5<3?'wine':'herb';
   if(Math.hypot(px-this.player.x,py-this.player.y)>1250||Math.hypot(px-this.player.x,py-this.player.y)<160||!this.placementClear(px,py,80)||this.healBlocked?.(px,py,48))continue;
   if(this.crates.filter(c=>c.enemy.active&&c.heal).length>=4)return;const slot=this.freeSlot();if(!slot)return;this.placeHeal(slot,cell,px,py,kind);
  }
 }
 private placementClear(x:number,y:number,size:number):boolean {
  return !this.crates.some(c=>c.enemy.active&&Math.abs(c.enemy.x-x)<(c.enemy.sprite.displayWidth+size)*.43+16&&Math.abs(c.enemy.y-y)<(c.enemy.sprite.displayHeight+size)*.32+12);
 }
 private freeSlot():Crate|undefined {
  const old=this.crates.find(c=>!c.enemy.active);if(old)return old;if(this.crates.length>=MAX_PROP_SLOTS)return;
  const enemy=new Enemy(this.scene);enemy.isSupplySlot=true;this.enemies.push(enemy);const shadow=this.scene.add.image(0,0,'yellow_contact_shadow',0).setOrigin(.5,.9375).setVisible(false);const slot={enemy,shadow,cell:null,life:0,frame:18,halfW:26,halfH:12,offsetX:0};this.crates.push(slot);return slot;
 }
 /** Ground footprints only. Reuse correction scalars; no per-body callbacks or allocations. */
 private blocked(x:number,y:number,r:number,crate:Crate):boolean {
  const cx=crate.enemy.x+crate.offsetX,cy=crate.enemy.y+(crate.offsetY??-crate.halfH*.5),hw=crate.halfW,hh=crate.halfH;
  if(Math.abs(x-cx)>hw+r||Math.abs(y-cy)>hh+r)return false;
  const qx=Phaser.Math.Clamp(x,cx-hw,cx+hw),qy=Phaser.Math.Clamp(y,cy-hh,cy+hh),dx=x-qx,dy=y-qy,d=Math.hypot(dx,dy);
  if(d>=r)return false;if(d>.0001){this.pushX=dx/d*(r-d);this.pushY=dy/d*(r-d);return true;}
  const left=x-cx+hw,right=cx+hw-x,top=y-cy+hh,bottom=cy+hh-y,min=Math.min(left,right,top,bottom);
  this.pushX=min===left?-(left+r):min===right?right+r:0;this.pushY=min===top?-(top+r):min===bottom?bottom+r:0;return true;
 }
 private spike(crate:Crate,unit:object,life:number,hurt:()=>boolean):void {
  if(!crate.spiked||!crate.cell)return;
  let contacts=this.spikeContacts.get(crate.cell);if(!contacts){contacts=new WeakMap();this.spikeContacts.set(crate.cell,contacts);}
  if(contacts.get(unit)===life)return;
  if(hurt())contacts.set(unit,life);
 }
 appendNavigationBoxes(out:Array<{left:number;right:number;top:number;bottom:number}>):void{for(const c of this.crates)if(c.enemy.active){const x=c.enemy.x+c.offsetX,y=c.enemy.y+(c.offsetY??-c.halfH*.5);out.push({left:x-c.halfW,right:x+c.halfW,top:y-c.halfH,bottom:y+c.halfH});}}
 resolveBodies(allies:readonly Ally[],hurtAlly:(ally:Ally,damage:number,now:number)=>boolean=()=>false,hurtEnemy:(enemy:Enemy,damage:number,now:number)=>boolean=()=>false):void {
  for(const c of this.crates){if(!c.enemy.active)continue;
   if(this.blocked(this.player.x,this.player.y,this.player.radius,c)){this.spike(c,this.player,1,()=>this.player.takeDamage(8,this.now()));this.player.sprite.x+=this.pushX;this.player.sprite.y+=this.pushY;}
   for(const a of allies)if(a.active&&this.blocked(a.x,a.y,a.radius,c)){this.spike(c,a,a.lifeId,()=>hurtAlly(a,8,this.now()));a.push(this.pushX,this.pushY);}
   for(const e of this.enemies)if(e.active&&!e.isSupplySlot&&!e.invulnerable&&!e.controlImmune&&this.blocked(e.x,e.y,e.radius,c)){this.spike(c,e,e.spawnId,()=>hurtEnemy(e,8,this.now()));e.sprite.x+=this.pushX;e.sprite.y+=this.pushY;}
  }
 }
 clear():void {this.spikeContacts.clear();this.coals.clear();for(const image of this.debrisImages)image.setVisible(false);this.remains.length=0;for(const f of this.breakFx){f.active=false;f.image.setVisible(false);}for(const image of this.brazierBreak)image.setVisible(false);for(const image of this.groundFlame)image.setVisible(false);this.fires.length=0;this.burnCooldown.clear();this.allyBurn.clear();this.playerBurnAt=0;for(const c of this.crates){c.enemy.deactivate();c.shadow.setVisible(false);}for(const p of this.potions){p.active=false;p.image.setVisible(false);}this.healRemaining=0;}
}
