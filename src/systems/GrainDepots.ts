import Phaser from 'phaser';
import type {Enemy} from '../entities/Enemy';
import {actorDepth, GAME_HEIGHT, IS_DESKTOP} from '../config';
import {worldText} from '../world/WorldUI';

/** 第四章“焚粮断道”参数。 */
export const GRAIN = {
  /** 每处未焚粮草给首领一层“军心”：受到伤害 -12%。 */
  moralePerDepot: .12,
  depotHp: 120, wagonHp: 90, granaryHp: 220,
  /** 4-3：首领在场时焚毁粮仓，首领“军心动摇”僵直（毫秒）。 */
  shakenMs: 1500,
  grainReward: 12,
  /** 首领劫粮成功：回复最大生命比例（一/二阶段）。 */
  lootHeal: .08, lootHeal2: .1,
  fireMs: 3200,
} as const;

/** frame：16 粮垛、24 辎重车、1 粮仓（圆顶大帐，取自 yellow_props）。 */
export type DepotFrame = 1 | 16 | 24;
export interface DepotPoint {x: number; y: number; name: string; frame: DepotFrame; size: number;}
interface Depot {point: DepotPoint; enemy: Enemy; life: number; state: 'intact' | 'burned' | 'looted'; at: number; label: Phaser.GameObjects.Text; fire: Phaser.GameObjects.Image[];}
interface Host {
  scene: Phaser.Scene; player: {x: number; y: number};
  create: (x: number, y: number, hp: number, frame: DepotFrame, size: number) => Enemy | null;
  reward: (grain: number) => void;
}

/**
 * 袁军粮草：可被主将/士兵武器摧毁（点选可设为优先目标）。未焚的粮草越多，首领“军心”越高（减伤、援军更多）；
 * 4-2 的辎重车还会被文丑“劫粮”回血。只存在于本场战斗，不写存档。
 */
export class GrainDepots {
  readonly depots: Depot[] = [];
  private focus: Depot | null = null; private marker: Phaser.GameObjects.Graphics; private gfx: Phaser.GameObjects.Graphics;
  constructor(private h: Host, points: readonly DepotPoint[]) {
    this.gfx = h.scene.add.graphics().setDepth(35); this.marker = h.scene.add.graphics().setDepth(37);
    for (const point of points) {
      const enemy = h.create(point.x, point.y, point.frame === 24 ? GRAIN.wagonHp : point.frame === 1 ? GRAIN.granaryHp : GRAIN.depotHp, point.frame, point.size); if (!enemy) continue;
      const label = worldText(h.scene, point.x, point.y - point.size - 6, point.name, 13, '#f0c98a').setOrigin(.5).setDepth(36).setStroke('#1a120b', 3);
      this.depots.push({point, enemy, life: enemy.spawnId, state: 'intact', at: 0, label, fire: []});
    }
  }
  get total() { return this.depots.length; }
  get burned() { return this.depots.filter(d => d.state === 'burned').length; }
  /** 仍在的粮草数 = 首领军心层数。 */
  get intact() { return this.depots.filter(d => d.state === 'intact' && this.alive(d)).length; }
  private alive(d: Depot) { return d.enemy.active && d.enemy.spawnId === d.life; }
  /** 首领受到伤害倍率。 */
  get moraleMultiplier() { return 1 - GRAIN.moralePerDepot * this.intact; }

