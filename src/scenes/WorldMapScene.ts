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
import {CITIES,CITY_LINKS,CITY_INCOME,FACTIONS,HOME,SPECIALTIES,TIER_NAME,cityAttackable,cityById,cityOwner,eraDef,eraIndexFor,territorySummary,type CityDef,type EraId} from '../world/WorldCities';
import {cityMarker,factionLegend,markAlert,paintSelection,MARKER_FILES,type CityMarker} from '../world/WorldMapLayers';
import {CITY_ART_FILES,MARKERS_V2,cityMarkerV2,siegeArtV2,intelGlyphPos,intelPennant,nodeMarkerV2,paintSelectionV2,sealGraphics} from '../world/WorldMarkers';
import {buildTerritory} from '../world/WorldTerritory';
import {factionStrip,lacquerPlate,ownerSeal,realmLabels,resourceBar,sealGlyph} from '../world/WorldMapChrome';
import {advanceEra,takeLostNotice,takeNewChapters,type CityAlert,type EraAdvance} from '../world/WorldStore';
import {CHAPTER_TIMELINE,CHAPTER_REGIONS,CITY_CHAPTER,STAGE_POINTS,chapterById,chapterIntro,chapterStages,chapterState,chapterStagesDone,citySiegeOpen,currentChapter,stageOpen,type ChapterState,type TimelineChapterId} from '../world/ChapterTimeline';
import {HARD_MODE,HARD_TITLES} from '../data/hardMode';
import {hardChapterCleared} from '../world/WorldStore';
import {defenseBossName} from '../data/siege';
import {SIEGE,FIRST_CAPTURE_BONUS,siegeBossName} from '../data/siege';
import {CHARACTERS,type CharacterId} from '../data/characters';
import {ensureIntel,intelEvents} from '../world/WorldStore';
import {INTEL_INFO,intelBrief,intelReward,intelTitle,seasonIndex,type IntelEvent} from '../world/WorldIntel';
import {QUALITIES} from '../data/items';

/** 按字数折行（中文无空格），行首不落标点。 */
function wrapCJK(text:string,per:number):string{const out:string[]=[];let line='';for(const ch of text){if(line.length>=per&&!'，。、；：！？）」』”'.includes(ch)){out.push(line);line='';}line+=ch;}if(line)out.push(line);return out.join('\n');}
type Selection={kind:'node';node:WorldNode}|{kind:'city';city:CityDef}|{kind:'stage';chapter:TimelineChapterId;stage:number}|{kind:'intel';event:IntelEvent};
type IntelMarker={event:IntelEvent;city:CityDef;root:Phaser.GameObjects.Container;ring:Phaser.GameObjects.Arc};

/**
 * 天下地图：原画地图 + 势力领地染色 + 三档城池标记 + 战役节点。
 * W1：城池可查看归属、时代、相邻与可攻打状态；攻城战在 W2 开放。
 */
