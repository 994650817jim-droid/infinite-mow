import {playMenuMusic} from '../systems/Music';
import {checkWorld} from '../systems/Achievements';
import {RENDER_SCALE,screenPoint} from '../config';
import {thirdChapterUnlocked,arcUnlocked} from '../world/WorldStore';
/** 群雄篇章节点：是否开放、未开放提示、进入的选关场景。 */
const CAMPAIGNS={qunxiong:{open:()=>thirdChapterUnlocked(),hint:'通关虎牢关后解锁',scene:'ThirdChapterScene'},guandu:{open:()=>arcUnlocked('guandu'),hint:'平定群雄割据后解锁',scene:'GuanduChapterScene'},chibi:{open:()=>arcUnlocked('chibi'),hint:'官渡之战告捷后解锁',scene:'ChibiChapterScene'}} as const;
import {isChapterTestRun} from '../systems/ChapterProgress';
import {worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {WORLD_NODES,type WorldNode} from '../world/WorldNodes';
import {loadWorld} from '../world/WorldStore';
import {FOCUS_INCOME,FOCUS_NAME,costText,type CityFocus} from '../town/TownData';
import {chapterUnlocked} from '../systems/ChapterProgress';
import {CITIES,CITY_LINKS,CITY_INCOME,FACTIONS,HOME,SPECIALTIES,TIER_NAME,cityAttackable,cityById,cityOwner,eraDef,eraIndexFor,territorySummary,type CityDef} from '../world/WorldCities';
import {cityMarker,factionLegend,markAlert,paintSelection,MARKER_FILES,type CityMarker} from '../world/WorldMapLayers';
import {buildTerritory} from '../world/WorldTerritory';
import {factionStrip,lacquerPlate,ownerSeal,realmLabels,resourceBar,sealGlyph} from '../world/WorldMapChrome';
import {advanceEra,takeLostNotice,takeNewChapters,type CityAlert,type EraAdvance} from '../world/WorldStore';
import {CHAPTER_TIMELINE,chapterStagesDone,currentChapter,type ChapterState,type TimelineChapterId} from '../world/ChapterTimeline';
import {defenseBossName} from '../data/siege';
import {SIEGE,FIRST_CAPTURE_BONUS,siegeBossName} from '../data/siege';
import {CHARACTERS,type CharacterId} from '../data/characters';

type Selection={kind:'node';node:WorldNode}|{kind:'city';city:CityDef};

/**
 * 天下地图：原画地图 + 势力领地染色 + 三档城池标记 + 战役节点。
 * W1：城池可查看归属、时代、相邻与可攻打状态；攻城战在 W2 开放。
 */
export class WorldMapScene extends Phaser.Scene {
 private layer!:Phaser.GameObjects.Container;private selected:Selection={kind:'node',node:WORLD_NODES[0]};private detail!:Phaser.GameObjects.Text;private detailTitle!:Phaser.GameObjects.Text;private detailRule!:Phaser.GameObjects.Graphics;private seal!:ReturnType<typeof ownerSeal>;private detailBox={x:0,y:0,w:0};private action!:ReturnType<typeof worldButton>;
 private markers:Array<{node:WorldNode;root:Phaser.GameObjects.Container}>=[];private cityMarkers:CityMarker[]=[];private links!:Phaser.GameObjects.Graphics;private legend?:Phaser.GameObjects.Container;
 private era:1|2|3=1;private owned:string[]=[];private capturedEver:string[]=[];private siegeModal?:Phaser.GameObjects.Container;private territory?:Phaser.GameObjects.Container;private alerts:CityAlert[]=[];private notice?:Phaser.GameObjects.Container;
 /** 章节时间线条（地图下方）：按史事顺序的五章，点选即聚焦对应战役节点。 */
 private chips:Array<{id:TimelineChapterId;node:WorldNode;g:Phaser.GameObjects.Graphics;x:number;y:number;w:number;h:number;state:ChapterState}>=[];
 private area={x:20,y:110,w:W-40,h:H-360};private minZoom=1;private zoom=1;private pointerX=0;private pointerY=0;private pinch=0;private pinching=false;private readonly mapW=1536;private readonly mapH=1024;
 constructor(){super('WorldMapScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'strategy_art','assets/world/strategy-map.webp');
  // W5 城池徽框与军旗（缩小显示，用线性过滤）
  for(const [key,url] of Object.entries(MARKER_FILES))worldAssets(this,key,url);
  this.load.once('complete',()=>{for(const key of Object.keys(MARKER_FILES))if(this.textures.exists(key))this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);});}
 create(){playMenuMusic(this);try{checkWorld(loadWorld());}catch{/* 存档不可用 */}
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}worldShell(this,this.registry.get('worldReveal')?'三国天下开启':'三国天下');if(this.registry.get('worldReveal')){this.registry.remove('worldReveal');this.cameras.main.fadeIn(900,0,0,0);}releaseWorldArt(this,'strategy_art');this.markers=[];this.cityMarkers=[];this.legend=undefined;
  this.siegeModal=undefined;this.territory=undefined;this.notice=undefined;const advance=isChapterTestRun()?null:advanceEra(),lost=isChapterTestRun()?[]:takeLostNotice();const s=loadWorld();this.owned=s.ownedCities;this.alerts=s.alerts;this.capturedEver=s.capturedEver;this.era=eraIndexFor({hulaoCleared:s.cleared.hulao,warlordStages:s.warlordStages,guanduStages:s.guanduStages});
  const desktop=W>600;
  // 顶部资源栏（军功 / 粮草 / 城池），漆底描金
  resourceBar(this,desktop?190:24,desktop?40:88,[{glyph:'功',label:'军功',value:s.merits,tint:0x8e2a1e},{glyph:'粮',label:'粮草',value:s.provisions,tint:0x7a5a22},{glyph:'城',label:'城池',value:this.owned.length,tint:0x2f6b45}],desktop);
  worldButton(this,W-105,desktop?40:43,'返回主城',()=>this.scene.start('CityScene'),150);
  // 地图下方留出章节时间线一行（电脑 40 / 手机 54 高）
  this.area=desktop?{x:20,y:72,w:W-40,h:H-72-152-50}:{x:20,y:118,w:W-40,h:H-118-318-70};
  this.layer=this.add.container(0,0);this.layer.add(this.add.image(0,0,'strategy_art').setOrigin(0).setDisplaySize(this.mapW,this.mapH));
  // 势力范围：加权分区疆域 + 国界 / 郡界 + 疆域大字（随地图缩放）
  const realm=buildTerritory(this,this.era,this.owned);this.layer.add(this.add.image(0,0,realm.key).setOrigin(0).setDisplaySize(this.mapW,this.mapH).setName('world-realm'));
  this.layer.add(realmLabels(this,realm.labels));
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.area.x,this.area.y,this.area.w,this.area.h);
  this.layer.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());
  // 选中城池时显示其道路相邻（屏幕坐标）
  this.links=this.add.graphics();this.links.setMask(mask.createGeometryMask());
  for(const city of CITIES){const m=cityMarker(this,city,cityOwner(city.id,this.era,this.owned));m.hit.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'city',city};this.refresh();});if(this.alertFor(city.id))markAlert(this,m);this.cityMarkers.push(m);}
  const current=currentChapter(s).id;
  for(const node of WORLD_NODES){const st=this.nodeState(node),active=st!=='locked',info=this.chapterOf(node),color=st==='home'?0x88c5a4:st==='cleared'?0x9fd18a:active?0xe5c47d:0x747a6f;
   const marker=this.add.container(0,0);
   // 当前该打的一章：金色脉冲圈
   if(st==='open'&&info?.id===current){const ring=this.add.circle(0,0,18).setStrokeStyle(3,0xffd27a,.9).setName(`node-pulse-${node.id}`);marker.add(ring);this.tweens.add({targets:ring,scale:1.8,alpha:0,duration:1300,repeat:-1,ease:'Sine.easeOut'});}
   const circle=this.add.circle(0,0,18,st==='cleared'?0x3a2a12:0x16271e,.94).setStrokeStyle(2,color).setInteractive({useHandCursor:true}).setName(`node-${node.id}`).setData('state',st);
   const icon=worldText(this,0,0,st==='home'?'营':st==='cleared'?'捷':active?'战':'锁',13,st==='cleared'?'#ffe7a8':active?'#f5dc9e':'#a4aa9c').setOrigin(.5);
   const label=worldText(this,0,25,info?`${info.numeral} · ${node.name}`:node.name,13,active?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   circle.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'node',node};this.refresh();});marker.add([circle,icon,label]);this.markers.push({node,root:marker});
  }
  this.minZoom=Math.max(this.area.w/this.mapW,this.area.h/this.mapH);this.zoom=this.minZoom*1.2;
  this.layer.setScale(this.zoom).setPosition(W/2-this.mapW*.52*this.zoom,this.area.y+this.area.h/2-this.mapH*.45*this.zoom);this.clampMap();
  const inside=(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);return p.x>=this.area.x&&p.x<=this.area.x+this.area.w&&p.y>=this.area.y&&p.y<=this.area.y+this.area.h;};
  this.input.on('pointerdown',(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);this.pointerX=p.x;this.pointerY=p.y;this.pinch=0;this.pinching=false;});
  this.input.on('pointermove',(q:Phaser.Input.Pointer)=>{if(!q.isDown||!inside(q))return;const p=screenPoint(q),a=this.input.manager.pointers.filter(o=>o.isDown&&inside(o)).map(screenPoint);if(a.length>=2){this.pinching=true;const distance=Phaser.Math.Distance.Between(a[0].x,a[0].y,a[1].x,a[1].y);if(this.pinch>0)this.setZoom(this.zoom*distance/this.pinch,(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2);this.pinch=distance;}else{this.pinch=0;this.layer.x+=p.x-this.pointerX;this.layer.y+=p.y-this.pointerY;this.clampMap();}this.pointerX=p.x;this.pointerY=p.y;});
  this.input.on('wheel',(q:Phaser.Input.Pointer,_objs:unknown,_dx:number,dy:number)=>{const p=screenPoint(q);if(inside(q))this.setZoom(this.zoom*(dy>0?.9:1.1),p.x,p.y);});
  // 地图外框：描金细线
  const frame=this.add.graphics();frame.lineStyle(2,0xc9a35e,.9).strokeRect(this.area.x-1,this.area.y-1,this.area.w+2,this.area.h+2).lineStyle(1,0x000000,.6).strokeRect(this.area.x-4,this.area.y-4,this.area.w+8,this.area.h+8);
  // 详情面板：漆底描金 + 势力旗印 + 标题 / 势力色分隔线 / 正文
  const ph=desktop?138:262,py=desktop?H-8-ph/2:H-42-ph/2,top=py-ph/2;
  const plate=this.add.graphics();lacquerPlate(plate,20,top,W-40,ph,.94);
  const sealSize=desktop?54:58;this.seal=ownerSeal(this,desktop?52+sealSize/2-8:W-40-sealSize/2-14,desktop?py-14:top+sealSize/2+14,sealSize);
  const tx=desktop?52+sealSize+8:40;this.detailBox={x:tx,y:top,w:desktop?W-tx-260:W-80-sealSize-16};
  this.detailTitle=worldText(this,tx,top+12,'',desktop?20:22,'#f6dc9a').setName('world-detail-title');
  this.detailRule=this.add.graphics();
  this.detail=worldText(this,tx,top+(desktop?44:50),'',desktop?13:15,'#e4dcc4').setWordWrapWidth(desktop?W-tx-250:W-80).setLineSpacing(desktop?2:4);
  this.action=worldButton(this,desktop?W-140:W/2,desktop?py:H-42-40,'进入主城',()=>{if(this.selected.kind==='city')this.openSiege(this.selected.city,!!this.alertFor(this.selected.city.id));else this.enterNode();},desktop?190:W-100);this.action.image.setName('map-action');
  worldButton(this,W-55,this.area.y+35,'＋',()=>this.setZoom(this.zoom*1.2,W/2,this.area.y+this.area.h/2),48);
  worldButton(this,W-55,this.area.y+107,'－',()=>this.setZoom(this.zoom/1.2,W/2,this.area.y+this.area.h/2),48);
  // 年号与时代：点击展开势力图例
  // 讨董之前：年号显示为讨董前夕（时代领地沿用初平年间格局）
  const era=eraDef(this.era),preDong=!s.cleared.hulao,chipG=this.add.graphics(),chip=worldText(this,this.area.x+12,this.area.y+12,preDong?'公元190年 · 讨董前夕  ▾':`公元${era.year}年 · ${era.name}  ▾`,desktop?15:16,'#f6dc9a').setPadding(12,7).setInteractive({useHandCursor:true}).setName('world-era');
  chip.on('pointerup',()=>this.toggleLegend());
  // 领地：城池数、每次出征产出、生效特产
  const land=worldText(this,chip.x+chip.width+8,chip.y,`领地 ${this.owned.length}  ▾`,desktop?15:16,'#bff0c8').setPadding(12,7).setInteractive({useHandCursor:true}).setName('world-territory');
  land.on('pointerup',()=>this.toggleTerritory());
  lacquerPlate(chipG,chip.x,chip.y,chip.width,chip.height,.9);lacquerPlate(chipG,land.x,land.y,land.width,land.height,.9,0x7fc48f);chipG.setDepth(chip.depth);chip.setDepth(1);land.setDepth(1);
  // 底边：势力排行（按城池数）+ 操作提示
  factionStrip(this,this.area.x+10,this.area.y+this.area.h-(desktop?24:26),Math.min(this.area.w-20,desktop?620:this.area.w-20),this.era,this.owned,desktop);
  worldText(this,desktop?this.area.x+this.area.w-12:this.area.x+14,this.area.y+this.area.h-(desktop?24:54),'拖动查看 · 滚轮/双指缩放 · 点城池查看',11,'#fff0cf').setOrigin(desktop?1:0,.5).setStroke('#15261c',3);
  // 攻城归来：选中并居中该城
  const focus=cityById(String(this.registry.get('mapFocusCity')??''));this.registry.remove('mapFocusCity');
  if(focus){this.selected={kind:'city',city:focus};this.layer.setPosition(this.area.x+this.area.w/2-focus.x*this.zoom,this.area.y+this.area.h/2-focus.y*this.zoom);this.clampMap();}
  // 章节时间线；战役告捷归来聚焦新章节，否则默认选中当前该打的一章
  this.buildTimeline(desktop);
  const focusNode=WORLD_NODES.find(n=>n.id===this.registry.get('mapFocusNode'));this.registry.remove('mapFocusNode');
  if(!focus){const pick=focusNode??WORLD_NODES.find(n=>this.chapterOf(n)?.id===current);if(pick)this.selected={kind:'node',node:pick};if(focusNode)this.centerOn(focusNode);}
  this.refresh();
  const fresh=isChapterTestRun()?0:takeNewChapters();
  if(fresh>0)this.unlockBanner();
  if(advance||lost.length)this.showNotice(advance,lost);
 }
 private alertFor(id:string){return this.alerts.find(a=>a.city===id);}
 private chapterOf(node:WorldNode){const id=node.chapter??node.campaign;return CHAPTER_TIMELINE.find(c=>c.id===id);}
 /** 节点状态：营寨 / 已平定 / 已开放 / 未解锁。开放判定沿用原规则（ChapterProgress / arcUnlocked）。 */
 private nodeState(node:WorldNode):'home'|ChapterState{if(node.kind==='home')return 'home';if(node.kind==='future')return 'locked';const info=this.chapterOf(node);if(info&&chapterStagesDone(info.id,loadWorld())>=3)return 'cleared';const open=node.campaign?CAMPAIGNS[node.campaign].open()||isChapterTestRun():!!node.chapter&&chapterUnlocked(node.chapter);return open?'open':'locked';}
 private centerOn(node:WorldNode){this.layer.setPosition(this.area.x+this.area.w/2-node.x*this.mapW*this.zoom,this.area.y+this.area.h/2-node.y*this.mapH*this.zoom);this.clampMap();}
 /** 章节时间线条：壹 黄巾 → 贰 讨董 → 叁 群雄 → 肆 官渡 → 伍 赤壁，显示年份与状态。 */
 private buildTimeline(desktop:boolean){
  this.chips=[];const s=loadWorld(),y=this.area.y+this.area.h+(desktop?6:10),h=desktop?40:54,gap=desktop?14:8,n=CHAPTER_TIMELINE.length,w=(this.area.w-gap*(n-1))/n;
  const line=this.add.graphics().setName('chapter-timeline');line.lineStyle(2,0xc9a35e,.5).lineBetween(this.area.x+w/2,y+h/2,this.area.x+this.area.w-w/2,y+h/2);
  CHAPTER_TIMELINE.forEach((c,i)=>{const node=WORLD_NODES.find(x=>this.chapterOf(x)?.id===c.id);if(!node)return;const st=this.nodeState(node) as ChapterState,x=this.area.x+i*(w+gap),done=chapterStagesDone(c.id,s);
   const g=this.add.graphics();this.chips.push({id:c.id,node,g,x,y,w,h,state:st});
   const status=st==='cleared'?'✓ 已平定':st==='open'?(done?`进行中 ${done}/3`:'可出征'):'未解锁';
   worldText(this,x+w/2,y+(desktop?13:17),`${c.numeral} ${c.title}`,14,st==='locked'?'#a4a79b':'#f6e3b4').setOrigin(.5).setName(`chapter-chip-title-${c.id}`);
   worldText(this,x+w/2,y+(desktop?30:39),`${c.year}年 · ${status}`,11,st==='cleared'?'#bfe3a6':st==='open'?'#ffd98a':'#9a9d92').setOrigin(.5).setName(`chapter-chip-status-${c.id}`);
   this.add.rectangle(x+w/2,y+h/2,w,h,0x000000,.001).setInteractive({useHandCursor:true}).setName(`chapter-chip-${c.id}`).setData('state',st).on('pointerup',()=>{this.selected={kind:'node',node};this.centerOn(node);this.refresh();});
  });
 }
 private paintChips(){const sel=this.selected.kind==='node'?this.chapterOf(this.selected.node)?.id:undefined;
  for(const c of this.chips){c.g.clear();lacquerPlate(c.g,c.x,c.y,c.w,c.h,.94,c.state==='cleared'?0x7fc48f:c.state==='open'?0xe5c47d:0x6b6f66);if(c.id===sel)c.g.lineStyle(2,0xffe2a0,1).strokeRoundedRect(c.x-2,c.y-2,c.w+4,c.h+4,7);}}
 /** 新篇解锁横幅：地图上方淡入淡出。 */
 private unlockBanner(){const c=currentChapter(loadWorld()),y=this.area.y+70,root=this.add.container(W/2,y).setDepth(40).setName('chapter-unlock-banner');
  const t=worldText(this,0,0,`新篇解锁 · 第${c.numeral}章「${c.title}」`,W>600?20:22,'#ffe2a0').setOrigin(.5).setStroke('#1b120b',4);
  const g=this.add.graphics();lacquerPlate(g,-t.width/2-26,-t.height/2-10,t.width+52,t.height+20,.95,0xe5c47d);root.add([g,t]);root.setAlpha(0);
  this.tweens.add({targets:root,alpha:1,duration:450,hold:2400,yoyo:true,onComplete:()=>root.destroy()});}
 /** 有告急城池时出征别处的警示（空串表示无告急）。 */
 private lossWarning(){const names=this.alerts.map(a=>cityById(a.city)?.name).filter(Boolean);return names.length?`⚠ ${names.join('、')}告急：此时出征别处，${names.length>1?'这些城池':'该城'}将失守！`:'';}
 /** W4 时局变化 / 城池失守 提示面板。 */
 private showNotice(advance:EraAdvance|null,lost:string[]){
  const desk=W>600,pw=Math.min(W-40,540),root=this.add.container(0,0).setDepth(70).setName('era-modal');this.notice=root;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x07100b,.78).setInteractive());
  const lines:string[]=[];let title='城池失守';
  if(advance){const e=eraDef(advance.to);title=`时局变化 · 公元${e.year}年`;lines.push(`【${e.name}】${e.summary}`);
   const moved=advance.changes.map(c=>`${cityById(c.city)?.name}：${FACTIONS[c.from].name} → ${FACTIONS[c.to].name}`);
   if(moved.length)lines.push('城池易主：'+(moved.length>8?moved.slice(0,8).join('；')+`；等 ${moved.length} 城`:moved.join('；')));
   if(advance.fallen.length)lines.push('势力覆灭：'+advance.fallen.map(f=>FACTIONS[f].name).join('、'));
   lines.push(advance.alerts.length?'边城告急：'+advance.alerts.map(a=>`${cityById(a.city)?.name}（${FACTIONS[a.attacker].name}来犯）`).join('、')+'\n点选告急城池即可守城；若出征别处，告急城池将失守。':'我方城池暂无战事。');}
  if(lost.length)lines.push(`上次出征时告急未救，${lost.map(id=>cityById(id)?.name).join('、')}已失守。`);
  const text=worldText(this,0,0,lines.join('\n\n'),desk?15:16,'#e4dcc4').setWordWrapWidth(pw-48,true).setLineSpacing(5);
  const ph=Math.min(H-80,text.height+150),px=W/2-pw/2,py=H/2-ph/2;root.add(panel(this,W/2,H/2,pw,ph));
  root.add(worldText(this,px+24,py+20,title,24,'#f0d79e'));text.setPosition(px+24,py+64);root.add(text);
  const ok=worldButton(this,W/2,py+ph-(desk?44:54),'知道了',()=>{root.destroy();this.notice=undefined;},pw*.5);ok.image.setName('era-ok');root.add([ok.image,ok.text]);
 }
 private toggleLegend(){
  this.territory?.destroy();this.territory=undefined;
  if(this.legend){this.legend.destroy();this.legend=undefined;return;}
  // 留出右侧缩放按钮
  const w=Math.min(this.area.w-24-76,520),era=eraDef(this.era);
  this.legend=factionLegend(this,this.area.x+12,this.area.y+52,this.era,this.owned,w).setDepth(20);
  const box=this.legend.list[0] as Phaser.GameObjects.Rectangle;
  const summary=worldText(this,12,box.height+6,era.summary,13,'#d6cdb4').setWordWrapWidth(w-24);
  box.setSize(w,box.height+summary.height+14);this.legend.add(summary);
 }
