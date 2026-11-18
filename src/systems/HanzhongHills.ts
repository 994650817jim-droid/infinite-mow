import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Legion } from './Legion';
import type { EnemyKind } from '../types';
import { DEPTH, FONT } from '../config';
import { HILL, HILL_ART } from '../data/hanzhongChapter';

interface HillHost {
  scene: Phaser.Scene; player: Player; legion: Legion; enemies: () => Enemy[];
  spawn: (kind: EnemyKind, x: number, y: number) => Enemy | null;
  banner: (text: string, caption?: string) => void;
  sfx: (key: string) => void;
}
interface Hill { x: number; y: number; owner: 'none' | 'player' | 'enemy'; take: number; lose: number; raidAt: number; mound: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image; flag: Phaser.GameObjects.Image | null; bar: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }

/**
 * 第八章「夺高地」：地图上 1~2 个山头。主将站上去（附近敌兵少于 2 个）读条 3 秒占领；
 * 占着任一山头时：主将伤害 +20%，部曲远程射程、伤害 +20%。
 * 主将不在山头、敌兵 ≥2 个围着时，敌军 4 秒夺回；占领后每 22 秒敌军派一队来反夺。
 * 山头地块：v2 用手绘图（env-v2/hill_1~4，画风会话出），v1 用程序画的土丘；旗帜借现有军旗图，读条条是界面提示。
 */
