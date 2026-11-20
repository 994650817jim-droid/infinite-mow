import Phaser from 'phaser';
import { actorDepth } from '../config';
import { LUOYANG } from '../data/dongzhuo';
import type { Enemy } from '../entities/Enemy';
import type { EnemyKind } from '../types';
import { FACTION_PROPS } from './PropsV2';
import { pushOutBoxes } from './AllyPush';
import type { MixPick } from './RosterMix';
import { drawSidePalisade, sideWallReady, whenSideWallReady } from './SideWall';
import { SPAWN_TENT, tentIntervalMs } from '../data/spawnTents';
import { registerTents, tentBurn, tentMuster, type TentCtx } from './SpawnTents';

/**
 * 2-3 火烧洛阳的五座西凉营寨（用户 11-19「营寨可以隔着远点，然后营寨应该做些场景有围栏围着之类的然后小怪比较多守着」）：
 * - 营栅围一圈（北排 / 南排用西凉营具的栅段，东西两侧用侧墙套件的竖排木桩），南面留营门（营门柱 + 军旗），东北角望楼，营里军旗、粮草、兵器架、火盆；
 *   营栅是实心障碍（并进场景障碍 sishuiObstacles：挡主将、敌兵、随行，刷兵避开）。营帐本身仍是关卡目标（StageObjectives，摧毁 5 座）。
 * - 守军开局就在营里待命；主将走近、营里有人挨打或营帐挨打 → 全营出营门迎战（先走到营门外，免得卡在栅上），之后照常追击。
 * - 营帐没毁、主将在附近时，营门按时出援兵（本营援兵有上限）；兵种按本关配兵表（data/enemyRoster），150 上限照旧由 spawnEnemy 管。
 * - 义军小队（AllyPush）走营门进营：approach() 给路点，pushOut() 让他们也被营栅挡住。
 */
type Box = { left: number; right: number; top: number; bottom: number };
export interface LuoyangCampsHost {
  scene: Phaser.Scene;
  player: { x: number; y: number };
  now: () => number;
  /** 关卡目标里还没摧毁的营帐（StageObjectives.standing）。 */
  tents: () => Enemy[];
  /** 场景障碍框（sishuiObstacles.footprints），营栅的碰撞框推进去。 */
  obstacles: Box[];
  /** 配兵表抽一个（null = 本章原刷怪表）。 */
  pick: () => MixPick;
  basePick: () => EnemyKind;
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  spawnTrait: (id: string, x: number, y: number) => Enemy | null;
  move: (e: Enemy, nx: number, ny: number, dt: number) => void;
  /** 放一个可打的燃烧火盆（BattlefieldSupplies，打烂后地上留火）；放不了返回 false。 */
  brazier?: (x: number, y: number, size: number) => boolean;
  /** 刷兵帐篷统一规则（data/spawnTents；GameScene.tentCtx）：间隔 / 每队人数 / 存活上限按章节，受损更急、首领出场后减半。 */
  tent?: TentCtx;
}
interface Member { e: Enemy; life: number; camp: Camp; state: 'idle' | 'sally'; reinforce: boolean }
interface Camp { x: number; y: number; tent: Enemy; life: number; alerted: boolean; destroyed: boolean; next: number; mustered?: boolean; objs: Phaser.GameObjects.GameObject[]; boxes: Box[]; reinf: Array<{ e: Enemy; life: number }> }

export class LuoyangCamps {
  readonly camps: Camp[] = [];
  private members = new Map<Enemy, Member>();
  readonly stats = { garrison: 0, reinforcements: 0, alerts: 0, sallied: 0, squads: 0, burned: 0 };
  private unregister: () => void = () => {};

