import Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { PHASES, lieutenantArt, type PhaseKind, type PhasePlan } from '../data/stagePhases';
import { isV2Texture, loadV2TroopSheets, V2_TROOP_SCALE, v2TroopGround } from './ArtStyle';
import { sheetFigureHeight } from './SpriteMetrics';
import type { EnemyDef } from '../data/enemies';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';

/**
 * 主线关五段的「段内事件」（wave-progression-redesign.md §2.1）：
 * - 精锐段：一支精锐小队（2–4 名校尉）从四周压上来；
 * - 事件段：一圈伏兵冲阵（P2 起另有战场机缘）；
 * - 副将段：副将（校尉换皮放大、名牌 + 小血条，血量约首领 25%），倒下后由场景补一次三选一；
 * - 每次换段：2–3 秒喘息（刷兵变稀，GameScene 读 calm()）。
 * 只管生成与名牌，伤害 / 掉落 / 三选一都走场景原有逻辑。
 */
export interface PhaseHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number };
  /** 场景关内时间（秒）。 */
  elapsed: () => number;
  /** 强制刷一个兵（hpScale = 1，仍乘关卡小兵成长）。 */
  spawn: (kind: EnemyKind, x: number, y: number, def?: EnemyDef) => Enemy | null;
  def: (kind: EnemyKind) => EnemyDef;
  /** 本关首领的最终生命（含成长倍率）。 */
  bossHp: () => number;
  /** 小兵成长倍率（spawnEnemy 会再乘的那个 growth.hp）。 */
  growthHp: () => number;
  banner: (title: string, danger: boolean, sub?: string) => void;
  sfx: (key: string) => void;
  onLieutenantDown: (name: string, x: number, y: number) => void;
}

export class StagePhaseRunner {
  private phase = -1; private calmUntil = -1;
  private lt?: { e: Enemy; life: number; name: string; tag: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; down: boolean };
  /** 测试用。 */
  readonly stats = { phase: -1, elites: 0, ambush: 0, lieutenant: '' as string, lieutenantHp: 0, lieutenantDown: false, lieutenantAt: -1 };

  constructor(private readonly h: PhaseHost, readonly plan: PhasePlan) {
    // 副将专属图（第 1–4 章已出，其余章登记了才载）：按需加载
    const art = lieutenantArt(plan.chapter), sc = h.scene;
    if (art && sc?.load) { loadV2TroopSheets(sc, [art.walk, art.attack]); if (sc.load.list.size && !sc.load.isLoading()) sc.load.start(); }
  }
  /** 本章副将专属图（已登记且已载好）；没有就回退「精锐 ×lieutenantScale」。 */
  ltArt(): { walk: string; attack: string; cell: number } | null {
    const a = lieutenantArt(this.plan.chapter), T = this.h.scene?.textures;
    return a && T && isV2Texture(a.walk) && T.exists(a.walk) && T.get(a.walk).has('down_0') ? a : null;
  }

  get index(): number { return this.phase; }
  kind(i = this.phase): PhaseKind | undefined { return this.plan.phases[i]?.kind; }
  /** 换段后的喘息期内（刷兵间隔 ×PHASES.calmIntervalMul）。 */
  calm(): boolean { return this.h.elapsed() < this.calmUntil; }
  /** 副将段起的小兵生命倍率。 */
  waveHpMul(): number { const k = this.kind(); return k === 'lieutenant' ? PHASES.lieutenantWaveHp : 1; }

