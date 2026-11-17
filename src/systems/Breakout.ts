import Phaser from 'phaser';
import { actorDepth, DEPTH } from '../config';
import { worldText } from '../world/WorldUI';
import type { Player } from '../entities/Player';
import type { EnemyKind } from '../types';

/**
 * 第九章「麦城突围」（数值 BREAKOUT，开发期初值）：反向突围——我方被包围在麦城外的狭长谷道里，
 * 限时内一路向北冲到出口；四面吴兵合围（前方拦截、身后追兵、两翼包抄）；接近出口时吕蒙率亲军拦截，出口被拒马封住，
 * 击败吕蒙（倒地 → 宝箱）后拒马撤开，冲进出口即突围成功；超时即被围歼（失败）。
 */
export const BREAKOUT = {
  arena: { left: -420, right: 420, top: -2700, bottom: 420 },
  start: { x: 0, y: 260 },
  exit: { x: 0, y: -2520, radius: 120 },
  bossTriggerY: -1750, bossAt: { x: 0, y: -2240 },
  limitSeconds: 180,
  checkpoints: [-600, -1200, -1750], // 每过一道：横幅提示剩余距离
} as const;
const PROPS = 'xf_props';

export interface BreakoutHost {
  scene: Phaser.Scene; player: Player; now: () => number; elapsed: () => number;
  footprints: Array<{ left: number; right: number; top: number; bottom: number }>;
  spawnBoss: () => void; bossDown: () => boolean; banner: (t: string, danger?: boolean, caption?: string) => void;
}

export class Breakout {
  bossCalled = false; exited = false;
  private gateBox: { left: number; right: number; top: number; bottom: number } | null = null;
  private passed = 0; private objects: Phaser.GameObjects.GameObject[] = []; private exitG?: Phaser.GameObjects.Graphics; private label?: Phaser.GameObjects.Text;
  constructor(private readonly h: BreakoutHost) {
    const a = BREAKOUT.arena, E = BREAKOUT.exit, sc = h.scene, v2 = sc.textures.exists(PROPS);
    this.gateBox = { left: -160, right: 160, top: E.y + 40, bottom: E.y + 90 };
    h.footprints.splice(0, h.footprints.length,
      { left: a.left - 600, right: a.left, top: a.top - 300, bottom: a.bottom + 300 }, { left: a.right, right: a.right + 600, top: a.top - 300, bottom: a.bottom + 300 },
      { left: a.left, right: a.right, top: a.bottom, bottom: a.bottom + 300 },
      { left: a.left, right: -160, top: a.top - 300, bottom: E.y + 90 }, { left: 160, right: a.right, top: a.top - 300, bottom: E.y + 90 }, this.gateBox);
    h.player.sprite.setPosition(BREAKOUT.start.x, BREAKOUT.start.y);
    sc.cameras.main.scrollX = BREAKOUT.start.x - sc.cameras.main.width / 2; sc.cameras.main.scrollY = BREAKOUT.start.y - sc.cameras.main.height / 2;
    // 出口城门、两侧谷壁上的吴军旗
    this.img(0, E.y + 60, v2 ? PROPS : 'sishui_props_refined', v2 ? 4 : 0, 360);
    for (let y = a.bottom - 200; y > a.top + 400; y -= 420) for (const s of [-1, 1]) this.img(s * (a.right - 30), y, v2 ? PROPS : 'yellow_props', v2 ? 7 : 4, v2 ? 120 : 80);
    this.exitG = sc.add.graphics().setDepth(DEPTH.ground + 3); this.objects.push(this.exitG);
    this.label = worldText(sc, E.x, E.y - E.radius - 40, '', 16, '#ffe1a0').setOrigin(.5).setStroke('#1a120b', 4).setDepth(36); this.objects.push(this.label);
  }
  private img(x: number, y: number, key: string, frame: number, w: number) { const i = this.h.scene.add.image(x, y, key, frame).setOrigin(.5, 1).setDisplaySize(w, w).setDepth(actorDepth(y)); this.objects.push(i); return i; }
  get timeLeft() { return Math.max(0, BREAKOUT.limitSeconds - this.h.elapsed()); }
  get distance() { return Math.max(0, Math.round(this.h.player.y - BREAKOUT.exit.y)); }
  get gateOpen() { return !this.gateBox; }
  /** 合围刷兵：前方拦截 45%、身后追兵 30%、两翼 25%（都在谷道里）。 */
  spawnPoint(kind: EnemyKind): { x: number; y: number } {
    const p = this.h.player, a = BREAKOUT.arena, r = Math.random(); void kind;
    if (r < .45) return { x: (Math.random() * 2 - 1) * (a.right - 60), y: Math.max(a.top + 200, p.y - 460) };
    if (r < .75) return { x: (Math.random() * 2 - 1) * (a.right - 60), y: Math.min(a.bottom - 30, p.y + 440) };
    return { x: (Math.random() < .5 ? -1 : 1) * (a.right - 40), y: p.y - 150 + Math.random() * 300 };
  }
  update() {
    const p = this.h.player, E = BREAKOUT.exit;
    while (this.passed < BREAKOUT.checkpoints.length && p.y < BREAKOUT.checkpoints[this.passed]) { this.passed++; this.h.banner(this.passed < BREAKOUT.checkpoints.length ? `已突破第 ${this.passed} 道围` : '出口就在前方！', false, `距出口 ${this.distance} 步 · 剩 ${Math.ceil(this.timeLeft)} 秒`); }
    if (!this.bossCalled && p.y < BREAKOUT.bossTriggerY) { this.bossCalled = true; this.h.banner('吕蒙截道！', true, '击败吕蒙，撤开拒马，冲出麦城'); this.h.spawnBoss(); }
    if (this.gateBox && this.h.bossDown()) { const i = this.h.footprints.indexOf(this.gateBox); if (i >= 0) this.h.footprints.splice(i, 1); this.gateBox = null; this.h.banner('拒马已撤', false, '冲进出口！'); }
    const g = this.exitG!.clear(), open = this.gateOpen;
    g.fillStyle(open ? 0x8fe0b4 : 0xd8b07a, .14).fillEllipse(E.x, E.y, E.radius * 2, E.radius * 1.2).lineStyle(3, open ? 0x8fe0b4 : 0xd65a3f, .9).strokeEllipse(E.x, E.y, E.radius * 2, E.radius * 1.2);
    this.label?.setText(open ? '出口 · 冲出麦城' : '出口 · 拒马封路');
    if (open && !this.exited && Math.hypot(p.x - E.x, p.y - E.y) <= E.radius) this.exited = true;
  }
  clear() { for (const o of this.objects) o.destroy(); this.objects = []; }
}
