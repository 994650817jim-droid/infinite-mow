// 攻城府衙素材重排：洋红底原图（originals/walk_siege_hall.png，约 1774×887，8 件物件松散排列）
// → public/assets/siege-v2/hall.png（4×2 格，每格 384，共 1536×768，透明底）。
// 每件物件各自抠洋红 → 取不透明外框 → 等比缩放塞进格子（四周留 MARGIN 透明边距）→ 水平居中、底边留 MARGIN。
// 顺序：府衙大堂 / 台阶 / 回廊 / 石狮 / 内城门 / 帅旗 / 香炉 / 照壁（与 SiegeMidArt 一致，不变）。
// 用法：node tools/prepare-siege-hall.mjs [原图.png]（不需要开发服务器）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2] ?? 'public/assets/siege-v2/originals/walk_siege_hall.png';
const MARGIN = 0.07, CELL = 384;
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([data, MARGIN, CELL]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.max(0, Math.min(R, B) - G);
      const a = m >= 200 ? 0 : m <= 18 ? 1 : 1 - (m - 18) / 182; let r2 = R, b2 = B;
      if (a > 0 && a < 1) { r2 = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)); b2 = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a)); }
      const spill = Math.max(0, Math.min(r2, b2) - G); d[i] = r2 - spill; d[i + 2] = b2 - spill; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    // 每件物件的搜索窗口（按原图比例取，互不重叠）
    const fx = W / 1774, fy = H / 887, win = [[0, 0, 600, 425], [600, 0, 990, 425], [990, 0, 1440, 425], [1440, 0, 1774, 425], [0, 425, 575, 887], [600, 425, 930, 887], [940, 425, 1260, 887], [1280, 425, 1774, 887]];
    const out = document.createElement('canvas'); out.width = CELL * 4; out.height = CELL * 2; const og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
    const info = [];
    win.forEach(([x0, y0, x1, y1], k) => {
      x0 = Math.round(x0 * fx); x1 = Math.round(x1 * fx); y0 = Math.round(y0 * fy); y1 = Math.round(y1 * fy);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, inner = CELL * (1 - 2 * MARGIN), s = Math.min(inner / bw, inner / bh), dw = bw * s, dh = bh * s;
      const cx = (k % 4) * CELL, cy = Math.floor(k / 4) * CELL;
      og.drawImage(cv, bx0, by0, bw, bh, cx + (CELL - dw) / 2, cy + CELL - CELL * MARGIN - dh, dw, dh);
      info.push(`${k}: ${bw}×${bh} → ${Math.round(dw)}×${Math.round(dh)}`);
    });
    return { url: out.toDataURL('image/png'), info };
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), MARGIN, CELL]);
  writeFileSync('public/assets/siege-v2/hall.png', Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(res.info.join('\n'));
} finally { await b.close(); }
