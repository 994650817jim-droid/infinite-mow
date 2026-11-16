import Phaser from 'phaser';
import {CHARACTERS} from '../data/characters';
import {TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import {CHARACTER_PASSIVES} from '../data/passives';
import {WEAPON_META} from '../data/upgrades';
import {MARTIALS} from '../systems/RunGrowth';
import {FONT,HEADING_FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D,BALANCE} from '../config';
import {visualTextureKey} from '../systems/ReadableTextures';
import {lqButton,lqHitBox,lqPanel,lqSkin,type LqState} from './LacquerKit';
const passiveDetails=['命中积攒龙胆，满7层后下次枪刺额外出枪、距离增加。','一刀命中至少3名敌人积累武势，强化刀斩范围；满层后强化下一刀。','连续3秒不受伤进入神射状态：增加暴击率，连弩多射一箭。','战旗命中至少3名敌人积累谋略，满层后扩大火阵并附加灼烧。'];
/** Read-only troop codex; hero selection reuses the menu's existing confirmation callback. */
export class GameCodex {
 readonly root:Phaser.GameObjects.Container;private content:Phaser.GameObjects.Container;private tab:'hero'|'troop'='hero';private index=0;
 constructor(private scene:Phaser.Scene,private selectHero:(index:number)=>void){
  this.root=scene.add.container(0,0).setDepth(550).setName('game-codex');this.content=scene.add.container(0,0);
  // 漆底描金整屏卷（与结算卷、行囊同系）；页签、卡片、按钮都是漆金三态
  this.root.add(scene.add.rectangle(W/2,H/2,W,H,0x0c0805,.96).setInteractive());
  const frame=scene.add.graphics();lqPanel(frame,8,8,W-16,H-16,{shadow:false});this.root.add(frame);
  this.root.add(this.text(W/2,D?40:46,'将士图鉴',28,HEADING_FONT).setOrigin(.5).setColor('#f6dc9a').setStroke('#2a170b',4));
  this.tabs=['武将','兵种'].map((label,i)=>{const t=this.text(W/2+(i?72:-72),D?76:92,label,18,HEADING_FONT).setOrigin(.5).setInteractive({useHandCursor:true}).setName('codex-tab-'+i).on('pointerdown',()=>{this.tab=i?'troop':'hero';this.index=0;this.render();});
   const skin=lqSkin(scene,t,t,()=>({w:120,h:38}),{tone:'auto',on:()=>(this.tab==='troop')===(i===1)});lqHitBox(t,120,38);this.root.add([skin.gfx,t]);return skin;});
  this.root.add(this.content);
  const close=this.text(W/2,H-(D?32:40),'返回首页',18,HEADING_FONT).setOrigin(.5).setInteractive({useHandCursor:true}).setName('codex-close').on('pointerdown',()=>this.root.destroy());
  const cs=lqSkin(scene,close,close,()=>({w:200,h:42}),{tone:'quiet'});lqHitBox(close,200,42);this.root.add([cs.gfx,close]);this.render();
 }
 private tabs:Array<{repaint:(s?:LqState)=>void}>=[];
 private text(x:number,y:number,value:string,size=16,font=FONT){return this.scene.add.text(x,y,value,{fontFamily:font,fontSize:size+'px',color:'#e9d5b0',resolution:2}).setScrollFactor(0);}
 private render():void{
  this.content.removeAll(true);for(const t of this.tabs)t.repaint();
  const hero=this.tab==='hero',items=hero?CHARACTERS.map(c=>c.name):TROOP_KINDS.map(k=>TROOPS[k].name),cols=D?3:4;
  // 电脑：左侧 3 列小卡（头像 + 名字），右侧详情；手机：上方 4 列卡片，详情紧跟在卡片下方（按行数排，不再与卡片重叠）
  const cw=D?118:(W-52-24)/4,ch=D?60:104,gap=D?8:8,gx=D?24:26,gy=D?112:124;
  for(const [i,name]of items.entries()){
   const x=gx+cw/2+(i%cols)*(cw+gap),y=gy+ch/2+Math.floor(i/cols)*(ch+gap),sel=this.index===i;
   const g=this.scene.add.graphics();let st:LqState=sel?'on':'idle';const paint=()=>{g.clear();lqButton(g,x,y,cw,ch,st,sel?'cinnabar':'quiet');};paint();
   const hit=this.scene.add.rectangle(x,y,cw,ch,0,.001).setInteractive({useHandCursor:true}).setName('codex-item-'+i).on('pointerdown',()=>{this.index=i;this.render();})
    .on('pointerover',()=>{if(!sel){st='hover';paint();}}).on('pointerout',()=>{if(!sel){st='idle';paint();}});
   this.content.add([g,hit]);
   const def=hero?null:TROOPS[TROOP_KINDS[i]],key=hero?CHARACTERS[i].portrait:visualTextureKey(this.scene,def!.walkVisual?.texture??(def!.art.startsWith('xiliang')?def!.art+'_walk':def!.art+'_walk_sheet'));
   if(this.scene.textures.exists(key))this.content.add(this.scene.add.image(D?x-cw/2+28:x,D?y-1:y-15,key,hero?undefined:'down_0').setDisplaySize(D?46:58,D?46:58));
   this.content.add(this.text(D?x+18:x,D?y:y+35,name,D?15:15,HEADING_FONT).setOrigin(.5).setColor(sel?'#fff3d6':'#e9d5b0'));
  }
  const gridBottom=gy+Math.ceil(items.length/cols)*(ch+gap);
  const x=D?gx+cols*(cw+gap)+22:36,y=D?112:gridBottom+16,width=D?W-x-36:W-72;
  if(D){const sep=this.scene.add.graphics();sep.lineStyle(1,0xc9a35e,.4).lineBetween(x-12,112,x-12,H-80);this.content.add(sep);}
  let name='',body='';
  if(hero){const c=CHARACTERS[this.index];name=c.name+' · '+c.desc;body=`初始生命：${Math.round(BALANCE.player.maxHp*c.hpMul)}\n移动速度：${Math.round(BALANCE.player.speed*c.speedMul)}\n伤害倍率：${c.damageMul.toFixed(2)}\n本命兵器：${WEAPON_META[c.startWeapon].name}\n\n天赋被动 · ${CHARACTER_PASSIVES[c.id].name}\n${passiveDetails[this.index]}\n\n专属武艺\n${Object.values(MARTIALS).filter(m=>m.character===c.id).map(m=>m.name).join(' / ')}`;}
  else{const d=TROOPS[TROOP_KINDS[this.index] as TroopKind];name=d.name+' · 基础Lv.1';body=`生命 ${d.hp}    护甲 ${d.armor}\n每次伤害 ${d.damage}    攻击间隔 ${d.cooldown}秒\n射程 ${d.range}    移速 ${d.speed}\n招募消耗 ${d.cost}军粮\n\n${d.perk}\n\n${['保护前排、格挡普通攻击。','保持刺击距离，优先应对骑兵。','后排射击，优先敌方远程。','后排快速连射，集火威胁目标。','承受前线压力，正面减伤。','短距离突击后回到队伍。','横扫附近敌群。','不主动攻击，优先治疗受伤友军。'][this.index]}\n\n实际战斗属性还会受到训练、武将宝物与主城增益影响。`;}
  const title=this.text(x,y,name,D?20:21,HEADING_FONT).setColor('#f6dc9a').setWordWrapWidth(width,true);this.content.add(title);
  this.content.add(this.text(x,y+title.height+12,body,D?15:16).setLineSpacing(D?5:7).setWordWrapWidth(width,true));
  if(hero){const sel=this.text(D?x+width/2:W/2,H-(D?82:96),'选择此武将出战',19,HEADING_FONT).setOrigin(.5).setInteractive({useHandCursor:true}).setName('codex-select-hero').on('pointerdown',()=>{this.selectHero(this.index);this.root.destroy();});
   const sk=lqSkin(this.scene,sel,sel,()=>({w:240,h:46}),{tone:'cinnabar'});lqHitBox(sel,240,46);this.content.add([sk.gfx,sel]);}
 }
}
