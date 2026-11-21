// 星图图标切图（2026-11-21）：ChatGPT 黑底 3 列 × 2 行的亮色水墨图标表 → 逐格「亮度转透明」（alpha = 通道最大值，颜色反预乘），自动裁边居中，输出 128×128 透明 PNG。
// 用法：SRC=…/icons_trial_gpt_1.png COLS=3 ROWS=2 IDS=qianjun,youren,lianzhu,lijun,wanrendi,- node tools/cut-star-icons.mjs  （- 表示空格跳过）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, COLS = +(E.COLS ?? 3), ROWS = +(E.ROWS ?? 2), IDS = (E.IDS ?? '').split(','), OUT = E.OUT ?? 'public/assets/star-map/', SIZE = +(E.SIZE ?? 128), PAD = +(E.PAD ?? .1), GAIN = +(E.GAIN ?? 1.5);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([src, COLS, ROWS, SIZE, PAD, GAIN]) => {
    const im = new Image(); im.src = src; await im.decode(); const cw = im.width / COLS, ch = im.height / ROWS, outs = [];
    for (let ry = 0; ry < ROWS; ry++) for (let cx = 0; cx < COLS; cx++) {
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, cx * cw, ry * ch, cw, ch, 0, 0, cw, ch);
      const img = g.getImageData(0, 0, cw, ch), d = img.data; let x0 = cw, x1 = 0, y0 = ch, y1 = 0;
      for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]), a = Math.min(255, Math.max(0, (m - 10) * GAIN)); if (a > 0) { for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, d[i + k] * 255 / Math.max(m, 1)); } d[i + 3] = a; const j = i / 4, x = j % cw, y = (j / cw) | 0; if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      g.putImageData(img, 0, 0); const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh) * (1 + PAD * 2), o = document.createElement('canvas'); o.width = SIZE; o.height = SIZE; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; const s = SIZE / side; og.drawImage(c, x0, y0, bw, bh, (SIZE - bw * s) / 2, (SIZE - bh * s) / 2, bw * s, bh * s); outs.push(o.toDataURL('image/png'));
    }
    return outs;
  }, ['data:image/png;base64,' + fs.readFileSync(E.SRC).toString('base64'), COLS, ROWS, SIZE, PAD, GAIN]);
  res.forEach((u, k) => { const id = IDS[k]; if (!id || id === '-') return; fs.writeFileSync(OUT + 'icon_' + id + '.png', Buffer.from(u.split(',')[1], 'base64')); console.log('→', OUT + 'icon_' + id + '.png'); });
} finally { await b.close(); }
