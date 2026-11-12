import {visualTextureKey} from '../systems/ReadableTextures';
import Phaser from 'phaser';
import { createTacticState } from '../systems/LegionTactics';
import { DEPTH, FONT, actorDepth } from '../config';
import { TROOPS, type TroopKind } from '../data/legion';
export type AllyKind = TroopKind;
export interface AllyView { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; }
let sequence = 0;
/** Persistent soldier record; render handles are pooled separately by Legion. */
export class Ally {
  readonly id = ++sequence;
  active = true; level = 1; hp = 1; maxHp = 1; cooldown = 0; hurtUntil = 0; attackUntil = 0;
  reserveSoldier=false;
  lifeId = 0; attackStarted = 0;
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
    this.kind = kind; this.active = true; this.level = level; this.maxHp = Math.round(this.def.hp * (1 + .3 * (level - 1))); this.hp = this.maxHp;
    this.reserveSoldier=false;this.lifeId++; this.attackStarted = 0; this.moving = false; this.ai = createTacticState(x, y); this.ai.nextThink = slot % 12 * 17;
    this.px = x; this.py = y; this.slot = slot; this.cooldown = (slot % 10) * .08; this.hurtUntil = this.attackUntil = this.simDebt = this.walked = 0; this.deathsReported = false; this.dir = 'down';
    this.view?.sprite.setPosition(x, y);
  }
  train(level: number): void { const old = this.maxHp; this.level = level; this.maxHp = Math.round(this.def.hp * (1 + .3 * (level - 1))); this.hp = Math.min(this.maxHp, this.hp + this.maxHp - old); }
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
  attach(view: AllyView): void { this.view = view; view.sprite.setPosition(this.px, this.py); this.render(0); }
  act(x: number, y: number, now: number, duration: number): void { this.dir = Math.abs(x - this.x) > Math.abs(y - this.y) ? x < this.x ? 'left' : 'right' : y < this.y ? 'up' : 'down'; this.attackStarted = now; this.attackUntil = now + duration; }
  release(): AllyView | null { const v = this.view; if (v) { this.px = v.sprite.x; this.py = v.sprite.y; v.sprite.setVisible(false); v.shadow.setVisible(false); v.label.setVisible(false); } this.view = null; return v; }
  render(now: number): void {
    const v = this.view; if (!v) return; const art = this.def.art, reused = art.startsWith('xiliang'), custom = this.def.walkVisual;
    const sheet = custom?.texture ?? (reused ? `${art}_walk` : `${art}_walk_sheet`);
    const attack = !custom && !reused && this.kind !== 'medic' && now < this.attackUntil;
    const meleeAction=this.kind==='halberdier';
    const anticipation=meleeAction&&this.cooldown>0&&this.cooldown<=.1&&this.ai.target?.active&&Math.hypot(this.ai.target.x-this.x,this.ai.target.y-this.y)<=this.def.range;
    const progress=Math.max(0,Math.min(1,(now-this.attackStarted)/Math.max(1,this.attackUntil-this.attackStarted)));
    const action = this.def.actionVisual && (now < this.attackUntil || anticipation);
    const texture = action ? this.def.actionVisual!.texture : attack ? `${art}_attack_sheet` : sheet;
    const frame = action ? `${this.dir}_${(meleeAction?(now>=this.attackUntil?0:Math.min(3,1+Math.floor(progress*3))):Math.min(3,Math.floor(progress*4)))}` : attack ? `atk_${this.dir}_${(now-this.attackStarted)/Math.max(1,this.attackUntil-this.attackStarted)<.5 ? 0 : 1}` : `${this.dir}_${!this.moving || custom && now < this.attackUntil ? 0 : Math.floor(this.walked / 14) % 4}`;
    const scale = custom?.scale ?? (this.kind === 'rider' ? .8 : .58);
    const frameHeight=action&&meleeAction?112:96;
    const ground = action&&meleeAction?100/112:custom?.groundY ?? (reused ? .875 : .98);
    v.sprite.setVisible(this.active).setTexture(visualTextureKey(this.scene,texture), frame).setScale(scale).setTint(now < this.hurtUntil ? 0xff9999 : this.def.tint).setOrigin(.5, ground - this.radius * .72 / (frameHeight * scale)).setDepth(actorDepth(this.y + this.radius * .72));
    // Same-character procedural follow-through where independent attack art is still absent.
    const follow=now<this.attackUntil?Math.sin(progress*Math.PI):0;
    v.sprite.setRotation(this.kind==='guardian'?follow*.035*(this.facingX||1):this.kind==='rider'?follow*.045*(this.facingX||1):0);
    v.shadow.setVisible(this.active).setPosition(this.x, this.y + this.radius * .72);
    v.label.setVisible(false);
  }
  static makeView(scene: Phaser.Scene): AllyView { return { sprite: scene.add.image(0, 0, 'shu_swordsman_walk_sheet', 'down_0'), shadow: scene.add.image(0, 0, 'shadow').setDisplaySize(35, 14).setAlpha(.5).setDepth(DEPTH.enemy - 1), label: scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', resolution: 2, stroke: '#162018', strokeThickness: 2 }).setOrigin(.5).setDepth(DEPTH.enemy + 3) }; }
}
