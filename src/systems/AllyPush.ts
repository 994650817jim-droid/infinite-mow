import Phaser from 'phaser';
import { actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import { visualTextureKey } from './ReadableTextures';

/**
 * 友军攻势（2-3 火烧洛阳；用户「从后方会有我方小兵去一路打过去会去摧毁营寨，小地图会显示这个攻势」）：
 * 每隔 everyMs，一队义军（squad 人）从后方（镜头下沿外）冒出来，沿一条行军线走向最近一座还没摧毁的营寨；
 * 路上碰到敌兵就停下来打，到了营寨就围着砍营寨，营寨塌了这队就散（淡出）。场上总人数封顶 cap。
 * 轻量兵：不进部曲（Legion）的编制 / 军粮 / 寻路，只是一张兵种行走图 + 简单的走、打、挨打；敌兵 AI 不改（不会专门追他们），
 * 挨打按「身边敌兵数 × enemyDps」算。伤害走 GameScene.hitEnemy（fromAlly），营寨被打塌照常算进「摧毁营寨」军令。
 * 地图（ui/BattleMap）读 squads：行军线（后方 → 营寨的碧色箭头）、兵的碧点、正在挨打的营寨闪烁。
 */
/** 把圆（义军兵）推出一组碰撞框，返回推开量（同 Terrain.pushCircle；没碰到为 null）。 */
export function pushOutBoxes(boxes: ReadonlyArray<{ left: number; right: number; top: number; bottom: number }>, x0: number, y0: number, r: number): { x: number; y: number } | null {
  let x = x0, y = y0, moved = false;
  for (const b of boxes) {
    if (x < b.left - r || x > b.right + r || y < b.top - r || y > b.bottom + r) continue;
    const qx = Phaser.Math.Clamp(x, b.left, b.right), qy = Phaser.Math.Clamp(y, b.top, b.bottom), dx = x - qx, dy = y - qy, d = Math.hypot(dx, dy);
    if (d >= r) continue;
    if (d > .001) { x += dx / d * (r - d); y += dy / d * (r - d); }
    else { const l = x - b.left, rt = b.right - x, t = y - b.top, bt = b.bottom - y, m = Math.min(l, rt, t, bt); if (m === l) x = b.left - r; else if (m === rt) x = b.right + r; else if (m === t) y = b.top - r; else y = b.bottom + r; }
    moved = true;
  }
  return moved ? { x: x - x0, y: y - y0 } : null;
}
export interface AllyPushConfig {
  firstMs: number; everyMs: number; squad: number; cap: number; sheets: readonly string[];
  speed: number; hp: number; dmg: number; campDmg: number; hitMs: number; engage: number; reach: number; campReach: number; enemyDps: number; rearPad: number;
}
export interface PushHost {
  scene: Phaser.Scene; now: () => number; paused: () => boolean;
  player: () => { x: number; y: number };
  camps: () => Enemy[]; enemies: () => readonly Enemy[];
  hit: (e: Enemy, dmg: number) => void;
  push?: (x: number, y: number, r: number) => { x: number; y: number } | null;
  /** 绕障（用户试玩「关于我自己的兵也会被围栏卡住」）：去目标的连线被挡时给绕路路点（GameScene 接敌兵绕障导航，目标在主将附近时有效），null = 直走。 */
  route?: (x: number, y: number, tx: number, ty: number) => { x: number; y: number } | null;
  /** 有营栅的营寨（2-3 LuoyangCamps）：在营外时先去哪个路点（营门），null = 直接走向营帐。 */
  approach?: (camp: Enemy, x: number, y: number) => { x: number; y: number } | null;
  /** 没有营寨目标时的集结点（攻城：跟着冲车 → 城内要点 → 府衙）。给了它，小队没营寨可打也不散，照集结点推进。 */
  rally?: () => { x: number; y: number } | null;
  /** 新小队从哪冒出来（不给 = 镜头下沿外）。 */
  origin?: () => { x: number; y: number } | null;
}
interface Soldier { sp: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; x: number; y: number; ox: number; oy: number; hp: number; sheet: string; dir: string; walk: number; nextHit: number; lunge: number; dead: number }
/** escort：援军小队（兵阵 4 势「援军」，没有营寨目标）——跟在主将身边打最近的敌兵，到点散去。 */
export interface Squad { id: number; from: { x: number; y: number }; target: Enemy | null; life: number; members: Soldier[]; done: number; escort?: { until: number } }

export class AllyPush {
  readonly squads: Squad[] = [];
  /** 营寨最近一次被友军砍的时间（地图上闪烁）。 */
  readonly campHitAt = new Map<Enemy, number>();
  readonly stats = { spawned: 0, campHits: 0, campDamage: 0, kills: 0, lost: 0 };
  private nextAt: number; private seq = 0; private lastNow: number;
  constructor(private readonly h: PushHost, private readonly c: AllyPushConfig) {
    this.nextAt = h.now() + c.firstMs; this.lastNow = h.now();
    h.scene.events.on('update', this.tick, this);
    h.scene.events.once('shutdown', () => this.clear());
  }
  /** 我方避让（AllySeparation）：活着的兵作为碰撞体（半径 13）；base 让 id 不和别的单位撞。 */
  bodies(out: Array<{ id: number; x: number; y: number; r: number; move(dx: number, dy: number): void }>, base: number): void {
    let k = 0; for (const s of this.squads) for (const m of s.members) { k++; if (m.dead) continue; out.push({ id: base + k, get x() { return m.x; }, get y() { return m.y; }, r: 13, move: (dx, dy) => { m.x += dx; m.y += dy; } }); }
  }
  get alive(): number { let n = 0; for (const s of this.squads) for (const m of s.members) if (!m.dead) n++; return n; }

  /** 出一队：营寨里离主将最近的那座；出生在它正南方、镜头下沿外 rearPad。 */
  spawn(): Squad | null {
    const camps = this.h.camps(), free = this.c.cap - this.alive; if (free <= 0) return null;
    const pl = this.h.player(), cam = this.h.scene.cameras.main.worldView;
    if (!camps.length) { const r = this.h.rally?.(); if (!r) return null; const o = this.h.origin?.() ?? { x: r.x, y: cam.bottom + this.c.rearPad }; return this.spawnAt(o.x, o.y, Math.min(this.c.squad, free), null); }
    const target = camps.slice().sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
    const n = Math.min(this.c.squad, free), fx = Phaser.Math.Linear(target.x, pl.x, .35), fy = Math.max(cam.bottom + this.c.rearPad, target.y + 520);
    return this.spawnAt(fx, fy, n, target);
  }
  /** 兵阵 4 势「援军」：n 名义军从主将后方（镜头下沿外）冲来，助战 lifeMs 后散去（不占营寨目标）。 */
  spawnEscort(n: number, lifeMs: number): Squad | null {
    const free = this.c.cap - this.alive; if (free <= 0) return null;
    const pl = this.h.player(), cam = this.h.scene.cameras.main.worldView;
    const sq = this.spawnAt(pl.x + (Math.random() - .5) * 120, cam.bottom + this.c.rearPad * .6, Math.min(n, free), null);
    sq.escort = { until: this.h.now() + lifeMs }; return sq;
  }
  /** 在指定地点冒出 n 名助战兵（合击「十面埋伏」伏兵、「铁骑冲阵」骑卒、觉醒「铁壁军阵」），lifeMs 后散去。 */
  spawnEscortAt(x: number, y: number, n: number, lifeMs: number): Squad | null {
    const free = this.c.cap - this.alive; if (free <= 0) return null;
    const sq = this.spawnAt(x, y, Math.min(n, free), null); sq.escort = { until: this.h.now() + lifeMs }; return sq;
  }
  /** 圈里有几名活着的义军（攻城城内要点：义军帮着占 / 守）。 */
  near(x: number, y: number, r: number): number { let n = 0; for (const s of this.squads) if (!s.done) for (const m of s.members) if (!m.dead && Math.hypot(m.x - x, m.y - y) <= r) n++; return n; }
  /** 转场（攻城进城 / 进府衙）：活着的义军整体挪到 (x, y) 一带。 */
  relocate(x: number, y: number): void {
    for (const s of this.squads) { s.from = { x, y }; for (const m of s.members) if (!m.dead) { m.x = x + m.ox * 1.4 + (Math.random() - .5) * 40; m.y = y + m.oy + (Math.random() - .5) * 30; this.draw(m, this.h.now()); } }
  }
  private spawnAt(fx: number, fy: number, n: number, target: Enemy | null): Squad {
    const sq: Squad = { id: ++this.seq, from: { x: fx, y: fy }, target, life: target?.spawnId ?? 0, members: [], done: 0 };
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 3), col = i % 3 - 1, ox = col * 34 + (row % 2) * 17, oy = row * 34;
      const sheet = this.c.sheets[i % this.c.sheets.length], key = visualTextureKey(this.h.scene, sheet);
      const fh = this.h.scene.textures.getFrame(key, 'up_0')?.height || 96;
      const sp = this.h.scene.add.sprite(fx + ox, fy + oy, key, this.h.scene.textures.get(key).has('up_0') ? 'up_0' : 0).setOrigin(.5, .86).setScale(64 / fh).setName('ally-push-soldier');
      const shadow = this.h.scene.add.ellipse(fx + ox, fy + oy + 2, 26, 9, 0x000000, .28).setDepth(actorDepth(fy + oy) - .01);
      sq.members.push({ sp, shadow, x: fx + ox, y: fy + oy, ox, oy, hp: this.c.hp, sheet: key, dir: 'up', walk: 0, nextHit: 0, lunge: 0, dead: 0 });
    }
    this.squads.push(sq); this.stats.spawned += n; return sq;
  }

  private tick(): void {
    const now = this.h.now(), dt = Math.min(.1, Math.max(0, (now - this.lastNow) / 1000)); this.lastNow = now;
    if (this.h.paused() || dt <= 0) return;
    if (now >= this.nextAt) { this.nextAt = now + this.c.everyMs; this.spawn(); }
    const C = this.c, foes = this.h.enemies();
    for (const sq of [...this.squads]) {
      // 目标营寨塌了：改打下一座最近的；都没了就散
      if (sq.escort) { if (!sq.done && now >= sq.escort.until) sq.done = now; }
      else if (!sq.target || !sq.target.active || sq.target.spawnId !== sq.life || sq.target.hp <= 0) {
        const lead = sq.members.find(m => !m.dead), camps = this.h.camps();
        const next = lead && camps.length ? camps.slice().sort((a, b) => Math.hypot(a.x - lead.x, a.y - lead.y) - Math.hypot(b.x - lead.x, b.y - lead.y))[0] : null;
        if (next) { sq.target = next; sq.life = next.spawnId; sq.from = { x: lead!.x, y: lead!.y }; } else { sq.target = null; if (!sq.done && !this.h.rally?.()) sq.done = now; }
      }
      for (const m of sq.members) {
        if (m.dead) continue;
        if (sq.done) { m.sp.setAlpha(Math.max(0, 1 - (now - sq.done) / 1500)); m.shadow.setAlpha(m.sp.alpha * .28); continue; }
        // 身边的敌兵：最近一个（不打补给物件 / 刀枪不入 / 城头的）
        let foe: Enemy | null = null, fd = sq.escort ? C.engage * 2.5 : C.engage;
        for (const e of foes) { if (!e.active || e.isSupplySlot || e.invulnerable || e.hp <= 0 || e.def.behavior === 'wall') continue; const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < fd) { fd = d; foe = e; } }
        const camp = sq.target, cd = camp ? Math.hypot(camp.x - m.x, camp.y - m.y) : 0;
        let tx: number, ty: number, strike: Enemy | null = null, reach: number;
        if (foe) { tx = foe.x; ty = foe.y; reach = C.reach + foe.radius * .5; if (fd <= reach) strike = foe; }
        else if (!camp) { const r = sq.escort ? null : this.h.rally?.(), pl = r ?? this.h.player(); tx = pl.x + m.ox * 1.6; ty = pl.y + (r ? 0 : 70) + m.oy; reach = 0; }
        else { const a = Math.atan2(m.y - camp.y, m.x - camp.x) || Math.PI / 2, rr = camp.radius + C.campReach * .6; tx = camp.x + Math.cos(a) * rr + m.ox * .4; ty = camp.y + Math.sin(a) * rr * .7; reach = camp.radius + C.campReach; if (cd <= reach) strike = camp; else { const via = this.h.approach?.(camp, m.x, m.y); if (via) { tx = via.x + m.ox * .4; ty = via.y + m.oy * .3; } } }
        if (!strike) {
          { const w = this.h.route?.(m.x, m.y, tx, ty); if (w) { tx = w.x; ty = w.y; } }
          const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
          if (d > 2) { const st = Math.min(d, C.speed * dt); m.x += dx / d * st; m.y += dy / d * st; m.walk += st; m.dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down'; }
        } else {
          const dx = strike.x - m.x, dy = strike.y - m.y; m.dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
          if (now >= m.nextHit) {
            m.nextHit = now + C.hitMs * (.85 + Math.random() * .3); m.lunge = now;
            const dmg = strike === camp ? C.campDmg : C.dmg, before = strike.hp;
            this.h.hit(strike, dmg);
            if (strike === camp) { this.stats.campHits++; this.stats.campDamage += Math.max(0, before - Math.max(0, strike.hp)); this.campHitAt.set(camp, now); }
            else if (!strike.active || strike.hp <= 0) this.stats.kills++;
          }
        }
        const p = this.h.push?.(m.x, m.y, 14); if (p) { m.x += p.x; m.y += p.y; }
        // 挨打：身边敌兵越多掉血越快（最多按 3 个算）
        let near = 0; for (const e of foes) if (e.active && !e.isSupplySlot && e.hp > 0 && Math.abs(e.x - m.x) < 46 && Math.abs(e.y - m.y) < 46) { if (++near >= 3) break; }
        if (near) { m.hp -= near * C.enemyDps * dt; if (m.hp <= 0) { m.dead = now; this.stats.lost++; } }
        this.draw(m, now);
      }
      // 死的淡出、整队没了就删
      for (const m of sq.members) if (m.dead) { const a = Math.max(0, 1 - (now - m.dead) / 600); m.sp.setAlpha(a).setTint(0x8a7a6a).setAngle(m.dir === 'left' ? -80 : 80); m.shadow.setAlpha(a * .28); }
      if (sq.members.every(m => m.dead ? now - m.dead > 600 : sq.done && now - sq.done > 1500)) { for (const m of sq.members) { m.sp.destroy(); m.shadow.destroy(); } this.squads.splice(this.squads.indexOf(sq), 1); }
    }
    for (const [c, t] of this.campHitAt) if (!c.active || now - t > 4000) this.campHitAt.delete(c);
  }
  private draw(m: Soldier, now: number): void {
    const fr = `${m.dir}_${Math.floor(m.walk / 14) % 4}`, tex = this.h.scene.textures.get(m.sheet);
    if (tex.has(fr) && m.sp.frame.name !== fr) m.sp.setFrame(fr);
    const k = now - m.lunge < 220 ? Math.sin((now - m.lunge) / 220 * Math.PI) * 7 : 0, ux = m.dir === 'left' ? -1 : m.dir === 'right' ? 1 : 0, uy = m.dir === 'up' ? -1 : m.dir === 'down' ? 1 : 0;
    m.sp.setPosition(m.x + ux * k, m.y + uy * k - (k ? 0 : Math.abs(Math.sin(m.walk / 14 * Math.PI)) * 1.5)).setDepth(actorDepth(m.y));
    m.shadow.setPosition(m.x, m.y + 2).setDepth(actorDepth(m.y) - .01);
  }
  clear(): void { this.h.scene.events.off('update', this.tick, this); for (const s of this.squads) for (const m of s.members) { m.sp.destroy(); m.shadow.destroy(); } this.squads.length = 0; }
}
