// 「全剧终」题字（2026-11-21）：Gemini 生成的毛笔行书（黑底暖金白字，1024×687 页面全屏 1:1 截图）→ 亮度转 alpha（透明底）→ 切两个备选。
// 输出 public/assets/ending/finis_a.png（乱世终 · 天下定）、finis_b.png（山河为证）。用法：node tools/make-ending-finis.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/ending/', src = 'data:image/jpeg;base64,' + fs.readFileSync(O + 'originals/raw/ending_finis_gemini_1_screenshot.jpg').toString('base64');
const BOX = { a: [40, 130, 950, 175], b: [130, 310, 770, 215] };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([u, BOX]) => {
    const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; }), out = {};
    for (const [k, [x, y, w, h]] of Object.entries(BOX)) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, x, y, w, h, 0, 0, w, h); const d = g.getImageData(0, 0, w, h), a = d.data;
      for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]), al = Math.max(0, Math.min(1, (m - 22) / 150)); if (m > 0) for (let q = 0; q < 3; q++) a[i + q] = Math.min(255, a[i + q] * 255 / m * .98); a[i + 3] = Math.round(al * 255); }
      g.putImageData(d, 0, 0); out[k] = [c.toDataURL('image/png'), w, h]; }
    return out;
  }, [src, BOX]);
  for (const [k, [u, w, h]] of Object.entries(r)) { fs.writeFileSync(O + `finis_${k}.png`, Buffer.from(u.split(',')[1], 'base64')); console.log(k, w, h); }
} finally { await b.close(); }
