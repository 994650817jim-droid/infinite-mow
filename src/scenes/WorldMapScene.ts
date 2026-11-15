import {playMenuMusic} from '../systems/Music';
import {RENDER_SCALE,screenPoint} from '../config';
import {thirdChapterUnlocked,arcUnlocked} from '../world/WorldStore';
/** 群雄篇章节点：是否开放、未开放提示、进入的选关场景。 */
const CAMPAIGNS={qunxiong:{open:()=>thirdChapterUnlocked(),hint:'通关虎牢关后解锁',scene:'ThirdChapterScene'},guandu:{open:()=>arcUnlocked('guandu'),hint:'平定群雄割据后解锁',scene:'GuanduChapterScene'}} as const;
import {isChapterTestRun} from '../systems/ChapterProgress';
import {worldUnlocked} from '../world/WorldStore';
import Phaser from 'phaser';
import {W,H,worldText,worldButton,worldShell,panel,worldAssets,releaseWorldArt} from '../world/WorldUI';
import {WORLD_NODES,type WorldNode} from '../world/WorldNodes';
import {loadWorld} from '../world/WorldStore';
import {chapterUnlocked} from '../systems/ChapterProgress';
import {CITIES,CITY_LINKS,CITY_INCOME,FACTIONS,HOME,SPECIALTIES,TIER_NAME,cityAttackable,cityById,cityOwner,eraDef,eraIndexFor,territorySummary,type CityDef} from '../world/WorldCities';
import {cityMarker,factionLegend,markAlert,paintSelection,territoryTexture,MARKER_FILES,type CityMarker} from '../world/WorldMapLayers';
import {advanceEra,takeLostNotice,type CityAlert,type EraAdvance} from '../world/WorldStore';
import {defenseBossName} from '../data/siege';
import {SIEGE,FIRST_CAPTURE_BONUS,siegeBossName} from '../data/siege';
import {CHARACTERS,type CharacterId} from '../data/characters';

type Selection={kind:'node';node:WorldNode}|{kind:'city';city:CityDef};

/**
 * 天下地图：原画地图 + 势力领地染色 + 三档城池标记 + 战役节点。
 * W1：城池可查看归属、时代、相邻与可攻打状态；攻城战在 W2 开放。
 */
