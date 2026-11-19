// 白 / 浅灰底（ChatGPT 声称透明但实际是白底或棋盘格）抠成透明：从图边泛洪，只抠和边缘连通的浅色低饱和像素，内部浅色不动；边缘一圈做羽化。
// 用法：[TOL=38] [MAX=900] node tools/key-white-edge.mjs <in.png> <out.webp>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2), TOL = +(process.env.TOL ?? 38), MAX = +(process.env.MAX ?? 900);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ([url, TOL, MAX]) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.width, H = img.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H), d = id.data, bg = new Uint8Array(W * H), q = [];
    const light = i => { const r = d[i * 4], gg = d[i * 4 + 1], bb = d[i * 4 + 2], mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb); return d[i * 4 + 3] < 20 || (mn > 255 - TOL * 2.2 && mx - mn < TOL); };
    for (let x = 0; x < W; x++) { q.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) { q.push(y * W, y * W + W - 1); }
    while (q.length) { const i = q.pop(); if (bg[i] || !light(i)) continue; bg[i] = 1; const x = i % W, y = (i / W) | 0; if (x > 0) q.push(i - 1); if (x < W - 1) q.push(i + 1); if (y > 0) q.push(i - W); if (y < H - 1) q.push(i + W); }
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let i = 0; i < W * H; i++) { if (bg[i]) { d[i * 4 + 3] = 0; continue; } const x = i % W, y = (i / W) | 0;
      // 羽化：挨着背景的一圈降一点不透明度
      let n = 0; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && bg[j]) n++; if (n) d[i * 4 + 3] = Math.round(d[i * 4 + 3] * (1 - n * .18));
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    g.putImageData(id, 0, 0);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, k = Math.min(1, MAX / Math.max(w, h)), o = document.createElement('canvas'); o.width = Math.round(w * k); o.height = Math.round(h * k);
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cv, x0, y0, w, h, 0, 0, o.width, o.height);
    return { url: o.toDataURL('image/webp', .9), w: o.width, h: o.height };
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), TOL, MAX]);
  writeFileSync(out, Buffer.from(data.url.split(',')[1], 'base64')); console.log(out, `${data.w}×${data.h}`);
} finally { await b.close(); }
