import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, HEADING_FONT, TITLE_FONT } from '../config';
import { FIXED_KEYS, HOTKEYS, HOTKEY_ORDER, hotkeyCode, hotkeyCodes, keyName, resetHotkeys, setHotkey, typingTarget, eventCode, type HotkeyAction } from '../data/hotkeys';
import { lqSheet } from './LacquerKit';
import { homeCommand } from './HomeCommand';

/**
 * 设置 ·「快捷键」页（主页「军中设置」与战斗内「军中设置」共用，用户 2026-11-18）：
 * 列出全部键位；点一行的键位后按新键即改（Esc 取消）；与别的动作冲突时提示，再按一次同一个键则两者互换；「恢复默认」清掉自定义。
 * 改键存 localStorage（data/hotkeys.ts）。打开期间战斗快捷键不响应（hotkeyUiOpen）。
 */
let openCount = 0;
/** 快捷键设置页开着（战斗快捷键此时不响应）。 */
export function hotkeyUiOpen(): boolean { return openCount > 0; }

export function openHotkeySettings(scene: Phaser.Scene, depth = 900): Phaser.GameObjects.Container {
  scene.children.getByName('hotkey-settings')?.destroy();
  const W = GAME_WIDTH, H = GAME_HEIGHT, pw = Math.min(840, W - 40), ph = Math.min(500, H - 30), x0 = (W - pw) / 2, y0 = (H - ph) / 2;
  const root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setName('hotkey-settings');
  openCount++;
  root.add(scene.add.rectangle(0, 0, W, H, 0x0b0805, .72).setOrigin(0).setInteractive());
  const g = scene.add.graphics(); lqSheet(g, x0, y0, pw, ph); root.add(g);
  const txt = (x: number, y: number, s: string, size: number, color: string, font = FONT) => scene.add.text(x, y, s, { fontFamily: font, fontSize: size + 'px', color, resolution: 2, stroke: '#120904', strokeThickness: 3 });
  root.add(txt(W / 2, y0 + 30, '快捷键', 28, '#efd399', TITLE_FONT).setOrigin(.5));
  const msg = txt(W / 2, y0 + 62, '点键位后按新键改键 · Esc 取消', 13, '#b9a57a').setOrigin(.5).setName('hotkey-message');
  root.add(msg);
  let capture: HotkeyAction | null = null, pending: { action: HotkeyAction; code: string } | null = null;
  const rows: Array<{ action: HotkeyAction; value: Phaser.GameObjects.Text }> = [];
  const colW = (pw - 60) / 2, rowH = 40, top = y0 + 88; // 16 个可改键（加了舆图 M、军令 G）+ 移动：9 行，行高 40 才不压到底部按钮
  const slot = (i: number) => ({ x: x0 + 30 + (i % 2) * (colW + 0) + (i % 2 ? 10 : 0), y: top + Math.floor(i / 2) * rowH });
  const items: Array<{ fixed?: { label: string; keys: string }; action?: HotkeyAction }> = [...FIXED_KEYS.map(f => ({ fixed: f })), ...HOTKEY_ORDER.map(a => ({ action: a }))];
  const keysText = (a: HotkeyAction) => hotkeyCodes(a).map(keyName).join(' / ');
  items.forEach((it, i) => {
    const { x, y } = slot(i), w = colW - 10;
    const plate = scene.add.graphics(); plate.fillStyle(0x3a2616, .42).fillRoundedRect(x, y, w, rowH - 6, 5).lineStyle(1, 0xc9a35e, .3).strokeRoundedRect(x, y, w, rowH - 6, 5); root.add(plate);
    const label = it.fixed?.label ?? HOTKEYS[it.action!].label, where = it.fixed ? '固定，不可改' : HOTKEYS[it.action!].where;
    root.add(txt(x + 10, y + 2, label, 15, '#e8d8b2'));
    root.add(txt(x + 10, y + 19, where, 11, '#9d8f78'));
    const value = txt(x + w - 10, y + (rowH - 6) / 2, it.fixed?.keys ?? keysText(it.action!), 15, it.fixed ? '#9d927c' : '#efd399', HEADING_FONT).setOrigin(1, .5);
    root.add(value);
    if (it.action) {
      const a = it.action;
      value.setName('hotkey-row-' + a).setInteractive({ useHandCursor: true }).setPadding(8, 4)
        .on('pointerover', () => value.setAlpha(.8)).on('pointerout', () => value.setAlpha(1))
        .on('pointerdown', () => { capture = a; pending = null; refresh(); msg.setText(`按下「${HOTKEYS[a].label}」的新键 · Esc 取消`).setColor('#e8c98a'); });
      rows.push({ action: a, value });
    }
  });
  const refresh = () => { for (const r of rows) r.value.setText(capture === r.action ? '请按键…' : keysText(r.action)).setColor(capture === r.action ? '#ffe9a8' : '#efd399'); };
  const close = () => { if (!root.active) return; root.destroy(); };
  const by = y0 + ph - 32;
  const reset = homeCommand(scene, W / 2 - 110, by, 170, 38, '恢复默认'); reset.hit.setName('hotkey-reset').on('pointerdown', () => { resetHotkeys(); capture = null; pending = null; refresh(); msg.setText('已恢复默认键位').setColor('#b9d2a8'); });
  const back = homeCommand(scene, W / 2 + 110, by, 170, 38, '返回'); back.hit.setName('hotkey-close').setData('padDefault', true).on('pointerdown', close);
  for (const o of [reset.g, reset.hit, reset.caption, back.g, back.hit, back.caption]) { (o as unknown as { setScrollFactor(n: number): void }).setScrollFactor(0); root.add(o); }
  root.each((o: Phaser.GameObjects.GameObject) => (o as unknown as { setScrollFactor?: (n: number) => void }).setScrollFactor?.(0));

  // 键盘：捕获阶段先拿到，改键 / 关闭时不让战斗快捷键与场景的 Esc 再处理这一下
  const onKey = (e: KeyboardEvent) => {
    if (!root.active || typingTarget(e)) return;
    const code = eventCode(e);
    e.stopImmediatePropagation(); e.preventDefault();
    if (!capture) { if (code === 'Escape') close(); return; }
    if (code === 'Escape') { capture = null; pending = null; refresh(); msg.setText('已取消').setColor('#b9a57a'); return; }
    const a = capture, force = !!pending && pending.action === a && pending.code === code;
    const r = setHotkey(a, code, force);
    if (r.reserved) { msg.setText(`${keyName(code)} 是移动 / 系统键，不能用`).setColor('#e59a83'); return; }
    if (!r.ok && r.conflict) { pending = { action: a, code }; msg.setText(`${keyName(code)} 已是「${HOTKEYS[r.conflict].label}」的键：再按一次 ${keyName(code)} 互换，Esc 取消`).setColor('#e59a83'); return; }
    msg.setText(r.conflict ? `已互换：「${HOTKEYS[a].label}」= ${keyName(hotkeyCode(a))}，「${HOTKEYS[r.conflict].label}」= ${keyName(hotkeyCode(r.conflict))}` : `「${HOTKEYS[a].label}」改为 ${keyName(code)}`).setColor('#b9d2a8');
    capture = null; pending = null; refresh();
  };
  window.addEventListener('keydown', onKey, true);
  root.once('destroy', () => { window.removeEventListener('keydown', onKey, true); openCount = Math.max(0, openCount - 1); });
  scene.events.once('shutdown', () => { if (root.active) root.destroy(); });
  return root;
}

/** 设置面板里的「快捷键 ›」入口（主页与战斗内共用）。 */
export function hotkeySettingsLink(scene: Phaser.Scene, x: number, y: number, depth = 900): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, '快捷键 ›', { fontFamily: FONT, fontSize: '13px', color: '#e8c98a', stroke: '#120904', strokeThickness: 3, resolution: 2 }).setOrigin(1, .5).setName('settings-hotkeys')
    .setInteractive({ useHandCursor: true });
  t.on('pointerover', () => t.setAlpha(.8)).on('pointerout', () => t.setAlpha(1)).on('pointerdown', () => openHotkeySettings(scene, depth));
  return t;
}