/** 领地面板：城池数（大/中/小）、每次出征产出合计、生效的大城特产与城池列表。 */
 private toggleTerritory(){
  this.legend?.destroy();this.legend=undefined;
  if(this.territory){this.territory.destroy();this.territory=undefined;return;}
  const w=Math.min(this.area.w-24-76,520),sum=territorySummary(this.owned),root=this.add.container(this.area.x+12,this.area.y+52).setDepth(20).setName('territory-panel');
  const lines=this.owned.length?[
   `我方城池 ${this.owned.length} 座 · 大城 ${sum.counts.large} / 中城 ${sum.counts.medium} / 小城 ${sum.counts.small}`,
   (()=>{const focus=loadWorld().town.focus,t={merits:0,provisions:0,money:0};for(const id of this.owned){const c=cityById(id);if(!c)continue;const inc=FOCUS_INCOME[c.tier][(focus[id]??'balanced') as CityFocus];t.merits+=inc.merits;t.provisions+=inc.provisions;t.money+=inc.money;}return `每季产出（按各城发展方向）：${costText(t)}`;})(),
   sum.specialties.length?'大城特产：\n'+sum.specialties.map(x=>`· ${x.city.name}「${x.specialty.title}」${x.specialty.text}`).join('\n'):'大城特产：尚无（攻占大城可获得永久加成）',
   '城池：'+this.owned.map(id=>cityById(id)?.name).filter(Boolean).join('、'),
  ]:['尚无城池。','攻下与营寨相邻的城池（许昌、汝南、官渡）后，每次出征结算都会获得城池产出；攻占大城还有永久特产加成。'];
  const text=worldText(this,12,10,lines.join('\n'),14,'#d6e6d0').setWordWrapWidth(w-24).setLineSpacing(5);
  root.add([this.add.rectangle(0,0,w,text.height+20,0x0f1c15,.95).setOrigin(0).setStrokeStyle(1,0x7fc48f,.7),text]);this.territory=root;
 }
 private setZoom(next:number,x:number,y:number){const z=Phaser.Math.Clamp(next,this.minZoom,this.minZoom*2.7),ratio=z/this.zoom;this.layer.x=x-(x-this.layer.x)*ratio;this.layer.y=y-(y-this.layer.y)*ratio;this.zoom=z;this.layer.setScale(z);this.clampMap();}
 private toScreen(mx:number,my:number){return{x:this.layer.x+mx*this.zoom,y:this.layer.y+my*this.zoom};}
 private clampMap(){const a=this.area;this.layer.x=Phaser.Math.Clamp(this.layer.x,a.x+a.w-this.mapW*this.zoom,a.x);this.layer.y=Phaser.Math.Clamp(this.layer.y,a.y+a.h-this.mapH*this.zoom,a.y);
  const visible=(x:number,y:number)=>x>a.x+14&&x<a.x+a.w-14&&y>a.y+14&&y<a.y+a.h-30;
  for(const m of this.markers){const x=this.layer.x+m.node.x*this.mapW*this.zoom,y=this.layer.y+m.node.y*this.mapH*this.zoom;m.root.setPosition(x,y).setVisible(visible(x,y));}
  // 小城名字在放大后才显示，避免默认视图拥挤
  const showSmall=this.zoom>=this.minZoom*1.65;
  // 军旗高出徽框，靠近地图上沿时整个标记隐藏，免得旗子伸出地图框
  for(const m of this.cityMarkers){const p=this.toScreen(m.city.x,m.city.y),flag=m.root.getData('banner')?m.outer+40:m.top;m.root.setPosition(p.x,p.y).setVisible(visible(p.x,p.y)&&p.y-flag>a.y);m.label.setVisible(m.city.tier!=='small'||showSmall||this.isSelected(m.city));}
  this.drawLinks();
 }
 private isSelected(city:CityDef){return this.selected.kind==='city'&&this.selected.city.id===city.id;}
 private drawLinks(){
  this.links.clear();if(this.selected.kind!=='city')return;
  const from=this.selected.city,p=this.toScreen(from.x,from.y);
  for(const id of CITY_LINKS.get(from.id)??[]){const to=id===HOME.id?HOME:cityById(id)!,q=this.toScreen(to.x,to.y);
   // 虚线
   const len=Math.hypot(q.x-p.x,q.y-p.y),n=Math.max(1,Math.floor(len/10));this.links.lineStyle(2,0xffe9a8,.85);
   for(let i=0;i<n;i+=2){const t0=i/n,t1=Math.min(1,(i+1)/n);this.links.lineBetween(p.x+(q.x-p.x)*t0,p.y+(q.y-p.y)*t0,p.x+(q.x-p.x)*t1,p.y+(q.y-p.y)*t1);}
  }
 }
 /** 详情面板：标题 + 势力色分隔线 + 正文 + 旗印。 */
 private setDetail(title:string,color:number,glyph:string,body:string){
  this.detailTitle.setText(title);this.seal.set(color,glyph);
  const y=this.detailTitle.y+this.detailTitle.height+4,w=Math.min(this.detailBox.w,Math.max(this.detailTitle.width+60,300));
  this.detailRule.clear().fillStyle(color,1).fillRect(this.detailTitle.x,y,w*.35,2).fillStyle(0xc9a35e,.55).fillRect(this.detailTitle.x+w*.35,y+.5,w*.65,1);
  this.detail.setText(body);
 }
 private refresh(){
  for(const m of this.cityMarkers)paintSelection(m,this.isSelected(m.city));this.clampMap();this.paintChips();
  if(this.selected.kind==='city'){
   const c=this.selected.city,owner=cityOwner(c.id,this.era,this.owned),era=eraDef(this.era),attack=cityAttackable(c.id,this.owned);
   const neighbors=[...(CITY_LINKS.get(c.id)??[])].map(id=>id===HOME.id?'义军营寨':cityById(id)!.name).join('、');
   const focus=(loadWorld().town.focus[c.id]??'balanced') as CityFocus,inc=FOCUS_INCOME[c.tier][owner==='player'?focus:'balanced'],sp=SPECIALTIES[c.id],yieldText=`${owner==='player'?`产出（${FOCUS_NAME[focus]}，主城「城池发展」可改）`:'占领后产出'}：每季 ${costText(inc)}${sp?` · 特产「${sp.title}」${sp.text}`:''}`;
   // 讨董之前天下未乱：先按章节推进，通关第二章后开放攻城
   const alert=this.alertFor(c.id),gate=!loadWorld().cleared.hulao&&!isChapterTestRun()&&!alert&&owner!=='player',usable=(attack||!!alert)&&!gate,warn=attack?this.lossWarning():'';
   this.setDetail(`${c.name} · ${TIER_NAME[c.tier]} · ${c.region}`,FACTIONS[owner].color,sealGlyph(owner),`归属：${FACTIONS[owner].name}（公元${era.year}年 · ${era.name}）\n${alert?`告急：${FACTIONS[alert.attacker].name}来犯！守住可解除；出征别处则此城失守`:owner==='player'?'你的城池':gate?'讨董之前诸侯未分：通关第二章「讨伐董卓」后开放攻城':attack?warn||'与你的领地相邻，可以攻打':'尚不相邻：先攻下相邻城池'}\n${yieldText}\n相邻：${neighbors}`);
   this.action.text.setText(alert?'守城 · 选择武将':owner==='player'?'我方城池':gate?'讨董后开放攻城':attack?'攻城 · 选择武将':'尚不可攻打');this.action.image.setAlpha(usable?1:.45);if(usable)this.action.image.setInteractive({useHandCursor:true});else this.action.image.disableInteractive();
   return;
  }
  const n=this.selected.node,st=this.nodeState(n),locked=st==='locked',info=this.chapterOf(n),save=loadWorld(),done=info?chapterStagesDone(info.id,save):0;
  if(n.kind==='home'||!info){const next=currentChapter(save),cleared=CHAPTER_TIMELINE.filter(c=>chapterStagesDone(c.id,save)>=3).length;this.setDetail(n.name,FACTIONS.player.color,n.kind==='home'?'营':'锁',`${n.region} · ${n.kind==='home'?'玩家领地':'地区开发中'}\n从义军营寨出发，建设后再次出征。\n章节进度 ${cleared}/${CHAPTER_TIMELINE.length} · ${cleared>=CHAPTER_TIMELINE.length?'诸章皆已平定':`下一章：第${next.numeral}章「${next.title}」`}`);}
  else{const status=locked?`未解锁：${info.hint}`:st==='cleared'?'已平定（3/3 关）· 可再次出征重温战役':done?`进行中：已过 ${done}/3 关`:'已开放：可出征';
   this.setDetail(`第${info.numeral}章 · ${n.name}`,st==='cleared'?0x5f8f4e:locked?0x4a4f46:0x8e2a1e,st==='cleared'?'捷':locked?'锁':'战',`公元${info.year}年（${info.era}） · ${n.region}\n${status}\n${locked?'按史事时序逐章解锁。':this.lossWarning()||'战斗军粮为单局资源，战后另结算永久资源。'}`);}
  this.action.text.setText(locked?'尚未解锁':n.kind==='home'?'进入主城':st==='cleared'?'重温 · 选择武将':'选择武将 · 出征');this.action.image.setAlpha(locked?.45:1);if(locked)this.action.image.disableInteractive();else this.action.image.setInteractive({useHandCursor:true});}
