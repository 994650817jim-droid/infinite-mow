import Phaser from 'phaser';
import { LubuUltimate } from './LubuUltimate';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { LUBU_COMBAT as C } from '../data/chapters';
import { DEPTH } from '../config';
import { TELEGRAPH_CLASSIC, groundCracks, laneCracks, windupFlash } from '../ui/Telegraph';
import { BossKit, BOSS_OLD, ensureMoves, faceDir, type BossDebug } from './BossKit';
import { LB } from '../data/bossRedesign';
import { bossFxImage, ensureBossFx, hasBossFx } from './BossFx';

export type LubuState = 'approach' | 'sweepWindup' | 'sweep' | 'dashWindup' | 'dash' | 'recover' | 'ultTakeoff' | 'ultAirborne' | 'ultLanding'
  | 'comboWindup' | 'combo' | 'zigWindup' | 'zig' | 'hop' | 'aim' | 'shot' | 'spinWindup' | 'spin';
interface LubuHost {
  scene: Phaser.Scene;
  boss: Enemy;
  player: Player;
  playSfx(kind: string): void;
  onPhase2(): void;
  /** 重设计：二阶段转场台词横幅。 */
  banner?(text: string, caption?: string): void;
  hurtTroops?(x: number, y: number, radius: number, damage: number, now: number, angle?: number, arc?: number): void;
}
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/** 扇形 / 整圆遮罩（三角扇，不走 Earcut）。 */
function cone(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, r: number, arcDeg: number): void {
  const half = arcDeg * Math.PI / 360, n = Math.max(6, Math.ceil(arcDeg / 12));
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < n; i++) { const a0 = angle - half + half * 2 * i / n, a1 = angle - half + half * 2 * (i + 1) / n; g.fillTriangle(x, y, x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r); }
}

/** 近战Boss：仅由冻结的战斗时钟驱动，无独立Timer、无召唤/法球。 */
export class LubuBoss {
  state: LubuState = 'approach';
  phase2 = false;
  energy = 0;
  private readonly ultimate: LubuUltimate;
  private until = 0;
  private startedAt = 0;
  private sweepCd = 1.5;
  private dashCd = 4;
  private angle = 0;
  private ox = 0;
  private oy = 0;
  private travelled = 0;
  private hitApplied = false;
  private readonly slash: Phaser.GameObjects.Image;
  private walkMs = 0;
  private readonly sweepMask: Phaser.GameObjects.Graphics;
  private lastAttack: 'sweep' | 'dash' = 'sweep';
  private facing: 'down' | 'left' | 'right' | 'up' = 'down';
  private readonly gfx: Phaser.GameObjects.Graphics;
  /** 重设计公共件（姿态 / 收招 / 转场）；?boss=old 时为空，走旧版。 */
  private readonly kit?: BossKit;

  constructor(private readonly host: LubuHost) {
    if (!BOSS_OLD) { ensureBossFx(host.scene, ['lb_whirl', 'lb_arrow', 'kit_shift', 'kit_recover']); ensureMoves(host.scene, 'lubu_moves'); }
    if (!BOSS_OLD) this.kit = new BossKit({ scene: host.scene, boss: host.boss, banner: (t, c) => host.banner?.(t, c), sfx: host.playSfx });
    this.ultimate = new LubuUltimate(host.scene, host.boss, host.player, host.playSfx, host.hurtTroops);
    this.gfx = host.scene.add.graphics().setDepth(DEPTH.fx - 1);
    this.sweepMask = host.scene.add.graphics().setVisible(false);
    this.slash = host.scene.add.image(0, 0, 'lubu_slash', 0).setDisplaySize(300, 300).setAlpha(.85).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(DEPTH.player - 1).setVisible(false);
    this.slash.setMask(this.sweepMask.createGeometryMask());
  }

  private now = 0;
  get telegraphProgress(): number {
    return this.state === 'sweepWindup' || this.state === 'dashWindup'
      ? Math.max(0, Math.min(1, (this.now - this.startedAt) / Math.max(1, this.until - this.startedAt))) : 0;
  }
  get statusLabel(): string {
    return { comboWindup: '方天三连 · 看准每一段', combo: '方天三连', zigWindup: '赤兔突袭 · 看冲锋道', zig: '赤兔突袭', hop: '后跳拉弓', aim: '辕门射戟 · 瞄准中', shot: '辕门射戟', spinWindup: '无双乱舞 · 快往外跑', spin: '无双乱舞', approach: this.phase2 ? '人中吕布 · 追击' : '追击', sweepWindup: '横扫预警', sweep: '方天横扫', dashWindup: '冲锋蓄力', dash: '破阵冲锋', recover: '收招 · 反击机会', ultTakeoff: '魔神降世 · 起飞可击杀', ultAirborne: '腾空无敌 · 离开红圈', ultLanding: '落地挥戟 · 圈内双抗' }[this.state];
  }

