import Phaser from 'phaser';
import { LOW_RES } from '../systems/LowResTextures';
/** Video stays inside the Phaser canvas: never intercepts pointer events.
 *  手机省内存模式（LOW_RES）不播首页视频，只留静态背景；离开首页时连同视频纹理一起释放（Phaser 的 Video 销毁时不移除它建的纹理）。 */
export function attachHomeVideo(scene:Phaser.Scene,width:number,height:number):Phaser.GameObjects.Video|null{
 if(LOW_RES)return null;
 const v=scene.add.video(width/2,height/2).setDepth(-1).setVisible(false).setName('home-war-video');
 v.loadURL('assets/epic-home/video/huangjin-'+(width>600?'desktop':'mobile')+'.mp4',true).setMute(true);
 if(v.video){v.video.muted=true;v.video.defaultMuted=true;v.video.loop=true;v.video.playsInline=true;v.video.setAttribute('playsinline','');v.video.setAttribute('webkit-playsinline','');}
 v.on('play',()=>{if(v.width&&v.height){v.setScale(Math.max(width/v.width,height/v.height));v.setVisible(true);}});
 v.on('error',()=>v.setVisible(false));v.play(true);
 const visibility=()=>{v.setPaused(document.hidden);};document.addEventListener('visibilitychange',visibility);
 scene.events.once('shutdown',()=>{document.removeEventListener('visibilitychange',visibility);v.stop();const key=v.videoTexture?.key;if(key&&scene.textures.exists(key))scene.textures.remove(key);});return v;
}
