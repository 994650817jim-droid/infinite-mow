import Phaser from 'phaser';

export type SurvivorBossFxId = 'thunder' | 'quake' | 'spear' | 'arrow';
const IDS: SurvivorBossFxId[] = ['thunder','quake','spear','arrow'];
interface Entry { image: Phaser.GameObjects.Image; start: number; ms: number; busy: boolean }
const pools = new WeakMap<Phaser.Scene, Entry[]>();
export function loadSurvivorBossFx(scene: Phaser.Scene): void {
  for (const id of IDS) if (!scene.textures.exists('survivor_fx_'+id)) scene.load.spritesheet('survivor_fx_'+id,'assets/survivor-boss-fx/'+id+'.png',{frameWidth:256,frameHeight:256});
}
function pool(scene: Phaser.Scene): Entry[] {
  let list=pools.get(scene);if(list)return list;list=[];pools.set(scene,list);
  scene.events.once('shutdown',()=>{for(const e of list!)e.image.destroy();pools.delete(scene);});return list;
}
/** Six-frame art only. Damage stays in the native controller / authoritative server. */
export function playSurvivorBossFx(scene: Phaser.Scene,id: SurvivorBossFxId,x:number,y:number,size:number,now:number,angle=0): boolean {
  const key='survivor_fx_'+id;if(!scene.textures.exists(key))return false;
  const list=pool(scene);let e=list.find(e=>!e.busy);if(!e){if(list.length>=12)return false;e={image:scene.add.image(0,0,key),start:0,ms:0,busy:false};list.push(e);}
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  e.start=now;e.ms=id==='arrow'?360:480;e.busy=true;
  e.image.setTexture(key,0).setPosition(x,y).setOrigin(.5,id==='thunder'?.76:.5).setDisplaySize(size,id==='arrow'?180:size).setRotation(angle).setDepth(75).setAlpha(.88).setVisible(true);
  return true;
}
export function updateSurvivorBossFx(scene: Phaser.Scene,now:number): void {
  for(const e of pools.get(scene)??[]){if(!e.busy)continue;const t=Math.max(0,(now-e.start)/e.ms);if(t>=1){e.busy=false;e.image.setVisible(false);}else e.image.setFrame(Math.min(5,Math.floor(t*6))).setAlpha(.88*(t>.7?(1-t)/.3:1));}
}
export function clearSurvivorBossFx(scene: Phaser.Scene): void {for(const e of pools.get(scene)??[]){e.busy=false;e.image.setVisible(false);}}
