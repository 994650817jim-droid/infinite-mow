import Phaser from 'phaser';
import {GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D,FONT,HEADING_FONT,DEPTH} from '../config';
import {ItemTooltip} from './ItemTooltip';import {itemTile} from './ItemQuality';import {warPanelTexture} from './HomeCommand';import {lqButton,lqLabelColor,type LqState} from './LacquerKit';
import {MERCHANT_PRICE,QUALITIES,formatAffix,itemName,SLOTS,itemSlot,SPECIALS,type ItemInstance} from '../data/items';
import {TACTICS,TAG_NAMES,tacticDescription} from '../data/builds';
import type {CharacterId} from '../data/characters';
import {addItems,loadout,type GearOwner} from '../systems/ItemStore';
import {currentMerchantStock,saveMerchantStock,type MerchantStock} from '../systems/MerchantStock';
import {campaignTacticBook,learnCampaignTactic} from '../systems/Campaign';
import type {CampOffer} from '../systems/CampMarket';
import {MERCHANT_FIGURE,drawCampFigure,loadCampFigure,type FigurePlace} from './CampFigure';

/**
 * 军需商人（2026-11-18）：行营休整「军需商人」页与义军营寨「旅商」共用这一个货架与界面。
 * 货在 systems/MerchantStock（同一份、含已售），钱包与战法怎么学由调用方给：
 * - 行营休整：随军粮 + 本局构筑（当场生效），见 ui/CampRestUI；
 * - 营寨旅商：openMerchantShop(scene, {wallet,…})，战法写进征程构筑（下次出征生效）。
 */
