import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import { BATTLE_HEAL, HEAL_SPOT_ART, HEAL_SPOT_NAME, type HealSpotKind } from '../data/battleHeal';
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
  dropPotion: (x: number, y: number, amount: number, name: string) => boolean;
  /** 画面被全屏面板挡着（屏外箭头先藏）。 */
  overlay: () => boolean;
  sfx: (key: string) => void;
  notice: (text: string) => void;
}
interface Food { img: Phaser.GameObjects.Image; x: number; y: number; until: number; ratio: number; name: string; active: boolean; flying: boolean; born: number }
interface Spot {
  kind: HealSpotKind; x: number; y: number; img: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text;
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
  readonly stats = { food: 0, foodEaten: 0, foodDropped: 0, spot: 0, spotsSpawned: 0, spotUses: 0, medicineDropped: 0, lowHpDrops: 0 };

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
  dropFood(x: number, y: number, ratio: number, name: string): Food | null {
    const s = this.h.scene, F = BATTLE_HEAL.food;
    let f = this.foods.find(o => !o.active);
    if (!f) { if (this.foods.length >= F.max) return null; f = { img: s.add.image(0, 0, 'yellow_props', 16).setName('heal-food'), x: 0, y: 0, until: 0, ratio, name, active: false, flying: false, born: 0 }; this.foods.push(f); }
    const grain = name === BATTLE_HEAL.food.grain.name;
    // 图：新图（heal_food 0 干粮 / 1 酒肉）到了用新图；先借营地粮袋（干粮）、酒葫芦（酒肉）
    if (s.textures.exists('heal_food')) f.img.setTexture('heal_food', grain ? 0 : 1).setDisplaySize(40, 40);
    else if (grain || !s.textures.exists('heal_props')) f.img.setTexture('yellow_props', 16).setDisplaySize(42, 42);
    else f.img.setTexture('heal_props', 2).setDisplaySize(36, 36);
    Object.assign(f, { x, y, until: this.h.now() + F.lifeMs, ratio, name, active: true, flying: false, born: this.h.now() });
    f.img.setPosition(x, y).setOrigin(.5, .8).setAlpha(1).setVisible(true).setDepth(DEPTH.gem + 1);
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
    const P = this.h.player(), ok = this.h.dropPotion(x, y + 10, P.maxHp * ratio, BATTLE_HEAL.medicine.name);
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
  private spotPoint(): { x: number; y: number } {
    const P = this.h.player(), S = BATTLE_HEAL.spot, a0 = Math.random() * Math.PI * 2;
    let best: { x: number; y: number; score: number } | null = null;
    for (let i = 0; i < 12; i++) {
      const a = a0 + i / 12 * Math.PI * 2, r = S.near + Math.random() * (S.far - S.near), p = this.h.place(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r);
      const d = Math.hypot(p.x - P.x, p.y - P.y), clash = this.spots.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 260);
      const score = (d >= S.near * .6 && d <= S.far * 1.2 ? 0 : 1000) + (clash ? 500 : 0) + Math.abs(d - (S.near + S.far) / 2) * .1;
      if (!best || score < best.score) best = { ...p, score };
    }
    return best!;
  }
  private spawnSpot(x: number, y: number, boss: boolean, kind = this.pickKind()): Spot | null {
    const s = this.h.scene, W = HEAL_SPOT_ART.water;
    const water = s.textures.exists(W.key), herb = kind === 'herb' && s.textures.exists(HEAL_SPOT_ART.herb.key);
    if (!water && !herb) return null; // 图还没载到：这一处先不放（不画替代图形）
    if (this.spots.length >= BATTLE_HEAL.spot.maxLive) this.removeSpot(this.spots[0]);
    if (kind === 'herb' && !herb) kind = 'spring';
    const img = kind === 'herb' ? s.add.image(x, y, HEAL_SPOT_ART.herb.key, 0).setOrigin(.5, .7).setDisplaySize(150, 150).setDepth(actorDepth(y))
      : kind === 'well' ? s.add.image(x, y, W.key, 2).setOrigin(.5, .82).setDisplaySize(150, 150).setDepth(actorDepth(y))
        : s.add.image(x, y, W.key, 0).setOrigin(.5, .55).setDisplaySize(170, 170).setDepth(DEPTH.ground + 3);
    img.setName('heal-spot-' + kind);
    // 水井立着：圈画在井前（往下挪）；泉眼平铺：圈就在泉上
    const cy = kind === 'well' ? y + 52 : y;
    const ring = s.add.graphics().setDepth(DEPTH.ground + 3.5).setName('heal-spot-ring');
    // 字：泉眼写在泉下面（主将站在泉上，头顶是「主将」名牌），水井 / 药草丛写在上面
    const label = s.add.text(x, kind === 'spring' ? y + 74 : y - 132, '', { fontFamily: FONT, fontSize: '13px', color: '#c8ffd8', align: 'center', resolution: 2, stroke: '#08180e', strokeThickness: 4 }).setOrigin(.5, kind === 'spring' ? 0 : 1).setDepth(DEPTH.dmgText - 2).setName('heal-spot-label');
    const spot: Spot = { kind, x, y: cy, img, ring, label, arrow: this.makeArrow(), left: 1, readyAt: 0, fxAt: 0, boss };
    this.spots.push(spot); this.stats.spotsSpawned++;
    return spot;
  }
  private removeSpot(sp: Spot): void { sp.img.destroy(); sp.ring.destroy(); sp.label.destroy(); sp.arrow.destroy(); this.spots = this.spots.filter(o => o !== sp); }
  private clearSpots(): void { for (const sp of [...this.spots]) this.removeSpot(sp); }

