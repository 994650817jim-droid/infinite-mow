import Phaser from 'phaser';import {GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D,FONT,HEADING_FONT,DEPTH,screenPoint} from '../config';import type {Player} from '../entities/Player';import type {Legion} from '../systems/Legion';import {CampMarket,campOption} from '../systems/CampMarket';import {CAMP_TRAINING,type CampTrainingId,type CampGroup} from '../data/camp';import {INITIAL_TROOPS,TROOPS,type TroopKind} from '../data/legion';import {TACTICS,TREASURES,TAG_NAMES,tacticDescription,type TacticId,type TreasureId,type BuildTag} from '../data/builds';import {AWAKENINGS,activeAwakenings} from '../data/awakenings';import {getCharacter} from '../data/characters';import {WEAPON_META} from '../data/upgrades';import {ATTRIBUTE_INFO,MARTIALS,type AttributeId,type MasteryId} from '../systems/RunGrowth';import {MERCHANT_PRICE,QUALITIES,formatAffix,itemName,rollItem,rollQuality,SLOTS,itemSlot,SPECIALS,type ItemInstance} from '../data/items';
import {homeCommand,warPanelTexture} from './HomeCommand';
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
 itemOffer:ItemInstance|null=null;itemSold=false;onBuyItem?:(item:ItemInstance)=>void;
 /** 行囊（休整时可换装、换马）。由 GameScene 设置。 */
 onOpenBag?:()=>void;
 private market?:CampMarket;private visit='';private tab=0;private page=0;private destination='';private notice='';
 constructor(private scene:Phaser.Scene,private player:Player,private army:Legion,depart:()=>void){
  this.root=scene.add.container(0,0).setScrollFactor(0).setDepth(DEPTH.overlay+2).setVisible(false).setName('camp-rest');
  const background=scene.add.image(W/2,H/2,'rest_camp').setScrollFactor(0);
  const source=background.texture.getSourceImage();const cover=Math.max(W/source.width,H/source.height);background.setScale(cover);this.root.add(background);
  this.root.add(scene.add.rectangle(0,0,W,H,0x110e0a,.38).setOrigin(0).setInteractive());
  this.header=this.text(D?40:28,D?18:30,'行营休整',D?27:30).setFontFamily(HEADING_FONT).setColor('#f3e3bf');
  this.resources=this.text(D?40:28,D?57:78,'',D?17:19).setColor('#e6c894');
  this.next=this.text(D?W-40:28,D?30:110,'',D?16:17).setColor('#d2c3a6');if(D)this.next.setOrigin(1,0);
  this.root.add([this.header,this.resources,this.next]);
  const bagBtn=this.text(D?W-40:W-28,D?62:34,'行囊 · 换装换马',D?15:16).setOrigin(1,0).setPadding(12,6,12,6).setBackgroundColor('#7a2a1c').setColor('#ffe9bd').setInteractive({useHandCursor:true}).setName('camp-bag');bagBtn.on('pointerdown',()=>this.onOpenBag?.());this.root.add(bagBtn);
  const labels=['招兵营','练兵营','军需商人','将帅帐'],icons=['icon_shu_swordsman','growth_icon_might','build_icon_return_drum','growth_icon_points'];
  const tabW=D?172:(W-48)/4,tabY=D?96:155;
  labels.forEach((label,i)=>{const x=D?40+i*180:24+i*tabW;const frame=scene.add.image(x+(tabW-6)/2,tabY+23,warPanelTexture(scene,tabW-6,46)).setScrollFactor(0);this.tabFrames.push(frame);this.root.add(frame);
   if(scene.textures.exists(icons[i]))this.root.add(scene.add.image(x+21,tabY+(D?22:21),icons[i]).setDisplaySize(D?29:27,D?29:27).setScrollFactor(0));
   const hit=this.text(x,tabY,label,D?17:16).setPadding(D?43:39,D?12:13,0,0).setFixedSize(tabW-6,46).setInteractive({useHandCursor:true}).setName('camp-tab-'+i);
   hit.on('pointerdown',()=>{this.tab=i;this.page=0;this.notice='';this.render();}).on('pointerover',()=>hit.setColor('#fff0cd')).on('pointerout',()=>hit.setColor(i===this.tab?'#f6dfb0':'#bcae93'));this.tabs.push(hit);this.root.add(hit);
  });
  this.body=scene.add.container(0,0);this.root.add(this.body);
  this.detail=this.text(D?40:28,D?H-103:H-176,'',D?13:15).setWordWrapWidth(W-(D?80:56),true);this.detail.setMaxLines(D?3:5);this.root.add(this.detail);
  const command=homeCommand(scene,W/2,H-(D?35:48),D?290:W-72,D?48:56,'率军出征',true);[command.g,command.caption,command.hit].forEach(o=>o.setScrollFactor(0));command.hit.setName('camp-depart').setData('padDefault',true).on('pointerdown',depart);this.root.add([command.g,command.caption,command.hit]);
 }
 private sound(kind:string){(this.scene as unknown as {sfx?:{play(k:string):void}}).sfx?.play(kind);}
 private text(x:number,y:number,s:string,size=16){return this.scene.add.text(x,y,s,{fontFamily:FONT,fontSize:size+'px',color:'#dfd4bd',resolution:2,stroke:'#17120c',strokeThickness:1,wordWrap:{width:W-100,useAdvancedWrap:true}}).setScrollFactor(0);}
 /** 营帐按钮：沿用首页的漆匾样式；返回可点击区域（保留原 setName / pointerdown 接口）。 */
 private button(x:number,y:number,s:string,fn:()=>void,width=150,enabled=true){
  const c=homeCommand(this.scene,x+width/2,y+22,width,42,s,false,enabled,D?15:16);
  for(const o of [c.g,c.caption,c.hit])o.setScrollFactor(0);this.body.add([c.g,c.caption]);
  if(enabled)c.hit.on('pointerdown',()=>fn());c.hit.setData('paint',c.paint);
  return c.hit;
 }

 open(key:string,destination:string){if(this.visit!==key){this.visit=key;this.market=new CampMarket(this.player);this.page=this.tab=0;this.itemOffer=rollItem(rollQuality('merchant',0));this.itemSold=false;this.buildSection=this.buildOffset=0;this.notice='';}this.destination=destination;this.render();}
 setVisible(visible:boolean){this.root.setVisible(visible);if(!visible){this.modal?.destroy();this.modal=undefined;}}
 private plate(x:number,y:number,w:number,h:number,accent=false){
  const img=this.scene.add.image(x+w/2,y+h/2,warPanelTexture(this.scene,w,h,accent)).setDisplaySize(Math.round(w)+16,Math.round(h)+16).setScrollFactor(0);
  this.body.add(img);return img;
 }
 private card(index:number){const x=D?40+index*(W-68)/3:24,y=D?158:229,w=D?(W-104)/3:W-48,h=D?246:161;return{x,y:y+(D?0:index*174),w,h};}
 private icon(x:number,y:number,key:string,size:number){if(this.scene.textures.exists(key))this.body.add(this.scene.add.image(x,y,key).setDisplaySize(size,size).setScrollFactor(0));}
 private row(y:number,title:string,description:string,icon?:string,compact=false){const x=D?40:24,w=W-(D?80:48),h=D?66:92;this.plate(x,y,w,h);if(icon)this.icon(x+28,y+27,icon,35);const offset=icon?54:16;this.body.add(this.text(x+offset,y+9,title,D?17:19).setWordWrapWidth(w-offset-16,true));this.body.add(this.text(x+16,y+(D?36:43),compact&&description.length>(D?80:44)?description.slice(0,D?80:44)+'…':description,D?12:14).setWordWrapWidth(w-32,true));return{x,y,w,h};}
 private render(){
  this.body.removeAll(true);this.tabs.forEach((t,i)=>{t.setColor(i===this.tab?'#f6dfb0':'#bcae93');const w=t.width;this.tabFrames[i].setTexture(warPanelTexture(this.scene,w,46,i===this.tab)).setDisplaySize(w+16,46+16).setAlpha(i===this.tab?1:.82);});
  this.resources.setText('随军粮 '+this.army.food+'   /   当前兵力：'+this.army.count);this.next.setText('下一关 · '+this.destination);this.detail.setText(this.notice);
  if(this.tab===0)this.renderRecruit();if(this.tab===1)this.renderTraining();if(this.tab===2)this.renderMarket();if(this.tab===3)this.renderBuild(D?154:229);
 }
 private renderRecruit(){
  // 只保留“招募”：编组位置沿用默认/既有设定，生命不在此展示。价格随在编兵力递增。
  const roles=['持盾护卫 · 近身作战','长枪突刺 · 较远近战','远程弓箭 · 后排支援'];
  INITIAL_TROOPS.forEach((kind,i)=>{const count=this.army.units.filter(a=>a.active&&a.kind===kind).length,{x,y,w,h}=this.card(i);this.plate(x,y,w,h);
   const sheet='shu_'+kind+'_walk_sheet',key=visualTextureKey(this.scene,sheet),sx=x+(D?w/2:58),sy=y+(D?98:80);
   const glow=this.scene.add.ellipse(sx,sy+(D?36:30),D?92:70,D?22:18,0xe6c07a,.16).setScrollFactor(0);this.body.add(glow);
   if(this.scene.textures.exists(key))this.body.add(this.scene.add.image(sx,sy,key,'down_0').setDisplaySize(D?108:92,D?108:92).setScrollFactor(0));else this.icon(sx,sy,'icon_shu_'+kind,D?80:72);
   const name=this.text(D?x+w/2:x+112,y+(D?16:20),TROOPS[kind].name,D?22:22).setFontFamily(HEADING_FONT).setColor('#f1ddb5').setShadow(0,1,'#0a0603',3,true,true);if(D)name.setOrigin(.5,0);this.body.add(name);
   const badge=this.text(x+w-16,y+(D?16:20),'在编 '+count,D?14:15).setOrigin(1,0).setColor('#e4c588').setBackgroundColor('rgba(14,10,6,0.7)').setPadding(8,3);this.body.add(badge);
   const role=this.text(D?x+w/2:x+112,y+(D?160:56),roles[i],D?14:15).setColor('#c9b38a');if(D)role.setOrigin(.5,0);this.body.add(role);
   const cost=this.army.recruitCost(kind),poor=this.army.food<cost,bw=D?w-36:w-130;
   const buy=this.button(D?x+18:x+112,y+h-(D?60:58),poor?'随军粮不足 · '+cost+'粮':'招募 · '+cost+'粮',()=>{const ok=this.army.recruit(kind,1);if(ok)this.sound('recruit');this.notice=ok?TROOPS[kind].name+'入队 · 下一名招募价 '+this.army.recruitCost(kind)+'粮':'无法招募';this.render();},bw,!poor).setName('camp-recruit-'+kind);this.body.add(buy);
  });if(!this.notice)this.detail.setText('兵力越多，招募越贵：每名在编士兵使招募价 +20%（当前在编 '+this.army.count+' 人）。');
 }
 private renderTraining(){
  const icons=['growth_icon_constitution','growth_icon_might','growth_icon_heart_mirror'],effects=['最大生命','基础攻击','受到伤害'],notes=['保留当前生命比例，不额外回血','当前与后续招募士兵均生效','与既有防护按原规则结算'];
  (Object.keys(CAMP_TRAINING)as CampTrainingId[]).forEach((id,i)=>{const d=CAMP_TRAINING[id],lv=this.army.training[id],cost=d.costs[lv],{x,y,w,h}=this.card(i);this.plate(x,y,w,h);this.icon(x+(D?w/2:48),y+(D?73:63),icons[i],D?65:58);
   this.body.add(this.text(x+(D?17:96),y+16,d.name,D?22:22).setFontFamily(HEADING_FONT).setColor('#efdbb4'));this.body.add(this.text(x+w-17,y+(D?18:47),'Lv.'+lv+' / 3',D?15:17).setOrigin(1,0).setColor('#d0ad70'));
   const sign=id==='armor'?'−':'+';this.body.add(this.text(x+(D?17:96),y+(D?118:76),effects[i]+' '+sign+Math.round(d.perLevel*lv*100)+'%',D?17:18));
   this.body.add(this.text(x+(D?17:96),y+(D?149:101),lv<3?'下一级 '+sign+Math.round(d.perLevel*(lv+1)*100)+'%':'已完成全部训练',D?14:15).setColor('#b8bb9d'));
   if(D)this.body.add(this.text(x+17,y+174,notes[i],12));
   this.body.add(this.button(x+(D?17:w-168),y+h-55,lv>=3?'已满级':this.army.food<cost?'随军粮不足':'训练 · '+cost+'粮',()=>{const ok=this.army.purchaseCampTraining(id);if(ok)this.sound('purchase');this.notice=ok?'训练完成 · 本战役持续生效':'无法训练';this.render();},D?w-34:154,lv<3&&this.army.food>=cost).setName('camp-training-'+id));
  });if(!this.notice)this.detail.setText('军团训练仅在本次连续战役内保留。体魄训练按原生命比例调整，不免费回满。');
 }
 private renderMarket(){this.market?.offers.forEach((o,i)=>{const option=campOption(o,this.player),d=o.kind==='tactic'?TACTICS[o.id as TacticId]:TREASURES[o.id as TreasureId],{x,y,w,h}=this.card(i);this.plate(x,y,w,h);this.icon(x+38,y+38,'build_icon_'+o.id,47);
  this.body.add(this.text(x+71,y+16,TAG_NAMES[d.tag]+' · '+(o.kind==='tactic'?'战法':'宝物'),D?13:15).setColor('#bca579'));
  const title=(option?.name??d.name);this.body.add(this.text(x+71,y+39,title,D?16:18).setWordWrapWidth(w-84,true));
  const desc=option?.desc??'当前条件已变化，无法购买';const brief=desc.split('\n')[0].split(/[。；]/)[0],summary=brief.length>34?brief.slice(0,34)+'…':brief;const description=this.text(x+16,y+(D?85:72),summary,15).setWordWrapWidth(w-(D?32:177),true).setMaxLines(D?5:2).setName('camp-description-'+i);this.body.add(description);
  const inspect=this.scene.add.rectangle(x+8,y+8,w-16,62,0,0.001).setOrigin(0).setScrollFactor(0).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.showDetails(title,desc+(o.kind==='treasure'?'\n\n'+this.replacementImpact(o.id as TreasureId):'')));this.body.add(inspect);
  this.body.add(this.button(x+(D?17:w-160),y+h-55,o.sold?'已售罄':!option?'不可购买':this.army.food<o.price?'随军粮不足':'购入 · '+o.price+'粮',()=>{if(o.kind==='treasure'&&option?.desc.includes('替换：')){this.showDetails('确认宝物替换',option.desc+'\n\n'+this.replacementImpact(o.id as TreasureId),()=>{const ok=!!this.market?.buy(i,this.player,this.army);if(ok)this.sound('purchase');this.notice=ok?'已替换 · 构筑已更新':'无法购买';this.render();});return;}const ok=!!this.market?.buy(i,this.player,this.army);if(ok)this.sound('purchase');this.notice=ok?'已购入 · 构筑已更新':'无法购买';this.render();},D?w-34:146,!o.sold&&!!option&&this.army.food>=o.price).setName('camp-goods-'+i));
 });if(!this.notice)this.detail.setText('点击商品标题查看完整效果。库存固定；宝物满两格时需确认替换及流派变化。');this.renderItemShelf();}
 /** 兵装货架（一格）：电脑在说明文字右侧，手机在第三张商品卡下方。左端小块可点开看词条。 */
 private renderItemShelf(){
  const item=this.itemOffer;if(!item)return;
  const q=QUALITIES[item.quality],price=MERCHANT_PRICE[item.quality]??120,w=D?330:W-48,x=D?W-40-w:24,y=D?H-112:229+2*174+161+2;
  const can=!this.itemSold&&this.army.food>=price;
  const label='兵装 · '+q.label+' · '+itemName(item)+'　'+(this.itemSold?'已售罄':this.army.food<price?'随军粮不足 · '+price+'粮':'购入 · '+price+'粮');
  const b=this.button(x,y,label,()=>{if(this.itemSold||this.army.food<price)return;this.army.food-=price;this.itemSold=true;this.onBuyItem?.(item);this.sound('purchase');this.notice='已购入 '+itemName(item)+' · 结算后收入行囊';this.render();},w,can).setName('camp-item-goods');
  this.body.add(b);
  const info=this.scene.add.text(x+8,y+22,'详',{fontFamily:FONT,fontSize:'13px',color:q.css,resolution:2}).setOrigin(0,.5).setPadding(6,6).setBackgroundColor('rgba(20,14,8,.9)').setScrollFactor(0).setInteractive({useHandCursor:true}).setName('camp-item-info')
   .on('pointerdown',()=>this.showDetails(q.name+' · '+SLOTS[itemSlot(item)].name+' · '+itemName(item),item.affixes.map(a=>formatAffix(a)).join('\n')+(item.special?'\n★ '+SPECIALS[item.special].name+'：'+SPECIALS[item.special].desc:'')+'\n\n局外兵装：结算后收入行囊，出征前在主页「行囊」穿戴。'));
  this.body.add(info);
 }

 private replacementImpact(id:TreasureId){
  const g=this.player.growth,b=g.build,before=b.tags(),after={...before},old=b.treasures[0];
  const full=b.treasures.length+g.trinkets.length>=2;
  if(!full)return '尚有宝物空位，不替换现有装备。';
  if(old)after[TREASURES[old].tag]--;after[TREASURES[id].tag]++;
  const changes=(Object.keys(TAG_NAMES)as BuildTag[]).filter(t=>before[t]!==after[t]).map(t=>TAG_NAMES[t]+' '+before[t]+' → '+after[t]);
  const remaining=new Set(activeAwakenings(after).map(a=>a.id)),lost=activeAwakenings(before).filter(a=>!remaining.has(a.id));
  const bases=(Object.keys(TAG_NAMES)as BuildTag[]).filter(t=>before[t]>=2&&after[t]<2);
  const oldName=old?TREASURES[old].name:({tiger_tally:'虎符',heart_mirror:'护心镜',wind_boots:'疾风靴'})[g.trinkets[0]];
  return ['被替换：'+oldName+' → '+TREASURES[id].name,'标签变化：'+(changes.join('；')||'无（同系替换）'),'失去基础加成：'+(bases.map(t=>TAG_NAMES[t]).join('、')||'无'),'失去觉醒：'+(lost.map(a=>a.name).join('、')||'无')].join('\n');
 }
 private showDetails(title:string,description:string,confirm?:()=>void){
  this.modal?.destroy();const modal=this.scene.add.container(0,0).setScrollFactor(0).setName('camp-details');this.modal=modal;this.root.add(modal);
  modal.add(this.scene.add.rectangle(0,0,W,H,0x080604,.8).setOrigin(0).setScrollFactor(0).setInteractive());
  const w=D?610:W-40,h=D?350:510,x=(W-w)/2,y=(H-h)/2;
  const plate=this.scene.add.graphics().setScrollFactor(0).fillStyle(0x211b12,.98).fillRect(x,y,w,h).lineStyle(2,0xa68b58).strokeRect(x,y,w,h).lineStyle(1,0x5b4b32).strokeRect(x+5,y+5,w-10,h-10);modal.add(plate);
  modal.add(this.text(x+22,y+22,title,D?23:24).setFontFamily(HEADING_FONT).setColor('#eed5a3').setWordWrapWidth(w-44,true));
  const content=this.text(x+22,y+78,description,D?17:19).setWordWrapWidth(w-44,true);while(content.height>h-160&&content.style.fontSize!=='14px')content.setFontSize(Math.max(14,parseInt(content.style.fontSize as string)-1));modal.add(content);
  const close=()=>{modal.destroy();if(this.modal===modal)this.modal=undefined;};
  const action=(cx:number,width:number,label:string,fn:()=>void,primary=false)=>{const c=homeCommand(this.scene,cx,y+h-40,width,48,label,primary);[c.g,c.caption,c.hit].forEach(o=>o.setScrollFactor(0));c.hit.setName(primary?'camp-confirm-replace':'camp-close-details').on('pointerdown',fn);modal.add([c.g,c.caption,c.hit]);};
  if(confirm){action(x+w*.25,w*.42,'取消',close);action(x+w*.75,w*.42,'确认替换',()=>{close();confirm();},true);}else action(W/2,200,'返回',close);
 }
 private renderBuild(top:number){
  const g=this.player.growth,b=g.build,tags=b.tags(),active=activeAwakenings(tags),hero=getCharacter(g.character);
  const missing=(a:typeof AWAKENINGS[number])=>a.tags.map(t=>({tag:t,n:Math.max(0,(a.tags.length===1?4:2)-tags[t])})).filter(t=>t.n>0);
  const pending=AWAKENINGS.filter(a=>missing(a).length).sort((a,c)=>missing(a).reduce((n,t)=>n+t.n,0)-missing(c).reduce((n,t)=>n+t.n,0));
  const condition=(a:typeof AWAKENINGS[number])=>missing(a).map(t=>TAG_NAMES[t.tag]+'缺'+t.n+'个不同来源').join('；');
  const names=['武将总览','战法','宝物','流派觉醒'],cw=(W-(D?80:48))/4;
  names.forEach((name,i)=>{const btn=this.button((D?40:24)+i*cw,top,name,()=>{this.buildSection=i;this.buildOffset=0;this.notice='';this.render();},cw-6).setName('camp-build-section-'+i);if(i===this.buildSection)(btn.getData('paint') as (s:string)=>void)('selected');this.body.add(btn);});
  const entries:Array<{name:string;desc:string;icon?:string}>=[];
  if(this.buildSection===0){
   const weapon=this.player.weapons[0],arts=(Object.keys(MARTIALS)as MasteryId[]).filter(id=>MARTIALS[id].character===g.character).map(id=>MARTIALS[id].name+' Lv.'+g.masteries[id]).join(' / ');
   entries.push({name:hero.name+' · '+(weapon?WEAPON_META[weapon.id].name+' Lv.'+weapon.level:''),desc:arts});
   entries.push({name:'当前构筑 · 战法'+Object.keys(b.tactics).filter(id=>b.level(id as TacticId)>0).length+'/6 · 宝物'+(b.treasures.length+g.trinkets.length)+'/2',desc:(Object.keys(b.tactics)as TacticId[]).filter(id=>b.level(id)>0).map(id=>TACTICS[id].name+' '+b.level(id)).join(' / ')||'尚未获得战法；在升级或军需商人处构筑。'});
   entries.push({name:'已激活觉醒 · '+active.length,desc:active.map(a=>a.name).join(' / ')||'暂未觉醒；同系4来源或指定双系各2来源激活。'});
   entries.push({name:pending[0]?'下一目标 · '+pending[0].name:'全部觉醒已满足',desc:pending[0]?condition(pending[0]):'所有觉醒条件已满足'});
   entries.push({name:'属性 · 剩余'+g.unallocated+'点',desc:(Object.keys(ATTRIBUTE_INFO)as AttributeId[]).map(id=>ATTRIBUTE_INFO[id].name+g.attributes[id]).join(' / ')});
   entries.push({name:'军团训练',desc:'体魄'+this.army.training.hp+' / 兵刃'+this.army.training.attack+' / 甲胄'+this.army.training.armor+'；仅本次连续战役有效'});
  }
  if(this.buildSection===1){for(const id of Object.keys(b.tactics)as TacticId[])if(b.level(id)>0)entries.push({name:TACTICS[id].name+' Lv.'+b.level(id)+'/3 · '+TAG_NAMES[TACTICS[id].tag],desc:tacticDescription(id,b.level(id)),icon:'build_icon_'+id});for(const id of Object.keys(MARTIALS)as MasteryId[])if(MARTIALS[id].character===g.character)entries.push({name:'专属 · '+MARTIALS[id].name+' Lv.'+g.masteries[id]+'/3',desc:MARTIALS[id].desc});}
  if(this.buildSection===2){for(const id of b.treasures)entries.push({name:TREASURES[id].name+' · '+TAG_NAMES[TREASURES[id].tag],desc:TREASURES[id].desc,icon:'build_icon_'+id});for(const id of g.trinkets)entries.push({name:({tiger_tally:'虎符',heart_mirror:'护心镜',wind_boots:'疾风靴'})[id],desc:'占用同一宝物容量。购买新宝物时预览被替换装备和流派变化。',icon:'growth_icon_'+id});if(!entries.length)entries.push({name:'宝物栏 · 0 / 2',desc:'暂无装备，可在军需商人处购买。无免费换装或重置。'});}
  if(this.buildSection===3){for(const a of [...active,...pending])entries.push({name:(missing(a).length?'未激活 · ':'已激活 · ')+a.name,desc:missing(a).length?condition(a)+'。'+a.desc:a.desc,icon:a.icon});entries.push({name:'八系标签进度',desc:(Object.keys(TAG_NAMES)as BuildTag[]).map(t=>TAG_NAMES[t]+' '+tags[t]+'/4').join(' / ')});}
  const count=D?4:5,step=D?46:80,start=top+(D?50:55);
  this.buildOffset=Math.max(0,Math.min(this.buildOffset,Math.max(0,entries.length-count)));
  const shift=(delta:number)=>{this.buildOffset=Math.max(0,Math.min(this.buildOffset+delta,Math.max(0,entries.length-count)));this.render();};
  entries.slice(this.buildOffset,this.buildOffset+count).forEach((e,i)=>{
   const x=D?40:24,y=start+i*step,w=W-(D?80:48),h=D?step-2:step-6;this.plate(x,y,w,h);if(e.icon)this.icon(x+25,y+23,e.icon,32);const pad=e.icon?48:14;
   this.body.add(this.text(x+pad,y+(D?5:7),e.name,D?14:18).setWordWrapWidth(w-pad-12,true).setMaxLines(1));
   this.body.add(this.text(x+14,y+(D?26:35),e.desc,D?11:14).setWordWrapWidth(w-28,true).setMaxLines(D?1:2));
   let downY=0;const hit=this.scene.add.rectangle(x,y,w,h,0,.001).setOrigin(0).setScrollFactor(0).setInteractive({useHandCursor:true}).setName('camp-build-entry-'+(this.buildOffset+i));
   hit.on('pointerdown',(p:Phaser.Input.Pointer)=>{downY=screenPoint(p).y;}).on('pointerup',(q:Phaser.Input.Pointer)=>{const p=screenPoint(q);if(Math.abs(p.y-downY)>24)shift(p.y<downY?1:-1);else this.showDetails(e.name,e.desc);}).on('wheel',(_p:unknown,_dx:number,dy:number)=>shift(dy>0?1:-1));this.body.add(hit);
  });
  const controlY=D?H-151:H-255;
  this.body.add(this.button(D?40:24,controlY,'↑ 上移',()=>shift(-1),110,this.buildOffset>0));
  this.body.add(this.text(W/2,controlY+13,entries.length>count?'滑动查看 · '+entries.length+'项':'共 '+entries.length+' 项',D?13:15).setOrigin(.5,0));
  this.body.add(this.button(W-(D?150:134),controlY,'下移 ↓',()=>shift(1),110,this.buildOffset+count<entries.length));
  if(!this.notice)this.detail.setText('分类查看当前构筑 · 点条目查看完整说明。宝物替换仅在购买时确认，不提供免费换装。');
 }
}
