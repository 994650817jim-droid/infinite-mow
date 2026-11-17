// 手绘厚涂图标（不像素化）：洋红底从边缘泛洪抠掉 → 边缘半透明并去洋红溢色 → 按不透明区域裁边 → 方形留白 → 缩到 SIZE。
// 用法：[SIZE=512] [PAD=.04] node tools/prepare-painted-icon.mjs <in.png> <out.png>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2), SIZE = +(process.env.SIZE ?? 512), PAD = +(process.env.PAD ?? .04);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([url, SIZE, PAD]) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, W, H), d = px.data;
    // 洋红程度：R、B 都高且 G 低
    const mag = i => Math.max(0, Math.min(d[i], d[i + 2]) - d[i + 1]) / 255;
    const isBg = i => mag(i) > .55 && Math.abs(d[i] - d[i + 2]) < 90;
    const seen = new Uint8Array(W * H), stack = [];
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    while (stack.length) { const k = stack.pop(); if (seen[k]) continue; const i = k * 4; if (!isBg(i)) continue; seen[k] = 1; d[i + 3] = 0;
      const x = k % W, y = (k / W) | 0; if (x > 0) stack.push(k - 1); if (x < W - 1) stack.push(k + 1); if (y > 0) stack.push(k - W); if (y < H - 1) stack.push(k + W); }
    // 与背景相邻的边缘：按洋红程度降不透明度，并去溢色（把洋红分量拉回到 G 附近）
    for (let pass = 0; pass < 2; pass++) for (let k = 0; k < W * H; k++) {
      const i = k * 4; if (!d[i + 3]) continue; const x = k % W, y = (k / W) | 0;
      const nearBg = (x > 0 && !d[i - 1]) || (x < W - 1 && !d[i + 7]) || (y > 0 && !d[i - W * 4 + 3]) || (y < H - 1 && !d[i + W * 4 + 3]);
      const m = mag(i); if (!nearBg && m < .25) continue;
      if (nearBg) d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - m * 1.4));
      const lim = d[i + 1] + 24; if (d[i] > lim && d[i + 2] > lim) { d[i] = Math.min(d[i], lim + (d[i] - d[i + 2] > 0 ? (d[i] - d[i + 2]) : 0)); d[i + 2] = Math.min(d[i + 2], lim); }
    }
    g.putImageData(px, 0, 0);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let k = 0; k < W * H; k++) if (d[k * 4 + 3] > 20) { const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.round(Math.max(bw, bh) * (1 + PAD * 2));
    const o = document.createElement('canvas'); o.width = o.height = SIZE; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    const s = SIZE / side; og.drawImage(c, x0, y0, bw, bh, (SIZE - bw * s) / 2, (SIZE - bh * s) / 2, bw * s, bh * s);
    return { data: o.toDataURL('image/png'), bbox: [x0, y0, bw, bh] };
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), SIZE, PAD]);
  writeFileSync(out, Buffer.from(res.data.split(',')[1], 'base64'));
  console.log(out, '主体', res.bbox.join(','), '→', SIZE + '×' + SIZE);
} finally { await b.close(); }