  update(dt: number, now: number): void {
    const { boss, player, scene } = this.host;
    if (!boss.active) { this.clear(); return; }
    const previousX = boss.x, previousY = boss.y;
    this.now = now;
    this.gfx.clear();
    this.kit?.update(now);
    if (!this.phase2 && boss.hp <= boss.maxHp * .5) {
      this.phase2 = true; this.host.onPhase2();
      if (this.kit) { this.kit.phaseShift(now, '人中吕布 · 谁敢与我一战！', '二阶段 · 无双乱舞：往外跑', 0x300808, .18); this.state = 'approach'; this.gfx.clear(); this.spinCd = 1.5; }
    }
    if (this.phase2 && !this.ultimate.active && !this.kit?.inShift) this.energy = Math.min(100, this.energy + dt * C.ultEnergyPerSecond);
    this.tryUltimate(now);
    const wasUltimate = this.ultimate.active;
    this.ultimate.update(now);
    if (wasUltimate) {
      this.slash.setVisible(false);
      if (this.ultimate.phase === 'idle') this.recover(now);
      else this.state = ({ takeoff: 'ultTakeoff', airborne: 'ultAirborne', landing: 'ultLanding' } as const)[this.ultimate.phase];
      return;
    }
    if (this.kit) { this.updateV2(dt, now); this.updateArt(dt, now, boss.x - previousX, boss.y - previousY, true); return; }
    if (this.state === 'approach') {
      this.sweepCd -= dt; this.dashCd -= dt;
      const dx = player.x - boss.x, dy = player.y - boss.y, distance = Math.hypot(dx, dy) || 1;
      if (this.dashCd <= 0 && distance >= 145 && distance <= 520) this.begin('dashWindup', now);
      else if (this.sweepCd <= 0 && distance <= C.sweepRadius) this.begin('sweepWindup', now);
      else {
        const step = Math.min(Math.max(0, distance - 70), boss.def.speed * (this.phase2 ? C.enragedMoveMul : 1) * dt);
        boss.sprite.x += dx / distance * step; boss.sprite.y += dy / distance * step;
      }
    }
    if (this.state === 'sweepWindup') {
      this.drawSweep(0xffb347, .06 + this.telegraphProgress * .08);
      if (!TELEGRAPH_CLASSIC) windupFlash(boss, now);
      if (now >= this.until) {
        this.state = 'sweep'; this.until = now + C.sweepFlashMs;
        this.host.hurtTroops?.(this.ox, this.oy, C.sweepRadius, C.sweepDamage, now, this.angle, C.sweepAngle * Math.PI / 180);
        const dx = player.x - this.ox, dy = player.y - this.oy, d = Math.hypot(dx, dy);
        if (!this.hitApplied && d <= C.sweepRadius && Math.cos(Math.atan2(dy, dx) - this.angle) >= Math.cos(C.sweepAngle * Math.PI / 360)) {
          this.hitApplied = true; this.hurt(C.sweepDamage, now);
        }
        this.host.playSfx('allySlash'); scene.cameras.main.shake(90, .003);
      }
    }
    if (this.state === 'sweep') {
      this.drawSweep(0xffb347, .045);
      if (now >= this.until) this.recover(now);
    } else if (this.state === 'dashWindup') {
      const ex = this.ox + Math.cos(this.angle) * C.dashLength, ey = this.oy + Math.sin(this.angle) * C.dashLength;
      if (TELEGRAPH_CLASSIC) {
        this.gfx.lineStyle(C.dashHalfWidth * 2, 0xff5f46, .18 + this.telegraphProgress * .15);
        this.gfx.lineBetween(this.ox, this.oy, ex, ey);
        this.gfx.fillStyle(0xff5f46, .22); this.gfx.fillCircle(this.ox, this.oy, C.dashHalfWidth); this.gfx.fillCircle(ex, ey, C.dashHalfWidth);
        this.gfx.lineStyle(2, 0xffb347, .9); this.gfx.lineBetween(this.ox, this.oy, ex, ey);
      } else { laneCracks(this.gfx, this.ox, this.oy, this.angle, C.dashLength, C.dashHalfWidth * 2, this.telegraphProgress); windupFlash(boss, now); }
      if (now >= this.until) { this.state = 'dash'; this.travelled = 0; this.host.playSfx('chargeWarn'); }
    } else if (this.state === 'dash') {
      const ax = boss.x, ay = boss.y, step = Math.min(C.dashLength - this.travelled, C.dashSpeed * dt);
      boss.sprite.x += Math.cos(this.angle) * step; boss.sprite.y += Math.sin(this.angle) * step; this.travelled += step;
      this.host.hurtTroops?.((ax + boss.x) / 2, (ay + boss.y) / 2, C.dashHalfWidth + step / 2, C.dashDamage, now);
      this.gfx.lineStyle(5, 0xffb347, .55); this.gfx.lineBetween(ax - Math.cos(this.angle) * 40, ay - Math.sin(this.angle) * 40, boss.x, boss.y);
      this.gfx.lineStyle(2, 0xfff3dd, .85); this.gfx.lineBetween(ax, ay, boss.x, boss.y);
      if (!this.hitApplied && segmentDistance(player.x, player.y, ax, ay, boss.x, boss.y) <= C.dashHalfWidth + player.radius) {
        this.hitApplied = true; this.hurt(C.dashDamage, now);
      }
      if (this.travelled >= C.dashLength) this.recover(now);
    } else if (this.state === 'recover' && now >= this.until) {
      this.state = 'approach';
    }
    this.updateArt(dt, now, boss.x - previousX, boss.y - previousY);
    if (this.phase2 && TELEGRAPH_CLASSIC) { this.gfx.lineStyle(2, 0xff5f46, .6); this.gfx.strokeCircle(boss.x, boss.y, boss.radius + 8); }
  }


