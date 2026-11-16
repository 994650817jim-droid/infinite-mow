/**
 * 义军主城（英雄无敌式城镇画面）：一张随城池规模（小城 / 中城 / 大城）变化的城池全景，建筑按固定位置摆在城中，
 * 点建筑弹出建造 / 升级面板；「建造总览」列出全部建筑与前提。全景可拖动（手机横向、电脑纵向），滚轮 / 右摇杆也可平移。
 * 顶部资源与季节，底部天下地图 / 建造总览 / 城池发展 / 商贸 / 季度报告 / 税率 / 出征备战。
 * 美术：assets/city（全景与建筑，CityLayout）；缺图时退回旧小镇像素画（assets/town）与程序画。
 */
import {playMenuMusic} from '../systems/Music';
import {isChapterTestRun} from '../systems/ChapterProgress';
import Phaser from 'phaser';
import {W,H,worldShell,worldAssets} from '../world/WorldUI';
import {FONT,HEADING_FONT} from '../config';
import {homeCommand,warPanelTexture} from '../ui/HomeCommand';
import {uiSfx} from '../systems/Sfx';
import {checkWorld,addCounter} from '../systems/Achievements';
import {loadWorld,saveWorld,worldUnlocked,storageUnavailable,incompatibleSave,townUpgrade,granaryLevy,setTaxRate,setCityFocus,resolveTownEvent,tradeGrain,sendCaravan} from '../world/WorldStore';
import {TOWN_BUILDINGS,TAX_NAME,TAX_PER_HOUSEHOLD,FOCUS_NAME,FOCUS_INCOME,FOCUS_CHANGE_COST,CITY_SIZE,CITY_TITLE,HALL_UPGRADE,nextCost,buildBlockers,citySize,households,levelOf,canAfford,costText,seasonLabel,SEASONS,eventById,grainSellPrice,grainBuyPrice,caravanValue,caravanSlots,CARAVAN_CARGO,buildingBattleEffects,TOWN_ART_LEVELS,townArtLevel,type TownBuildingId,type TaxRate,type CityFocus,type TownState} from '../town/TownData';
import {PANO_W,PANO_H,CITY_SLOTS,LEVEL_SCALE,CITY_BG_SIZES,CITY_ART_LEVELS} from '../town/CityLayout';
import {cityById,TIER_NAME} from '../world/WorldCities';

/** 是否电脑布局：在场景构造时读取（模块加载时布局尚未初始化）。 */
let D=false;
/** 建造总览的顺序。 */
const ORDER:TownBuildingId[]=['hall','wall','house','market','farm','granary','barracks','clinic','post','smithy','drill','tavern','pavilion'];
/** 占位建筑：屋顶颜色与牌匾字。 */
const LOOK:Record<TownBuildingId,{roof:number;wall:number;mark:string}>={
 hall:{roof:0x5b2a22,wall:0xb69a6c,mark:'府'},
 barracks:{roof:0x7a2f24,wall:0x8b7356,mark:'营'},farm:{roof:0x6f8a3a,wall:0x9a8456,mark:'田'},clinic:{roof:0x3f6f6a,wall:0xb9a882,mark:'医'},
 house:{roof:0x5a4a3a,wall:0xb8a27c,mark:'民'},market:{roof:0xa8692c,wall:0xc2a676,mark:'市'},post:{roof:0x4b5f7a,wall:0xa99a7c,mark:'驿'},
 smithy:{roof:0x3d3a38,wall:0x8a7a6a,mark:'铁'},drill:{roof:0x8a3d2a,wall:0x9c8c6c,mark:'校'},granary:{roof:0x9b7a3a,wall:0xb59a6a,mark:'仓'},
 wall:{roof:0x5c5650,wall:0x8a8274,mark:'墙'},tavern:{roof:0x7a4a5a,wall:0xb69e7a,mark:'酒'},pavilion:{roof:0xb08a2c,wall:0xd9c9a0,mark:'麟'},
};
const txt=(s:Phaser.Scene,x:number,y:number,v:string,size=15,color='#ede3c9',font=FONT)=>s.add.text(x,y,v,{fontFamily:font,fontSize:size+'px',color,resolution:2});
type Have={merits:number;provisions:number;money:number};
const haveOf=(s:ReturnType<typeof loadWorld>):Have=>({merits:s.merits,provisions:s.provisions,money:s.town.money});
/** 建筑状态：满级 / 可建可升 / 缺资源 / 缺前提。 */
function statusOf(t:TownState,id:TownBuildingId,have:Have):'max'|'ready'|'poor'|'locked'{const c=nextCost(t,id);if(!c)return'max';if(buildBlockers(t,id).length)return'locked';return canAfford(have,c)?'ready':'poor';}