export class WorldMapScene extends Phaser.Scene {
 private layer!:Phaser.GameObjects.Container;private selected:Selection={kind:'node',node:WORLD_NODES[0]};private detail!:Phaser.GameObjects.Text;private detailTitle!:Phaser.GameObjects.Text;private detailRule!:Phaser.GameObjects.Graphics;private seal!:ReturnType<typeof ownerSeal>;private detailBox={x:0,y:0,w:0};private action!:ReturnType<typeof worldButton>;
 private markers:Array<{node:WorldNode;root:Phaser.GameObjects.Container}>=[];private cityMarkers:CityMarker[]=[];private links!:Phaser.GameObjects.Graphics;private legend?:Phaser.GameObjects.Container;
 private era:EraId=1;private owned:string[]=[];private capturedEver:string[]=[];private siegeModal?:Phaser.GameObjects.Container;private territory?:Phaser.GameObjects.Container;private alerts:CityAlert[]=[];private notice?:Phaser.GameObjects.Container;
 /** 章节时间线条（地图下方）：按史事顺序的五章，点选即聚焦对应战役节点。 */
 /** 选中章节的三关路线：屏幕坐标关卡标记 + 虚线路线（随地图平移缩放重排）。 */
 private pins:Array<{stage:number;x:number;y:number;root:Phaser.GameObjects.Container}>=[];private route?:Phaser.GameObjects.Graphics;private routeChapter?:TimelineChapterId;private mapMask?:Phaser.GameObjects.Graphics;
 /** 「天下未定」纸雾（地图像素坐标的 RenderTexture，随章节开放揭开）。 */
 private fog?:Phaser.GameObjects.RenderTexture;private fogStamp?:Phaser.GameObjects.Image;private hardBtn!:ReturnType<typeof worldButton>;private actionHome={x:0,y:0,w:0};
 /** 军情事件标记（城池右上方的小印）。 */
 private intel:IntelEvent[]=[];private intelMarkers:IntelMarker[]=[];
 private chips:Array<{id:TimelineChapterId;node:WorldNode;g:Phaser.GameObjects.Graphics;x:number;y:number;w:number;h:number;state:ChapterState}>=[];
 private area={x:20,y:110,w:W-40,h:H-360};private minZoom=1;private zoom=1;private pointerX=0;private pointerY=0;private pinch=0;private pinching=false;private readonly mapW=1536;private readonly mapH=1024;
 constructor(){super('WorldMapScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'strategy_art','assets/world/strategy-map.webp');
  // W5 城池徽框与军旗（缩小显示，用线性过滤）
  for(const [key,url] of Object.entries(MARKER_FILES))worldAssets(this,key,url);
  if(MARKERS_V2)for(const [key,url] of Object.entries(CITY_ART_FILES))worldAssets(this,key,url);
  this.load.once('complete',()=>{for(const key of [...Object.keys(MARKER_FILES),...Object.keys(CITY_ART_FILES)])if(this.textures.exists(key))this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);});}
 create(){playMenuMusic(this);try{checkWorld(loadWorld());}catch{/* 存档不可用 */}
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}worldShell(this,this.registry.get('worldReveal')?'三国天下开启':'三国天下');if(this.registry.get('worldReveal')){this.registry.remove('worldReveal');this.cameras.main.fadeIn(900,0,0,0);}releaseWorldArt(this,'strategy_art');this.markers=[];this.cityMarkers=[];this.legend=undefined;
  this.siegeModal=undefined;this.territory=undefined;this.notice=undefined;this.pins=[];this.route=undefined;this.routeChapter=undefined;this.fog=undefined;this.registry.remove('hardChapter');const advance=isChapterTestRun()?null:advanceEra(),lost=isChapterTestRun()?[]:takeLostNotice();if(!isChapterTestRun())ensureIntel();const s=loadWorld();this.intel=intelEvents();this.intelMarkers=[];this.owned=s.ownedCities;this.alerts=s.alerts;this.capturedEver=s.capturedEver;this.era=!s.cleared.hulao?0:eraIndexFor({hulaoCleared:s.cleared.hulao,warlordStages:s.warlordStages,guanduStages:s.guanduStages});
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
  this.buildFog();
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.area.x,this.area.y,this.area.w,this.area.h);
  this.layer.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());this.mapMask=mask;
  // 选中城池时显示其道路相邻（屏幕坐标）
  this.links=this.add.graphics();this.links.setMask(mask.createGeometryMask());
  for(const city of CITIES){const m=(MARKERS_V2?cityMarkerV2:cityMarker)(this,city,cityOwner(city.id,this.era,this.owned));m.hit.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'city',city};this.refresh();});if(this.alertFor(city.id)){markAlert(this,m);if(MARKERS_V2)siegeArtV2(this,m);}this.cityMarkers.push(m);}
  // 纸雾下的城池：不显示、不可点（已占 / 告急城池始终可见）
  for(const m of this.cityMarkers){const fogged=!this.revealedAt(m.city.x,m.city.y)&&!this.owned.includes(m.city.id)&&!this.alertFor(m.city.id);m.root.setData('fogged',fogged);if(fogged)m.hit.disableInteractive();}
  const current=currentChapter(s).id;
  for(const node of WORLD_NODES){const st=this.nodeState(node),active=st!=='locked',info=this.chapterOf(node),color=st==='home'?0x88c5a4:st==='cleared'?0x9fd18a:active?0xe5c47d:0x747a6f;
   const marker=this.add.container(0,0);
   // 当前该打的一章：金色脉冲圈
   if(st==='open'&&info?.id===current){const ring=(MARKERS_V2?this.add.ellipse(0,6,40,14):this.add.circle(0,0,18)).setStrokeStyle(3,0xffd27a,.9).setName(`node-pulse-${node.id}`);marker.add(ring);this.tweens.add({targets:ring,scale:1.8,alpha:0,duration:1300,repeat:-1,ease:'Sine.easeOut'});}
   const glyphText=st==='home'?'营':st==='cleared'?'捷':active?'战':'锁',labelText=info?`${info.numeral} · ${node.name}`:node.name;
   // v2：牙旗 / 营帐 + 名牌；命中区沿用 node-<id>
   const v2=MARKERS_V2?nodeMarkerV2(this,st,glyphText,labelText,active):null;
   const circle=(v2?v2.hit:this.add.circle(0,0,18,st==='cleared'?0x3a2a12:0x16271e,.94).setStrokeStyle(2,color)).setInteractive({useHandCursor:true}).setName(`node-${node.id}`).setData('state',st);
   const icon=v2?null:worldText(this,0,0,glyphText,13,st==='cleared'?'#ffe7a8':active?'#f5dc9e':'#a4aa9c').setOrigin(.5);
   const label=v2?null:worldText(this,0,25,labelText,13,active?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   circle.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'node',node};this.refresh();});marker.add(v2?[...v2.parts,circle]:[circle,icon!,label!]);if(v2)marker.setData('label',v2.label).setData('plate',v2.plate).setData('icon',v2.icon);this.markers.push({node,root:marker});
  }
  for(const event of this.intel){const city=cityById(event.city);if(city)this.intelMarkers.push(this.intelMarker(event,city));}
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
  this.detail=worldText(this,tx,top+(desktop?44:50),'',desktop?13:15,'#e4dcc4').setWordWrapWidth(desktop?W-tx-250:W-80-sealSize-16,true).setLineSpacing(desktop?2:4);
  this.action=worldButton(this,desktop?W-140:W/2,desktop?py:H-42-40,'进入主城',()=>{if(this.selected.kind==='city')this.openSiege(this.selected.city,!!this.alertFor(this.selected.city.id));else if(this.selected.kind==='intel')this.openIntel(this.selected.event);else this.launch(false);},desktop?190:W-100);this.action.image.setName('map-action');this.actionHome={x:this.action.image.x,y:this.action.image.y,w:desktop?190:W-100};
  this.hardBtn=worldButton(this,this.actionHome.x,this.actionHome.y,'乱世难度',()=>this.launch(true),this.actionHome.w);this.hardBtn.image.setName('map-hard').setTint(0xd98a6a);this.hardBtn.text.setColor('#2a0d08');
  worldButton(this,W-55,this.area.y+35,'＋',()=>this.setZoom(this.zoom*1.2,W/2,this.area.y+this.area.h/2),48);
  worldButton(this,W-55,this.area.y+107,'－',()=>this.setZoom(this.zoom/1.2,W/2,this.area.y+this.area.h/2),48);
  // 年号与时代：点击展开势力图例
  const era=eraDef(this.era),chipG=this.add.graphics(),chip=worldText(this,this.area.x+12,this.area.y+12,`公元${era.year}年 · ${era.name}  ▾`,desktop?15:16,'#f6dc9a').setPadding(12,7).setInteractive({useHandCursor:true}).setName('world-era');
  chip.on('pointerup',()=>this.toggleLegend());
  // 领地：城池数、每次出征产出、生效特产
  const land=worldText(this,chip.x+chip.width+8,chip.y,`领地 ${this.owned.length}  ▾`,desktop?15:16,'#bff0c8').setPadding(12,7).setInteractive({useHandCursor:true}).setName('world-territory');
  land.on('pointerup',()=>this.toggleTerritory());
  const intelChip=this.intel.length?worldText(this,land.x+land.width+8,chip.y,`军情 ${this.intel.length}  ▸`,desktop?15:16,'#ffc49a').setPadding(12,7).setInteractive({useHandCursor:true}).setName('world-intel'):null;
  intelChip?.on('pointerup',()=>this.nextIntel());
  lacquerPlate(chipG,chip.x,chip.y,chip.width,chip.height,.9);lacquerPlate(chipG,land.x,land.y,land.width,land.height,.9,0x7fc48f);if(intelChip){lacquerPlate(chipG,intelChip.x,intelChip.y,intelChip.width,intelChip.height,.9,0xd0704a);intelChip.setDepth(1);}chipG.setDepth(chip.depth);chip.setDepth(1);land.setDepth(1);
  // 底边：势力排行（按城池数）+ 操作提示
  factionStrip(this,this.area.x+10,this.area.y+this.area.h-(desktop?24:26),Math.min(this.area.w-20,desktop?620:this.area.w-20),this.era,this.owned,desktop);
  // 操作提示垫一块漆底小牌：地图拖到哪里，提示都不会和城名 / 章节标签叠在一起难以辨认
  {const hint=worldText(this,desktop?this.area.x+this.area.w-18:this.area.x+20,this.area.y+this.area.h-(desktop?24:58),'拖动查看 · 滚轮/双指缩放 · 点城池查看',desktop?11:12,'#f2e3c0').setOrigin(desktop?1:0,.5).setPadding(10,5).setName('world-hint');
   const hb=hint.getBounds(),hg=this.add.graphics().setName('world-hint-plate');lacquerPlate(hg,hb.x,hb.y,hb.width,hb.height,.86);hint.setDepth(1);}
  // 攻城归来：选中并居中该城
  const focus=cityById(String(this.registry.get('mapFocusCity')??''));this.registry.remove('mapFocusCity');
  const focusIntel=this.intel.find(e=>e.id===this.registry.get('mapFocusIntel'));this.registry.remove('mapFocusIntel');
  if(focus){this.selected={kind:'city',city:focus};this.layer.setPosition(this.area.x+this.area.w/2-focus.x*this.zoom,this.area.y+this.area.h/2-focus.y*this.zoom);this.clampMap();}
  // 章节时间线；战役告捷归来聚焦新章节，否则默认选中当前该打的一章
  this.buildTimeline(desktop);
  const focusNode=WORLD_NODES.find(n=>n.id===this.registry.get('mapFocusNode'));this.registry.remove('mapFocusNode');
  if(focusIntel){this.selected={kind:'intel',event:focusIntel};this.centerOnCity(cityById(focusIntel.city)!);}
  else if(!focus){const pick=focusNode??WORLD_NODES.find(n=>this.chapterOf(n)?.id===current);if(pick)this.selected={kind:'node',node:pick};if(focusNode)this.centerOn(focusNode);}
  this.refresh();
  const fresh=isChapterTestRun()?0:takeNewChapters();
  if(fresh>0)this.revealChapter();
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
   const status=st==='cleared'?(hardChapterCleared(c.id)?'✓ 乱世':'✓ 已平定'):st==='open'?(done?`进行中 ${done}/3`:'可出征'):'未解锁';
   worldText(this,x+w/2,y+(desktop?13:17),`${c.numeral} ${c.title}`,14,st==='locked'?'#a4a79b':'#f6e3b4').setOrigin(.5).setName(`chapter-chip-title-${c.id}`);
   worldText(this,x+w/2,y+(desktop?30:39),`${c.year}年 · ${status}`,11,st==='cleared'?'#bfe3a6':st==='open'?'#ffd98a':'#9a9d92').setOrigin(.5).setName(`chapter-chip-status-${c.id}`);
   this.add.rectangle(x+w/2,y+h/2,w,h,0x000000,.001).setInteractive({useHandCursor:true}).setName(`chapter-chip-${c.id}`).setData('state',st).on('pointerup',()=>{this.selected={kind:'node',node};this.centerOn(node);this.refresh();});
  });
 }
 private paintChips(){const sel=this.selected.kind==='node'?this.chapterOf(this.selected.node)?.id:undefined;
  for(const c of this.chips){c.g.clear();lacquerPlate(c.g,c.x,c.y,c.w,c.h,.94,c.state==='cleared'?0x7fc48f:c.state==='open'?0xe5c47d:0x6b6f66);if(c.id===sel)c.g.lineStyle(2,0xffe2a0,1).strokeRoundedRect(c.x-2,c.y-2,c.w+4,c.h+4,7);}}
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
  for(const m of this.markers){const x=this.layer.x+m.node.x*this.mapW*this.zoom,q=this.liftOffCity(x,this.layer.y+m.node.y*this.mapH*this.zoom);m.root.setPosition(q.x,q.y).setVisible(visible(q.x,q.y)&&!(this.routeChapter&&this.chapterOf(m.node)?.id===this.routeChapter));}
  // 小城名字在放大后才显示，避免默认视图拥挤
  const showSmall=this.zoom>=this.minZoom*1.65;
  // 军旗高出徽框，靠近地图上沿时整个标记隐藏，免得旗子伸出地图框
  for(const m of this.cityMarkers){const p=this.toScreen(m.city.x,m.city.y),flag=m.root.getData('banner')?m.outer+40:m.top;m.root.setPosition(p.x,p.y).setVisible(visible(p.x,p.y)&&p.y-flag>a.y&&!m.root.getData('fogged'));m.label.setVisible(m.city.tier!=='small'||showSmall||this.isSelected(m.city));(m.root.getData('plate') as Phaser.GameObjects.Graphics|undefined)?.setVisible(m.label.visible);}
  this.layoutRoute(visible);
  if(MARKERS_V2)this.declutterLabels();
  for(const m of this.intelMarkers){const p=this.toScreen(m.city.x,m.city.y),x=p.x+20,y=p.y-30;m.root.setPosition(x,y).setVisible(visible(x,y)&&y-(MARKERS_V2?30:16)>a.y+(MARKERS_V2?46:0)&&this.revealedAt(m.city.x,m.city.y));}
  this.drawLinks();
 }
 /** v2：章节牙旗 / 关卡印落在城郭上时挪开：依次试城上方、右侧、左侧、名牌下方，取第一个不压到别的城的位置。 */
 private liftOffCity(x:number,y:number,pin=false):{x:number;y:number}{if(!MARKERS_V2)return{x,y};
  const cities=this.cityMarkers.filter(m=>!m.root.getData('fogged')).map(m=>({m,p:this.toScreen(m.city.x,m.city.y)}));
  // 牙旗 / 关卡印占据锚点上方约 44、下方约 26（名牌）；城占据城郭顶到名牌底
  const hitAt=(px:number,py:number,skip?:CityMarker)=>cities.find(c=>c.m!==skip&&Math.abs(c.p.x-px)<c.m.outer+18&&py-44<c.p.y+30&&py+26>c.p.y-c.m.top-6);
  const under=hitAt(x,y);if(!under)return{x,y};
  const {m,p}=under,side=m.outer+30;
  const a=this.area,inMap=(c:{x:number;y:number})=>c.x>a.x+20&&c.x<a.x+a.w-20&&c.y-44>a.y&&c.y+26<a.y+a.h;
  // 关卡印必须留在史实位置附近：只允许抬到城郭正上方（且不出地图框），否则不动
  if(pin){const up={x,y:p.y-m.top-26};return inMap(up)?up:{x,y};}
  // 章节牙旗：计分 = 压到几座城（含原城）；取分最低的位置，挪不出地图边框；全都更差就留在原处
  const cost=(c:{x:number;y:number})=>cities.filter(q=>Math.abs(q.p.x-c.x)<q.m.outer+18&&c.y-44<q.p.y+30&&c.y+26>q.p.y-q.m.top-6).length;
  let best={x,y},bestCost=cost(best);
  for(const c of [{x,y:p.y-m.top-26},{x:p.x+side,y:p.y},{x:p.x-side,y:p.y},{x,y:p.y+62}]){if(!inMap(c))continue;const k=cost(c);if(k<bestCost){best=c;bestCost=k;if(!k)break;}}
  return best;}
 /** v2：名牌按优先级避让（选中城 > 关卡印 > 章节牙旗 > 大城 > 中城 > 小城）。图标（城郭、牙旗、关卡印）也算障碍：
  * 关卡标签被挡时翻到印的上方；城名牌与已摆好的名牌或别家图标重叠时本轮隐藏。地图缩放 / 拖动后重算。 */
 private declutterLabels(){const placed:Phaser.Geom.Rectangle[]=[],pad=2,inter=Phaser.Geom.Intersects.RectangleToRectangle;
  const icons:Array<{r:Phaser.Geom.Rectangle;owner:Phaser.GameObjects.Container}>=[];
  const addIcon=(o:unknown,owner:Phaser.GameObjects.Container)=>{const g=o as Phaser.GameObjects.Components.GetBounds|undefined;if(!g||!owner.visible)return;const r=g.getBounds();r.setTo(r.x+4,r.y+10,Math.max(0,r.width-8),Math.max(0,r.height-14));icons.push({r,owner});};
  for(const p of this.pins)addIcon(p.root.getData('icon'),p.root);
  for(const m of this.markers)addIcon(m.root.getData('icon'),m.root);
  for(const m of this.cityMarkers)addIcon(m.root.getData('icon'),m.root);
  const box=(t:Phaser.GameObjects.Text)=>{const b=t.getBounds();b.setTo(b.x-6-pad,b.y-pad,b.width+12+pad*2,b.height+pad*2);return b;};
  const clash=(b:Phaser.Geom.Rectangle,owner:Phaser.GameObjects.Container)=>placed.some(r=>inter(r,b))||icons.some(i=>i.owner!==owner&&inter(i.r,b));
  const take=(t:Phaser.GameObjects.Text|undefined,owner:Phaser.GameObjects.Container,plate?:Phaser.GameObjects.Graphics,must=false)=>{if(!t||!t.visible)return;let b=box(t);
   if(clash(b,owner)&&!must){t.setVisible(false);plate?.setVisible(false);return;}plate?.setVisible(true);placed.push(b);};
  // 底边的势力排行条、操作提示牌也算障碍：被压住的城名牌直接隐藏，免得只露半截
  const chrome:Phaser.Geom.Rectangle[]=[];for(const name of ['world-faction-strip','world-hint','world-era','world-territory','world-intel']){const o=this.children.getByName(name) as unknown as Phaser.GameObjects.Components.GetBounds|null;if(o){chrome.push(o.getBounds());placed.push(o.getBounds());}}
  const shown=(c:Phaser.GameObjects.Container)=>c.visible;
  {const sel=this.cityMarkers.find(m=>this.isSelected(m.city));if(sel&&shown(sel.root))take(sel.label,sel.root,sel.root.getData('plate'),true);}
  // 关卡标签：默认在印下方，被挡就翻到印上方；两处都挡仍显示（关卡名不能丢）
  for(const p of this.pins)if(shown(p.root)){const t=p.root.getData('label') as Phaser.GameObjects.Text|undefined;if(!t)continue;t.setVisible(true).setPosition(0,24);
   // 依次试：印下方、印上方（不出地图框）、印右侧、印左侧；都挡就留在下方
   const a=this.area,inside=()=>{const b=t.getBounds();return b.y>a.y+4&&b.x>a.x+4&&b.right<a.x+a.w-4;},hw=t.width/2+22;
   const spots=[[0,24],[0,-26],[hw,0],[-hw,0]];let ok=false;for(const [sx,sy] of spots){t.setPosition(sx,sy);if(inside()&&!clash(box(t),p.root)){ok=true;break;}}if(!ok)t.setPosition(0,24);
   take(t,p.root,undefined,true);}
  for(const m of this.markers)if(shown(m.root)){const t=m.root.getData('label') as Phaser.GameObjects.Text|undefined;t?.setVisible(true);
   // 章节名牌压到底栏 / 顶部按钮下时隐藏（牙旗仍在，点开详情可见章名）
   if(t&&chrome.some(r=>inter(r,box(t)))){t.setVisible(false);(m.root.getData('plate') as Phaser.GameObjects.Graphics|undefined)?.setVisible(false);continue;}take(t,m.root,m.root.getData('plate'),true);}
  for(const tier of ['large','medium','small'] as const)for(const m of this.cityMarkers)if(m.city.tier===tier&&shown(m.root)&&!this.isSelected(m.city))take(m.label,m.root,m.root.getData('plate'));}
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
  const sel=this.selected,routeId=sel.kind==='stage'?sel.chapter:sel.kind==='node'?this.chapterOf(sel.node)?.id:undefined;this.showRoute(routeId);
  for(const m of this.cityMarkers)(MARKERS_V2?paintSelectionV2:paintSelection)(m,this.isSelected(m.city));this.clampMap();this.paintChips();
  for(const m of this.intelMarkers)m.ring.setStrokeStyle(this.selected.kind==='intel'&&this.selected.event.id===m.event.id?3:0,0xfff0c0,1);
  if(this.selected.kind==='intel'){this.intelDetail(this.selected.event);return;}
  if(this.selected.kind==='city'){
   const c=this.selected.city,owner=cityOwner(c.id,this.era,this.owned),era=eraDef(this.era),attack=cityAttackable(c.id,this.owned);
   const neighbors=[...(CITY_LINKS.get(c.id)??[])].map(id=>id===HOME.id?'义军营寨':cityById(id)!.name).join('、');
   const focus=(loadWorld().town.focus[c.id]??'balanced') as CityFocus,inc=FOCUS_INCOME[c.tier][owner==='player'?focus:'balanced'],sp=SPECIALTIES[c.id],yieldText=`${owner==='player'?`产出（${FOCUS_NAME[focus]}，主城「城池发展」可改）`:'占领后产出'}：每季 ${costText(inc)}${sp?` · 特产「${sp.title}」${sp.text}`:''}`;
   // 攻城分区：城池所属章节通关后才可攻打（守城不受限）
   const gateChapter=chapterById(CITY_CHAPTER[c.id]??'hulao');
   const alert=this.alertFor(c.id),gate=!citySiegeOpen(c.id,loadWorld())&&!isChapterTestRun()&&!alert&&owner!=='player',usable=(attack||!!alert)&&!gate,warn=attack?this.lossWarning():'';
   this.setDetail(`${c.name} · ${TIER_NAME[c.tier]} · ${c.region}`,FACTIONS[owner].color,sealGlyph(owner),`归属：${FACTIONS[owner].name}（公元${era.year}年 · ${era.name}）\n${alert?`告急：${FACTIONS[alert.attacker].name}来犯！守住可解除；出征别处则此城失守`:owner==='player'?'你的城池':gate?`通关第${gateChapter.numeral}章「${gateChapter.title}」后开放攻城`:attack?warn||'与你的领地相邻，可以攻打':'尚不相邻：先攻下相邻城池'}\n${yieldText}\n相邻：${neighbors}`);
   this.action.text.setText(alert?'守城 · 选择武将':owner==='player'?'我方城池':gate?`${gateChapter.short}后开放攻城`:attack?'攻城 · 选择武将':'尚不可攻打');this.action.image.setAlpha(usable?1:.45);if(usable)this.action.image.setInteractive({useHandCursor:true});else this.action.image.disableInteractive();
   this.layoutActions(false);return;
  }
  if(this.selected.kind==='stage'){this.refreshStage(this.selected.chapter,this.selected.stage);return;}
  const n=this.selected.node,st=this.nodeState(n),locked=st==='locked',info=this.chapterOf(n),save=loadWorld(),done=info?chapterStagesDone(info.id,save):0;
  if(n.kind==='home'||!info){const next=currentChapter(save),cleared=CHAPTER_TIMELINE.filter(c=>chapterStagesDone(c.id,save)>=3).length;this.setDetail(n.name,FACTIONS.player.color,n.kind==='home'?'营':'锁',`${n.region} · ${n.kind==='home'?'玩家领地':'地区开发中'}\n从义军营寨出发，建设后再次出征。\n章节进度 ${cleared}/${CHAPTER_TIMELINE.length} · ${cleared>=CHAPTER_TIMELINE.length?'诸章皆已平定':`下一章：第${next.numeral}章「${next.title}」`}`);}
  else{const hard=hardChapterCleared(info.id),status=locked?`未解锁：${info.hint}`:st==='cleared'?`已平定（3/3 关）· ${hard?`乱世已平 · 称号「${HARD_TITLES[info.id]}」`:'可重温，或挑战乱世难度'}`:done?`进行中：已过 ${done}/3 关`:'已开放：可出征';
   this.setDetail(`第${info.numeral}章 · ${n.name}`,st==='cleared'?0x5f8f4e:locked?0x4a4f46:0x8e2a1e,st==='cleared'?'捷':locked?'锁':'战',`公元${info.year}年（${info.era}） · ${n.region}\n${status}\n${locked?'按史事时序逐章解锁。':this.lossWarning()||'战斗军粮为单局资源，战后另结算永久资源。'}`);}
  this.action.text.setText(locked?'尚未解锁':n.kind==='home'?'进入主城':st==='cleared'?'重温 · 选择武将':'选择武将 · 出征');this.action.image.setAlpha(locked?.45:1);if(locked)this.action.image.disableInteractive();else this.action.image.setInteractive({useHandCursor:true});
  this.layoutActions(st==='cleared');}