export const MERCHANT_ART_KEY=MERCHANT_FIGURE.key;
export const MERCHANT_ART_PATH=MERCHANT_FIGURE.path;
/** 付账用的粮：name 用于按钮（「粮不足」）与提示；spend 失败返回 false。 */
export interface MerchantWallet{name:string;get():number;spend(amount:number):boolean;}
/** 战法卷轴怎么学：canBuy 现在能不能学（等级没变、没满）；learn 学下并返回是否成功。 */
export interface MerchantTactics{canBuy(offer:CampOffer):boolean;learn(offer:CampOffer):boolean;doneText:string;lockedText?:string;/** 学下并付过粮之后（行营用来改存档点）。 */afterBuy?:()=>void;}
export interface MerchantShopOptions{
 stock:()=>MerchantStock;wallet:MerchantWallet;tactics:MerchantTactics|null;
 onBuyItem:(item:ItemInstance)=>void;owner:()=>GearOwner|undefined;
 notice:(text:string)=>void;changed:()=>void;sound?:(kind:string)=>void;tooltipDepth?:number;
 /** 宿主已有的兵装提示框（行营与将帅帐共用一个）；不给就自己建。 */
 tooltip?:ItemTooltip;
}
/** 把立绘排进加载队列（已在 / 正在载就跳过）；载好回调。 */
export function loadMerchantArt(scene:Phaser.Scene,done?:()=>void):void{
 loadCampFigure(scene,MERCHANT_FIGURE,done);
}
export class MerchantShop{
 private tip?:ItemTooltip;private root!:Phaser.GameObjects.Container;
 /** 立绘载好时调用（宿主重绘）。 */
 onArtLoaded?:()=>void;
 constructor(private scene:Phaser.Scene,private o:MerchantShopOptions){}
 private text(x:number,y:number,s:string,size=16){const t=this.scene.add.text(x,y,s,{fontFamily:FONT,fontSize:size+'px',color:'#dfd4bd',resolution:2,stroke:'#17120c',strokeThickness:1,wordWrap:{width:W-100,useAdvancedWrap:true}}).setScrollFactor(0);this.root.add(t);return t;}
 private plate(x:number,y:number,w:number,h:number,accent=false){const img=this.scene.add.image(x+w/2,y+h/2,warPanelTexture(this.scene,w,h,accent)).setDisplaySize(Math.round(w)+16,Math.round(h)+16).setScrollFactor(0);this.root.add(img);return img;}
 private button(x:number,y:number,s:string,fn:()=>void,width:number,enabled:boolean,height=36){
  const cx=x+width/2,cy=y+22,g=this.scene.add.graphics().setScrollFactor(0);
  const cap=this.scene.add.text(cx,cy,s,{fontFamily:HEADING_FONT,fontSize:(D?15:16)+'px',color:'#ffe9bd',resolution:2}).setOrigin(.5).setLetterSpacing(s.length>5?0:2).setScrollFactor(0);
  const hit=this.scene.add.rectangle(cx,cy,width,height,0,.001).setScrollFactor(0);if(enabled)hit.setInteractive({useHandCursor:true});
  const paint=(st:LqState)=>{if(!g.scene)return;const ls:LqState=enabled?st:'off';g.clear();const d=lqButton(g,cx,cy,width,height,ls,'quiet');cap.setY(cy+d).setColor(lqLabelColor(ls));};
  hit.on('pointerover',()=>paint('hover')).on('pointerout',()=>paint('idle')).on('pointerup',()=>paint('hover'));
  if(enabled)hit.on('pointerdown',()=>{paint('down');this.o.sound?.('uiClick');fn();});
  paint('idle');this.root.add([g,cap,hit]);return{hit,cap};
 }
 /** 画进 root（宿主每次重绘前清空 root）：电脑版左侧军需商人（不加框，站在帐中），右侧 4 件兵装 + 偶尔 1 卷战法。
  *  figure：人物位置（默认在 left 起 196 宽的一栏里、比卡片高出一截）。 */
 render(root:Phaser.GameObjects.Container,left:number,top:number,right:number,h:number,figure?:FigurePlace){
  this.root=root;const s=this.o.stock(),t=s.tactic,n=s.items.length+(t?1:0),gap=10;
  this.tip??=this.o.tooltip??new ItemTooltip(this.scene,this.o.tooltipDepth??DEPTH.overlay+40);
  if(D){drawCampFigure(this.scene,root,MERCHANT_FIGURE,figure??{cx:left+92,bottom:top+h+18,height:h+50},()=>this.onArtLoaded?.());left=Math.max(left+196,figure?figure.cx+108:0);}
  const w=D?((right-left)-gap*(n-1))/n:(right-left-gap)/2;
  const at=(i:number)=>D?{x:left+i*(w+gap),y:top}:{x:left+(i%2)*(w+gap),y:top+Math.floor(i/2)*(h+gap)};
  s.items.forEach((item,i)=>this.itemCard(s,item,i,at(i).x,at(i).y,w,h));
  if(t){const p=at(s.items.length);this.tacticCard(s,t,p.x,p.y,w,h);}
 }
 hint():string{const t=this.o.stock().tactic;return t?'今日商人还捎来一卷战法（偶尔才有）：'+(this.o.tactics?.doneText.startsWith('本局')?'买下当场学会或精进一级，本局生效':'买下写进征程构筑，下次出征生效')+'；最多 6 种战法、每种到 3 级。':'每次进营 4 件兵装，甲胄、头盔、战靴、信物各一；偶尔还捎来一卷战法。鼠标移到卡片上看属性对比，买下的立即收入行囊。';}
 private itemCard(s:MerchantStock,item:ItemInstance,i:number,x:number,y:number,w:number,h:number){
  const q=QUALITIES[item.quality],price=MERCHANT_PRICE[item.quality]??120,sold=s.sold[i],purse=this.o.wallet.get();
  this.plate(x,y,w,h);
  const lines=item.affixes.map(a=>(a.minor?'· ':'')+formatAffix(a)).join('\n')+(item.special?'\n★ '+SPECIALS[item.special].name:'');
  if(D){
   this.root.add(itemTile(this.scene,x+w/2,y+38,50,item).setScrollFactor(0));
   this.text(x+w/2,y+68,q.name+' · '+SLOTS[itemSlot(item)].name,12).setOrigin(.5,0).setColor('#bca579');
   this.text(x+w/2,y+84,itemName(item),15).setOrigin(.5,0).setColor(q.css).setWordWrapWidth(w-12,true).setMaxLines(1).setName('camp-item-name-'+i);
   this.text(x+12,y+108,lines,12).setLineSpacing(2).setWordWrapWidth(w-22,true).setMaxLines(5).setColor('#d8ccb0');
  }else{
   this.root.add(itemTile(this.scene,x+40,y+42,56,item).setScrollFactor(0));
   this.text(x+76,y+16,q.name+' · '+SLOTS[itemSlot(item)].name,14).setColor('#bca579');
   this.text(x+76,y+36,itemName(item),18).setColor(q.css).setName('camp-item-name-'+i);
   this.text(x+16,y+78,lines,14).setLineSpacing(3).setWordWrapWidth(w-32,true).setMaxLines(4).setColor('#d8ccb0');
  }
  const hover=this.scene.add.rectangle(x+4,y+4,w-8,h-64,0,.001).setOrigin(0).setScrollFactor(0).setInteractive().setName('camp-item-card-'+i);this.root.add(hover);
  const owner=this.o.owner();this.tip!.attach(hover,()=>item,()=>owner?loadout(owner)[itemSlot(item)]:undefined);
  const bw=Math.min(w-20,180),poor=purse<price;
  const {hit,cap}=this.button(x+(w-bw)/2,y+h-52,sold?'已售罄':poor?(D?'粮不足 · ':this.o.wallet.name+'不足 · ')+price+'粮':'购入 · '+price+'粮',()=>{
   const cur=this.o.stock();if(cur.sold[i]||!this.o.wallet.spend(price))return;cur.sold[i]=true;saveMerchantStock(cur);
   this.o.onBuyItem(item);this.o.sound?.('purchase');this.o.notice('已购入 '+itemName(item)+' · 已收入行囊，可点「行囊」穿戴');this.o.changed();
  },bw,!sold&&!poor);
  hit.setName('camp-item-goods-'+i).setData('caption',cap);cap.setName('camp-item-price-'+i);
 }
 /** 战法卷轴卡：漆底描金外框里一幅宣纸手卷（上下卷轴），写战法名、流派、等级与下一级效果。 */
 private tacticCard(s:MerchantStock,t:CampOffer,x:number,y:number,w:number,h:number){
  const d=TACTICS[t.id],next=t.level+1,tac=this.o.tactics,able=!!tac&&tac.canBuy(t),poor=this.o.wallet.get()<t.price;
  this.plate(x,y,w,h,true).setName('camp-tactic-card');
  const px=x+9,pw=w-18,py=y+12,ph=h-74,g=this.scene.add.graphics().setScrollFactor(0);
  g.fillStyle(0xe8dcc0,.96).fillRect(px,py,pw,ph).lineStyle(1,0xb59a6a,.8).strokeRect(px+3,py+3,pw-6,ph-6);
  for(const ry of [py-3,py+ph-3]){g.fillStyle(0x3b2414,1).fillRect(px-5,ry,pw+10,6);g.fillStyle(0xc9a35a,1).fillRect(px-8,ry-1,5,8).fillRect(px+pw+3,ry-1,5,8);}
  this.root.add(g);
  const ink=(tx:number,ty:number,str:string,size:number,color:string)=>this.text(tx,ty,str,size).setColor(color).setStroke('#000',0);
  if(this.scene.textures.exists('build_icon_'+t.id))this.root.add(this.scene.add.image(x+w/2,py+(D?28:26),'build_icon_'+t.id).setDisplaySize(D?36:34,D?36:34).setScrollFactor(0));
  ink(x+w/2,py+50,TAG_NAMES[d.tag]+'系 · 战法',12,'#8a5a2a').setOrigin(.5,0);
  ink(x+w/2,py+66,d.name+' '+(t.level?'Lv.'+t.level+'→'+next:'Lv.1'),D?15:17,'#2a170b').setOrigin(.5,0).setFontFamily(HEADING_FONT).setName('camp-tactic-name');
  ink(px+8,py+90,tacticDescription(t.id,next),D?11:13,'#3b2a18').setLineSpacing(1).setWordWrapWidth(pw-16,true).setMaxLines(D?5:3).setName('camp-tactic-desc');
  ink(px+pw-7,py+6,t.level?'精进':'新学',11,'#a3341c').setOrigin(1,0);
  const label=t.sold?'已研习':!tac?(this.o.tactics===null?'出征后可研习':'已无法研习'):!able?(tac.lockedText??'已无法研习'):poor?(D?'粮不足 · ':this.o.wallet.name+'不足 · ')+t.price+'粮':(t.level?'精进 · ':'研习 · ')+t.price+'粮',bw=Math.min(w-20,180);
  this.button(x+(w-bw)/2,y+h-52,label,()=>{
   const cur=this.o.stock().tactic;if(!cur||cur.sold||!tac||!tac.canBuy(cur)||this.o.wallet.get()<cur.price)return;
   const lv=cur.level;if(!tac.learn(cur))return;this.o.wallet.spend(cur.price);cur.sold=true;saveMerchantStock(this.o.stock());tac.afterBuy?.();
   this.o.sound?.('purchase');this.o.notice('研习战法「'+d.name+'」'+(lv?'Lv.'+lv+'→'+(lv+1):'Lv.1')+' · '+tac.doneText);this.o.changed();
  },bw,!t.sold&&able&&!poor).hit.setName('camp-tactic-buy');
  void s;
 }
 hideTip(){this.tip?.hide();}
 destroy(){if(this.tip!==this.o.tooltip)this.tip?.destroy();this.tip=undefined;}
}

