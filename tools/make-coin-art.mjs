// 钱币 / 钱袋图标（2026-11-21）：Gemini 生成的绿幕图（1024×687，页面全屏 1:1 截图）→ 绿幕抠像（greenness = g - max(r,b)）→ 切图 → public/assets/coins/。
// 图标表（2×2，格 512×343）：钱袋平常 / 钱袋鼓起 / 钱币串 / 钱币堆；翻转帧表（3×2）：铜钱翻转 6 帧。
// 输出：pouch_normal.png、pouch_full.png（96×96，2× 图，显示约 28~48）、coin_string.png、coin_pile.png（64×64，2× 图）、coin_flip.png（6 帧横条，每帧 48×48，2× 图，显示 14~24）。
// 用法：node tools/make-coin-art.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/coins/', R = O + 'originals/raw/', rd = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
const hasFlip = fs.existsSync(R + 'coin_flip_gemini_1_screenshot.jpg');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([icons, flip]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const key = cv => { const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height), a = d.data; for (let i = 0; i < a.length; i += 4) { const gn = a[i + 1] - Math.max(a[i], a[i + 2]); let al = Math.max(0, Math.min(1, (112 - gn) / 60)); if (al < 1) al = al * al; const m = Math.max(a[i], a[i + 2]); if (a[i + 1] > m - 4) a[i + 1] = Math.max(0, m - 4); a[i + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0); return cv; };
    // 找 alpha 包围盒并等比放进 size×size（留 pad 边距），底部对齐可选
    const fit = (src, size, pad) => { const g = src.getContext('2d'), d = g.getImageData(0, 0, src.width, src.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, s = (size - pad * 2) / Math.max(w, h), o = document.createElement('canvas'); o.width = o.height = size; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(src, x0, y0, w, h, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s); return o; };
    const out = {}; const I = await load(icons), W = 1024, H = 687;
    const names = ['pouch_normal', 'pouch_full', 'coin_string', 'coin_pile'], sizes = [96, 96, 64, 64];
    names.forEach((n, i) => { const cx = (i % 2) * 512, cy = Math.floor(i / 2) * 343; const c = document.createElement('canvas'); c.width = 512; c.height = 343; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(I, cx, cy, 512, 343, 0, 0, 512, 343); key(c); out[n] = fit(c, sizes[i], 3).toDataURL('image/png'); });
    if (flip) { const F = await load(flip), strip = document.createElement('canvas'); strip.width = 48 * 6; strip.height = 48; const sg = strip.getContext('2d'); let maxD = 0;
      // 先统一缩放：取所有帧里最大的包围盒边长作为基准，保证每帧中心 / 大小一致
      const cells = []; for (let i = 0; i < 6; i++) { const cx = (i % 3) * 341, cy = Math.floor(i / 3) * 343; const c = document.createElement('canvas'); c.width = 341; c.height = 343; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(F, cx, cy, 341, 343, 0, 0, 341, 343); key(c); cells.push(c); }
      // 第 6 帧：原图第 6 格是绕另一个轴倾斜的宽椭圆（和翻转不连贯），改用第 4 帧（背面）水平压到 55% 作 300° 的窄椭圆
      { const c = document.createElement('canvas'); c.width = 341; c.height = 343; const g = c.getContext('2d'); g.translate(170, 0); g.scale(.55, 1); g.translate(-175, 0); g.drawImage(cells[3], 0, 0); cells[5] = c; }
      // 以整表统一比例：包围盒最大边（所有帧并集）→ 44px
      let X0 = 1e9, Y0 = 1e9, X1 = -1, Y1 = -1; cells.forEach(c => { const d = c.getContext('2d').getImageData(0, 0, 341, 343).data; for (let y = 0; y < 343; y++) for (let x = 0; x < 341; x++) if (d[(y * 341 + x) * 4 + 3] > 40) { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y); } });
      const w = X1 - X0 + 1, h = Y1 - Y0 + 1, s = 44 / Math.max(w, h), cxm = (X0 + X1) / 2, cym = (Y0 + Y1) / 2; sg.imageSmoothingQuality = 'high';
      cells.forEach((c, i) => sg.drawImage(c, i * 48 + 24 - cxm * s, 24 - cym * s, 341 * s, 343 * s)); out.coin_flip = strip.toDataURL('image/png'); }
    return out;
  }, [rd(R + 'coin_icons_gemini_1_screenshot.jpg'), hasFlip ? rd(R + 'coin_flip_gemini_1_screenshot.jpg') : null]);
  for (const [k, u] of Object.entries(r)) fs.writeFileSync(O + k + '.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok', Object.keys(r).join(','));
} finally { await b.close(); }