/** 攻城出征面板：守军、时长、胜利条件、奖励，选择武将后出征。 */
 private openSiege(city:CityDef,defense=false){
  const alert=defense?this.alertFor(city.id):undefined;
  if(this.siegeModal||(defense?!alert:!cityAttackable(city.id,this.owned)||(!citySiegeOpen(city.id,loadWorld())&&!isChapterTestRun())))return;
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
 /** 出征：主按钮（hard=false）或「乱世难度」（hard=true）。章节节点从下一关出征，关卡标记从该关出征。 */
 private launch(hard:boolean){const sel=this.selected;if(sel.kind==='city'||sel.kind==='intel')return;
  if(sel.kind==='stage'){if(!stageOpen(sel.chapter,sel.stage,loadWorld())&&!isChapterTestRun())return;this.enterStage(sel.chapter,sel.stage,hard);return;}
  const info=this.chapterOf(sel.node);if(!info||sel.node.kind==='home'){this.enterNode();return;}
  if(this.nodeState(sel.node)==='locked')return;this.enterStage(info.id,undefined,hard);}
 private enterStage(id:TimelineChapterId,stage:number|undefined,hard:boolean){
  if(hard&&chapterState(id,loadWorld())==='cleared')this.registry.set('hardChapter',id);else this.registry.remove('hardChapter');
  if(id==='qunxiong'||id==='guandu'||id==='chibi'){if(stage)this.registry.set('worldStagePick',stage);this.scene.start(CAMPAIGNS[id].scene);return;}
  this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter',id);if(stage)this.registry.set('selectedWorldStage',stage);
  if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
 /** 出征按钮布局：已平定章节并列显示「乱世难度」。 */
 private layoutActions(showHard:boolean){const desk=W>600,h=this.actionHome,a=this.action,b=this.hardBtn,bh=desk?48:62;
  b.image.setVisible(showHard);b.text.setVisible(showHard);if(showHard)b.image.setInteractive({useHandCursor:true});else b.image.disableInteractive();
  const place=(btn:ReturnType<typeof worldButton>,x:number,y:number,w:number)=>{btn.image.setPosition(x,y).setDisplaySize(w,bh);btn.text.setPosition(x,y);};
  if(!showHard){place(a,h.x,h.y,h.w);return;}
  const id=this.selected.kind==='stage'?this.selected.chapter:this.selected.kind==='node'?this.chapterOf(this.selected.node)?.id:undefined;b.text.setText(id&&hardChapterCleared(id)?'乱世难度 ✓':'乱世难度');
  if(desk){place(b,h.x,h.y-27,h.w);place(a,h.x,h.y+27,h.w);}else{const half=(h.w-12)/2;place(b,h.x-h.w/2+half/2,h.y,half);place(a,h.x+h.w/2-half/2,h.y,half);}}
 /** 关卡详情：史事、首领、年号与出征状态。 */
 private refreshStage(id:TimelineChapterId,stage:number){const save=loadWorld(),info=chapterById(id),d=chapterStages(id)[stage-1],done=stage<=chapterStagesDone(id,save),open=stageOpen(id,stage,save)||isChapterTestRun(),cleared=chapterState(id,save)==='cleared';
  if(!d)return;const status=done?'✓ 已告捷 · 可重打此关':open?'可出征':chapterState(id,save)==='locked'?`未解锁：${info.hint}`:'先通关前一关';
  this.setDetail(`${d.code} ${d.name}`,done?0x5f8f4e:open?0x8e2a1e:0x4a4f46,d.seal,`${d.year} · 首领 ${d.boss}（${d.bossTitle}） · 第${info.numeral}章「${info.title}」\n${d.story}\n${status}${cleared&&open?` · 乱世：敌军生命×${HARD_MODE.enemyHp}、首领×${HARD_MODE.bossHp}`:''}`);
  this.action.text.setText(open?(done?'重打此关 · 选将':'从此关出征'):'尚未开放');this.action.image.setAlpha(open?1:.45);if(open)this.action.image.setInteractive({useHandCursor:true});else this.action.image.disableInteractive();
  this.layoutActions(cleared&&open);}
 /** 显示某章三关路线（重复调用同一章不重建）。 */
 private showRoute(id:TimelineChapterId|undefined){if(id===this.routeChapter)return;this.routeChapter=id;for(const p of this.pins)p.root.destroy();this.pins=[];
  if(!this.route){this.route=this.add.graphics().setDepth(2);if(this.mapMask)this.route.setMask(this.mapMask.createGeometryMask());}
  this.route.clear();if(!id)return;const save=loadWorld(),stages=chapterStages(id),done=chapterStagesDone(id,save);
  STAGE_POINTS[id].forEach((pt,i)=>{const n=i+1,d=stages[i];if(!d)return;const isDone=n<=done,open=stageOpen(id,n,save)||isChapterTestRun(),next=open&&!isDone;
   const root=this.add.container(0,0).setDepth(3).setName(`stage-pin-root-${id}-${n}`),g=this.add.graphics(),r=15;
   if(next){const ring=this.add.circle(0,0,r).setStrokeStyle(3,0xffd27a,.9);root.add(ring);this.tweens.add({targets:ring,scale:1.9,alpha:0,duration:1200,repeat:-1,ease:'Sine.easeOut'});}
   const pts=[{x:0,y:-r},{x:r,y:0},{x:0,y:r},{x:-r,y:0}];if(MARKERS_V2){g.destroy();}else g.fillStyle(isDone?0x3a2a12:open?0x5a1a12:0x2a2d28,.95).fillPoints(pts,true).lineStyle(2,isDone?0x9fd18a:open?0xffd27a:0x747a6f,1).strokePoints(pts,true,true);
   const glyph=worldText(this,0,0,isDone?'捷':open?d.seal:'锁',12,isDone?'#ffe7a8':open?'#ffe2a0':'#a4aa9c').setOrigin(.5);
   const label=worldText(this,0,24,`${d.code} ${d.name}`,12,open?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   const hit=this.add.circle(0,0,r+6,0x000000,.001).setInteractive({useHandCursor:true}).setName(`stage-pin-${id}-${n}`).setData('state',isDone?'cleared':open?'open':'locked');
   hit.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'stage',chapter:id,stage:n};this.refresh();});
   root.add([MARKERS_V2?sealGraphics(this,isDone?'cleared':open?'open':'locked',r):g,glyph,label,hit]);root.setData('label',label).setData('icon',hit);this.pins.push({stage:n,x:pt.x,y:pt.y,root});});}
 /** 路线重排：关卡标记跟随地图；关卡之间画虚线与箭头。 */
 private layoutRoute(visible:(x:number,y:number)=>boolean){if(!this.route)return;this.route.clear();const sel=this.selected;
  const pts=this.pins.map(p=>{const s0=this.toScreen(p.x,p.y),s=this.liftOffCity(s0.x,s0.y,true);p.root.setPosition(s.x,s.y).setVisible(visible(s.x,s.y));const on=sel.kind==='stage'&&sel.chapter===this.routeChapter&&sel.stage===p.stage;p.root.setScale(on?1.25:1);return s;});
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/len,uy=(b.y-a.y)/len;if(len<40)continue;
   this.route.lineStyle(3,0x1b120b,.55);for(let t=20;t<len-20;t+=14)this.route.lineBetween(a.x+ux*t,a.y+uy*t,a.x+ux*Math.min(t+8,len-20),a.y+uy*Math.min(t+8,len-20));
   this.route.lineStyle(2,0xffd27a,.95);for(let t=20;t<len-20;t+=14)this.route.lineBetween(a.x+ux*t,a.y+uy*t,a.x+ux*Math.min(t+8,len-20),a.y+uy*Math.min(t+8,len-20));
   const mx=a.x+ux*len*.5,my=a.y+uy*len*.5;this.route.fillStyle(0xffd27a,1).fillTriangle(mx+ux*8,my+uy*8,mx-ux*5-uy*6,my-uy*5+ux*6,mx-ux*5+uy*6,my-uy*5-ux*6);}}
 /** 已揭开的圆：已开放章节的地区 + 已占城池周边。 */
 private fogCircles(except?:TimelineChapterId){const s=loadWorld(),out:Array<{x:number;y:number;r:number}>=[];for(const c of CHAPTER_TIMELINE)if(c.id!==except&&chapterState(c.id,s)!=='locked')out.push(...CHAPTER_REGIONS[c.id]);for(const id of this.owned){const c=cityById(id);if(c)out.push({x:c.x,y:c.y,r:150});}return out;}
 private revealedAt(x:number,y:number){if(!this.fog)return true;return this.fogCircles().some(c=>Math.hypot(c.x-x,c.y-y)<c.r*.85);}
 /** 「天下未定」纸雾：尚有未开放章节时铺一层旧纸，揭开已开放章节的地区；未开放地区标章节名。 */
 private buildFog(){const s=loadWorld();if(isChapterTestRun()||CHAPTER_TIMELINE.every(c=>chapterState(c.id,s)!=='locked'))return;
  if(!this.textures.exists('fog_brush')){const t=this.textures.createCanvas('fog_brush',256,256);if(!t)return;const ctx=t.getContext(),grd=ctx.createRadialGradient(128,128,0,128,128,128);grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.62,'rgba(255,255,255,1)');grd.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grd;ctx.fillRect(0,0,256,256);t.refresh();}
  this.fogStamp=this.make.image({x:0,y:0,key:'fog_brush',add:false});
  this.fog=this.add.renderTexture(0,0,this.mapW,this.mapH).setOrigin(0).setName('world-fog');this.layer.add(this.fog);this.paintFog();
  for(const c of CHAPTER_TIMELINE)if(chapterState(c.id,s)==='locked'){const r=CHAPTER_REGIONS[c.id][0];this.layer.add(worldText(this,r.x,r.y,`第${c.numeral}章 · ${c.title}\n天下未定`,34,'#5a4630').setOrigin(.5).setAlign('center').setAlpha(.62).setName(`fog-label-${c.id}`));}}
 private paintFog(reveal?:{id:TimelineChapterId;t:number}){const rt=this.fog,stamp=this.fogStamp;if(!rt||!stamp)return;rt.clear();rt.fill(0xcdb98c,.9);
  const erase=(c:{x:number;y:number;r:number},k=1)=>{if(k<=0)return;stamp.setDisplaySize(c.r*2.5*k,c.r*2.5*k);rt.erase(stamp,c.x,c.y);};
  for(const c of this.fogCircles(reveal?.id))erase(c);if(reveal)for(const c of CHAPTER_REGIONS[reveal.id])erase(c,reveal.t);}
 /** 新篇解锁：镜头移到新章节，纸雾展卷揭开，并显示章节引言（点按或数秒后收起）。 */
 private revealChapter(){const c=currentChapter(loadWorld()),node=WORLD_NODES.find(n=>this.chapterOf(n)?.id===c.id);if(node&&this.selected.kind==='node'&&this.selected.node===node)this.centerOn(node);
  if(this.fog){const o={t:0};this.paintFog({id:c.id,t:0});this.tweens.add({targets:o,t:1,duration:1600,ease:'Sine.easeInOut',onUpdate:()=>this.paintFog({id:c.id,t:o.t})});}
  const desk=W>600,pw=Math.min(this.area.w-40,desk?560:460),root=this.add.container(W/2,this.area.y+(desk?110:130)).setDepth(40).setName('chapter-unlock-banner');
  const title=worldText(this,0,0,`新篇解锁 · 第${c.numeral}章「${c.title}」`,desk?20:22,'#ffe2a0').setOrigin(.5,0).setStroke('#1b120b',4);
  const fs=desk?13:15,intro=worldText(this,0,0,`公元${c.year}年（${c.era}）\n${wrapCJK(chapterIntro(c.id),Math.floor((pw-40)/fs))}`,fs,'#eadfc4').setOrigin(.5,0).setAlign('center').setLineSpacing(3);
  const ph=title.height+intro.height+34;title.setY(-ph/2+12);intro.setY(title.y+title.height+8);
  const g=this.add.graphics();lacquerPlate(g,-pw/2,-ph/2,pw,ph,.95,0xe5c47d);const hit=this.add.rectangle(0,0,pw,ph,0x000000,.001).setInteractive({useHandCursor:true}).setName('chapter-unlock-close');
  root.add([g,title,intro,hit]);root.setAlpha(0);const close=()=>{if(!root.active)return;this.tweens.add({targets:root,alpha:0,duration:350,onComplete:()=>root.destroy()});};hit.on('pointerup',close);
  this.tweens.add({targets:root,alpha:1,duration:450});this.time.delayedCall(5200,close);}
 /* —— 军情事件（WorldIntel.ts）—— */
 private intelMarker(event:IntelEvent,city:CityDef):IntelMarker{const info=INTEL_INFO[event.kind],root=this.add.container(0,0).setName('intel-'+event.id);
  const pulse=this.add.circle(0,0,15).setStrokeStyle(2,info.color,.9);this.tweens.add({targets:pulse,scale:1.9,alpha:0,duration:1500,repeat:-1,ease:'Sine.easeOut'});
  const ring=this.add.circle(0,0,17).setStrokeStyle(0,0xfff0c0,1);
  const body=(MARKERS_V2?this.add.circle(2,-12,18,0,.001):this.add.circle(0,0,14,info.color,.95).setStrokeStyle(2,0x1a120b,.9)).setInteractive({useHandCursor:true}).setName('intel-hit-'+event.id);
  const glyph=worldText(this,MARKERS_V2?intelGlyphPos(this).x:0,MARKERS_V2?intelGlyphPos(this).y:0,info.glyph,MARKERS_V2?12:14,'#fff6dc').setOrigin(.5).setStroke('#2a160c',3);
  if(MARKERS_V2){pulse.setPosition(0,12).setScale(1,.35);}
  body.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'intel',event};this.refresh();});
  root.add(MARKERS_V2?[pulse,ring,intelPennant(this,info.color),glyph,body]:[pulse,ring,body,glyph]);root.setDepth(5);return{event,city,root,ring};}
 /** 军情匾：依次选中下一件军情并居中。 */
 private nextIntel(){if(!this.intel.length)return;const i=this.selected.kind==='intel'?this.intel.findIndex(e=>e.id===(this.selected as {event:IntelEvent}).event.id):-1,event=this.intel[(i+1)%this.intel.length];this.selected={kind:'intel',event};const c=cityById(event.city);if(c)this.centerOnCity(c);this.refresh();}
 private centerOnCity(c:CityDef){this.layer.setPosition(this.area.x+this.area.w/2-c.x*this.zoom,this.area.y+this.area.h/2-c.y*this.zoom);this.clampMap();}
 private intelRewardText(event:IntelEvent){const r=intelReward(event),parts=[r.merits?`军功 +${r.merits}`:'',r.provisions?`粮草 +${r.provisions}`:'',r.money?`钱 +${r.money}`:''].filter(Boolean);return parts.join(' · ')+(r.item?` · ${QUALITIES[r.item.quality].label}·${QUALITIES[r.item.quality].name}兵装 1 件（${Math.round(r.item.orangeChance*100)}% 为${QUALITIES.orange.label}·${QUALITIES.orange.name}）`:'');}
 private intelLeft(event:IntelEvent){const left=event.expires-seasonIndex(loadWorld().town)+1;return left>1?`剩余 ${left} 季（含本季）`:'仅限本季';}
 private intelDetail(event:IntelEvent){const info=INTEL_INFO[event.kind],c=cityById(event.city),f=FACTIONS[event.faction]?.name??'';
  this.setDetail(`${info.name} · ${intelTitle(event).split(' · ')[1]}`,info.color,info.glyph,`${this.intelLeft(event)}${c?` · ${c.name}（${c.region}）`:''}
${intelBrief(event,f)}
奖励：${this.intelRewardText(event)}${this.lossWarning()?'\n'+this.lossWarning():''}`);
  this.action.text.setText('军情 · 选择武将');this.action.image.setAlpha(1).setInteractive({useHandCursor:true});this.layoutActions(false);}
 /** 军情出征面板：说明、奖励、期限，选择武将后出征。 */
 private openIntel(event:IntelEvent){
  if(this.siegeModal)return;const info=INTEL_INFO[event.kind],desk=W>600,warn=this.lossWarning(),dy=warn?(desk?36:54):0;
  let hero:CharacterId='zhaoyun';try{const saved=localStorage.getItem('im_last_hero');if(CHARACTERS.some(c=>c.id===saved))hero=saved as CharacterId;}catch{/* storage unavailable */}
  const root=this.add.container(0,0).setDepth(60).setName('intel-modal');this.siegeModal=root;
  const pw=Math.min(W-40,520),ph=(desk?400:560)+dy,px=W/2-pw/2,py=H/2-ph/2;
  root.add(this.add.rectangle(W/2,H/2,W,H,0x07100b,.72).setInteractive());root.add(panel(this,W/2,H/2,pw,ph));
  const t=(x:number,y:number,str:string,size=16,color='#ede3c9')=>{const o=worldText(this,x,y,str,size,color);root.add(o);return o;};
  t(px+24,py+20,intelTitle(event),24,'#f0d79e');t(px+24,py+54,`军情 · ${info.name} · ${this.intelLeft(event)}`,14,info.css);
  const how=event.kind==='escort'?'胜利条件：商车抵达终点（守在车旁它才前进，约 90 秒）':event.kind==='bandit'?'胜利条件：清剿两波流寇，击败寇首（约 2 分钟）':`胜利条件：清剿三波亲兵，击败${event.general}（约 3 分钟）`;
  const fail=event.kind==='escort'?'商车被毁则商队被劫、此事作罢；超时或阵亡可再战。':event.kind==='bandit'?'失败可再战；本季未平定，该城本季产出减半。':'失败可再战，期限内悬赏有效。';
  const body=`${how}
奖励：${this.intelRewardText(event)}
${fail}`;
  const infoText=t(px+24,py+86,body,14,'#d6cdb4').setLineSpacing(6).setWordWrapWidth(pw-48);
  if(warn)t(px+24,infoText.y+infoText.height+4,warn,13,'#ff8a70').setWordWrapWidth(pw-48).setName('intel-warning');
  t(px+24,py+dy+(desk?214:236),'出战武将',13,'#b6a07b');
  const btns:Phaser.GameObjects.Rectangle[]=[];const per=desk?CHARACTERS.length:Math.ceil(CHARACTERS.length/2),bw=(pw-48-6*(per-1))/per,by=py+dy+(desk?256:296);
  const paint=()=>btns.forEach((b,i)=>b.setFillStyle(CHARACTERS[i].id===hero?0x51402b:0x241e1a).setStrokeStyle(1,CHARACTERS[i].id===hero?0xd7b778:0x70604b));
  CHARACTERS.forEach((c,i)=>{const x=px+24+(i%per)*(bw+6)+bw/2,y=by+Math.floor(i/per)*62;const b=this.add.rectangle(x,y,bw,desk?42:54,0x241e1a,.96).setInteractive({useHandCursor:true}).setName('intel-hero-'+c.id);b.on('pointerup',()=>{hero=c.id;paint();});btns.push(b);root.add(b);root.add(worldText(this,x,y,c.name,16,'#d1c2a7').setOrigin(.5));});paint();
  const close=()=>{root.destroy();this.siegeModal=undefined;};
  const cancel=worldButton(this,px+pw*.27,py+ph-(desk?48:58),'返回',close,pw*.38);cancel.image.setName('intel-cancel');root.add([cancel.image,cancel.text]);
  const go=worldButton(this,px+pw*.73,py+ph-(desk?48:58),'出征',()=>this.launchIntel(event,hero),pw*.38);go.image.setName('intel-go');root.add([go.image,go.text]);
 }
 private launchIntel(event:IntelEvent,hero:CharacterId){
  if(!isChapterTestRun())try{localStorage.setItem('im_last_hero',hero);}catch{/* storage unavailable */}
  this.registry.remove('campaignTransfer');this.registry.set('intelEvent',event.id);this.registry.set('runConfig',{character:hero});
  if(this.registry.get('battleReady'))this.scene.start('IntelGameScene');else{this.registry.set('pendingWarlord','IntelGameScene');this.registry.set('loadBattle',true);this.scene.start('BootScene');}
 }
 private enterNode(){if(this.selected.kind!=='node')return;const n=this.selected.node;if(n.campaign){const c=CAMPAIGNS[n.campaign];if(c.open()||isChapterTestRun())this.scene.start(c.scene);return;}if(n.kind==='home'){this.scene.start('CityScene');return;}if(!n.chapter||!chapterUnlocked(n.chapter))return;this.registry.set('worldCampaign',true);this.registry.set('selectedWorldChapter',n.chapter);if(this.registry.get('battleReady'))this.scene.start('MenuScene');else{this.registry.set('loadBattle',true);this.scene.start('BootScene');}}
}