  /** 「大军压境」段：刷兵间隔倍率（< 1 更密）。 */
  intervalMul(): number { return this.kind() === 'surge' ? PHASES.surge.intervalMul : 1; }
  /** 伏兵 / 大军用的兵种：第一章按关只用已登场的兵（1-1 步 / 盾、1-2 步 / 弓、1-3 步 / 骑），其余章步 / 骑。 */
  private crowdKinds(): [EnemyKind, EnemyKind] {
    if (this.plan.chapter === 1) return this.plan.stage <= 1 ? ['infantry', 'shield'] : this.plan.stage === 2 ? ['infantry', 'archer'] : ['infantry', 'cavalry'];
    return ['infantry', 'cavalry'];
  }
  private surge(): void {
    this.eliteSquad(1); const [a, b] = this.crowdKinds();
    for (const [i, p] of this.ring(PHASES.surge.ring(this.plan.chapter), 420, .4).entries()) { if (this.h.spawn(i % 3 === 2 ? b : a, p.x, p.y)) this.stats.ambush++; }
    this.h.sfx('gong');
  }
  /** 场景检测到段落变化时调用。 */
  enter(i: number): void {
    if (i === this.phase) return;
    this.phase = i; this.stats.phase = i; const p = this.plan.phases[i]; if (!p) return;
    if (i > 0) this.calmUntil = this.h.elapsed() + PHASES.calmSec;
    if (p.kind === 'elite' && this.plan.phases.length > 3) this.eliteSquad();
    else if (p.kind === 'elite') this.eliteSquad(1);
    else if (p.kind === 'event') this.ambush();
    else if (p.kind === 'surge') this.surge();
    else if (p.kind === 'lieutenant' && this.plan.lieutenant) this.lieutenant(this.plan.lieutenant);
  }

