import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyDef } from '../data/enemies';
import { DEPTH } from '../config';
import { ZJ } from '../data/bossRedesign';
import { BossKit, Beat, ensureMoves, faceDir, type BossDebug } from './BossKit';
import { warnFx } from '../ui/WarnFx';
import { groundCracks, laneCracks, warnCircle } from '../ui/Telegraph';
import { bossFxImage, ensureBossFx, fxFrame, hasBossFx, playBossFx } from './BossFx';
import { castFlourish, warmCast } from './BossThemeFx';

interface Host {
  scene: Phaser.Scene; boss: Enemy; player: Player; army: Legion;
  fireBolt: (x: number, y: number, tx: number, ty: number, damage: number, speed: number) => void;
  spawn: (kind: 'infantry', x: number, y: number, def?: EnemyDef) => Enemy | null;
  infantryDef: () => EnemyDef;
  banner: (text: string, caption?: string) => void;
  sfx: (key: string) => void;
}
type Move = 'rain' | 'thunder' | 'heaven' | 'grid';
interface Pillar { e: Enemy; life: number; x: number; y: number; broken: boolean; born: number; brokeAt: number; img: Phaser.GameObjects.Image | null }

/**
 * 1-3 张角（重设计样板）：应对方式 = 打断 + 躲弹幕。
 *  太平符雨：举杖、符纸旋转 → 扇形 7 枚符弹的弹道提示 → 连发 2 轮（二阶段 3 轮）→ 收招。
 *  天雷：举杖向天 → 落点乌云聚拢、地上符光渐亮 → 3 道落雷 → 收招。
 *  黄天当立：能量满后升空吟唱 6 秒、四周立 4 根符柱；打碎符柱缩短读条，4 根全碎 → 坠地眩晕 3 秒且受伤 ×1.5；
 *           读条完成 → 九霄天雷全屏，只有碎柱残骸处是安全区。
 *  二阶段（50%）「苍天已死」：天色转暗；新招「雷阵」3×3 格依次亮格落雷，踩着灭掉的格子走。
 */
export class ZhangjiaoBoss {
  readonly kit: BossKit; private beat = new Beat<Move>();
  phase2 = false; energy = 0; stunUntil = 0;
  private next = 0; private order = 0; private round = 0; private nextRound = 0; private angle = 0;
  private points: { x: number; y: number }[] = [];
  private pillars: Pillar[] = []; private castCut = 0; private safe: { x: number; y: number }[] = [];
  private grid: { x: number; y: number; cells: number[][] } | null = null; private wave = 0;
  private summonAt = 0; private summons: { e: Enemy; life: number }[] = [];
  private gfx: Phaser.GameObjects.Graphics; private pillarGfx: Phaser.GameObjects.Graphics;
  readonly metrics = { rain: 0, thunder: 0, heaven: 0, heavenBroken: 0, heavenUlt: 0, grid: 0, phase2: 0, hits: 0 };

  constructor(private h: Host, now: number) { warmCast(h.scene, 'zhangjiao');
    this.kit = new BossKit({ scene: h.scene, boss: h.boss, banner: h.banner, sfx: h.sfx });
    ensureMoves(h.scene, 'zhangjiao_moves');
    this.gfx = h.scene.add.graphics().setDepth(DEPTH.fx - 1).setName('zhangjiao-fx');
    this.pillarGfx = h.scene.add.graphics().setDepth(DEPTH.enemy + 1).setName('zhangjiao-pillars');
    this.next = now + 1500; this.summonAt = now + ZJ.summonEveryMs;
    ensureBossFx(h.scene, ['zj_pillar', 'zj_talisman', 'kit_shift']);
  }

