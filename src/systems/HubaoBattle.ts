import type {Enemy} from '../entities/Enemy';
import type {EnemyDef} from '../data/enemies';
import {XiliangBattle, type Host} from './XiliangBattle';
import {HUBAO, HUBAO_RAID} from '../data/hubao';
import {ensureTroopArt, troopArtReady} from './TroopArt';

interface HubaoHost extends Host {
  /** 敌兵寻路移动（GameScene.advanceEnemy）。 */
  move: (e: Enemy, nx: number, ny: number, dt: number) => void;
  boss: () => Enemy | null;
}

/**
 * 第五章 · 虎豹骑（曹纯统领的曹军精骑）：复用第二章「铁骑突阵」，四骑一队、冲锋更重；
 * 5-1 长坂突围首领曹纯出场时虎豹骑护驾（守在首领身边，主将靠近才出击），护卫折损后号令补员。
 * 造型：ChatGPT 生成的虎豹骑奔跑图（public/assets/xiliang/hubao-walk.png，战斗开始时加载）；加载完成前为本关骑兵放大并染铁青色。
 */
export class HubaoBattle extends XiliangBattle {
  private guards: Array<{e: Enemy; life: number; slot: number}> = []; private regroupAt = 0; private guarding = false;
  constructor(private hh: HubaoHost) {
    super(hh, {
      raid: HUBAO_RAID, first: HUBAO.first[hh.stage() - 1], interval: s => HUBAO.interval[s - 1],
      riderDef: () => hubaoDefFor(hh), banner: ['虎豹骑 · 突阵！', '曹军精骑四骑一队，看准冲锋道闪开'], feixiong: false, laneName: 'hubao-raid-lane',
    });
    ensureTroopArt(hh.scene, ['hubao_walk']);
  }
  /** 虎豹骑定义（测试也用）：以本关骑兵为底。 */
  hubaoDef(): EnemyDef { return hubaoDefFor(this.hh); }
  /** 首领出场：5-1 曹纯身边四骑护驾。 */
  onBoss(now: number): void {
    if (this.hh.stage() !== 1) return;
    this.guarding = true; this.regroupAt = now + HUBAO.regroupMs; this.summon(HUBAO.guards);
    this.hh.banner('虎豹骑护驾', '曹纯身边精骑环卫，靠近即出击');
  }
  private summon(n: number): void {
    const b = this.hh.boss(); if (!b) return;
    for (let i = 0; i < n; i++) {
      const slot = this.guards.length + i, a = slot / HUBAO.guards * Math.PI * 2;
      const e = this.hh.spawn('cavalry', b.x + Math.cos(a) * HUBAO.guardRing, b.y + Math.sin(a) * HUBAO.guardRing, this.hubaoDef());
      if (e) this.guards.push({e, life: e.spawnId, slot});
    }
  }
  /** 护卫：主将不在附近时回到首领身边的位置；主将靠近则按普通骑兵出击（冲锋）。 */
  protected guardStep(e: Enemy, dt: number, _now: number): boolean {
    const g = this.guards.find(x => x.e === e && x.e.spawnId === x.life); if (!g) return false;
    const b = this.hh.boss(), p = this.hh.player;
    if (!b?.active || Math.hypot(p.x - e.x, p.y - e.y) < HUBAO.guardLeash || e.chargeState !== 'none') return false;
    const a = g.slot / HUBAO.guards * Math.PI * 2 + _now / 4000, tx = b.x + Math.cos(a) * HUBAO.guardRing, ty = b.y + Math.sin(a) * HUBAO.guardRing, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d > 12) this.hh.move(e, dx / d, dy / d, dt); else e.moveVx = e.moveVy = 0;
    return true;
  }
  update(dt: number, now: number): void {
    super.update(dt, now);
    this.guards = this.guards.filter(x => x.e.active && x.e.spawnId === x.life);
    const b = this.hh.boss();
    if (this.guarding && b?.active && now >= this.regroupAt) {
      this.regroupAt = now + HUBAO.regroupMs;
      if (this.guards.length < HUBAO.regroupBelow) { this.summon(HUBAO.regroupCount); this.hh.banner('曹纯号令 · 虎豹骑补阵', ''); }
    }
    if (!b?.active) this.guarding = false;
  }
  /** 当前护卫数（测试用）。 */
  get guardCount(): number { return this.guards.filter(x => x.e.active && x.e.spawnId === x.life).length; }
}

/** 虎豹骑定义：以本关骑兵为底，生命 ×1.4、接触伤害 +2、放大并染铁青色。 */
export function hubaoDefFor(h: Pick<Host, 'def' | 'scene'>): EnemyDef {
  const base = h.def('cavalry'), wv = base.walkVisual;
  const def: EnemyDef = {...base, variant: 'hubao', hp: Math.round(base.hp * HUBAO.hpMul), damage: base.damage + HUBAO.damageAdd, tint: HUBAO.tint, walkVisual: wv ? {...wv, scale: wv.scale * HUBAO.scale} : undefined};
  // 正式美术（ChatGPT 奔跑图）就绪后不再染色；以西凉骑兵奔跑表的比例为基准
  if (troopArtReady(h.scene, 'hubao_walk')) { def.tint = undefined; def.walkVisual = {texture: 'hubao_walk', scale: (wv?.scale ?? HUBAO.baseScale) * HUBAO.scale, groundY: wv?.groundY ?? .875}; }
  return def;
}