  private ring(n: number, r: number, jitter = 0): Array<{ x: number; y: number }> {
    const P = this.h.player(), a0 = Math.random() * Math.PI * 2;
    return Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2 + (Math.random() - .5) * jitter; return { x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r }; });
  }

  private eliteSquad(n = PHASES.eliteSquad(this.plan.chapter)): void {
    const at = this.ring(1, 400)[0];
    for (let i = 0; i < n; i++) { const e = this.h.spawn('elite', at.x + (i - (n - 1) / 2) * 46, at.y + (i % 2) * 30); if (e) this.stats.elites++; }
    for (let i = 0; i < n * 2; i++) this.h.spawn('shield', at.x + (Math.random() - .5) * 120, at.y + (Math.random() - .5) * 90);
  }

  private ambush(): void {
    const n = PHASES.ambush(this.plan.chapter);
    const [a, b] = this.crowdKinds();
    for (const [i, p] of this.ring(n, 380, .3).entries()) { if (this.h.spawn(i % 2 ? b : a, p.x, p.y)) this.stats.ambush++; }
    this.h.sfx('gong');
  }

  /** 副将一档的精锐（机缘「降将来投」试阵也用）：精锐 ×eliteMul，夹在参考首领的 35%–60%。 */
  lieutenantDef(): EnemyDef {
    const base = this.h.def('elite'), L = PHASES.lieutenantHp, g = Math.max(.1, this.h.growthHp()), boss = this.h.bossHp();
    const hp = Math.min(boss * L.maxBoss, Math.max(boss * L.minBoss, base.hp * g * L.eliteMul)) / g; // 最终生命 = hp × g（spawnEnemy 乘小兵成长）
    const def: EnemyDef = { ...base, hp, damage: base.damage * 1.4, xp: base.xp * 6, radius: Math.round(base.radius * 1.2), speed: base.speed * .95 };
    const art = this.ltArt(), T = this.h.scene.textures;
    // 专属图：v2 4×4（显示 ×0.5 × lieutenantArtMul，脚底 = (格 − 7) / 格），按关序轻微换色
    if (art) return { ...def, walkVisual: { texture: art.walk, scale: V2_TROOP_SCALE, groundY: v2TroopGround(art.cell), v2Mul: this.ltMul(art.walk) }, attackVisual: isV2Texture(art.attack) && T.exists(art.attack) ? art.attack : undefined, tint: PHASES.lieutenantTints[Math.max(0, Math.min(2, this.plan.stage - 1))] ?? 0xffffff };
    return def; // 回退：本章精锐图，spawn 后 enlarge 放大
  }
  /** 专属图的显示倍率：目标身高 / 图里人物中位身高（×0.5 显示），夹在 1.1–1.7；量不到按 132 美术像素算。 */
  private ltMul(walk: string): number {
    const fig = sheetFigureHeight(this.h.scene, walk) ?? 132;
    return Math.max(1.1, Math.min(1.7, PHASES.lieutenantFigure(this.plan.chapter) / (fig * V2_TROOP_SCALE)));
  }
  /** 体型：专属图已在 def 里定好（lieutenantArtMul）；回退的精锐图放大 lieutenantScale（Enemy.sizeMul：以前直接 setScale，v2 图下一帧就被冲掉，副将其实没变大）。 */
  private enlarge(e: Enemy): void { if (!/^lt_/.test(e.def.walkVisual?.texture ?? '')) e.setSizeMul(PHASES.lieutenantScale); }
  /** 营寨守将（CampSiege：营寨快拆完时出营拼命）：副将形象、精锐 ×3 血（不是副将那么厚）。 */
  captainDef(): EnemyDef { return { ...this.lieutenantDef(), hp: this.h.def('elite').hp * 3 }; }
  /** 刷一个副将一档的精锐（体型放大）。 */
  spawnLieutenant(x: number, y: number): Enemy | null { const e = this.h.spawn('elite', x, y, this.lieutenantDef()); if (e) this.enlarge(e); return e; }
  /**
   * 副将没刷出来（场上敌兵已到上限 BALANCE.enemyCap，spawnEnemy 连 force 也返回 null）时先挂起、每 0.5 秒再试——
   * 2026-11-20 第 7–12 章检查：后期关敌兵常满，8-3 徐晃、9-1 满宠、10-1 谢旌、10-2 潘璋、12-2 王双整关没出来。
   */
  private ltPending: { name: string; at: number } | null = null;
  private lieutenant(name: string): void {
    const P = this.h.player(), at = { x: P.x + (Math.random() < .5 ? -340 : 340), y: P.y - 80 }; // 从侧面进场（电脑版视野左右各 480，一出来就看得到）
    this.ltPending = this.spawnLieutenantAt(name, at.x, at.y) ? null : { name, at: this.h.elapsed() + .5 };
  }
  /** 在指定位置放一名副将（名牌 label + 名字、小血条；倒下同样走 onLieutenantDown）。2-3 洛阳营寨守将李傕也用它。 */
  spawnLieutenantAt(name: string, x: number, y: number, label = '副将 · '): Enemy | null {
    const e = this.h.spawn('elite', x, y, this.lieutenantDef()); if (!e) return null;
    this.enlarge(e);
    const s = this.h.scene;
    const tag = s.add.text(e.x, e.y, label + name, { fontFamily: FONT, fontSize: '13px', color: '#ffd98a', resolution: 2, stroke: '#2a0c06', strokeThickness: 4 }).setOrigin(.5, 1).setDepth(DEPTH.dmgText - 1).setName('lieutenant-tag');
    const bar = s.add.graphics().setDepth(DEPTH.dmgText - 1).setName('lieutenant-bar');
    this.lt = { e, life: e.spawnId, name, tag, bar, down: false };
    this.stats.lieutenant = name; this.stats.lieutenantHp = Math.round(e.maxHp); this.stats.lieutenantAt = this.h.elapsed();
    return e;
  }

  /** 每帧：副将名牌 / 血条跟随；倒下时通知场景。 */
  update(): void {
    if (this.ltPending && !this.lt && this.h.elapsed() >= this.ltPending.at) this.lieutenant(this.ltPending.name);
    const t = this.lt; if (!t || t.down) return;
    const alive = t.e.active && t.e.spawnId === t.life && t.e.hp > 0;
    if (!alive) {
      t.down = true; this.stats.lieutenantDown = true; const x = t.e.x, y = t.e.y;
      t.tag.destroy(); t.bar.destroy();
      this.h.onLieutenantDown(t.name, x, y); return;
    }
    const sp = t.e.sprite, top = sp.y - sp.displayHeight * sp.originY - 12, w = 54, k = Math.max(0, t.e.hp / Math.max(1, t.e.maxHp));
    t.tag.setPosition(t.e.x, top);
    t.bar.clear().fillStyle(0x140a06, .8).fillRect(t.e.x - w / 2 - 1, top + 2, w + 2, 6).fillStyle(0xd8432a, 1).fillRect(t.e.x - w / 2, top + 3, w * k, 4);
  }

  clear(): void { if (this.lt && !this.lt.down) { this.lt.tag.destroy(); this.lt.bar.destroy(); } this.lt = undefined; this.ltPending = null; }
}
