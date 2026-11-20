import Phaser from 'phaser';
import { DEPTH } from '../config';
import type {Enemy} from '../entities/Enemy';
import type {Player} from '../entities/Player';
import type {Legion} from './Legion';
import {warnCircle} from '../ui/Telegraph';
import {DONGZHUO_BOSS as D} from '../data/dongzhuo';
import {troopArtReady} from './TroopArt';

interface Host {
  scene: Phaser.Scene; player: Player; army: Legion;
  move: (e: Enemy, nx: number, ny: number, dt: number) => void;
  raid: (now: number) => void; guards: (n: number, x: number, y: number) => void;
  spawn: (kind: 'infantry' | 'cavalry', x: number, y: number) => void;
  banner: (text: string, caption?: string) => void;
}
interface Fire {lit?: boolean; x: number; y: number; warnUntil: number; burnUntil: number; tickAt: number; g: Phaser.GameObjects.Graphics; flames?: Phaser.GameObjects.Image[]}

/**
 * 董卓主效果手绘图 fx_dz（ChatGPT 黑底 6×4，每格 256，每行 6 帧；2026-11-19）：行 0 纵火点燃爆（落点）/ 行 1 号令铁骑冲击波 / 行 2 飞熊军护驾金光 / 行 3 迁都焚城大爆燃。
 * 缺图什么都不画（原有预警圈 + 地火序列帧不变）。
 */
const DZ_FX = {key: 'fx_dz', rows: {ignite: 0, raid: 1, guard: 2, flee: 3}, ms: {ignite: 700, raid: 800, guard: 900, flee: 1100}} as const;
/**
 * 2-3 火烧洛阳 · 董卓：慢步追击；纵火（预警圈后燃烧，烧主将与部曲）；号令西凉铁骑突阵；飞熊军护驾；
 * 半血「迁都」：短暂无敌后撤、召一波西凉兵，之后纵火更频繁。
 */
