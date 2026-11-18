import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { playSheet } from './SkillFxSheets';
import { worldText } from '../world/WorldUI';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Ally } from '../entities/Ally';

/**
 * 第九章「水淹七军」洪水（数值 FLOOD，开发期初值，平衡之后再调）：
 * - 场地有界（左右上下碰撞框），场内有几座土丘高地和两条小船：站上去就不受水患；
 * - 到时先出预警（左侧水声、横幅、浪头在边缘蓄势），随后洪峰从左向右推进，漫过整个场地；
 * - 水里的敌人：被水流冲向下游、自身移动减慢、持续受伤（首领减半）；我方在水里：移速变慢、少量持续掉血（部曲同）；
 * - 漫场约 30 秒后退水，之后可再来一轮。
 * 美术：洪水手绘序列帧 xf_flood（6×3：洪峰前沿 / 冲击水花 / 漫场水面），场景物件 xf_props（土丘 / 小船 / 棺材 …）；缺图时用江岸地面染水色、扬尘序列帧过渡（写在下面）。
 */
export const FLOOD = {
  arena: { left: -900, right: 900, top: -700, bottom: 700 },
  firstAt: 35, // 第一轮洪水（秒，按本关已过时间）
  again: 75, // 退水后多久再来
  warnMs: 3500, speed: 340, holdMs: 30000, recedeMs: 2500,
  flowSpeed: 70, enemySlow: .45, enemyDps: 8, enemyPctDps: .03, bossMul: .5,
  playerSlow: .62, playerDps: 2.5, allyDps: 4,
  mounds: [{ x: -520, y: -330, rx: 150, ry: 80 }, { x: 430, y: -380, rx: 150, ry: 80 }, { x: -380, y: 380, rx: 150, ry: 80 }, { x: 520, y: 330, rx: 150, ry: 80 }, { x: 40, y: -40, rx: 120, ry: 66 }],
  boats: [{ x: -80, y: 470, rx: 70, ry: 34 }, { x: 760, y: -40, rx: 70, ry: 34 }],
} as const;
const FX = 'xf_flood', PROPS = 'xf_props';

export interface FloodHost {
  scene: Phaser.Scene; player: Player; allies: () => readonly Ally[]; enemies: () => readonly Enemy[]; now: () => number; elapsed: () => number;
  footprints: Array<{ left: number; right: number; top: number; bottom: number }>;
  hitEnemy: (e: Enemy, dmg: number) => void; hurtTroops: (x: number, y: number, r: number, dmg: number) => void;
  banner: (t: string, danger?: boolean, caption?: string) => void; sfx: (k: string) => void; boss: () => Enemy | null;
  onFlood?: () => void;
}
type State = 'dry' | 'warn' | 'rising' | 'full' | 'receding';

export class Flood {
  state: State = 'dry';
  readonly stats = { floods: 0, enemyTicks: 0, playerTicks: 0, pushed: 0 };
  private front: number = FLOOD.arena.left; private stateAt = 0; private nextAt: number = FLOOD.firstAt; private tickAt = 0;
  private water?: Phaser.GameObjects.TileSprite; private crest: Phaser.GameObjects.Image[] = []; private objects: Phaser.GameObjects.GameObject[] = [];
  private label?: Phaser.GameObjects.Text;

