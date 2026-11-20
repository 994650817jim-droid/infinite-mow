import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, actorDepth } from '../config';
import { playSheet } from './SkillFxSheets';

/**
 * 刷兵帐篷的共用部分（规则数值在 data/spawnTents.ts）：
 * - TentCtx：章节、首领是否已出场、同屏敌兵数（GameScene.tentCtx 给）；
 * - 登记：各系统把自己的刷兵帐篷登记到场景上，舆图画小帐、屏外给边缘小提示；
 * - 扬尘（出兵前帐篷口）与拆营起火（营帐起火音效 + 手绘地火）。
 */
export interface TentCtx {
  chapter: () => number;
  bossOn: () => boolean;
  /** 同屏（场上）活着的敌兵数。 */
  crowd: () => number;
  sfx?: (key: string) => void;
  /** 拆营奖励：随军粮 n；food = 掉一份干粮（BattleHeal）。 */
  reward?: (x: number, y: number, grain: number, food: boolean) => void;
}
export interface TentMark { x: number; y: number; ratio: number; hit: boolean; /** 正在刷兵（主将在激活范围内）。 */ awake: boolean; /** 已是破营目标（舆图已经画了，不重复）。 */ objective?: boolean }

type Source = () => readonly TentMark[];
const REG = new WeakMap<Phaser.Scene, Set<Source>>();
/** 登记一组刷兵帐篷；返回注销函数。 */
export function registerTents(scene: Phaser.Scene, src: Source): () => void {
  let set = REG.get(scene); if (!set) { set = new Set(); REG.set(scene, set); }
  set.add(src); return () => { set!.delete(src); };
}
/** 场上所有还立着的刷兵帐篷（舆图 / 屏外提示用）。 */
export function tentMarks(scene: Phaser.Scene): TentMark[] { const out: TentMark[] = []; for (const s of REG.get(scene) ?? []) out.push(...s()); return out; }

/** 出兵前帐篷口扬尘（手绘尘土序列帧）。 */
export function tentMuster(scene: Phaser.Scene, x: number, y: number, ms = 900): void {
  playSheet(scene, 'fx_collapse_dust', x, y, { size: 120, ms, depth: actorDepth(y) + .3, originY: .8, alpha: .85, name: 'tent-muster' });
}
/** 拆营：营帐起火音效 + 手绘地火。 */
export function tentBurn(scene: Phaser.Scene, x: number, y: number, sfx?: (k: string) => void): void {
  sfx?.('tent_fire');
  playSheet(scene, 'fx_ground_fire', x, y + 6, { size: 160, ms: 1600, depth: actorDepth(y) + .2, originY: .8, name: 'tent-burn' });
}

/**
 * 屏外刷兵帐篷的边缘小提示：只给「正在刷兵」的帐篷，暗红小帐 + 细箭头，半透明、不写字（不吵）。最多 3 个。
 */
export class TentEdgeHints {
  private readonly g: Phaser.GameObjects.Graphics;
  readonly stats = { shown: 0 };
  constructor(private readonly scene: Phaser.Scene) { this.g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud).setName('tent-edge-hints'); }
  update(hidden: boolean): void {
    const g = this.g.clear(); this.stats.shown = 0; if (hidden) return;
    const v = this.scene.cameras.main.worldView, kx = GAME_WIDTH / v.width, ky = GAME_HEIGHT / v.height, cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const top = 100, bottom = GAME_HEIGHT - 100, left = 48, right = GAME_WIDTH - 110;
    const list = tentMarks(this.scene).filter(m => m.awake).map(m => ({ m, sx: (m.x - v.x) * kx, sy: (m.y - v.y) * ky }))
      .filter(o => o.sx < 0 || o.sy < 0 || o.sx > GAME_WIDTH || o.sy > GAME_HEIGHT).sort((a, b) => Math.hypot(a.sx - cx, a.sy - cy) - Math.hypot(b.sx - cx, b.sy - cy)).slice(0, 3);
    for (const { sx, sy } of list) {
      const a = Math.atan2(sy - cy, sx - cx), dx = Math.cos(a), dy = Math.sin(a);
      const t = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity);
      let x = cx + dx * t; const y = cy + dy * t; if (x < 250 && y < 260) x = 250;
      g.fillStyle(0x1a0e08, .45).fillCircle(x, y, 13).lineStyle(1, 0xd2452e, .7).strokeCircle(x, y, 13);
      g.fillStyle(0xb3261a, .85).fillTriangle(x, y - 8, x - 7, y + 5, x + 7, y + 5);
      g.fillStyle(0xd2452e, .8).fillTriangle(x + dx * 20, y + dy * 20, x + dx * 14 + dy * 5, y + dy * 14 - dx * 5, x + dx * 14 - dy * 5, y + dy * 14 + dx * 5);
      this.stats.shown++;
    }
  }
  destroy(): void { this.g.destroy(); }
}
