import {visualTextureKey} from '../systems/ReadableTextures';
import {figureCorrection} from '../systems/SpriteMetrics';
import {isV2Texture, V2_TROOP_SCALE, v2TroopGround} from '../systems/ArtStyle';
import Phaser from 'phaser';
import { createTacticState } from '../systems/LegionTactics';
import { DEPTH, FONT, actorDepth } from '../config';
import { TROOPS, type TroopKind } from '../data/legion';
export type AllyKind = TroopKind;
export interface AllyView { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; }
let sequence = 0;
/** 出手前冲距离（像素）；负数为远程后坐。 */
const LUNGE: Partial<Record<TroopKind, number>> = { spearman: 10, swordsman: 7, guardian: 5, rider: 6, halberdier: 3, archer: -2, crossbowman: -3 };
/** Persistent soldier record; render handles are pooled separately by Legion. */
export class Ally {
  readonly id = ++sequence;
  private campaignHpMultiplier=1;
  applyCampaignHp(multiplier:number):void{const ratio=this.maxHp>0?this.hp/this.maxHp:1;this.campaignHpMultiplier=multiplier;this.maxHp=Math.round(this.def.hp*(1+.3*(this.level-1))*multiplier);this.hp=Math.min(this.maxHp,this.maxHp*ratio);}
  active = true; level = 1; hp = 1; maxHp = 1; cooldown = 0; hurtUntil = 0; attackUntil = 0;
  reserveSoldier=false;
  lifeId = 0; attackStarted = 0;
  /** 弓兵射击时目标在左侧（攻击表各行都朝右拉弓，向左射时需镜像）。 */
  private aimLeft = false;
  ai = createTacticState();
  slot = 0; simDebt = 0; deathsReported = false;
  private px: number; private py: number; private walked = 0;
  private moving = false;
  private dir: 'down' | 'up' | 'left' | 'right' = 'down';
  view: AllyView | null = null;
  constructor(readonly scene: Phaser.Scene, x: number, y: number, public kind: TroopKind = 'swordsman', slot = 0) { this.px = x; this.py = y; this.reset(x, y, kind, 1, slot); }
  get def() { return TROOPS[this.kind]; }
  get facingX(): number { return this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0; }
  get facingY(): number { return this.dir === 'up' ? -1 : this.dir === 'down' ? 1 : 0; }
  get x(): number { return this.view?.sprite.x ?? this.px; }
  get y(): number { return this.view?.sprite.y ?? this.py; }
  get radius(): number { return this.kind === 'rider' ? 18 : this.def.ranged || this.kind === 'medic' ? 12 : 14; }
  get sprite(): Phaser.GameObjects.Image { if (!this.view) this.attach(Ally.makeView(this.scene)); return this.view!.sprite; }
  get shadow(): Phaser.GameObjects.Image { if (!this.view) this.attach(Ally.makeView(this.scene)); return this.view!.shadow; }
  reset(x: number, y: number, kind: TroopKind, level: number, slot: number): void {
    this.campaignHpMultiplier=1;this.kind = kind; this.active = true; this.level = level; this.maxHp = Math.round(this.def.hp * (1 + .3 * (level - 1))); this.hp = this.maxHp;
    this.reserveSoldier=false;this.lifeId++; this.attackStarted = 0; this.moving = false; this.ai = createTacticState(x, y); this.ai.nextThink = slot % 12 * 17;
    this.px = x; this.py = y; this.slot = slot; this.cooldown = (slot % 10) * .08; this.hurtUntil = this.attackUntil = this.simDebt = this.walked = 0; this.deathsReported = false; this.dir = 'down';
    this.view?.sprite.setPosition(x, y);
  }
  train(level: number): void { const old = this.maxHp; this.level = level; this.maxHp = Math.round(this.def.hp * (1 + .3 * (level - 1))*this.campaignHpMultiplier); this.hp = Math.min(this.maxHp, this.hp + this.maxHp - old); }
  upgrade(): void { this.train(Math.min(3, this.level + 1)); }
  push(dx: number, dy: number): void { this.setPosition(this.x + dx, this.y + dy); }
  setPosition(x: number, y: number): void { this.px = x; this.py = y; this.view?.sprite.setPosition(x, y); }
  beginStep(): void { this.moving = false; }
  moveTo(x: number, y: number, dt: number, speed: number, preserveFacing = false): void {
    const dx = x - this.x, dy = y - this.y, distance = Math.hypot(dx, dy);
    if (distance <= 2 || dt <= 0) return;
    // Arrive without overshoot; no inertial coasting after the target stops.
    const step = Math.min(distance - 2, speed * dt * Math.min(1, distance / 16));
    if (step <= .001) return;
    this.moving = true; this.walked += step;
    const horizontal = this.dir === 'left' || this.dir === 'right';
    // Hysteresis selects an axis, never retains the wrong sign on diagonals.
    const useX = horizontal ? Math.abs(dx) * 1.15 >= Math.abs(dy) : Math.abs(dx) > Math.abs(dy) * 1.15;
    if(!preserveFacing)this.dir = useX ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
    this.push(dx / distance * step, dy / distance * step);
  }
  face(x: number, y: number): void { const dx = x - this.x, dy = y - this.y; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return; this.dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'; }
  attach(view: AllyView): void { this.view = view; view.sprite.setPosition(this.px, this.py); this.render(0); }
  act(x: number, y: number, now: number, duration: number): void { this.aimLeft = x < this.x; this.dir = Math.abs(x - this.x) > Math.abs(y - this.y) ? x < this.x ? 'left' : 'right' : y < this.y ? 'up' : 'down'; this.attackStarted = now; this.attackUntil = now + duration; }
  release(): AllyView | null { const v = this.view; if (v) { this.px = v.sprite.x; this.py = v.sprite.y; v.sprite.setVisible(false); v.shadow.setVisible(false); v.label.setVisible(false); } this.view = null; return v; }
  render(now: number): void {
    const v = this.view; if (!v) return; const art = this.def.art, reused = art.startsWith('xiliang'), custom = this.def.walkVisual;
    const sheet = custom?.texture ?? (reused ? `${art}_walk` : `${art}_walk_sheet`);
    const attack = !custom && !reused && this.kind !== 'medic' && now < this.attackUntil && this.scene.textures.exists(`${art}_attack_sheet`);
    const meleeAction=this.kind==='halberdier';
    const anticipation=meleeAction&&this.cooldown>0&&this.cooldown<=.1&&this.ai.target?.active&&Math.hypot(this.ai.target.x-this.x,this.ai.target.y-this.y)<=this.def.range;
    const progress=Math.max(0,Math.min(1,(now-this.attackStarted)/Math.max(1,this.attackUntil-this.attackStarted)));
    const action = this.def.actionVisual && (now < this.attackUntil || anticipation);
    const texture = action ? this.def.actionVisual!.texture : attack ? `${art}_attack_sheet` : sheet;
    // 弓兵攻击表的“左”行实为朝右、上下行也朝右拉弓：统一用朝右的侧身拉弓/放箭两帧，目标在左时水平镜像
    const archerAim = attack && this.kind === 'archer';
    const frame = action ? `${this.dir}_${(meleeAction?(now>=this.attackUntil?0:Math.min(3,1+Math.floor(progress*3))):Math.min(3,Math.floor(progress*4)))}` : attack ? `atk_${archerAim ? 'right' : this.dir}_${(now-this.attackStarted)/Math.max(1,this.attackUntil-this.attackStarted)<.5 ? 0 : 1}` : `${this.dir}_${!this.moving || (custom||this.kind==='spearman') && now < this.attackUntil ? 0 : Math.floor(this.walked / 14) % 4}`;
    // 人物画风 v2：图集格子更大、像素 1:1（ArtStyle.V2_TROOP_SCALE），按实际帧高换算脚底锚点
    const v2art = isV2Texture(texture), v2fh = v2art ? (this.scene.textures.getFrame(texture, frame)?.height || 96) : 0;
    const scale = v2art ? V2_TROOP_SCALE : custom?.scale ?? (this.kind === 'rider' ? .8 : .58);
    const frameHeight=v2art?v2fh:action&&meleeAction?112:96;
    const ground = v2art?v2TroopGround(v2fh):action&&meleeAction?100/112:custom?.groundY ?? (reused ? .875 : .98);
    // 行走起伏：每步上下约 2px，与步伐帧同步，正对镜头时也能看出在走。
    const hop=this.moving&&now>=this.attackUntil?Math.abs(Math.sin(Math.PI*this.walked/14))*2:0;
    // 出手动作：沿朝向前冲后收回（远程为后坐），并带轻微伸缩；保持同一角色素材，不冒充独立攻击帧。
    const strike=now<this.attackUntil?Math.sin(progress*Math.PI):0,lunge=(LUNGE[this.kind]??0)*strike,horizontal=this.facingX!==0;
    const tex=visualTextureKey(this.scene,texture),corr=texture===sheet||v2art?1:figureCorrection(this.scene,visualTextureKey(this.scene,sheet),tex,frame,!(attack&&!action));
    v.sprite.setVisible(this.active).setTexture(tex, frame).setScale(corr*scale*(1+(horizontal?.07:-.03)*Math.abs(strike)*(lunge?1:0)),corr*scale*(1+(horizontal?-.03:.06)*Math.abs(strike)*(lunge?1:0))).setTint(now < this.hurtUntil ? 0xff9999 : this.def.tint).setOrigin(.5-this.facingX*lunge/((v2art?v2fh:96)*scale), ground - this.radius * .72 / (frameHeight * scale)-this.facingY*lunge/(frameHeight*scale)+hop/(frameHeight*scale)).setDepth(actorDepth(this.y + this.radius * .72));
    // Same-character procedural follow-through where independent attack art is still absent.
    const follow=now<this.attackUntil?Math.sin(progress*Math.PI):0;
    v.sprite.setRotation(this.kind==='guardian'?follow*.035*(this.facingX||1):this.kind==='rider'?follow*.045*(this.facingX||1):0);
    v.sprite.setFlipX(archerAim && this.aimLeft);
    v.shadow.setVisible(this.active).setPosition(this.x, this.y + this.radius * .72);
    v.label.setVisible(false);
  }
  static makeView(scene: Phaser.Scene): AllyView { return { sprite: scene.add.image(0, 0, 'shu_swordsman_walk_sheet', 'down_0'), shadow: scene.add.image(0, 0, 'shadow').setDisplaySize(35, 14).setAlpha(.5).setDepth(DEPTH.enemy - 1), label: scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', resolution: 2, stroke: '#162018', strokeThickness: 2 }).setOrigin(.5).setDepth(DEPTH.enemy + 3) }; }
}
