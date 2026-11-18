// 城池界面「可升级 / 可建造」小徽记：洋红底左右两枚 → public/assets/town-city/badge_upgrade.png、badge_build.png（各 256×256，透明底，居中）。
// 用法：node tools/prepare-town-badges.mjs <原图.png>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = process.argv[2];
if (!src) throw new Error('用法：node tools/prepare-town-badges.mjs <原图.png>');
mkdirSync('public/assets/town-city', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async data => {
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
    const out = [];
    for (let k = 0; k < 2; k++) {
      const x = k * W / 2, w = W / 2; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let yy = 0; yy < H; yy++) for (let xx = Math.floor(x); xx < x + w; xx++) if (d[(yy * W + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = 6, s = Math.min((256 - 2 * pad) / bw, (256 - 2 * pad) / bh);
      const o = document.createElement('canvas'); o.width = 256; o.height = 256; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      og.drawImage(cv, x0, y0, bw, bh, (256 - bw * s) / 2, (256 - bh * s) / 2, bw * s, bh * s);
      out.push({ url: o.toDataURL('image/png'), box: bw + '×' + bh });
    }
    return out;
  }, 'data:image/png;base64,' + readFileSync(src).toString('base64'));
  ['badge_upgrade', 'badge_build'].forEach((n, k) => { writeFileSync(`public/assets/town-city/${n}.png`, Buffer.from(res[k].url.split(',')[1], 'base64')); console.log(n, '外框', res[k].box); });
} finally { await b.close(); }
