import Phaser from 'phaser';
import {CHARACTERS} from '../data/characters';
import {TROOPS,TROOP_KINDS,type TroopKind} from '../data/legion';
import {CHARACTER_PASSIVES} from '../data/passives';
import {WEAPON_META} from '../data/upgrades';
import {MARTIALS} from '../systems/RunGrowth';
import {FONT,GAME_WIDTH as W,GAME_HEIGHT as H,IS_DESKTOP as D,BALANCE} from '../config';
import {visualTextureKey} from '../systems/ReadableTextures';
const passiveDetails=['命中积攒龙胆，满7层后下次枪刺额外出枪、距离增加。','一刀命中至少3名敌人积累武势，强化刀斩范围；满层后强化下一刀。','连续3秒不受伤进入神射状态：增加暴击率，连弩多射一箭。','战旗命中至少3名敌人积累谋略，满层后扩大火阵并附加灼烧。'];
/** Read-only troop codex; hero selection reuses the menu's existing confirmation callback. */
export class GameCodex {
 readonly root:Phaser.GameObjects.Container;private content:Phaser.GameObjects.Container;private tab:'hero'|'troop'='hero';private index=0;
 constructor(private scene:Phaser.Scene,private selectHero:(index:number)=>void){
  this.root=scene.add.container(0,0).setDepth(550).setName('game-codex');this.content=scene.add.container(0,0);
  this.root.add(scene.add.rectangle(W/2,H/2,W,H,0x17130e,.98).setInteractive());
  this.root.add(this.text(W/2,35,'将士图鉴',28).setOrigin(.5));
  for(const [i,label]of ['武将','兵种'].entries())this.root.add(this.text(W/2+(i?70:-70),80,label,20).setOrigin(.5).setPadding(24,10).setInteractive({useHandCursor:true}).setName('codex-tab-'+i).on('pointerdown',()=>{this.tab=i?'troop':'hero';this.index=0;this.render();}));
  this.root.add(this.content);this.root.add(this.text(W/2,H-35,'返回首页',18).setOrigin(.5).setPadding(30,12).setInteractive({useHandCursor:true}).setName('codex-close').on('pointerdown',()=>this.root.destroy()));this.render();
 }
 private text(x:number,y:number,value:string,size=16){return this.scene.add.text(x,y,value,{fontFamily:FONT,fontSize:size+'px',color:'#e9d5b0',resolution:2}).setScrollFactor(0);}
 private render():void{
  this.content.removeAll(true);const hero=this.tab==='hero',items=hero?CHARACTERS.map(c=>c.name):TROOP_KINDS.map(k=>TROOPS[k].name),cols=D?2:4;
  for(const [i,name]of items.entries()){
   const x=D?95+(i%cols)*165:70+(i%cols)*(W-40)/4,y=150+Math.floor(i/cols)*(D?85:124),width=D?150:(W-48)/4;
   const hit=this.scene.add.rectangle(x,y,width,D?72:112,this.index===i?0x55452d:0x29231a).setStrokeStyle(1,this.index===i?0xd3b276:0x706046).setInteractive({useHandCursor:true}).setName('codex-item-'+i).on('pointerdown',()=>{this.index=i;this.render();});
   this.content.add(hit);
   if(!D){const def=hero?null:TROOPS[TROOP_KINDS[i]],key=hero?CHARACTERS[i].portrait:visualTextureKey(this.scene,def!.walkVisual?.texture??(def!.art.startsWith('xiliang')?def!.art+'_walk':def!.art+'_walk_sheet'));this.content.add(this.scene.add.image(x,y-15,key,hero?undefined:'down_0').setDisplaySize(58,58));}
   this.content.add(this.text(x,D?y:y+35,name,D?19:15).setOrigin(.5));
  }
  const x=D?420:36,y=D?130:hero?300:425,width=D?W-455:W-72;
  let name='',body='';
  if(hero){const c=CHARACTERS[this.index];name=c.name+' · '+c.desc;body=`初始生命：${Math.round(BALANCE.player.maxHp*c.hpMul)}\n移动速度：${Math.round(BALANCE.player.speed*c.speedMul)}\n伤害倍率：${c.damageMul.toFixed(2)}\n本命兵器：${WEAPON_META[c.startWeapon].name}\n\n天赋被动 · ${CHARACTER_PASSIVES[c.id].name}\n${passiveDetails[this.index]}\n\n专属武艺\n${Object.values(MARTIALS).filter(m=>m.character===c.id).map(m=>m.name).join(' / ')}`;}
  else{const d=TROOPS[TROOP_KINDS[this.index] as TroopKind];name=d.name+' · 基础Lv.1';body=`生命 ${d.hp}    护甲 ${d.armor}\n每次伤害 ${d.damage}    攻击间隔 ${d.cooldown}秒\n射程 ${d.range}    移速 ${d.speed}\n招募消耗 ${d.cost}军粮\n\n${d.perk}\n\n${['保护前排、格挡普通攻击。','保持刺击距离，优先应对骑兵。','后排射击，优先敌方远程。','后排快速连射，集火威胁目标。','承受前线压力，正面减伤。','短距离突击后回到队伍。','横扫附近敌群。','不主动攻击，优先治疗受伤友军。'][this.index]}\n\n实际战斗属性还会受到训练、武将宝物与主城增益影响。`;}
  this.content.add(this.text(x,y,name,22).setWordWrapWidth(width,true));this.content.add(this.text(x,y+46,body,D?16:17).setLineSpacing(D?5:8).setWordWrapWidth(width,true));
  if(hero)this.content.add(this.text(D?W*.68:W/2,H-92,'选择此武将出战',20).setOrigin(.5).setPadding(28,14).setBackgroundColor('#58452d').setInteractive({useHandCursor:true}).setName('codex-select-hero').on('pointerdown',()=>{this.selectHero(this.index);this.root.destroy();}));
 }
}
