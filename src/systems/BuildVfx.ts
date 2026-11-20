import Phaser from 'phaser';
import {HINT_MOCK,groundScar} from '../ui/HintStyle';
import {actorDepth} from '../config';
/** 阵纹 / 火门 / 石环这类「画出范围」的样式；默认（只保留关键提示）不播放；?hints=old 恢复，?mock=b 换成一闪而过的地面痕迹。 */
const RANGE_STYLES=new Set(['control','pure_control','fire_gate','pure_bulwark']);
export const VFX_STYLES=['combo','critical','skirmish','flame','charge','control','command','bulwark','pure_combo','pure_critical','pure_skirmish','pure_flame','pure_charge','pure_control','pure_command','pure_bulwark','fire_gate','peerless','roaming_break','iron_army','ember','pull','stun_burst','sunder_hit','heavy','reinforce','watch','breakout'] as const;
interface Slot{image:Phaser.GameObjects.Image;start:number;end:number;row:number;core:boolean;alpha:number;}
/**
 * 战法触发特效「太小太快」优化（2026-11-20 用户「流派的特效我觉得一下小三太快了」）：
 * - 放大：小图标式（≤72）×1.7、中等（≤140）×1.4、范围型（>140，调用处已按真实作用范围给尺寸）×1.15；
 * - 放慢：时长 ×1.7（上限 1600ms），帧不再匀速：开头 / 峰值帧停留（HOLD），首帧淡入、尾段淡出；
 * - 不盖主将：离主将很近的特效半透明（×.5）并放到主将身后一层；
 * - 节流：同一流派 0.5 秒（密度高时 0.8 秒）只播一次（核心样式不受限），同屏上限 18 → 12（密度高 10 → 7）。
 */
