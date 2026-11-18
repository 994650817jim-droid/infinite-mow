import Phaser from 'phaser';
import { TutorialOverlay, type ScreenRect } from '../ui/TutorialOverlay';
import { heroHorse, ownedHorses, stableUnlocked } from './ItemStore';
import { isChapterTestRun } from './ChapterProgress';
import { mountHintSeen, mountTutorialSeen, setMountHintSeen, setMountTutorialSeen } from '../world/WorldStore';
import { MOUNT } from '../data/mounts';
import type { CharacterId } from '../data/characters';

/**
 * 坐骑引导（用户 11-18「也要新手引导装备马」）：第一次有马（第一章通关送驽马、首领赠马）后进营寨，弹一段短引导：
 *   ① 指向马厩「营中已设马厩，点马厩换马」→ ② 马厩面板里指向「骑乘」「给主将选一匹马」→ ③ 一句效果说明（按 data/mounts.ts MOUNT 实际数值写）。
 * 沿用 1-1 新手引导的界面（TutorialOverlay：墨迹横条、金色箭头 + 柔光、「跳过引导」）；看完 / 跳过记在存档（WorldStore.mountTutorialDone），
 * 设置「重看新手引导」一并清掉。测试跑（?dev=1）默认不开，?tutorial=1 强制开。
 * 另：战斗里第一次骑马出征，开局底部补一句操作提示（MountRideHint，只出一次）。
 */
export type MountGuideStep = 'stable' | 'pick' | 'info' | 'done';
interface CityHost extends Phaser.Scene { focusOn?: (id: 'stable') => void }

/** 效果说明（随 MOUNT 数值走）。 */
export function mountEffectLine(): string {
  return `骑马出征：移速 +${Math.round((MOUNT.speedMul - 1) * 100)}%、受伤 −${Math.round((1 - MOUNT.damageTakenMul) * 100)}%、冲过小兵会践踏`;
}

export class MountGuide {
  step: MountGuideStep = 'stable';
  readonly seen: MountGuideStep[] = [];
  private overlay: TutorialOverlay; private shownAt = 0; private shown = false; private finished = false; private lastAim = '';

  static forced(): boolean { try { return new URLSearchParams(window.location.search).get('tutorial') === '1'; } catch { return false; } }
  /** 该不该开：已有马、马厩开放、当前存档没看过；测试跑默认不开，?tutorial=1 强制。 */
  static wanted(): boolean {
    if (!stableUnlocked() || !ownedHorses().length || mountTutorialSeen()) return false;
    return MountGuide.forced() || !isChapterTestRun();
  }
  static maybeStart(scene: Phaser.Scene, hero: () => CharacterId): MountGuide | undefined { return MountGuide.wanted() ? new MountGuide(scene, hero) : undefined; }

  constructor(private scene: CityHost, private hero: () => CharacterId) {
    this.overlay = new TutorialOverlay(scene, () => this.finish());
    scene.events.on('postupdate', this.tick, this);
    scene.events.once('shutdown', () => this.dispose());
  }
  get active(): boolean { return !this.finished; }
  get line(): string { return this.overlay.line; }