  constructor(private readonly h: FloodHost) {
    const a = FLOOD.arena;
    h.footprints.splice(0, h.footprints.length,
      { left: a.left - 600, right: a.left, top: a.top - 600, bottom: a.bottom + 600 }, { left: a.right, right: a.right + 600, top: a.top - 600, bottom: a.bottom + 600 },
      { left: a.left, right: a.right, top: a.top - 600, bottom: a.top }, { left: a.left, right: a.right, top: a.bottom, bottom: a.bottom + 600 });
    const sc = h.scene, v2 = sc.textures.exists(PROPS);
    this.buildBanks();
    // 高地 / 小船
    for (const m of FLOOD.mounds) this.img(m.x, m.y + m.ry * .55, v2 ? PROPS : 'art_props', v2 ? 0 : '2', m.rx * 2.2, m.rx * 2.2 * (v2 ? 1 : .8), DEPTH.ground + 3);
    for (const b of FLOOD.boats) this.img(b.x, b.y + b.ry * .6, v2 ? PROPS : 'yellow_props', v2 ? 1 : 24, b.rx * 2.4, b.rx * 2.4, DEPTH.ground + 3);
    // 河岸：右侧下游的断旗浮木只是装饰
    if (v2) { this.img(a.right - 60, a.top + 160, PROPS, 3, 200, 200); this.img(a.left + 80, a.bottom - 120, PROPS, 5, 150, 150); }
    // 水面：有洪水序列帧用第 3 行（漫场水面），没有用江岸地面染浑黄水色过渡
    const wKey = sc.textures.exists(FX) ? FX : sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE';
    this.water = sc.add.tileSprite(a.left, a.top, 1, a.bottom - a.top, wKey, wKey === FX ? 12 : undefined).setOrigin(0, 0).setDepth(DEPTH.ground + 2).setAlpha(0).setVisible(false);
    if (wKey !== FX) this.water.setTint(0x8a7a52);
    this.objects.push(this.water);
    this.label = worldText(sc, 0, 0, '', 15, '#cfe6ff').setOrigin(.5).setDepth(36).setStroke('#0d1620', 4).setVisible(false); this.objects.push(this.label);
  }
  /**
   * 场地边界看得见（全场景审查 C：原来四周碰撞框没有画面）：场地是汉水边的一块洼地，四面被暴涨的汉水围住——
   * 框外铺流动的江水（地形水面图 terrain_water，缺图用江岸地面染水色），沿边一圈泥岸。水面在地面层，不挡人物。
   */
  private banks: Phaser.GameObjects.TileSprite[] = [];
  private buildBanks() {
    const sc = this.h.scene, a = FLOOD.arena, T = 1400, B = 40;
    const wKey = sc.textures.exists('terrain_water') ? 'terrain_water' : sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE', bKey = sc.textures.exists('ground_v2_jiang') ? 'ground_v2_jiang' : '__WHITE';
    const rects = [[a.left - T, a.top - T, T, a.bottom - a.top + 2 * T], [a.right, a.top - T, T, a.bottom - a.top + 2 * T], [a.left, a.top - T, a.right - a.left, T], [a.left, a.bottom, a.right - a.left, T]];
    for (const [x, y, w, hh] of rects) { const ts = sc.add.tileSprite(x, y, w, hh, wKey).setOrigin(0, 0).setDepth(DEPTH.ground + 2).setName('flood-river'); if (wKey !== 'terrain_water') ts.setTint(0x6f7f74); this.banks.push(ts); this.objects.push(ts); }
    // 泥岸：沿场地边一圈（压在水面之上，像岸线）
    const edges = [[a.left - B / 2, a.top - B / 2, B, a.bottom - a.top + B], [a.right - B / 2, a.top - B / 2, B, a.bottom - a.top + B], [a.left - B / 2, a.top - B / 2, a.right - a.left + B, B], [a.left - B / 2, a.bottom - B / 2, a.right - a.left + B, B]];
    for (const [x, y, w, hh] of edges) this.objects.push(sc.add.tileSprite(x, y, w, hh, bKey).setOrigin(0, 0).setTint(0x5a4a30).setAlpha(.9).setDepth(DEPTH.ground + 2.5));
  }
  private img(x: number, y: number, key: string, frame: number | string, w: number, h: number, depth?: number) { const i = this.h.scene.add.image(x, y, key, frame).setOrigin(.5, 1).setDisplaySize(w, h).setDepth(depth ?? actorDepth(y)); this.objects.push(i); return i; }

