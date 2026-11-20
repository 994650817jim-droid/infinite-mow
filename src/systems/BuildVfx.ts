import Phaser from 'phaser';
import {HINT_MOCK,groundScar} from '../ui/HintStyle';
/** 阵纹 / 火门 / 石环这类「画出范围」的样式；默认（只保留关键提示）不播放；?hints=old 恢复，?mock=b 换成一闪而过的地面痕迹。 */
const RANGE_STYLES=new Set(['control','pure_control','fire_gate','pure_bulwark']);
export const VFX_STYLES=['combo','critical','skirmish','flame','charge','control','command','bulwark','pure_combo','pure_critical','pure_skirmish','pure_flame','pure_charge','pure_control','pure_command','pure_bulwark','fire_gate','peerless','roaming_break','iron_army','ember','pull','stun_burst','sunder_hit','heavy','reinforce','watch','breakout'] as const;
interface Slot{image:Phaser.GameObjects.Image;start:number;end:number;row:number;core:boolean;alpha:number;}
export function buildVfx(scene:Phaser.Scene):BuildVfx{const host=scene as Phaser.Scene&{buildVfxPool?:BuildVfx};if(!host.buildVfxPool){const pool=new BuildVfx(scene);host.buildVfxPool=pool;scene.events.once('shutdown',()=>{pool.clear();delete host.buildVfxPool;});}return host.buildVfxPool;}
/** One pre-rendered atlas, fixed slot budget, no emit-time Graphics/Tweens/Timers. */
export class BuildVfx{
 readonly slots:Slot[]=[];private gate=new Map<string,number>();density=0;emitted=0;dropped=0;
 constructor(private scene:Phaser.Scene){}
 emit(style:string,x:number,y:number,now:number,size=64,angle=0,duration=300,core=false):void{
  if(HINT_MOCK&&RANGE_STYLES.has(style)){if(HINT_MOCK==='b'&&(style==='pure_bulwark'||style==='pure_control')&&now>=(this.gate.get(style)??0)){this.gate.set(style,now+400);groundScar(this.scene,x,y+8,size*.5,'crack');}return;}
  const row=VFX_STYLES.indexOf(style as typeof VFX_STYLES[number]);if(row<0||!this.scene.textures.exists('build_vfx')||!this.scene.cameras.main.worldView.contains(x,y))return;
  if(!core&&now<(this.gate.get(style)??0))return;
  const active=this.slots.filter(s=>s.end>now).length;
  if(!core&&(active>=(this.density>=100?10:18))){this.dropped++;return;}
  let slot=this.slots.find(s=>s.end<=now);if(!slot&&this.slots.length<40){slot={image:this.scene.add.image(0,0,'build_vfx',0).setDepth(41).setVisible(false),start:0,end:0,row:0,core:false,alpha:.8};this.slots.push(slot);}if(!slot&&core)slot=this.slots.filter(s=>!s.core).sort((a,b)=>a.end-b.end)[0];if(!slot){this.dropped++;return;}
  if(!core)this.gate.set(style,now+(this.density>=100?200:100));slot.start=now;slot.end=now+duration;slot.row=row;slot.core=core;slot.alpha=core?.9:.78;
  slot.image.setFrame(row*6).setPosition(x,y).setRotation(angle).setDisplaySize(size,size).setAlpha(slot.alpha).setDepth(['control','fire_gate','pure_control'].includes(style)?19:41).setVisible(true);this.emitted++;
 }
 update(now:number):void{for(const s of this.slots){if(now>=s.end){s.image.setVisible(false);continue;}const t=Math.max(0,(now-s.start)/(s.end-s.start));s.image.setFrame(s.row*6+Math.min(5,Math.floor(t*6))).setAlpha(s.alpha*(t<.7?1:(1-t)/.3));}}
 clear():void{for(const s of this.slots){s.end=0;s.image.setVisible(false);}this.gate.clear();}
}

