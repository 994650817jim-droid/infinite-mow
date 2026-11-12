import Phaser from 'phaser';
import {GAME_WIDTH as W,GAME_HEIGHT as H,FONT} from '../config';
import {ensureWarTextures,warText} from '../ui/WarStyle';
export function worldText(scene:Phaser.Scene,x:number,y:number,value:string,size=16,color='#ede3c9'){return scene.add.text(x,y,value,warText(size,color));}
export function worldButton(scene:Phaser.Scene,x:number,y:number,label:string,fn:()=>void,width=180){const image=scene.add.image(x,y,'ui_war_button').setDisplaySize(width,W>600?48:62).setInteractive({useHandCursor:true});const text=worldText(scene,x,y,label,17,'#17251c').setOrigin(.5);image.on('pointerdown',()=>image.setTint(0xb4c3a4)).on('pointerup',()=>{image.clearTint();fn();}).on('pointerout',()=>image.clearTint());return {image,text};}
export function worldShell(scene:Phaser.Scene,title:string){ensureWarTextures(scene);scene.cameras.main.setBackgroundColor('#102019');worldText(scene,24,22,title,28,'#e5c787');if(W<600)worldText(scene,24,H-24,'三国天下 · 义军起势',11,'#7d9988').setOrigin(0,1);}
export function panel(scene:Phaser.Scene,x:number,y:number,w:number,h:number){return scene.add.image(x,y,'ui_war_panel').setDisplaySize(w,h);}
export function worldAssets(scene:Phaser.Scene,key:string,path:string){if(!scene.textures.exists(key))scene.load.image(key,path);}
export function releaseWorldArt(scene:Phaser.Scene,key:string){scene.events.once('shutdown',()=>{if(scene.textures.exists(key))scene.textures.remove(key);});}
export {W,H,FONT};
