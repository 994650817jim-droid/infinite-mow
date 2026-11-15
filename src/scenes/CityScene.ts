/**
 * 义军营寨 · 小镇（TOWN_PLAN.md · T2）：12 块地的俯视小镇，空地建造、已有建筑升级 / 拆除；
 * 顶部资源与季节，底部天下地图 / 城池发展 / 季度报告 / 税率 / 出征备战。
 * 建筑有美术时（town_<建筑>_<等级> 贴图，T4 导入）显示图片，否则用程序画的占位小屋。手柄经 PadNavigator 通用导航。
 */
import {playMenuMusic} from '../systems/Music';
import {isChapterTestRun} from '../systems/ChapterProgress';
import Phaser from 'phaser';
import {W,H,worldShell,worldAssets} from '../world/WorldUI';
import {FONT,HEADING_FONT} from '../config';
import {homeCommand,warPanelTexture} from '../ui/HomeCommand';
import {loadWorld,saveWorld,worldUnlocked,storageUnavailable,incompatibleSave,townBuild,townUpgrade,townDemolish,setTaxRate,setCityFocus} from '../world/WorldStore';
import {TOWN_BUILDINGS,PLOT_COUNT,TAX_NAME,TAX_PER_HOUSEHOLD,FOCUS_NAME,FOCUS_INCOME,FOCUS_CHANGE_COST,upgradeCostFor,demolishRefund,countOf,unlockedPlots,households,levelOf,canAfford,costText,seasonLabel,SEASONS,type TownBuildingId,type TaxRate,type CityFocus} from '../town/TownData';
import {cityById,TIER_NAME} from '../world/WorldCities';

/** 是否电脑布局：在场景构造时读取（模块加载时布局尚未初始化）。 */
let D=false;
const BUILD_ORDER:TownBuildingId[]=['house','farm','market','granary','clinic','drill','smithy','post','tavern','wall'];
/** 占位建筑：屋顶颜色与牌匾字。 */
const LOOK:Record<TownBuildingId,{roof:number;wall:number;mark:string}>={
 barracks:{roof:0x7a2f24,wall:0x8b7356,mark:'营'},farm:{roof:0x6f8a3a,wall:0x9a8456,mark:'田'},clinic:{roof:0x3f6f6a,wall:0xb9a882,mark:'医'},
 house:{roof:0x5a4a3a,wall:0xb8a27c,mark:'民'},market:{roof:0xa8692c,wall:0xc2a676,mark:'市'},post:{roof:0x4b5f7a,wall:0xa99a7c,mark:'驿'},
 smithy:{roof:0x3d3a38,wall:0x8a7a6a,mark:'铁'},drill:{roof:0x8a3d2a,wall:0x9c8c6c,mark:'校'},granary:{roof:0x9b7a3a,wall:0xb59a6a,mark:'仓'},
 wall:{roof:0x5c5650,wall:0x8a8274,mark:'墙'},tavern:{roof:0x7a4a5a,wall:0xb69e7a,mark:'酒'},
};
const txt=(s:Phaser.Scene,x:number,y:number,v:string,size=15,color='#ede3c9',font=FONT)=>s.add.text(x,y,v,{fontFamily:font,fontSize:size+'px',color,resolution:2});