  // ================= 重设计样板（?boss=old 关闭）=================
  // 方天三连（刺 → 横扫 → 下劈，二阶段四连）/ 赤兔突袭（Z 字两折，二阶段三折）/ 辕门射戟（后跳拉弓，瞄准线跟随后锁定，一箭贯穿）
  // / 魔神降世（保留）；二阶段「人中吕布」加无双乱舞（原地三圈，半径越转越大，往外跑）。
  readonly debug: BossDebug = {
    moves: ['方天三连', '赤兔突袭', '辕门射戟', '魔神降世', '无双乱舞'],
    force: (i, now) => {
      if (this.ultimate.active) return;
      this.state = 'approach'; this.gfx.clear();
      if (i === 3) { this.energy = 0; this.ultimate.start(now); this.state = 'ultTakeoff'; return; }
      this.beginV2((['comboWindup', 'zigWindup', 'hop', 'comboWindup', 'spinWindup'] as const)[i] ?? 'comboWindup', now);
    },
    phase2: (now) => { const b = this.host.boss; if (b.hp > b.maxHp * .5) b.hp = Math.floor(b.maxHp * .5); this.update(0, now); },
  };
  private segs: { kind: 'thrust' | 'sweep' | 'smash'; x: number; y: number; angle: number }[] = [];
  private seg = 0; private fold = 0; private folds = 0; private foldSign = 1;
  private shotCd = 4; private spinCd = 2; private spinTick = 0; private hopFrom = { x: 0, y: 0 }; private hopTo = { x: 0, y: 0 };
  private whirl: Phaser.GameObjects.Image | null = null;
  private shotFlashUntil = 0; private shotLine = { x: 0, y: 0, a: 0 };
  readonly v2Metrics = { combo: 0, zig: 0, shot: 0, spin: 0, hits: 0 };