  get takenMul(): number { return this.h.scene && this.stunUntil > (this.kit.now) ? ZJ.heaven.stunTakenMul : 1; }
  get label(): string {
    const m = this.beat.move, ph = this.beat.phase;
    if (this.kit.inShift) return '苍天已死 · 黄天当立';
    if (this.stunUntil > this.kit.now) return '坠地眩晕 · 全力输出';
    if (m === 'heaven' && ph === 'release') return '黄天当立 · 打碎符柱 ' + this.pillars.filter(p => p.broken).length + '/' + this.pillars.length;
    if (m === 'heaven' && ph === 'recover') return '九霄天雷 · 躲到碎柱旁';
    if (ph === 'recover') return '收招 · 反击机会';
    const names: Record<Move, string> = { rain: '太平符雨', thunder: '天雷', heaven: '黄天当立', grid: '雷阵' };
    return m ? names[m] + (ph === 'windup' ? ' · 起手' : '') : (this.phase2 ? '雷阵将起' : '天书 ' + Math.floor(this.energy) + '%');
  }
  readonly debug: BossDebug = {
    moves: ['太平符雨', '天雷', '黄天当立', '雷阵'],
    force: (i, now) => { this.abort(); this.start((['rain', 'thunder', 'heaven', 'grid'] as const)[i] ?? 'rain', now); },
    phase2: (now) => { const b = this.h.boss; if (b.hp > b.maxHp * ZJ.phase2At) b.hp = Math.floor(b.maxHp * ZJ.phase2At); this.enterPhase2(now); },
  };

  /** 每帧：移动 + 招式。 */
  private gone = false;
  update(dt: number, now: number): void {
    const b = this.h.boss, p = this.h.player;
    if (this.gone) return;
    if (!b.active) { this.clear(); return; }
    this.kit.update(now); this.gfx.clear(); this.drawPillars(now); for (const t of this.tal) t.setVisible(false); this.art(now);
    if (!this.phase2 && b.hp <= b.maxHp * ZJ.phase2At) this.enterPhase2(now);
    if (this.kit.inShift) return;
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1, dir = faceDir(dx);
    if (this.stunUntil > now) { this.kit.pose('stagger', 1, dir); return; }
    // 移动：空闲时慢步保持中距离（张角是法师，太近会后退）
    if (this.beat.phase === 'idle') {
      const want = d > 260 ? 1 : d < 150 ? -.6 : 0;
      // 中距离不再原地站桩：绕主将慢慢游走（切向），隔一阵换方向
      const orbit = want === 0 ? ZJ.orbitMul * (Math.floor(now / ZJ.orbitFlipMs) % 2 ? 1 : -1) : 0;
      const vx = (dx / d * want - dy / d * orbit) * b.def.speed, vy = (dy / d * want + dx / d * orbit) * b.def.speed;
      b.sprite.x += vx * dt; b.sprite.y += vy * dt;
      this.walkFrame(vx, vy, dx, dy, now);
      this.energy = Math.min(100, this.energy + dt * ZJ.heaven.energyPerSec * (this.phase2 ? 1.4 : 1));
      if (now >= this.summonAt) this.summon(now);
      if (now >= this.next) this.start(this.pick(), now);
      return;
    }
    this.step(now, dir);
  }

  /**
   * 空闲时的行走帧：招式图由 BossKit 只在渲染那一刻换上、画完还原，本体精灵一直停在行走表 down_0（以前空闲时就一直朝下不动，看着像卡住）。
   * 这里按移动方向（不动时朝主将）换行走表的帧，走动时循环 4 步；行走表没有方向帧（v1 单图）时不动它。
   */
  private walkFrame(vx: number, vy: number, dx: number, dy: number, now: number): void {
    const sp = this.h.boss.sprite, moving = Math.hypot(vx, vy) > 4, ax = moving ? vx : dx, ay = moving ? vy : dy;
    const dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : ay < 0 ? 'up' : 'down', name = `${dir}_${moving ? Math.floor(now / ZJ.walkFrameMs) % 4 : 0}`;
    if (sp.texture.has(name) && sp.frame.name !== name) sp.setFrame(name);
  }
  private pick(): Move {
    if (this.energy >= 100) return 'heaven';
    const cycle: Move[] = this.phase2 ? ['grid', 'rain', 'thunder', 'rain'] : ['rain', 'thunder'];
    return cycle[this.order++ % cycle.length];
  }

