import {visualTextureKey} from '../systems/ReadableTextures';
import Phaser from 'phaser';
import { CharacterPassives } from '../systems/CharacterPassives';
import { RunGrowth } from '../systems/RunGrowth';
import { BALANCE, DEPTH, FONT, actorDepth } from '../config';
import { applySetBonus, RELIC_BY_ID, type RelicSchool } from '../data/relics';
import type { PlayerStats, WeaponState } from '../types';

/** 赵云：位置/生命/等级/属性。表现层只负责把 sprite 摆到位。 */
export class Player {
  armyDamageTakenMul = 1;
  readonly passive = new CharacterPassives();
  growth = new RunGrowth('zhaoyun');
  readonly scene: Phaser.Scene;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  private readonly commandRing:Phaser.GameObjects.Graphics;
  private readonly markerLabel: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Graphics;

  hp: number = BALANCE.player.maxHp;
  level = 1;
  xp = 0;
  xpNext = 16;
  alive = true;
  invulnUntil = 0;
  damageImmune = false;
  damageGuard?: (damage:number,now:number)=>number;

  stats: PlayerStats = {
    damageMul: 1,
    cooldownMul: 1,
    moveMul: 1,
    critChance: 0.05,
    regen: 0.25,
    pickupRadius: BALANCE.player.pickupRadius,
    armor: 0,
    maxHpBonus: 0,
    meleeMul: 1,
    arrowMul: 1,
    fireMul: 1,
    fireAreaMul: 1,
    damageTakenMul: 1,
  };

  /** 本局已获得的遗物（每件唯一）。 */
  relics: string[] = [];
  private setApplied = new Set<RelicSchool>();

  weapons: WeaponState[] = [{ id: 'spear_orbit', level: 1, cooldownLeft: 0 }];

  knockedUntil = 0;
  private knockedAt = 0;
  private knockVx = 0;
  private knockVy = 0;
  private faceLeft = false;
  direction: 'down' | 'up' | 'left' | 'right' = 'down';
  private forcedDir: 'down' | 'up' | 'left' | 'right' | null = null;
  private forcedUntil = 0;
  private walkPhase = 0;
  private readonly targetHeight = 66;
  private readonly charTexture = 'hero_zhaoyun';
  /** 当前使用的行走表 key；关羽/黄忠正式素材到位后替换。 */
  walkSheet = 'hero_walk_sheet';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.shadow = scene.add.image(x, y + 16, 'shadow').setDisplaySize(48, 20).setDepth(DEPTH.enemy - 1).setAlpha(0.8);
    this.sprite = scene.add.image(x, y, 'hero_zhaoyun').setDepth(actorDepth(y + 26));
    this.commandRing=scene.add.graphics().setDepth(DEPTH.player-.1);
    this.commandRing.lineStyle(2,0x14241f,.8).strokeEllipse(0,0,45,18).lineStyle(1,0xd7c38a,.85).strokeEllipse(0,0,43,16).lineStyle(1,0x9ac8c2,.65).strokeEllipse(0,0,36,12);
    for(const x of[-24,24])this.commandRing.fillStyle(0xdec896,.9).fillRect(x-2,-1,4,2);
    this.marker=scene.add.graphics().setDepth(DEPTH.fx+1);
    this.marker.fillStyle(0x17251c).fillTriangle(-7,-3,7,-3,0,6)
      .fillStyle(0xf3e6b0).fillTriangle(-4,-1,4,-1,0,3);
    this.marker.setPosition(x,y-38);
    this.markerLabel=scene.add.text(x,y-45,'主将',{fontFamily:FONT,fontSize:'12px',resolution:2,color:'#f3e6b0',stroke:'#16241b',strokeThickness:3}).setOrigin(.5,1).setDepth(DEPTH.hud-1);
    this.applyTextureScale();
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get maxHp(): number {
    return BALANCE.player.maxHp + this.stats.maxHpBonus + this.growth.bonusMaxHp();
  }

  get radius(): number {
    return BALANCE.player.radius;
  }

