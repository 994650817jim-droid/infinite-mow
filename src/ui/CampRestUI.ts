import Phaser from 'phaser';import {ItemTooltip} from './ItemTooltip';import {drawBuildOverview} from './BuildOverview';import {wornTokens} from '../systems/CharmEffects';import {tokenSlots} from '../systems/ItemStore';import {GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D,FONT,HEADING_FONT,DEPTH,screenPoint} from '../config';import type {Player} from '../entities/Player';import type {Legion} from '../systems/Legion';import {campOption,type CampOffer} from '../systems/CampMarket';import {merchantStockForVisit,saveMerchantStock,type MerchantStock} from '../systems/MerchantStock';import {MerchantShop} from './MerchantShop';import {MEDIC_FIGURE,drawCampFigure,type FigurePlace} from './CampFigure';import {CAMP_TRAINING,type CampTrainingId,type CampGroup} from '../data/camp';import {INITIAL_TROOPS,TROOPS,type TroopKind} from '../data/legion';import {TREASURES,type TacticId,type TreasureId,type BuildTag} from '../data/builds';import {AWAKENINGS,activeAwakenings} from '../data/awakenings';import {getCharacter} from '../data/characters';import {WEAPON_META} from '../data/upgrades';import {ATTRIBUTE_INFO,MARTIALS,type AttributeId,type MasteryId} from '../systems/RunGrowth';import type {ItemInstance} from '../data/items';import {troopBadge} from './TroopBadge';import {loadTroopPortraits} from '../systems/TroopPortraits';
import {homeCommand,inkPlate,warPanelTexture} from './HomeCommand';
import {lqButton,lqLabelColor,type LqState} from './LacquerKit';
import {CAMP_MEDIC,medicPrice,type MedicKind} from '../data/campMedic';
import {loadBagArt} from './ItemQuality';
import {visualTextureKey} from '../systems/ReadableTextures';
export class CampRestUI {
 readonly root:Phaser.GameObjects.Container;
 private body:Phaser.GameObjects.Container;
 private header:Phaser.GameObjects.Text;
 private resources:Phaser.GameObjects.Text;
 private next:Phaser.GameObjects.Text;
 private detail:Phaser.GameObjects.Text;
 private tabs:Phaser.GameObjects.Text[]=[];
 private tabFrames:Phaser.GameObjects.Image[]=[];
 private buildSection=0;private buildOffset=0;private modal?:Phaser.GameObjects.Container;
 /** 兵装货架：每次入营一件（绿 / 蓝），买下记入本局缴获，结算带回行囊。onBuyItem 由 GameScene 设置。 */
 /** 军需商人（2026-11-17 用户：只卖装备）：每次进营 4 件兵装，甲胄 / 头盔 / 战靴 / 信物各 1 件。itemSold[i] = 第 i 件已买。 */
 onBuyItem?:(item:ItemInstance)=>void;private itemTip?:ItemTooltip;
 /** 货架与营寨「旅商」共用（systems/MerchantStock）：同一份货、已售不补，来回切换不会刷新。 */
 private stock:MerchantStock|null=null;private shop?:MerchantShop;
 get itemOffers():ItemInstance[]{return this.stock?.items??[];}
 get itemSold():boolean[]{return this.stock?.sold??[];}
 get tacticOffer():CampOffer|null{return this.stock?.tactic??null;}
 set tacticOffer(v:CampOffer|null){if(this.stock){this.stock.tactic=v;saveMerchantStock(this.stock);}}
 /** 行囊（休整时可换装、换马）。由 GameScene 设置。 */
 onOpenBag?:()=>void;
 /** 天下地图出征（营寨开放后）：休整时可回营寨。设置后显示「回营寨」按钮，点两次确认（本局成长不保留）。 */
 onReturnHome?:()=>void;
 private homeBtn!:Phaser.GameObjects.Text;private homeArmed=false;private homeGfx?:Phaser.GameObjects.Graphics;
 private tabIcons:Array<Phaser.GameObjects.Image|null>=[];private tabLine!:Phaser.GameObjects.Rectangle;private lineTo:{x:number;w:number}|null=null;
 /** 电脑版水墨按钮（2026-11-17 用户「这个行囊按钮改一下」）：行囊 / 回营寨 / 页签换成手绘墨迹底，同主页与战斗内按钮。 */
 private readonly ink:boolean;private homePlate:Phaser.GameObjects.NineSlice|null=null;private tabInk:Array<Phaser.GameObjects.NineSlice|null>=[];
 /** 军需商人偶尔捎来的 1 卷战法（data/items MERCHANT_TACTIC）；null = 这次没有。onLearnTactic 由 GameScene 设置（改存档点）。 */
 onLearnTactic?:()=>void;
 private visit='';private tab=0;private page=0;private destination='';private notice='';
 constructor(private scene:Phaser.Scene,private player:Player,private army:Legion,depart:()=>void){
  this.root=scene.add.container(0,0).setScrollFactor(0).setDepth(DEPTH.overlay+2).setVisible(false).setName('camp-rest');
  const background=scene.add.image(W/2,H/2,'rest_camp').setScrollFactor(0);
  const source=background.texture.getSourceImage();const cover=Math.max(W/source.width,H/source.height);background.setScale(cover);this.root.add(background);
  this.root.add(scene.add.rectangle(0,0,W,H,0x110e0a,.38).setOrigin(0).setInteractive());
  this.header=this.text(D?40:28,D?18:30,'行营休整',D?27:30).setFontFamily(HEADING_FONT).setColor('#f3e3bf');
  this.resources=this.text(D?40:28,D?57:78,'',D?17:19).setColor('#e6c894');
  this.next=this.text(D?W-40:28,D?30:110,'',D?16:17).setColor('#d2c3a6');if(D)this.next.setOrigin(1,0);
  this.root.add([this.header,this.resources,this.next]);
  // 2026-11-18 用户：「这里 ui 水墨特效太多了」→ 整页只留底部「率军出征」一处水墨笔刷，其余换漆底描金（LacquerKit）
  this.ink=false;
  let bagLeft:number;
  if(this.ink){
   // 行囊：朱墨笔触 + 手绘行囊图标（行囊页签同一张），命中区为整块按钮（对象名 camp-bag 不变）
   const bw=118,bh=38,cx=W-40-bw/2,cy=62+bh/2;let plate=inkPlate(scene,null,cx,cy,bw,bh,true,'normal');plate?.setScrollFactor(0);
   const icon=scene.add.image(cx-27,cy,scene.textures.exists('bag_tab_icon_all')?'bag_tab_icon_all':'__WHITE').setDisplaySize(28,28).setScrollFactor(0).setVisible(scene.textures.exists('bag_tab_icon_all'));
   if(!icon.visible)loadBagArt(scene,()=>{if(icon.scene&&scene.textures.exists('bag_tab_icon_all'))icon.setTexture('bag_tab_icon_all').setDisplaySize(28,28).setVisible(true);});
   const cap=scene.add.text(cx+13,cy,'行囊',{fontFamily:HEADING_FONT,fontSize:'17px',fontStyle:'bold',color:'#f8e6bf',resolution:2}).setOrigin(.5).setLetterSpacing(4).setStroke('#2a0c06',3).setShadow(0,1,'#120a05',3,true,true).setScrollFactor(0);
   const hit=scene.add.rectangle(cx,cy,bw,bh,0,.001).setScrollFactor(0).setInteractive({useHandCursor:true}).setName('camp-bag');
   const paint=(st:'normal'|'hover'|'pressed')=>{plate=inkPlate(scene,plate,cx,cy,bw,bh,true,st);cap.setY(cy+(st==='pressed'?1:0)).setColor(st==='hover'?'#fff3d4':'#f8e6bf');icon.setY(cy+(st==='pressed'?1:0));};
   hit.on('pointerover',()=>paint('hover')).on('pointerout',()=>paint('normal')).on('pointerdown',()=>{paint('pressed');this.onOpenBag?.();}).on('pointerup',()=>paint('hover'));
   this.root.add([...(plate?[plate]:[]),icon,cap,hit]);bagLeft=cx-bw/2-18;
  }else{
   // 行囊：漆底描金小按钮 + 手绘行囊图标（对象名 camp-bag 不变）
   const bw=D?112:100,bh=D?34:36,cx=(D?W-40:W-28)-bw/2,cy=(D?62:34)+bh/2,g=scene.add.graphics().setScrollFactor(0);
   const icon=scene.add.image(cx-bw/2+22,cy,scene.textures.exists('bag_tab_icon_all')?'bag_tab_icon_all':'__WHITE').setDisplaySize(24,24).setScrollFactor(0).setVisible(scene.textures.exists('bag_tab_icon_all'));
   if(!icon.visible)loadBagArt(scene,()=>{if(icon.scene&&scene.textures.exists('bag_tab_icon_all'))icon.setTexture('bag_tab_icon_all').setDisplaySize(24,24).setVisible(true);});
   const cap=scene.add.text(cx+12,cy,'行囊',{fontFamily:HEADING_FONT,fontSize:'16px',color:'#ffe9bd',resolution:2}).setOrigin(.5).setLetterSpacing(3).setScrollFactor(0);
   const hit=scene.add.rectangle(cx,cy,bw,bh,0,.001).setScrollFactor(0).setInteractive({useHandCursor:true}).setName('camp-bag');
   const paint=(st:LqState)=>{g.clear();const d=lqButton(g,cx,cy,bw,bh,st,'gold');cap.setY(cy+d).setColor(lqLabelColor(st));icon.setY(cy+d);};
   hit.on('pointerover',()=>paint('hover')).on('pointerout',()=>paint('idle')).on('pointerdown',()=>{paint('down');this.sound('uiClick');this.onOpenBag?.();}).on('pointerup',()=>paint('hover'));paint('idle');
   this.root.add([g,icon,cap,hit]);bagLeft=cx-bw/2-12;}
  // 回营寨：电脑在「行囊」左侧，手机在它下方
  this.homeGfx=scene.add.graphics().setScrollFactor(0);this.root.add(this.homeGfx);
  this.homeBtn=this.text(D?bagLeft:W-28,D?62:76,'回营寨',D?15:16).setOrigin(1,0).setPadding(14,8,14,8).setColor('#ffe9bd').setInteractive({useHandCursor:true}).setName('camp-home').setVisible(false);
  this.homeBtn.on('pointerdown',()=>{if(!this.onReturnHome)return;if(!this.homeArmed){this.homeArmed=true;this.homeBtn.setText('确认回营寨？本局等级与战法不保留');this.paintHome();return;}this.onReturnHome();});this.root.add(this.homeBtn);
  this.homeBtn.on('pointerover',()=>this.paintHome('hover')).on('pointerout',()=>this.paintHome());this.paintHome();
  if(this.ink){this.homeBtn.setFontFamily(HEADING_FONT).setPadding(18,9,18,9).setStroke('#16100a',4).setY(62);this.homeBtn.on('pointerover',()=>this.paintHome('hover')).on('pointerout',()=>this.paintHome());this.paintHome();}
  // 用户 2026-11-17「休整的时候练兵营就不需要了」：去掉「练兵营」页签（本局体魄 / 兵刃 / 甲胄训练）。营寨军营的「练兵」是另一套永久加成，保留。
  // 其余页签保留原编号（0 招兵营 / 2 军需商人 / 3 将帅帐），对象名 camp-tab-<编号> 不变。
  // 2026-11-18 用户：受的伤跨关继承，休整加「军医」（编号 4，对象名 camp-tab-4）
  const TABS:Array<[number,string,string]>=[[0,'招兵营','icon_shu_swordsman'],[2,'军需商人','build_icon_return_drum'],[3,'将帅帐','growth_icon_points'],[4,'军医','potion_jar']];
  const tabW=D?172:(W-48)/TABS.length,tabY=D?96:155;
  TABS.forEach(([i,label,icon],slot)=>{const x=D?40+slot*180:24+slot*tabW;const frame=scene.add.image(x+(tabW-6)/2,tabY+23,warPanelTexture(scene,tabW-6,46)).setScrollFactor(0).setVisible(!this.ink);this.tabFrames.push(frame);this.root.add(frame);
   this.tabInk.push(null);
   if(scene.textures.exists(icon)){const ic=scene.add.image(x+21,tabY+(D?22:21),icon).setDisplaySize(D?29:27,D?29:27).setScrollFactor(0);this.tabIcons.push(ic);this.root.add(ic);}else this.tabIcons.push(null);
   const hit=this.text(x,tabY,label,D?17:16).setPadding(D?43:39,D?12:13,0,0).setFixedSize(tabW-6,46).setInteractive({useHandCursor:true}).setName('camp-tab-'+i);
   hit.setData('tab',i).setData('slot',slot).on('pointerdown',()=>{this.tab=i;this.page=0;this.notice='';this.render();}).on('pointerover',()=>hit.setColor('#fff0cd')).on('pointerout',()=>hit.setColor(i===this.tab?'#f6dfb0':'#bcae93'));this.tabs.push(hit);this.root.add(hit);
  });
  this.tabLine=scene.add.rectangle(0,tabY+43,10,2,0xe8c27a,1).setOrigin(0,.5).setScrollFactor(0).setName('camp-tab-line');this.root.add(this.tabLine);
  // 页签切换：金色细线滑到选中页签下（休整时场景补间暂停，按真实时间插值）
  const slide=():void=>{if(!this.root.active){scene.events.off('postupdate',slide);return;}if(!this.root.visible||!this.lineTo)return;const k=Math.min(1,scene.game.loop.delta/90),l=this.tabLine;l.x+=(this.lineTo.x-l.x)*k;l.width+=(this.lineTo.w-l.width)*k;};
  scene.events.on('postupdate',slide);scene.events.once('shutdown',()=>scene.events.off('postupdate',slide));
  this.body=scene.add.container(0,0);this.root.add(this.body);
  this.detail=this.text(D?W/2:28,D?H-103:H-176,'',D?13:15).setWordWrapWidth(W-(D?120:56),true);if(D)this.detail.setOrigin(.5,0).setAlign('center');/* 电脑版居中，左右各留 60，长句不会贴边被切 */this.detail.setMaxLines(D?3:5);this.root.add(this.detail);
  const command=homeCommand(scene,W/2,H-(D?33:48),D?236:W-96,D?44:52,'率军出征',true); /* 全页唯一一处水墨笔刷，缩小一号 */[command.g,command.caption,command.hit].forEach(o=>o.setScrollFactor(0));command.hit.setName('camp-depart').setData('padDefault',true).on('pointerdown',depart);this.root.add([command.g,command.caption,command.hit]);
 }
 /** 电脑版「回营寨」：墨迹底随文字宽度伸缩；点第一次（待确认）换成朱墨主按钮。 */
 private paintHome(state:'normal'|'hover'='normal'){
  // 漆底描金：常态素色、悬停描金边亮起；点第一次（待确认）换朱漆
  if(!this.ink){const b=this.homeBtn,g=this.homeGfx;if(!g)return;g.clear().setVisible(b.visible);if(!b.visible)return;const st:LqState=state==='hover'?'hover':'idle';lqButton(g,b.x-b.width/2,b.y+b.height/2,b.width,b.height-4,st,this.homeArmed?'cinnabar':'quiet');b.setColor(lqLabelColor(st));return;}const b=this.homeBtn;b.setBackgroundColor('rgba(0,0,0,0)').setColor(state==='hover'?'#fff3d4':this.homeArmed?'#f8e6bf':'#e8d3a6');
  const cx=b.x-b.width/2,cy=b.y+b.height/2,w=b.width-8,h=36;
  this.homePlate=inkPlate(this.scene,this.homePlate,cx,cy,w,h,this.homeArmed,state);
  if(this.homePlate){this.homePlate.setScrollFactor(0).setVisible(b.visible);if(!this.homePlate.parentContainer)this.root.addAt(this.homePlate,this.root.getIndex(b));}
 }
 private sound(kind:string){(this.scene as unknown as {sfx?:{play(k:string):void}}).sfx?.play(kind);}
 private text(x:number,y:number,s:string,size=16){return this.scene.add.text(x,y,s,{fontFamily:FONT,fontSize:size+'px',color:'#dfd4bd',resolution:2,stroke:'#17120c',strokeThickness:1,wordWrap:{width:W-100,useAdvancedWrap:true}}).setScrollFactor(0);}
 /** 营帐按钮：沿用首页的漆匾样式；返回可点击区域（保留原 setName / pointerdown 接口）。 */
 private button(x:number,y:number,s:string,fn:()=>void,width=150,enabled=true,height=36,target:Phaser.GameObjects.Container=this.body){
  const cx=x+width/2,cy=y+22,g=this.scene.add.graphics().setScrollFactor(0);
  const cap=this.scene.add.text(cx,cy,s,{fontFamily:HEADING_FONT,fontSize:(D?15:16)+'px',color:'#ffe9bd',resolution:2}).setOrigin(.5).setLetterSpacing(s.length>5?0:2).setScrollFactor(0);
  const hit=this.scene.add.rectangle(cx,cy,width,height,0,.001).setScrollFactor(0);if(enabled)hit.setInteractive({useHandCursor:true});
  let sel=false;const paint=(st:string='idle')=>{if(!g.scene)return;if(st==='selected')sel=true;const ls:LqState=!enabled?'off':st==='selected'?'on':st==='hover'?'hover':st==='pressed'||st==='down'?'down':sel?'on':'idle';g.clear();const d=lqButton(g,cx,cy,width,height,ls,ls==='on'?'gold':'quiet');cap.setY(cy+d).setColor(lqLabelColor(ls));};
  hit.on('pointerover',()=>paint('hover')).on('pointerout',()=>paint()).on('pointerup',()=>paint('hover'));
  if(enabled)hit.on('pointerdown',()=>{paint('down');this.sound('uiClick');fn();});
  paint();target.add([g,cap]);hit.setData('paint',paint);
  return hit;
 }

