import Phaser from 'phaser';
/** Video stays inside the Phaser canvas: never intercepts pointer events. */
export function attachHomeVideo(scene:Phaser.Scene,width:number,height:number):Phaser.GameObjects.Video{
 const v=scene.add.video(width/2,height/2).setDepth(-1).setVisible(false).setName('home-war-video');
 v.loadURL('assets/epic-home/video/huangjin-'+(width>600?'desktop':'mobile')+'.mp4',true).setMute(true);
 if(v.video){v.video.muted=true;v.video.defaultMuted=true;v.video.loop=true;v.video.playsInline=true;v.video.setAttribute('playsinline','');v.video.setAttribute('webkit-playsinline','');}
 v.on('play',()=>{if(v.width&&v.height){v.setScale(Math.max(width/v.width,height/v.height));v.setVisible(true);}});
 v.on('error',()=>v.setVisible(false));v.play(true);
 const visibility=()=>{v.setPaused(document.hidden);};document.addEventListener('visibilitychange',visibility);
 scene.events.once('shutdown',()=>{document.removeEventListener('visibilitychange',visibility);v.stop();});return v;
}