/** 攻城出征面板：守军、时长、胜利条件、奖励，选择武将后出征。 */
 private openSiege(city:CityDef,defense=false){
  const alert=defense?this.alertFor(city.id):undefined;
  if(this.siegeModal||(defense?!alert:!cityAttackable(city.id,this.owned)))return;
  const warn=alert?'':this.lossWarning(),dy=warn?(W>600?36:54):0;
  const owner=alert?alert.attacker:cityOwner(city.id,this.era,this.owned),T=SIEGE[city.tier],first=!this.capturedEver.includes(city.id),k=first?1+FIRST_CAPTURE_BONUS:1,desk=W>600;
  let hero:CharacterId='zhaoyun';try{const saved=localStorage.getItem('im_last_hero');if(CHARACTERS.some(c=>c.id===saved))hero=saved as CharacterId;}catch{/* storage unavailable */}
  const root=this.add.container(0,0).setDepth(60).setName('siege-modal');this.siegeModal=root;
  const pw=Math.min(W-40,520),ph=(desk?400:560)+dy,px=W/2-pw/2,py=H/2-ph/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x07100b,.72).setInteractive());
  root.add(panel(this,W/2,H/2,pw,ph));
  const t=(x:number,y:number,s:string,size=16,color='#ede3c9')=>{const o=worldText(this,x,y,s,size,color);root.add(o);return o;};
  t(px+24,py+20,`${alert?'守卫':'攻打'} ${city.name}`,24,'#f0d79e');t(px+24,py+54,`${TIER_NAME[city.tier]} · ${city.region} · ${alert?'来犯':'守军'}：${FACTIONS[owner].name}`,14,FACTIONS[owner].css);
  const how=city.tier==='small'?'清剿守军两波，击败县尉（约 2 分钟）':city.tier==='medium'?'三波守军后击败守将（约 3 分钟）':'四波守军；先破城门（限时），再战大将（约 4 分钟）';
  const body=alert?`胜利条件：击退${city.tier==='small'?'两':city.tier==='medium'?'三':'四'}波来犯之敌，击败敌将（无城门）
敌将：${defenseBossName(city,owner)}
守城奖励：军功 +${Math.round(T.reward.merits/2)} · 粮草 +${Math.round(T.reward.provisions/2)}，告急解除
失败城池仍在，可再守；改去别处出征则此城失守。`:`胜利条件：${how}
守将：${siegeBossName(city,owner)}
占领奖励：军功 +${Math.round(T.reward.merits*k)} · 粮草 +${Math.round(T.reward.provisions*k)}${first?'（首次攻占 +50%）':''}
失败不损失城池与资源，可再次攻打。`;
  const info=t(px+24,py+86,body,14,'#d6cdb4').setLineSpacing(6).setWordWrapWidth(pw-48);
  if(warn)t(px+24,info.y+info.height+4,warn,13,'#ff8a70').setWordWrapWidth(pw-48).setName('siege-warning');
  t(px+24,py+dy+(desk?214:236),'出战武将',13,'#b6a07b');
  const btns:Phaser.GameObjects.Rectangle[]=[];const bw=(pw-48-6*(CHARACTERS.length-1))/CHARACTERS.length,by=py+dy+(desk?256:282);
  const paint=()=>btns.forEach((b,i)=>b.setFillStyle(CHARACTERS[i].id===hero?0x51402b:0x241e1a).setStrokeStyle(1,CHARACTERS[i].id===hero?0xd7b778:0x70604b));
  CHARACTERS.forEach((c,i)=>{const x=px+24+i*(bw+6)+bw/2;const b=this.add.rectangle(x,by,bw,desk?42:54,0x241e1a,.96).setInteractive({useHandCursor:true}).setName('siege-hero-'+c.id);b.on('pointerup',()=>{hero=c.id;paint();});btns.push(b);root.add(b);const l=worldText(this,x,by,c.name,16,'#d1c2a7').setOrigin(.5);root.add(l);});paint();
  const close=()=>{root.destroy();this.siegeModal=undefined;};
  const cancel=worldButton(this,px+pw*.27,py+ph-(desk?48:58),'返回',close,pw*.38);cancel.image.setName('siege-cancel');root.add([cancel.image,cancel.text]);
  const go=worldButton(this,px+pw*.73,py+ph-(desk?48:58),alert?'出征守城':'出征攻城',()=>this.launchSiege(city,hero,!!alert),pw*.38);go.image.setName('siege-go');root.add([go.image,go.text]);
 }
 private launchSiege(city:CityDef,hero:CharacterId,defense=false){
  if(!isChapterTestRun())try{localStorage.setItem('im_last_hero',hero);}catch{/* storage unavailable */}
  this.registry.remove('campaignTransfer');this.registry.set('siegeCity',city.id);if(defense)this.registry.set('siegeMode','defense');else this.registry.remove('siegeMode');this.registry.set('runConfig',{character:hero});
  if(this.registry.get('battleReady'))this.scene.start('SiegeGameScene');else{this.registry.set('pendingWarlord','SiegeGameScene');this.registry.set('loadBattle',true);this.scene.start('BootScene');}
 }
 private enterNode(){if(this.selected.kind!=='node')return;const n=this.selected.node;if(n.campaign){const c=CAMPAIGNS[n.campaign];if(c.open()||isChapterTestRun())this.scene.start(c.scene);return;}if(n.kind==='home'){this.scene.start('CityScene');return;}if(!n.chapter||!chapterUnlocked(n.chapter))return;this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter',n.chapter);if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
}