 open(key:string,destination:string){if(this.visit!==key){this.visit=key;this.page=this.tab=0;this.stock=merchantStockForVisit(key,(this.scene as unknown as {itemTier?:()=>number}).itemTier?.()??0,this.player.growth.build);this.buildSection=this.buildOffset=0;this.notice='';}this.destination=destination;this.homeArmed=false;this.homeBtn.setText('回营寨').setBackgroundColor('rgba(0,0,0,0)').setVisible(!!this.onReturnHome);this.paintHome();this.render();
  // 招兵营圆框胸像（Q 版；缺的兵种用 v2 过渡）：加载完若还停在招兵营就重绘
  loadTroopPortraits(this.scene,()=>{if(this.root.visible&&this.tab===0)this.render();},true);}
 setVisible(visible:boolean){this.root.setVisible(visible);if(!visible){this.modal?.destroy();this.modal=undefined;}}
 private plate(x:number,y:number,w:number,h:number,accent=false){
  const img=this.scene.add.image(x+w/2,y+h/2,warPanelTexture(this.scene,w,h,accent)).setDisplaySize(Math.round(w)+16,Math.round(h)+16).setScrollFactor(0);
  this.body.add(img);return img;
 }
 private card(index:number){const x=D?40+index*(W-68)/3:24,y=D?158:229,w=D?(W-104)/3:W-48,h=D?246:161;return{x,y:y+(D?0:index*174),w,h};}
 private icon(x:number,y:number,key:string,size:number){if(this.scene.textures.exists(key))this.body.add(this.scene.add.image(x,y,key).setDisplaySize(size,size).setScrollFactor(0));}
 private row(y:number,title:string,description:string,icon?:string,compact=false){const x=D?40:24,w=W-(D?80:48),h=D?66:92;this.plate(x,y,w,h);if(icon)this.icon(x+28,y+27,icon,35);const offset=icon?54:16;this.body.add(this.text(x+offset,y+9,title,D?17:19).setWordWrapWidth(w-offset-16,true));this.body.add(this.text(x+16,y+(D?36:43),compact&&description.length>(D?80:44)?description.slice(0,D?80:44)+'…':description,D?12:14).setWordWrapWidth(w-32,true));return{x,y,w,h};}
 /** 军需商人 / 军医（电脑版）：人物不加框、站在左侧帐中（2026-11-18 用户「军医和商人不要一个框框住」），右侧从 STATION_LEFT 起排卡片。 */
 private static readonly FIGURE:FigurePlace={cx:120,bottom:474,height:320};
 private static readonly STATION_LEFT=236;
 private render(){
  this.body.removeAll(true);this.tabs.forEach((t,k)=>{const on=t.getData('tab')===this.tab;t.setColor(on?'#ffe7b0':'#bcae93').setAlpha(on?1:.78);const w=t.width;this.tabFrames[k].setTexture(warPanelTexture(this.scene,w,46,on)).setDisplaySize(w+16,46+16).setVisible(true).setAlpha(on?1:.62);this.tabIcons[k]?.setAlpha(on?1:.6);
   if(on){const to={x:t.x+18,w:w-36};if(!this.lineTo){this.tabLine.setX(to.x);this.tabLine.width=to.w;}this.lineTo=to;}});
  this.resources.setText('随军粮 '+this.army.food+'   /   当前兵力：'+this.army.count);this.next.setText('下一关 · '+this.destination);this.detail.setText(this.notice);
  {const side=D&&(this.tab===2||this.tab===4),l=CampRestUI.STATION_LEFT;this.detail.setX(side?l+(W-40-l)/2:D?W/2:28).setWordWrapWidth(side?W-40-l-16:W-(D?120:56),true);}
  if(this.tab===0)this.renderRecruit();if(this.tab===2)this.renderMarket();if(this.tab===3)this.renderBuild(D?154:229);if(this.tab===4)this.renderMedic();
 }
 // ---------- 军医（data/campMedic.ts）----------
 /** 第几章（定价用），GameScene 打开休整前设置。 */
 chapterNo=1;
 /** 治疗后回调（GameScene 用来把存档里征程构筑的血量一并改掉）。 */
 onHealed?:()=>void;
 private medicFx?:{img:Phaser.GameObjects.Image;t:number;run:()=>void};
 private squad(){return (this.scene as unknown as {followers?:{members:Array<{hp:number;maxHp:number;downed:boolean}>;revive(f:unknown,now:number):void}|null}).followers??null;}
 /** 军医页的状态（测试与界面共用）。 */
 medicState(){
  const p=this.player,ch=this.chapterNo,missing=Math.max(0,1-p.hp/p.maxHp),hale=p.hp>=p.maxHp-.5,sq=this.squad();
  const hurtUnits=this.army.units.filter(u=>u.active&&u.hp<u.maxHp).length,hurtFollowers=(sq?.members??[]).filter(m=>m.downed||m.hp<m.maxHp).length;
  const price={small:medicPrice('small',ch),full:medicPrice('full',ch,missing),army:medicPrice('army',ch)};
  const can={small:!hale&&this.army.food>=price.small,full:!hale&&this.army.food>=price.full,army:hurtUnits+hurtFollowers>0&&this.army.food>=price.army};
  return{hp:Math.ceil(p.hp),maxHp:p.maxHp,hale,food:this.army.food,chapter:ch,price,can,hurtUnits,hurtFollowers};
 }
 /** 施治：扣随军粮、回血；不够粮 / 无伤可治返回 false。 */
 heal(kind:MedicKind):boolean{
  const st=this.medicState();if(!st.can[kind])return false;
  const p=this.player;this.army.food-=st.price[kind];
  if(kind==='small')p.hp=Math.min(p.maxHp,p.hp+p.maxHp*CAMP_MEDIC.small.frac);
  else if(kind==='full')p.hp=p.maxHp;
  else{for(const u of this.army.units)if(u.active)u.hp=u.maxHp;const sq=this.squad();for(const m of sq?.members??[]){if(m.downed)sq!.revive(m,(this.scene as unknown as {combatNow?:number}).combatNow??0);m.hp=m.maxHp;}}
  this.sound('purchase');
  this.notice=kind==='army'?'军医为全军疗伤 · 部曲与随从伤兵皆已痊愈':'军医施治 · 主将生命 '+Math.ceil(p.hp)+' / '+p.maxHp;
  this.onHealed?.();this.render();this.playMedicFx();return true;
 }
 private renderMedic(){
  const st=this.medicState(),p=this.player,name=this.player.growth.character?(getCharacter(this.player.growth.character)?.name??'主将'):'主将';
  // 左：军医站在帐中（不加框；没载到就先空着，载好重绘）。施治药气特效仍用手绘序列帧 medic_herb_fx。
  if(D){drawCampFigure(this.scene,this.body,MEDIC_FIGURE,CampRestUI.FIGURE,()=>{if(this.root.active&&this.tab===4)this.render();});this.loadMedicFx();}
  // 右：主将血量、伤兵，三档治疗
  const x0=D?CampRestUI.STATION_LEFT:24,w0=D?W-40-x0:W-48,y0=D?158:229;
  this.plate(x0,y0,w0,84);
  this.body.add(this.text(x0+16,y0+10,'主将 '+name,D?17:18).setFontFamily(HEADING_FONT).setColor('#f1ddb5'));
  this.body.add(this.text(x0+w0-16,y0+12,'生命 '+st.hp+' / '+st.maxHp,D?16:17).setOrigin(1,0).setColor(st.hale?'#cfe3b0':'#f0b090').setName('camp-medic-hp'));
  const bw=w0-32,ratio=Math.max(0,Math.min(1,st.hp/st.maxHp));
  this.body.add(this.scene.add.rectangle(x0+16,y0+40,bw,8,0x1a120b,.9).setOrigin(0).setScrollFactor(0));
  this.body.add(this.scene.add.rectangle(x0+16,y0+40,Math.max(2,bw*ratio),8,st.hale?0x7f9a52:0xa8442c,1).setOrigin(0).setScrollFactor(0));
  this.body.add(this.text(x0+16,y0+56,'部曲伤兵 '+st.hurtUnits+' 人 · 随从带伤 '+st.hurtFollowers+' 人',D?13:14).setColor('#c9b38a'));
  const rows:Array<[MedicKind,string,string]>=[['small',CAMP_MEDIC.small.name,CAMP_MEDIC.small.desc],['full',CAMP_MEDIC.full.name,CAMP_MEDIC.full.desc],['army',CAMP_MEDIC.army.name,CAMP_MEDIC.army.desc]];
  rows.forEach(([kind,title,desc],i)=>{const y=y0+92+i*(D?52:62),h=D?48:56;this.plate(x0,y,w0,h);
   this.body.add(this.text(x0+16,y+6,title,D?16:17).setFontFamily(HEADING_FONT).setColor('#ecd6a8'));
   this.body.add(this.text(x0+16,y+(D?27:31),desc,D?13:14).setColor('#bba886'));
   const price=st.price[kind],hale=kind==='army'?st.hurtUnits+st.hurtFollowers===0:st.hale;
   const label=hale?(kind==='army'?'全军无恙':'将军无恙'):this.army.food<price?'随军粮不足 · '+price+'粮':'治疗 · '+price+'粮';
   const bw2=D?176:150;this.body.add(this.button(x0+w0-bw2-10,y+(h-44)/2,label,()=>this.heal(kind),bw2,st.can[kind]).setName('camp-medic-'+kind));});
  if(!this.notice)this.detail.setText('前一关所受的伤会带到下一关；军医用随军粮施治，价格随章节递增（第 '+st.chapter+' 章）。');
 }
 private medicFxLoading=false;
 private loadMedicFx(){const s=this.scene;if(this.medicFxLoading||s.textures.exists('medic_herb_fx'))return;this.medicFxLoading=true;const L=s.load;
  L.spritesheet('medic_herb_fx','assets/camp/medic_herb_fx.webp',{frameWidth:256,frameHeight:256});if(!L.isLoading())L.start();}
 /** 治疗成功：立绘上飘一阵手绘淡绿药气（序列帧 medic_herb_fx，6 帧）。休整时场景补间暂停，按真实时间逐帧走。 */
 private playMedicFx(){
  const s=this.scene,key='medic_herb_fx';if(!D||!s.textures.exists(key))return;
  this.medicFx?.img.destroy();if(this.medicFx)s.events.off('postupdate',this.medicFx.run);
  const f=CampRestUI.FIGURE,img=s.add.image(f.cx,f.bottom-f.height*.55,key,0).setDisplaySize(f.height*.8,f.height*.8).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.overlay+3).setName('camp-medic-fx');this.root.add(img);
  const fx={img,t:0,run:()=>{fx.t+=s.game.loop.delta;const f=Math.floor(fx.t/110);if(f>=6||!img.active){s.events.off('postupdate',fx.run);img.destroy();if(this.medicFx===fx)this.medicFx=undefined;return;}img.setFrame(f).setAlpha(f>=4?.8-(f-4)*.3:.85);}};
  this.medicFx=fx;s.events.on('postupdate',fx.run);
 }
 private renderRecruit(){
  // 只保留“招募”：编组位置沿用默认/既有设定，生命不在此展示。价格随在编兵力递增。
  const roles=['持盾护卫 · 近身作战','长枪突刺 · 较远近战','远程弓箭 · 后排支援'];
  INITIAL_TROOPS.forEach((kind,i)=>{const count=this.army.units.filter(a=>a.active&&a.kind===kind).length,{x,y,w,h}=this.card(i);this.plate(x,y,w,h);
   const sheet='shu_'+kind+'_walk_sheet',key=visualTextureKey(this.scene,sheet),sx=x+(D?w/2:58),sy=y+(D?98:80);
   // 圆框胸像（与战地招募卡同款）
   this.body.add(troopBadge(this.scene,kind,sx,sy+(D?0:4),D?52:40,{fixed:true,walkKey:key}).setScrollFactor(0));
   const name=this.text(D?x+w/2:x+112,y+(D?16:20),TROOPS[kind].name,D?22:22).setFontFamily(HEADING_FONT).setColor('#f1ddb5').setShadow(0,1,'#0a0603',3,true,true);if(D)name.setOrigin(.5,0);this.body.add(name);
   const badge=this.text(x+w-16,y+(D?16:20),'在编 '+count,D?14:15).setOrigin(1,0).setColor('#e4c588').setBackgroundColor('rgba(14,10,6,0.7)').setPadding(8,3);this.body.add(badge);
   const role=this.text(D?x+w/2:x+112,y+(D?160:56),roles[i],D?14:15).setColor('#c9b38a');if(D)role.setOrigin(.5,0);this.body.add(role);
   const cost=this.army.recruitCost(kind),poor=this.army.food<cost,bw=D?w-36:w-130;
   const buy=this.button(D?x+18:x+112,y+h-(D?60:58),poor?'随军粮不足 · '+cost+'粮':'招募 · '+cost+'粮',()=>{const ok=this.army.recruit(kind,1);if(ok)this.sound('recruit');this.notice=ok?TROOPS[kind].name+'入队 · 下一名招募价 '+this.army.recruitCost(kind)+'粮':'无法招募';this.render();},bw,!poor).setName('camp-recruit-'+kind);this.body.add(buy);
  });if(!this.notice)this.detail.setText('兵力越多，招募越贵：每名在编士兵使招募价 +20%（当前在编 '+this.army.count+' 人）。');
 }
 /** 军需商人（ui/MerchantShop，与营寨旅商共用）：电脑版左侧立绘，4 件兵装 + 偶尔 1 卷战法；用随军粮，战法学进本局构筑当场生效。 */
 private renderMarket(){
  if(!this.stock)this.stock=merchantStockForVisit(this.visit||'rest',(this.scene as unknown as {itemTier?:()=>number}).itemTier?.()??0,this.player.growth.build);
  this.itemTip??=new ItemTooltip(this.scene,DEPTH.overlay+40);
  this.shop??=new MerchantShop(this.scene,{tooltip:this.itemTip,
   stock:()=>this.stock!,
   wallet:{name:'随军粮',get:()=>this.army.food,spend:n=>{if(this.army.food<n)return false;this.army.food-=n;return true;}},
   tactics:{canBuy:o=>!!campOption(o,this.player),learn:o=>{const op=campOption(o,this.player);if(!op)return false;op.apply(this.player,this.player.weapons,this.player.growth);return true;},afterBuy:()=>this.onLearnTactic?.(),doneText:'本局立即生效，可在「将帅帐」查看'},
   onBuyItem:item=>this.onBuyItem?.(item),owner:()=>this.player.growth.character,
   notice:t=>{this.notice=t;},changed:()=>this.render(),sound:k=>this.sound(k),tooltipDepth:DEPTH.overlay+40});
  this.shop.onArtLoaded=()=>{if(this.root.active&&this.tab===2)this.render();};
  this.shop.render(this.body,D?40:24,D?158:229,D?W-40:W-24,D?250:200,D?CampRestUI.FIGURE:undefined);
  if(!this.notice)this.detail.setText(this.shop.hint());
 }

 private showDetails(title:string,description:string,confirm?:()=>void){
  this.modal?.destroy();const modal=this.scene.add.container(0,0).setScrollFactor(0).setName('camp-details');this.modal=modal;this.root.add(modal);
  modal.add(this.scene.add.rectangle(0,0,W,H,0x080604,.8).setOrigin(0).setScrollFactor(0).setInteractive());
  const w=D?610:W-40,h=D?350:510,x=(W-w)/2,y=(H-h)/2;
  const plate=this.scene.add.graphics().setScrollFactor(0).fillStyle(0x211b12,.98).fillRect(x,y,w,h).lineStyle(2,0xa68b58).strokeRect(x,y,w,h).lineStyle(1,0x5b4b32).strokeRect(x+5,y+5,w-10,h-10);modal.add(plate);
  modal.add(this.text(x+22,y+22,title,D?23:24).setFontFamily(HEADING_FONT).setColor('#eed5a3').setWordWrapWidth(w-44,true));
  const content=this.text(x+22,y+78,description,D?17:19).setWordWrapWidth(w-44,true);while(content.height>h-160&&content.style.fontSize!=='14px')content.setFontSize(Math.max(14,parseInt(content.style.fontSize as string)-1));modal.add(content);
  const close=()=>{modal.destroy();if(this.modal===modal)this.modal=undefined;};
  const action=(cx:number,width:number,label:string,fn:()=>void,primary=false)=>{const hit=this.button(cx-width/2,y+h-62,label,fn,width,true,38,modal).setName(primary?'camp-confirm-replace':'camp-close-details');if(primary)(hit.getData('paint') as (s:string)=>void)('selected');modal.add(hit);};
  if(confirm){action(x+w*.25,w*.42,'取消',close);action(x+w*.75,w*.42,'确认替换',()=>{close();confirm();},true);}else action(W/2,200,'返回',close);
 }
 /** 将帅帐：一屏构筑总览（2026-11-18 用户：「这个玩家看自己 build 不清楚」）。和战斗内「战法构筑」共用 ui/BuildOverview。 */
 private renderBuild(top:number){
  this.itemTip??=new ItemTooltip(this.scene,DEPTH.overlay+40);
  const g=this.player.growth,x=D?40:24,w=W-(D?80:48),h=D?H-110-top:H-top-210;
  drawBuildOverview({scene:this.scene,root:this.body,x,y:top+4,w,h,desktop:D,prefix:'camp-build',growth:g,level:this.player.level,weapon:this.player.weapons[0],tokens:wornTokens(g.character),tokenSlots:tokenSlots(),tooltip:this.itemTip,training:this.army.training});
  if(!this.notice)this.detail.setText('鼠标移到任意格子上看完整说明：战法看效果和下一级，流派条看还差几个来源能觉醒。');
 }
}