  constructor(private h: LuoyangCampsHost) {
    // 舆图（营寨本来就是破营目标，已画）之外：屏外边缘提示正在出兵的营寨（systems/SpawnTents）
    this.unregister = registerTents(h.scene, () => this.camps.filter(c => !c.destroyed).map(c => ({ x: c.x, y: c.y, ratio: c.tent.hp / Math.max(1, c.tent.maxHp), hit: false, awake: c.alerted && Math.hypot(h.player.x - c.x, h.player.y - c.y) < LUOYANG.camp.nearR, objective: true })));
    const now = h.now();
    for (const t of h.tents()) {
      const c: Camp = { x: t.x, y: t.y, tent: t, life: t.spawnId, alerted: false, destroyed: false, next: now + LUOYANG.camp.reinforceMs, objs: [], boxes: [], reinf: [] };
      this.camps.push(c); this.build(c); this.garrison(c);
    }
  }

  // ———— 布景 ————
  private build(c: Camp): void {
    const C = LUOYANG.camp, sc = this.h.scene, fac = FACTION_PROPS[1], key = sc.textures.exists(fac.key) ? fac.key : null;
    const L = c.x - C.halfW, R = c.x + C.halfW, N = c.y + C.north, S = c.y + C.south, G = C.gate / 2;
    // 碰撞：北排、南排（营门两侧）、东西两侧
    const t = 22;
    c.boxes.push({ left: L - 20, right: R + 20, top: N - t, bottom: N + 12 }, { left: L - 20, right: c.x - G, top: S - t, bottom: S + 12 }, { left: c.x + G, right: R + 20, top: S - t, bottom: S + 12 },
      { left: L - 26, right: L + 18, top: N - t, bottom: S + 12 }, { left: R - 18, right: R + 26, top: N - t, bottom: S + 12 });
    this.h.obstacles.push(...c.boxes);
    const img = (x: number, y: number, frame: number, size: number, flip = false) => {
      if (!key) return null; const im = sc.add.image(x, y, key, frame).setOrigin(.5, .92).setDisplaySize(size, size).setFlipX(flip).setDepth(actorDepth(y)).setName('luoyang-camp'); c.objs.push(im); return im;
    };
    // 北排、南排：西凉营具的栅段（frame 3），南排中间留营门
    for (let x = L + 40, k = 0; x <= R - 30; x += 118, k++) img(x, N + 8, 3, 165, k % 2 === 1);
    for (let x = L + 40, k = 0; x <= R - 30; x += 118, k++) if (Math.abs(x - c.x) > G + 40) img(x, S + 8, 3, 165, k % 2 === 1);
    // 东西两侧：侧墙套件竖排木桩（缺图退回栅段竖排）
    const sides = () => {
      if (sc.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      if (sideWallReady(sc)) { c.objs.push(...drawSidePalisade(sc, { x: L, y0: N - 30, y1: S, scale: .8, name: 'luoyang-camp' }), ...drawSidePalisade(sc, { x: R, y0: N - 30, y1: S, flip: true, scale: .8, name: 'luoyang-camp' })); }
      else for (let y = N + 40; y <= S; y += 64) { img(L, y, 3, 140); img(R, y, 3, 140, true); }
      // 营门：两根营门柱（带旗）
      if (sc.textures.exists('sw_palGate')) for (const s of [-1, 1]) { const im = sc.add.image(c.x + s * (G + 6), S + 12, 'sw_palGate').setOrigin(.5, 1).setScale(s < 0 ? .55 : -.55, .55).setDepth(actorDepth(S + 12)).setName('luoyang-camp'); c.objs.push(im); }
    };
    whenSideWallReady(sc, sides);
    // 望楼（东北角）、军旗、粮草、兵器架、火盆（营帐到营门的路留空）
    img(R - 30, N + 30, 1, 215);
    img(c.x - 175, c.y - 70, 6, 150); img(c.x + 120, N + 50, 6, 130, true);
    img(c.x + 185, c.y - 10, 4, 125); img(c.x - 190, c.y + 95, 4, 110, true);
    img(c.x + 175, c.y + 105, 5, 120);
    if (!this.h.brazier?.(c.x - 205, c.y + 15, 96)) img(c.x - 205, c.y + 15, 7, 88); // 火盆：可打的燃烧火盆（用户 11-19），放不了才用静态图
  }

  // ———— 守军 ————
  private kindOf(): { trait?: string; kind: EnemyKind } {
    const m = this.h.pick();
    if (m && 'trait' in m) return { trait: m.trait, kind: 'infantry' };
    return { kind: m && 'base' in m ? m.base : this.h.basePick() };
  }
  private add(c: Camp, e: Enemy | null, reinforce: boolean): void {
    if (!e) return; if (reinforce) c.reinf.push({ e, life: e.spawnId });
    this.members.set(e, { e, life: e.spawnId, camp: c, state: reinforce ? 'sally' : 'idle', reinforce });
    if (reinforce) this.stats.reinforcements += 1; else this.stats.garrison += 1;
  }
  private garrison(c: Camp): void {
    const C = LUOYANG.camp;
    const spot = (i: number, n: number) => {
      // 营里散开站：营帐两侧和前院，避开营帐本身和营门道
      const a = (i / n) * Math.PI * 2, rx = C.halfW - 80, x = c.x + Math.cos(a) * rx * (.55 + .4 * ((i * 7) % 3) / 2), y = c.y + 20 + Math.sin(a) * 90;
      return { x: Math.abs(x - c.x) < 60 ? x + (x < c.x ? -70 : 70) : x, y };
    };
    for (let i = 0; i < C.garrison; i++) {
      const p = spot(i, C.garrison), k = this.kindOf();
      this.add(c, k.trait ? this.h.spawnTrait(k.trait, p.x, p.y) : this.h.spawn(k.kind, p.x, p.y), false);
    }
    for (let i = 0; i < C.elites; i++) this.add(c, this.h.spawn('elite', c.x + (i % 2 ? 90 : -90), c.y + 60), false);
  }

  /** 本营援兵还活着几个。 */
  private live(c: Camp): number { c.reinf = c.reinf.filter(r => r.e.active && r.e.spawnId === r.life); return c.reinf.length; }
  private inside(c: Camp, x: number, y: number, pad = 0): boolean { const C = LUOYANG.camp; return x > c.x - C.halfW - pad && x < c.x + C.halfW + pad && y > c.y + C.north - pad && y < c.y + C.south + pad; }
  private gateOut(c: Camp): { x: number; y: number } { return { x: c.x, y: c.y + LUOYANG.camp.south + LUOYANG.camp.exitPad }; }

  update(_dt: number): void {
    const C = LUOYANG.camp, now = this.h.now(), p = this.h.player;
    for (const [e, m] of this.members) if (!e.active || e.spawnId !== m.life) this.members.delete(e);
    for (const c of this.camps) {
      if (!c.destroyed && (!c.tent.active || c.tent.spawnId !== c.life || c.tent.hp <= 0)) {
        c.destroyed = true; this.alert(c); this.stats.burned += 1;
        // 拆营：起火 + 给粮 / 干粮（破营目标照旧由 StageObjectives 数，这里不碰）
        tentBurn(this.h.scene, c.x, c.y, this.h.tent?.sfx); this.h.tent?.reward?.(c.x, c.y + 40, SPAWN_TENT.grain, Math.random() < SPAWN_TENT.foodChance);
        for (const o of c.objs) (o as Phaser.GameObjects.Image).setTint?.(0x6a5850); // 营帐毁了：营栅焦黑
        continue;
      }
      if (c.destroyed) continue;
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (!c.alerted && (d < C.alertR || c.tent.hp < c.tent.maxHp || [...this.members.values()].some(m => m.camp === c && m.e.hp < m.e.maxHp))) this.alert(c);
      // 援兵：主将在附近、营帐还在，就一直按时从营门出（不拆营没完没了；data/spawnTents）。到存活上限暂停，被杀了再补
      const ch = this.h.tent?.chapter() ?? 2, cap = SPAWN_TENT.live(ch), g = this.gateOut(c);
      if (c.alerted && d < C.nearR && !c.mustered && now >= c.next - SPAWN_TENT.musterMs && this.live(c) < cap) { c.mustered = true; tentMuster(this.h.scene, g.x, g.y, SPAWN_TENT.musterMs); } // 营门扬尘：要出兵了
      if (c.alerted && d < C.nearR && now >= c.next && this.live(c) < cap && (this.h.tent?.crowd() ?? 0) < SPAWN_TENT.crowdCap) {
        c.next = now + tentIntervalMs(ch, c.tent.hp / Math.max(1, c.tent.maxHp), this.h.tent?.bossOn() ?? false); c.mustered = false; this.stats.squads += 1;
        const n = SPAWN_TENT.squad(ch);
        for (let i = 0; i < n && this.live(c) < cap; i++) {
          const k = this.kindOf(), x = g.x + (i - (n - 1) / 2) * 46, y = g.y + 10;
          if (Math.hypot(p.x - x, p.y - y) < 70) continue;
          this.add(c, k.trait ? this.h.spawnTrait(k.trait, x, y) : this.h.spawn(k.kind, x, y), true);
        }
      }
    }
  }

  private alert(c: Camp): void { if (c.alerted) return; c.alerted = true; this.stats.alerts += 1; for (const m of this.members.values()) if (m.camp === c && m.state === 'idle') m.state = 'sally'; }

  /** 敌兵每帧：待命的站着；出营的先走到营门外（主将在营里就直接放开）；之后返回 false 交给普通逻辑。 */
  step(e: Enemy, dt: number): boolean {
    const m = this.members.get(e); if (!m || e.spawnId !== m.life) return false;
    const c = m.camp, p = this.h.player;
    if (m.state === 'idle') { e.moveVx = e.moveVy = 0; return true; }
    if (!this.inside(c, e.x, e.y, 10) || this.inside(c, p.x, p.y)) { this.members.delete(e); this.stats.sallied += 1; return false; }
    const g = this.gateOut(c), tx = Math.abs(e.y - (c.y + LUOYANG.camp.south)) < 60 || Math.abs(e.x - c.x) < LUOYANG.camp.gate / 2 - 10 ? g.x : c.x, ty = tx === g.x ? g.y : c.y + LUOYANG.camp.south - 50;
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    this.h.move(e, dx / d, dy / d, dt);
    return true;
  }

  /** 义军小队走营门：在营外（且不在营门道上）→ 先去营门外；在营门道上 → 进营。 */
  approach(tent: Enemy, x: number, y: number): { x: number; y: number } | null {
    const c = this.camps.find(q => q.tent === tent); if (!c || this.inside(c, x, y)) return null;
    const C = LUOYANG.camp, g = this.gateOut(c);
    if (Math.abs(x - c.x) < C.gate / 2 - 8 && y > c.y + C.south - 30 && y < g.y + 60) return { x: c.x, y: c.y + 70 };
    return g;
  }

  /** 圆（义军小队）挤出营栅：返回推开量（同 Terrain.pushCircle）。 */
  pushOut(x: number, y: number, r: number): { x: number; y: number } | null { return pushOutBoxes(this.camps.flatMap(c => c.boxes), x, y, r); }

  /** 测试 / 调试：各营待命 / 出营人数。 */
  report(): Array<{ x: number; y: number; alerted: boolean; destroyed: boolean; idle: number; garrison: number; reinforce: number }> {
    return this.camps.map(c => {
      let idle = 0, g = 0; for (const m of this.members.values()) if (m.camp === c && m.e.active && m.e.spawnId === m.life) { if (m.state === 'idle') idle++; if (!m.reinforce) g++; }
      return { x: Math.round(c.x), y: Math.round(c.y), alerted: c.alerted, destroyed: c.destroyed, idle, garrison: g, reinforce: this.live(c) };
    });
  }

  clear(): void { this.unregister(); for (const c of this.camps) for (const o of c.objs) o.destroy(); this.camps.length = 0; this.members.clear(); }
}