  private beginV2(state: 'comboWindup' | 'zigWindup' | 'hop' | 'spinWindup', now: number): void {
    const { boss, player } = this.host;
    this.ox = boss.x; this.oy = boss.y; this.angle = Math.atan2(player.y - boss.y, player.x - boss.x); this.hitApplied = false; this.startedAt = now;
    if (state === 'comboWindup') {
      this.v2Metrics.combo++; this.lastAttack = 'sweep'; this.seg = 0;
      const kinds: ('thrust' | 'sweep' | 'smash')[] = this.phase2 ? ['thrust', 'sweep', 'sweep', 'smash'] : ['thrust', 'sweep', 'smash'];
      this.segs = kinds.map(kind => ({ kind, x: 0, y: 0, angle: 0 })); this.aimSeg(now);
    } else if (state === 'zigWindup') {
      this.v2Metrics.zig++; this.lastAttack = 'dash'; this.fold = 0; this.folds = this.phase2 ? LB.zigzag.folds2 : LB.zigzag.folds; this.foldSign = Math.random() < .5 ? 1 : -1;
      this.angle += this.foldSign * .45; this.until = now + LB.zigzag.firstWarnMs; this.state = 'zigWindup'; this.host.playSfx('chargeWarn');
      this.kit?.banner('赤兔嘶鸣');
    } else if (state === 'hop') {
      this.v2Metrics.shot++; this.lastAttack = 'dash'; this.state = 'hop'; this.until = now + LB.shot.hopMs;
      this.hopFrom = { x: boss.x, y: boss.y }; this.hopTo = { x: boss.x - Math.cos(this.angle) * LB.shot.hop, y: boss.y - Math.sin(this.angle) * LB.shot.hop };
    } else {
      this.v2Metrics.spin++; this.lastAttack = 'sweep'; this.state = 'spinWindup'; this.until = now + LB.spin.windupMs; this.host.playSfx('chargeWarn');
    }
  }
  /** 三连的下一段：每段重新对准主将（追身连招），这一段的预警时间。 */
  private aimSeg(now: number): void {
    const { boss, player } = this.host, s = this.segs[this.seg], K = LB.combo;
    s.angle = Math.atan2(player.y - boss.y, player.x - boss.x); this.angle = s.angle;
    if (s.kind === 'smash') { s.x = boss.x + Math.cos(s.angle) * K.smash.ahead; s.y = boss.y + Math.sin(s.angle) * K.smash.ahead; } else { s.x = boss.x; s.y = boss.y; }
    this.state = 'comboWindup'; this.startedAt = now; this.until = now + K[s.kind].warnMs; this.hitApplied = false; this.host.playSfx('chargeWarn');
  }
  private recoverV2(now: number, ms: number): void {
    this.state = 'recover'; this.until = now + ms; this.kit?.recover(now, ms);
    this.sweepCd = this.phase2 ? LB.combo.cooldown2 : LB.combo.cooldown;
    if (this.lastAttack === 'dash') this.dashCd = Math.max(this.dashCd, this.phase2 ? LB.zigzag.cooldown2 : LB.zigzag.cooldown);
  }
  private hitPlayer(dmg: number, now: number): void { if (this.hitApplied) return; this.hitApplied = true; this.v2Metrics.hits++; this.hurt(dmg, now); }

