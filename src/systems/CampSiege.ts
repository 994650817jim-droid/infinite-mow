import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import { CAMP_SIEGE as C, type CampTier } from '../data/campSiege';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';
import { playSheet } from './SkillFxSheets';

/**
 * 营寨攻坚（data/campSiege.ts；设计见共享笔记 camp-siege-design.md，用户 2026-11-20「营寨太容易被摧毁了」）：
 * 营寨 / 营帐登记进来后——耐久按章节精锐血量定、每秒掉血有上限（什么分支都要打一阵）、火攻加成、隔栅远打打折、部曲减半；
 * 走近出守军、被打时本营出兵更急、半血起火 + 伏兵 + 附近营寨马上出兵、20% 守将出营、拆掉尘土倒塌 + 宝石。
 */
export interface CampSiegeHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number };
  now: () => number;
  /** 本章精锐当前血量（含章节成长）。 */
  eliteHp: () => number;
  chapter: () => number;
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  /** 守将（副将形象 / 精锐放大）。 */
  captain: (x: number, y: number) => Enemy | null;
  sfx: (key: string) => void;
  gem: (x: number, y: number, xp: number) => void;
  shake: () => void;
}
export interface CampOpts {
  /** 走近时营门出守军（2-3 营寨自带守军，不要）。默认 true。 */
  guards?: boolean;
  /** 画头顶细耐久条（敌营自己画了，不要）。默认 true。 */
  bar?: boolean;
  /** 附近营寨被烧到半血时叫本营马上出兵。 */
  onAlarm?: () => void;
}
interface Rec {
  e: Enemy; life: number; tier: CampTier; x: number; y: number; bank: number; bankAt: number; lastHit: number;
  opts: CampOpts; guarded: boolean; burned: boolean; captain: boolean; fireAt: number; bar: Phaser.GameObjects.Graphics | null;
}

export class CampSiege {
  private recs: Rec[] = [];
  readonly stats = { added: 0, capped: 0, guards: 0, burns: 0, ambush: 0, captains: 0, alarms: 0, collapses: 0 };
  constructor(private readonly h: CampSiegeHost) {}

  /** 登记一座营寨 / 营帐：按章节定耐久（满血开局）。 */
  add(e: Enemy, tier: CampTier, opts: CampOpts = {}): void {
    if (this.recs.some(r => r.e === e && r.life === e.spawnId)) return;
    const T = C.tier[tier], hp = Math.round(Math.max(T.minHp, this.h.eliteHp() * T.eliteMul));
    e.maxHp = e.hp = hp; e.def = { ...e.def, hp };
    const now = this.h.now();
    this.recs.push({ e, life: e.spawnId, tier, x: e.x, y: e.y, bank: hp / T.minSec * C.bankSec, bankAt: now, lastHit: -1e9, opts, guarded: opts.guards === false, burned: false, captain: false, fireAt: 0,
      bar: opts.bar === false ? null : this.h.scene.add.graphics().setDepth(DEPTH.dmgText - 3).setName('camp-siege-bar') });
    this.stats.added++;
  }
  private rec(e: Enemy): Rec | undefined { return this.recs.find(r => r.e === e && r.life === e.spawnId); }
  isCamp(e: Enemy): boolean { return !!this.rec(e); }

  /** 打营寨的伤害（GameScene.hitEnemy 补给格分支调）：火攻加成、远打打折、部曲减半，再按每秒上限扣。 */
  incoming(e: Enemy, dmg: number, source: 'melee' | 'arrow' | 'fire', fromAlly: boolean, now: number): number {
    const r = this.rec(e); if (!r) return dmg;
    const T = C.tier[r.tier], rate = e.maxHp / T.minSec, P = this.h.player();
    let d = dmg;
    if (source === 'fire') d *= C.fireMul;
    else if (!fromAlly && Math.hypot(P.x - r.x, P.y - r.y) > C.rangedFrom) d *= C.rangedMul;
    if (fromAlly) d *= C.allyMul;
    r.bank = Math.min(rate * C.bankSec, r.bank + rate * Math.max(0, now - r.bankAt) / 1000); r.bankAt = now;
    const take = Math.max(0, Math.min(d, r.bank)); if (take < d) this.stats.capped++;
    r.bank -= take; r.lastHit = now;
    return take;
  }
  /** 本营出兵间隔倍率：正被攻打时更急。 */
  intervalMul(e: Enemy | null | undefined): number { const r = e ? this.rec(e) : undefined; return r && this.h.now() - r.lastHit < C.hitHurryMs ? C.hitHurryMul : 1; }

