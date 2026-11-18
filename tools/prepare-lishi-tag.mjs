// 「力」字符牌：洋红底抠图（软抠，金色光晕边缘去洋红偏色）→ 裁到符牌外框 → 缩到高 96。用法：node tools/prepare-lishi-tag.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'public/assets/relic-fx/originals/artv2_lishi_tag.png', OUT = 'public/assets/relic-fx/lishi_tag.png', H = 96;
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage(); await p.goto('about:blank');
const url = await p.evaluate(async ([src, H]) => {
  const img = new Image(); img.src = src; await img.decode();
  const W = img.width, Hh = img.height, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, Hh), d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], bl = d[i + 2], m = Math.min(r, bl) - gg; // 洋红程度
    const a = m > 150 ? 0 : m > 40 ? 1 - (m - 40) / 110 : 1;
    if (a < 1) { const k = Math.min(r, bl) - gg; d[i] = Math.min(255, r); d[i + 2] = Math.max(0, bl - k); } // 去掉蓝分量里的洋红
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  g.putImageData(px, 0, 0);
  let x0 = W, y0 = Hh, x1 = 0, y1 = 0; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = H / bh, o = document.createElement('canvas'); o.width = Math.round(bw * k); o.height = H;
  const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, x0, y0, bw, bh, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}, ['data:image/png;base64,' + readFileSync(SRC).toString('base64'), H]);
writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64')); await b.close(); console.log('OK', OUT);
