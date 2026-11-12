import Phaser from 'phaser';
import {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import {ENEMY_DEFS} from '../data/enemies';
import {DEPTH} from '../config';
import type {BattlefieldProp} from './BattlefieldDetails';
import type {Ally} from '../entities/Ally';
export const MAX_PROP_SLOTS=40;

const CELL=640,MAX_CRATES=3,HEAL_TOTAL=10,HEAL_RATE=2;
interface Crate {enemy:Enemy;cell:string|null;life:number;frame:number;halfW:number;halfH:number;offsetX:number;}
interface Potion {image:Phaser.GameObjects.Image;until:number;active:boolean;}
/** Rare, deterministic breakables share weapon hit detection, but not enemy slots/rewards. */
export class BattlefieldSupplies {
 readonly crates:Crate[]=[];
 readonly potions:Potion[]=[];
 private readonly breakFx:Array<{image:Phaser.GameObjects.Image;start:number;row:number;active:boolean}>=[];
 private readonly broken=new Set<string>();
 private readonly remains:Array<{x:number;y:number;size:number;row:number;at:number}>=[];
 private readonly debrisImages:Phaser.GameObjects.Image[]=[];
 private nextDebrisCheck=0;
 private healRemaining=0;
 private devId=0;
 private pushX=0;private pushY=0;
 constructor(private scene:Phaser.Scene,private player:Player,private enemies:Enemy[],private now:()=>number,private onPickup:()=>void){
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
  for(let i=0;i<MAX_CRATES;i++){const enemy=new Enemy(scene);enemy.isSupplySlot=true;enemies.push(enemy);this.crates.push({enemy,cell:null,life:0,frame:18,halfW:26,halfH:12,offsetX:0});}
 }
 private hash(x:number,y:number):number {let h=Math.imul(x,73856093)^Math.imul(y,19349663)^0x65df03;h=Math.imul(h^(h>>>16),0x45d9f3b);return(h^(h>>>16))>>>0;}
 private place(slot:Crate,cell:string,x:number,y:number,frame=18,size=92,flip=false):void {
  slot.enemy.spawn(x,y,{...ENEMY_DEFS.shield,behavior:'supply',texture:'yellow_props',hp:frame===18?24:frame<4?80:frame<10?18:frame<14?45:frame>=24&&frame<=28?50:36,speed:0,damage:0,xp:0,radius:Math.max(14,size*.32)},1,this.now());
  slot.enemy.walkSheet='';slot.enemy.attackSheet='';slot.enemy.sprite.setTexture('yellow_props',frame).setOrigin(.5,.95).setDisplaySize(size,size).setFlipX(flip);
  slot.enemy.shadow.setDisplaySize(65,19).setAlpha(.3);slot.cell=cell;slot.life=slot.enemy.spawnId;slot.frame=frame;slot.halfW=size*(frame<4?.34:frame<10?.12:frame<14?.43:frame>=24&&frame<=28?.37:.28);slot.halfH=size*(frame<4?.17:.12);slot.offsetX=frame>=4&&frame<=9?[-.20,0,-.20,0,-.08,-.12][frame-4]*size*(flip?-1:1):0;
 }
 /** Explicit DEV fixture; ordinary generation remains rare. */
 spawnForTest(frame=18):boolean {const slot=this.freeSlot();if(!slot)return false;const i=this.devId++,angle=i*2.399963;this.place(slot,`dev-${i}`,this.player.x+Math.cos(angle)*110,this.player.y+Math.sin(angle)*90,frame);return true;}
 onBroken(enemy:Enemy):void {
  const crate=this.crates.find(c=>c.enemy===enemy&&c.life===enemy.spawnId);if(!crate||!crate.cell||this.broken.has(crate.cell))return;
  this.broken.add(crate.cell);crate.cell=null;
  const material=crate.frame===18?1:crate.frame===29||crate.frame===30||crate.frame===32||crate.frame===33?2:crate.frame<10||crate.frame===34?3:0;
  this.remains.push({x:enemy.x,y:enemy.y,size:enemy.sprite.displayWidth*.85,row:material,at:this.now()+440});this.nextDebrisCheck=0;
  const fx=this.breakFx.find(f=>!f.active);if(fx){fx.active=true;fx.start=this.now();fx.row=material;fx.image.setTexture('prop_break_fx',fx.row*6).setPosition(enemy.x,enemy.y).setOrigin(.5,.85).setDisplaySize(enemy.sprite.displayWidth*1.15,enemy.sprite.displayWidth*1.15).setAlpha(1).setVisible(true);}
  if(crate.frame!==18)return;
  let potion=this.potions.find(p=>!p.active);
  if(!potion){if(this.potions.length>=12)return;potion={image:this.scene.add.image(0,0,'healing_potion').setDepth(DEPTH.gem+1),until:0,active:false};this.potions.push(potion);}
  potion.active=true;potion.until=this.now()+60000;potion.image.setPosition(enemy.x,enemy.y+10).setDisplaySize(24,29).setAlpha(1).setVisible(true);
 }
 update(dt:number,now:number,placements:readonly BattlefieldProp[]=[]):void {
  this.updateDebris(now);
  for(const f of this.breakFx)if(f.active){const age=Math.max(0,now-f.start);if(age>=560){f.active=false;f.image.setVisible(false);}else f.image.setFrame(f.row*6+Math.min(5,Math.floor(age/80))).setAlpha(Math.min(1,(560-age)/120));}
  const desired=new Set(placements.map(p=>p.key));
  for(const c of this.crates)if(c.enemy.active&&c.cell?.startsWith('prop-')&&!desired.has(c.cell)){c.enemy.deactivate();c.cell=null;}
  for(const p of placements){if(this.broken.has(p.key)||this.crates.some(c=>c.enemy.active&&c.cell===p.key))continue;const slot=this.freeSlot();if(!slot)break;this.place(slot,p.key,p.x,p.y,p.frame,p.size,p.flip);}
  if(this.healRemaining>0&&this.player.alive){const n=Math.min(this.healRemaining,HEAL_RATE*dt);this.player.heal(n);this.healRemaining=Math.max(0,this.healRemaining-n);}
  for(const p of this.potions){if(!p.active)continue;if(now>=p.until){p.active=false;p.image.setVisible(false);continue;}
   if(this.player.alive&&this.player.hp<this.player.maxHp-.01&&this.healRemaining<.00001&&Math.hypot(p.image.x-this.player.x,p.image.y-this.player.y)<30){p.active=false;p.image.setVisible(false);this.healRemaining=HEAL_TOTAL;this.onPickup();}
  }
  for(const c of this.crates)if(c.enemy.active&&Math.hypot(c.enemy.x-this.player.x,c.enemy.y-this.player.y)>1400){c.enemy.deactivate();c.cell=null;}
  const cx=Math.floor(this.player.x/CELL),cy=Math.floor(this.player.y/CELL);
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
   const h=this.hash(x,y),cell=`${x},${y}`;if(h%16!==3||this.broken.has(cell)||this.crates.some(c=>c.enemy.active&&c.cell===cell))continue;
   const px=x*CELL+120+(h>>>8)%400,py=y*CELL+120+(h>>>16)%400;if(Math.hypot(px-this.player.x,py-this.player.y)>1250)continue;
   if(this.crates.filter(c=>c.enemy.active&&c.cell&&!c.cell.startsWith('prop-')).length>=MAX_CRATES)return;const slot=this.freeSlot();if(!slot)return;this.place(slot,cell,px,py);
  }
 }
 private updateDebris(now:number):void {
  if(now<this.nextDebrisCheck)return;this.nextDebrisCheck=now+200;for(const r of this.remains)if(r.at>now&&r.at<this.nextDebrisCheck)this.nextDebrisCheck=r.at;
  const x=this.player.x,y=this.player.y;
  const nearby=this.remains.filter(r=>r.at<=now&&Math.abs(r.x-x)<1000&&Math.abs(r.y-y)<1000).sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2));
  for(let i=0;i<this.debrisImages.length;i++){const image=this.debrisImages[i],r=nearby[i];if(!r){image.setVisible(false);continue;}image.setFrame(r.row).setPosition(r.x,r.y).setDisplaySize(r.size,r.size).setVisible(true);}
 }
 private freeSlot():Crate|undefined {
  const old=this.crates.find(c=>!c.enemy.active);if(old)return old;if(this.crates.length>=MAX_PROP_SLOTS)return;
  const enemy=new Enemy(this.scene);enemy.isSupplySlot=true;this.enemies.push(enemy);const slot={enemy,cell:null,life:0,frame:18,halfW:26,halfH:12,offsetX:0};this.crates.push(slot);return slot;
 }
 /** Ground footprints only. Reuse correction scalars; no per-body callbacks or allocations. */
 private blocked(x:number,y:number,r:number,crate:Crate):boolean {
  const cx=crate.enemy.x+crate.offsetX,cy=crate.enemy.y-crate.halfH*.5,hw=crate.halfW,hh=crate.halfH;
  if(Math.abs(x-cx)>hw+r||Math.abs(y-cy)>hh+r)return false;
  const qx=Phaser.Math.Clamp(x,cx-hw,cx+hw),qy=Phaser.Math.Clamp(y,cy-hh,cy+hh),dx=x-qx,dy=y-qy,d=Math.hypot(dx,dy);
  if(d>=r)return false;if(d>.0001){this.pushX=dx/d*(r-d);this.pushY=dy/d*(r-d);return true;}
  const left=x-cx+hw,right=cx+hw-x,top=y-cy+hh,bottom=cy+hh-y,min=Math.min(left,right,top,bottom);
  this.pushX=min===left?-(left+r):min===right?right+r:0;this.pushY=min===top?-(top+r):min===bottom?bottom+r:0;return true;
 }
 resolveBodies(allies:readonly Ally[]):void {
  for(const c of this.crates){if(!c.enemy.active)continue;
   if(this.blocked(this.player.x,this.player.y,this.player.radius,c)){this.player.sprite.x+=this.pushX;this.player.sprite.y+=this.pushY;}
   for(const a of allies)if(a.active&&this.blocked(a.x,a.y,a.radius,c))a.push(this.pushX,this.pushY);
   for(const e of this.enemies)if(e.active&&!e.isSupplySlot&&!e.invulnerable&&!e.controlImmune&&this.blocked(e.x,e.y,e.radius,c)){e.sprite.x+=this.pushX;e.sprite.y+=this.pushY;}
  }
 }
 clear():void {for(const image of this.debrisImages)image.setVisible(false);this.remains.length=0;for(const f of this.breakFx){f.active=false;f.image.setVisible(false);}for(const c of this.crates)c.enemy.deactivate();for(const p of this.potions){p.active=false;p.image.setVisible(false);}this.healRemaining=0;}
}
