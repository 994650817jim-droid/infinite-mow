import Phaser from 'phaser';
import { DEPTH, FONT, GAME_WIDTH, HEADING_FONT } from '../config';
import { SOFT_CAP } from '../data/heroLevels';
import type { SmallStep } from '../data/smallSteps';

/**
 * 「小成」快选（不暂停战斗，2026-11-20 用户「可以试一试」「小升级是指上面」）：
 * 屏幕上方、顶部战况线下面滑出 3 个小图标，按 1 / 2 / 3 或点击选；SOFT_CAP.autoMs 没选自动给第一个（军资），下面一条倒计时细条。
 * 连着攒了几次小成就排队一次一次出。首领血条在上方时（手机布局）往下让开。
 */
export interface SmallStepHost {
  scene: Phaser.Scene;
  /** 抽三个选项。 */ roll: () => SmallStep[];
  /** 选定：生效，返回飘字。 */ apply: (s: SmallStep) => string;
  /** 面板顶边 y（避开战况线 / 计时 / 首领血条）。 */ top: () => number;
  /** 现在能不能出（战斗中、没有全屏面板）。 */ live: () => boolean;
  /** 主将头顶飘字。 */ float: (text: string) => void;
}
const CELL = 44, GAP = 24;
export class SmallStepPicker {
  private queue = 0;
  private root?: Phaser.GameObjects.Container;
  private opts: SmallStep[] = [];
  private shownAt = 0; private bar?: Phaser.GameObjects.Graphics;
  /** 测试用。 */
  readonly stats = { shown: 0, picked: [] as string[], auto: 0 };
  constructor(private readonly h: SmallStepHost) {}
  get open(): boolean { return !!this.root; }
  /** 攒一次小成（排队）。 */
  push(n = 1): void { this.queue += n; }
  update(): void {
    if (!this.root) { if (this.queue > 0 && this.h.live()) this.show(); return; }
    this.root.setVisible(this.h.live()); if (!this.h.live()) return;
    this.root.setY(this.h.top());
    const k = Math.max(0, 1 - (performance.now() - this.shownAt) / SOFT_CAP.autoMs), w = 3 * CELL + 2 * GAP;
    this.bar?.clear().fillStyle(0x1a120a, .7).fillRect(-w / 2, CELL + 18, w, 3).fillStyle(0xf0c060, .95).fillRect(-w / 2, CELL + 18, w * k, 3);
    if (k <= 0) { this.stats.auto++; this.pick(0); }
  }
  /** 选第 i 个（按键 / 点击 / 到时自动）；没开面板返回 false（按键交给别人）。 */
  pick(i: number): boolean {
    const o = this.opts[i]; if (!this.root || !o) return false;
    const text = this.h.apply(o); this.stats.picked.push(o.id); this.h.float(o.kind + ' · ' + text);
    const r = this.root; this.root = undefined; this.bar = undefined;
    this.h.scene.tweens.add({ targets: r, alpha: 0, duration: 160, onComplete: () => r.destroy() });
    return true;
  }
  private show(): void {
    this.queue--; this.stats.shown++; this.opts = this.h.roll(); this.shownAt = performance.now();
    const s = this.h.scene, root = s.add.container(GAME_WIDTH / 2, this.h.top()).setScrollFactor(0).setDepth(DEPTH.hud + 6).setName('small-step');
    const w = 3 * CELL + 2 * GAP;
    const bg = s.add.graphics(); bg.fillStyle(0x120c07, .62).fillRoundedRect(-w / 2 - 22, -18, w + 44, CELL + 42, 6).lineStyle(1, 0xd8b46a, .55).strokeRoundedRect(-w / 2 - 22, -18, w + 44, CELL + 42, 6); root.add(bg);
    root.add(s.add.text(0, -9, '小成 · 按 1 / 2 / 3 选', { fontFamily: HEADING_FONT, fontSize: '12px', color: '#ffe3a0', resolution: 2, stroke: '#1a0e06', strokeThickness: 3 }).setOrigin(.5).setName('small-step-title'));
    this.opts.forEach((o, i) => {
      const x = -w / 2 + CELL / 2 + i * (CELL + GAP), y = CELL / 2 + 2;
      const cell = s.add.graphics(); cell.fillStyle(0x2a1f14, .9).fillRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 5).lineStyle(1.5, i === 0 ? 0xf0c060 : 0x9c8458, .9).strokeRoundedRect(x - CELL / 2, y - CELL / 2, CELL, CELL, 5);
      const parts: Phaser.GameObjects.GameObject[] = [cell];
      if (s.textures.exists(o.icon)) parts.push(s.add.image(x, y - 2, o.icon).setDisplaySize(32, 32));
      parts.push(s.add.text(x - CELL / 2 + 4, y - CELL / 2 + 2, String(i + 1), { fontFamily: HEADING_FONT, fontSize: '12px', color: '#ffe9bd', resolution: 2, stroke: '#1a0e06', strokeThickness: 3 }));
      parts.push(s.add.text(x, y + CELL / 2 + 8, o.kind + '·' + o.name, { fontFamily: FONT, fontSize: '10px', color: '#f2e2bf', resolution: 2, stroke: '#1a0e06', strokeThickness: 3 }).setOrigin(.5));
      const hit = s.add.rectangle(x, y, CELL, CELL, 0, .001).setInteractive({ useHandCursor: true }).setName('small-step-' + i); hit.on('pointerup', () => this.pick(i)); parts.push(hit);
      root.add(parts);
    });
    this.bar = s.add.graphics(); root.add(this.bar);
    root.setAlpha(0); s.tweens.add({ targets: root, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
    this.root = root;
  }
  clear(): void { this.root?.destroy(); this.root = undefined; this.queue = 0; }
}