export class CityScene extends Phaser.Scene {
 private message='';
 private pano!:Phaser.GameObjects.Container;private top!:Phaser.GameObjects.Text;private season!:Phaser.GameObjects.Text;private sizeText!:Phaser.GameObjects.Text;
 private vr={x:0,y:0,w:0,h:0};private k=1;private sx=0;private sy=0;
 private hits:Phaser.GameObjects.Rectangle[]=[];
 private drag:{x:number;y:number;sx:number;sy:number;moved:boolean}|null=null;private pressedSlot:string|null=null;
 private popId:TownBuildingId|null=null;
 constructor(){super('CityScene');}
 init(){D=W>600;this.vr=D?{x:12,y:62,w:W-24,h:H-62-58}:{x:0,y:104,w:W,h:H-104-160};this.k=Math.max(this.vr.w/PANO_W,this.vr.h/PANO_H);this.hits=[];this.drag=null;}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'town_ground','assets/town/ground.webp');
  for(const n of CITY_BG_SIZES)worldAssets(this,`city_bg_${n}`,`assets/city/bg_${n}.webp`);
  const ids=Object.keys(TOWN_BUILDINGS) as TownBuildingId[];
  for(const lv of CITY_ART_LEVELS)for(const id of ids)if(lv<=(TOWN_BUILDINGS[id].maxLevel??3))worldAssets(this,`city_${id}_${lv}`,`assets/city/${id}_${lv}.webp`);
  // 旧小镇像素画作为缺图时的退路（府衙没有旧图）
  if(!CITY_ART_LEVELS.length)for(const lv of TOWN_ART_LEVELS)for(const id of ids)if(id!=='hall')worldAssets(this,`town_${id}_${lv}`,`assets/town/${id}_${lv}.webp`);}
 create(){playMenuMusic(this);this.registry.remove('hardChapter');
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}
  // 战斗图集在下次出征重新加载，不与战略界面美术同时常驻
  const keys=this.registry.get('battleTextureKeys') as string[]|undefined;
  if(keys){for(const key of keys)if(this.textures.exists(key))this.textures.remove(key);this.registry.remove('battleTextureKeys');this.registry.set('battleReady',false);}
  saveWorld();
  // 全景（最底层）
  this.pano=this.add.container(0,0).setDepth(-5);
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.vr.x,this.vr.y,this.vr.w,this.vr.h);this.pano.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());
  // 页眉底色压住全景边缘
  const head=this.add.graphics().setDepth(-1);head.fillStyle(0x102019,1).fillRect(0,0,W,this.vr.y).fillRect(0,this.vr.y+this.vr.h,W,H-this.vr.y-this.vr.h);
  head.lineStyle(2,0xb3935b,.85).strokeRect(this.vr.x,this.vr.y,this.vr.w,this.vr.h);
  worldShell(this,'义军主城');
  this.season=txt(this,D?190:24,D?28:58,'',D?16:14,'#e7c98a',HEADING_FONT).setOrigin(0,D?.5:0);
  this.top=txt(this,D?W-200:W-24,D?28:30,'',D?14:13,'#cfdcc6').setOrigin(1,.5);
  const recruit=homeCommand(this,W-80,D?28:30,130,34,'招募后备',false,true,14);recruit.hit.setName('city-recruit').on('pointerdown',()=>this.scene.start('CityRecruitScene'));
  if(!D)this.top.setPosition(24,90).setOrigin(0,.5);
  // 城池规模牌（全景左上角）
  this.sizeText=txt(this,this.vr.x+12,this.vr.y+10,'',D?15:14,'#f6e2ae',HEADING_FONT).setDepth(5).setShadow(0,1,'#000',4,true,true).setBackgroundColor('#1a120bcc').setPadding(8,4,8,4);
  // 底部导航：电脑一行 7 个；手机 4 + 3
  const items:Array<[string,string,()=>void,boolean]>=[
   ['天下地图','city-map',()=>this.scene.start('WorldMapScene'),false],
   ['建造总览','city-build',()=>this.openOverview(),false],
   ['城池发展','city-focus',()=>this.openFocus(),false],
   ['商贸','city-trade',()=>this.openTrade(),false],
   ['季度报告','city-report',()=>this.openReport(),false],
   ['','city-tax',()=>this.openTax(),false],
   ['出征备战','city-expedition',()=>{this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter','huangjin');this.openPreparation();},true],
  ];
  const gap=D?8:8;
  items.forEach(([label,name,fn,primary],i)=>{const cols=D?7:i<4?4:3,col=D?i:i<4?i:i-4,row=D?0:i<4?0:1,navW=(W-(D?24:28)-gap*(cols-1))/cols,x=(D?12:14)+navW/2+col*(navW+gap),y=D?H-28:H-128+row*58;
   const btn=homeCommand(this,x,y,navW,D?40:48,label,primary,true,D?14:15);btn.hit.setName(name).on('pointerdown',fn);if(name==='city-tax')this.taxCaption=btn.caption;});
  // 拖动 / 滚轮平移全景
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{if(this.anyModal()||!this.inView(p.x,p.y))return;this.drag={x:p.x,y:p.y,sx:this.sx,sy:this.sy,moved:false};});
  this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{const d=this.drag;if(!d||!p.isDown)return;const dx=p.x-d.x,dy=p.y-d.y;if(!d.moved&&Math.hypot(dx,dy)<8)return;d.moved=true;this.scrollTo(d.sx-dx,d.sy-dy);});
  this.input.on('pointerup',()=>{this.time.delayedCall(0,()=>{this.drag=null;});});
  this.input.on('wheel',(_p:Phaser.Input.Pointer,_o:unknown,dx:number,dy:number)=>{if(this.anyModal())return;const roomX=PANO_W*this.k-this.vr.w,roomY=PANO_H*this.k-this.vr.h;if(roomX>roomY)this.scrollTo(this.sx+(dx||dy)*.6,this.sy);else this.scrollTo(this.sx+dx*.6,this.sy+dy*.6);});
  // 初始视角：上次的位置，或对准府衙
  const saved=this.registry.get('cityScroll') as {sx:number;sy:number}|undefined,hall=CITY_SLOTS[1].hall;
  // 默认：横向对准府衙，纵向贴底（天空可往上拖出来看）
  if(saved)this.scrollTo(saved.sx,saved.sy,false);else this.scrollTo(hall.x*this.k-this.vr.w/2,PANO_H*this.k-this.vr.h,false);
  this.refresh();
  // 出征归来：有新的季度报告就自动弹出一次
  const t=loadWorld().town,key=t.report?`${t.report.year}-${t.report.season}`:'';if(!this.introSeen()){this.time.delayedCall(250,()=>this.openIntro());}else if(key&&this.registry.get('townReportSeen')!==key){this.registry.set('townReportSeen',key);this.time.delayedCall(250,()=>this.openReport());}else if(t.pendingEvent)this.time.delayedCall(250,()=>this.openEvent());
 }
 private taxCaption?:Phaser.GameObjects.Text;private boonText?:Phaser.GameObjects.Text;
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

 private refresh(){
  const s=loadWorld(),t=s.town,size=citySize(t);
  checkWorld(s);
  this.season.setText(`${seasonLabel(t.year,t.season)}（下一季）`);
  this.top.setText(`军功 ${s.merits}   粮草 ${s.provisions}   钱 ${t.money}`);
  this.sizeText.setText(`${CITY_SIZE[size]} · ${CITY_TITLE[size]}`);
  const be=buildingBattleEffects(t),bo=t.boon,pts=be.attributePoints+bo.attributePoints,dmg=Math.round((be.damage+bo.damage)*100),hp=Math.round((be.maxHp+bo.maxHp)*100);
  this.boonText?.destroy();const parts=[pts?`属性点 +${pts}`:'',dmg?`伤害 ${dmg>0?'+':''}${dmg}%`:'',hp?`生命 ${hp>0?'+':''}${hp}%`:''].filter(Boolean);
  if(parts.length)this.boonText=txt(this,W-24,D?54:68,'出征加成 · '+parts.join(' · '),12,'#b9d2a8').setOrigin(1,.5);
  this.taxCaption?.setText('税率 · '+TAX_NAME[t.tax]);
  this.drawPano();
 }

 /** 建筑贴图：主城全景美术 → 旧小镇像素画 → 无（程序画）。 */
 private artKey(id:TownBuildingId,level:number):string|null{
  let best=0;for(const l of CITY_ART_LEVELS)if(l<=level&&l>best)best=l;
  if(best&&this.textures.exists(`city_${id}_${best}`))return`city_${id}_${best}`;
  const old=townArtLevel(level);if(id!=='hall'&&old&&this.textures.exists(`town_${id}_${old}`))return`town_${id}_${old}`;
  return null;
 }
 private smokeTimers:Phaser.Time.TimerEvent[]=[];
 /** 缓缓升起的烟（每 0.6 秒一团，挂在全景里随拖动一起移动）。 */
 private smoke(x:number,y:number,color:number,alpha:number){
  const k=this.k;this.smokeTimers.push(this.time.addEvent({delay:620,loop:true,callback:()=>{
   const p=this.add.circle(x+(Math.random()-.5)*6*k,y,(7+Math.random()*5)*k,color,alpha);this.pano.add(p);
   this.tweens.add({targets:p,y:y-(90+Math.random()*40)*k,x:p.x+(18+Math.random()*24)*k,scale:2.6,alpha:0,duration:2600+Math.random()*700,onComplete:()=>p.destroy()});}}));
 }
 private drawPano(){
  for(const t of this.smokeTimers)t.remove();this.smokeTimers=[];
  this.pano.removeAll(true);this.hits=[];
  const s=loadWorld(),t=s.town,size=citySize(t) as 1|2|3,k=this.k,have=haveOf(s),slots=CITY_SLOTS[size];
  // 底图
  const bg=`city_bg_${size}`;
  if(this.textures.exists(bg))this.pano.add(this.add.image(0,0,bg).setOrigin(0).setDisplaySize(PANO_W*k,PANO_H*k));
  else this.drawFallbackBg(size);
  // 建筑：按底边从后往前画
  const ids=(Object.keys(slots) as TownBuildingId[]).sort((a,b)=>slots[a].y-slots[b].y);
  for(const id of ids){
   const sl=slots[id],lv=levelOf(t,id),x=sl.x*k,y=sl.y*k,st=statusOf(t,id,have);
   // 奇观：城池规模不够时不在城中显示空地（建造总览里仍可查看）
   if(!lv&&TOWN_BUILDINGS[id].maxLevel===1&&(TOWN_BUILDINGS[id].minHall??1)>size)continue;
   let w=sl.w*k*(LEVEL_SCALE[Math.max(1,lv)]),h=w*.72;
   if(lv>0){
    const key=this.artKey(id,lv);
    if(key){const img=this.add.image(x,y,key).setOrigin(.5,1);img.setScale(w/img.width);h=img.displayHeight;this.pano.add(img);if(this.popId===id){this.playPop(img,x,y);}
     // 炊烟 / 炉烟：铁匠铺浓、酒肆淡
     if(id==='smithy'||id==='tavern')this.smoke(x+w*(id==='smithy'?.22:-.05),y-h*(id==='smithy'?.9:.92),id==='smithy'?0x6f6a66:0xd9d2c4,id==='smithy'?.55:.32);}
    else{const g=this.drawPlaceholder(id,lv,x,y,w);h=w*.7;if(this.popId===id)this.playPop(g,x,y);}
   }else{
    // 未建：地基与木牌
    const g=this.add.graphics(),fw=w*.8;g.fillStyle(0x3a2c1c,.38).fillEllipse(x,y-fw*.12,fw,fw*.32);g.lineStyle(2,st==='locked'?0x6c6250:0xe8cf8f,st==='locked'?.5:.85);
    for(let a=0;a<20;a+=2){const a0=a/20*Math.PI*2,a1=(a+1)/20*Math.PI*2;g.beginPath();g.moveTo(x+Math.cos(a0)*fw/2,y-fw*.12+Math.sin(a0)*fw*.16);g.lineTo(x+Math.cos(a1)*fw/2,y-fw*.12+Math.sin(a1)*fw*.16);g.strokePath();}
    this.pano.add(g);h=fw*.5;
   }
   // 名牌
   const label=lv>0?`${TOWN_BUILDINGS[id].name} Lv${lv}`:st==='locked'?`${TOWN_BUILDINGS[id].name} · 需${CITY_SIZE[TOWN_BUILDINGS[id].minHall??1]}`:`＋ ${TOWN_BUILDINGS[id].name}`;
   const tag=txt(this,x,y-(lv>0?4:h*.24),label,D?12:13,lv>0?'#fff1cf':st==='locked'?'#b3a78f':'#f6e2ae').setOrigin(.5,1).setBackgroundColor(lv>0?'#20150dcc':'#20150d99').setPadding(6,2,6,2).setName('tag-'+id);
   this.pano.add(tag);
   // 可建 / 可升级：绿色箭头
   if(st==='ready'){const by=y-h-(lv>0?4:0),badge=this.add.container(x+w*.32,Math.max(14,by+10));badge.add(this.add.circle(0,0,11,0x2f7a3a).setStrokeStyle(2,0xd8f0b8));badge.add(txt(this,0,0,'↑',14,'#ffffff',HEADING_FONT).setOrigin(.5));badge.setName('ready-'+id);this.pano.add(badge);this.tweens.add({targets:badge,y:badge.y-4,yoyo:true,repeat:-1,duration:700,ease:'Sine.easeInOut'});}
   // 点击区
   const hit=this.add.rectangle(x,y-h/2,Math.max(w*.8,60),Math.max(h,50),0xffffff,.001).setName('bld-'+id).setInteractive({useHandCursor:true});
   // 按下和抬起都落在这块地上才算点建筑：弹窗「返回」按下时就关闭了，抬起不会再穿透到下面的城墙等地块（手柄也是先发按下再发抬起）
   hit.on('pointerdown',()=>{this.pressedSlot=id;});
   hit.on('pointerup',()=>{const own=this.pressedSlot===id;this.pressedSlot=null;if(!own||this.drag?.moved)return;this.openCard(id);});
   hit.on('pointerover',()=>tag.setColor('#ffe08a')).on('pointerout',()=>tag.setColor(lv>0?'#fff1cf':st==='locked'?'#b3a78f':'#f6e2ae'));
   if(id==='hall')hit.setData('padDefault',true);
   this.pano.add(hit);this.hits.push(hit);
  }
  this.popId=null;
  this.scrollTo(this.sx,this.sy,false);
 }
 /** 无底图时：程序画天空、远山、土地、街道与对应规模的城墙。 */
 private drawFallbackBg(size:number){
  const k=this.k,g=this.add.graphics(),w=PANO_W*k,h=PANO_H*k;
  g.fillGradientStyle(0x9fb7b0,0x9fb7b0,0xd9cfae,0xd9cfae,1).fillRect(0,0,w,h*.32);
  g.fillStyle(0x6f8475,1);for(let i=0;i<7;i++)g.fillTriangle(i*w/6-w*.12,h*.32,i*w/6+w*.05,h*.12+(i%3)*h*.04,i*w/6+w*.22,h*.32);
  this.pano.add(g);
  if(this.textures.exists('town_ground'))this.pano.add(this.add.tileSprite(0,h*.3,w,h*.7,'town_ground').setOrigin(0).setTileScale(.5*k/.6));
  else{const gr=this.add.graphics();gr.fillStyle(0x7a6544,1).fillRect(0,h*.3,w,h*.7);this.pano.add(gr);}
  const r=this.add.graphics();r.fillStyle(0xd9bf8a,.45).fillRect(w*.47,h*.36,w*.06,h*.64).fillRect(0,h*.74,w,h*.05).fillRect(w*.1,h*.55,w*.8,h*.035);
  // 城墙：小城木栅、中城夯土、大城青砖
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
  const close=homeCommand(this,W/2,y+h-34,160,40,'返回',false,true,15);close.hit.setName(name+'-close').setData('padDefault',true).on('pointerdown',()=>{root.destroy();this.refresh();if(name==='town-intro')this.afterIntro();else if(name==='town-report'&&loadWorld().town.pendingEvent)this.openEvent();});root.add([close.g,close.hit,close.caption]);
  return{root,x:(W-w)/2,y,w,h};
 }
 /** 建筑面板：现状、下一级效果、花费、前提，建造 / 升级。 */
 private openCard(id:TownBuildingId){
  const s=loadWorld(),t=s.town,def=TOWN_BUILDINGS[id],lv=levelOf(t,id),cost=nextCost(t,id),block=buildBlockers(t,id),have=haveOf(s),ok=!!cost&&!block.length&&canAfford(have,cost);
  const h=D?400:620,m=this.modal('town-card',`${def.name} · ${lv?'Lv'+lv:'未建'}`,h,640);
  // 预览图：已建显示当前等级，未建显示 Lv1
  const px=D?m.x+130:W/2,py=D?m.y+250:m.y+230,key=this.artKey(id,Math.max(1,lv));
  if(key){const img=this.add.image(px,py,key).setOrigin(.5,1);img.setScale(Math.min((D?210:240)/img.width,(D?180:160)/img.height));if(!lv)img.setAlpha(.45);m.root.add(img);}
  else{const c=this.add.container(0,0);m.root.add(c);const save=this.pano;this.pano=c;this.drawPlaceholder(id,Math.max(1,lv),px,py,D?200:220);this.pano=save;if(!lv)c.setAlpha(.45);}
  const tx=D?m.x+260:m.x+30,tw=D?m.w-290:m.w-60;let y=D?m.y+64:m.y+250;
  const line=(v:string,size=14,color='#e9dcc0',name?:string)=>{const o=txt(this,tx,y,v,size,color).setWordWrapWidth(tw,true);if(name)o.setName(name);m.root.add(o);y+=o.height+8;return o;};
  line(def.blurb,13,'#c9bf99');
  line(lv?'现在：'+def.effect(lv):'尚未建造',14,'#efe2c4');
  if(cost){line((lv?'下一级：':'建成后：')+def.effect(lv+1),14,'#cfe0c8');line('花费：'+costText(cost),14,canAfford(have,cost)?'#d9c58f':'#d4887a','town-card-cost');}
  else line('已达最高等级',14,'#b9a98a');
  if(id==='hall'&&cost&&HALL_UPGRADE[lv])line(`扩建为${CITY_SIZE[lv+1]}：解锁 Lv${lv+1} 建筑${lv===1?'，以及驿站、铁匠铺、校场、酒肆':'，以及奇观麒麟阁'}`,13,'#b9d2a8');
  if(block.length&&cost)line('需要：'+block.join('、'),14,'#e59a83','town-card-block');
  if(id==='house'||id==='market')line(`民户 ${households(t)} · ${TAX_NAME[t.tax]}每户 ${TAX_PER_HOUSEHOLD[t.tax]} 钱`,12,'#b9c9b2');
  const msg=txt(this,W/2,m.y+h-(D?118:132),'',13,'#e8c98a').setOrigin(.5).setName('town-card-msg');m.root.add(msg);
  // 建筑功能（已建成才有）：军营招募、市集 / 驿站商贸、府衙报告与税率
  const funcs:Partial<Record<TownBuildingId,[string,()=>void]>>={
   barracks:['招募后备',()=>this.scene.start('CityRecruitScene')],
   market:['买卖粮草',()=>{m.root.destroy();this.openTrade();}],
   post:['派遣商队',()=>{m.root.destroy();this.openTrade();}],
   hall:['季度报告',()=>{m.root.destroy();this.openReport();}],
   granary:['开仓募兵',()=>{const res=granaryLevy();if(!res.ok){msg.setText(res.message);return;}m.root.destroy();this.refresh();this.toast(res.message);}],
  },fn=lv>0?funcs[id]:undefined,bw=fn?Math.min(200,(m.w-80)/2):Math.min(240,m.w-60),ux=fn?W/2+bw/2+8:W/2;
  if(fn){const f=homeCommand(this,W/2-bw/2-8,m.y+h-(D?84:94),bw,42,fn[0],false,true,15);f.hit.setName('town-card-func').on('pointerdown',fn[1]);m.root.add([f.g,f.hit,f.caption]);}
  const up=homeCommand(this,ux,m.y+h-(D?84:94),bw,42,cost?(lv?`升级到 Lv${lv+1}`:'建造'):'已满级',true,ok,16);
  up.hit.setName('town-upgrade').setData('padDefault',true).on('pointerdown',()=>{if(!ok){msg.setText(cost?(block.length?'需要 '+block.join('、'):'资源不足：需要 '+costText(cost)):'已达最高等级');return;}
   const res=townUpgrade(id);if(!res.ok){msg.setText(res.message);return;}
   this.children.getByName('town-overview')?.destroy();m.root.destroy();this.popId=id;this.focusOn(id);this.refresh();this.toast(res.message);});
  m.root.add([up.g,up.hit,up.caption]);
  (m.root.getByName('town-card-close') as Phaser.GameObjects.GameObject|null)?.setData('padDefault',false);
 }
 /** 把全景平移到某座建筑。 */
 private focusOn(id:TownBuildingId){const sl=CITY_SLOTS[citySize(loadWorld().town) as 1|2|3][id];this.scrollTo(sl.x*this.k-this.vr.w/2,sl.y*this.k-this.vr.h*.62);}
 /** 建造总览：12 座建筑的等级与状态，点卡片打开建筑面板。 */
 private openOverview(){
  const s=loadWorld(),t=s.town,have=haveOf(s),cols=D?7:3,rows=Math.ceil(ORDER.length/cols),cw=D?80:Math.floor((W-24-48-16)/3),ch=D?118:122,h=D?120+rows*(ch+10)+60:118+rows*(ch+8)+60;
  const m=this.modal('town-overview',`建造总览 · ${CITY_SIZE[citySize(t)]}`,h);
  m.root.add(txt(this,W/2,m.y+56,'绿色可建造 / 升级 · 黄色缺资源 · 灰色需扩城',12,'#c9bf99').setOrigin(.5));
  const x0=W/2-(cols*cw+(cols-1)*8)/2;
  ORDER.forEach((id,i)=>{
   const col=i%cols,row=Math.floor(i/cols),x=x0+col*(cw+8),y=m.y+78+row*(ch+(D?10:8)),lv=levelOf(t,id),st=statusOf(t,id,have);
   const color=st==='ready'?0x2f6a35:st==='poor'?0x7a6428:st==='locked'?0x3a352e:0x4a3a26;
   const g=this.add.graphics();g.fillStyle(color,.55).fillRoundedRect(x,y,cw,ch,8).lineStyle(2,st==='ready'?0x9fd68a:0xc9ad74,.8).strokeRoundedRect(x,y,cw,ch,8);m.root.add(g);
   const key=this.artKey(id,Math.max(1,lv));if(key){const img=this.add.image(x+cw/2,y+ch-40,key).setOrigin(.5,1);img.setScale(Math.min((cw-12)/img.width,(ch-52)/img.height));if(!lv)img.setAlpha(.4);m.root.add(img);}
   else m.root.add(txt(this,x+cw/2,y+(ch-40)/2,LOOK[id].mark,30,lv?'#f4d99f':'#7d7262',HEADING_FONT).setOrigin(.5));
   m.root.add(txt(this,x+cw/2,y+ch-36,`${TOWN_BUILDINGS[id].name}${lv?' Lv'+lv:''}`,13,'#fff1cf').setOrigin(.5,0));
   m.root.add(txt(this,x+cw/2,y+ch-18,st==='max'?'满级':st==='ready'?(lv?'可升级':'可建造'):st==='poor'?'缺资源':'需扩城',11,st==='ready'?'#bfeaa8':st==='poor'?'#e8cf8f':'#a99d88').setOrigin(.5,0));
   const hit=this.add.rectangle(x+cw/2,y+ch/2,cw,ch,0xffffff,.001).setName('ov-'+id).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.openCard(id));if(i===0)hit.setData('padDefault',true);m.root.add(hit);
  });
  (m.root.getByName('town-overview-close') as Phaser.GameObjects.GameObject|null)?.setData('padDefault',false);
 }
 private openReport(){
  const t=loadWorld().town,q=t.report,m=this.modal('town-report','季度报告',D?360:440);
  const body=q?[
   `${seasonLabel(q.year,q.season)}`,
   `农田产粮　+${q.grain} 粮${q.season===2?'（秋收 ×1.5）':q.season===3?'（冬 ×0.5）':''}`,
   `民户 ${q.households} · 税收　+${q.tax} 钱${levelOf(t,'market')?'':'（无市集，只收三成）'}`,
   `城池产出　军功 +${q.cityMerits} · 粮草 +${q.cityProvisions} · 钱 +${q.cityMoney}`,
   `军粮开销　−${q.upkeep} 粮${q.shortage?`　· 缺粮 ${q.shortage}`:''}`,
   ...(q.caravanMoney||q.caravanLost?[`商队归来　+${q.caravanMoney??0} 钱${q.caravanLost?`　· ${q.caravanLost} 支被劫`:''}`]:[]),
   ...(q.event?[`本季大事　${eventById(q.event)?.title??''}`]:[]),
   '',`接下来：${seasonLabel(t.year,t.season)}`,
  ].join('\n'):'尚无季度报告。\n出征（战役、攻城、守城）结束、坚持 60 秒以上或获胜时，主城过一季并在此结算。';
  m.root.add(txt(this,m.x+40,m.y+66,body,D?16:15,'#efe2c4').setLineSpacing(10).setWordWrapWidth(m.w-80,true).setName('town-report-body'));
 }
 private openTax(){
  const t=loadWorld().town,m=this.modal('town-tax','税率',D?330:420);
  m.root.add(txt(this,W/2,m.y+62,'税越重收钱越多，但流民、盗匪等坏事件更易发生。',13,'#c9bf99').setOrigin(.5).setWordWrapWidth(m.w-60,true).setAlign('center'));
  (['low','mid','high'] as TaxRate[]).forEach((rate,i)=>{
   const y=m.y+120+i*58,on=t.tax===rate,b=homeCommand(this,W/2,y,Math.min(360,m.w-60),46,`${TAX_NAME[rate]} · 每户 ${TAX_PER_HOUSEHOLD[rate]} 钱${on?'（当前）':''}`,on,true,15);
   b.hit.setName('tax-'+rate).on('pointerdown',()=>{this.message=setTaxRate(rate).message;this.openTax();this.refresh();});if(on)b.hit.setData('padDefault',true);m.root.add([b.g,b.hit,b.caption]);
  });
 }
 private openFocus(){
  const s=loadWorld(),owned=s.ownedCities.map(id=>cityById(id)).filter((c):c is NonNullable<typeof c>=>!!c),rows=Math.max(1,owned.length),page=this.focusPage,per=D?5:6;
  const m=this.modal('town-focus','城池发展',D?470:Math.min(H-40,640));
  if(!owned.length){m.root.add(txt(this,W/2,m.y+120,'尚未占领城池。\n在天下地图攻下城池后，可为每座城选择重农、重商或重军。',15,'#efe2c4').setOrigin(.5).setAlign('center').setLineSpacing(8));return;}
  const list=owned.slice(page*per,page*per+per);
  m.root.add(txt(this,W/2,m.y+58,`钱 ${s.town.money} · 首次选择免费，之后改方向花钱`,13,'#c9bf99').setOrigin(.5));
  list.forEach((c,i)=>{
   const y=m.y+92+i*(D?62:80),cur=(s.town.focus[c.id]??'balanced') as CityFocus,inc=FOCUS_INCOME[c.tier][cur];
   m.root.add(txt(this,m.x+28,y,`${c.name}（${TIER_NAME[c.tier]}）· ${FOCUS_NAME[cur]}`,15,'#f4d99f'));
   m.root.add(txt(this,m.x+28,y+22,`每季 ${costText(inc)}`,12,'#b9c9b2'));
   (['farm','trade','military'] as CityFocus[]).forEach((f,k)=>{
    const bw=D?92:(m.w-56)/3,bx=D?m.x+m.w-28-bw/2-(2-k)*(bw+8):m.x+28+bw/2+k*(bw+4),by=D?y+16:y+56,cost=cur==='balanced'?0:FOCUS_CHANGE_COST[c.tier];
    const b=homeCommand(this,bx,by,bw,34,FOCUS_NAME[f]+(cur===f?'✓':cost?` ${cost}`:''),cur===f,cur!==f&&s.town.money>=cost,13);b.hit.setName(`focus-${c.id}-${f}`).on('pointerdown',()=>{this.message=setCityFocus(c.id,f).message;this.openFocus();});m.root.add([b.g,b.hit,b.caption]);
   });
  });
  if(rows>per){const pages=Math.ceil(rows/per),nb=homeCommand(this,m.x+m.w-90,m.y+30,120,32,`第${page+1}/${pages}页 ›`,false,true,13);nb.hit.setName('town-focus-next').on('pointerdown',()=>{this.focusPage=(page+1)%pages;this.openFocus();});m.root.add([nb.g,nb.hit,nb.caption]);}
  if(this.message)m.root.add(txt(this,W/2,m.y+(D?470:Math.min(H-40,640))-74,this.message,12,'#e8c98a').setOrigin(.5));
 }
 private focusPage=0;
 /** 引导关闭后：有新报告先看报告，否则有待决事件就弹事件。 */
 private afterIntro(){const t=loadWorld().town,key=t.report?`${t.report.year}-${t.report.season}`:'';if(key&&this.registry.get('townReportSeen')!==key){this.registry.set('townReportSeen',key);this.openReport();}else if(t.pendingEvent)this.openEvent();}
 private introSeen():boolean{try{return localStorage.getItem('im_town_intro2')==='1';}catch{return true;}}
 /** 首次进入主城的简短引导（看过一次后不再弹出）。 */
 private openIntro(){
  const m=this.modal('town-intro','义军主城 · 经营指南',D?400:470);
  const lines=[
   '◆点城中的建筑或空地即可建造、升级；「建造总览」一览全部建筑。拖动画面可查看全城。',
   '◆府衙决定城池规模：小城 → 中城 → 大城。扩城需要城墙、民居、市集等前提；其它建筑的等级不能高于府衙。',
   '◆每打完一仗（胜利或坚持60秒以上），主城过一季：农田产粮、市集收税、城池按发展方向产出，并扣除后备兵军粮。',
   '◆税越重收钱越多，但坏事件更常发生；有市集可买卖粮草，有驿站可派商队去自己的城池换钱。',
  ];
  m.root.add(txt(this,m.x+34,m.y+68,lines.join(String.fromCharCode(10)),D?14:15,'#e9dcc0').setLineSpacing(10).setWordWrapWidth(m.w-68,true));
  try{localStorage.setItem('im_town_intro2','1');}catch{/* 存储不可用 */}
 }

 /** 季度事件：二选一，必须选择（没有返回按钮）。 */
 private openEvent(){
  const t=loadWorld().town,ev=t.pendingEvent?eventById(t.pendingEvent):undefined;if(!ev)return;
  this.children.getByName('town-event')?.destroy();
  const root=this.add.container(0,0).setDepth(620).setName('town-event'),w=Math.min(D?620:W-24,W-24),h=D?360:520,y=(H-h)/2,x=(W-w)/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x0b0806,.8).setInteractive());
  root.add(this.add.image(W/2,H/2,warPanelTexture(this,w,h,true)).setDisplaySize(w+16,h+16));
  root.add(txt(this,W/2,y+26,ev.kind==='bad'?'急报':ev.kind==='good'?'喜讯':'军中议事',13,ev.kind==='bad'?'#e59a83':ev.kind==='good'?'#a9d6a0':'#c9bf99').setOrigin(.5));
  root.add(txt(this,W/2,y+56,ev.title,26,'#efd399',HEADING_FONT).setOrigin(.5).setName('town-event-title'));
  root.add(txt(this,W/2,y+98,ev.text,15,'#e9dcc0').setOrigin(.5,0).setWordWrapWidth(w-70,true).setAlign('center'));
  ev.options.forEach((o,i)=>{
   const bw=D?(w-80)/2:w-60,bx=D?x+40+bw/2+i*(bw+0):W/2,by=D?y+h-92:y+h-200+i*96;
   const btn=homeCommand(this,bx,by,Math.min(bw,260),46,o.label,i===0,true,16);btn.hit.setName('event-option-'+i).on('pointerdown',()=>{const res=resolveTownEvent(i);if(res.ok)addCounter('events',1);root.destroy();this.refresh();this.toast(res.message);});if(i===0)btn.hit.setData('padDefault',true);
   root.add([btn.g,btn.hit,btn.caption]);root.add(txt(this,bx,by+34,o.note,12,'#c9bf99').setOrigin(.5,0).setWordWrapWidth(Math.min(bw,280),true).setAlign('center'));
  });
 }
 /** 商贸：市集买卖粮；驿站派商队。 */
 private openTrade(){
  const s=loadWorld(),t=s.town,h=D?440:Math.min(H-40,700),m=this.modal('town-trade','商贸',h);
  let y=m.y+60;const left=m.x+30;
  m.root.add(txt(this,W/2,y,`粮草 ${s.provisions} · 钱 ${t.money}`,14,'#cfdcc6').setOrigin(.5));y+=30;
  m.root.add(txt(this,left,y,'市集',18,'#f4d99f',HEADING_FONT));y+=30;
  if(!levelOf(t,'market')){m.root.add(txt(this,left,y,'尚未建造市集：在城中建市集后可买卖粮草。',13,'#a99d88'));y+=40;}
  else{
   m.root.add(txt(this,left,y,`卖粮每 1 粮得 ${grainSellPrice(t)} 钱 · 买粮每 1 粮花 ${grainBuyPrice(t)} 钱（市集越高越划算）`,12,'#b9c9b2').setWordWrapWidth(m.w-60,true));y+=28;
   const acts:Array<[string,string,()=>void]>=[['卖粮 20','trade-sell-20',()=>this.tradeAct(tradeGrain(true,20))],['卖粮 50','trade-sell-50',()=>this.tradeAct(tradeGrain(true,50))],['买粮 20','trade-buy-20',()=>this.tradeAct(tradeGrain(false,20))]];
   const bw=Math.min(150,(m.w-80)/3);acts.forEach(([label,name,fn],i)=>{const b=homeCommand(this,left+bw/2+i*(bw+10),y+20,bw,38,label,false,true,14);b.hit.setName(name).on('pointerdown',fn);if(i===0)b.hit.setData('padDefault',true);m.root.add([b.g,b.hit,b.caption]);});y+=56;
  }
  m.root.add(txt(this,left,y,'驿站商队',18,'#f4d99f',HEADING_FONT));y+=30;
  const slots=caravanSlots(t),owned=s.ownedCities.map(id=>cityById(id)).filter((c):c is NonNullable<typeof c>=>!!c);
  if(!slots){m.root.add(txt(this,left,y,'尚未建造驿站：主城扩为中城后可建驿站，派商队载粮去己方城池，下季带钱回来。',13,'#a99d88').setWordWrapWidth(m.w-60,true));}
  else if(!owned.length){m.root.add(txt(this,left,y,'尚未占领城池，没有商队目的地。',13,'#a99d88'));}
  else{
   m.root.add(txt(this,left,y,`每季 ${slots} 支 · 在途 ${t.caravans.length} 支 · 去重商城池收益更高，有一定被劫风险`,12,'#b9c9b2').setWordWrapWidth(m.w-60,true));y+=26;
   for(const c of owned.slice(0,D?3:4)){
    const busy=t.caravans.some(x=>x.to===c.id),focus=t.focus[c.id]??'balanced';
    m.root.add(txt(this,left,y+10,`${c.name}（${TIER_NAME[c.tier]}·${FOCUS_NAME[focus]}）${busy?' · 商队在途':''}`,14,busy?'#8f8676':'#efe2c4'));
    CARAVAN_CARGO.forEach((cargo,k)=>{const bw=D?150:120,b=homeCommand(this,m.x+m.w-30-bw/2-(CARAVAN_CARGO.length-1-k)*(bw+8),y+18,bw,32,`载粮${cargo}→${caravanValue(cargo,c.tier,focus)}钱`,false,!busy&&t.caravans.length<slots&&s.provisions>=cargo,12);b.hit.setName(`caravan-${c.id}-${cargo}`).on('pointerdown',()=>this.tradeAct(sendCaravan(c.id,cargo)));m.root.add([b.g,b.hit,b.caption]);});
    y+=D?44:48;
   }
  }
  if(this.message)m.root.add(txt(this,W/2,m.y+h-74,this.message,12,'#e8c98a').setOrigin(.5).setName('town-trade-message'));
 }
 private tradeAct(r:{ok:boolean;message:string}){this.message=r.message;this.refresh();this.openTrade();}
}
export {SEASONS};