export class DongzhuoBoss {
  private fires: Fire[] = []; private nextFire: number; private nextRaid: number; private retreated = false; private retreatUntil = 0; private rx = 0; private ry = 0;
  constructor(private h: Host, readonly boss: Enemy, now: number) {
    this.nextFire = now + 3000; this.nextRaid = now + D.raidEvery * 1000 * .6;
    this.trySkin();
    h.guards(D.guards, boss.x, boss.y); this.fx('guard', boss.x, boss.y, 200); h.banner('董卓 · 火烧洛阳', '躲开火圈 · 飞熊军护驾');
  }
  /** 正式图（董卓行走 / 攻击图）载好就换掉占位造型；还没载好（首领出场很早，如过场预览）就每帧再试。 */
  private skinned = false;
  private trySkin(): void {
    if (this.skinned || !troopArtReady(this.h.scene, 'dongzhuo_walk') || !this.boss.active) return;
    this.skinned = true; const boss = this.boss;
    boss.reskin({...boss.def, texture: 'dongzhuo_walk', walkVisual: {texture: 'dongzhuo_walk', scale: D.artScale, groundY: D.artGroundY, matched: true}, attackVisual: troopArtReady(this.h.scene, 'dongzhuo_attack') ? 'dongzhuo_attack' : undefined, tint: undefined});
  }
  /** 在 (x,y) 播一段主效果（6 帧一遍）；size = 显示边长（世界像素）。 */
  private fx(kind: keyof typeof DZ_FX.rows, x: number, y: number, size: number): void {
    const sc = this.h.scene; if (!sc.textures.exists(DZ_FX.key)) return;
    const row = DZ_FX.rows[kind], img = sc.add.image(x, y - 8, DZ_FX.key, row * 6).setDisplaySize(size, size).setAlpha(.9).setDepth(DEPTH.fx + 2).setName('dongzhuo-fx');
    sc.tweens.addCounter({from: 0, to: 5.99, duration: DZ_FX.ms[kind], onUpdate: tw => img.setFrame(row * 6 + Math.floor(tw.getValue() ?? 0)), onComplete: () => img.destroy()});
  }
  get label(): string { return this.retreated ? '迁都 · 纵火加剧' : '纵火 · 铁骑 · 飞熊军'; }
  /** 每帧接管董卓移动。 */
  step(dt: number, now: number): void {
    const b = this.boss, p = this.h.player;
    // 迁都：匀速走到撤退点（原来按比例缓动，头几帧一步十几像素被步态当成击退，定格平移；11-19「董卓也在平移」）
    if (now < this.retreatUntil) { const rx = this.rx - b.x, ry = this.ry - b.y, rd = Math.hypot(rx, ry); if (rd > 1) { const st = Math.min(rd, this.retreatSpeed * dt); b.sprite.x += rx / rd * st; b.sprite.y += ry / rd * st; } b.moveVx = b.moveVy = 0; return; }
    if (b.invulnerable && this.retreated) b.invulnerable = false;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
    // 群体移动（EnemyMovement）把首领的 moveVx 清零，人群避让开着时 advanceEnemy 按 moveVx 走 → 董卓几乎不动、只被挤着平移。这里自己给速度
    const nx = d > 50 ? dx / d : 0, ny = d > 50 ? dy / d : 0; b.moveVx = nx * b.def.speed; b.moveVy = ny * b.def.speed;
    this.h.move(b, nx, ny, dt);
    if (!this.retreated && b.hp <= b.maxHp * D.retreatAt) this.retreat(now);
  }
  /** 迁都撤退的匀速（像素 / 秒）：撤退时长的八成走完。 */
  private retreatSpeed = 0;
  private retreat(now: number): void {
    const b = this.boss, p = this.h.player; this.retreated = true; b.invulnerable = true; this.retreatUntil = now + D.retreatMs;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1; this.rx = b.x + dx / d * D.retreatDistance; this.ry = b.y + dy / d * D.retreatDistance; this.retreatSpeed = D.retreatDistance / (D.retreatMs * .8 / 1000);
    this.h.banner('董卓迁都 · 焚城西走', '西凉兵断后');
    for (let i = 0; i < D.retreatInfantry; i++) { const a = i / D.retreatInfantry * Math.PI * 2; this.h.spawn('infantry', p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320); }
    for (let i = 0; i < D.retreatCavalry; i++) { const a = Math.random() * Math.PI * 2; this.h.spawn('cavalry', p.x + Math.cos(a) * 380, p.y + Math.sin(a) * 380); }
    this.fx('flee', b.x, b.y, 340); this.h.guards(D.guards, this.rx, this.ry); this.fx('guard', this.rx, this.ry, 200);
  }
  /** 纵火与号令（GameScene 每帧调用，首领活着时）。 */
  update(now: number): void {
    this.trySkin();
    const p = this.h.player;
    if (now >= this.nextFire) {
      this.nextFire = now + (this.retreated ? D.fireEveryEnraged : D.fireEvery) * 1000;
      { const b = this.boss, dx = p.x - b.x, dy = p.y - b.y; b.startAttack(now, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'); }
      for (let i = 0; i < D.fireCount; i++) { const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 90 + Math.random() * 60; this.fires.push({x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, warnUntil: now + D.fireWarnMs, burnUntil: now + D.fireWarnMs + D.fireBurnMs, tickAt: 0, g: this.h.scene.add.graphics().setDepth(2).setName('dongzhuo-fire')}); }
    }
    if (now >= this.nextRaid) { this.nextRaid = now + D.raidEvery * 1000; this.h.raid(now); this.fx('raid', this.boss.x, this.boss.y, 280); }
    for (const f of [...this.fires]) {
      f.g.clear();
      if (now < f.warnUntil) { warnCircle(f.g, f.x, f.y, D.fireRadius, 1 - (f.warnUntil - now) / D.fireWarnMs, 0xd2573a, 0xf2c27a, false, now, 'fire'); continue; }
      if (!f.lit) { f.lit = true; this.fx('ignite', f.x, f.y, D.fireRadius * 3); }
      if (now >= f.burnUntil) { f.g.destroy(); for (const im of f.flames ?? []) im.destroy(); this.fires.splice(this.fires.indexOf(f), 1); continue; }
      // 燃烧：用现成的地火序列帧（ground_fire，3 簇小火错开帧），代替原来程序画的橙色实心椭圆（用户「首领的攻击特效也需要兼容适应」）
      if (this.h.scene.textures.exists('ground_fire')) {
        if (!f.flames) f.flames = [0, 1, 2].map(i => { const a = i * 2.1 + f.x * .01, r = i ? D.fireRadius * .5 : 0; return this.h.scene.add.image(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .6, 'ground_fire', i * 2).setOrigin(.5, .72).setDisplaySize(D.fireRadius * (i ? 1.6 : 2.1), D.fireRadius * (i ? 1.6 : 2.1)).setDepth(DEPTH.ground + 3).setAlpha(0); });
        const left = f.burnUntil - now, fade = Math.min(1, (now - f.warnUntil) / 200, left / 300);
        f.flames.forEach((im, i) => im.setFrame((Math.floor(now / 110) + i * 3) % 8).setAlpha(.9 * fade));
      } else {
        const flick = .55 + .2 * Math.sin(now / 60 + f.x);
        f.g.fillStyle(0xd2462a, flick * .55).fillEllipse(f.x, f.y, D.fireRadius * 2, D.fireRadius * 1.2).fillStyle(0xffb347, flick * .6).fillEllipse(f.x, f.y - 6, D.fireRadius * 1.2, D.fireRadius * .7);
      }
      if (now >= f.tickAt) {
        f.tickAt = now + D.fireTickMs;
        if (Math.hypot((p.x - f.x) / 1, (p.y - f.y) / .6) <= D.fireRadius) p.takeDamage(D.fireDamage, now);
        this.h.army.hurtArea(f.x, f.y, D.fireRadius, D.fireDamage, now);
      }
    }
  }
  /** 测试用。 */
  get state() { return {fires: this.fires.length, retreated: this.retreated, invulnerable: this.boss.invulnerable}; }
  clear(): void { for (const f of this.fires) { f.g.destroy(); for (const im of f.flames ?? []) im.destroy(); } this.fires = []; }
}
