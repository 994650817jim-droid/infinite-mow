import Phaser from 'phaser';
import { DEPTH, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';

/** 一个屏边目标：世界坐标 + 简短名字（「冲车」「箭楼」「城门」…）。 */
export interface GuideTarget { key: string; x: number; y: number; label: string }

/**
 * 屏边目标指示（2026-11-21 总制作人：攻城战屏边只有回血点的青绿箭头，冲车 / 城门 / 箭楼不在屏内时不知道往哪走）。
 * 目标在屏外时，沿屏幕边缘放一枚金圈朱色箭头 + 名字 · 距离（和回血点的青绿圈区分开）；目标在屏内时不显示。
 * 顶部留出目标文字区（上沿 150），左上让开主将状态框，右侧让开 HUD 按钮列。
 */
export class EdgeGuide {
  private pool = new Map<string, Phaser.GameObjects.Container>();
  constructor(private readonly scene: Phaser.Scene) {}

  private make(): Phaser.GameObjects.Container {
    const s = this.scene, g = s.add.graphics().setName('eg-g');
    const t = s.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', color: '#ffe2a0', resolution: 2, stroke: '#1a0e06', strokeThickness: 4 }).setOrigin(.5).setName('eg-text');
    return s.add.container(0, 0, [g, t]).setScrollFactor(0).setDepth(DEPTH.hud + 1).setName('edge-guide').setVisible(false);
  }

  /** 每帧：targets 为当前要指的目标（没有就全部收起）；player 用来算距离；show=false 时全部收起（弹窗 / 结算）。 */
  update(targets: readonly GuideTarget[], player: { x: number; y: number }, show: boolean): void {
    const used = new Set<string>();
    if (show) for (const tg of targets) { used.add(tg.key); this.draw(tg, player); }
    for (const [k, c] of this.pool) if (!used.has(k)) c.setVisible(false);
  }

  private draw(tg: GuideTarget, player: { x: number; y: number }): void {
    let c = this.pool.get(tg.key); if (!c) { c = this.make(); this.pool.set(tg.key, c); }
    const cam = this.scene.cameras.main, v = cam.worldView, kx = GAME_WIDTH / v.width, ky = GAME_HEIGHT / v.height;
    const sx = (tg.x - v.x) * kx, sy = (tg.y - v.y) * ky, pad = 40;
    if (sx >= pad && sy >= pad && sx <= GAME_WIDTH - pad && sy <= GAME_HEIGHT - pad) { c.setVisible(false); return; }
    const top = 150, bottom = GAME_HEIGHT - 70, left = 60, right = GAME_WIDTH - 120, cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const a = Math.atan2(sy - cy, sx - cx), dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity);
    let ax = cx + dx * t; const ay = cy + dy * t;
    if (ax < 260 && ay < 270) ax = 260; // 左上角主将状态框 / 被动栏
    c.setPosition(ax, ay).setVisible(true);
    const g = c.getByName('eg-g') as Phaser.GameObjects.Graphics;
    g.clear().fillStyle(0x1a0e06, .7).fillCircle(0, 0, 15).lineStyle(2, 0xf0c860, .95).strokeCircle(0, 0, 15)
      .fillStyle(0xd8462a, 1).fillTriangle(dx * 25, dy * 25, Math.cos(a + 2.6) * 10 + dx * 17, Math.sin(a + 2.6) * 10 + dy * 17, Math.cos(a - 2.6) * 10 + dx * 17, Math.sin(a - 2.6) * 10 + dy * 17)
      .fillStyle(0xf0c860, 1).fillCircle(0, 0, 4);
    const d = Math.round(Math.hypot(tg.x - player.x, tg.y - player.y));
    (c.getByName('eg-text') as Phaser.GameObjects.Text).setText(`${tg.label} · ${d}`).setPosition(-dx * 50, -dy * 28 + (Math.abs(dy) < .5 ? 24 : 0));
  }

  /** 测试用：当前可见的指示（名字）。 */
  visible(): string[] { return [...this.pool.entries()].filter(([, c]) => c.visible).map(([, c]) => (c.getByName('eg-text') as Phaser.GameObjects.Text).text); }
  destroy(): void { for (const c of this.pool.values()) c.destroy(); this.pool.clear(); }
}
