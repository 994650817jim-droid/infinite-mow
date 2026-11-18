/**
 * 义军营寨（英雄无敌式城镇画面）：一张随规模（营寨 / 县城 / 州府）变化的全景，建筑按固定位置摆在其中，
 * 点建筑弹出建造 / 升级面板。全景可拖动（手机横向、电脑纵向），滚轮 / 右摇杆也可平移。
 * 2026-11-16 简化：只有军粮一种货币；没有税收、商贸、季度事件；建筑按章节分阶段开放；讲武堂研究科技；马厩换马。
 * 顶部军粮与下一步提示，底部 天下地图 / 讲武堂 /（州府）城池 / 出征备战。
 * 美术：assets/city（全景与建筑，CityLayout；讲武堂、马厩暂复用校场、驿站图）；缺图时退回旧小镇像素画与程序画。
 */
import {MERIT} from '../data/merit';
import {exchangeMerit,merit,scrolls} from '../systems/MasteryStore';
import {playMenuMusic} from '../systems/Music';
import {isChapterTestRun} from '../systems/ChapterProgress';
import Phaser from 'phaser';
import {W,H,worldShell,worldAssets} from '../world/WorldUI';
import {FONT,HEADING_FONT} from '../config';
import {homeCommand,warPanelTexture} from '../ui/HomeCommand';
import {openStable} from '../ui/ItemBagUI';
import {openHeroCodex} from '../ui/HeroCodexUI';
import {GROWTH_ICON_IDS} from '../ui/GrowthIcons';
import {stableUnlocked} from '../systems/ItemStore';
import {CHARACTERS,type CharacterId} from '../data/characters';
import {uiSfx} from '../systems/Sfx';
import {checkWorld} from '../systems/Achievements';
import {loadWorld,saveWorld,worldUnlocked,storageUnavailable,incompatibleSave,townUpgrade,granaryLevy,researchTech,townProgress,stableCapacity,drillInfo,trainTroops} from '../world/WorldStore';
import {TOWN_BUILDINGS,FOCUS_NAME,FOCUS_INCOME,FOCUS_CHANGE_COST,CITY_SIZE,CITY_TITLE,HALL_UPGRADE,nextCost,buildBlockers,buildingOpen,citySize,focusOpen,levelOf,costText,incomeText,townArtLevel,type TownBuildingId,type TownState,type CityFocus,type TownProgress} from '../town/TownData';
import {TECHS,TECH_IDS,BRANCH_NAME,BRANCH_ORDER,techBlockers,techTotals,type TechBranch} from '../data/tech';
import {PANO_W,PANO_H,CITY_SLOTS,LEVEL_SCALE,CITY_BG_SIZES,CITY_ART_LEVELS,ART_ALIAS} from '../town/CityLayout';
import {cityById,TIER_NAME} from '../world/WorldCities';
import {CampLife,loadCampLife} from '../town/CampLife';

/** 是否电脑布局：在场景构造时读取（模块加载时布局尚未初始化）。 */
let D=false;
/** 占位建筑：屋顶颜色与牌匾字。 */
const LOOK:Record<TownBuildingId,{roof:number;wall:number;mark:string}>={
 hall:{roof:0x5b2a22,wall:0xb69a6c,mark:'帐'},barracks:{roof:0x7a2f24,wall:0x8b7356,mark:'营'},farm:{roof:0x6f8a3a,wall:0x9a8456,mark:'田'},
 academy:{roof:0x3f5a6f,wall:0xb9a882,mark:'武'},talent:{roof:0x7a4a5a,wall:0xb69e7a,mark:'贤'},stable:{roof:0x6a4a2a,wall:0xa99a7c,mark:'马'},granary:{roof:0x9b7a3a,wall:0xb59a6a,mark:'仓'},
 pavilion:{roof:0xb08a2c,wall:0xd9c9a0,mark:'麟'},
};
const txt=(s:Phaser.Scene,x:number,y:number,v:string,size=15,color='#ede3c9',font=FONT)=>s.add.text(x,y,v,{fontFamily:font,fontSize:size+'px',color,resolution:2});
/** 建筑状态：满级 / 可建可升 / 缺军粮 / 缺前提。 */
function statusOf(t:TownState,id:TownBuildingId,grain:number,p:TownProgress):'max'|'ready'|'poor'|'locked'{const c=nextCost(t,id);if(c===null)return'max';if(buildBlockers(t,id,p).length)return'locked';return grain>=c?'ready':'poor';}