  private start(move: Move, now: number): void {
    const b = this.h.boss, p = this.h.player;
    castFlourish(this.h.scene, 'zhangjiao', b, move === 'rain' ? ZJ.rain.windupMs : move === 'thunder' ? ZJ.thunder.windupMs : move === 'heaven' ? 700 : 500, move !== 'rain');
    this.angle = Math.atan2(p.y - b.y, p.x - b.x); this.round = 0;
    if (move === 'rain') { this.metrics.rain++; this.beat.set(move, 'windup', now, ZJ.rain.windupMs); this.h.sfx('bossVolley'); }
    else if (move === 'thunder') {
      this.metrics.thunder++; this.beat.set(move, 'windup', now, ZJ.thunder.windupMs);
      this.points = [{ x: p.x, y: p.y }, { x: p.x + 95 * Math.cos(this.angle + 1.9), y: p.y + 95 * Math.sin(this.angle + 1.9) }, { x: p.x + 95 * Math.cos(this.angle - 1.9), y: p.y + 95 * Math.sin(this.angle - 1.9) }];
    } else if (move === 'heaven') { this.metrics.heaven++; this.energy = 0; this.beat.set(move, 'windup', now, 700); this.h.banner('黄天当立', '打碎四根符柱打断吟唱'); this.h.sfx('bossSummon'); }
    else { this.metrics.grid++; this.wave = 0; this.beat.set(move, 'windup', now, 500); this.layGrid(); }
  }

  private step(now: number, dir: number): void {
    const B = this.beat, b = this.h.boss, p = this.h.player, prog = B.progress(now);
    switch (B.move) {
      case 'rain': {
        const R = ZJ.rain, rounds = this.phase2 ? R.rounds2 : R.rounds;
        if (B.phase === 'windup') { this.kit.pose('cast', prog, dir); this.talismans(now, prog); if (B.done(now)) B.set('rain', 'warn', now, R.warnMs); }
        else if (B.phase === 'warn') {
          this.kit.pose('cast', 1, dir); this.talismans(now, 1);
          this.angle = Math.atan2(p.y - b.y, p.x - b.x);
          for (let i = 0; i < R.bolts; i++) laneCracks(this.gfx, b.x, b.y, this.angle + (i - (R.bolts - 1) / 2) * R.spread, 260, 14, prog);
          if (B.done(now)) { B.set('rain', 'release', now, rounds * R.roundGapMs + 60); this.nextRound = now; }
        } else if (B.phase === 'release') {
          this.kit.pose('lean', 1, dir);
          if (now >= this.nextRound && this.round < rounds) {
            this.nextRound = now + R.roundGapMs; const off = this.round % 2 ? R.spread / 2 : 0; this.round++;
            for (let i = 0; i < R.bolts; i++) { const a = this.angle + off + (i - (R.bolts - 1) / 2) * R.spread; this.h.fireBolt(b.x, b.y, b.x + Math.cos(a) * 10, b.y + Math.sin(a) * 10, R.damage, R.speed); }
            this.h.sfx('bossVolley');
          }
          if (B.done(now)) this.toRecover(now, R.recoverMs);
        } else this.endRecover(now);
        break;
      }
      case 'thunder': {
        const T = ZJ.thunder;
        if (B.phase === 'windup') { this.kit.pose('rear', prog, dir); if (B.done(now)) B.set('thunder', 'warn', now, T.warnMs); }
        else if (B.phase === 'warn') {
          this.kit.pose('cast', 1, dir);
          this.points.forEach((pt, i) => { if (!warnFx(this.h.scene).warn('zjt' + i, 'lightning', pt.x, pt.y, T.radius, prog, now)) warnCircle(this.gfx, pt.x, pt.y, T.radius, prog, 0x7a3cff, 0xd9c2ff, false, now); });
          if (B.done(now)) { this.strike(this.points, T.radius, T.damage, T.troopDamage, now); this.toRecover(now, T.recoverMs); }
        } else this.endRecover(now);
        break;
      }
      case 'heaven': this.stepHeaven(now, dir, prog); break;
      case 'grid': this.stepGrid(now, dir, prog); break;
    }
  }