  /** 名字找界面元素（含容器里的子元素）。 */
  private find(name: string): Phaser.GameObjects.GameObject | null {
    const walk = (list: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject | null => {
      for (const o of list) { if (o.name === name && (o as unknown as { visible?: boolean }).visible !== false) return o; const c = o as Phaser.GameObjects.Container; if (c.list) { const r = walk(c.list); if (r) return r; } }
      return null;
    };
    return walk(this.scene.children.list);
  }
  private findPrefix(prefix: string): Phaser.GameObjects.GameObject | null {
    const walk = (list: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.GameObject | null => {
      for (const o of list) { if (o.name?.startsWith(prefix)) return o; const c = o as Phaser.GameObjects.Container; if (c.list) { const r = walk(c.list); if (r) return r; } }
      return null;
    };
    return walk(this.scene.children.list);
  }
  private rect(o: Phaser.GameObjects.GameObject | null): ScreenRect | null {
    const g = o as unknown as { getBounds?: () => Phaser.Geom.Rectangle } | null; if (!g?.getBounds) return null;
    const b = g.getBounds(); return { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  /** 营寨有别的弹窗（开场介绍、建筑卡片…）时先等。 */
  private blocked(): boolean { return this.scene.children.list.some(o => (o as unknown as { depth: number }).depth >= 600 && o.name !== 'item-bag' && o.name !== 'tutorial-overlay'); }
  private go(step: MountGuideStep): void { this.step = step; this.shown = false; this.lastAim = ''; }

  private tick(): void {
    if (this.finished) return;
    this.overlay.animate();
    const bag = this.find('item-bag');
    switch (this.step) {
      case 'stable': {
        if (bag) { this.go('pick'); return; }
        if (this.blocked()) { this.overlay.suppress(true); return; }
        this.overlay.suppress(false);
        const hit = this.find('bld-stable');
        if (!this.shown) { this.scene.focusOn?.('stable'); this.overlay.show('营中已设马厩：点马厩换马', [], 'camp'); this.mark(); }
        // 从下面向上指（马厩上方是拴着的马，从上往下指会像在指马）；位置变了才重设
        const r = this.rect(hit), key = r ? `${Math.round(r.x)},${Math.round(r.y)}` : ''; if (r && key !== this.lastAim) { this.lastAim = key; this.overlay.point(r, null, 'below'); }
        return;
      }
      case 'pick': {
        if (!bag) { this.go('stable'); return; } // 关了面板：回到第一步重新指马厩
        if (heroHorse(this.hero())) { this.go('info'); return; }
        if (!this.shown) { this.overlay.show('选一匹马，点「骑乘」给主将装上', [], 'popup'); this.mark(); }
        const btn = this.findPrefix('stable-ride-'); const r = this.rect(btn); if (r) this.overlay.point(r, null, 'below'); else this.overlay.point(null);
        return;
      }
      case 'info': {
        if (!this.shown) { this.overlay.show(mountEffectLine() + '；挨打耗马力，耗尽会落马', [], bag ? 'popup' : 'camp', 5200); this.overlay.point(null); this.mark(); }
        if (performance.now() - this.shownAt > 5600) this.finish();
        return;
      }
    }
  }
  private mark(): void { this.shown = true; this.shownAt = performance.now(); if (this.seen.at(-1) !== this.step) this.seen.push(this.step); }
  /** 看完或跳过：记存档，收起。 */
  finish(): void { if (this.finished) return; this.finished = true; this.step = 'done'; setMountTutorialSeen(true); this.overlay.hide(); }
  private dispose(): void { this.scene.events.off('postupdate', this.tick, this); this.overlay.destroy(); }
}

/** 战斗里第一次骑马出征：开局底部两句短提示（先说效果、再说马力 / 落马；只出一次；测试跑默认不出，?tutorial=1 强制）。一句太长会压到右下角「护阵」。 */
export class MountRideHint {
  private overlay: TutorialOverlay | null = null; private at = 0; private part = 0;
  readonly lines: [string, string];
  static maybeShow(scene: Phaser.Scene, mounted: boolean): MountRideHint | undefined {
    if (!mounted || mountHintSeen() || (!MountGuide.forced() && isChapterTestRun())) return undefined;
    return new MountRideHint(scene);
  }
  constructor(private scene: Phaser.Scene) {
    setMountHintSeen();
    this.lines = [mountEffectLine().replace('骑马出征：', '骑马中：'), `脚下马力条挨打会掉，掉光落马，约 ${Math.round(MOUNT.remountMs / 1000)} 秒后再上马`];
    this.overlay = new TutorialOverlay(scene, () => this.close());
    this.overlay.show(this.lines[0], [], 'battle'); this.at = performance.now();
    scene.events.on('postupdate', this.tick, this);
    scene.events.once('shutdown', () => this.close());
  }
  /** 两句合起来（测试读）；收起后为空。 */
  get line(): string { return this.overlay ? this.lines.join('；') : ''; }
  private tick(): void {
    const o = this.overlay; if (!o) return; o.animate();
    const t = performance.now() - this.at;
    if (this.part === 0 && t > 3600) { this.part = 1; o.show(this.lines[1], [], 'battle', 3200); }
    if (t > 7400) this.close();
  }
  close(): void { if (!this.overlay) return; this.scene.events.off('postupdate', this.tick, this); this.overlay.destroy(); this.overlay = null; }
}
