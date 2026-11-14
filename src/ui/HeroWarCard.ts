import Phaser from 'phaser';
import {CHARACTERS} from '../data/characters';
import {MARTIALS} from '../systems/RunGrowth';
import {WEAPON_META} from '../data/upgrades';
import {FONT,HEADING_FONT} from '../config';
const titles=['游龙先锋','重甲武圣','百步神射','卧龙军师'];const roles=['突进','近战','远程','法术'];
/** Original bronze-and-aged-paper frame. No third-party card artwork. */
export class HeroWarCard{
 readonly root:Phaser.GameObjects.Container;readonly art:Phaser.GameObjects.Image;readonly name:Phaser.GameObjects.Text;readonly weapon:Phaser.GameObjects.Text;readonly hit:Phaser.GameObjects.Rectangle;
 private g:Phaser.GameObjects.Graphics;private veil:Phaser.GameObjects.Graphics;private title:Phaser.GameObjects.Text;private role:Phaser.GameObjects.Text;private skills:Phaser.GameObjects.Text;private folded=false;private index=-1;private chosen=false;
 constructor(private s:Phaser.Scene,x:number,y:number,readonly width:number,readonly height:number){
 const w=width,h=height,small=w<250,foot=h-82;
 this.root=s.add.container(x,y);this.g=s.add.graphics();this.veil=s.add.graphics();this.hit=s.add.rectangle(w/2,h/2,w,h,0,0.001).setInteractive({useHandCursor:true});
 const text=(x:number,y:number,value:string,size:number,color='#ecd4a8')=>s.add.text(x,y,value,{fontFamily:HEADING_FONT,fontSize:size+'px',color,resolution:2}).setOrigin(.5);
 this.name=text(w/2,25,'',small?23:28);this.title=text(w/2,49,'',14,'#bfa16e');this.art=s.add.image(w/2,foot-5,CHARACTERS[0].portrait).setOrigin(.5,0).setY(56);
 this.role=text(w/2,foot+10,'',14,'#c9b185');this.weapon=text(w/2,foot+33,'',small?14:15,'#f0ddba');this.skills=text(w/2,foot+57,'',small?14:15,'#d3b889').setLineSpacing(6);
 this.root.add([this.g,this.art,this.veil,this.name,this.title,this.role,this.weapon,this.skills,this.hit]);this.paint();
 this.hit.on('pointerover',()=>this.paint('hover')).on('pointerout',()=>this.paint()).on('pointerdown',()=>this.paint('pressed')).on('pointerup',()=>this.paint());
 }
 private paint(state='normal'):void{if(this.folded){this.g.clear().fillStyle(0x292117,.88).fillRect(0,0,this.width,70).lineStyle(1,0xa68a57,.7).strokeRect(0,0,this.width,70);return;}const w=this.width,h=this.height,f=h-82,g=this.g,bright=this.chosen||state==='hover';g.clear();if(bright)g.lineStyle(5,0xe3bf7d,.13).strokeRect(-2,-2,w+4,h+4);
 g.fillStyle(state==='pressed'?0x1d160f:0x292117,1).lineStyle(2,bright?0xe2bf7c:0x8d7044,1).beginPath().moveTo(12,0).lineTo(w-12,0).lineTo(w,12).lineTo(w,h-12).lineTo(w-12,h).lineTo(12,h).lineTo(0,h-12).lineTo(0,12).closePath().fillPath().strokePath();
 g.lineStyle(1,0xa68a57,.38).strokeRect(6,6,w-12,h-12);
 // Restrained etched cloud lines and mountain silhouettes, behind the existing portrait.
 g.lineStyle(1,0xb19a6b,.09);for(let y=90;y<f;y+=27){g.beginPath().moveTo(14,y).lineTo(w*.24,y-16).lineTo(w*.45,y+8).lineTo(w*.67,y-12).lineTo(w-14,y+2).strokePath();}
 g.lineStyle(1,0xa58a55,.11).strokeCircle(w*.52,h*.39,w*.31).strokeCircle(w*.52,h*.39,w*.27);
 const veil=this.veil;veil.clear();for(let i=0;i<24;i++)veil.fillStyle(0x20190f,.018+i*.003).fillRect(8,f-32+i*2,w-16,h-(f-32+i*2)-8);veil.lineStyle(1,0xb69a62,.32).lineBetween(22,f-7,w-22,f-7);
 for(const x of [13,w-13])for(const y of [13,h-13])g.fillStyle(0xb99a60,1).fillRect(x-2,y-2,4,4);
 g.lineStyle(1,0x957646,.35).lineBetween(26,57,w-26,57);
 }
 setFolded(value:boolean):void{this.folded=value;for(const item of [this.art,this.veil,this.role,this.weapon,this.skills])item.setVisible(!value);this.hit.setSize(this.width,value?70:this.height).setPosition(this.width/2,value?35:this.height/2);if(this.hit.input)this.hit.input.hitArea.setTo(0,0,this.width,value?70:this.height);this.paint();}
 setSelected(value:boolean):void{this.chosen=value;this.paint();}
 setHero(index:number):void{const c=CHARACTERS[index],key='epic_hero_'+c.id,target=this.s.textures.exists(key)?key:c.portrait;
 if(this.index!==index||(!this.art.texture.key.startsWith('war-card-art-')&&this.art.texture.key!==target)){this.index=index;let artKey=target;
 if(target===key){artKey='war-card-art-'+c.id+'-'+this.width+'-'+this.height;if(!this.s.textures.exists(artKey)){const source=this.s.textures.get(key).getSourceImage() as HTMLImageElement;const sourceH=Math.min(820,Math.round((this.height-70)/(this.width*1.08)*600)),canvas=document.createElement('canvas');canvas.width=384;canvas.height=Math.round(sourceH*.64);const ctx=canvas.getContext('2d')!;ctx.drawImage(source,0,0,600,sourceH,0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='destination-in';const fade=ctx.createLinearGradient(0,0,0,canvas.height);fade.addColorStop(0,'rgba(255,255,255,1)');fade.addColorStop(.7,'rgba(255,255,255,1)');fade.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=fade;ctx.fillRect(0,0,canvas.width,canvas.height);this.s.textures.addCanvas(artKey,canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);}}
 this.art.setTexture(artKey,'__BASE');this.art.setDisplaySize(this.width*1.08,this.height-70);this.s.tweens.killTweensOf(this.art);this.art.setAlpha(.3);this.s.tweens.add({targets:this.art,alpha:1,duration:180});}
 this.name.setText(c.name);this.title.setText(titles[index]);this.role.setText('蜀 · '+roles[index]);this.weapon.setText(WEAPON_META[c.startWeapon].name);this.skills.setText(Object.values(MARTIALS).filter(a=>a.character===c.id).map(a=>a.name).join('  /  ')).setWordWrapWidth(this.width-28).setAlign('center');
 }
}
