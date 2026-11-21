import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import { BATTLE_HEAL, HEAL_SPOT_ART, type HealSpotKind } from '../data/battleHeal';
import type { PhasePlan } from '../data/stagePhases';
import type { PropLootKind } from '../data/propLoot';
import type { Enemy } from '../entities/Enemy';
import { playSheet } from './SkillFxSheets';

/**
 * 战场回血（data/battleHeal.ts；用户 2026-11-19「我感觉地图上也需要更多回血手段」）：
 * - 干粮 / 酒肉：打破粮袋 / 粮车 / 米缸 / 木箱有概率掉，受伤时走近被吸过来吃掉（满血不捡）。
 * - 泉眼 / 水井（/ 药草丛）：站进圈里持续回血，一池水用完冷却；屏外有箭头。五段关首领段前补一处。
 * - 军中伤药：副将必掉、精锐概率掉（保底）；低血时附近放一份。拾取进药囊（BattlefieldSupplies.dropPotion）。
 * 美术：泉眼 / 水井用 scene-v2/waterpoints.png（手绘），干粮 / 酒肉先借营地道具图，回血特效用手绘 fx_heal_fushui。
 */
export interface BattleHealHost {
  scene: Phaser.Scene;
  player: () => { x: number; y: number; hp: number; maxHp: number; alive: boolean; heal(n: number): void };
  enemies: () => readonly Enemy[];
  elapsed: () => number;
  now: () => number;
  /** 场景可放东西的位置（夹进场地、避开水 / 树 / 墙）。 */
  place: (x: number, y: number) => { x: number; y: number };
  /** 往药囊那套地上药品里丢一份（拾取进药囊）；放不了返回 false。 */
  dropPotion: (x: number, y: number, amount: number, name: string, from?: { x: number; y: number }) => boolean;
  /** 画面被全屏面板挡着（屏外箭头先藏）。 */
  overlay: () => boolean;
  /** 主将当前移动方向（单位向量，站着为 null）：刷点不放在正前方。 */
  moveDir?: () => { x: number; y: number } | null;
  /** 地上 (x, y) 那份药还在吗（低血保护那份的屏外箭头用）。 */
  potionAt?: (x: number, y: number) => boolean;
  sfx: (key: string) => void;
  notice: (text: string) => void;
}
interface Food { img: Phaser.GameObjects.Image; x: number; y: number; until: number; ratio: number; name: string; active: boolean; flying: boolean; born: number; /** 从掉落处蹦到落点：起点与落地时刻。 */ sx: number; sy: number; landAt: number }
interface Spot {
  kind: HealSpotKind; x: number; y: number; img: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; ambAt?: number;
  arrow: Phaser.GameObjects.Container;
  /** 剩余水量（0–1，乘 spot.charge 的最大生命比例）；冷却到什么时刻（elapsed 秒）。 */
  left: number; readyAt: number; fxAt: number; boss: boolean;
}

export class BattleHeal {
  private readonly foods: Food[] = [];
  private spots: Spot[] = [];
  private schedule: Array<{ at: number; boss: boolean; fired: boolean }> = [];
  private eliteMiss = 0;
  private lowHpAt = -1e9;
  private lowHpUsed = 0;
  private wasLow = false;
  /** 测试 / 平衡用：各来源实际回了多少（最大生命比例累加）、发生次数。 */
  readonly stats = { food: 0, foodEaten: 0, foodDropped: 0, spot: 0, spotsSpawned: 0, spotUses: 0, medicineDropped: 0, lowHpDrops: 0, nudged: 0 };