  /** 是否站在高地或船上（椭圆内）。 */
  safeAt(x: number, y: number): boolean { for (const m of [...FLOOD.mounds, ...FLOOD.boats]) if (((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2 <= 1) return true; return false; }
  /** 该点是否在水里。 */
  wet(x: number, y: number): boolean { return (this.state === 'rising' || this.state === 'full' || this.state === 'receding') && x <= this.front && !this.safeAt(x, y); }
  get frontX() { return Math.round(this.front); }
  /** 强制下一轮洪水马上预警（测试 / 调试）。 */
  trigger() { if (this.state === 'dry') this.nextAt = 0; }

  update(dt: number) {
    const now = this.h.now(), el = this.h.elapsed(), a = FLOOD.arena, sc = this.h.scene, p = this.h.player;
    if (this.state === 'dry' && el >= this.nextAt) {
      this.state = 'warn'; this.stateAt = now; this.stats.floods++;
      this.h.banner('汉水暴涨！', true, '大水将从西面涌来 · 快上高地或小船'); this.h.sfx('bossSummon');
      this.spawnCrest(); this.front = a.left - 40;
    }
    if (this.state === 'warn') {
      // 浪头在左缘蓄势，越来越高
      const k = Math.min(1, (now - this.stateAt) / FLOOD.warnMs);
      this.layoutCrest(a.left - 20 + k * 30, .5 + k * .5, now);
      if (now - this.stateAt >= FLOOD.warnMs) { this.state = 'rising'; this.stateAt = now; this.water!.setVisible(true).setAlpha(.82); this.h.onFlood?.(); sc.cameras.main.shake(300, .004); }
    } else if (this.state === 'rising') {
      this.front = Math.min(a.right + 40, this.front + FLOOD.speed * dt);
      this.layoutCrest(this.front, 1, now);
      if (this.front >= a.right + 40) { this.state = 'full'; this.stateAt = now; for (const c of this.crest) c.setVisible(false); this.h.banner('七军被淹', false, '水中之敌被冲散 · 趁势掩杀'); }
    } else if (this.state === 'full') {
      if (now - this.stateAt >= FLOOD.holdMs) { this.state = 'receding'; this.stateAt = now; this.h.banner('水势渐退', false); }
    } else if (this.state === 'receding') {
      const k = Math.min(1, (now - this.stateAt) / FLOOD.recedeMs); this.water!.setAlpha(.82 * (1 - k));
      if (k >= 1) { this.state = 'dry'; this.water!.setVisible(false); this.front = a.left - 40; this.nextAt = el + FLOOD.again; }
    }
    if (this.water?.visible) {
      this.water.width = Math.max(1, Math.min(a.right, this.front) - a.left);
      if (this.water.texture.key === FX) this.water.setFrame(12 + Math.floor(now / 160) % 6); else this.water.tilePositionX -= FLOOD.flowSpeed * dt * .5;
    }
    for (const b of this.banks) b.tilePositionX -= FLOOD.flowSpeed * dt * .5; // 四周汉水向东流
    // 水患：每 0.5 秒结算一次伤害；推流每帧
    const tick = now >= this.tickAt; if (tick) this.tickAt = now + 500;
    const wetPlayer = this.wet(p.x, p.y);
    p.envSpeedMul = wetPlayer ? FLOOD.playerSlow : 1;
    if (tick && wetPlayer) { p.takeDamage(FLOOD.playerDps * .5, now); this.stats.playerTicks++; }
    if (tick && this.state !== 'dry' && this.state !== 'warn') for (const u of this.h.allies()) if (u.active && this.wet(u.x, u.y)) this.h.hurtTroops(u.x, u.y, 8, FLOOD.allyDps * .5);
    this.label?.setVisible(this.state === 'warn' || wetPlayer).setPosition(p.x, p.y - 110).setText(this.state === 'warn' ? '大水将至！' : '涉水 · 移速变慢');
    if (this.state === 'dry' || this.state === 'warn') return;
    const boss = this.h.boss();
    for (const e of this.h.enemies()) {
      if (!e.active || e.isSupplySlot || !this.wet(e.x, e.y)) continue;
      const mul = e === boss ? FLOOD.bossMul : 1;
      e.sprite.x += FLOOD.flowSpeed * mul * dt; e.sprite.y += Math.sin((e.uid * 7 + now / 300)) * 18 * dt; // 冲向下游
      this.stats.pushed++;
      if (tick) { this.h.hitEnemy(e, (FLOOD.enemyDps + e.maxHp * FLOOD.enemyPctDps) * .5 * mul); this.stats.enemyTicks++; if (Math.random() < .12) this.splash(e.x, e.y); }
    }
  }
  /** 敌兵在水里时自身移动的倍率（场景的寻路乘上它）。 */
  enemyMoveMul(e: Enemy): number { return this.wet(e.x, e.y) ? (e === this.h.boss() ? (1 + FLOOD.enemySlow) / 2 : FLOOD.enemySlow) : 1; }

  private spawnCrest() {
    const sc = this.h.scene, a = FLOOD.arena, n = Math.ceil((a.bottom - a.top) / 150) + 1;
    for (const c of this.crest) c.destroy(); this.crest = [];
    for (let i = 0; i < n; i++) {
      const y = a.top + i * 150;
      const im = sc.textures.exists(FX) ? sc.add.image(a.left, y, FX, 0) : sc.add.image(a.left, y, 'fx_collapse_dust', 0);
      im.setOrigin(.5, .8).setDisplaySize(200, 260).setDepth(actorDepth(y) + .5); if (!sc.textures.exists(FX)) im.setTint(0xb8c4c8);
      this.crest.push(im); this.objects.push(im);
    }
  }
  private layoutCrest(x: number, scale: number, now: number) {
    const fx = this.h.scene.textures.exists(FX);
    this.crest.forEach((c, i) => { c.setVisible(true).setPosition(x + (i % 2 ? 14 : -10), c.y).setScale(c.scaleX, c.scaleY).setDisplaySize(200 * scale, 260 * scale); if (fx) c.setFrame((Math.floor(now / 110) + i) % 6); else c.setFrame((Math.floor(now / 90) + i) % 6); });
  }
  private splash(x: number, y: number) {
    const sc = this.h.scene;
    if (sc.textures.exists(FX)) { const s = sc.add.image(x, y, FX, 6).setOrigin(.5, .75).setDisplaySize(110, 110).setDepth(DEPTH.fx); sc.tweens.addCounter({ from: 0, to: 5.99, duration: 420, onUpdate: t => s.setFrame(6 + Math.floor(t.getValue() ?? 0)), onComplete: () => s.destroy() }); }
    else playSheet(sc, 'fx_collapse_dust', x, y, { size: 80, depth: DEPTH.fx, ms: 380, alpha: .6 });
  }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; this.banks = []; this.crest = []; this.h.player.envSpeedMul = 1; }
}