export class CityScene extends Phaser.Scene {
 private selected=0;private choice:TownBuildingId|null=null;private message='';
 private map!:Phaser.GameObjects.Container;private side!:Phaser.GameObjects.Container;private top!:Phaser.GameObjects.Text;private season!:Phaser.GameObjects.Text;
 private mapRect={x:0,y:0,w:0,h:0};private sideRect={x:0,y:0,w:0,h:0};
 constructor(){super('CityScene');}
 init(){D=W>600;if(D){this.mapRect={x:20,y:74,w:612,h:396};this.sideRect={x:646,y:74,w:W-666,h:396};}else{const top=112,avail=H-top-170-12,mh=Math.round(Math.min(470,avail*.5));this.mapRect={x:14,y:top,w:W-28,h:mh};this.sideRect={x:14,y:top+mh+12,w:W-28,h:avail-mh};}}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'city_art','assets/world/camp.webp');if(!this.textures.exists('art_panel'))this.load.image('art_panel','assets/processed/overhaul/bronze-panel-mobile.png');}
 create(){playMenuMusic(this);
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}
  // 战斗图集在下次出征重新加载，不与战略界面美术同时常驻
  const keys=this.registry.get('battleTextureKeys') as string[]|undefined;
  if(keys){for(const key of keys)if(this.textures.exists(key))this.textures.remove(key);this.registry.remove('battleTextureKeys');this.registry.set('battleReady',false);}
  saveWorld();worldShell(this,'义军营寨');
  this.season=txt(this,D?190:24,D?28:58,'',D?16:14,'#e7c98a',HEADING_FONT).setOrigin(0,D?.5:0);
  this.top=txt(this,D?W-200:W-24,D?28:30,'',D?14:13,'#cfdcc6').setOrigin(1,.5);
  const recruit=homeCommand(this,W-80,D?28:30,130,34,'招募后备',false,true,14);recruit.hit.setName('city-recruit').on('pointerdown',()=>this.scene.start('CityRecruitScene'));
  if(!D)this.top.setPosition(24,90).setOrigin(0,.5);
  // 地图底：程序画的营地地面、道路（T4 有小镇底图时替换）
  const r=this.mapRect;
  if(this.textures.exists('town_ground'))this.add.image(r.x+r.w/2,r.y+r.h/2,'town_ground').setDisplaySize(r.w,r.h);
  else{const g=this.add.graphics();g.fillStyle(0x6b5a3c,1).fillRoundedRect(r.x,r.y,r.w,r.h,10);for(let i=0;i<140;i++){g.fillStyle(i%3?0x5e4f35:0x77673f,.35).fillCircle(r.x+((i*97)%r.w),r.y+((i*53)%r.h),2+(i%4));}
   g.fillStyle(0x8f7a55,.85);g.fillRect(r.x,r.y+r.h/3-6,r.w,12).fillRect(r.x,r.y+r.h*2/3-6,r.w,12);for(let c=1;c<4;c++)g.fillRect(r.x+r.w*c/4-5,r.y,10,r.h);
   g.lineStyle(2,0xb3935b,.8).strokeRoundedRect(r.x,r.y,r.w,r.h,10);}
  this.map=this.add.container(0,0);this.side=this.add.container(0,0);
  this.add.image(this.sideRect.x+this.sideRect.w/2,this.sideRect.y+this.sideRect.h/2,warPanelTexture(this,this.sideRect.w,this.sideRect.h)).setDisplaySize(this.sideRect.w+16,this.sideRect.h+16).setDepth(-1);
  // 底部导航
  const navY=D?H-36:H-128,navW=D?150:(W-44)/2,nav=(i:number,label:string,name:string,fn:()=>void,primary=false)=>{const x=D?20+navW/2+i*(navW+12):22+navW/2+(i%2)*(navW+0)+(i%2?0:0),y=D?navY:navY+Math.floor(i/2)*58;const b=homeCommand(this,D?x:(i%2?W-22-navW/2:22+navW/2),D?y:y,navW,D?42:48,label,primary,true,15);b.hit.setName(name).on('pointerdown',fn);};
  nav(0,'天下地图','city-map',()=>this.scene.start('WorldMapScene'));
  nav(1,'城池发展','city-focus',()=>this.openFocus());
  nav(2,'季度报告','city-report',()=>this.openReport());
  nav(3,'出征备战','city-expedition',()=>{this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter','huangjin');this.openPreparation();},true);
  if(D){const tax=homeCommand(this,W-20-navW/2,navY,navW,42,'',false,true,15);tax.hit.setName('city-tax').on('pointerdown',()=>this.openTax());this.taxCaption=tax.caption;}
  else{const tax=homeCommand(this,W-80,64,130,32,'',false,true,13);tax.hit.setName('city-tax').on('pointerdown',()=>this.openTax());this.taxCaption=tax.caption;}
  this.refresh();
  // 出征归来：有新的季度报告就自动弹出一次
  const t=loadWorld().town,key=t.report?`${t.report.year}-${t.report.season}`:'';if(key&&this.registry.get('townReportSeen')!==key){this.registry.set('townReportSeen',key);this.time.delayedCall(250,()=>this.openReport());}
 }
 private taxCaption?:Phaser.GameObjects.Text;
 private openPreparation(){if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}

 private refresh(){
  const s=loadWorld(),t=s.town;
  this.season.setText(`${seasonLabel(t.year,t.season)}（下一季）`);
  this.top.setText(`军功 ${s.merits}   粮草 ${s.provisions}   钱 ${t.money}`);
  this.taxCaption?.setText('税率 · '+TAX_NAME[t.tax]);
  this.drawMap();this.drawSide();
 }

 /** 12 块地：4×3。已开放地块可点；未开放显示“城墙扩地”。 */
 private drawMap(){
  this.map.removeAll(true);
  const s=loadWorld(),t=s.town,r=this.mapRect,open=unlockedPlots(t),cw=r.w/4,ch=r.h/3;
  for(let i=0;i<PLOT_COUNT;i++){
   const cx=r.x+cw*(i%4)+cw/2,cy=r.y+ch*Math.floor(i/4)+ch/2,pw=cw-22,ph=ch-24,p=t.plots[i],locked=i>=open,sel=i===this.selected;
   const g=this.add.graphics();
   g.fillStyle(locked?0x3a3328:p?0x857150:0x9c8a62,locked?.55:.9).fillRoundedRect(cx-pw/2,cy-ph/2,pw,ph,8);
   g.lineStyle(sel?3:1.5,sel?0xffd76a:locked?0x5a5040:0xc9ad74,sel?1:.8).strokeRoundedRect(cx-pw/2,cy-ph/2,pw,ph,8);
   this.map.add(g);
   if(locked){this.map.add(txt(this,cx,cy,'🔒\n城墙扩地',12,'#8a7f6a').setOrigin(.5).setAlign('center'));}
   else if(p){this.drawBuilding(p.id,p.level,cx,cy-8,pw,ph);this.map.add(txt(this,cx,cy+ph/2-14,`${TOWN_BUILDINGS[p.id].name} Lv${p.level}`,13,'#fff1cf').setOrigin(.5).setShadow(0,1,'#000',3,true,true));}
   else this.map.add(txt(this,cx,cy,'＋ 空地',14,'#f3e2b8').setOrigin(.5).setAlpha(.85));
   const hit=this.add.rectangle(cx,cy,pw,ph,0,0.001).setName(`plot-${i}`);
   if(!locked)hit.setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.selected=i;this.choice=null;this.message='';this.refresh();});
   if(sel)hit.setData('padDefault',true);
   this.map.add(hit);
  }
 }
 private drawBuilding(id:TownBuildingId,level:number,x:number,y:number,w:number,h:number){
  const key=`town_${id}_${level}`;
  if(this.textures.exists(key)){const img=this.add.image(x,y,key);const k=Math.min((w-6)/img.width,(h-26)/img.height);img.setScale(k);this.map.add(img);return;}
  const L=LOOK[id],g=this.add.graphics(),bw=Math.min(w*.62,70+level*8),bh=Math.min(h*.5,34+level*6);
  g.fillStyle(0x000000,.25).fillEllipse(x,y+bh/2+4,bw*1.15,12);
  g.fillStyle(L.wall,1).fillRect(x-bw/2,y-bh/2+10,bw,bh-10);
  for(let k=0;k<level;k++){const rw=bw*(1.18-k*.18),ry=y-bh/2+12-k*12;g.fillStyle(L.roof,1).fillTriangle(x-rw/2,ry,x+rw/2,ry,x,ry-14).fillRect(x-rw/2,ry-2,rw,4);}
  g.fillStyle(0x2a1d14,.9).fillRect(x-7,y+bh/2-16,14,16);
  this.map.add(g);
  this.map.add(this.add.circle(x+bw/2-8,y-bh/2+18,10,0x9a2a1e).setStrokeStyle(1.5,0xe8c98a));
  this.map.add(txt(this,x+bw/2-8,y-bh/2+18,L.mark,12,'#fbe9c9',HEADING_FONT).setOrigin(.5));
 }

 /** 右侧（手机为下方）详情：空地 → 建造列表；已有建筑 → 说明、升级、拆除。 */
 private drawSide(){
  this.side.removeAll(true);
  const s=loadWorld(),t=s.town,r=this.sideRect,p=t.plots[this.selected],x0=r.x+16,wrap=r.w-32,have={merits:s.merits,provisions:s.provisions,money:t.money};
  const add=<T extends Phaser.GameObjects.GameObject>(o:T)=>{this.side.add(o);return o;};
  let y=r.y+14;
  const line=(v:string,size=14,color='#e9dcc0')=>{const o=add(txt(this,x0,y,v,size,color).setWordWrapWidth(wrap));y+=o.height+6;return o;};
  if(!p){
   line(`空地 · 第 ${this.selected+1} 块`,18,'#f4d99f');line('选择要建造的建筑：',13,'#b9a98a');
   const rowH=D?25:Math.max(24,Math.min(30,(this.sideRect.h-120)/10));
   for(const id of BUILD_ORDER){
    const def=TOWN_BUILDINGS[id],full=countOf(t,id)>=def.max,afford=canAfford(have,def.build),on=this.choice===id;
    const row=add(txt(this,x0,y,`${on?'◆ ':''}${def.name}${def.max>1?`（${countOf(t,id)}/${def.max}）`:''}`,14,full?'#6f6658':on?'#ffe7a8':afford?'#efe2c4':'#a58f74'));
    add(txt(this,r.x+r.w-16,y,full?'已建满':costText(def.build),12,full?'#6f6658':afford?'#c9b98f':'#b0786a').setOrigin(1,0));
    const hit=add(this.add.rectangle(r.x+r.w/2,y+row.height/2,r.w-16,rowH-2,0xffffff,on?.08:.001).setName(`build-${id}`));
    if(!full)hit.setInteractive({useHandCursor:true}).on('pointerdown',()=>{this.choice=id;this.message='';this.drawSide();});
    y+=rowH;
   }
   if(this.choice){const def=TOWN_BUILDINGS[this.choice],by=r.y+r.h-28;add(txt(this,x0,by-26,def.effect(1),12,'#cfe0c8').setWordWrapWidth(wrap).setOrigin(0,1));
    const b=homeCommand(this,r.x+r.w/2,by,Math.min(220,r.w-40),38,'建造 '+def.name,true,canAfford(have,def.build),15);b.hit.setName('town-build').setData('padDefault',true).on('pointerdown',()=>this.act(townBuild(this.selected,this.choice!)));for(const o of [b.g,b.hit,b.caption])add(o);y+=50;}
  }else{
   const def=TOWN_BUILDINGS[p.id],next=upgradeCostFor(p.id,p.level);
   line(`${def.name} · Lv${p.level}`,19,'#f4d99f');line(def.effect(p.level),14);
   if(p.id==='house'||p.id==='market')line(`民户 ${households(t)} · ${TAX_NAME[t.tax]}每户 ${TAX_PER_HOUSEHOLD[t.tax]} 钱`,12,'#b9c9b2');
   if(next){y+=4;line('下一级：'+def.effect(p.level+1),13,'#cfe0c8');line('花费：'+costText(next),13,canAfford(have,next)?'#d9c58f':'#c98a76');}else line('已达最高等级',13,'#b9a98a');
   const by=r.y+r.h-(D?36:34),bw=Math.min(150,(r.w-48)/2);
   const up=homeCommand(this,r.x+r.w/2-bw/2-8,by,bw,40,next?'升级':'已满级',true,!!next&&canAfford(have,next),15);up.hit.setName('town-upgrade').setData('padDefault',true).on('pointerdown',()=>this.act(townUpgrade(this.selected)));
   const back=demolishRefund(p),dem=homeCommand(this,r.x+r.w/2+bw/2+8,by,bw,40,'拆除',false,p.id!=='barracks',15);dem.hit.setName('town-demolish').on('pointerdown',()=>{if(!dem.hit.getData('confirm')){dem.hit.setData('confirm',true);dem.caption.setText('确认拆除？');this.message='拆除返还 '+costText(back);this.drawMessage();return;}this.act(townDemolish(this.selected));});
   for(const o of [up.g,up.hit,up.caption,dem.g,dem.hit,dem.caption])add(o);
  }
  this.drawMessage();
 }
 private msgText?:Phaser.GameObjects.Text;
 private drawMessage(){this.msgText?.destroy();const r=this.sideRect,warn=storageUnavailable?(incompatibleSave?'存档版本较新，本次修改不会保存':'存储不可用，修改仅保留本次会话'):'';const v=[this.message,warn].filter(Boolean).join('\n');if(!v)return;this.msgText=txt(this,r.x+16,r.y+r.h-(D?78:76),v,12,'#e8c98a').setWordWrapWidth(r.w-32);this.side.add(this.msgText);}
 private act(res:{ok:boolean;message:string}){this.message=res.message;if(res.ok)this.choice=null;this.refresh();}

 // —— 弹窗：季度报告 / 税率 / 城池发展 ——
 private modal(name:string,title:string,h:number):{root:Phaser.GameObjects.Container;x:number;y:number;w:number}{
  this.children.getByName(name)?.destroy();
  const root=this.add.container(0,0).setDepth(600).setName(name),w=Math.min(D?640:W-24,W-24),y=(H-h)/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x0b0806,.78).setInteractive());
  root.add(this.add.image(W/2,H/2,warPanelTexture(this,w,h,true)).setDisplaySize(w+16,h+16));
  root.add(txt(this,W/2,y+30,title,22,'#efd399',HEADING_FONT).setOrigin(.5));
  const close=homeCommand(this,W/2,y+h-34,160,40,'返回',false,true,15);close.hit.setName(name+'-close').setData('padDefault',true).on('pointerdown',()=>{root.destroy();this.refresh();});root.add([close.g,close.hit,close.caption]);
  return{root,x:(W-w)/2,y,w};
 }
 private openReport(){
  const t=loadWorld().town,q=t.report,m=this.modal('town-report','季度报告',D?360:440);
  const body=q?[
   `${seasonLabel(q.year,q.season)}`,
   `农田产粮　+${q.grain} 粮${q.season===2?'（秋收 ×1.5）':q.season===3?'（冬 ×0.5）':''}`,
   `民户 ${q.households} · 税收　+${q.tax} 钱${levelOf(t,'market')?'':'（无市集，只收三成）'}`,
   `城池产出　军功 +${q.cityMerits} · 粮草 +${q.cityProvisions} · 钱 +${q.cityMoney}`,
   `军粮开销　−${q.upkeep} 粮${q.shortage?`　· 缺粮 ${q.shortage}`:''}`,
   '',`接下来：${seasonLabel(t.year,t.season)}`,
  ].join('\n'):'尚无季度报告。\n出征（战役、攻城、守城）结束、坚持 60 秒以上或获胜时，营寨过一季并在此结算。';
  m.root.add(txt(this,m.x+40,m.y+66,body,D?16:15,'#efe2c4').setLineSpacing(10).setWordWrapWidth(m.w-80).setName('town-report-body'));
 }
 private openTax(){
  const t=loadWorld().town,m=this.modal('town-tax','税率',D?330:420);
  m.root.add(txt(this,W/2,m.y+62,'税越重收钱越多；T3 起重税会招来流民、盗匪等坏事件。',13,'#c9bf99').setOrigin(.5).setWordWrapWidth(m.w-60).setAlign('center'));
  (['low','mid','high'] as TaxRate[]).forEach((rate,i)=>{
   const y=m.y+(D?120:120)+i*58,on=t.tax===rate,b=homeCommand(this,W/2,y,Math.min(360,m.w-60),46,`${TAX_NAME[rate]} · 每户 ${TAX_PER_HOUSEHOLD[rate]} 钱${on?'（当前）':''}`,on,true,15);
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
}
export {SEASONS};
