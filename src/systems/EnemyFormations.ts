import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { EnemyKind } from '../types';
import type { FormationId } from '../data/formations';
import { playSheet } from './SkillFxSheets';
import { SIGIL_KEY } from './FormationFx';

/**
 * 敌方军阵（formation-design.md §5，用户 11-20「全按推荐」：一期先做框架 + 盾墙阵，曹仁八门金锁接破阵，其余随章节补）。
 * 一队 10 名左右的兵 + 一名阵眼（持旗精锐，头顶「阵眼」朱印）。阵眼在：全队吃阵势（盾墙阵：前排正面受伤 −70%，阵形慢慢转向主将 → 绕到侧后打）。
 * 斩阵眼 →「阵破」：全队眩晕、几秒内受伤加深；用克制的阵（护阵中）去破，易伤更高（以锋矢破盾墙）。
 * 敌阵脚下铺一张淡红阵纹（复用军阵阵纹图，染朱）；阵破时阵纹放大淡出 + 星芒。舆图上阵眼画朱菱。
 */
export type EnemyFormationKind = 'shieldwall';
export interface EnemyFormationDef {
  name: string; /** 第几章起出现 */ from: number; firstMs: number; everyMs: number;
  members: number; memberKind: EnemyKind; eyeKind: EnemyKind; eyeHpMul: number;
  /** 正面减伤、正面半角（度）、阵形转向（度 / 秒）、推进速度倍率 */ front: number; arcDeg: number; turnDeg: number; speed: number;
  breakStunMs: number; vulnMs: number; vuln: number; counterVuln: number; counter: FormationId;
  /** 阵纹帧（军阵阵纹图）与染色 */ sigil: number;
}
export const ENEMY_FORMATIONS: Readonly<Record<EnemyFormationKind, EnemyFormationDef>> = {
  shieldwall: { name: '盾墙阵', from: 4, firstMs: 45000, everyMs: 80000, members: 10, memberKind: 'shield', eyeKind: 'elite', eyeHpMul: 2.5,
    front: .7, arcDeg: 60, turnDeg: 34, speed: .6, breakStunMs: 1200, vulnMs: 6000, vuln: .3, counterVuln: .5, counter: 'wedge', sigil: 3 },
};
export interface EnemyFormationHost {
  scene: Phaser.Scene; player: Player;
  /** 第几章（1–12）。 */ chapter: () => number;
  /** 正常战斗中才刷（不在弹窗、结算、首领演出时）。 */ enabled: () => boolean;
  spawn: (kind: EnemyKind, x: number, y: number, hpMul: number) => Enemy | null;
  stun: (e: Enemy, ms: number, now: number) => void;
  banner: (title: string, sub: string) => void; sfx: (k: string) => void;
  /** 我方当前阵（护阵生效时）——相克判断。 */ playerFormation: () => FormationId | null;
  ringDistance: () => number;
  /** 第一次遇到时的一句（斥候）。 */ bark?: (who: string, text: string) => void;
}
interface Squad {
  kind: EnemyFormationKind; eye: Enemy; eyeLife: number; members: Array<{ e: Enemy; life: number; ox: number; oy: number }>;
  face: number; broken: boolean; vulnUntil: number; countered: boolean;
  sigil?: Phaser.GameObjects.Image; tag?: Phaser.GameObjects.Text; breakAt: number;
}
export class EnemyFormations {
  readonly squads: Squad[] = []; private nextAt = -1; private told = false;
  private own = new WeakMap<Enemy, Squad>();
  readonly stats = { spawned: 0, broken: 0, blocked: 0, countered: 0, vulnHits: 0 };
  constructor(private readonly h: EnemyFormationHost) {}