  /** 画面里（留 pad 边）吗。 */
  private inView(x: number, y: number, pad: number = BATTLE_HEAL.drop.viewPad): boolean { const v = this.h.scene.cameras.main.worldView; return x > v.left + pad && x < v.right - pad && y > v.top + pad && y < v.bottom - pad; }
  /**
   * 掉落点：离主将不足 minDrop 时从掉落处往外蹦到 minDrop–minDrop+spread（方向 = 主将 → 掉落处，挪进画面里）；够远就落在原处。
   * 用户 11-20「关于战场上的回血不要一下子刷在角色脸上」。
   */
  landing(x: number, y: number): { x: number; y: number; moved: boolean } {
    const P = this.h.player(), D = BATTLE_HEAL.drop, d = Math.hypot(x - P.x, y - P.y);
    if (d >= D.minDrop) return { x, y, moved: false }; // 够远：就落在掉落源（尸体 / 营寨 / 道具）那里
    const a0 = d > 1 ? Math.atan2(y - P.y, x - P.x) : Math.random() * Math.PI * 2; // 从掉落源往外蹦（方向 = 主将 → 掉落源），不飞向主将
    this.stats.nudged++;
    return { ...this.findAround(a0, D.minDrop + 20, D.minDrop + D.spread + 40), moved: true }; // 留 20 的余量：主将被挤动一下也不会贴到 250 以内
  }
  /** 主将移动方向正前方 ±aheadDeg° 内吗（站着不算）。 */
  private ahead(x: number, y: number): boolean {
    const m = this.h.moveDir?.(); if (!m) return false; const P = this.h.player(), dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy) || 1;
    return (dx * m.x + dy * m.y) / d > Math.cos(BATTLE_HEAL.drop.aheadDeg * Math.PI / 180);
  }
  /**
   * 在主将周围找一点：夹进场地后实际离主将 min–max、不在移动方向正前方、优先画面里；从 a0 往两边转着试，几圈都不行取最好的。
   * extra：额外扣分（如离别的回血点太近、身边敌兵多）。
   */
  findAround(a0: number, min: number, max: number, extra?: (p: { x: number; y: number }) => number, preferView = true): { x: number; y: number } {
    const P = this.h.player(); let best: { x: number; y: number; s: number } | null = null;
    for (let ring = 0; ring < 3; ring++) for (const da of [0, .45, -.45, .9, -.9, 1.4, -1.4, 1.9, -1.9, 2.5, -2.5, Math.PI]) {
      const a = a0 + da, r = min + (ring === 0 ? Math.random() * (max - min) : ring * 60 + 10), p = this.h.place(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r), pd = Math.hypot(p.x - P.x, p.y - P.y);
      const s = (pd < min ? 3000 + (min - pd) * 20 : 0) + (pd > max + ring * 60 ? 200 : 0) + (this.ahead(p.x, p.y) ? 900 : 0) + (!preferView || this.inView(p.x, p.y, -40) ? 0 : 400) + (extra?.(p) ?? 0); // 远处的回血事件不求在画面里（屏外有箭头）；够不到 min 时分数最低的就是能到的最远处
      if (s === 0) return p;
      if (!best || s < best.s) best = { ...p, s };
    }
    return best!;
  }

  constructor(private readonly h: BattleHealHost) {
    const s = h.scene, W = HEAL_SPOT_ART.water;
    if (!s.textures.exists(W.key)) { s.load.spritesheet(W.key, W.file, { frameWidth: W.cell, frameHeight: W.cell }); if (!s.load.isLoading()) s.load.start(); }
  }

  /** 换关 / 开局：按段落排泉眼（五段关），否则按时间间隔排。 */
  setPlan(plan: PhasePlan | null): void {
    this.clearSpots(); this.schedule = []; this.lowHpUsed = 0; this.lowHpAt = -1e9; this.eliteMiss = 0;
    const S = BATTLE_HEAL.spot;
    if (plan) {
      const at = (k: string) => plan.phases.find(p => p.kind === k)?.start;
      const elite = at('elite'), event = at('event');
      if (elite !== undefined) this.schedule.push({ at: elite + S.elite, boss: false, fired: false });
      if (event !== undefined) this.schedule.push({ at: event + S.event, boss: false, fired: false });
      this.schedule.push({ at: Math.max(5, plan.bossAt - S.bossLead), boss: true, fired: false });
    } else for (let t = S.firstSec; t < 900; t += S.everySec) this.schedule.push({ at: t, boss: false, fired: false });
  }

  // —— 干粮 / 酒肉 ——
  /** 营地道具打碎（GameScene.propLoot 转来）：粮袋类掉干粮、木箱类掉酒肉（按概率）。 */
  onPropBroken(kind: PropLootKind, x: number, y: number, rng: () => number = Math.random): void {
    const F = BATTLE_HEAL.food, d = kind === 'grain' ? F.grain : kind === 'crate' || kind === 'coins' ? F.crate : null;
    if (!d || rng() >= d.chance) return;
    this.dropFood(x + 14, y + 12, d.ratio, d.name);
  }
  /** 放一份干粮 / 酒肉（从 x, y 掉出来；离主将太近就蹦远一点再落地）。 */
  dropFood(x: number, y: number, ratio: number, name: string): Food | null {
    const s = this.h.scene, F = BATTLE_HEAL.food;
    let f = this.foods.find(o => !o.active);
    if (!f) { if (this.foods.length >= F.max) return null; f = { img: s.add.image(0, 0, 'yellow_props', 16).setName('heal-food'), x: 0, y: 0, until: 0, ratio, name, active: false, flying: false, born: 0, sx: 0, sy: 0, landAt: 0 }; this.foods.push(f); }
    const grain = name === BATTLE_HEAL.food.grain.name;
    // 图：新图（heal_food 0 干粮 / 1 酒肉）到了用新图；先借营地粮袋（干粮）、酒葫芦（酒肉）
    if (s.textures.exists('heal_food')) f.img.setTexture('heal_food', grain ? 0 : 1).setDisplaySize(58, 58); // 物件约占格子六成宽
    else if (grain || !s.textures.exists('heal_props')) f.img.setTexture('yellow_props', 16).setDisplaySize(42, 42);
    else f.img.setTexture('heal_props', 2).setDisplaySize(36, 36);
    const at = this.landing(x, y), now = this.h.now();
    Object.assign(f, { x: at.x, y: at.y, sx: x, sy: y, landAt: at.moved ? now + BATTLE_HEAL.drop.hopMs : now, until: now + F.lifeMs, ratio, name, active: true, flying: false, born: now });
    f.img.setPosition(x, y).setOrigin(.5, f.img.texture.key === 'heal_food' ? .74 : .8).setAlpha(1).setVisible(true).setDepth(DEPTH.gem + 1);
    this.stats.foodDropped++;
    return f;
  }

  // —— 军中伤药 ——
  /** 精锐倒下：概率掉伤药，连续 pity 个没掉则必掉。 */
  onEliteDown(x: number, y: number, rng: () => number = Math.random): boolean {
    const M = BATTLE_HEAL.medicine;
    if (this.eliteMiss + 1 >= M.pity || rng() < M.chance) { this.eliteMiss = 0; return this.medicine(x, y, M.ratio); }
    this.eliteMiss++; return false;
  }
  /** 副将倒下：必掉一份（回得多一点）。 */
  onLieutenantDown(x: number, y: number): boolean { return this.medicine(x, y, BATTLE_HEAL.medicine.lieutenantRatio); }
  private medicine(x: number, y: number, ratio: number): boolean {
    // 落在尸体处；离主将太近就从尸体处蹦远一点（不飞到主将身上）
    const P = this.h.player(), at = this.landing(x, y + 10), ok = this.h.dropPotion(at.x, at.y, P.maxHp * ratio, BATTLE_HEAL.medicine.name, at.moved ? { x, y: y + 10 } : undefined);
    if (ok) this.stats.medicineDropped++;
    return ok;
  }

  // —— 泉眼 / 水井 ——
  /** 测试 / 调试：在主将旁边立刻放一处。 */
  forceSpot(dx = 160, dy = 0, kind?: HealSpotKind): Spot | null { const P = this.h.player(); return this.spawnSpot(P.x + dx, P.y + dy, false, kind); }
  get liveSpots(): readonly Spot[] { return this.spots; }

  private pickKind(): HealSpotKind {
    const s = this.h.scene, kinds: HealSpotKind[] = ['spring', 'well'];
    if (s.textures.exists(HEAL_SPOT_ART.herb.key)) kinds.push('herb');
    return kinds[Math.floor(Math.random() * kinds.length)];
  }
  /** 回血点刷点：离主将 300–480、不在移动方向正前方、优先画面里、不和别的回血点挤在一起。 */
  spotPoint(): { x: number; y: number } {
    const S = BATTLE_HEAL.spot;
    return this.findAround(Math.random() * Math.PI * 2, S.near, S.far, p => this.spots.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 260) ? 500 : 0, false);
  }
  private spawnSpot(x: number, y: number, boss: boolean, kind = this.pickKind()): Spot | null {
    const s = this.h.scene, W = HEAL_SPOT_ART.water;
    const water = s.textures.exists(W.key), herb = kind === 'herb' && s.textures.exists(HEAL_SPOT_ART.herb.key);
    if (!water && !herb) return null; // 图还没载到：这一处先不放（不画替代图形）
    if (this.spots.length >= BATTLE_HEAL.spot.maxLive) this.removeSpot(this.spots[0]);
    if (kind === 'herb' && !herb) kind = 'spring';
    const img = kind === 'herb' ? s.add.image(x, y, HEAL_SPOT_ART.herb.key, 0).setOrigin(.5, .62).setDisplaySize(176, 176).setDepth(DEPTH.ground + 3) // 药草丛贴地：碎石圈中心对着回血圈
      : kind === 'well' ? s.add.image(x, y, W.key, 2).setOrigin(.5, .82).setDisplaySize(150, 150).setDepth(actorDepth(y))
        : s.add.image(x, y, W.key, 0).setOrigin(.5, .55).setDisplaySize(170, 170).setDepth(DEPTH.ground + 3);
    img.setName('heal-spot-' + kind);
    // 水井立着：回血范围在井前（往下挪）；泉眼平铺：就在泉上。不写名签（用户 11-20「不需要文字说明」）：可用时水面泛手绘微光，冷却时变暗
    const cy = kind === 'well' ? y + 52 : y;
    const ring = s.add.graphics().setDepth(DEPTH.ground + 3.5).setName('heal-spot-ring');
    const spot: Spot = { kind, x, y: cy, img, ring, arrow: this.makeArrow(), left: 1, readyAt: 0, fxAt: 0, boss };
    this.spots.push(spot); this.stats.spotsSpawned++;
    this.tipOnce();
    return spot;
  }
  private removeSpot(sp: Spot): void { sp.img.destroy(); sp.ring.destroy(); sp.arrow.destroy(); this.spots = this.spots.filter(o => o !== sp); }
  /** 第一次见到回血点：只提示一次（整个存档一次，记在 localStorage）。 */
  private tipOnce(): void {
    const K = 'im_tip_heal_spot'; let seen = false;
    try { seen = localStorage.getItem(K) === '1'; if (!seen) localStorage.setItem(K, '1'); } catch { seen = this.tipShown; }
    if (seen || this.tipShown) return; this.tipShown = true; this.h.notice('泉眼 / 水井 / 药草丛：站上去回血');
  }
  private tipShown = false;
  private clearSpots(): void { for (const sp of [...this.spots]) this.removeSpot(sp); }

  private makeArrow(): Phaser.GameObjects.Container {
    const s = this.h.scene, g = s.add.graphics().setName('ha-g'), parts: Phaser.GameObjects.GameObject[] = [g];
    if (s.textures.exists('growth_icon_recovery')) parts.push(s.add.image(0, 0, 'growth_icon_recovery').setDisplaySize(24, 24));
    parts.push(s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#c8ffd8', resolution: 2, stroke: '#08180e', strokeThickness: 4 }).setOrigin(.5).setName('ha-text'));
    return s.add.container(0, 0, parts).setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('heal-spot-arrow').setVisible(false);
  }
  /** 屏外箭头（同机缘箭头的版式，换成青绿色；只有图标 + 距离数字，不写字）：只在受伤、泉眼可用、又看不到它时出。 */
  private drawArrow(sp: Spot, show: boolean): void { this.drawArrowAt(sp.arrow, sp.x, sp.y, show); }
  private drawArrowAt(arrow: Phaser.GameObjects.Container, x: number, y: number, show: boolean): void {
    const sp = { x, y, arrow };
    if (!show || this.h.overlay()) { sp.arrow.setVisible(false); return; }
    const cam = this.h.scene.cameras.main, v = cam.worldView, kx = GAME_WIDTH / v.width, ky = GAME_HEIGHT / v.height;
    const sx = (sp.x - v.x) * kx, sy = (sp.y - v.y) * ky, pad = 40;
    if (sx >= pad && sy >= pad && sx <= GAME_WIDTH - pad && sy <= GAME_HEIGHT - pad) { sp.arrow.setVisible(false); return; }
    const top = 100, bottom = GAME_HEIGHT - 100, left = 48, right = GAME_WIDTH - 110, cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2, a = Math.atan2(sy - cy, sx - cx), dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity);
    let ax = cx + dx * t; const ay = cy + dy * t;
    if (ax < 250 && ay < 260) ax = 250; // 左上角是主将血条：让开
    sp.arrow.setPosition(ax, ay).setVisible(true);
    const g = sp.arrow.getByName('ha-g') as Phaser.GameObjects.Graphics;
    g.clear().fillStyle(0x08180e, .6).fillCircle(0, 0, 17).lineStyle(1.5, 0x9be8b4, .95).strokeCircle(0, 0, 17)
      .fillStyle(0x7fe0a0, 1).fillTriangle(dx * 26, dy * 26, Math.cos(a + 2.6) * 10 + dx * 18, Math.sin(a + 2.6) * 10 + dy * 18, Math.cos(a - 2.6) * 10 + dx * 18, Math.sin(a - 2.6) * 10 + dy * 18);
    const P = this.h.player(), d = Math.round(Math.hypot(sp.x - P.x, sp.y - P.y));
    (sp.arrow.getByName('ha-text') as Phaser.GameObjects.Text).setText(String(d)).setPosition(-dx * 46, -dy * 30 + (Math.abs(dy) < .5 ? 22 : 0));
  }

  // —— 低血保护 ——
  /** 低血保护放的那份药（还在地上时屏外有箭头）。 */
  private lowPot: { x: number; y: number } | null = null; private lowArrow: Phaser.GameObjects.Container | null = null;
  private lowHpCheck(t: number): void {
    const P = this.h.player(), L = BATTLE_HEAL.lowHp, low = P.alive && P.hp < P.maxHp * L.below;
    if (low && !this.wasLow && this.lowHpUsed < L.perStage && t - this.lowHpAt >= L.cooldownSec) {
      // 往敌人最少的方向放（试 8 个方向，数 140 内的敌兵）；夹进场地后实际距离要在 minDrop–maxDrop、在画面里（不落在主将身上、也不跑出屏幕）
      // 离主将 260–330、不在移动方向正前方、画面里、敌兵少的方向（夹进场地后的实际距离）
      const crowd = (p: { x: number; y: number }) => { let n = 0; for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && Math.abs(e.x - p.x) < 140 && Math.abs(e.y - p.y) < 140) n++; return n * 15; };
      const best = this.findAround(Math.random() * Math.PI * 2, L.dist[0], L.dist[1], crowd, false);
      if (best && this.h.dropPotion(best.x, best.y, P.maxHp * L.ratio, BATTLE_HEAL.medicine.name)) {
        this.lowHpAt = t; this.lowHpUsed++; this.stats.lowHpDrops++; this.lowPot = { x: best.x, y: best.y }; // 不打字：落点泛一下手绘符水光
        playSheet(this.h.scene, 'fx_heal_fushui', best.x, best.y - 10, { size: 70, depth: actorDepth(best.y) + .05, ms: 700, alpha: .8, tint: 0xbff0c0 });
      }
    }
    this.wasLow = low;
  }

  update(dt: number, bossOn: boolean): void {
    const t = this.h.elapsed(), now = this.h.now(), P = this.h.player(), F = BATTLE_HEAL.food, S = BATTLE_HEAL.spot;
    const hurt = P.alive && P.hp < P.maxHp - .5;
    // 排好的泉眼：首领那一处在首领段前出；其余首领出场后不再刷
    for (const e of this.schedule) if (!e.fired && t >= e.at && (e.boss || !bossOn)) { e.fired = true; const p = this.spotPoint(); this.spawnSpot(p.x, p.y, e.boss); }
    // 干粮 / 酒肉
    for (const f of this.foods) {
      if (!f.active) continue;
      if (now >= f.until) { f.active = false; f.img.setVisible(false); continue; }
      if (now < f.landAt) { const k = 1 - (f.landAt - now) / BATTLE_HEAL.drop.hopMs; f.img.setPosition(f.sx + (f.x - f.sx) * k, f.sy + (f.y - f.sy) * k - Math.sin(k * Math.PI) * 46); continue; } // 从掉落处蹦出去
      const d = Math.hypot(P.x - f.x, P.y - f.y);
      if (hurt && (f.flying || d < F.magnetR)) {
        f.flying = true; const step = Math.min(d, F.flySpeed * dt); f.x += (P.x - f.x) / (d || 1) * step; f.y += (P.y - 10 - f.y) / (d || 1) * step;
        if (d <= F.eatR) {
          const amount = P.maxHp * f.ratio; P.heal(amount); this.stats.food += f.ratio; this.stats.foodEaten++;
          f.active = false; f.img.setVisible(false); this.h.sfx('healPickup');
          playSheet(this.h.scene, 'fx_heal_fushui', P.x, P.y - 16, { size: 64, depth: actorDepth(P.y) + .1, ms: 520, alpha: .85, tint: 0xd8ffc8 });
          continue;
        }
      } else f.flying = false;
      const bob = f.flying ? 0 : Math.sin((now - f.born) / 260) * 3, left = f.until - now;
      f.img.setPosition(f.x, f.y + bob).setAlpha(left < 3000 ? (Math.floor(left / 200) % 2 ? .35 : 1) : 1).setDepth(DEPTH.gem + 1);
    }
    // 泉眼 / 水井
    for (const sp of this.spots) {
      const ready = t >= sp.readyAt;
      if (ready && sp.left <= 0) sp.left = 1; // 冷却完：水满了
      const inside = P.alive && Math.hypot(P.x - sp.x, (P.y - sp.y) / .72) <= S.radius;
      let using = false;
      if (ready && inside && hurt && sp.left > 0) {
        using = true;
        const want = Math.min(S.rate * dt, sp.left * S.charge, (P.maxHp - P.hp) / P.maxHp);
        P.heal(want * P.maxHp); sp.left -= want / S.charge; this.stats.spot += want; this.h.sfx('heal_spring'); // 站着回血：咕嘟水声（自带 1.2 秒节流）
        if (now >= sp.fxAt) { sp.fxAt = now + 650; playSheet(this.h.scene, 'fx_heal_fushui', P.x, P.y - 14, { size: 84, depth: actorDepth(P.y) + .1, ms: 640, alpha: .8, tint: 0xbff0e0 }); }
        if (sp.left <= .001) { sp.left = 0; sp.readyAt = t + S.cooldownSec; this.stats.spotUses++; this.h.sfx('pickup'); } // 水用完：变暗（不打字）
      }
      const cool = !ready, R = S.radius, pulse = .45 + .25 * Math.sin(t * 3.4);
      sp.img.setTint(cool ? 0x7f8a90 : 0xffffff).setAlpha(cool ? .82 : 1);
      if (sp.kind === 'herb') sp.img.setFrame(cool ? 1 : 0);
      // 用户 2026-11-20「不要这些圈 / 或者换个特效」：不画地面圈和进度弧，改为水面上偶尔泛起手绘符水微光（可用时），剩余水量写在名签上
      sp.ring.clear();
      if (!cool && !using && now >= (sp.ambAt ?? 0)) { sp.ambAt = now + 1700; playSheet(this.h.scene, 'fx_heal_fushui', sp.x, sp.y - 6, { size: Math.round(R * 1.1), depth: DEPTH.ground + 3.6, ms: 900, alpha: .45, tint: 0xbff0e0 }); }
      this.drawArrow(sp, ready && P.alive && P.hp < P.maxHp); // 刷远了（450–700）：可用、在屏外就给箭头（满血不出）
    }
    this.lowHpCheck(t);
    if (this.lowPot && !(this.h.potionAt?.(this.lowPot.x, this.lowPot.y) ?? false)) this.lowPot = null; // 捡了 / 没了
    if (this.lowPot) { this.lowArrow ??= this.makeArrow(); this.drawArrowAt(this.lowArrow, this.lowPot.x, this.lowPot.y, P.alive); } else this.lowArrow?.setVisible(false);
  }

  clear(): void {
    this.clearSpots(); this.schedule = []; this.lowPot = null; this.lowArrow?.destroy(); this.lowArrow = null;
    for (const f of this.foods) { f.active = false; f.img.setVisible(false); }
  }
}
