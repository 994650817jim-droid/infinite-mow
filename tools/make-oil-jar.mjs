// 兀突骨火油罐（2026-11-21）：Gemini 绿幕图（左 = 完好，右 = 碎裂，1024×687 页面全屏 1:1 截图）→ 抠像 → 两帧 256×256（脚底在格底往上 24px，主体约 180×200，两帧同比例、同脚底线）→ public/assets/props/gauntlet_oil_jar.png（512×256）。
// 用法：node tools/make-oil-jar.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/props/', src = 'data:image/jpeg;base64,' + fs.readFileSync(O + 'originals/raw/gauntlet_oil_jar_gemini_1_screenshot.jpg').toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (s) => {
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const cells = [[0, 500], [516, 1024]].map(([x0, x1]) => { const w = x1 - x0, c = document.createElement('canvas'); c.width = w; c.height = 687; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, x0, 0, w, 687, 0, 0, w, 687);
      const d = g.getImageData(0, 0, w, 687), a = d.data; for (let i = 0; i < a.length; i += 4) { const gn = a[i + 1] - Math.max(a[i], a[i + 2]); let al = Math.max(0, Math.min(1, (112 - gn) / 60)); if (al < 1) al = al * al; const m = Math.max(a[i], a[i + 2]); if (a[i + 1] > m - 4) a[i + 1] = Math.max(0, m - 4); a[i + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0);
      const dd = g.getImageData(0, 0, w, 687).data; let X0 = w, Y0 = 687, X1 = 0, Y1 = 0; for (let y = 0; y < 687; y++) for (let x = 0; x < w; x++) if (dd[(y * w + x) * 4 + 3] > 40) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y); } return { c, box: [X0, Y0, X1, Y1] }; });
    const sc = 200 / (cells[0].box[3] - cells[0].box[1] + 1), out = document.createElement('canvas'); out.width = 512; out.height = 256; const og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
    cells.forEach(({ c, box }, i) => { const [X0, Y0, X1, Y1] = box, w = X1 - X0 + 1, h = Y1 - Y0 + 1; og.drawImage(c, X0, Y0, w, h, i * 256 + 128 - w * sc / 2, 232 - h * sc, w * sc, h * sc); });
    return { png: out.toDataURL('image/png'), sc, boxes: cells.map(c => c.box) };
  }, src);
  fs.writeFileSync(O + 'gauntlet_oil_jar.png', Buffer.from(u.png.split(',')[1], 'base64')); console.log(JSON.stringify(u.boxes), u.sc);
} finally { await b.close(); }
