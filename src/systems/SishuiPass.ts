import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyKind } from '../types';
import { DEPTH, actorDepth } from '../config';
import { MID_SIEGE_FILES } from './SiegeMidArt';
import { Strikes } from './BeifaSystems';
import { playSheet } from './SkillFxSheets';

/**
 * 2-1 汜水关（用户 2026-11-18：「这里障碍物很奇怪也没什么用联动和这章节，设计一下」）：
 *  - 关墙横在开局北面（城墙段铺一条），关门居中，门两侧两座箭楼；西凉营帐集中在关前两翼（敌军出兵方向），不再散落在战场中间。
 *  - 箭楼：城头弓手定时朝主将放一轮箭雨（手绘预警圈），可打塌（换毁坏帧）；塌了箭雨停，掉战功（记一名精英）并给主将短时攻击加成。
 *  - 西凉营帐：「西凉列阵」波起，每顶定时出两骑西凉铁骑；打塌后（扬尘 + 余火）这处不再出兵；全塌后本关余下刷兵变稀。
 *  - 关门：前半关紧闭；华雄出阵时关门洞开（城门倒塌序列帧），华雄带亲卫从门里杀出。
 *  - 温酒斩华雄：关羽为主将或随行，华雄出关 30 秒内斩之 → 「温酒斩华雄」，战功加赏（记两名首领）。
 * 美术全部复用：攻城 v2 城墙图集（城墙段 / 城门 / 城门破 / 箭楼 / 箭楼毁）、城门倒塌序列帧、西凉营寨道具（营帐走环境互动的可破坏营帐）。数值初值，交平衡会话。
 */
export const SISHUI_PASS = {
  wallY: -440, wallHalf: 1250, segW: 230, gateW: 270, towerX: 250, towerHp: 420,
  volleyEverySec: 6.5, volleyPoints: 3, volleyR: 68, warnMs: 1300, playerRatio: .05, allyDamage: 12,
  buffMul: 1.2, buffSec: 12,
  tents: [[-560, -300], [-820, -250], [560, -300], [820, -250]] as const, tentHp: 260, tentEverySec: 9, tentRiders: 2,
  thinMul: 1.35, wenjiuSec: 30, guards: 4,
} as const;

export interface PassHost {
  scene: Phaser.Scene; player: Player; legion: Legion; now: () => number; elapsed: () => number;
  /** 当前第几波（0 起）。 */ wave: () => number;
  spawn: (k: EnemyKind, x: number, y: number) => Enemy | null;
  spawnTower: (x: number, y: number, hp: number) => Enemy | null;
  placeTent: (x: number, y: number, id: string, hp: number) => Enemy | null;
  envReady: () => boolean;
  banner: (t: string, danger: boolean, c?: string) => void; sfx: (k: string) => void;
  /** 战功：记几名精英 / 首领（结算时按击杀折算）。 */ merit: (elite: number, boss: number) => void;
  /** 关羽在不在队（主将或随行）。 */ guanyu: () => boolean;
}

