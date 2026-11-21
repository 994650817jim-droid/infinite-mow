// 星图战斗特效样张预览（2026-11-21）：① 逐帧条（每个特效的全部帧，上 = 2× 原帧 / 下 = 显示尺寸）→ assets/review/star-map/fx_strips.png；
// ② 套在实际大小主将上的合成（用实机截图 w3-gate.jpg 的主将，1:1 不放大，逐帧）→ assets/review/star-map/fx_in_game.png。
// 用法：SHOT=…/docs/defense-walk/w3-gate.jpg node tools/compose-star-fx-preview.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const D = 'public/assets/star-map/fx/', rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const meta = JSON.parse(fs.readFileSync(D + 'fx.json', 'utf8')), E = process.env;
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([imgs, shotU, meta]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const IM = {}; for (const [k, u] of Object.entries(imgs)) IM[k] = await load(u); const shot = await load(shotU);
    const keys = ['beishui', 'pozhen', 'wanrendi'], names = { beishui: '背水（循环 8 帧 10fps）', pozhen: '破阵（一次性 8 帧 16fps）', wanrendi: '万人敌（循环 6 帧 6fps）' };
    // ① 逐帧条：每个特效一块：上排 2× 原帧（宽度缩到 ≤ 1500），下排显示尺寸（1×）
    const W = 1560; let H = 20; const rows = keys.map(k => { const m = meta[k], fw = m.frame[0], fh = m.frame[1], sc = Math.min(1, 1500 / (fw * m.frames)); const h2 = fh * sc, h1 = m.display[1]; const y = H; H += h2 + h1 + 60; return [k, m, sc, y, h2, h1]; });
    const c1 = document.createElement('canvas'); c1.width = W; c1.height = H; const g1 = c1.getContext('2d'); g1.fillStyle = '#26211c'; g1.fillRect(0, 0, W, H); g1.font = '13px sans-serif'; g1.imageSmoothingQuality = 'high';
    for (const [k, m, sc, y, h2, h1] of rows) { const fw = m.frame[0], fh = m.frame[1]; g1.fillStyle = '#cdb98e'; g1.fillText(names[k] + ` · 单帧 ${fw}×${fh}（2×）· 显示 ${m.display[0]}×${m.display[1]}`, 10, y + 4);
      for (let i = 0; i < m.frames; i++) { g1.drawImage(IM[k], i * fw, 0, fw, fh, 10 + i * fw * sc, y + 12, fw * sc, fh * sc); g1.fillStyle = '#888'; g1.fillText(String(i + 1), 10 + i * fw * sc + 4, y + 24); }
      for (let i = 0; i < m.frames; i++) g1.drawImage(IM[k], i * fw, 0, fw, fh, 10 + i * (m.display[0] + 14), y + 12 + h2 + 14, m.display[0], m.display[1]); }
    // ② 1:1 合成：主将脚底约在 (685,178)；敌人命中点约 (748,168)；每帧一个 200×170 的 1:1 裁图
    const FEET = { x: 685, y: 178 }, HIT = { x: 748, y: 166 }, CW = 200, CH = 170, ox = FEET.x - 100, oy = FEET.y - 120;
    const maxN = 8, c2 = document.createElement('canvas'); c2.width = maxN * CW; c2.height = 3 * CH + 20; const g2 = c2.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, c2.width, c2.height); g2.imageSmoothingQuality = 'high';
    keys.forEach((k, row) => { const m = meta[k]; for (let i = 0; i < m.frames; i++) { g2.save(); g2.translate(i * CW, row * (CH + 10)); g2.beginPath(); g2.rect(0, 0, CW, CH); g2.clip(); g2.drawImage(shot, ox, oy, CW, CH, 0, 0, CW, CH);
        const [dw, dh] = m.display, ax = m.anchor[0] / 2, ay = m.anchor[1] / 2, P = k === 'pozhen' ? HIT : FEET; g2.drawImage(IM[k], i * m.frame[0], 0, m.frame[0], m.frame[1], P.x - ox - ax, P.y - oy - ay + (k === 'pozhen' ? -2 : 0), dw, dh); g2.restore(); } });
    return { strips: c1.toDataURL('image/png'), game: c2.toDataURL('image/png') };
  }, [Object.fromEntries(['beishui', 'pozhen', 'wanrendi'].map(k => [k, rd(D + `fx_${k}.png`)])), rd(E.SHOT), meta]);
  const w = (f, u) => fs.writeFileSync('assets/review/star-map/' + f, Buffer.from(u.split(',')[1], 'base64'));
  w('fx_strips.png', r.strips); w('fx_in_game.png', r.game); console.log('ok');
} finally { await b.close(); }