  /** 由场景 killEnemy 调用：玩家一方摧毁粮草 → 焚粮奖励。 */
  onDestroyed(enemy: Enemy, now: number): boolean {
    const d = this.depots.find(d => d.enemy === enemy && d.life === enemy.spawnId && d.state === 'intact'); if (!d) return false;
    d.state = 'burned'; d.at = now; if (this.focus === d) this.cancel(); this.h.reward(GRAIN.grainReward);
    d.label.setText('粮草已焚 · 钱币 +' + GRAIN.grainReward).setColor('#ffd59a').setBackgroundColor('#241c15dc').setPadding(5, 3);
    this.ignite(d); return true;
  }
  /** 首领劫粮：最近的完好粮草（无则 null）。 */
  nearest(x: number, y: number): {x: number; y: number; id: number} | null {
    let best: Depot | null = null, bd = Infinity;
    for (const d of this.depots) if (d.state === 'intact' && this.alive(d)) { const dist = Math.hypot(d.point.x - x, d.point.y - y); if (dist < bd) { bd = dist; best = d; } }
    return best ? {x: best.point.x, y: best.point.y, id: best.life} : null;
  }
  /** 首领抢到粮草：移除且不给玩家奖励。返回是否成功。 */
  loot(id: number, now: number): boolean {
    const d = this.depots.find(d => d.life === id && d.state === 'intact' && this.alive(d)); if (!d) return false;
    d.state = 'looted'; d.at = now; if (this.focus === d) this.cancel(); d.enemy.deactivate();
    d.label.setText('辎重被劫').setColor('#e08a6a').setBackgroundColor('#241c15dc').setPadding(5, 3);
    return true;
  }
  private ignite(d: Depot) {
    const s = this.h.scene;
    for (let i = 0; i < 3; i++) d.fire.push(s.add.image(d.point.x + (i - 1) * d.point.size * .28, d.point.y + 4 - (i % 2) * 8, 'ground_fire', i * 2).setOrigin(.5, .82).setDisplaySize(d.point.size * .55, d.point.size * .3).setDepth(actorDepth(d.point.y) + .02));
  }
  // —— 点选优先目标（与敌营一致） ——
  get selected(): Enemy | null { const d = this.focus; if (!d) return null; if (d.state !== 'intact' || !this.alive(d) || Math.hypot(d.point.x - this.h.player.x, d.point.y - this.h.player.y) > 600) { this.cancel(); return null; } return d.enemy; }
  cancel() { this.focus = null; this.marker.clear(); }
  /** 手柄：600 内可锁定的粮草。 */
  padTargets(): Array<{dist: number; current: boolean; select: () => void}> { return this.depots.filter(d => d.state === 'intact' && this.alive(d)).map(d => ({dist: Math.hypot(d.point.x - this.h.player.x, d.point.y - this.h.player.y), current: this.focus === d, select: () => { this.focus = d; }})).filter(t => t.dist <= 600); }
  target(range: number, bodyRadius = true): Enemy | null { const e = this.selected; return e && Math.hypot(e.x - this.h.player.x, e.y - this.h.player.y) <= range + (bodyRadius ? e.radius : 0) ? e : null; }
  pointer(pointer: Phaser.Input.Pointer): boolean {
    const hud = this.h.scene.input.hitTestPointer(pointer).some(o => (o as Phaser.GameObjects.Image).scrollFactorX === 0); if (hud) return false;
    if (!IS_DESKTOP && pointer.x < 180 && pointer.y > GAME_HEIGHT - 250) return false;
    const p = this.h.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const d = this.depots.find(d => d.state === 'intact' && this.alive(d) && d.enemy.sprite.getBounds().contains(p.x, p.y));
    if (!d) { this.cancel(); return false; }
    this.focus = d; return true;
  }
  update(now: number) {
    this.gfx.clear(); this.marker.clear();
    for (const d of this.depots) {
      const dist = Math.hypot(this.h.player.x - d.point.x, this.h.player.y - d.point.y);
      if (d.state === 'intact' && !this.alive(d)) { d.state = 'burned'; d.at = now; }
      if (d.state !== 'intact') {
        const age = now - d.at; d.label.setVisible(dist < 650 && age < 2600);
        for (const [i, f] of d.fire.entries()) { const left = GRAIN.fireMs - age; f.setVisible(left > 0).setFrame((Math.floor(age / 110) + i * 2) % 8).setAlpha(Math.min(1, left / 600)); }
        continue;
      }
      d.label.setVisible(dist < 650);
      const e = d.enemy;
      if (e.hp < e.maxHp) { const w = d.point.size * .6; this.gfx.fillStyle(0x211a14, .8).fillRect(d.point.x - w / 2, d.point.y - d.point.size + 4, w, 4).fillStyle(0xc9893f).fillRect(d.point.x - w / 2, d.point.y - d.point.size + 4, w * Math.max(0, e.hp / e.maxHp), 4); }
      if (this.focus === d) { const x = d.point.x, y = d.point.y, w = d.point.size * .5, top = y - d.point.size - 14; this.marker.lineStyle(2, 0xf0c479, .95); for (const sign of [-1, 1]) { const xx = x + sign * w; this.marker.lineBetween(xx - sign * 12, top, xx, top).lineBetween(xx, top, xx, top + 12).lineBetween(xx - sign * 12, y + 4, xx, y + 4).lineBetween(xx, y + 4, xx, y - 8); } }
    }
  }
  clear() { this.cancel(); this.marker.destroy(); this.gfx.destroy(); for (const d of this.depots) { d.label.destroy(); for (const f of d.fire) f.destroy(); } this.depots.length = 0; }
}
