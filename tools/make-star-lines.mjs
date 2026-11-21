// 星图连线贴图（2026-11-21）：ChatGPT 黑底两条水平毛笔线（上：淡墨线，下：流金线）→ 各切一条带 → 亮度转透明 → 横向无缝（交叉渐变）→ 裁掉上下空行，输出 line_ink.png / line_gold.png（宽 W，可沿线方向平铺）。
// 用法：SRC=…/lines_gpt_1.png INK=150:270 GOLD=430:570 W=512 node tools/make-star-lines.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, W = +(E.W ?? 512), FEATHER = +(E.FEATHER ?? 96), OUT = E.OUT ?? 'public/assets/star-map/';
const bands = { line_ink: E.INK.split(':').map(Number), line_gold: E.GOLD.split(':').map(Number) };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([src, bands, W, F, GAIN]) => {
    const im = new Image(); im.src = src; await im.decode(); const sc = W / im.width, out = {};
    for (const [name, [y0, y1]] of Object.entries(bands)) {
      const h = Math.max(2, Math.round((y1 - y0) * sc)), c = document.createElement('canvas'); c.width = W; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, y0, im.width, y1 - y0, 0, 0, W, h);
      const img = g.getImageData(0, 0, W, h), d = img.data, o = new Uint8ClampedArray(d), half = W >> 1;
      for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) { const m = Math.min(1, Math.min(x, W - 1 - x) / F), i = (y * W + x) * 4, r = (y * W + ((x + half) % W)) * 4; for (let k = 0; k < 3; k++) o[i + k] = d[i + k] * m + d[r + k] * (1 - m); }
      let y0b = h, y1b = 0; for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, mx = Math.max(o[i], o[i + 1], o[i + 2]), a = Math.min(255, Math.max(0, (mx - 6) * GAIN)); if (a > 0) for (let k = 0; k < 3; k++) o[i + k] = Math.min(255, o[i + k] * 255 / Math.max(mx, 1)); o[i + 3] = a; if (a > 30) { if (y < y0b) y0b = y; if (y > y1b) y1b = y; } }
      const pad = 3, ya = Math.max(0, y0b - pad), yb = Math.min(h - 1, y1b + pad), hh = yb - ya + 1, c2 = document.createElement('canvas'); c2.width = W; c2.height = hh; c2.getContext('2d').putImageData(new ImageData(o, W, h), 0, -ya);
      out[name] = { url: c2.toDataURL('image/png'), size: [W, hh] };
    }
    return out;
  }, ['data:image/png;base64,' + fs.readFileSync(E.SRC).toString('base64'), bands, W, FEATHER, 1.5]);
  for (const [n, v] of Object.entries(res)) { fs.writeFileSync(OUT + n + '.png', Buffer.from(v.url.split(',')[1], 'base64')); console.log(n, v.size.join('x')); }
} finally { await b.close(); }