  private updateV2(dt: number, now: number): void {
    const { boss, player } = this.host, kit = this.kit!;
    const dx = player.x - boss.x, dy = player.y - boss.y, d = Math.hypot(dx, dy) || 1, dir = faceDir(Math.cos(this.angle));
    this.slash.setVisible(false); this.whirl?.setVisible(false);
    this.art(now, dir);
    if (kit.inShift) { this.state = 'approach'; return; }
    const prog = this.telegraphProgressV2(now);
    switch (this.state) {
      case 'approach': {
        this.sweepCd -= dt; this.dashCd -= dt; this.shotCd -= dt; this.spinCd -= dt;
        if (this.phase2 && this.spinCd <= 0 && d <= LB.spin.range) this.beginV2('spinWindup', now);
        else if (this.sweepCd <= 0 && d <= LB.combo.range) this.beginV2('comboWindup', now);
        else if (this.dashCd <= 0 && d >= LB.zigzag.minRange && d <= LB.zigzag.maxRange) this.beginV2('zigWindup', now);
        else if (this.shotCd <= 0 && d >= LB.shot.minRange) this.beginV2('hop', now);
        else { const step = Math.min(Math.max(0, d - 70), boss.def.speed * (this.phase2 ? C.enragedMoveMul : 1) * dt); boss.sprite.x += dx / d * step; boss.sprite.y += dy / d * step; }
        break;
      }
      case 'comboWindup': {
        const s = this.segs[this.seg], K = LB.combo;
        kit.pose(s.kind === 'smash' ? 'rear' : 'crouch', prog, dir); windupFlash(boss, now);
        if (s.kind === 'thrust') laneCracks(this.gfx, s.x, s.y, s.angle, K.thrust.length, K.thrust.width, prog);
        else if (s.kind === 'sweep') groundCracks(this.gfx, s.x, s.y, K.sweep.radius, prog, s.angle, K.sweep.arcDeg * Math.PI / 180);
        else groundCracks(this.gfx, s.x, s.y, K.smash.radius, prog, 0, Math.PI * 2, 0, false, 'slam');
        if (now >= this.until) {
          // 出手
          const pr = player.radius;
          if (s.kind === 'thrust') {
            boss.sprite.x += Math.cos(s.angle) * 26; boss.sprite.y += Math.sin(s.angle) * 26;
            laneCracks(this.gfx, s.x, s.y, s.angle, K.thrust.length, K.thrust.width, 1, true);
            if (segmentDistance(player.x, player.y, s.x, s.y, s.x + Math.cos(s.angle) * K.thrust.length, s.y + Math.sin(s.angle) * K.thrust.length) <= K.thrust.width / 2 + pr) this.hitPlayer(K.thrust.damage, now);
            for (let k = 1; k <= 3; k++) this.host.hurtTroops?.(s.x + Math.cos(s.angle) * K.thrust.length * k / 4, s.y + Math.sin(s.angle) * K.thrust.length * k / 4, K.thrust.width, K.thrust.damage, now);
            this.host.playSfx('allySlash');
          } else if (s.kind === 'sweep') {
            groundCracks(this.gfx, s.x, s.y, K.sweep.radius, 1, s.angle, K.sweep.arcDeg * Math.PI / 180, 0, true);
            const ddx = player.x - s.x, ddy = player.y - s.y;
            if (Math.hypot(ddx, ddy) <= K.sweep.radius + pr && Math.cos(Math.atan2(ddy, ddx) - s.angle) >= Math.cos(K.sweep.arcDeg * Math.PI / 360)) this.hitPlayer(K.sweep.damage, now);
            this.host.hurtTroops?.(s.x, s.y, K.sweep.radius, K.sweep.damage, now, s.angle, K.sweep.arcDeg * Math.PI / 180);
            this.sweepMask.clear(); cone(this.sweepMask, s.x, s.y, s.angle, K.sweep.radius * 1.15, K.sweep.arcDeg);
            this.host.playSfx('allySlash');
          } else {
            groundCracks(this.gfx, s.x, s.y, K.smash.radius, 1, 0, Math.PI * 2, 0, true, 'slam');
            if (Math.hypot(player.x - s.x, player.y - s.y) <= K.smash.radius + pr) this.hitPlayer(K.smash.damage, now);
            this.host.hurtTroops?.(s.x, s.y, K.smash.radius, K.smash.damage, now);
            this.host.scene.cameras.main.shake(140, .006); this.host.playSfx('hitHeavy');
          }
          this.state = 'combo'; this.startedAt = now; this.until = now + K.gapMs;
        }
        break;
      }
      case 'combo': {
        const s = this.segs[this.seg];
        kit.pose('lean', 1 - prog, dir);
        if (s.kind === 'sweep') { const f = Math.floor((now - this.startedAt) / 25); if (f < 6) this.slash.setFrame(f).setPosition(s.x, s.y).setRotation(s.angle).setDisplaySize(LB.combo.sweep.radius * 2, LB.combo.sweep.radius * 2).setVisible(true); }
        if (now >= this.until) { if (++this.seg < this.segs.length) this.aimSeg(now); else this.recoverV2(now, LB.combo.recoverMs); }
        break;
      }
      case 'zigWindup': {
        const Z = LB.zigzag;
        kit.pose('crouch', prog, dir); windupFlash(boss, now);
        laneCracks(this.gfx, boss.x, boss.y, this.angle, Z.length, Z.halfWidth * 2, prog);
        if (now >= this.until) { this.state = 'zig'; this.travelled = 0; this.hitApplied = false; this.ox = boss.x; this.oy = boss.y; this.host.playSfx('chargeWarn'); }
        break;
      }
      case 'zig': {
        const Z = LB.zigzag, ax = boss.x, ay = boss.y, step = Math.min(Z.length - this.travelled, Z.speed * dt);
        kit.pose('lean', 1, dir);
        boss.sprite.x += Math.cos(this.angle) * step; boss.sprite.y += Math.sin(this.angle) * step; this.travelled += step;
        laneCracks(this.gfx, this.ox, this.oy, this.angle, Z.length, Z.halfWidth * 2, 1, true);
        this.host.hurtTroops?.((ax + boss.x) / 2, (ay + boss.y) / 2, Z.halfWidth + step / 2, Z.damage, now);
        if (segmentDistance(player.x, player.y, ax, ay, boss.x, boss.y) <= Z.halfWidth + player.radius) this.hitPlayer(Z.damage, now);
        if (this.travelled >= Z.length) {
          if (++this.fold < this.folds) {
            // 下一折：朝主将当前位置再偏一点，0.3 秒前显示冲锋道
            this.foldSign = -this.foldSign; this.angle = Math.atan2(player.y - boss.y, player.x - boss.x) + this.foldSign * .35;
            this.state = 'zigWindup'; this.startedAt = now; this.until = now + Z.foldWarnMs;
          } else this.recoverV2(now, Z.recoverMs);
        }
        break;
      }
      case 'hop': {
        const t = prog, S = LB.shot;
        boss.sprite.x = this.hopFrom.x + (this.hopTo.x - this.hopFrom.x) * t; boss.sprite.y = this.hopFrom.y + (this.hopTo.y - this.hopFrom.y) * t;
        kit.pose('rear', Math.sin(t * Math.PI), dir);
        if (now >= this.until) { this.state = 'aim'; this.startedAt = now; this.until = now + S.aimMs; this.host.playSfx('chargeWarn'); this.kit?.banner('辕门射戟', '看准瞄准线锁定的瞬间侧移'); }
        break;
      }
      case 'aim': {
        const S = LB.shot, locked = this.until - now <= S.lockMs;
        if (!locked) this.angle = Math.atan2(player.y - boss.y, player.x - boss.x);
        kit.pose('rear', .7, dir);
        const ex = boss.x + Math.cos(this.angle) * S.length, ey = boss.y + Math.sin(this.angle) * S.length;
        // 瞄准线：像素 2px 红线（锁定后变粗、变亮并出现裂地冲锋道）
        this.gfx.lineStyle(locked ? 4 : 2, locked ? 0xffd27a : 0xd2462a, locked ? .95 : .45 + .3 * Math.sin(now / 50)).lineBetween(boss.x, boss.y - 30, ex, ey - 30);
        if (locked) laneCracks(this.gfx, boss.x, boss.y, this.angle, S.length, S.width, 1 - (this.until - now) / S.lockMs);
        if (now >= this.until) {
          this.state = 'shot'; this.startedAt = now; this.until = now + 160; this.shotLine = { x: boss.x, y: boss.y, a: this.angle }; this.shotFlashUntil = now + 220;
          if (segmentDistance(player.x, player.y, boss.x, boss.y, ex, ey) <= S.width / 2 + player.radius) this.hitPlayer(S.damage, now);
          for (let k = 1; k <= 12; k++) this.host.hurtTroops?.(boss.x + Math.cos(this.angle) * S.length * k / 13, boss.y + Math.sin(this.angle) * S.length * k / 13, S.width / 2 + 10, S.damage, now);
          laneCracks(this.gfx, boss.x, boss.y, this.angle, S.length, S.width, 1, true);
          this.host.scene.cameras.main.shake(100, .004); this.host.playSfx('hitArrow');
        }
        break;
      }
      case 'shot': kit.pose('lean', .6, dir); if (now >= this.until) { this.shotCd = LB.shot.cooldown; this.recoverV2(now, LB.shot.recoverMs); } break;
      case 'spinWindup': {
        const P = LB.spin;
        kit.pose('crouch', prog, dir); windupFlash(boss, now);
        groundCracks(this.gfx, boss.x, boss.y, P.r0 + (P.r1 - P.r0) * .5, prog, 0, Math.PI * 2, 0, false, 'slam');
        if (now >= this.until) { this.state = 'spin'; this.startedAt = now; this.until = now + P.spinMs; this.spinTick = now; this.host.playSfx('allySlash'); }
        break;
      }
      case 'spin': {
        const P = LB.spin, r = P.r0 + (P.r1 - P.r0) * prog;
        kit.pose('spin', 1, dir); this.angle = now / 90;
        if (d > 40) { boss.sprite.x += dx / d * boss.def.speed * .5 * dt; boss.sprite.y += dy / d * boss.def.speed * .5 * dt; }
        this.sweepMask.clear(); cone(this.sweepMask, boss.x, boss.y, 0, r * 1.1, 360);
        // 手绘旋风刀气（图到后）；没图时用原来的方天戟刀光转圈
        if (hasBossFx(this.host.scene, 'lb_whirl')) { this.whirl ??= bossFxImage(this.host.scene, 'lb_whirl', DEPTH.player - 1); this.whirl?.setPosition(boss.x, boss.y).setFrame(Math.floor(now / 60) % 6).setDisplaySize(r * 2.3, r * 2.3 * .85).setVisible(true); }
        else this.slash.setFrame(Math.floor(now / 40) % 6).setPosition(boss.x, boss.y).setRotation(now / 60).setDisplaySize(r * 2.1, r * 2.1).setVisible(true);
        if (now >= this.spinTick) {
          this.spinTick = now + P.tickMs; this.hitApplied = false;
          groundCracks(this.gfx, boss.x, boss.y, r, 1, 0, Math.PI * 2, 0, true, 'slam');
          if (d <= r + player.radius) this.hitPlayer(P.damage, now);
          this.host.hurtTroops?.(boss.x, boss.y, r, P.damage, now);
        }
        if (now >= this.until) { this.spinCd = P.cooldown; this.recoverV2(now, P.recoverMs); }
        break;
      }
      case 'recover': kit.pose('stagger', 1 - prog * .5, dir); if (now >= this.until) this.state = 'approach'; break;
      default: break;
    }
    if (now < this.shotFlashUntil) {
      // 贯穿箭的余光：一道暖金细线淡出
      const a = (this.shotFlashUntil - now) / 220, L = this.shotLine;
      this.gfx.lineStyle(3, 0xfff1c4, a).lineBetween(L.x, L.y - 30, L.x + Math.cos(L.a) * LB.shot.length, L.y + Math.sin(L.a) * LB.shot.length - 30);
    }
  }
  /** 招式图集帧（起手 0–2 / 拉弓 3 / 刺 4 / 横扫 5 / 下劈 6 / 放箭 7 / 收招 8–11 / 转场 12–13）；乱舞沿用旋转攻击帧。 */
  private art(now: number, dir: number): void {
    const K = 'lubu_moves', s = this.state, p = this.telegraphProgressV2(now), kit = this.kit!;
    let f = -1;
    if (kit.inShift) f = (12 + Math.floor(now / 160) % 2);
    else if (s === 'comboWindup') f = this.segs[this.seg]?.kind === 'smash' ? 2 : Math.min(2, Math.floor(p * 3));
    else if (s === 'combo') f = ({ thrust: 4, sweep: 5, smash: 6 } as const)[this.segs[this.seg]?.kind ?? 'thrust'];
    else if (s === 'zigWindup') f = 1 + Math.min(1, Math.floor(p * 2));
    else if (s === 'zig') f = 4;
    else if (s === 'hop') f = 0;
    else if (s === 'aim') f = 3;
    else if (s === 'shot') f = 7;
    else if (s === 'spinWindup') f = Math.min(2, Math.floor(p * 3));
    else if (s === 'recover') f = 8 + Math.min(3, Math.floor(p * 4));
    if (f >= 0) kit.move(K, f, dir);
  }
  private telegraphProgressV2(now: number): number { return Math.max(0, Math.min(1, (now - this.startedAt) / Math.max(1, this.until - this.startedAt))); }