  // ---------- 黄天当立 ----------
  private stepHeaven(now: number, dir: number, prog: number): void {
    const B = this.beat, H = ZJ.heaven, b = this.h.boss;
    if (B.phase === 'windup') {
      this.kit.pose('rear', prog, dir);
      if (B.done(now)) { this.raisePillars(now); this.castCut = 0; B.set('heaven', 'release', now, H.castMs); }
      return;
    }
    if (B.phase === 'release') {
      // 吟唱：身上金光、头顶读条；每碎一根柱子读条缩短
      this.kit.pose('cast', 1, dir);
      const broken = this.pillars.filter(p => p.broken).length;
      const until = B.from + H.castMs - broken * H.cutMs, p = Math.min(1, (now - B.from) / Math.max(1, until - B.from));
      this.castBar(b.x, b.y - 92, p);
      if (broken >= this.pillars.length) {
        // 全碎：坠地眩晕
        this.metrics.heavenBroken++; this.stunUntil = now + H.stunMs; this.kit.recover(now, H.stunMs);
        this.h.banner('张角坠地', '眩晕 3 秒 · 受到伤害提高');
        this.h.scene.cameras.main.shake(160, .006); this.dropPillars(); B.set(null, 'idle', now, 0); this.next = now + H.stunMs + 600; return;
      }
      if (now >= until) {
        this.metrics.heavenUlt++;
        this.safe = this.pillars.filter(p => p.broken).map(p => ({ x: p.x, y: p.y }));
        if (!this.safe.length) { const q = this.pillars[Math.floor(Math.random() * this.pillars.length)]; if (q) this.safe.push({ x: q.x, y: q.y }); }
        this.dropPillars(); B.set('heaven', 'recover', now, H.ultWarnMs);
        this.h.banner('九霄天雷', '躲到碎柱残骸旁的金光里'); this.h.sfx('bossVolley');
      }
      return;
    }
    // recover 段 = 九霄天雷预警，结束时全屏落雷（安全区外受伤）
    this.kit.pose('cast', 1, dir);
    const cam = this.h.scene.cameras.main.worldView;
    for (const s of this.safe) warnCircle(this.gfx, s.x, s.y, H.safeRadius, 1, 0xf2c27a, 0xffe7a8, false, now, 'slam');
    for (let i = 0; i < 4; i++) { const x = cam.x + cam.width * (.15 + .23 * i), y = cam.y + cam.height * (.3 + .35 * (i % 2)); warnFx(this.h.scene).warn('zjult' + i, 'lightning', x, y, 110, prog, now); }
    if (B.done(now)) {
      const p = this.h.player, safe = this.safe.some(s => Math.hypot(p.x - s.x, p.y - s.y) <= H.safeRadius + p.radius);
      for (let i = 0; i < 4; i++) warnFx(this.h.scene).impact('lightning', cam.x + cam.width * (.15 + .23 * i), cam.y + cam.height * (.3 + .35 * (i % 2)), 110);
      this.h.scene.cameras.main.flash(180, 230, 220, 140, false); this.h.scene.cameras.main.shake(220, .008);
      if (!safe && p.takeDamage(ZJ.heaven.ultDamage, now)) this.metrics.hits++;
      for (const u of this.h.army.grid.query(p.x, p.y, 900)) if (u.active && !this.safe.some(s => Math.hypot(u.x - s.x, u.y - s.y) <= H.safeRadius)) this.h.army.hurtByBoss(u, H.ultTroopDamage, now);
      this.h.sfx('bossSummon'); this.safe = []; this.toRecover(now, 1200);
    }
  }
  private raisePillars(now: number): void {
    const b = this.h.boss, H = ZJ.heaven, base = this.h.infantryDef();
    const def: EnemyDef = { ...base, walkVisual: undefined, attackVisual: undefined, behavior: undefined, hp: H.pillarHp, speed: 0, damage: 0, xp: 1, radius: 18, tint: 0xffd36b };
    this.pillars = [];
    for (let i = 0; i < H.pillars; i++) {
      const a = i * Math.PI * 2 / H.pillars + Math.PI / 4, x = b.x + Math.cos(a) * H.pillarRing, y = b.y + Math.sin(a) * H.pillarRing * .8;
      const e = this.h.spawn('infantry', x, y, def);
      if (e) { e.controlImmune = true; e.sprite.setAlpha(0); this.pillars.push({ e, life: e.spawnId, x, y, broken: false, born: now, brokeAt: 0, img: bossFxImage(this.h.scene, 'zj_pillar', DEPTH.enemy + 1)?.setOrigin(.5, .82).setPosition(x, y).setDisplaySize(150, 150) ?? null }); }
    }
  }
  private dropPillars(): void { for (const p of this.pillars) p.img?.destroy(); for (const p of this.pillars) if (!p.broken && p.e.active && p.e.spawnId === p.life) { p.e.hp = 0; p.e.deactivate(); } this.pillars = []; }
  /** 符柱：像素石柱 + 黄符纸（碎了只剩半截）。招式图集 / 符柱图出来前的占位。 */
  private drawPillars(now: number): void {
    const g = this.pillarGfx; g.clear();
    for (const p of this.pillars) {
      if (!p.broken && (!p.e.active || p.e.spawnId !== p.life)) { p.broken = true; p.brokeAt = now; this.h.scene.cameras.main.shake(80, .003); this.h.sfx('hitHeavy'); }
      if (!p.broken) p.e.sprite.setAlpha(0);
      // 手绘符柱：升起 0–1 → 发光循环 1–2 → 碎裂 3–4 → 残骸 5
      if (p.img) { const a = now - p.born, b = now - p.brokeAt; p.img.setFrame(p.broken ? (b < 360 ? fxFrame(b / 360, 3, 4) : 5) : a < 450 ? fxFrame(a / 450, 0, 1) : 1 + Math.floor(now / 150) % 2); continue; }
      const h = p.broken ? 18 : 64, x = Math.round(p.x), y = Math.round(p.y);
      g.fillStyle(0x1a1310, .9).fillRect(x - 12, y - h - 2, 24, h + 4);
      g.fillStyle(0x6d5a48, 1).fillRect(x - 10, y - h, 20, h);
      g.fillStyle(0x8c7660, 1).fillRect(x - 10, y - h, 6, h);
      if (!p.broken) {
        const glow = .6 + .4 * Math.sin(now / 120 + p.x);
        g.fillStyle(0xf2c27a, glow).fillRect(x - 6, y - 52, 12, 22);
        g.fillStyle(0xc0392b, glow).fillRect(x - 2, y - 48, 4, 14);
        g.fillStyle(0xffe7a8, .5 * glow).fillRect(x - 14, y - 70, 28, 4);
      } else { g.fillStyle(0x3a2e24, 1).fillRect(x - 14, y - 4, 8, 4).fillRect(x + 6, y - 2, 8, 4); }
    }
  }
  private castBar(x: number, y: number, p: number): void {
    const g = this.gfx, w = 96;
    g.fillStyle(0x1a1310, .85).fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
    g.fillStyle(0xf2c27a, 1).fillRect(x - w / 2, y, Math.round(w * p), 6);
  }