export interface OpenMerchantOptions{
 /** 付账的粮（营寨用军粮）。 */
 wallet:MerchantWallet;
 /** 兵装品质档位（同 GameScene.itemTier：0 一章、1 二章、2 三章起）。只在还没有货架时用来摆货。 */
 tier:number;
 /** 当前武将：卷轴战法写进他的征程构筑；行囊对比也按他的穿戴。不给或还没有征程构筑时，卷轴显示「出征后可研习」。 */
 hero?:CharacterId;
 /** 买下的兵装（默认直接进行囊 addItems）。 */
 onBuyItem?:(item:ItemInstance)=>void;
 /** 关闭后回调。reason：'leave' = 玩家点「离开」/ Esc / 调用返回的关闭函数；'shutdown' = 场景正在关闭（这时别重绘场景，否则重进同一场景会卡住）。 */
 onClose?:(reason:'leave'|'shutdown')=>void;
 title?:string;depth?:number;sound?:(kind:string)=>void;
}
/**
 * 在任意场景里打开军需商人（营寨「旅商」摊位用）：全屏遮罩上的商人面板，与行营休整同一份货（不换货、已售不补）。
 * 返回关闭函数；Esc 或「离开」也会关。对象名：merchant-shop（根）、merchant-close、merchant-purse，卡片同行营（camp-item-goods-i / camp-tactic-buy）。
 */
