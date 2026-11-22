// 星图点亮特效序列帧切图（2026-11-21）：黑底 4×3 共 12 帧 → 亮度转透明（alpha = 通道最大值 × GAIN，颜色反预乘），每帧固定以格心为中心、同一缩放（不自动裁边，保证帧间不抖），
// 输出 fx_light_strip.png（12 帧横排，每帧 SIZE×SIZE）+ 逐帧预览。要星 / 主星各自按显示尺寸缩放使用（帧内特效直径约占 85%）。
// 用法：SRC=…/fx_light_gpt_1.png COLS=4 ROWS=3 SIZE=192 node tools/cut-star-fx.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, COLS = +(E.COLS ?? 4), ROWS = +(E.ROWS ?? 3), SIZE = +(E.SIZE ?? 192), GAIN = +(E.GAIN ?? 1.35), OUT = E.OUT ?? 'public/assets/star-map/fx_light_strip.png';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const url = await p.evaluate(async ([src, COLS, ROWS, SIZE, GAIN]) => {
    const im = new Image(); im.src = src; await im.decode(); const cw = im.width / COLS, ch = im.height / ROWS, side = Math.min(cw, ch);
    const out = document.createElement('canvas'); out.width = SIZE * COLS * ROWS; out.height = SIZE; const og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
    for (let k = 0; k < COLS * ROWS; k++) { const rx = k % COLS, ry = (k / COLS) | 0, c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(im, rx * cw + (cw - side) / 2, ry * ch + (ch - side) / 2, side, side, 0, 0, SIZE, SIZE);
      const img = g.getImageData(0, 0, SIZE, SIZE), d = img.data; for (let i = 0; i < d.length; i += 4) { const m = Math.max(d[i], d[i + 1], d[i + 2]), a = Math.min(255, Math.max(0, (m - 8) * GAIN)); if (a > 0) for (let q = 0; q < 3; q++) d[i + q] = Math.min(255, d[i + q] * 255 / Math.max(m, 1)); d[i + 3] = a; } g.putImageData(img, 0, 0); og.drawImage(c, k * SIZE, 0); }
    return out.toDataURL('image/png');
  }, ['data:image/png;base64,' + fs.readFileSync(E.SRC).toString('base64'), COLS, ROWS, SIZE, GAIN]);
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64')); console.log('→', OUT);
} finally { await b.close(); }
