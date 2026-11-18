import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';
import { DEPTH, FONT } from '../config';
import { FIRE } from '../data/yilingChapter';
import { warnFx } from '../ui/WarnFx';
import { playSheet } from './SkillFxSheets';

export interface FireHost {
  scene: Phaser.Scene; player: Player;
  enemies: () => readonly Enemy[]; allies: () => readonly Ally[];
  hitEnemy: (e: Enemy, dmg: number) => void; hurtAlly: (a: Ally, dmg: number) => void;
  /** 当前场上的营帐（可破坏物）：火烧到就塌。 */
  tents: () => readonly Enemy[]; breakTent: (e: Enemy) => void;
  banner: (text: string, caption?: string) => void; sfx: (key: string) => void;
  /** 地形层的树（systems/Terrain.ts）：着火格子把里面的树点着，返回点着的树——树往四周八格窜火（火烧连营林中更猛）。 */
  burnTrees?: (x0: number, y0: number, size: number, now: number) => { x: number; y: number }[];
}
interface Cell { cx: number; cy: number; gen: number; lit: number; until: number; nextSpread: number; nextTick: number; img: Phaser.GameObjects.Image | null }
interface Pending { at: number; points: { x: number; y: number }[]; wind: number; id: number }

/** 八方风向（弧度，屏幕坐标：0 = 往东吹）与中文风名（风从哪边来）。 */
const WINDS: { a: number; name: string }[] = [
  { a: 0, name: '西风' }, { a: Math.PI / 4, name: '西北风' }, { a: Math.PI / 2, name: '北风' }, { a: Math.PI * 3 / 4, name: '东北风' },
  { a: Math.PI, name: '东风' }, { a: -Math.PI * 3 / 4, name: '东南风' }, { a: -Math.PI / 2, name: '南风' }, { a: -Math.PI / 4, name: '西南风' },
];

/**
 * 第十章「火势蔓延」：陆逊放火 → 先预警（风向箭头 + 地上将燃圈）→ 起火点燃 → 每隔一会儿顺风往下一格引燃，烧过的格子成灰不复燃。
 * 格子上的火是手绘序列帧 fx_ground_fire；风向箭头是界面提示（文字 + 箭头），地上起火预警用手绘 warnfx「fire」。
 * 烧到的格子敌我都掉血（首领不受火）；烧到营帐，营帐塌、周围几格一起窜火。
 */