export class SishuiPass {
  readonly footprints: { left: number; right: number; top: number; bottom: number }[] = [];
  private gateFoot: { left: number; right: number; top: number; bottom: number };
  private art: Phaser.GameObjects.Image[] = []; private gateImg: Phaser.GameObjects.Image | null = null;
  towers: { e: Enemy | null; x: number; y: number; at: number; down: boolean }[] = [];
  tents: { e: Enemy | null; x: number; y: number; at: number; down: boolean }[] = [];
  private tentsPlaced = false; private allTentsDown = false;
  private strikes: Strikes; private buffUntil = 0; private buffed = false;
  gateOpen = false; bossAt = -1; wenjiu = false;
  readonly metrics = { volleys: 0, towersDown: 0, rides: 0, tentsDown: 0 };
  constructor(private h: PassHost) {
    const P = SISHUI_PASS, p = h.player, wy = p.y + P.wallY;
    // 关墙碰撞：左右两段城墙 + 关门（开门后移除）
    this.footprints.push({ left: p.x - P.wallHalf, right: p.x - P.gateW / 2, top: wy - 70, bottom: wy - 10 }, { left: p.x + P.gateW / 2, right: p.x + P.wallHalf, top: wy - 70, bottom: wy - 10 });
    this.gateFoot = { left: p.x - P.gateW / 2, right: p.x + P.gateW / 2, top: wy - 70, bottom: wy - 10 }; this.footprints.push(this.gateFoot);
    this.strikes = new Strikes({ scene: h.scene, player: p, army: h.legion, now: h.now });
    const s = h.scene, wall = MID_SIEGE_FILES[0];
    if (s.textures.exists(wall.key)) this.build(); else { s.load.spritesheet(wall.key, wall.file, { frameWidth: wall.cell, frameHeight: wall.cell }); s.load.once('filecomplete-spritesheet-' + wall.key, () => this.build()); if (!s.load.isLoading()) s.load.start(); }
  }
  /** 关墙 / 关门 / 箭楼（城墙图集：0 城墙段 · 1 城门 · 2 城门破 · 3 箭楼 · 4 箭楼毁）。 */
  private build(): void {
    const P = SISHUI_PASS, s = this.h.scene, p = this.h.player, wy = p.y + P.wallY, K = MID_SIEGE_FILES[0].key;
    for (let x = -P.wallHalf + P.segW / 2; x <= P.wallHalf; x += P.segW) { if (Math.abs(x) < P.gateW / 2 + P.segW / 2 - 10) continue; this.art.push(s.add.image(p.x + x, wy, K, 0).setOrigin(.5, .97).setDisplaySize(P.segW + 8, P.segW + 8).setDepth(actorDepth(wy) - .01).setName('sishui-wall')); }
    this.gateImg = s.add.image(p.x, wy + 2, K, 1).setOrigin(.5, .97).setDisplaySize(P.gateW + 30, P.gateW + 30).setDepth(actorDepth(wy)).setName('sishui-gate');
    for (const side of [-1, 1]) {
      const x = p.x + side * P.towerX, y = wy + 18, e = this.h.spawnTower(x, y, P.towerHp);
      e?.sprite.setTexture(K, 3).setOrigin(.5, .97).setDisplaySize(170, 170);
      this.towers.push({ e, x, y, at: this.h.now() + 4000 + (side > 0 ? 1800 : 0), down: false });
    }
  }
  /** 每帧（战斗中）。 */
  update(): void {
    const now = this.h.now(), P = SISHUI_PASS, p = this.h.player;
    this.strikes.update();
    if (!this.tentsPlaced && this.h.envReady()) { this.tentsPlaced = true; P.tents.forEach(([dx, dy], i) => { const x = p.x + dx, y = p.y + dy, e = this.h.placeTent(x, y, `fixed-sishui-tent-${i}`, P.tentHp); this.tents.push({ e, x, y, at: 0, down: !e }); }); }
    // 箭楼：放箭雨；被打塌换毁坏帧、掉战功、主将短时攻击加成
    for (const t of this.towers) {
      if (t.down) continue;
      if (t.e && !t.e.active) { t.down = true; this.metrics.towersDown++; this.towerDown(t); continue; }
      if (now >= t.at) { t.at = now + P.volleyEverySec * 1000; this.metrics.volleys++; for (let k = 0; k < P.volleyPoints; k++) { const a = Math.random() * Math.PI * 2, r = k === 0 ? 0 : 60 + Math.random() * 90; this.strikes.add('arrows', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * .7, P.volleyR, P.warnMs, P.playerRatio, P.allyDamage); } this.h.sfx('chargeWarn'); }
    }
    // 西凉营帐：「西凉列阵」（第 2 波）起每顶定时出骑；打塌后余火、不再出兵；全塌后余下刷兵变稀
    for (const t of this.tents) {
      if (t.down) continue;
      if (t.e && !t.e.active) { t.down = true; this.metrics.tentsDown++; playSheet(this.h.scene, 'fx_ground_fire', t.x, t.y + 6, { size: 150, ms: 1400, depth: actorDepth(t.y) + .2, originY: .8, name: 'sishui-tent-fire' }); this.h.banner('西凉营帐已焚', false, this.tents.every(x => x.down) ? '' : '此处不再出骑'); continue; }
      if (this.h.wave() >= 1 && !this.gateOpen) { if (!t.at) t.at = now + 1500 + this.tents.indexOf(t) * 900; if (now >= t.at) { t.at = now + P.tentEverySec * 1000; for (let k = 0; k < P.tentRiders; k++) if (this.h.spawn('cavalry', t.x + (k ? 40 : -40), t.y + 50)) this.metrics.rides++; } }
    }
    if (!this.allTentsDown && this.tents.length && this.tents.every(t => t.down)) { this.allTentsDown = true; this.h.banner('西凉营寨尽毁', true, '敌军后继乏力 · 余下来兵变稀'); }
    if (this.buffed && now >= this.buffUntil) { this.buffed = false; p.stats.damageMul /= P.buffMul; }
  }
  /** 刷兵间隔倍率（GameScene.updateSpawner）：营帐全塌后变稀。 */
  get spawnMul(): number { return this.allTentsDown ? SISHUI_PASS.thinMul : 1; }
  private towerDown(t: { x: number; y: number }): void {
    const s = this.h.scene, P = SISHUI_PASS, K = MID_SIEGE_FILES[0].key;
    if (s.textures.exists(K)) this.art.push(s.add.image(t.x, t.y, K, 4).setOrigin(.5, .97).setDisplaySize(170, 170).setDepth(actorDepth(t.y)).setName('sishui-tower-ruin'));
    playSheet(s, 'fx_collapse_dust', t.x, t.y, { size: 210, ms: 650, depth: DEPTH.fx, originY: .8, name: 'sishui-tower-dust' });
    s.cameras.main.shake(140, .004);
    this.h.merit(1, 0);
    if (!this.buffed) { this.buffed = true; this.h.player.stats.damageMul *= P.buffMul; }
    this.buffUntil = this.h.now() + P.buffSec * 1000;
    this.h.banner('箭楼已毁', false, `箭雨停了 · 战功 +1 · 攻击 +${Math.round((P.buffMul - 1) * 100)}%（${P.buffSec} 秒）`);
  }
  /** 华雄出阵：关门洞开（城门倒塌序列帧），华雄带亲卫从门里杀出。 */
  onBoss(boss: Enemy): void {
    const s = this.h.scene, P = SISHUI_PASS, p = this.h.player, gx = this.gateImg?.x ?? p.x, gy = (this.gateImg?.y ?? p.y + P.wallY) + 40;
    this.gateOpen = true; this.bossAt = this.h.now();
    const i = this.footprints.indexOf(this.gateFoot); if (i >= 0) this.footprints.splice(i, 1);
    this.gateImg?.setFrame(2);
    const fx = MID_SIEGE_FILES[1].key;
    if (s.textures.exists(fx)) { const img = s.add.image(gx, gy - 40, fx, 0).setOrigin(.5, .9).setDisplaySize(P.gateW + 40, P.gateW + 40).setDepth(DEPTH.fx); const t0 = s.time.now, run = (): void => { const k = Math.floor((s.time.now - t0) / 80); if (k >= 8 || !img.active) { s.events.off('postupdate', run); img.destroy(); return; } img.setFrame(k); }; s.events.on('postupdate', run); }
    else playSheet(s, 'fx_collapse_dust', gx, gy, { size: 260, ms: 700, depth: DEPTH.fx, originY: .8, name: 'sishui-gate-dust' });
    s.cameras.main.shake(260, .007);
    boss.sprite.x = gx; boss.sprite.y = gy;
    for (let k = 0; k < P.guards; k++) this.h.spawn('elite', gx + (k - (P.guards - 1) / 2) * 70, gy + 30 + (k % 2) * 30);
    this.h.banner('关门洞开', true, this.h.guanyu() ? `华雄出关 · ${P.wenjiuSec} 秒内斩之，可成「温酒斩华雄」` : '华雄率亲卫杀出汜水关');
  }
  /** 华雄被斩：关羽在队且出关 30 秒内 → 温酒斩华雄。 */
  onBossDown(): void {
    if (this.bossAt < 0 || this.wenjiu) return;
    if (this.h.guanyu() && this.h.now() - this.bossAt <= SISHUI_PASS.wenjiuSec * 1000) { this.wenjiu = true; this.h.merit(0, 2); this.h.banner('温酒斩华雄', true, '其酒尚温 · 战功加赏'); this.h.sfx('gong'); }
  }
  snapshot() { return { gateOpen: this.gateOpen, towers: this.towers.filter(t => !t.down).length, tents: this.tents.filter(t => !t.down).length, tentsPlaced: this.tentsPlaced, spawnMul: this.spawnMul, buffed: this.buffed, wenjiu: this.wenjiu, foot: this.footprints.length, metrics: { ...this.metrics }, pending: this.strikes.pending }; }
  clear(): void { for (const a of this.art) a.destroy(); this.gateImg?.destroy(); this.strikes.clear(); if (this.buffed) { this.buffed = false; this.h.player.stats.damageMul /= SISHUI_PASS.buffMul; } }
}
