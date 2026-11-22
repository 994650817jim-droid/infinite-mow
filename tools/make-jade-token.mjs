// 青玉军功符（小号经验信物，2026-11-21）：Gemini 生成的 4 帧绿幕图（2×2，1024×687 页面全屏 1:1 截图）→ 绿幕抠像 → 4 帧 64×64（物件约占帧 80%，统一按并集包围盒缩放、居中对齐）→ 横条 gem_tok_small_jade.png（256×64）。
// 用法：node tools/make-jade-token.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/coins/', src = 'data:image/jpeg;base64,' + fs.readFileSync(O + 'originals/raw/jade_token_gemini_1_screenshot.jpg').toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (s) => {
    const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const cells = []; for (let i = 0; i < 4; i++) { const c = document.createElement('canvas'); c.width = 512; c.height = 343; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, (i % 2) * 512, Math.floor(i / 2) * 343, 512, 343, 0, 0, 512, 343);
      const d = g.getImageData(0, 0, 512, 343), a = d.data; for (let k = 0; k < a.length; k += 4) { const gn = a[k + 1] - Math.max(a[k], a[k + 2]); let al = Math.max(0, Math.min(1, (112 - gn) / 60)); if (al < 1) al = al * al; const m = Math.max(a[k], a[k + 2]); if (a[k + 1] > m + 30 && al < 1) a[k + 1] = m + 30; a[k + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0); cells.push(c); }
    let X0 = 1e9, Y0 = 1e9, X1 = -1, Y1 = -1; cells.forEach(c => { const d = c.getContext('2d').getImageData(0, 0, 512, 343).data; for (let y = 0; y < 343; y++) for (let x = 0; x < 512; x++) if (d[(y * 512 + x) * 4 + 3] > 40) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y); } });
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1, sc = 51 / Math.max(w, h), strip = document.createElement('canvas'); strip.width = 256; strip.height = 64; const sg = strip.getContext('2d'); sg.imageSmoothingQuality = 'high';
    cells.forEach((c, i) => sg.drawImage(c, X0, Y0, w, h, i * 64 + (64 - w * sc) / 2, (64 - h * sc) / 2, w * sc, h * sc));
    return { png: strip.toDataURL('image/png'), box: [w, h] };
  }, src);
  fs.writeFileSync(O + 'gem_tok_small_jade.png', Buffer.from(u.png.split(',')[1], 'base64')); console.log('ok', u.box);
} finally { await b.close(); }