export const VFX_TUNE: Record<string, number> = { hold: 1, small: 1.7, mid: 1.4, range: 1.15, smallMax: 72, midMax: 140, durMul: 1.7, durMax: 1600, nearPlayer: .5, gateMs: 500, gateMsDense: 800, activeCap: 12, activeCapDense: 7, fadeIn: .12 };
/** 测试 / 录屏用：恢复改前的尺寸、时长、帧节奏和节流（对比 GIF）。 */
export function vfxLegacy(on: boolean): void { Object.assign(VFX_TUNE, on ? { hold: 0, small: 1, mid: 1, range: 1, durMul: 1, nearPlayer: 1, gateMs: 100, gateMsDense: 200, activeCap: 18, activeCapDense: 10, fadeIn: 0 } : { hold: 1, small: 1.7, mid: 1.4, range: 1.15, durMul: 1.7, nearPlayer: .5, gateMs: 500, gateMsDense: 800, activeCap: 12, activeCapDense: 7, fadeIn: .12 }); }
/** 样式 → 流派（同一流派合并节流用）。 */
const SCHOOL_OF: Record<string, string> = {
  combo: 'warrior', pure_combo: 'warrior', peerless: 'warrior', heavy: 'warrior',
  critical: 'archery', pure_critical: 'archery', roaming_break: 'archery', sunder_hit: 'archery',
  skirmish: 'cavalry', charge: 'cavalry', pure_skirmish: 'cavalry', pure_charge: 'cavalry',
  flame: 'fire', pure_flame: 'fire', fire_gate: 'fire', ember: 'fire',
  control: 'stratagem', pure_control: 'stratagem', pull: 'stratagem', stun_burst: 'stratagem',
  command: 'formation', bulwark: 'formation', pure_command: 'formation', pure_bulwark: 'formation', iron_army: 'formation', reinforce: 'formation', watch: 'formation', breakout: 'formation',
};
export const vfxScale = (size: number): number => size <= VFX_TUNE.smallMax ? VFX_TUNE.small : size <= VFX_TUNE.midMax ? VFX_TUNE.mid : VFX_TUNE.range;
/** 6 帧的停留表：t(0–1) → 帧号；开头 / 峰值（帧 2–3）停得更久，尾帧快速收。 */
export function vfxFrame(t: number): number { if (!VFX_TUNE.hold) return Math.min(5, Math.floor(t * 6)); return t < .14 ? 0 : t < .28 ? 1 : t < .52 ? 2 : t < .72 ? 3 : t < .88 ? 4 : 5; }
export function buildVfx(scene:Phaser.Scene):BuildVfx{const host=scene as Phaser.Scene&{buildVfxPool?:BuildVfx};if(!host.buildVfxPool){const pool=new BuildVfx(scene);host.buildVfxPool=pool;scene.events.once('shutdown',()=>{pool.clear();delete host.buildVfxPool;});}return host.buildVfxPool;}
/** One pre-rendered atlas, fixed slot budget, no emit-time Graphics/Tweens/Timers. */
export class BuildVfx{
 readonly slots:Slot[]=[];private gate=new Map<string,number>();density=0;emitted=0;dropped=0;
 constructor(private scene:Phaser.Scene){}
 emit(style:string,x:number,y:number,now:number,size=64,angle=0,duration=300,core=false):void{
  if(HINT_MOCK&&RANGE_STYLES.has(style)){if(HINT_MOCK==='b'&&(style==='pure_bulwark'||style==='pure_control')&&now>=(this.gate.get(style)??0)){this.gate.set(style,now+400);groundScar(this.scene,x,y+8,size*.5,'crack');}return;}
  const row=VFX_STYLES.indexOf(style as typeof VFX_STYLES[number]);if(row<0||!this.scene.textures.exists('build_vfx')||!this.scene.cameras.main.worldView.contains(x,y))return;
  const school=SCHOOL_OF[style]??style,dense=this.density>=100,V=VFX_TUNE;
  if(!core&&now<(this.gate.get(school)??0))return;
  const active=this.slots.filter(s=>s.end>now).length;
  if(!core&&(active>=(dense?V.activeCapDense:V.activeCap))){this.dropped++;return;}
  size*=vfxScale(size);duration=Math.min(V.durMax,duration*V.durMul);
  let slot=this.slots.find(s=>s.end<=now);if(!slot&&this.slots.length<40){slot={image:this.scene.add.image(0,0,'build_vfx',0).setDepth(41).setVisible(false),start:0,end:0,row:0,core:false,alpha:.8};this.slots.push(slot);}if(!slot&&core)slot=this.slots.filter(s=>!s.core).sort((a,b)=>a.end-b.end)[0];if(!slot){this.dropped++;return;}
  if(!core)this.gate.set(school,now+(dense?V.gateMsDense:V.gateMs));slot.start=now;slot.end=now+duration;slot.row=row;slot.core=core;slot.alpha=core?.9:.78;
  // 离主将很近：半透明 + 放到主将身后一层，不遮住主将
  const pl=(this.scene as unknown as {player?:{x:number;y:number}}).player,near=!!pl&&Math.hypot(x-pl.x,y-pl.y)<size*.35;
  slot.alpha=(core?.9:.78)*(near?V.nearPlayer:1);
  slot.image.setFrame(row*6).setPosition(x,y).setRotation(angle).setDisplaySize(size,size).setAlpha(0).setDepth(['control','fire_gate','pure_control'].includes(style)?19:near&&pl?actorDepth(pl.y)-.3:41).setVisible(true);this.emitted++;
 }
 update(now:number):void{for(const s of this.slots){if(now>=s.end){s.image.setVisible(false);continue;}const t=Math.max(0,(now-s.start)/(s.end-s.start));s.image.setFrame(s.row*6+vfxFrame(t)).setAlpha(s.alpha*(VFX_TUNE.fadeIn?Math.min(1,t/VFX_TUNE.fadeIn):1)*(t<.7?1:(1-t)/.3));}}
 clear():void{for(const s of this.slots){s.end=0;s.image.setVisible(false);}this.gate.clear();}
}


/**
 * 合击触发特效（2026-11-19 用户「关于流派和道具特效做一下」）：15 个合击原来只弹横幅，触发时没有各自的画面。
 * 用手绘图集里两个流派各自的样式并排叠成一对（15 种组合各不相同，读得出是哪两派）：每个合击每 2 秒最多一次，比单战法特效略大，核心样式（不被密度丢弃）。
 */
export const COMBO_STYLE: Readonly<Record<string, string>> = { fire: 'pure_flame', stratagem: 'pull', archery: 'pure_critical', cavalry: 'pure_skirmish', warrior: 'pure_combo', formation: 'pure_command' };
const comboAt = new Map<string, number>();
export function comboFx(scene: Phaser.Scene, a: string, b: string, id: string, x: number, y: number, now: number): void {
  if (now < (comboAt.get(id) ?? 0)) return; comboAt.set(id, now + 2000);
  const v = buildVfx(scene); v.emit(COMBO_STYLE[a], x - 44, y - 16, now, 112, 0, 700, true); v.emit(COMBO_STYLE[b], x + 44, y - 16, now, 112, 0, 700, true); // 尺寸 / 时长在 emit 里统一放大放慢（112 → 约 157、700 → 约 1190ms）
}
