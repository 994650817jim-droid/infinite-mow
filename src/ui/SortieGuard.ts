import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT } from '../config';
import { isChapterTestRun } from '../systems/ChapterProgress';
import { sortieLossCities } from '../world/WorldStore';
import { lacquerPlate } from '../world/WorldMapChrome';

/**
 * 出征确认（守城重做 defense-redesign.md 第八节 ②，用户 11-20 批准「出征确认弹窗先单独做」）：
 * 出征别处会让告急 / 被围的城池失守时，先弹窗确认，不再一点就丢城。
 * 用法：在出征函数开头 `if (sortieBlocked(this, () => this.depart())) return;`——弹了窗就返回 true，确认后重新调一次 retry（这次放行）。
 * 确认后 30 秒内（天下地图 → 篇章选关页自动出征这一串）不再重复问。测试战斗（?dev=1）不问。
 */
const CONFIRM_KEY = 'sortieConfirmedAt', CONFIRM_MS = 30000;

export function sortieBlocked(scene: Phaser.Scene, retry: () => void): boolean {
  if (isChapterTestRun()) return false;
  const at = Number(scene.registry.get(CONFIRM_KEY) ?? 0);
  if (Date.now() - at < CONFIRM_MS) return false;
  const lost = sortieLossCities(); if (!lost.length) return false;
  if (scene.children.getByName('sortie-guard')) return true;
  showGuard(scene, lost, () => { scene.registry.set(CONFIRM_KEY, Date.now()); retry(); });
  return true;
}

function showGuard(scene: Phaser.Scene, lost: string[], go: () => void): void {
  const W = GAME_WIDTH, H = GAME_HEIGHT, desk = W > 600, pw = Math.min(W - 40, 500), ph = desk ? 230 : 260, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(5000).setName('sortie-guard');
  root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x07100b, .74).setInteractive());
  const g = scene.add.graphics(); lacquerPlate(g, px, py, pw, ph, .97); root.add(g);
  const names = lost.join('、');
  root.add(scene.add.text(W / 2, py + 34, '⚠ 城池告急', { fontFamily: HEADING_FONT, fontSize: '24px', color: '#f0a68a', resolution: 2 }).setOrigin(.5).setStroke('#1a0e08', 4));
  root.add(scene.add.text(W / 2, py + 96, `${names}正被围攻。\n此时出征别处，${lost.length > 1 ? '这些城池' : names}将失守。`, { fontFamily: FONT, fontSize: desk ? '16px' : '17px', color: '#ecdcc0', align: 'center', lineSpacing: 6, resolution: 2, wordWrap: { width: pw - 48 } }).setOrigin(.5));
  const close = (): void => { root.destroy(); };
  const btn = (x: number, label: string, primary: boolean, name: string, fn: () => void): void => {
    const bw = pw * .4, bh = 42, y = py + ph - 44, bg = scene.add.rectangle(x, y, bw, bh, primary ? 0x7a2418 : 0x2c241b, .96).setStrokeStyle(1.5, primary ? 0xf0c070 : 0x9a8564).setInteractive({ useHandCursor: true }).setName(name);
    const t = scene.add.text(x, y, label, { fontFamily: HEADING_FONT, fontSize: '18px', color: primary ? '#ffe9bd' : '#d8c7a6', resolution: 2 }).setOrigin(.5);
    bg.on('pointerover', () => bg.setAlpha(.85)).on('pointerout', () => bg.setAlpha(.96)).on('pointerup', () => { close(); fn(); });
    root.add([bg, t]);
  };
  btn(W / 2 - pw * .23, '先去守城', false, 'sortie-guard-cancel', () => undefined);
  btn(W / 2 + pw * .23, '仍要出征', true, 'sortie-guard-go', go);
}