  /** 刷一队（测试 / 关卡脚本也可直接调）：在主将前方刷兵圈外，面朝主将。 */
  spawn(kind: EnemyFormationKind, now: number, at?: { x: number; y: number }): Squad | null {
    const D = ENEMY_FORMATIONS[kind], P = this.h.player, a = Math.random() * Math.PI * 2, r = this.h.ringDistance();
    const cx = at?.x ?? P.x + Math.cos(a) * r, cy = at?.y ?? P.y + Math.sin(a) * r, face = Math.atan2(P.y - cy, P.x - cx);
    const eye = this.h.spawn(D.eyeKind, cx, cy, D.eyeHpMul); if (!eye) return null;
    const sq: Squad = { kind, eye, eyeLife: eye.spawnId, members: [], face, broken: false, vulnUntil: 0, countered: false, breakAt: 0 };
    // 盾墙：前排 6 面盾、后排 4 人（局部坐标：x = 横向、y = 朝前）
    const front = Math.ceil(D.members * .6), back = D.members - front;
    for (let i = 0; i < D.members; i++) {
      const row = i < front ? 0 : 1, k = row ? i - front : i, n = row ? back : front, ox = (k - (n - 1) / 2) * 34, oy = row ? -10 : 46;
      const w = this.world(cx, cy, face, ox, oy), e = this.h.spawn(D.memberKind, w.x, w.y, 1); if (!e) continue;
      sq.members.push({ e, life: e.spawnId, ox, oy }); this.own.set(e, sq);
    }
    this.own.set(eye, sq);
    const s = this.h.scene;
    if (s.textures.exists(SIGIL_KEY)) sq.sigil = s.add.image(cx, cy, SIGIL_KEY, D.sigil).setDepth(DEPTH.deco + 1).setTint(0xd04030).setAlpha(.26).setDisplaySize(260, 260).setName('enemy-formation-sigil');
    sq.tag = s.add.text(cx, cy - 60, '阵眼', { fontFamily: FONT, fontSize: '13px', color: '#fff1cf', backgroundColor: '#8a1e14', padding: { x: 5, y: 2 }, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.fx + 1).setName('enemy-formation-eye');
    this.squads.push(sq); this.stats.spawned++;
    if (!this.told) { this.told = true; this.h.bark?.('斥候', `报！敌军结${D.name}——斩其阵眼（持旗者）可破！`); }
    return sq;
  }
  private world(cx: number, cy: number, face: number, ox: number, oy: number) { const c = Math.cos(face), s = Math.sin(face); return { x: cx + c * oy - s * ox, y: cy + s * oy + c * ox }; }
  private alive(e: Enemy, life: number): boolean { return e.active && e.spawnId === life && e.hp > 0; }

  update(dt: number, now: number): void {
    // 刷：第 from 章起，开打 firstMs 后第一队，之后每 everyMs 一队，场上最多 1 队没破的
    const D = ENEMY_FORMATIONS.shieldwall;
    if (this.nextAt < 0) this.nextAt = now + D.firstMs;
    if (now >= this.nextAt && this.h.enabled() && this.h.chapter() >= D.from) { this.nextAt = now + D.everyMs; if (!this.squads.some(q => !q.broken)) this.spawn('shieldwall', now); }
    const P = this.h.player;
    for (let i = this.squads.length - 1; i >= 0; i--) {
      const q = this.squads[i], F = ENEMY_FORMATIONS[q.kind];
      q.members = q.members.filter(m => this.alive(m.e, m.life));
      if (q.broken) {
        // 阵纹放大淡出；易伤结束、人也打光了就收掉
        if (q.sigil) { const t = Math.min(1, (now - q.breakAt) / 700); q.sigil.setAlpha(.5 * (1 - t)).setScale(q.sigil.scaleX * (1 + dt * .8)); if (t >= 1) { q.sigil.destroy(); q.sigil = undefined; } }
        if (now >= q.vulnUntil && !q.members.length) this.squads.splice(i, 1);
        continue;
      }
      if (!this.alive(q.eye, q.eyeLife)) { this.breakSquad(q, now); continue; }
      // 阵形慢慢转向主将；阵眼带着全队推进（比平时慢），成员拉回各自阵位
      const want = Math.atan2(P.y - q.eye.y, P.x - q.eye.x);
      q.face = Phaser.Math.Angle.RotateTo(q.face, want, Phaser.Math.DegToRad(F.turnDeg) * dt);
      const k = Math.min(1, dt * 6);
      for (const m of q.members) { const w = this.world(q.eye.x, q.eye.y, q.face, m.ox, m.oy); m.e.sprite.x += (w.x - m.e.x) * k; m.e.sprite.y += (w.y - m.e.y) * k; }
      if (q.sigil) q.sigil.setPosition(q.eye.x + Math.cos(q.face) * 20, q.eye.y + Math.sin(q.face) * 20).setRotation(q.face + Math.PI / 2);
      q.tag?.setPosition(q.eye.x, q.eye.y - 64);
    }
  }
  /** 推进速度倍率（GameScene 敌人移动时乘上）：阵眼与成员都按阵速走。 */
  speedMul(e: Enemy): number { const q = this.own.get(e); return q && !q.broken ? ENEMY_FORMATIONS[q.kind].speed : 1; }
  /** 受伤倍率（GameScene.hitEnemy）：阵眼在时前排正面减伤；阵破后易伤。 */
  damageMul(e: Enemy, now: number): number {
    const q = this.own.get(e); if (!q) return 1;
    const F = ENEMY_FORMATIONS[q.kind];
    if (q.broken) { if (now < q.vulnUntil) { this.stats.vulnHits++; return 1 + (q.countered ? F.counterVuln : F.vuln); } return 1; }
    if (e === q.eye) return 1;
    const P = this.h.player, a = Math.atan2(P.y - e.y, P.x - e.x);
    if (Math.abs(Phaser.Math.Angle.Wrap(a - q.face)) < Phaser.Math.DegToRad(F.arcDeg)) { this.stats.blocked++; return 1 - F.front; }
    return 1;
  }
  private breakSquad(q: Squad, now: number): void {
    const F = ENEMY_FORMATIONS[q.kind], pf = this.h.playerFormation();
    q.broken = true; q.breakAt = now; q.countered = pf === F.counter; q.vulnUntil = now + F.vulnMs; this.stats.broken++; if (q.countered) this.stats.countered++;
    for (const m of q.members) this.h.stun(m.e, F.breakStunMs, now);
    q.tag?.destroy(); q.tag = undefined;
    playSheet(this.h.scene, 'fx_strike_glint', q.eye.x, q.eye.y - 20, { size: 150, ms: 420, depth: DEPTH.fx, add: true, name: 'enemy-formation-break' });
    const counterName: Partial<Record<FormationId, string>> = { wedge: '锋矢' };
    this.h.banner('破阵 · ' + F.name, q.countered ? `以${counterName[F.counter] ?? ''}破${F.name.replace('阵', '')}：全队眩晕，受伤 +${Math.round(F.counterVuln * 100)}%` : `阵眼已斩：全队眩晕，受伤 +${Math.round(F.vuln * 100)}%`);
    this.h.sfx('gong');
  }
  /** 舆图：阵眼位置（朱菱）。 */
  eyes(): Array<{ x: number; y: number }> { return this.squads.filter(q => !q.broken && this.alive(q.eye, q.eyeLife)).map(q => ({ x: q.eye.x, y: q.eye.y })); }
  clear(): void { for (const q of this.squads) { q.sigil?.destroy(); q.tag?.destroy(); } this.squads.length = 0; }
}