  tryUltimate(now: number): boolean {
    if (!this.phase2 || this.energy < 100 || this.state !== 'approach') return false;
    this.energy = 0; this.ultimate.start(now); this.state = 'ultTakeoff'; return true;
  }
  incomingDamageMultiplier(source: 'melee' | 'arrow' | 'fire', now: number): number { return this.ultimate.damageMultiplier(source, now); }
  ultimateInfo() { return this.ultimate.snapshot(); }

  private updateArt(dt: number, now: number, dx: number, dy: number, v2 = false): void {
    const boss = this.host.boss;
    const moving = Math.hypot(dx, dy) > .01;
    const angle = this.state === 'approach' && moving ? Math.atan2(dy, dx) : this.angle;
    if (moving || this.state !== 'approach') this.facing = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? (Math.cos(angle) < 0 ? 'left' : 'right') : (Math.sin(angle) < 0 ? 'up' : 'down');
    let texture = 'boss_lubu', frame = 0;
    if (this.state === 'approach' && moving) { this.walkMs += dt * 1000; frame = Math.floor(this.walkMs / 250) % 4; }
    else this.walkMs = 0;
    if (this.state === 'sweepWindup') { texture = 'lubu_attack'; frame = now - this.startedAt < 100 ? 0 : 1; }
    else if (this.state === 'sweep') { texture = 'lubu_attack'; frame = now < this.until - 90 ? 2 : 3; }
    else if (this.state === 'dashWindup') { texture = 'lubu_attack'; frame = 1; }
    else if (this.state === 'dash') { texture = 'lubu_attack'; frame = 2; }
    else if (this.state === 'recover' && this.lastAttack === 'sweep') { texture = 'lubu_attack'; frame = 3; }
    else if (this.state === 'comboWindup' || this.state === 'zigWindup' || this.state === 'aim' || this.state === 'spinWindup') { texture = 'lubu_attack'; frame = 1; }
    else if (this.state === 'combo') { texture = 'lubu_attack'; frame = now - this.startedAt < 60 ? 2 : 3; }
    else if (this.state === 'zig' || this.state === 'shot') { texture = 'lubu_attack'; frame = 2; }
    else if (this.state === 'spin') { texture = 'lubu_attack'; frame = 2 + Math.floor(now / 90) % 2; this.facing = (['down', 'left', 'up', 'right'] as const)[Math.floor(now / 90) % 4]; }
    const frameKey = `${this.facing}_${frame}`;
    if (boss.sprite.texture.key !== texture || boss.sprite.frame.name !== frameKey) boss.sprite.setTexture(texture, frameKey);
    if (v2) return;
    this.slash.setVisible(false);
    const hitAt = this.state === 'sweepWindup' ? this.until : this.state === 'sweep' ? this.until - C.sweepFlashMs : -Infinity;
    const fxFrame = Math.floor((now - hitAt + 90) / 30);
    if ((this.state === 'sweepWindup' || this.state === 'sweep') && fxFrame >= 0 && fxFrame < 6) {
      this.slash.setFrame(fxFrame).setPosition(this.ox, this.oy).setRotation(this.angle).setVisible(true);
    }
  }