export class WorldMapScene extends Phaser.Scene {
 private layer!:Phaser.GameObjects.Container;private selected:Selection={kind:'node',node:WORLD_NODES[0]};private detail!:Phaser.GameObjects.Text;private action!:ReturnType<typeof worldButton>;
 private markers:Array<{node:WorldNode;root:Phaser.GameObjects.Container}>=[];private cityMarkers:CityMarker[]=[];private links!:Phaser.GameObjects.Graphics;private legend?:Phaser.GameObjects.Container;
 private era:1|2|3=1;private owned:string[]=[];private capturedEver:string[]=[];private siegeModal?:Phaser.GameObjects.Container;private territory?:Phaser.GameObjects.Container;private alerts:CityAlert[]=[];private notice?:Phaser.GameObjects.Container;
 private area={x:20,y:110,w:W-40,h:H-360};private minZoom=1;private zoom=1;private pointerX=0;private pointerY=0;private pinch=0;private pinching=false;private readonly mapW=1536;private readonly mapH=1024;
 constructor(){super('WorldMapScene');}
 preload(){if(!worldUnlocked()&&!isChapterTestRun())return;worldAssets(this,'strategy_art','assets/world/strategy-map.webp');
  // W5 城池徽框与军旗（缩小显示，用线性过滤）
  for(const [key,url] of Object.entries(MARKER_FILES))worldAssets(this,key,url);
  this.load.once('complete',()=>{for(const key of Object.keys(MARKER_FILES))if(this.textures.exists(key))this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);});}
 create(){playMenuMusic(this);
  if(!worldUnlocked()&&!isChapterTestRun()){this.registry.set('loadBattle',true);this.scene.start(this.registry.get('battleReady')?'MenuScene':'BootScene');return;}worldShell(this,this.registry.get('worldReveal')?'三国天下开启':'三国天下');if(this.registry.get('worldReveal')){this.registry.remove('worldReveal');this.cameras.main.fadeIn(900,0,0,0);}releaseWorldArt(this,'strategy_art');this.markers=[];this.cityMarkers=[];this.legend=undefined;
  this.siegeModal=undefined;this.territory=undefined;this.notice=undefined;const advance=isChapterTestRun()?null:advanceEra(),lost=isChapterTestRun()?[]:takeLostNotice();const s=loadWorld();this.owned=s.ownedCities;this.alerts=s.alerts;this.capturedEver=s.capturedEver;this.era=eraIndexFor({hulaoCleared:s.cleared.hulao,warlordStages:s.warlordStages,guanduStages:s.guanduStages});
  worldText(this,24,64,`军功 ${s.merits}    粮草 ${s.provisions}`,15,'#bdcdb6');
  worldButton(this,W-105,43,'返回主城',()=>this.scene.start('CityScene'),150);
  const desktop=W>600;this.area={x:20,y:105,w:W-40,h:desktop?H-250:H-360};
  this.layer=this.add.container(0,0);this.layer.add(this.add.image(0,0,'strategy_art').setOrigin(0).setDisplaySize(this.mapW,this.mapH));
  // 势力领地染色（随地图缩放）
  const territory=territoryTexture(this,this.era,this.owned);this.layer.add(this.add.image(0,0,territory).setOrigin(0).setDisplaySize(this.mapW,this.mapH));
  this.events.once('shutdown',()=>{if(this.textures.exists(territory))this.textures.remove(territory);});
  const mask=this.make.graphics({x:0,y:0}).fillStyle(0xffffff).fillRect(this.area.x,this.area.y,this.area.w,this.area.h);
  this.layer.setMask(mask.createGeometryMask());this.events.once('shutdown',()=>mask.destroy());
  // 选中城池时显示其道路相邻（屏幕坐标）
  this.links=this.add.graphics();this.links.setMask(mask.createGeometryMask());
  for(const city of CITIES){const m=cityMarker(this,city,cityOwner(city.id,this.era,this.owned));m.hit.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'city',city};this.refresh();});if(this.alertFor(city.id))markAlert(this,m);this.cityMarkers.push(m);}
  for(const node of WORLD_NODES){const active=node.kind==='home'||!!node.campaign&&(CAMPAIGNS[node.campaign].open()||isChapterTestRun())||node.chapter&&chapterUnlocked(node.chapter),color=active?node.kind==='home'?0x88c5a4:0xe5c47d:0x747a6f;
   const marker=this.add.container(0,0);const circle=this.add.circle(0,0,18,0x16271e,.94).setStrokeStyle(2,color).setInteractive({useHandCursor:!!active}).setName(`node-${node.id}`);
   const icon=worldText(this,0,0,node.kind==='home'?'营':active?'战':'锁',13,active?'#f5dc9e':'#a4aa9c').setOrigin(.5);
   const label=worldText(this,0,25,node.name,13,active?'#fff0cd':'#b6b8aa').setOrigin(.5).setStroke('#142016',3);
   circle.on('pointerup',(pointer:Phaser.Input.Pointer)=>{if(pointer.getDistance()>10*RENDER_SCALE||this.pinching)return;this.selected={kind:'node',node};this.refresh();});marker.add([circle,icon,label]);this.markers.push({node,root:marker});
  }
  this.minZoom=Math.max(this.area.w/this.mapW,this.area.h/this.mapH);this.zoom=this.minZoom*1.2;
  this.layer.setScale(this.zoom).setPosition(W/2-this.mapW*.52*this.zoom,this.area.y+this.area.h/2-this.mapH*.45*this.zoom);this.clampMap();
  const inside=(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);return p.x>=this.area.x&&p.x<=this.area.x+this.area.w&&p.y>=this.area.y&&p.y<=this.area.y+this.area.h;};
  this.input.on('pointerdown',(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);this.pointerX=p.x;this.pointerY=p.y;this.pinch=0;this.pinching=false;});
  this.input.on('pointermove',(q:Phaser.Input.Pointer)=>{if(!q.isDown||!inside(q))return;const p=screenPoint(q),a=this.input.manager.pointers.filter(o=>o.isDown&&inside(o)).map(screenPoint);if(a.length>=2){this.pinching=true;const distance=Phaser.Math.Distance.Between(a[0].x,a[0].y,a[1].x,a[1].y);if(this.pinch>0)this.setZoom(this.zoom*distance/this.pinch,(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2);this.pinch=distance;}else{this.pinch=0;this.layer.x+=p.x-this.pointerX;this.layer.y+=p.y-this.pointerY;this.clampMap();}this.pointerX=p.x;this.pointerY=p.y;});
  this.input.on('wheel',(q:Phaser.Input.Pointer,_objs:unknown,_dx:number,dy:number)=>{const p=screenPoint(q);if(inside(q))this.setZoom(this.zoom*(dy>0?.9:1.1),p.x,p.y);});
  const py=desktop?H-76:H-140,ph=desktop?132:200;panel(this,W/2,py,W-40,ph);
  this.detail=worldText(this,40,py-ph/2+14,'',desktop?14:16).setWordWrapWidth(desktop?W-300:W-80).setLineSpacing(3);
  this.action=worldButton(this,desktop?W-140:W/2,desktop?py:H-80,'进入主城',()=>{if(this.selected.kind==='city')this.openSiege(this.selected.city,!!this.alertFor(this.selected.city.id));else this.enterNode();},desktop?190:W-100);this.action.image.setName('map-action');
  worldButton(this,W-55,this.area.y+35,'＋',()=>this.setZoom(this.zoom*1.2,W/2,this.area.y+this.area.h/2),48);
  worldButton(this,W-55,this.area.y+107,'－',()=>this.setZoom(this.zoom/1.2,W/2,this.area.y+this.area.h/2),48);
  // 年号与时代：点击展开势力图例
  const era=eraDef(this.era),chip=worldText(this,this.area.x+12,this.area.y+12,`公元${era.year}年 · ${era.name}  ▾`,desktop?15:16,'#fff0cd').setBackgroundColor('#0f1c15e6').setPadding(10,6).setInteractive({useHandCursor:true}).setName('world-era');
  chip.on('pointerup',()=>this.toggleLegend());
  // 领地：城池数、每次出征产出、生效特产
  const land=worldText(this,chip.x+chip.width+8,chip.y,`领地 ${this.owned.length}  ▾`,desktop?15:16,'#bff0c8').setBackgroundColor('#0f1c15e6').setPadding(10,6).setInteractive({useHandCursor:true}).setName('world-territory');
  land.on('pointerup',()=>this.toggleTerritory());
  worldText(this,30,this.area.y+this.area.h-25,'拖动查看 · 滚轮/双指缩放 · 点城池查看',11,'#fff0cf').setStroke('#15261c',3);
  // 攻城归来：选中并居中该城
  const focus=cityById(String(this.registry.get('mapFocusCity')??''));this.registry.remove('mapFocusCity');
  if(focus){this.selected={kind:'city',city:focus};this.layer.setPosition(this.area.x+this.area.w/2-focus.x*this.zoom,this.area.y+this.area.h/2-focus.y*this.zoom);this.clampMap();}
  this.refresh();
  if(advance||lost.length)this.showNotice(advance,lost);
 }
 private alertFor(id:string){return this.alerts.find(a=>a.city===id);}
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
   `每次出征结算产出：军功 +${sum.merits} · 粮草 +${sum.provisions}`,
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
  for(const m of this.cityMarkers){const p=this.toScreen(m.city.x,m.city.y);m.root.setPosition(p.x,p.y).setVisible(visible(p.x,p.y));m.label.setVisible(m.city.tier!=='small'||showSmall||this.isSelected(m.city));}
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
 private refresh(){
  for(const m of this.cityMarkers)paintSelection(m,this.isSelected(m.city));this.clampMap();
  if(this.selected.kind==='city'){
   const c=this.selected.city,owner=cityOwner(c.id,this.era,this.owned),era=eraDef(this.era),attack=cityAttackable(c.id,this.owned);
   const neighbors=[...(CITY_LINKS.get(c.id)??[])].map(id=>id===HOME.id?'义军营寨':cityById(id)!.name).join('、');
   const inc=CITY_INCOME[c.tier],sp=SPECIALTIES[c.id],yieldText=`${owner==='player'?'产出':'占领后产出'}：每次出征 ${inc.merits?'军功 +'+inc.merits+' · ':''}粮草 +${inc.provisions}${sp?` · 特产「${sp.title}」${sp.text}`:''}`;
   const alert=this.alertFor(c.id),usable=attack||!!alert,warn=attack?this.lossWarning():'';
   this.detail.setText(`${c.name} · ${TIER_NAME[c.tier]} · ${c.region}\n归属：${FACTIONS[owner].name}（公元${era.year}年 · ${era.name}）\n${alert?`告急：${FACTIONS[alert.attacker].name}来犯！守住可解除；出征别处则此城失守`:owner==='player'?'你的城池':attack?warn||'与你的领地相邻，可以攻打':'尚不相邻：先攻下相邻城池'}\n${yieldText}\n相邻：${neighbors}`);
   this.action.text.setText(alert?'守城 · 选择武将':owner==='player'?'我方城池':attack?'攻城 · 选择武将':'尚不可攻打');this.action.image.setAlpha(usable?1:.45);if(usable)this.action.image.setInteractive({useHandCursor:true});else this.action.image.disableInteractive();
   return;
  }
  const n=this.selected.node,locked=n.kind==='future'||(n.campaign?!CAMPAIGNS[n.campaign].open()&&!isChapterTestRun():!!n.chapter&&!chapterUnlocked(n.chapter));this.detail.setText(`${n.name}\n${n.region} · ${n.kind==='home'?'玩家领地':n.kind==='future'?'地区开发中':locked?n.campaign?CAMPAIGNS[n.campaign].hint:'通关黄巾之乱后解锁':'战役已开放'}\n${n.kind==='battle'||n.campaign?this.lossWarning()||'战斗军粮为单局资源，战后另结算永久资源。':'从义军营寨出发，建设后再次出征。'}`);this.action.text.setText(locked?'尚未开放':n.kind==='home'?'进入主城':'选择武将 · 出征');this.action.image.setAlpha(locked?.45:1);if(locked)this.action.image.disableInteractive();else this.action.image.setInteractive({useHandCursor:true});}
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
  const btns:Phaser.GameObjects.Rectangle[]=[];const bw=(pw-48-18)/4,by=py+dy+(desk?256:282);
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
