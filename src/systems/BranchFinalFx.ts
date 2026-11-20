import Phaser from 'phaser';
import { DEPTH, IS_DESKTOP, actorDepth } from '../config';
import { WEAPON_BRANCHES } from '../data/weaponBranches';
import { CHARACTERS } from '../data/characters';

/**
 * 兵器专职「进阶形态」专属手绘序列帧（2026-11-19 用户「做美术」）：Lv7 + 该派 4 势（WeaponBranches.final()）后，24 个分支各有自己的出手爆发 + 常驻光环，
 * 原来选定 / Lv6 / Lv7 / 进阶看起来都一样（全是通用图换色）。每位武将 1 张 ChatGPT 黑底 6×4（FULL 去底，每格 256，每行 6 帧）：
 * 行 0 = 该武将第一个分支的进阶「出手」爆发（朝右，按最近敌人方向旋转）、行 1 = 它的进阶常驻光环（循环，套在主将身上）；行 2 / 3 = 第二个分支同理。
 * 叠加在原通用效果上，不替换；缺图什么都不画；手机不画光环。
 */
export const BRANCH_FX_HERO: Readonly<Record<string, string>> = { zy: 'zhaoyun', gy: 'guanyu', zf: 'zhangfei', lb: 'liubei', zg: 'zhuge', pt: 'pangtong', hz: 'huangzhong', hy: 'huangyueying', ss: 'sunshangxiang', dc: 'diaochan', mc: 'machao', wy: 'weiyan' };
/** 已出图的武将（图到一位登记一位，避免请求不存在的文件）。 */
export const BRANCH_FX_READY: readonly string[] = ['zhaoyun', 'guanyu', 'zhangfei', 'liubei', 'zhuge', 'pangtong', 'huangzhong', 'huangyueying', 'sunshangxiang', 'diaochan', 'machao', 'weiyan'];
export const branchFxKey = (hero: string): string => 'fx_bf_' + hero;
export const branchFxFile = (hero: string): string => `assets/branch-fx/${hero}.png`;

export const BRANCH_FX = { burstSize: 230, burstMs: 650, auraSize: 170, auraAlpha: .7, auraFps: 9, burstAlpha: .85, cap: 6 } as const;

/** 分支 → { 贴图 key, 第几个分支（0 / 1，按 WEAPON_BRANCHES 同武器内顺序） }；没图返回 null。 */
export function branchFxOf(scene: Phaser.Scene, branchId: string): { key: string; slot: number } | null {
  const b = WEAPON_BRANCHES.find(x => x.id === branchId); if (!b) return null;
  // 按分支的本命武器找武将（不能按 id 前缀：P2 吕布 lb_* 撞刘备、周瑜 zy_* 撞赵云，会播别人的进阶图）
  const hero = CHARACTERS.find(c => c.startWeapon === b.weapon)?.id; if (!hero || !BRANCH_FX_READY.includes(hero)) return null;
  const key = branchFxKey(hero); if (!scene.textures.exists(key)) return null;
  return { key, slot: WEAPON_BRANCHES.filter(x => x.weapon === b.weapon).findIndex(x => x.id === branchId) };
}

export class BranchFinalFx {
  private live = 0; private aura: Phaser.GameObjects.Image | null = null;
  readonly stats = { bursts: 0, auraFrames: 0 };
  constructor(private readonly scene: Phaser.Scene, private readonly follow: () => { x: number; y: number }) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.aura?.destroy(); this.aura = null; });
  }
  /** 出手爆发：在主将身前朝 angle 播一遍。 */
  burst(branchId: string, x: number, y: number, angle: number): void {
    const f = branchFxOf(this.scene, branchId); if (!f || this.live >= BRANCH_FX.cap) return;
    const K = BRANCH_FX, row = f.slot * 2; this.live++; this.stats.bursts++;
    const img = this.scene.add.image(x + Math.cos(angle) * 46, y + Math.sin(angle) * 46 - 6, f.key, row * 6).setDisplaySize(K.burstSize, K.burstSize).setRotation(angle).setAlpha(K.burstAlpha).setDepth(DEPTH.fx + 2).setName('branch-final-fx');
    this.scene.tweens.addCounter({ from: 0, to: 5.99, duration: K.burstMs, onUpdate: tw => img.setFrame(row * 6 + Math.floor(tw.getValue() ?? 0)), onComplete: () => { this.live--; img.destroy(); } });
  }
  /** 常驻光环：active 时套在主将身上循环，否则隐藏（每帧调）。 */
  setAura(branchId: string, active: boolean, now: number): void {
    if (!active || !IS_DESKTOP) { this.aura?.setVisible(false); return; }
    const f = branchFxOf(this.scene, branchId); if (!f) { this.aura?.setVisible(false); return; }
    const K = BRANCH_FX, p = this.follow(), row = f.slot * 2 + 1;
    this.aura ??= this.scene.add.image(0, 0, f.key, row * 6).setName('branch-final-aura');
    this.stats.auraFrames++;
    this.aura.setTexture(f.key, row * 6 + Math.floor(now / (1000 / K.auraFps)) % 6).setDisplaySize(K.auraSize, K.auraSize).setAlpha(K.auraAlpha).setOrigin(.5, .5).setPosition(p.x, p.y + 8).setDepth(actorDepth(p.y) - .02).setVisible(true);
  }
}