  private begin(state: 'sweepWindup' | 'dashWindup', now: number): void {
    const { boss, player } = this.host;
    this.state = state; this.startedAt = now; this.ox = boss.x; this.oy = boss.y;
    this.angle = Math.atan2(player.y - boss.y, player.x - boss.x); this.hitApplied = false;
    const warn = state === 'sweepWindup' ? (this.phase2 ? C.enragedSweepWarnMs : C.sweepWarnMs) : (this.phase2 ? C.enragedDashWarnMs : C.dashWarnMs);
    this.lastAttack = state === 'sweepWindup' ? 'sweep' : 'dash';
    if (state === 'sweepWindup') {
      this.sweepMask.clear();
      this.fillCone(this.sweepMask, 0xffffff, 1);
    }
    this.until = now + warn; this.host.playSfx('chargeWarn');
  }
  private recover(now: number): void {
    this.state = 'recover'; this.until = now + C.recoveryMs;
    this.sweepCd = this.phase2 ? C.enragedSweepCooldown : C.sweepCooldown;
    this.dashCd = this.phase2 ? C.enragedDashCooldown : C.dashCooldown;
  }
  private drawSweep(color: number, alpha: number): void {
    const half = C.sweepAngle * Math.PI / 360;
    if (!TELEGRAPH_CLASSIC) { groundCracks(this.gfx, this.ox, this.oy, C.sweepRadius, this.telegraphProgress, this.angle, half * 2, 0, this.state === 'sweep'); return; }
    this.fillCone(this.gfx, color, alpha);
    this.gfx.lineStyle(2, color, .78);
    this.gfx.beginPath(); this.gfx.moveTo(this.ox, this.oy);
    this.gfx.arc(this.ox, this.oy, C.sweepRadius, this.angle - half, this.angle + half, false);
    this.gfx.closePath(); this.gfx.strokePath();
  }
  /** Fixed triangle fan avoids rerunning Earcut on a large sector every render. */
  private fillCone(g: Phaser.GameObjects.Graphics, color: number, alpha: number): void {
    const half = C.sweepAngle * Math.PI / 360;
    const segments = Math.ceil(C.sweepAngle / 12);
    let px = this.ox + Math.cos(this.angle - half) * C.sweepRadius;
    let py = this.oy + Math.sin(this.angle - half) * C.sweepRadius;
    g.fillStyle(color, alpha);
    for (let i = 1; i <= segments; i++) {
      const a = this.angle - half + half * 2 * i / segments;
      const x = this.ox + Math.cos(a) * C.sweepRadius, y = this.oy + Math.sin(a) * C.sweepRadius;
      g.fillTriangle(this.ox, this.oy, px, py, x, y);
      px = x; py = y;
    }
  }
  private hurt(damage: number, now: number): void {
    if (this.host.player.takeDamage(damage, now)) this.host.scene.cameras.main.flash(90, 180, 40, 40, false);
  }
  clear(): void { this.whirl?.destroy(); this.whirl = null; this.kit?.clear(); this.ultimate.clear(); this.state = 'approach'; this.energy = 0; this.gfx.clear(); this.slash.setVisible(false); }
  snapshot(): { state: LubuState; phase2: boolean; until: number; progress: number; hitApplied: boolean } {
    return { state: this.state, phase2: this.phase2, until: this.until, progress: this.telegraphProgress, hitApplied: this.hitApplied };
  }
}
