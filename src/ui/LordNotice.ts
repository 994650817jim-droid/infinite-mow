import Phaser from 'phaser';
import { FONT, HEADING_FONT, GAME_WIDTH as W, GAME_HEIGHT as H, IS_DESKTOP as D } from '../config';
import { getCharacter, type CharacterId } from '../data/characters';
import { homeCommand } from './HomeCommand';

/**
 * 老存档第一次进主页：说明「主公选定后本存档不可更改」，已按最近出战的武将自动定下主公，给一次改选机会。
 * （用户规则 2026-11-16；新存档在选将界面里直接择主公，不弹这个。）
 */
export function showLordNotice(s: Phaser.Scene, lord: CharacterId, keep: () => void, repick: () => void): Phaser.GameObjects.Container {
  const root = s.add.container(0, 0).setDepth(320).setName('lord-notice');
  root.add(s.add.rectangle(W / 2, H / 2, W, H, 0x0c0906, .78).setInteractive());
  const pw = D ? 560 : W - 40, ph = D ? 300 : 420, px = W / 2, py = H / 2;
  const g = s.add.graphics();
  g.fillStyle(0x1d140c, .97).fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 12);
  g.lineStyle(2, 0xc9a66a, .9).strokeRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 12);
  root.add(g);
  const name = getCharacter(lord).name;
  const t = (y: number, v: string, size: number, color: string, font = FONT) => s.add.text(px, y, v, { fontFamily: font, fontSize: size + 'px', color, align: 'center', resolution: 2, wordWrap: { width: pw - 60, useAdvancedWrap: true } }).setOrigin(.5, 0);
  root.add(t(py - ph / 2 + 22, `主公 · ${name}`, D ? 28 : 26, '#efd399', HEADING_FONT).setName('lord-notice-title'));
  root.add(t(py - ph / 2 + (D ? 74 : 72), `新规：每个存档在开局选定一名主公，之后整个存档都由主公出战，不能再更换。其他武将可在招贤馆招为随行。\n\n这个存档已按你最近出战的武将，把 ${name} 定为主公。你有一次改选的机会。`, D ? 15 : 15, '#e2d4bd'));
  const by = py + ph / 2 - (D ? 44 : 52), bw = D ? 220 : (pw - 50) / 2;
  const a = homeCommand(s, px - bw / 2 - 10, by, bw, D ? 52 : 60, `就用${name}`, true);
  const b = homeCommand(s, px + bw / 2 + 10, by, bw, D ? 52 : 60, '改选主公');
  a.hit.setName('lord-keep').setData('padDefault', true).on('pointerdown', () => { root.destroy(); keep(); });
  b.hit.setName('lord-repick').on('pointerdown', () => { root.destroy(); repick(); });
  root.add([a.g, a.hit, a.caption, b.g, b.hit, b.caption]);
  return root;
}
