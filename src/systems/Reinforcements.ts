import Phaser from 'phaser';
import { frameScale } from './HdHeroSheets';
import { warText } from '../ui/WarStyle';
import { CHARACTERS, type CharacterId } from '../data/characters';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { COMBOS as PAIRS } from '../data/reinforcements';
import { HINT_MOCK } from '../ui/HintStyle';

interface Burn { enemy: Enemy; spawn: number; until: number; next: number; }
export class Reinforcements {
  readonly panel: Phaser.GameObjects.Container;
  readonly choices: CharacterId[];
  nextAt = 60 + Math.random() * 20;
  private readonly helper: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.Text;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly spear: Phaser.GameObjects.Image;
  private readonly slash: Phaser.GameObjects.Image;
  private readonly flame: Phaser.GameObjects.Image;
  private started = -1; private stage = 0;
  private pair: typeof PAIRS[number] | null = null;
  private tx = 0; private ty = 0; private ox = 0; private oy = 0;
  private readonly marks: Array<{ enemy: Enemy; spawn: number }> = [];
  private readonly burns = new Map<number, Burn>();
  constructor(scene: Phaser.Scene, readonly hero: CharacterId, private readonly player: Player, choose: (id: CharacterId) => void) {
    this.choices = CHARACTERS.filter(c => c.id !== hero).map(c => c.id);
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    this.spear = scene.add.image(0, 0, 'spear_thrust', 'tight').setDepth(DEPTH.fx).setVisible(false);
    this.slash = scene.add.image(0, 0, 'guandao_slash_sheet', '0').setDepth(DEPTH.fx).setVisible(false);
    this.flame = scene.add.image(0, 0, 'flame').setDepth(DEPTH.fx).setVisible(false);
    this.helper = scene.add.image(0, 0, 'hero_walk_sheet', 'down_0').setScale(.8).setVisible(false).setDepth(DEPTH.player);
    this.text = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * .25, '', { fontFamily: FONT, fontSize: '23px', color: '#ffe2a0', stroke: '#22130e', strokeThickness: 3 }).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud + 5).setVisible(false);
    this.panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH.overlay + 2).setVisible(false);
    this.panel.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d1d15, .86).setOrigin(0).setInteractive());
    this.panel.add(scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * .15, '援军抵达 · 选择合击武将', { fontFamily: FONT, fontSize: '25px', color: '#ffe2a0' }).setOrigin(.5));
    this.panel.add(scene.add.text(GAME_WIDTH/2,GAME_HEIGHT*.215,'短暂登场 · 释放合击后离场',warText(14,'#a8bca8')).setOrigin(.5));
    for (let i = 0; i < this.choices.length; i++) {
      const id = this.choices[i], char = CHARACTERS.find(c => c.id === id)!, pair = this.find(id), y = GAME_HEIGHT * (.32 + i * .18);
      const width = Math.min(600,GAME_WIDTH-60), height = GAME_HEIGHT>600 ? 128 : 88;
      const card = scene.add.image(GAME_WIDTH/2,y,'ui_war_card').setDisplaySize(width,height);
      const portrait = scene.add.image(GAME_WIDTH/2-width/2+60,y,char.portrait);
      portrait.setScale(Math.min((height-16)/portrait.width,(height-16)/portrait.height));
      const row = scene.add.text(GAME_WIDTH/2-width/2+120,y,`${char.name}\n${pair?.name ?? '合击配置待补充'}`,{...warText(GAME_HEIGHT>600?20:18,pair?'#e9dab5':'#7e897b'),lineSpacing:8}).setOrigin(0,.5);
      if (pair) {
        card.setInteractive({useHandCursor:true}).on('pointerdown',()=>choose(id)).on('pointerover',()=>card.setTint(0xe4d5b6)).on('pointerout',()=>card.clearTint());
        row.setInteractive({useHandCursor:true}).on('pointerdown',()=>choose(id));
      }
      this.panel.add([card,portrait]);
      this.panel.add(row);
    }
    for (const child of this.panel.list) (child as Phaser.GameObjects.Text).setScrollFactor(0);
  }
  find(partner: CharacterId) { return PAIRS.find(p => p.ids.includes(this.hero) && p.ids.includes(partner) && partner !== this.hero); }
  start(partner: CharacterId, now: number, enemies: Enemy[]): boolean {
    const pair = this.find(partner); if (!pair) return false;
    this.pair = pair; this.started = now; this.stage = 0; this.ox = this.player.x; this.oy = this.player.y;
    const targets = enemies.filter(e => e.active && Math.hypot(e.x - this.ox, e.y - this.oy) < 500).sort((a, b) => Math.hypot(a.x - this.ox, a.y - this.oy) - Math.hypot(b.x - this.ox, b.y - this.oy));
    this.tx = targets[0]?.x ?? this.ox + 180; this.ty = targets[0]?.y ?? this.oy;
    this.marks.length = 0; for (const enemy of targets.slice(0, 5)) this.marks.push({ enemy, spawn: enemy.spawnId });
    const sheet = partner === 'zhaoyun' ? 'hero_walk_sheet' : `${partner}_walk_sheet`;
    this.helper.setTexture(sheet, 'down_0').setScale(.8 * frameScale(this.helper.scene, sheet, 'down_0')).setPosition(this.ox + 45, this.oy + 20).setVisible(true).setAlpha(1);
    this.text.setText(`${pair.name} · 援军合击`).setVisible(true);
    this.nextAt = now / 1000 + 75 + Math.random() * 25; return true;
  }
  clear(): void { this.started = -1; this.burns.clear(); this.helper.setVisible(false); this.text.setVisible(false); this.spear.setVisible(false); this.slash.setVisible(false); this.flame.setVisible(false); this.gfx.clear(); }
  update(now: number, enemies: Enemy[], hit: (enemy: Enemy, amount: number, fire?: boolean) => void): void {
    for (const [key, burn] of this.burns) {
      if (!burn.enemy.active || burn.enemy.spawnId !== burn.spawn) { this.burns.delete(key); continue; }
      while (burn.enemy.active && burn.enemy.spawnId === burn.spawn && burn.next <= now && burn.next <= burn.until) { burn.next += 500; hit(burn.enemy, 15, true); }
      if (now >= burn.until) this.burns.delete(key);
    }
    this.gfx.clear(); if (this.started < 0 || !this.pair) return;
    const t = now - this.started, kind = this.pair.kind;
    const angle = Math.atan2(this.ty - this.oy, this.tx - this.ox);
    this.spear.setVisible((kind === 'spearSlash' || kind === 'firePath') && t >= 250 && t < 750).setPosition((this.ox + this.tx) / 2, (this.oy + this.ty) / 2).setRotation(angle).setDisplaySize(Math.max(180, Math.hypot(this.tx - this.ox, this.ty - this.oy)), 30).setAlpha(.75);
    this.slash.setVisible((kind === 'spearSlash' && t >= 750 || kind === 'burnSweep' && t < 750 || kind === 'arrowCircle' && t < 750) && t < 1400).setPosition(this.tx, this.ty).setRotation(angle).setDisplaySize(300, 300).setAlpha(.55);
    this.flame.setVisible(['firePath', 'burnSweep', 'fireVolley'].includes(kind) && t >= 750).setPosition(this.tx, this.ty).setDisplaySize(270, 270).setAlpha(.3 * Math.max(0, 1 - t / 1800));
    const stages = kind === 'markedVolley' ? [400, 800, 1050, 1300] : kind === 'fireVolley' ? [300, 650, 1000, 1350] : [300, 850];
    while (this.stage < stages.length && t >= stages[this.stage]) {
      const stage = this.stage++;
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = this.tx - this.ox, dy = this.ty - this.oy, length = Math.hypot(dx, dy) || 1;
        const along = ((e.x - this.ox) * dx + (e.y - this.oy) * dy) / length;
        const across = Math.abs((e.x - this.ox) * dy - (e.y - this.oy) * dx) / length;
        if (kind === 'markedVolley') {
          if (stage && this.marks.some(m => m.enemy === e && m.spawn === e.spawnId)) hit(e, 65);
        } else if (kind === 'fireVolley') {
          if (Math.hypot(e.x - this.tx, e.y - this.ty) <= 160) { hit(e, 45, true); if (e.active) this.burns.set(e.uid, { enemy: e, spawn: e.spawnId, until: now + 2000, next: this.burns.get(e.uid)?.next ?? now + 500 }); }
        } else if (kind === 'burnSweep') {
          if (Math.hypot(e.x - this.tx, e.y - this.ty) <= (stage ? 200 : 180)) { hit(e, stage ? 125 : 65, !!stage); if (!stage && !e.controlImmune) e.stunUntil = now + 600; if (stage && e.active) this.burns.set(e.uid, { enemy: e, spawn: e.spawnId, until: now + 2000, next: now + 500 }); }
        } else if (kind === 'arrowCircle') {
          if (Math.hypot(e.x - this.tx, e.y - this.ty) <= (stage ? 180 : 150)) { hit(e, stage ? 100 : 65); if (!stage && !e.controlImmune) e.stunUntil = now + 800; }
        } else if (stage ? Math.hypot(e.x - this.tx, e.y - this.ty) <= (kind === 'firePath' ? 170 : 180) : along > -20 && along < Math.max(360, length) && across < 48) {
          hit(e, stage ? 120 : 85, kind === 'firePath');
          if (!stage && kind === 'firePath' && e.active) this.burns.set(e.uid, { enemy: e, spawn: e.spawnId, until: now + 2000, next: now + 500 });
        }
      }
    }
    const g = this.gfx, fade = Math.max(0, 1 - t / 1800);
    const fire = ['firePath', 'burnSweep', 'fireVolley'].includes(kind);
    if (HINT_MOCK) g.clear(); else {
    g.lineStyle(5, fire ? 0xff873e : 0x9bdde0, fade);
    if (kind === 'markedVolley') { for (const m of this.marks) if (m.enemy.active && m.enemy.spawnId === m.spawn) { g.strokeCircle(m.enemy.x, m.enemy.y, 22); if (t > 700) g.lineBetween(this.helper.x, this.helper.y, m.enemy.x, m.enemy.y); } }
    else { if (t < 850 && kind !== 'arrowCircle') g.lineBetween(this.ox, this.oy, this.tx, this.ty); if (t > 700 || kind === 'arrowCircle' || kind === 'burnSweep' || kind === 'fireVolley') { g.strokeCircle(this.tx, this.ty, kind === 'burnSweep' ? 200 : kind === 'fireVolley' ? 160 : 170); g.fillStyle(fire ? 0xff6528 : 0x73bc9d, fade * .1).fillCircle(this.tx, this.ty, 170); } } }
    this.helper.setAlpha(fade);
    if (t > 1800) { this.started = -1; this.helper.setVisible(false); this.text.setVisible(false); this.spear.setVisible(false); this.slash.setVisible(false); this.flame.setVisible(false); g.clear(); }
  }
}