  // ---------- 雷阵（二阶段） ----------
  private layGrid(): void {
    const p = this.h.player, c = ZJ.grid.cell, all = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - .5);
    // 三波：每波亮 3 格；三波合起来覆盖全部 9 格（站着不动必中一次）
    this.grid = { x: p.x - c * 1.5, y: p.y - c * 1.5, cells: [all.slice(0, 3), all.slice(3, 6), all.slice(6, 9)] };
  }
  private cellCenter(i: number): { x: number; y: number } { const g = this.grid!, c = ZJ.grid.cell; return { x: g.x + (i % 3 + .5) * c, y: g.y + (Math.floor(i / 3) + .5) * c }; }
  private stepGrid(now: number, dir: number, prog: number): void {
    const B = this.beat, G = ZJ.grid, g = this.grid; if (!g) { B.set(null, 'idle', now, 0); return; }
    this.kit.pose(B.phase === 'windup' ? 'rear' : 'cast', B.phase === 'windup' ? prog : 1, dir);
    // 阵格：金色细线（像素 2px），亮格由落雷预警表示
    this.gfx.lineStyle(2, 0xf2c27a, .35);
    for (let k = 0; k <= 3; k++) { this.gfx.lineBetween(g.x + k * G.cell, g.y, g.x + k * G.cell, g.y + 3 * G.cell); this.gfx.lineBetween(g.x, g.y + k * G.cell, g.x + 3 * G.cell, g.y + k * G.cell); }
    if (B.phase === 'windup') { if (B.done(now)) B.set('grid', 'warn', now, G.warnMs); return; }
    if (B.phase === 'warn') {
      const cells = g.cells[this.wave];
      cells.forEach(i => { const c = this.cellCenter(i); if (!warnFx(this.h.scene).warn('zjg' + i, 'lightning', c.x, c.y, G.cell * .5, prog, now)) warnCircle(this.gfx, c.x, c.y, G.cell * .5, prog, 0x7a3cff, 0xd9c2ff, false, now); });
      if (B.done(now)) {
        this.strike(cells.map(i => this.cellCenter(i)), G.cell * .5, G.damage, G.troopDamage, now, true);
        this.wave++;
        if (this.wave >= g.cells.length) { this.grid = null; this.toRecover(now, G.recoverMs); }
        else B.set('grid', 'warn', now, G.warnMs - 120 + G.strikeGapMs);
      }
      return;
    }
    this.endRecover(now);
  }

  // ---------- 公共 ----------
  /** 落雷：方格判定（雷阵）或圆判定。 */
  private strike(pts: { x: number; y: number }[], r: number, dmg: number, troop: number, now: number, square = false): void {
    const p = this.h.player; let hit = false;
    for (const pt of pts) {
      if (!warnFx(this.h.scene).impact('lightning', pt.x, pt.y, r)) groundCracks(this.gfx, pt.x, pt.y, r, 1, 0, Math.PI * 2, 0, true);
      this.h.army.hurtArea(pt.x, pt.y, r, troop, now);
      if (square ? Math.abs(p.x - pt.x) <= r && Math.abs(p.y - pt.y) <= r : Math.hypot(p.x - pt.x, p.y - pt.y) <= r + p.radius) hit = true;
    }
    if (hit && p.takeDamage(dmg, now)) { this.metrics.hits++; this.h.scene.cameras.main.flash(100, 220, 220, 120, false); }
    this.h.scene.cameras.main.shake(120, .004); this.h.sfx('bossSummon');
  }
  /** 举杖时身边旋转的符纸（像素小方块）。 */
  /** 招式图集帧（起手 0–3 / 符雨 4–5 / 招雷 6–7 / 收招 8–11 / 转场 12–13 / 眩晕 14–15）。 */
  private art(now: number): void {
    const B = this.beat, p = this.h.player, b = this.h.boss, dir = faceDir(p.x - b.x), K = 'zhangjiao_moves', prog = B.progress(now);
    let f = -1;
    if (this.kit.inShift) f = (12 + Math.floor(now / 160) % 2);
    else if (this.stunUntil > now) f = (14 + Math.floor(now / 220) % 2);
    else if (B.phase === 'windup') f = Math.min(3, Math.floor(prog * 4));
    else if (B.phase === 'warn' || B.phase === 'release') f = B.move === 'rain' ? (B.phase === 'warn' ? 3 : (4 + Math.floor(now / 160) % 2)) : (6 + Math.floor(now / 200) % 2);
    else if (B.phase === 'recover') f = B.move === 'heaven' ? (6 + Math.floor(now / 200) % 2) : 8 + Math.min(3, Math.floor(prog * 4));
    if (f >= 0) this.kit.move(K, f, dir);
  }
  private tal: Phaser.GameObjects.Image[] = [];
  private talismans(now: number, p: number): void {
    const b = this.h.boss;
    // 手绘符纸（图到后）：6 张绕身旋转，朝切线方向飘
    if (hasBossFx(this.h.scene, 'zj_talisman')) {
      while (this.tal.length < 6) { const im = bossFxImage(this.h.scene, 'zj_talisman', DEPTH.fx - 1); if (!im) break; this.tal.push(im); }
      this.tal.forEach((im, i) => { const a = now / 260 + i * 1.047, r = 34 + 14 * p; im.setVisible(true).setPosition(b.x + Math.cos(a) * r, b.y - 40 + Math.sin(a) * r * .5).setRotation(a + Math.PI / 2).setDisplaySize(40, 40).setFrame((Math.floor(now / 90) + i) % 6).setAlpha(.6 + .4 * p); });
      return;
    }
    for (let i = 0; i < 6; i++) {
      const a = now / 260 + i * 1.047, r = 30 + 12 * p, x = Math.round(b.x + Math.cos(a) * r), y = Math.round(b.y - 40 + Math.sin(a) * r * .5);
      this.gfx.fillStyle(0x1a1310, .8).fillRect(x - 4, y - 6, 8, 12); this.gfx.fillStyle(0xf2c27a, .95).fillRect(x - 3, y - 5, 6, 10); this.gfx.fillStyle(0xc0392b, .9).fillRect(x - 1, y - 3, 2, 6);
    }
  }
  private summon(now: number): void {
    this.summonAt = now + ZJ.summonEveryMs;
    this.summons = this.summons.filter(s => s.e.active && s.e.spawnId === s.life);
    const b = this.h.boss, n = Math.min(ZJ.summonCount + (this.phase2 ? 1 : 0), ZJ.summonCap - this.summons.length);
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / Math.max(1, n); const e = this.h.spawn('infantry', b.x + Math.cos(a) * 66, b.y + Math.sin(a) * 66); if (e) this.summons.push({ e, life: e.spawnId }); }
    if (n > 0) this.h.sfx('bossSummon');
  }
  private toRecover(now: number, ms: number): void { this.beat.set(this.beat.move, 'recover', now, ms); this.kit.recover(now, ms); }
  private endRecover(now: number): void { if (this.beat.done(now)) { this.beat.set(null, 'idle', now, 0); this.next = now + (this.phase2 ? ZJ.gapMs2 : ZJ.gapMs); } }
  private abort(): void { this.dropPillars(); this.grid = null; this.safe = []; this.beat.set(null, 'idle', 0, 0); }
  /** 卡住保护（GameScene.bossDetour）：首领很久没位移又不在出招时，收掉当前招式、0.8 秒后重新出手。 */
  unstick(now: number): void { if (this.kit.inShift) return; this.abort(); this.stunUntil = 0; this.next = now + 800; }
  private enterPhase2(now: number): void {
    if (this.phase2) return;
    this.phase2 = true; this.metrics.phase2++; this.abort(); this.order = 0;
    this.kit.phaseShift(now, '苍天已死，黄天当立', '二阶段 · 雷阵：踩着灭掉的格子走', 0x3a2a05, .2);
    this.next = now + 1800;
  }
  snapshot() { return { move: this.beat.move, phase: this.beat.phase, phase2: this.phase2, energy: this.energy, pillars: this.pillars.length, broken: this.pillars.filter(p => p.broken).length, stunned: this.stunUntil > this.kit.now, grid: !!this.grid, metrics: { ...this.metrics } }; }
  clear(): void { if (this.gone) return; this.gone = true; for (const t of this.tal) t.destroy(); this.tal = []; this.abort(); this.gfx.destroy(); this.pillarGfx.destroy(); this.kit.clear(); }
}