export function openMerchantShop(scene:Phaser.Scene,opts:OpenMerchantOptions):()=>void{
 const depth=opts.depth??DEPTH.overlay+20,root=scene.add.container(0,0).setScrollFactor(0).setDepth(depth).setName('merchant-shop');
 root.add(scene.add.rectangle(0,0,W,H,0x0b0805,.82).setOrigin(0).setScrollFactor(0).setInteractive());
 const px=24,ph=D?Math.min(H-40,440):H-120,py=D?Math.round((H-ph)/2):60,pw=W-48;
 root.add(scene.add.image(px+pw/2,py+ph/2,warPanelTexture(scene,pw,ph)).setDisplaySize(pw+16,ph+16).setScrollFactor(0));
 const title=scene.add.text(px+22,py+16,opts.title??'军需商人 · 旅商',{fontFamily:HEADING_FONT,fontSize:(D?24:26)+'px',color:'#f3e3bf',resolution:2}).setScrollFactor(0);
 const purse=scene.add.text(px+pw-22,py+22,'',{fontFamily:FONT,fontSize:'16px',color:'#e6c894',resolution:2}).setOrigin(1,0).setScrollFactor(0).setName('merchant-purse');
 const note=scene.add.text(W/2,0,'',{fontFamily:FONT,fontSize:(D?13:15)+'px',color:'#dfd4bd',resolution:2,align:'center',wordWrap:{width:pw-60,useAdvancedWrap:true}}).setOrigin(.5,0).setScrollFactor(0);
 const body=scene.add.container(0,0);root.add([title,purse,body,note]);
 const hero=opts.hero,book=()=>hero?campaignTacticBook(hero):null;
 const tactics:MerchantTactics|null=hero&&book()?{canBuy:o=>{const b=book();return !!b&&b.canLearn(o.id)&&b.level(o.id)===o.level;},learn:o=>learnCampaignTactic(hero,o.id,o.level),doneText:'已写进征程构筑，下次出征生效',lockedText:'已无法研习'}:null;
 const stock=currentMerchantStock(opts.tier,book()??undefined);
 let notice='',closed=false;
 const shop=new MerchantShop(scene,{stock:()=>stock,wallet:opts.wallet,tactics,onBuyItem:opts.onBuyItem??(item=>addItems([item])),owner:()=>hero,notice:t=>{notice=t;},changed:()=>draw(),sound:opts.sound,tooltipDepth:depth+10});
 const top=py+64,h=D?250:200;
 const draw=()=>{if(closed)return;shop.hideTip();body.removeAll(true);shop.render(body,px+16,top,px+pw-16,h);purse.setText(opts.wallet.name+' '+opts.wallet.get());note.setY(D?top+h+18:H-210).setText(notice||shop.hint());};
 shop.onArtLoaded=draw;
 const finish=(reason:'leave'|'shutdown')=>{if(closed)return;closed=true;scene.input.keyboard?.off('keydown-ESC',close);scene.events.off('shutdown',onShutdown);shop.destroy();root.destroy();opts.onClose?.(reason);};
 const close=()=>finish('leave'),onShutdown=()=>finish('shutdown');
 // 离开
 const bw=180,bx=W/2-bw/2,by=py+ph-56,g=scene.add.graphics().setScrollFactor(0);
 const cap=scene.add.text(W/2,by+22,'离开',{fontFamily:HEADING_FONT,fontSize:'16px',color:'#ffe9bd',resolution:2}).setOrigin(.5).setLetterSpacing(4).setScrollFactor(0);
 const hit=scene.add.rectangle(W/2,by+22,bw,38,0,.001).setScrollFactor(0).setInteractive({useHandCursor:true}).setName('merchant-close');
 const paint=(st:LqState)=>{g.clear();const d=lqButton(g,W/2,by+22,bw,38,st,'gold');cap.setY(by+22+d).setColor(lqLabelColor(st));};
 hit.on('pointerover',()=>paint('hover')).on('pointerout',()=>paint('idle')).on('pointerdown',()=>{paint('down');opts.sound?.('uiClick');close();});paint('idle');void bx;
 root.add([g,cap,hit]);
 scene.input.keyboard?.on('keydown-ESC',close);scene.events.once('shutdown',onShutdown);
 draw();return close;
}
