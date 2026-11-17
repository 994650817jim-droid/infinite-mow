import Phaser from 'phaser';
import { DEPTH, actorDepth } from '../config';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';
import type { BattlefieldSupplies } from './BattlefieldSupplies';
import { ENV_BANNER, ENV_BARREL, ENV_TENT, type EnvConfig } from '../data/envInteractions';
import { playSheet } from './SkillFxSheets';

/**
 * 场地环境互动第一批（env-interaction-proposal.md）：① 火油桶连爆 ② 敌军军旗 ③ 可破坏营帐。
 * 物件走 BattlefieldSupplies 的可破坏物（同一套武器命中、碰撞框、寻路避让、远离回收）；本模块管生成、引信、爆炸、地火、
 * 军旗光环 / 动摇、营帐倒塌掉落与伏兵。美术：public/assets/env-v2/props.png（v2 道具：火油桶 / 四势力军旗 / 营帐 / 塌营帐），
 * 爆炸、地火、倒塌扬尘为手绘透明序列帧（skill-fx/）；缺 v2 道具图时退回第一章营寨道具 yellow_props。数值见 src/data/envInteractions.ts（待平衡复核）。
 */
export interface EnvHost {
  scene: Phaser.Scene;
  player: Player;
  supplies: BattlefieldSupplies;
  enemies: () => readonly Enemy[];
  allies: () => readonly Ally[];
  hitEnemy: (e: Enemy, damage: number) => void;
  hurtAlly: (a: Ally, damage: number) => void;
  spawnEnemy: (x: number, y: number) => Enemy | null;
  spawnGem: (x: number, y: number, value: number) => void;
  spawnChest?: (x: number, y: number) => void;
  now: () => number;
  sfx?: (kind: string) => void;
}

const CELL = 640;
/** env_props 帧（4×4）：0 火油桶 · 1 桶堆 · 2 点燃 · 3 残骸 · 4+势力 军旗 · 8+势力 营帐 · 12+势力 塌营帐。 */
const F = { barrel: 0, barrelPile: 1, barrelLit: 2, barrelWreck: 3, banner: 4, tent: 8, tentDown: 12 } as const;
/** 缺 v2 道具图时的退回帧（yellow_props）：木桶陶罐 24、黄巾旗 4、帐篷 0、碎木 27。 */
const FALLBACK = { barrel: 24, banner: 4, tent: 0, wreck: 27 } as const;

interface Fuse { x: number; y: number; until: number; img: Phaser.GameObjects.Image | null }
interface Fire { x: number; y: number; until: number; nextTick: number; img: Phaser.GameObjects.Image; active: boolean }
interface Remain { img: Phaser.GameObjects.Image; until: number }

export class EnvInteractions {
  private fuses: Fuse[] = [];
  private fires: Fire[] = [];
  private remains: Remain[] = [];
  private banners: Enemy[] = [];
  private readonly hasArt: boolean;
  /** 测试 / 调试统计。 */
  readonly stats = { barrels: 0, explosions: 0, chains: 0, fires: 0, banners: 0, bannersDown: 0, shaken: 0, tents: 0, tentsDown: 0, ambush: 0, drops: 0 };

  constructor(private readonly h: EnvHost, readonly cfg: EnvConfig) {
    this.hasArt = h.scene.textures.exists('env_props');
    h.supplies.onEnvBroken = (enemy, env) => this.onBroken(enemy, env);
    for (let i = 0; i < ENV_BARREL.maxFires; i++) this.fires.push({ x: 0, y: 0, until: 0, nextTick: 0, active: false, img: h.scene.add.image(0, 0, h.scene.textures.exists('fx_ground_fire') ? 'fx_ground_fire' : '__WHITE').setOrigin(.5, .82).setDepth(DEPTH.ground + 2.2).setVisible(false).setName('env-fire') });
  }

  private hash(x: number, y: number, salt: number): number { let v = Math.imul(x + salt, 73856093) ^ Math.imul(y - salt, 19349663) ^ 0x2f6e1b; v = Math.imul(v ^ (v >>> 16), 0x45d9f3b); return (v ^ (v >>> 16)) >>> 0; }
  private tex(kind: keyof typeof FALLBACK, frame: number): { texture: string; frame: number } { return this.hasArt ? { texture: 'env_props', frame } : { texture: 'yellow_props', frame: FALLBACK[kind] }; }