  private squad(r: Rec, kinds: EnemyKind[], radius: number): number {
    let n = 0; const P = this.h.player(), a0 = Math.atan2(P.y - r.y, P.x - r.x);
    kinds.forEach((k, i) => { const a = a0 + (i - (kinds.length - 1) / 2) * .7, x = r.x + Math.cos(a) * radius, y = r.y + 30 + Math.sin(a) * radius * .7; if (this.h.spawn(k, x, y)) n++; });
    return n;
  }

  update(): void {
    const now = this.h.now(), P = this.h.player();
    for (const r of [...this.recs]) {
      const e = r.e, alive = e.active && e.spawnId === r.life && e.hp > 0;
      if (!alive) { this.collapse(r); continue; }
      const k = e.hp / Math.max(1, e.maxHp), d = Math.hypot(P.x - r.x, P.y - r.y);
      // 守军：主将第一次走近
      if (!r.guarded && d < C.guardR) { r.guarded = true; this.stats.guards += this.squad(r, this.h.chapter() >= 5 ? ['elite', 'shield', 'shield', 'infantry'] : ['elite', 'shield', 'shield'], 120); }
      // 半血：起火 + 号角 + 伏兵 + 附近营寨马上出兵
      if (!r.burned && k <= C.burnAt) {
        r.burned = true; this.stats.burns++; this.h.sfx('camp_burn'); this.h.sfx('tent_fire');
        const kinds: EnemyKind[] = this.h.chapter() >= 4 ? ['shield', 'shield', 'infantry', 'elite'] : ['shield', 'shield', 'infantry', 'infantry'];
        this.stats.ambush += this.squad(r, kinds.slice(0, C.ambush), C.ambushR);
        for (const o of this.recs) if (o !== r && Math.hypot(o.x - r.x, o.y - r.y) < C.nearbyR && o.opts.onAlarm) { o.opts.onAlarm(); this.stats.alarms++; }
        r.opts.onAlarm?.();
      }
      // 快拆完：守将出营拼命（一座营一次）
      if (!r.captain && k <= C.captainAt) { r.captain = true; if (this.h.captain(r.x + (P.x < r.x ? -70 : 70), r.y + 40)) this.stats.captains++; this.h.sfx('camp_captain'); }
      // 起火后营帐上一直烧（手绘地火序列帧，镜头外不放）
      if (r.burned && now >= r.fireAt) { r.fireAt = now + 1300; const v = this.h.scene.cameras.main.worldView; if (r.x > v.left - 150 && r.x < v.right + 150 && r.y > v.top - 150 && r.y < v.bottom + 250) playSheet(this.h.scene, 'fx_ground_fire', r.x + (Math.random() - .5) * 50, r.y - 20, { size: 130, ms: 1400, depth: actorDepth(r.y) + .2, originY: .8, alpha: .9, name: 'camp-siege-fire' }); }
      // 头顶细耐久条（挨过打才显示）
      if (r.bar) { const g = r.bar.clear(); if (k < 1) { const top = r.y - e.sprite.displayHeight * e.sprite.originY - 8, w = 64; g.fillStyle(0x140a06, .8).fillRect(r.x - w / 2 - 1, top, w + 2, 6).fillStyle(r.burned ? 0xe8783a : 0xd2452e, 1).fillRect(r.x - w / 2, top + 1, w * k, 4); } }
    }
  }
  /** 拆掉：大团尘土倒塌 + 轻震 + 宝石。 */
  private collapse(r: Rec): void {
    this.recs = this.recs.filter(o => o !== r); r.bar?.destroy(); this.stats.collapses++;
    playSheet(this.h.scene, 'fx_collapse_dust', r.x, r.y + 10, { size: r.tier === 'camp' ? 260 : 190, ms: 800, depth: actorDepth(r.y) + .4, originY: .8, name: 'camp-siege-collapse' });
    this.h.shake(); this.h.sfx('camp_collapse');
    for (let i = 0; i < C.gems; i++) { const a = i / C.gems * Math.PI * 2; this.h.gem(r.x + Math.cos(a) * 40, r.y + 14 + Math.sin(a) * 20, C.gemXp); }
  }
  clear(): void { for (const r of this.recs) r.bar?.destroy(); this.recs = []; }
}