  get speed(): number {
    return BALANCE.player.speed * Math.min(1.6, this.stats.moveMul * this.growth.movementMultiplier()*(this.growth.build.tags().skirmish>=2?1.04:1));
  }

  knockUp(now: number, duration: number, dx: number, dy: number): void {
    this.knockedAt = now; this.knockedUntil = now + duration;
    this.knockVx = dx / (duration / 1000); this.knockVy = dy / (duration / 1000);
  }
  move(dt: number, vx: number, vy: number): void {
    // Keep the identification marker above crowds, but let the body pass behind buildings.
    this.sprite.setDepth(actorDepth(this.y + 26) + .002);
    const now = (this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now;
    if (now < this.knockedUntil) {
      this.sprite.x += this.knockVx * dt; this.sprite.y += this.knockVy * dt;
      this.applyWalkVisual(false); this.shadow.setPosition(this.x, this.y + 26); return;
    }
    const len = Math.hypot(vx, vy);
    let moving = false;
    if (len > 0.001) {
      const nx = vx / len;
      const ny = vy / len;
      moving = true;
      this.sprite.x += nx * this.speed * dt;
      this.sprite.y += ny * this.speed * dt;
      // 四方向朝向：左右翻转，上下使用不同行走帧（有素材时）或占位步态
      const forced = this.forcedDir && ((this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now) < this.forcedUntil ? this.forcedDir : null;
      this.direction = forced ?? (Math.abs(nx) > Math.abs(ny) ? (nx < 0 ? 'left' : 'right') : ny < 0 ? 'up' : 'down');
      this.faceLeft = this.direction === 'left';
      this.walkPhase += dt * 9;
    }
    // 行走表本身已经分方向，不能再翻转，否则向左会变成向右
    const directional = this.scene.textures.exists('hero_walk_sheet') || this.scene.textures.exists(`hero_walk_${this.direction}_0`);
    this.sprite.setFlipX(directional ? false : this.faceLeft);
    this.applyWalkVisual(moving);
    this.sprite.setRotation(0);
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 26);
  }

  /** 攻击时短暂面向目标方向，结束后恢复移动面向。 */
  faceDirection(dir: 'down' | 'up' | 'left' | 'right', ms = 130): void {
    this.forcedDir = dir;
    this.forcedUntil = ((this.scene as Phaser.Scene & { combatNow?: number }).combatNow ?? this.scene.time.now) + ms;
    this.direction = dir;
    this.faceLeft = dir === 'left';
    if (this.scene.textures.exists(this.walkSheet) && this.scene.textures.get(this.walkSheet).has(`${dir}_0`)) {
      this.sprite.setTexture(visualTextureKey(this.scene,this.walkSheet), `${dir}_0`);
    }
  }

  setWalkSheet(key: string): void {
    if (!this.scene.textures.exists(key)) return;
    this.walkSheet = key;
    // 立刻切到该武将的待机帧，避免进战斗先闪一下赵云
    try {
      if (this.scene.textures.get(key).has('down_0')) {
        this.sprite.setTexture(visualTextureKey(this.scene,key), 'down_0');
        this.applyTextureScale();
      }
    } catch {
      /* ignore */
    }
  }

  /** 有 4 方向行走素材时播放；没有时用轻微步态占位。 */
  private applyWalkVisual(moving: boolean): void {
    const sheet = this.scene.textures.exists(this.walkSheet);
    const dirKey = `hero_walk_${this.direction}`;
    const hasFrames = this.scene.textures.exists(`${dirKey}_0`) || sheet;
    if (hasFrames && moving) {
      const frame = Math.floor(this.walkPhase) % 4;
      if (sheet) {
        const name = `${this.direction}_${frame}`;
        if (this.sprite.frame.name !== name) this.sprite.setTexture(visualTextureKey(this.scene,this.walkSheet), name);
      } else {
        const key = `${dirKey}_${frame}`;
        if (this.sprite.texture.key !== key) this.sprite.setTexture(visualTextureKey(this.scene,key));
      }
    } else if (!hasFrames && this.sprite.texture.key !== this.charTexture) {
      this.sprite.setTexture(this.charTexture);
    }
    this.applyTextureScale(moving);
  }

  private applyTextureScale(moving = false): void {
    // 注意：雪碧图 texture 的高度是整张 sheet（384），要用当前 frame 的高度（96）
    const frameH = this.sprite.frame && this.sprite.frame.height ? this.sprite.frame.height : 0;
    const source = this.sprite.texture.getSourceImage() as { height?: number };
    const texH = frameH || (source && source.height ? source.height : 128);
    const base = this.targetHeight / texH;
    const bob = moving && !this.scene.textures.exists(this.walkSheet) && !this.scene.textures.exists(`hero_walk_${this.direction}_0`)
      ? 1 + Math.sin(this.walkPhase * 2) * 0.02
      : 1;
    this.sprite.setScale(base, base * bob);
  }

  takeDamage(raw: number, now: number): boolean {
    if (!this.alive || this.damageImmune || now < this.invulnUntil) return false;
    const afterArmor = Math.max(1, raw - this.stats.armor);
    const unguarded = Math.max(1, Math.round(afterArmor * this.stats.damageTakenMul * this.armyDamageTakenMul * this.growth.incomingDamageMultiplier()));
    const dmg=Math.max(1,this.damageGuard?.(unguarded,now)??unguarded);
    const ironRescue=this.hp<=dmg&&this.growth.build.tags().bulwark>=4&&!this.growth.awakenRescueUsed;
    if(ironRescue)this.growth.awakenRescueUsed=true;
    const rescue=!ironRescue&&this.hp<=dmg&&this.growth.build.treasures.includes('revival_jade')&&!this.growth.revivalUsed;
    if(rescue)this.growth.revivalUsed=true;
    this.hp = (rescue||ironRescue)?1:Math.max(0, this.hp - dmg);
    this.invulnUntil = now + BALANCE.player.invuln * 1000;
    if(rescue||ironRescue)this.invulnUntil=Math.max(this.invulnUntil,now+1000);
    this.passive.onDamage(now);
    if (this.hp <= 0) { this.alive = false; this.passive.stop(); }
    return true;
  }

  /** 获得遗物；每件只生效一次，第二件同流派触发套装。 */
  addRelic(id: string): boolean {
    if (this.relics.includes(id)) return false;
    const def = RELIC_BY_ID.get(id);
    if (!def) return false;
    this.relics.push(id);
    def.apply(this);
    const count = this.relics.filter((rid) => RELIC_BY_ID.get(rid)?.school === def.school).length;
    if (count === 2 && !this.setApplied.has(def.school)) {
      this.setApplied.add(def.school);
      applySetBonus(this, def.school);
    }
    return true;
  }

  schoolCount(school: RelicSchool): number {
    return this.relics.filter((id) => RELIC_BY_ID.get(id)?.school === school).length;
  }

  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** 返回本次获得的等级数。 */
  gainXp(amount: number): number {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level += 1;
      gained += 1;
      this.xpNext = this.level <= 4 ? [16, 36, 52, 68][this.level - 2] ?? 68 : 68 + (this.level - 4) * 20;
    }
    return gained;
  }

  update(now: number, dt: number): void {
    this.commandRing.setPosition(this.x,this.y+21).setVisible(this.alive);
    this.marker.setPosition(this.x,this.y-38).setVisible(this.alive);
    this.markerLabel.setPosition(this.x,this.y-45).setVisible(this.alive);
    const t = now < this.knockedUntil ? (now - this.knockedAt) / (this.knockedUntil - this.knockedAt) : 1;
    const lift = t < 1 ? Math.sin(Math.PI * Math.max(0, t)) * 42 : 0;
    this.sprite.setOrigin(.5, .5 + lift / this.targetHeight);
    if (this.stats.regen > 0) this.heal(this.stats.regen * dt);
    const blinking = now < this.invulnUntil;
    this.sprite.setAlpha(blinking ? (Math.floor(now / 80) % 2 === 0 ? 0.35 : 1) : 1);
  }
}