export class YilingFire {
  private cells = new Map<string, Cell>();
  private ash = new Set<string>();
  private pending: Pending[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private hudArrow: Phaser.GameObjects.Text; private hudText: Phaser.GameObjects.Text;
  private nextAt: number; private seq = 0;
  wind = WINDS[5].a;
  readonly metrics = { events: 0, ignited: 0, maxLit: 0, tentsBurnt: 0, playerTicks: 0, enemyTicks: 0 };
  /** 放火间隔（秒）：场景按首领状态改。 */
  everySec: number = FIRE.everySec;
  /** 陆逊二阶段「火势已成」：每次放火两道火线（左右两组起火点，中间留一条退路）。 */
  double = false;
  private readonly hasFx: boolean;

  constructor(private h: FireHost, now: number) {
    const s = h.scene; this.hasFx = s.textures.exists('fx_ground_fire');
    this.nextAt = now + FIRE.firstSec * 1000;
    // 风向提示（界面）：左侧战况栏下方，箭头指火烧过去的方向
    this.hudArrow = s.add.text(52, 252, '➤', { fontFamily: FONT, fontSize: '34px', color: '#ffb35c', stroke: '#2a1208', strokeThickness: 5 }).setOrigin(.5).setScrollFactor(0).setDepth(DEPTH.hud).setName('yiling-wind-hud');
    this.hudText = s.add.text(80, 252, '', { fontFamily: FONT, fontSize: '15px', color: '#f6d9a4', stroke: '#1a0e08', strokeThickness: 4, resolution: 2 }).setOrigin(0, .5).setScrollFactor(0).setDepth(DEPTH.hud);
    this.setWind(this.wind, false);
  }
  private key(cx: number, cy: number): string { return cx + ',' + cy; }
  private windName(a: number): string { let best = WINDS[0], d = 9; for (const w of WINDS) { const dd = Math.abs(Phaser.Math.Angle.Wrap(w.a - a)); if (dd < d) { d = dd; best = w; } } return best.name; }
  private setWind(a: number, warn: boolean): void {
    this.wind = a; this.hudArrow.setRotation(a);
    this.hudText.setText(`${this.windName(a)} · 火往箭头方向烧${warn ? ' · 往上风口退！' : ''}`).setColor(warn ? '#ffcf7a' : '#f6d9a4');
  }
  get litCount(): number { return this.cells.size; }
  /** 某点是否在烧（测试 / 敌人寻路可用）。 */
  burningAt(x: number, y: number): boolean { return this.cells.has(this.key(Math.floor(x / FIRE.cell), Math.floor(y / FIRE.cell))); }

  /** 放一次火：定风向，在主将上风处排开几个起火点，先预警。 */
  schedule(now: number, wind?: number): void {
    const p = this.h.player, a = wind ?? WINDS[Math.floor(Math.random() * WINDS.length)].a;
    this.setWind(a, true); this.metrics.events++;
    const up = Phaser.Math.Between(FIRE.upwindMin, FIRE.upwindMax), bx = p.x - Math.cos(a) * up, by = p.y - Math.sin(a) * up, nx = -Math.sin(a), ny = Math.cos(a);
    const span = FIRE.points * FIRE.pointGap, groups = this.double ? [-span * .85, span * .85] : [0];
    const points = groups.flatMap(g => Array.from({ length: FIRE.points }, (_, i) => { const o = g + (i - (FIRE.points - 1) / 2) * FIRE.pointGap; return { x: bx + nx * o, y: by + ny * o }; }));
    this.pending.push({ at: now + FIRE.warnSec * 1000, points, wind: a, id: ++this.seq });
    this.h.banner(this.windName(a) + '起', '陆逊纵火 · 火顺风烧过来，往上风口退');
    this.h.sfx('chargeWarn');
    // 风势：手绘疾风条顺风扫过（不画像素）
    for (let i = 0; i < 4; i++) this.h.scene.time.delayedCall(i * 220, () => playSheet(this.h.scene, 'fx_flank_streak', p.x + nx * (i - 1.5) * 120 - Math.cos(a) * 160, p.y + ny * (i - 1.5) * 120 - Math.sin(a) * 160, { size: 260, ms: 520, depth: DEPTH.fx, alpha: .55, rotation: a, name: 'yiling-gust' }));
  }
  private ignite(cx: number, cy: number, gen: number, now: number): boolean {
    const k = this.key(cx, cy); if (this.cells.has(k) || this.ash.has(k) || this.cells.size >= FIRE.maxCells) return false;
    const img = this.pool.pop() ?? this.h.scene.add.image(0, 0, this.hasFx ? 'fx_ground_fire' : '__WHITE').setOrigin(.5, .78).setName('yiling-fire');
    const C = FIRE.cell, x = cx * C + C / 2, y = cy * C + C / 2;
    const sz = C * Phaser.Math.FloatBetween(1.4, 1.85); img.setPosition(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-16, 16)).setDisplaySize(sz, sz).setDepth(DEPTH.ground + 2.3 + y / 100000).setVisible(true).setAlpha(1);
    if (!this.hasFx) img.setTint(0xff7a2a).setAlpha(.6);
    this.cells.set(k, { cx, cy, gen, lit: now, until: now + FIRE.burnMs, nextSpread: now + FIRE.spreadMs, nextTick: now + 200, img });
    this.metrics.ignited++; this.metrics.maxLit = Math.max(this.metrics.maxLit, this.cells.size);
    return true;
  }
  /** 立刻在某处点火（测试 / 首领招式用）。 */
  igniteAt(x: number, y: number, now: number): boolean { return this.ignite(Math.floor(x / FIRE.cell), Math.floor(y / FIRE.cell), 0, now); }