export class HanzhongHills {
  readonly hills: Hill[] = [];
  private buffed = false;
  readonly metrics = { captured: 0, lost: 0, raids: 0 };
  constructor(private h: HillHost, count: 1 | 2, now: number) {
    const p = h.player, spots = count === 1 ? [[380, -200]] : [[380, -220], [-400, 210]];
    for (const [dx, dy] of spots) {
      const x = p.x + dx, y = p.y + dy, s = h.scene;
      // v2：手绘山头地块（256×160，土丘撑满宽、上下居中），按占领圈宽度缩放；没有图时程序画土丘
      const art = HILL_ART.filter(a => s.textures.exists(a.key)), pick = art.length ? art[this.hills.length % art.length] : null;
      let mound: Hill['mound'];
      if (pick) mound = s.add.image(x, y + 4, pick.key).setDisplaySize(HILL.radius * 2.4, HILL.radius * 2.4 * 160 / 256).setDepth(DEPTH.ground + 3).setName('hanzhong-hill');
      else { const g = s.add.graphics().setDepth(DEPTH.ground + 3).setName('hanzhong-hill'); g.fillStyle(0x3a2c1c, .35).fillEllipse(x, y + 6, HILL.radius * 2.3, HILL.radius * 1.25).fillStyle(0x6b5434, .55).fillEllipse(x, y, HILL.radius * 2, HILL.radius * 1.05).fillStyle(0x8a7048, .45).fillEllipse(x - 10, y - 8, HILL.radius * 1.2, HILL.radius * .6); mound = g; }
      const flag = s.textures.exists('zhuge_banner') ? s.add.image(x, y - 6, 'zhuge_banner').setOrigin(.32, 1).setDisplaySize(46, 70).setDepth(DEPTH.enemy + y / 10000).setTint(0x9a9a9a) : null;
      const bar = s.add.graphics().setDepth(DEPTH.fx);
      const label = s.add.text(x, y - 92, '高地', { fontFamily: FONT, fontSize: '14px', color: '#f2ddae', stroke: '#1a1310', strokeThickness: 4, resolution: 2 }).setOrigin(.5).setDepth(DEPTH.fx);
      this.hills.push({ x, y, owner: 'none', take: 0, lose: 0, raidAt: now, mound, flag, bar, label });
    }
    h.banner('夺高地', '站上山头读条占领 · 居高临下伤害、射程提高');
  }
  /** 主将正站在某个山头上（8-2 双首领配合技「夺回山头」）。 */
  get playerOnHill(): boolean { const p = this.h.player; return this.hills.some(hl => Math.hypot(p.x - hl.x, (p.y - hl.y) / .55) <= HILL.radius); }
  get held(): number { return this.hills.filter(x => x.owner === 'player').length; }
  private enemiesNear(x: number, y: number): number { let n = 0; for (const e of this.h.enemies()) if (e.active && !e.isSupplySlot && e.kind !== 'boss' && Math.hypot(e.x - x, e.y - y) <= HILL.radius) n++; return n; }
  update(dt: number, now: number): void {
    const p = this.h.player;
    for (const hl of this.hills) {
      const pin = Math.hypot(p.x - hl.x, (p.y - hl.y) / .55) <= HILL.radius, foes = this.enemiesNear(hl.x, hl.y);
      if (hl.owner !== 'player') {
        if (pin && foes < HILL.contestNear) hl.take = Math.min(1, hl.take + dt / HILL.captureSec); else if (!pin) hl.take = Math.max(0, hl.take - dt / (HILL.captureSec * 2));
        if (hl.take >= 1) { hl.owner = 'player'; hl.lose = 0; hl.raidAt = now + HILL.raidEverySec * 1000; this.metrics.captured++; this.h.banner('占领高地', '居高临下 · 伤害、射程 +20%'); this.h.sfx('gong'); }
      } else {
        if (!pin && foes >= HILL.contestNear) hl.lose = Math.min(1, hl.lose + dt / HILL.recaptureSec); else hl.lose = Math.max(0, hl.lose - dt / HILL.recaptureSec);
        if (hl.lose >= 1) { hl.owner = 'enemy'; hl.take = 0; this.metrics.lost++; this.h.banner('高地失守', '敌军夺回山头 · 再抢回来'); }
        if (now >= hl.raidAt) { hl.raidAt = now + HILL.raidEverySec * 1000; this.raid(hl); }
      }
      this.draw(hl);
    }
    this.applyBuff(this.held > 0);
  }
  /** 敌军反夺：一队从山外围冲向山头。 */
  private raid(hl: Hill): void {
    this.metrics.raids++;
    const a = Math.random() * Math.PI * 2;
    for (let i = 0; i < HILL.raidSize; i++) { const b = a + (i - HILL.raidSize / 2) * .18; this.h.spawn(i % 3 === 2 ? 'archer' : 'infantry', hl.x + Math.cos(b) * 340, hl.y + Math.sin(b) * 260); }
    this.h.banner('敌军反夺', '一队敌兵扑向山头');
  }
  private applyBuff(on: boolean): void {
    if (on === this.buffed) return; this.buffed = on;
    const s = this.h.player.stats, k = on ? HILL.damageMul : 1 / HILL.damageMul;
    s.damageMul *= k;
    this.h.legion.rangeMul = on ? HILL.rangeMul : 1; this.h.legion.damageMul = on ? HILL.damageMul : 1;
  }
  private draw(hl: Hill): void {
    const own = hl.owner, g = hl.bar; g.clear();
    hl.flag?.setTint(own === 'player' ? 0xffd27a : own === 'enemy' ? 0x7f95c0 : 0x9a9a9a);
    hl.label.setText(own === 'player' ? '我军高地' : own === 'enemy' ? '敌占高地' : '高地').setColor(own === 'player' ? '#ffe7a8' : own === 'enemy' ? '#b8c8e8' : '#f2ddae');
    const prog = own === 'player' ? hl.lose : hl.take; if (prog <= 0) return;
    const w = 90, x = hl.x - w / 2, y = hl.y - 112;
    g.fillStyle(0x140d08, .85).fillRect(x - 1, y - 1, w + 2, 8).fillStyle(own === 'player' ? 0x7f95c0 : 0xf2c27a, 1).fillRect(x, y, w * prog, 6);
  }
  snapshot() { return { held: this.held, owners: this.hills.map(h => h.owner), take: this.hills.map(h => +h.take.toFixed(2)), metrics: { ...this.metrics } }; }
  clear(): void { this.applyBuff(false); for (const hl of this.hills) { hl.mound.destroy(); hl.flag?.destroy(); hl.bar.destroy(); hl.label.destroy(); } this.hills.length = 0; }
}