  private makeArrow(): Phaser.GameObjects.Container {
    const s = this.h.scene, g = s.add.graphics().setName('ha-g'), parts: Phaser.GameObjects.GameObject[] = [g];
    if (s.textures.exists('growth_icon_recovery')) parts.push(s.add.image(0, 0, 'growth_icon_recovery').setDisplaySize(24, 24));
    parts.push(s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#c8ffd8', resolution: 2, stroke: '#08180e', strokeThickness: 4 }).setOrigin(.5).setName('ha-text'));
    return s.add.container(0, 0, parts).setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('heal-spot-arrow').setVisible(false);
  }
  /** 屏外箭头（同机缘箭头的版式，换成青绿色）：只在受伤、泉眼可用、又看不到它时出。 */
  private drawArrow(sp: Spot, show: boolean): void {
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
    (sp.arrow.getByName('ha-text') as Phaser.GameObjects.Text).setText(HEAL_SPOT_NAME[sp.kind] + ' · ' + d + ' 步').setPosition(-dx * 46, -dy * 30 + (Math.abs(dy) < .5 ? 22 : 0));
  }

  // —— 低血保护 ——
  private lowHpCheck(t: number): void {
    const P = this.h.player(), L = BATTLE_HEAL.lowHp, low = P.alive && P.hp < P.maxHp * L.below;
    if (low && !this.wasLow && this.lowHpUsed < L.perStage && t - this.lowHpAt >= L.cooldownSec) {
      // 往敌人最少的方向放（试 8 个方向，数 140 内的敌兵）
      let best: { x: number; y: number; n: number } | null = null;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, r = L.dist[0] + Math.random() * (L.dist[1] - L.dist[0]), p = this.h.place(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r);
        let n = 0; for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && Math.abs(e.x - p.x) < 140 && Math.abs(e.y - p.y) < 140) n++;
        if (Math.hypot(p.x - P.x, p.y - P.y) < 90) n += 50;
        if (!best || n < best.n) best = { ...p, n };
      }
      if (best && this.h.dropPotion(best.x, best.y, P.maxHp * L.ratio, BATTLE_HEAL.medicine.name)) {
        this.lowHpAt = t; this.lowHpUsed++; this.stats.lowHpDrops++;
        this.h.notice('军医送来伤药 · 就在附近');
        playSheet(this.h.scene, 'fx_heal_fushui', best.x, best.y - 10, { size: 70, depth: actorDepth(best.y) + .05, ms: 700, alpha: .8, tint: 0xbff0c0 });
      }
    }
    this.wasLow = low;
  }

  update(dt: number, bossOn: boolean): void {
    const t = this.h.elapsed(), now = this.h.now(), P = this.h.player(), F = BATTLE_HEAL.food, S = BATTLE_HEAL.spot;
    const hurt = P.alive && P.hp < P.maxHp - .5;
    // 排好的泉眼：首领那一处在首领段前出；其余首领出场后不再刷
    for (const e of this.schedule) if (!e.fired && t >= e.at && (e.boss || !bossOn)) { e.fired = true; const p = this.spotPoint(); if (this.spawnSpot(p.x, p.y, e.boss) && e.boss) this.h.notice('首领将至 · 附近有' + HEAL_SPOT_NAME[this.spots[this.spots.length - 1].kind] + '可以回血'); }
    // 干粮 / 酒肉
    for (const f of this.foods) {
      if (!f.active) continue;
      if (now >= f.until) { f.active = false; f.img.setVisible(false); continue; }
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
        P.heal(want * P.maxHp); sp.left -= want / S.charge; this.stats.spot += want;
        if (now >= sp.fxAt) { sp.fxAt = now + 650; playSheet(this.h.scene, 'fx_heal_fushui', P.x, P.y - 14, { size: 84, depth: actorDepth(P.y) + .1, ms: 640, alpha: .8, tint: 0xbff0e0 }); }
        if (sp.left <= .001) { sp.left = 0; sp.readyAt = t + S.cooldownSec; this.stats.spotUses++; this.h.sfx('pickup'); this.h.notice(HEAL_SPOT_NAME[sp.kind] + '的水用完了 · ' + S.cooldownSec + ' 秒后再满'); }
      }
      const cool = !ready, R = S.radius, pulse = .45 + .25 * Math.sin(t * 3.4);
      sp.img.setTint(cool ? 0x7f8a90 : 0xffffff).setAlpha(cool ? .82 : 1);
      if (sp.kind === 'herb') sp.img.setFrame(cool ? 1 : 0);
      const g = sp.ring.clear(), col = cool ? 0x8fa6a0 : 0x7fe0a0;
      g.fillStyle(col, cool ? .04 : using ? .14 : .08).fillEllipse(sp.x, sp.y, R * 2, R * 1.44).lineStyle(2, col, cool ? .35 : pulse).strokeEllipse(sp.x, sp.y, R * 2, R * 1.44);
      // 弧：可用时 = 剩余水量，冷却时 = 回满进度
      const k = cool ? 1 - (sp.readyAt - t) / S.cooldownSec : sp.left;
      if (k > 0) { g.lineStyle(4, cool ? 0xb8c8c0 : 0xa8ffc8, .9).beginPath(); for (let i = 0; i <= Math.ceil(40 * k); i++) { const a = -Math.PI / 2 + Math.min(i / 40, k) * Math.PI * 2, px = sp.x + Math.cos(a) * R, py = sp.y + Math.sin(a) * R * .72; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.strokePath(); }
      sp.label.setText(HEAL_SPOT_NAME[sp.kind] + (cool ? ' · ' + Math.ceil(sp.readyAt - t) + ' 秒后水满' : using ? ' · 回血中' : ' · 站上去回血')).setColor(cool ? '#b8c4c0' : '#c8ffd8');
      this.drawArrow(sp, ready && P.alive && P.hp < P.maxHp * S.arrowBelow);
    }
    this.lowHpCheck(t);
  }

  clear(): void {
    this.clearSpots(); this.schedule = [];
    for (const f of this.foods) { f.active = false; f.img.setVisible(false); }
  }
}
