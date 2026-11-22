// 星图战斗特效预览（2026-11-21）：① 逐帧条（每个特效全部帧：上 = 2× 原帧 / 下 = 显示尺寸）→ assets/review/star-map/fx_strips.png；
// ② 套在实际大小主将上的合成（实机截图 w3-gate.jpg 的主将，1:1 不放大，逐帧）→ assets/review/star-map/fx_in_game.png。读 public/assets/star-map/fx/fx.json。
// 用法：SHOT=…/docs/defense-walk/w3-gate.jpg node tools/compose-star-fx-preview.mjs      （ONLY=a,b 只做部分特效）
import { chromium } from 'playwright';
import fs from 'fs';
const D = 'public/assets/star-map/fx/', rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const meta = JSON.parse(fs.readFileSync(D + 'fx.json', 'utf8')), E = process.env;
const keys = Object.keys(meta).filter(k => k !== 'note' && (!E.ONLY || E.ONLY.split(',').includes(k)));
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([imgs, shotU, meta, keys]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const IM = {}; for (const [k, u] of Object.entries(imgs)) IM[k] = await load(u); const shot = await load(shotU);
    // ① 逐帧条
    const W = 1560; let H = 20; const rows = keys.map(k => { const m = meta[k], fw = m.frame[0], fh = m.frame[1], sc = Math.min(1, 1500 / (fw * m.frames), 300 / fh), h2 = fh * sc, h1 = m.display[1]; const y = H; H += h2 + h1 + 60; return [k, m, sc, y, h2, h1]; });
    const c1 = document.createElement('canvas'); c1.width = W; c1.height = H; const g1 = c1.getContext('2d'); g1.fillStyle = '#26211c'; g1.fillRect(0, 0, W, H); g1.font = '13px sans-serif'; g1.imageSmoothingQuality = 'high';
    for (const [k, m, sc, y, h2, h1] of rows) { const fw = m.frame[0], fh = m.frame[1]; g1.fillStyle = '#cdb98e'; g1.fillText(`${m.name}（${m.loop ? '循环' : m.frames > 1 ? '一次性' : '静图'} ${m.frames} 帧 ${m.fps || '-'}fps）· 单帧 ${fw}×${fh}（2×）· 显示 ${m.display[0]}×${m.display[1]}`, 10, y + 4);
      for (let i = 0; i < m.frames; i++) { g1.drawImage(IM[k], i * fw, 0, fw, fh, 10 + i * fw * sc, y + 12, fw * sc, fh * sc); g1.fillStyle = '#888'; g1.fillText(String(i + 1), 10 + i * fw * sc + 4, y + 24); }
      for (let i = 0; i < m.frames; i++) g1.drawImage(IM[k], i * fw, 0, fw, fh, 10 + i * (m.display[0] + 14), y + 12 + h2 + 14, m.display[0], m.display[1]); }
    // ② 1:1 合成：主将脚底约 (685,178)；敌人命中点 / 脚底约 (748,166)；每帧一个 1:1 裁图
    const FEET = { x: 685, y: 178 }, HIT = { x: 748, y: 166 };
    const P = { beishui: [FEET, 1], pozhen: [HIT, 1], wanrendi: [FEET, 1], haoling: [FEET, .35], sanjun: [{ x: FEET.x - 16, y: FEET.y - 6 }, .8], lianzhu: [{ x: 748, y: 150 }, 1], youren: [{ x: 662, y: 150 }, 1], huoshao: [{ x: 748, y: 174 }, 1] };
    const rowInfo = keys.map(k => { const m = meta[k], cw = Math.max(200, m.display[0] + 40), ch = Math.max(170, m.display[1] + 50); return { k, m, cw, ch }; });
    const cw2 = Math.max(...rowInfo.map(r => r.cw * Math.min(r.m.frames, 8))), ch2 = rowInfo.reduce((s, r) => s + r.ch + 8, 0), c2 = document.createElement('canvas'); c2.width = cw2; c2.height = ch2; const g2 = c2.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, cw2, ch2); g2.imageSmoothingQuality = 'high';
    let yy = 0; for (const { k, m, cw, ch } of rowInfo) { const [pt, al] = P[k], ox = pt.x - cw / 2, oy = pt.y - ch * .7;
      for (let i = 0; i < m.frames; i++) { g2.save(); g2.translate(i * cw, yy); g2.beginPath(); g2.rect(0, 0, cw, ch); g2.clip(); g2.drawImage(shot, ox, oy, cw, ch, 0, 0, cw, ch); g2.globalAlpha = al;
        const [dw, dh] = m.display, ax = m.anchor[0] / 2, ay = m.anchor[1] / 2; g2.drawImage(IM[k], i * m.frame[0], 0, m.frame[0], m.frame[1], pt.x - ox - ax, pt.y - oy - ay, dw, dh); g2.restore(); }
      yy += ch + 8; }
    return { strips: c1.toDataURL('image/png'), game: c2.toDataURL('image/png') };
  }, [Object.fromEntries(keys.map(k => [k, rd(D + meta[k].file)])), rd(E.SHOT), meta, keys]);
  const w = (f, u) => fs.writeFileSync('assets/review/star-map/' + f, Buffer.from(u.split(',')[1], 'base64'));
  w('fx_strips.png', r.strips); w('fx_in_game.png', r.game); console.log('ok');
} finally { await b.close(); }
