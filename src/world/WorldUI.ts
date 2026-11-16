import Phaser from 'phaser';
import {GAME_WIDTH as W,GAME_HEIGHT as H,FONT} from '../config';
import {ensureWarTextures,warText} from '../ui/WarStyle';
import {lqImageButton} from '../ui/LacquerKit';
export function worldText(scene:Phaser.Scene,x:number,y:number,value:string,size=16,color='#ede3c9'){return scene.add.text(x,y,value,warText(size,color));}
/** 漆金按钮（与告捷弹窗、主页小匾同系），常态 / 悬停 / 按下三态；窄按钮（地图缩放 ＋－）为方形。返回的 image 是命中区。 */
export function worldButton(scene:Phaser.Scene,x:number,y:number,label:string,fn:()=>void,width=180){const h=width<70?width:(W>600?48:62);const image=scene.add.image(x,y,'__DEFAULT');const text=worldText(scene,x,y,label,width<70?24:17,'#ffe9bd').setOrigin(.5).setStroke('#2a170b',3);lqImageButton(scene,image,width,h,'gold',text);image.setInteractive({useHandCursor:true}).on('pointerup',()=>fn());return {image,text};}
export function worldShell(scene:Phaser.Scene,title:string){ensureWarTextures(scene);scene.cameras.main.setBackgroundColor('#102019');worldText(scene,24,22,title,28,'#e5c787');if(W<600)worldText(scene,24,H-24,'三国天下 · 义军起势',11,'#7d9988').setOrigin(0,1);}
export function panel(scene:Phaser.Scene,x:number,y:number,w:number,h:number){return scene.add.image(x,y,'ui_war_panel').setDisplaySize(w,h);}
export function worldAssets(scene:Phaser.Scene,key:string,path:string){if(!scene.textures.exists(key))scene.load.image(key,path);}
export function releaseWorldArt(scene:Phaser.Scene,key:string){scene.events.once('shutdown',()=>{if(scene.textures.exists(key))scene.textures.remove(key);});}
export {W,H,FONT};