  // ---------------- 生成 ----------------
  private generate(): void {
    const p = this.h.player, cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), sup = this.h.supplies;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (this.cfg.barrels) {
        const hv = this.hash(x, y, 811);
        if (hv % ENV_BARREL.every === 1 && sup.envCount('barrel') < ENV_BARREL.maxGroups * 3) {
          const px = x * CELL + 140 + (hv >>> 8) % 360, py = y * CELL + 140 + (hv >>> 16) % 360, n = 1 + (hv >>> 4) % 3;
          if (Math.hypot(px - p.x, py - p.y) < 1250) for (let i = 0; i < n; i++) {
            const bx = px + [0, 34, -28][i], by = py + [0, 14, 20][i]; if (!sup.envClear(bx, by, 50)) continue;
            const t = this.tex('barrel', F.barrel);
            if (sup.spawnEnvProp('barrel', `env-barrel-${x},${y}-${i}`, bx, by, { ...t, size: this.hasArt ? 64 : 72, hp: ENV_BARREL.hp, radius: 16, halfW: 14, halfH: 8 })) this.stats.barrels++;
          }
        }
      }
      if (this.cfg.banners) {
        const hv = this.hash(x, y, 4219);
        if (hv % ENV_BANNER.every === 3 && sup.envCount('banner') < ENV_BANNER.maxActive) {
          const px = x * CELL + 160 + (hv >>> 8) % 320, py = y * CELL + 160 + (hv >>> 16) % 320;
          if (Math.hypot(px - p.x, py - p.y) < 1250 && sup.envClear(px, py, 70)) {
            const t = this.tex('banner', F.banner + this.cfg.faction);
            if (sup.spawnEnvProp('banner', `env-banner-${x},${y}`, px, py, { ...t, size: this.hasArt ? 128 : 110, hp: ENV_BANNER.hp, radius: 20, halfW: 9, halfH: 6, originY: .92 })) this.stats.banners++;
          }
        }
      }
      if (this.cfg.tents) {
        const hv = this.hash(x, y, 9377);
        if (hv % ENV_TENT.every === 5 && sup.envCount('tent') < ENV_TENT.maxActive) {
          const px = x * CELL + 170 + (hv >>> 8) % 300, py = y * CELL + 170 + (hv >>> 16) % 300;
          if (Math.hypot(px - p.x, py - p.y) < 1250 && sup.envClear(px, py, 150)) {
            const t = this.tex('tent', F.tent + this.cfg.faction);
            if (sup.spawnEnvProp('tent', `env-tent-${x},${y}`, px, py, { ...t, size: this.hasArt ? 176 : 150, hp: ENV_TENT.hp, radius: 60, halfW: 56, halfH: 20, offsetY: -18, originY: .9 })) this.stats.tents++;
          }
        }
      }
    }
    this.banners = sup.envProps().filter(p => p.env === 'banner').map(p => p.enemy);
  }

  // ---------------- 打破 ----------------
  private onBroken(enemy: Enemy, env: string): void {
    if (env === 'barrel') this.ignite(enemy.x, enemy.y, ENV_BARREL.fuseMs);
    else if (env === 'banner') this.bannerDown(enemy);
    else if (env === 'tent') this.tentDown(enemy);
  }

  /** 点燃：桶换成“着火”帧，引信到点后爆炸。 */
  private ignite(x: number, y: number, ms: number): void {
    const t = this.tex('barrel', F.barrelLit), sc = this.h.scene;
    const img = sc.add.image(x, y, t.texture, t.frame).setOrigin(.5, .9).setDisplaySize(this.hasArt ? 64 : 72, this.hasArt ? 64 : 72).setDepth(actorDepth(y)).setName('env-barrel-lit');
    if (!this.hasArt) img.setTint(0xffb080);
    this.fuses.push({ x, y, until: this.h.now() + ms, img });
    this.h.sfx?.('chargeWarn');
  }

  private explode(f: Fuse): void {
    const sc = this.h.scene, now = this.h.now(), R = ENV_BARREL.radius;
    this.stats.explosions++;
    f.img?.destroy();
    sc.cameras.main.shake(120, .004);
    this.h.sfx?.('flameBoom');
    playSheet(sc, 'fx_explosion', f.x, f.y + 8, { size: 190, ms: 620, depth: actorDepth(f.y) + .6, originY: .84, name: 'env-explosion' });
    // 残骸
    const w = this.tex('barrel', F.barrelWreck); this.remains.push({ img: sc.add.image(f.x, f.y, w.texture, w.frame).setOrigin(.5, .9).setDisplaySize(60, 60).setDepth(DEPTH.deco + 2).setAlpha(.9), until: now + 9000 });
    // 伤害：敌人（首领减半）、主将、我方部曲
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || Math.hypot(e.x - f.x, e.y - f.y) > R + e.radius) continue;
      this.h.hitEnemy(e, ENV_BARREL.damage * (e.kind === 'boss' ? ENV_BARREL.bossMul : 1));
    }
    const p = this.h.player; if (p.alive && Math.hypot(p.x - f.x, p.y - f.y) <= R + p.radius) p.takeDamage(Math.max(4, p.maxHp * ENV_BARREL.playerRatio), now);
    for (const a of this.h.allies()) if (a.active && Math.hypot(a.x - f.x, a.y - f.y) <= R + a.radius) this.h.hurtAlly(a, ENV_BARREL.damage * ENV_BARREL.allyMul);
    // 连锁：波及范围内的其他火油桶很快跟着炸
    for (const { enemy, env } of this.h.supplies.envProps()) if (env === 'barrel' && Math.hypot(enemy.x - f.x, enemy.y - f.y) <= R + 20) { this.stats.chains++; const x = enemy.x, y = enemy.y; this.h.supplies.onEnvBroken = undefined; this.h.supplies.breakEnv(enemy); this.h.supplies.onEnvBroken = (en, ev) => this.onBroken(en, ev); this.ignite(x, y, ENV_BARREL.chainFuseMs); }
    // 地火（对象池，满了就挤掉最早的一块）
    let fire = this.fires.find(x => !x.active); if (!fire) fire = this.fires.reduce((a, b) => a.until < b.until ? a : b);
    Object.assign(fire, { x: f.x, y: f.y + 6, until: now + ENV_BARREL.fireMs, nextTick: now + 300, active: true });
    fire.img.setPosition(fire.x, fire.y).setDisplaySize(ENV_BARREL.fireRadius * 2.6, ENV_BARREL.fireRadius * 2.6).setVisible(true).setAlpha(1);
    this.stats.fires++;
  }

  private bannerDown(enemy: Enemy): void {
    const sc = this.h.scene, now = this.h.now(), x = enemy.x, y = enemy.y; this.stats.bannersDown++;
    const t = this.tex('banner', F.banner + this.cfg.faction), side = this.h.player.x < x ? 1 : -1;
    const img = sc.add.image(x, y, t.texture, t.frame).setOrigin(.42, .92).setDisplaySize(enemy.sprite.displayWidth, enemy.sprite.displayHeight).setDepth(actorDepth(y)).setName('env-banner-falling');
    sc.tweens.add({ targets: img, rotation: side * 1.45, duration: 520, ease: 'Quad.In', onComplete: () => { img.setDepth(DEPTH.deco + 2.4); playSheet(sc, 'fx_collapse_dust', x + side * 46, y, { size: 150, ms: 560, depth: actorDepth(y) + .4, originY: .8, name: 'env-dust' }); this.h.sfx?.('propBreak'); } });
    this.remains.push({ img, until: now + 10000 });
    // 动摇：半径内敌人减速（与其他减速取最强）
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || e.kind === 'boss' || Math.hypot(e.x - x, e.y - y) > ENV_BANNER.shakenRadius) continue;
      e.martialSlow = Math.min(now >= e.martialSlowUntil ? 1 : e.martialSlow, ENV_BANNER.shakenSlow); e.martialSlowUntil = Math.max(e.martialSlowUntil, now + ENV_BANNER.shakenMs); this.stats.shaken++;
    }
    this.banners = this.banners.filter(b => b !== enemy);
  }

  private tentDown(enemy: Enemy): void {
    const sc = this.h.scene, now = this.h.now(), x = enemy.x, y = enemy.y, size = enemy.sprite.displayWidth; this.stats.tentsDown++;
    const t = this.hasArt ? { texture: 'env_props', frame: F.tentDown + this.cfg.faction } : { texture: 'yellow_props', frame: FALLBACK.wreck };
    const img = sc.add.image(x, y, t.texture, t.frame).setOrigin(.5, .9).setDisplaySize(size, size).setDepth(actorDepth(y)).setName('env-tent-down').setScale(enemy.sprite.scaleX, enemy.sprite.scaleY * 1.15);
    sc.tweens.add({ targets: img, scaleY: enemy.sprite.scaleY, duration: 260, ease: 'Bounce.Out' });
    playSheet(sc, 'fx_collapse_dust', x, y + 4, { size: size * 1.05, ms: 620, depth: actorDepth(y) + .4, originY: .8, name: 'env-dust' });
    this.h.sfx?.('propBreak');
    this.remains.push({ img, until: now + 20000 });
    // 掉落：经验宝石、回血、小概率兵装宝箱
    for (let i = 0; i < ENV_TENT.gems; i++) { const a = i / ENV_TENT.gems * Math.PI * 2; this.h.spawnGem(x + Math.cos(a) * 26, y + 10 + Math.sin(a) * 12, ENV_TENT.gemXp); }
    const roll = this.hash(Math.round(x), Math.round(y), 77) % 1000 / 1000;
    if (roll < ENV_TENT.healChance) { this.h.supplies.dropHeal(x + 18, y + 16); this.stats.drops++; }
    if (this.h.spawnChest && this.hash(Math.round(y), Math.round(x), 91) % 1000 / 1000 < ENV_TENT.chestChance) this.h.spawnChest(x, y + 30);
    // 伏兵
    if (this.hash(Math.round(x) + 5, Math.round(y), 33) % 1000 / 1000 < ENV_TENT.ambushChance) {
      const n = ENV_TENT.ambushMin + this.hash(Math.round(x), 3, 5) % (ENV_TENT.ambushMax - ENV_TENT.ambushMin + 1);
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * .9; if (this.h.spawnEnemy(x + Math.cos(a) * 46, y + 26 + Math.sin(a) * 20)) this.stats.ambush++; }
    }
  }

  // ---------------- 每帧 ----------------
  update(dt: number): void {
    void dt;
    const now = this.h.now();
    this.generate();
    for (let i = this.fuses.length - 1; i >= 0; i--) { const f = this.fuses[i]; if (f.img) f.img.setAlpha(.75 + .25 * Math.sin(now / 45)); if (now >= f.until) { this.fuses.splice(i, 1); this.explode(f); } }
    for (const fire of this.fires) {
      if (!fire.active) continue;
      if (now >= fire.until) { fire.active = false; fire.img.setVisible(false); continue; }
      fire.img.setFrame(Math.floor(now / 90) % 6).setAlpha(Math.min(1, (fire.until - now) / 400));
      if (now < fire.nextTick) continue; fire.nextTick = now + ENV_BARREL.fireTickMs;
      for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - fire.x, e.y - fire.y) <= ENV_BARREL.fireRadius + e.radius) this.h.hitEnemy(e, ENV_BARREL.fireDamage);
      const p = this.h.player; if (p.alive && Math.hypot(p.x - fire.x, p.y - fire.y) <= ENV_BARREL.fireRadius + p.radius) p.takeDamage(Math.max(2, p.maxHp * ENV_BARREL.firePlayerRatio), now);
      for (const a of this.h.allies()) if (a.active && Math.hypot(a.x - fire.x, a.y - fire.y) <= ENV_BARREL.fireRadius + a.radius) this.h.hurtAlly(a, Math.max(2, a.maxHp * ENV_BARREL.firePlayerRatio));
    }
    for (let i = this.remains.length - 1; i >= 0; i--) { const r = this.remains[i]; if (now >= r.until) { r.img.destroy(); this.remains.splice(i, 1); } else if (r.until - now < 600) r.img.setAlpha((r.until - now) / 600); }
  }

  /** 军旗光环：旗在且敌人在半径内时的移速 / 伤害倍率。 */
  speedMul(e: Enemy): number { return this.inAura(e) ? ENV_BANNER.auraSpeed : 1; }
  damageMul(e: Enemy): number { return this.inAura(e) ? ENV_BANNER.auraDamage : 1; }
  private inAura(e: Enemy): boolean {
    if (e.isSupplySlot) return false;
    for (const b of this.banners) if (b.active && Math.abs(b.x - e.x) < ENV_BANNER.auraRadius && Math.abs(b.y - e.y) < ENV_BANNER.auraRadius && Math.hypot(b.x - e.x, b.y - e.y) <= ENV_BANNER.auraRadius) return true;
    return false;
  }
  get activeFires(): number { return this.fires.filter(f => f.active).length; }

  /** DEV / 测试：在主将附近放一个环境物件。 */
  spawnForTest(env: 'barrel' | 'banner' | 'tent', dx: number, dy: number): Enemy | null {
    const p = this.h.player, x = p.x + dx, y = p.y + dy, k = env === 'barrel' ? 'barrel' : env === 'banner' ? 'banner' : 'tent';
    const t = this.tex(k, env === 'barrel' ? F.barrel : env === 'banner' ? F.banner + this.cfg.faction : F.tent + this.cfg.faction);
    const o = env === 'barrel' ? { size: 64, hp: ENV_BARREL.hp, radius: 16, halfW: 14, halfH: 8 } : env === 'banner' ? { size: 128, hp: ENV_BANNER.hp, radius: 20, halfW: 9, halfH: 6, originY: .92 } : { size: 176, hp: ENV_TENT.hp, radius: 60, halfW: 56, halfH: 20, offsetY: -18 };
    const e = this.h.supplies.spawnEnvProp(env, `dev-${env}-${Math.round(x)},${Math.round(y)}-${now()}`, x, y, { ...t, ...o });
    if (env === 'banner' && e) this.banners.push(e);
    return e;
    function now(): number { return Math.round(performance.now()); }
  }

  destroy(): void { for (const f of this.fuses) f.img?.destroy(); for (const r of this.remains) r.img.destroy(); for (const f of this.fires) f.img.destroy(); this.fuses = []; this.remains = []; this.fires = []; }
}