  update(now: number): void {
    if (now >= this.nextAt) { this.nextAt = now + this.everySec * 1000; this.schedule(now); }
    // 预警 → 起火
    const wf = warnFx(this.h.scene);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const pd = this.pending[i], prog = 1 - (pd.at - now) / (FIRE.warnSec * 1000);
      pd.points.forEach((pt, j) => wf.circle(`yiling-fire-${pd.id}-${j}`, 'fire', pt.x, pt.y, FIRE.cell * 1.1, prog, now));
      if (now < pd.at) continue;
      this.pending.splice(i, 1);
      for (const pt of pd.points) { const cx = Math.floor(pt.x / FIRE.cell), cy = Math.floor(pt.y / FIRE.cell); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) this.ignite(cx + dx, cy + dy, 0, now); }
      this.h.sfx('flameBoom'); this.setWind(pd.wind, false);
    }
    if (!this.cells.size) return;
    const dirX = Math.cos(this.wind), dirY = Math.sin(this.wind), fx = Math.round(dirX), fy = Math.round(dirY);
    const p = this.h.player, C = FIRE.cell;
    for (const [k, c] of [...this.cells]) {
      if (now >= c.until) { this.cells.delete(k); this.ash.add(k); if (c.img) { c.img.setVisible(false); this.pool.push(c.img); } continue; }
      c.img?.setFrame(this.hasFx ? (Math.floor((now - c.lit) / 90) + (c.cx * 7 + c.cy * 3)) % 6 : 0).setAlpha(Math.min(1, (c.until - now) / 500, (now - c.lit) / 160 + .3));
      // 顺风引燃
      if (now >= c.nextSpread && c.gen < FIRE.maxGen) {
        c.nextSpread = Infinity;
        const tries: [number, number, number][] = [[fx, fy, FIRE.forward], [fx - fy, fy + fx, FIRE.diagonal], [fx + fy, fy - fx, FIRE.diagonal], [-fy, fx, FIRE.side], [fy, -fx, FIRE.side]];
        for (const [dx, dy, pr] of tries) if ((dx || dy) && Math.random() < pr) this.ignite(c.cx + Math.sign(dx), c.cy + Math.sign(dy), c.gen + 1, now);
      }
      // 伤害
      if (now >= c.nextTick) {
        c.nextTick = now + FIRE.tickMs;
        const x0 = c.cx * C, y0 = c.cy * C, inside = (x: number, y: number, r = 0) => x > x0 - r && x < x0 + C + r && y > y0 - r && y < y0 + C + r;
        for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && inside(e.x, e.y, e.radius * .5)) { this.h.hitEnemy(e, FIRE.enemyDamage); this.metrics.enemyTicks++; }
        if (p.alive && inside(p.x, p.y, p.radius * .4)) { p.takeDamage(Math.max(2, p.maxHp * FIRE.playerRatio), now); this.metrics.playerTicks++; }
        for (const a of this.h.allies()) if (a.active && inside(a.x, a.y, a.radius * .4)) this.h.hurtAlly(a, Math.max(2, a.maxHp * FIRE.playerRatio));
        for (const t of this.h.tents()) if (t.active && inside(t.x, t.y, 40)) this.burnTent(t, now);
        for (const tr of this.h.burnTrees?.(x0, y0, C, now) ?? []) { const tx = Math.floor(tr.x / C), ty = Math.floor(tr.y / C); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) this.ignite(tx + dx, ty + dy, c.gen, now); }
      }
    }
  }
  /** 营帐着火：塌掉，周围几格一起窜火（连营一烧一片）。 */
  private burnTent(t: Enemy, now: number): void {
    const cx = Math.floor(t.x / FIRE.cell), cy = Math.floor(t.y / FIRE.cell), R = FIRE.tentBurst; this.metrics.tentsBurnt++;
    this.h.breakTent(t);
    playSheet(this.h.scene, 'fx_explosion', t.x, t.y + 6, { size: 200, ms: 620, depth: DEPTH.fx, originY: .84, name: 'yiling-tent-flare' });
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R + 1) this.ignite(cx + dx, cy + dy, 2, now);
  }
  snapshot() { return { lit: this.cells.size, ash: this.ash.size, pending: this.pending.length, wind: +this.wind.toFixed(2), everySec: this.everySec, metrics: { ...this.metrics } }; }
  clear(): void { for (const c of this.cells.values()) c.img?.destroy(); for (const i of this.pool) i.destroy(); this.cells.clear(); this.pool = []; this.ash.clear(); this.pending = []; this.hudArrow.destroy(); this.hudText.destroy(); }
}