export class CityScene extends Phaser.Scene {
 private message='';
 private pano!:Phaser.GameObjects.Container;private top!:Phaser.GameObjects.Text;private hint!:Phaser.GameObjects.Text;private sizeText!:Phaser.GameObjects.Text;
 private vr={x:0,y:0,w:0,h:0};private k=1;private sx=0;private sy=0;
 private hits:Phaser.GameObjects.Rectangle[]=[];
 /** 营寨档的营帐与兵士（town/CampLife.ts）；县城以后为 null。 */
 private campLife:CampLife|null=null;
 private drag:{x:number;y:number;sx:number;sy:number;moved:boolean}|null=null;private pressedSlot:string|null=null;
 private popId:TownBuildingId|null=null;
 private techTab:TechBranch='supply';
 constructor(){super('CityScene');}
 init(){D=W>600;this.vr=D?{x:12,y:62,w:W-24,h:H-62-58}:{x:0,y:104,w:W,h:H-104-104};this.k=Math.max(this.vr.w/PANO_W,this.vr.h/PANO_H);this.hits=[];this.drag=null;this.campLife=null;}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'town_ground','assets/town/ground.webp');
  for(const n of CITY_BG_SIZES)worldAssets(this,`city_bg_${n}`,`assets/city/bg_${n}.webp`);
  loadCampLife(this);
  const ids=Object.keys(TOWN_BUILDINGS) as TownBuildingId[];
  for(const lv of CITY_ART_LEVELS)for(const id of ids)if(lv<=(TOWN_BUILDINGS[id].maxLevel??3)){const a=ART_ALIAS[id]??id;worldAssets(this,`city_${a}_${lv}`,`assets/city/${a}_${lv}.webp`);}}
 create(){playMenuMusic(this);this.registry.remove('hardChapter');
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}
  // 战斗图集在下次出征重新加载，不与战略界面美术同时常驻
  const keys=this.registry.get('battleTextureKeys') as string[]|undefined;
  if(keys){for(const key of keys)if(this.textures.exists(key))this.textures.remove(key);this.registry.remove('battleTextureKeys');this.registry.set('battleReady',false);}
  saveWorld();
  try{localStorage.setItem('im_home_seen','1');}catch{/* 存储不可用 */}
  // 全景（最底层）
  this.pano=this.add.container(0,0).setDepth(-5);
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.vr.x,this.vr.y,this.vr.w,this.vr.h);this.pano.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());
  // 页眉底色压住全景边缘
  const head=this.add.graphics().setDepth(-1);head.fillStyle(0x102019,1).fillRect(0,0,W,this.vr.y).fillRect(0,this.vr.y+this.vr.h,W,H-this.vr.y-this.vr.h);
  head.lineStyle(2,0xb3935b,.85).strokeRect(this.vr.x,this.vr.y,this.vr.w,this.vr.h);
  worldShell(this,'义军营寨');
  // 2026-11-17 用户：「只留下天下地图，其他按钮不需要，玩家想要什么就去点击建筑物」——招贤馆、招募后备、讲武堂、出征备战都改为点建筑 / 从天下地图出征
  this.top=txt(this,D?W-24:24,D?28:72,'',D?15:14,'#efe0b4',HEADING_FONT).setOrigin(D?1:0,.5).setName('city-grain');
  // 规模牌（全景左上角）与下一步提示（全景底边）
  this.sizeText=txt(this,this.vr.x+12,this.vr.y+10,'',D?15:14,'#f6e2ae',HEADING_FONT).setDepth(5).setShadow(0,1,'#000',4,true,true).setBackgroundColor('#1a120bcc').setPadding(8,4,8,4);
  this.hint=txt(this,D?190:24,D?28:94,'',D?13:12,'#b9d2a8').setOrigin(0,.5).setName('city-hint');
  // 底栏：只有「天下地图」（出征也从天下地图选章节）；功能都在建筑里
  const mapBtn=homeCommand(this,W/2,D?H-28:H-72,D?260:W-60,D?40:52,'天下地图 · 出征',true,true,D?16:17);mapBtn.hit.setName('city-map').on('pointerdown',()=>this.scene.start('WorldMapScene'));
  if(D)txt(this,24,H-28,'点建筑进入：军营招兵 · 讲武堂科技 · 招贤馆 · 主帐武将谱',12,'#a9b9a2').setOrigin(0,.5).setName('city-tip');
  // 拖动 / 滚轮平移全景
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(this.anyModal()||!this.inView(p.x,p.y))return;this.drag={x:p.x,y:p.y,sx:this.sx,sy:this.sy,moved:false};});
  this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{const d=this.drag;if(!d||!p.isDown)return;const dx=p.x-d.x,dy=p.y-d.y;if(!d.moved&&Math.hypot(dx,dy)<8)return;d.moved=true;this.scrollTo(d.sx-dx,d.sy-dy);});
  this.input.on('pointerup',()=>{this.time.delayedCall(0,()=>{this.drag=null;});});
  this.input.on('wheel',(_p:Phaser.Input.Pointer,_o:unknown,dx:number,dy:number)=>{if(this.anyModal())return;const roomX=PANO_W*this.k-this.vr.w,roomY=PANO_H*this.k-this.vr.h;if(roomX>roomY)this.scrollTo(this.sx+(dx||dy)*.6,this.sy);else this.scrollTo(this.sx+dx*.6,this.sy+dy*.6);});
  // 初始视角：上次的位置，或横向对准主帐、纵向贴底
  const saved=this.registry.get('cityScroll') as {sx:number;sy:number}|undefined,hall=CITY_SLOTS[1].hall;
  if(saved)this.scrollTo(saved.sx,saved.sy,false);else this.scrollTo(hall.x*this.k-this.vr.w/2,PANO_H*this.k-this.vr.h,false);
  this.refresh();
  if(!this.introSeen())this.time.delayedCall(250,()=>this.openIntro());
 }
 private boonText?:Phaser.GameObjects.Text;
 private openPreparation(){if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
 private anyModal(){return this.children.list.some(o=>(o as unknown as {depth:number}).depth>=600);}
 private inView(x:number,y:number){const r=this.vr;return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;}
 /** 平移全景（夹在边界内），并只让视野内的建筑可点（手柄导航也只在视野内移动）。 */
 private scrollTo(sx:number,sy:number,remember=true){
  this.sx=Phaser.Math.Clamp(sx,0,Math.max(0,PANO_W*this.k-this.vr.w));this.sy=Phaser.Math.Clamp(sy,0,Math.max(0,PANO_H*this.k-this.vr.h));
  this.pano?.setPosition(this.vr.x-this.sx,this.vr.y-this.sy);
  for(const h of this.hits){const x=h.x+this.pano.x,y=h.y+this.pano.y;if(h.input)h.input.enabled=this.inView(x,y);}
  if(remember)this.registry.set('cityScroll',{sx:this.sx,sy:this.sy});
 }
 /** 下一步提示：还没扩建时说明扩建条件，否则提示讲武堂。 */
 private nextHint(s:ReturnType<typeof loadWorld>):string{
  const t=s.town,size=citySize(t),up=HALL_UPGRADE[size];
  if(up)return up.ok(townProgress(s))?`主帐可扩建为${CITY_TITLE[size+1]}（${costText(up.cost)}）`:`${up.needs}后，营寨可扩建为${CITY_TITLE[size+1]}`;
  return levelOf(t,'pavilion')?'':'州府已成：可建奇观麒麟阁';
 }
 private refresh(){
  const s=loadWorld(),t=s.town,size=citySize(t);
  checkWorld(s);
  this.top.setText(`军粮 ${s.provisions}`);
  this.sizeText.setText(`${CITY_TITLE[size]}`);
  this.hint.setText(this.nextHint(s));
  const tech=techTotals(t.tech),pav=levelOf(t,'pavilion')>0?1:0,pts=tech.attributePoints+pav,dmg=Math.round((tech.damage+pav*.06)*100),hp=Math.round((tech.maxHp+pav*.06)*100);
  this.boonText?.destroy();const drill=drillInfo(s),parts=[drill.level?`部曲 ×${drill.multiplier.toFixed(2)}`:'',tech.potions?`回血药 ${tech.potions.count}`:'',pts?`属性点 +${pts}`:'',dmg?`伤害 +${dmg}%`:'',hp?`生命 +${hp}%`:''].filter(Boolean);
  if(parts.length)this.boonText=txt(this,W-24,D?54:72,'出征加成 · '+parts.join(' · '),12,'#b9d2a8').setOrigin(1,.5).setName('city-boon');
  this.drawPano();
 }

 /** 建筑贴图：营寨全景美术（新建筑复用旧图）→ 旧小镇像素画 → 无（程序画）。 */
 private artKey(id:TownBuildingId,level:number):string|null{
  const a=ART_ALIAS[id]??id;let best=0;for(const l of CITY_ART_LEVELS)if(l<=level&&l>best)best=l;
  if(best&&this.textures.exists(`city_${a}_${best}`))return`city_${a}_${best}`;
  const old=townArtLevel(level);if(id!=='hall'&&old&&this.textures.exists(`town_${a}_${old}`))return`town_${a}_${old}`;
  return null;
 }
 private drawPano(){
  this.campLife?.destroy();this.campLife=null;this.pano.removeAll(true);this.hits=[];
  const s=loadWorld(),t=s.town,size=citySize(t) as 1|2|3,k=this.k,p=townProgress(s),slots=CITY_SLOTS[size];
  const bg=`city_bg_${size}`;
  if(this.textures.exists(bg))this.pano.add(this.add.image(0,0,bg).setOrigin(0).setDisplaySize(PANO_W*k,PANO_H*k));
  else this.drawFallbackBg(size);
  // 建筑：只画当前规模已开放的，按底边从后往前
  const ids=(Object.keys(slots) as TownBuildingId[]).filter(id=>buildingOpen(t,id)).sort((a,b)=>slots[a].y-slots[b].y);
  for(const id of ids){
   const sl=slots[id],lv=levelOf(t,id),x=sl.x*k,y=sl.y*k,st=statusOf(t,id,s.provisions,p);
   let w=sl.w*k*(LEVEL_SCALE[Math.min(3,Math.max(1,lv))]),h=w*.72,art:Phaser.GameObjects.Image|Phaser.GameObjects.Container|undefined,glow:Phaser.GameObjects.Ellipse|undefined;
   if(lv>0){
    const key=this.artKey(id,lv);
    glow=this.add.ellipse(x,y-w*.06,w*1.02,w*.34,0xffe39a,0).setName('glow-'+id);this.pano.add(glow);
    if(key){const img=this.add.image(x,y,key).setOrigin(.5,1);img.setScale(w/img.width);h=img.displayHeight;this.pano.add(img);art=img;if(this.popId===id)this.playPop(img,x,y);}
    else{const g=this.drawPlaceholder(id,lv,x,y,w);h=w*.7;art=g;if(this.popId===id)this.playPop(g,x,y);}
   }else{
    // 未建：地基虚线圈
    const g=this.add.graphics(),fw=w*.8;g.fillStyle(0x3a2c1c,.38).fillEllipse(x,y-fw*.12,fw,fw*.32);g.lineStyle(2,0xe8cf8f,.85);
    for(let a=0;a<20;a+=2){const a0=a/20*Math.PI*2,a1=(a+1)/20*Math.PI*2;g.beginPath();g.moveTo(x+Math.cos(a0)*fw/2,y-fw*.12+Math.sin(a0)*fw*.16);g.lineTo(x+Math.cos(a1)*fw/2,y-fw*.12+Math.sin(a1)*fw*.16);g.strokePath();}
    this.pano.add(g);h=fw*.5;
   }
   const name=id==='hall'?CITY_TITLE[size]+'主帐':TOWN_BUILDINGS[id].name,label=lv>0?`${name} Lv${lv}`:`＋ ${name}`;
   const tag=txt(this,x,y-(lv>0?4:h*.24),label,D?12:13,lv>0?'#fff1cf':'#f6e2ae').setOrigin(.5,1).setBackgroundColor(lv>0?'#20150dcc':'#20150d99').setPadding(6,2,6,2).setName('tag-'+id);
   this.pano.add(tag);
   if(st==='ready'){const by=y-h-(lv>0?4:0),badge=this.add.container(x+w*.32,Math.max(14,by+10));badge.add(this.add.circle(0,0,11,0x2f7a3a).setStrokeStyle(2,0xd8f0b8));badge.add(txt(this,0,0,'↑',14,'#ffffff',HEADING_FONT).setOrigin(.5));badge.setName('ready-'+id);this.pano.add(badge);this.tweens.add({targets:badge,y:badge.y-4,yoyo:true,repeat:-1,duration:600,ease:'Sine.easeInOut'});}
   const hit=this.add.rectangle(x,y-h/2,Math.max(w*.8,60),Math.max(h,50),0xffffff,.001).setName('bld-'+id).setInteractive({useHandCursor:true});
   // 按下和抬起都落在这块地上才算点建筑：弹窗「返回」按下时就关闭了，抬起不会再穿透到下面的城墙等地块（手柄也是先发按下再发抬起）
   hit.on('pointerdown',()=>{this.pressedSlot=id;});
   hit.on('pointerup',()=>{const own=this.pressedSlot===id;this.pressedSlot=null;if(!own||this.drag?.moved)return;this.openCard(id);});
   const base=art?{x:art.scaleX,y:art.scaleY}:null;
   hit.on('pointerover',()=>{tag.setColor('#ffe08a').setScale(1.18);glow?.setFillStyle(0xffe39a,.5);if(art&&base&&this.popId!==id)art.setScale(base.x*1.04,base.y*1.04);})
    .on('pointerout',()=>{tag.setColor(lv>0?'#fff1cf':'#f6e2ae').setScale(1);glow?.setFillStyle(0xffe39a,0);if(art&&base)art.setScale(base.x,base.y);});
   if(id==='hall')hit.setData('padDefault',true);
   this.pano.add(hit);this.hits.push(hit);
  }
  this.popId=null;
  // 营寨档：营帐、兵士填空地（画在建筑之下；按建筑点击区与贴图外框避让）
  if(size===1&&new URLSearchParams(location.search).get('camplife')!=='0'){const ox=this.pano.x,oy=this.pano.y,blocked=[...this.hits.map(h=>h.getBounds()),...this.pano.list.filter((o):o is Phaser.GameObjects.Image=>o instanceof Phaser.GameObjects.Image&&o.texture.key.startsWith('city_')&&!o.texture.key.startsWith('city_bg')).map(o=>o.getBounds())].map(b=>({l:(b.x-ox)/k,r:(b.right-ox)/k,t:(b.y-oy)/k,b:(b.bottom-oy)/k}));
   this.campLife=new CampLife(this,k,blocked);this.pano.remove(this.campLife.root);this.pano.addAt(this.campLife.root,this.textures.exists(bg)?1:0);}
  this.scrollTo(this.sx,this.sy,false);
 }
 update(_t:number,dt:number){this.campLife?.update(dt);}
 /** 无底图时：程序画天空、远山、土地、街道与对应规模的寨墙。 */
 private drawFallbackBg(size:number){
  const k=this.k,g=this.add.graphics(),w=PANO_W*k,h=PANO_H*k;
  g.fillGradientStyle(0x9fb7b0,0x9fb7b0,0xd9cfae,0xd9cfae,1).fillRect(0,0,w,h*.32);
  g.fillStyle(0x6f8475,1);for(let i=0;i<7;i++)g.fillTriangle(i*w/6-w*.12,h*.32,i*w/6+w*.05,h*.12+(i%3)*h*.04,i*w/6+w*.22,h*.32);
  this.pano.add(g);
  if(this.textures.exists('town_ground'))this.pano.add(this.add.tileSprite(0,h*.3,w,h*.7,'town_ground').setOrigin(0).setTileScale(.5*k/.6));
  else{const gr=this.add.graphics();gr.fillStyle(0x7a6544,1).fillRect(0,h*.3,w,h*.7);this.pano.add(gr);}
  const r=this.add.graphics();r.fillStyle(0xd9bf8a,.45).fillRect(w*.47,h*.36,w*.06,h*.64).fillRect(0,h*.74,w,h*.05).fillRect(w*.1,h*.55,w*.8,h*.035);
  const col=size===1?0x6b4a2c:size===2?0x9a8259:0x7d7b78,top=h*(size===1?.33:.3),th=size===1?h*.03:h*.05;
  r.fillStyle(col,1).fillRect(0,top,w,th);for(let x=0;x<w;x+=size===1?10:22)r.fillRect(x,top-(size===1?8:10),size===1?5:12,size===1?8:10);
  this.pano.add(r);
 }
 private drawPlaceholder(id:TownBuildingId,level:number,x:number,y:number,w:number):Phaser.GameObjects.Container{
  const L=LOOK[id],c=this.add.container(x,y),g=this.add.graphics(),bw=w*.7,bh=w*.36;
  g.fillStyle(0x000000,.25).fillEllipse(0,-2,bw*1.2,bh*.3);
  g.fillStyle(L.wall,1).fillRect(-bw/2,-bh,bw,bh);
  for(let i=0;i<level;i++){const rw=bw*(1.25-i*.2),ry=-bh-i*bh*.38;g.fillStyle(L.roof,1).fillTriangle(-rw/2,ry,rw/2,ry,0,ry-bh*.42).fillRect(-rw/2,ry-3,rw,6);}
  g.fillStyle(0x2a1d14,.9).fillRect(-bw*.08,-bh*.55,bw*.16,bh*.55);
  c.add(g);c.add(this.add.circle(bw/2-12,-bh+14,11,0x9a2a1e).setStrokeStyle(1.5,0xe8c98a));c.add(txt(this,bw/2-12,-bh+14,L.mark,12,'#fbe9c9',HEADING_FONT).setOrigin(.5));
  this.pano.add(c);return c;
 }
 private toastText?:Phaser.GameObjects.Text;
 private toast(v:string){
  const warn=storageUnavailable?(incompatibleSave?'存档版本较新，本次修改不会保存':'存储不可用，修改仅保留本次会话'):'';const msg=[v,warn].filter(Boolean).join('\n');if(!msg)return;
  this.toastText?.destroy();this.toastText=txt(this,W/2,this.vr.y+this.vr.h-18,msg,D?15:14,'#ffe7a8',HEADING_FONT).setOrigin(.5,1).setDepth(8).setAlign('center').setBackgroundColor('#1a120bdd').setPadding(12,6,12,6).setName('city-toast');
  const tt=this.toastText;this.tweens.add({targets:tt,alpha:0,delay:2600,duration:600,onComplete:()=>tt.destroy()});
 }
 /** 建成 / 升级后播放一次：建筑弹起 + 尘土。 */
 private playPop(target:Phaser.GameObjects.Image|Phaser.GameObjects.Container,x:number,y:number){
  const sx=target.scaleX,sy=target.scaleY;target.setScale(sx*.55,sy*.35);
  this.tweens.add({targets:target,scaleX:sx,scaleY:sy,duration:460,ease:'Back.easeOut'});
  for(let i=0;i<12;i++){const a=Math.PI*(i/11),d=this.add.circle(x,y-6,(5+Math.random()*6)*this.k*1.6,0xc9b28a,.75);this.pano.add(d);this.tweens.add({targets:d,x:x+Math.cos(a)*(50+Math.random()*40)*this.k*1.6*(i%2?1:-1),y:y-14-Math.random()*24,alpha:0,scale:1.8,duration:600+Math.random()*200,onComplete:()=>d.destroy()});}
  uiSfx().play('uiClick');
 }

 // —— 弹窗 ——
 private modal(name:string,title:string,h:number,depth=600):{root:Phaser.GameObjects.Container;x:number;y:number;w:number;h:number}{
  this.children.getByName(name)?.destroy();
  const root=this.add.container(0,0).setDepth(depth).setName(name),w=Math.min(D?640:W-24,W-24),y=(H-h)/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x0b0806,.78).setInteractive());
  root.add(this.add.image(W/2,H/2,warPanelTexture(this,w,h,true)).setDisplaySize(w+16,h+16));
  root.add(txt(this,W/2,y+30,title,22,'#efd399',HEADING_FONT).setOrigin(.5).setName(name+'-title'));
  const close=homeCommand(this,W/2,y+h-34,160,40,'返回',false,true,15);close.hit.setName(name+'-close').setData('padDefault',true).on('pointerdown',()=>{root.destroy();this.refresh();});root.add([close.g,close.hit,close.caption]);
  return{root,x:(W-w)/2,y,w,h};
 }
 /** 建筑面板：现状、下一级效果、花费、前提，建造 / 升级，以及建筑功能（招募、研究、换马、开仓）。 */
 private openCard(id:TownBuildingId){
  const s=loadWorld(),t=s.town,def=TOWN_BUILDINGS[id],lv=levelOf(t,id),cost=nextCost(t,id),block=buildBlockers(t,id,townProgress(s)),ok=cost!==null&&!block.length&&s.provisions>=cost;
  const size=citySize(t),title=id==='hall'?`${CITY_TITLE[size]}主帐`:`${def.name} · ${lv?'Lv'+lv:'未建'}`;
  const h=D?400:600,m=this.modal('town-card',title,h,640);
  const px=D?m.x+130:W/2,py=D?m.y+250:m.y+230,key=this.artKey(id,Math.max(1,lv));
  if(key){const img=this.add.image(px,py,key).setOrigin(.5,1);img.setScale(Math.min((D?210:240)/img.width,(D?180:160)/img.height));if(!lv)img.setAlpha(.45);m.root.add(img);}
  else{const c=this.add.container(0,0);m.root.add(c);const save=this.pano;this.pano=c;this.drawPlaceholder(id,Math.max(1,lv),px,py,D?200:220);this.pano=save;if(!lv)c.setAlpha(.45);}
  const tx=D?m.x+260:m.x+30,tw=D?m.w-290:m.w-60;let y=D?m.y+64:m.y+250;
  const line=(v:string,size=14,color='#e9dcc0',name?:string)=>{const o=txt(this,tx,y,v,size,color).setWordWrapWidth(tw,true);if(name)o.setName(name);m.root.add(o);y+=o.height+8;return o;};
  line(def.blurb,13,'#c9bf99');
  line(lv?'现在：'+def.effect(lv):'尚未建造',14,'#efe2c4');
  if(cost!==null){line((lv?'下一级：':'建成后：')+def.effect(lv+1),14,'#cfe0c8');line('花费：'+costText(cost),14,s.provisions>=cost?'#d9c58f':'#d4887a','town-card-cost');}
  else line('已达最高等级',14,'#b9a98a');
  if(id==='hall'&&cost!==null)line(`扩建为${CITY_TITLE[lv+1]}：${lv===1?'开放马厩、粮仓，建筑可升到 Lv2':'开放城池发展、奇观麒麟阁，建筑可升到 Lv3'}`,13,'#b9d2a8');
  if(id==='stable'&&lv)line('只能在营中休整时换马。',12,'#b9c9b2');
  // 军营「练兵」：全体部曲生命、伤害每级 +15%，上限随已开放章节
  if(id==='barracks'){const d=drillInfo(s);line(`练兵 ${d.level} / ${d.cap} 级：全体部曲生命、伤害 ×${d.multiplier.toFixed(2)}${d.cost!==null?`；下一级 ×${d.next.toFixed(2)}`:d.level<12?'；开放新章节后可继续练':''}`,13,'#cfe0c8','town-card-drill');
   const db=homeCommand(this,tx+Math.min(220,tw)/2,y+20,Math.min(220,tw),38,d.cost!==null?`练兵 · 军粮 ${d.cost}`:'练兵已达上限',true,d.cost!==null&&s.provisions>=d.cost,14);db.hit.setName('town-drill').on('pointerdown',()=>{const res=trainTroops();if(!res.ok){(m.root.getByName('town-card-msg') as Phaser.GameObjects.Text|null)?.setText(res.message);return;}uiSfx().play('uiClick');this.toast(res.message);this.openCard('barracks');this.refresh();});m.root.add([db.g,db.hit,db.caption]);y+=50;}
  if(block.length&&cost!==null)line('需要：'+block.join('、'),14,'#e59a83','town-card-block');
  const msg=txt(this,W/2,m.y+h-(D?118:132),'',13,'#e8c98a').setOrigin(.5).setName('town-card-msg');m.root.add(msg);
  type Fn=[string,()=>void];
  const funcs:Partial<Record<TownBuildingId,Fn[]>>={
   barracks:[['招募后备',()=>this.scene.start('CityRecruitScene')]],
   academy:[['研究科技',()=>{m.root.destroy();this.openTech();}],['战功换残卷',()=>{m.root.destroy();this.openMeritExchange();}]],
   talent:[['进入招贤馆',()=>this.scene.start('TalentHallScene')]],
   stable:[['进入马厩',()=>this.openStable(msg)]],
   // 城池发展已改为各城自己的建筑（天下地图 → 进入城池）
   hall:[['武将谱',()=>this.openCodex()]],
   granary:[['开仓募兵',()=>{const res=granaryLevy();if(!res.ok){msg.setText(res.message);return;}m.root.destroy();this.refresh();this.toast(res.message);}]],
  },fns=lv>0?funcs[id]??[]:[],n=fns.length+1,bgap=12,bw=Math.min(n>1?200:240,(m.w-60-bgap*(n-1))/n),bx=(i:number)=>W/2-((n-1)*(bw+bgap))/2+i*(bw+bgap),by=m.y+h-(D?84:94);
  fns.forEach(([label,fn],i)=>{const f=homeCommand(this,bx(i),by,bw,42,label,false,true,15);f.hit.setName(i?'town-card-func'+(i+1):'town-card-func').on('pointerdown',fn);m.root.add([f.g,f.hit,f.caption]);});
  const up=homeCommand(this,bx(n-1),by,bw,42,cost!==null?(lv?(id==='hall'?'扩建':`升级到 Lv${lv+1}`):'建造'):'已满级',true,ok,16);
  up.hit.setName('town-upgrade').setData('padDefault',true).on('pointerdown',()=>{if(!ok){msg.setText(cost!==null?(block.length?'需要 '+block.join('、'):'军粮不足：需要 '+cost):'已达最高等级');return;}
   const res=townUpgrade(id);if(!res.ok){msg.setText(res.message);return;}
   m.root.destroy();if(id==='hall'){this.scene.restart();return;}this.popId=id;this.focusOn(id);this.refresh();this.toast(res.message);});
  m.root.add([up.g,up.hit,up.caption]);
  (m.root.getByName('town-card-close') as Phaser.GameObjects.GameObject|null)?.setData('padDefault',false);
 }
 /**
  * 马厩：打开道具会话的换马界面 openStable（ui/ItemBagUI.ts，接口见共享笔记 stable-interface.md），代替原来全景右上角的临时入口。
  * 换马给上次出征的武将（行囊里可切换）。道具图集随战斗图集在进城时释放，打开前按需重新加载（马匹图标）。
  */
 /**
  * 武将谱（道具 / 成长会话的 openHeroCodex，ui/HeroCodexUI.ts）：从主帐面板「武将谱」进入，默认显示主公。
  * 属性图标 growth_icon_* 只在战斗加载时载入，进营寨时可能不在：缺的先按需加载，再打开（加载失败也照常打开，只缺图标）。
  */
 private openCodex(){
  this.children.getByName('town-card')?.destroy();
  const open=()=>{openHeroCodex(this,undefined,()=>this.refresh());};
  const miss=GROWTH_ICON_IDS.filter(id=>!this.textures.exists('growth_icon_'+id));
  if(!miss.length){open();return;}
  for(const id of miss)this.load.image('growth_icon_'+id,'assets/upgrade-icons/'+id+'.webp');
  this.load.once('complete',open);this.load.start();
 }
 private openStable(msg:Phaser.GameObjects.Text){
  if(!stableUnlocked()){msg.setText('第一章通关后才有坐骑');return;}
  this.children.getByName('town-card')?.destroy();
  let hero='zhaoyun';try{hero=localStorage.getItem('im_last_hero')||hero;}catch{/* 存储不可用 */}
  const open=()=>openStable(this,(CHARACTERS.some(c=>c.id===hero)?hero:'zhaoyun') as CharacterId,()=>this.refresh());
  if(this.textures.exists('item_icons'))open();else{this.load.atlas('item_icons','assets/items/item-icons.webp','assets/items/item-icons.json');this.load.once('complete',open);this.load.start();}
 }
 /** 把全景平移到某座建筑。 */
 private focusOn(id:TownBuildingId){const sl=CITY_SLOTS[citySize(loadWorld().town) as 1|2|3][id];this.scrollTo(sl.x*this.k-this.vr.w/2,sl.y*this.k-this.vr.h*.62);}

 /** 讲武堂：三条分支分页，每页列出该分支的科技（已研究 / 可研究 / 缺军粮 / 未解锁）。 */
 /** 讲武堂 · 战功换武学残卷（2026-11-17 用户：残卷去建筑手动换）：每 MERIT.perScroll 战功换 1 张，可选数量。 */
 private meritQty=1;
 private openMeritExchange(notice=''){
  const h=D?360:460,m=this.modal('town-merit','讲武堂 · 战功换武学残卷',h),have=merit(),max=Math.floor(have/MERIT.perScroll);
  this.meritQty=Math.max(1,Math.min(this.meritQty,Math.max(1,max)));
  const line=(y:number,v:string,size:number,color:string,name:string)=>m.root.add(txt(this,W/2,y,v,size,color).setOrigin(.5).setName(name));
  line(m.y+76,`战功 ${have}　·　武学残卷 ${scrolls()}`,18,'#f3d48a','merit-have');
  line(m.y+108,`每 ${MERIT.perScroll} 战功换 1 张武学残卷（数值待复核）。战功来自击杀精英（+${MERIT.elite}）与首领（+${MERIT.boss}）。`,13,'#b9a98a','merit-rule');
  const qy=m.y+164,q=this.meritQty;
  const step=(label:string,dx:number,name:string,fn:()=>void,w=56)=>{const b=homeCommand(this,W/2+dx,qy,w,40,label,false,true,16);b.hit.setName(name).on('pointerdown',fn);m.root.add([b.g,b.hit,b.caption]);};
  step('−',-130,'merit-minus',()=>{this.meritQty=Math.max(1,q-1);this.openMeritExchange();});
  line(qy,`× ${q}　（战功 ${q*MERIT.perScroll}）`,18,max>=q?'#ede3c9':'#e59a83','merit-qty');
  step('+',130,'merit-plus',()=>{this.meritQty=Math.min(Math.max(1,max),q+1);this.openMeritExchange();});
  step('最多',214,'merit-max',()=>{this.meritQty=Math.max(1,max);this.openMeritExchange();},76);
  const go=homeCommand(this,W/2,qy+58,220,42,`兑换 ${q} 张`,true,max>=q,16);go.hit.setName('merit-exchange').setData('padDefault',max>=q).on('pointerdown',()=>{const r=exchangeMerit(this.meritQty);this.meritQty=1;this.openMeritExchange(r.message);});m.root.add([go.g,go.hit,go.caption]);
  line(qy+104,notice||(max?`现有战功最多可换 ${max} 张`:'战功不足：去战场击杀精英、首领获得战功'),13,notice?'#9fd38a':'#b9a98a','merit-msg');
 }
 private openTech(){
  const s=loadWorld(),t=s.town,acad=levelOf(t,'academy'),h=D?Math.min(H-24,520):Math.min(H-40,780),m=this.modal('town-tech',acad?`讲武堂 Lv${acad} · 军粮 ${s.provisions}`:'讲武堂（未建）',h);
  if(!acad)m.root.add(txt(this,W/2,m.y+66,'先在营中建讲武堂（军粮 '+TOWN_BUILDINGS.academy.build+'），即可研究科技。',13,'#e59a83').setOrigin(.5).setWordWrapWidth(m.w-60,true).setAlign('center').setName('town-tech-need'));
  const tabW=Math.min(150,(m.w-60)/3);
  BRANCH_ORDER.forEach((b,i)=>{const on=this.techTab===b,done=TECH_IDS.filter(id=>TECHS[id].branch===b&&t.tech.includes(id)).length,all=TECH_IDS.filter(id=>TECHS[id].branch===b).length;
   const btn=homeCommand(this,W/2+(i-1)*(tabW+8),m.y+(acad?70:100),tabW,38,`${BRANCH_NAME[b]} ${done}/${all}`,on,true,15);btn.hit.setName('tech-tab-'+b).on('pointerdown',()=>{this.techTab=b;this.openTech();});m.root.add([btn.g,btn.hit,btn.caption]);});
  let padSet=false;
  const list=TECH_IDS.filter(id=>TECHS[id].branch===this.techTab),rowH=D?Math.min(70,(h-200)/list.length):Math.min(104,(h-220)/list.length);
  list.forEach((id,i)=>{
   const def=TECHS[id],done=t.tech.includes(id),block=techBlockers(id,t.tech,acad),ready=!done&&!block.length,afford=s.provisions>=def.cost,y=m.y+(acad?100:130)+i*rowH,x=m.x+24,w=m.w-48;
   const g=this.add.graphics();g.fillStyle(done?0x2f5a35:ready&&afford?0x3a4a2a:0x2a241c,.7).fillRoundedRect(x,y,w,rowH-8,8).lineStyle(2,done?0x9fd68a:ready?0xc9ad74:0x5a5040,.8).strokeRoundedRect(x,y,w,rowH-8,8);m.root.add(g);
   m.root.add(txt(this,x+14,y+8,`${def.name}　·　第${def.tier}层`,16,done?'#c9f0b0':ready?'#f4d99f':'#9d927c',HEADING_FONT));
   const desc=txt(this,x+14,y+(D?32:34),def.desc,12,done?'#b9d2a8':'#d9ccae').setWordWrapWidth(w-(D?170:150),true);m.root.add(desc);
   if(!done&&block.length)m.root.add(txt(this,x+14,desc.y+desc.height+4,`需要：${block.join('、')} · 军粮 ${def.cost}`,12,'#c99a7a').setName('tech-need-'+id));
   const bw=D?140:120,label=done?'已研究':block.length?'未解锁':`研究 ${def.cost}`;
   const btn=homeCommand(this,x+w-bw/2-10,y+(rowH-8)/2,bw,34,label,ready&&afford,ready&&afford,13);btn.hit.setName('tech-'+id).on('pointerdown',()=>{if(done)return;const res=researchTech(id);this.message=res.message;this.openTech();if(res.ok){uiSfx().play('uiClick');this.toast(res.message);}});
   if(ready&&afford&&!padSet){padSet=true;btn.hit.setData('padDefault',true);}
   m.root.add([btn.g,btn.hit,btn.caption]);
  });
  if(this.message)m.root.add(txt(this,W/2,m.y+h-72,this.message,13,'#e8c98a').setOrigin(.5).setName('town-tech-message'));
  this.message='';
 }
 private introSeen():boolean{try{return localStorage.getItem('im_town_intro3')==='1';}catch{return true;}}
 /** 首次进入营寨的简短引导（看过一次后不再弹出）。 */
 private openIntro(){
  const m=this.modal('town-intro','义军营寨',D?380:450);
  const lines=[
   '◆打仗赢来的只有一种：军粮。建造、研究、招募都花军粮。',
   '◆点营中的建筑或空地即可建造、升级；拖动画面可查看全营。每打完一仗，农田收一次粮。',
   '◆讲武堂研究科技：开局带回血药、兵种开局升级、主将更强。',
   `◆打完第二章可扩建为县城（开放马厩、粮仓）；打完第三章或占领城池后扩建为州府（开放城池发展）。`,
  ];
  m.root.add(txt(this,m.x+34,m.y+68,lines.join('\n'),D?14:15,'#e9dcc0').setLineSpacing(10).setWordWrapWidth(m.w-68,true));
  try{localStorage.setItem('im_town_intro3','1');}catch{/* 存储不可用 */}
 }
}
export {CITY_SIZE};
