// 透明底素材图集按网格切块：每格按不透明像素裁边（留 PAD），缩到 MAX 边长以内，输出 webp。
// 用法：[FLOOR=70] COLS=2 ROWS=2 NAMES=bundle,bundle_hover,pocket,pocket_slot [MAX=256] [PAD=4] node tools/crop-alpha-grid.mjs <in.png> <outDir>
//   NAMES 里写 - 的格子跳过。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [src, outDir] = process.argv.slice(2), e = process.env;
const COLS = +(e.COLS ?? 2), ROWS = +(e.ROWS ?? 2), MAX = +(e.MAX ?? 256), PAD = +(e.PAD ?? 4), FLOOR = +(e.FLOOR ?? 0), NAMES = (e.NAMES ?? '').split(',');
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([url, COLS, ROWS, MAX, PAD, NAMES, FLOOR]) => {
    const img = new Image(); img.src = url; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    // FLOOR：低于此不透明度的像素清掉（ChatGPT 的透明图常在物件周围带一圈很淡的彩色雾），其余按 FLOOR→255 拉开
    const idata = g.getImageData(0, 0, cv.width, cv.height), d = idata.data;
    if (FLOOR > 0) { for (let i = 3; i < d.length; i += 4) d[i] = d[i] < FLOOR ? 0 : Math.round((d[i] - FLOOR) * 255 / (255 - FLOOR)); g.putImageData(idata, 0, 0); }
    const cw = cv.width / COLS, ch = cv.height / ROWS, out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const name = NAMES[r * COLS + c]; if (!name || name === '-') continue;
      const x0 = Math.round(c * cw), y0 = Math.round(r * ch), x1 = Math.round((c + 1) * cw), y1 = Math.round((r + 1) * ch);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (d[(y * cv.width + x) * 4 + 3] > 24) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      if (bx1 < 0) { out.push({ name, err: 'empty' }); continue; }
      bx0 = Math.max(x0, bx0 - PAD); by0 = Math.max(y0, by0 - PAD); bx1 = Math.min(x1 - 1, bx1 + PAD); by1 = Math.min(y1 - 1, by1 + PAD);
      const w = bx1 - bx0 + 1, h = by1 - by0 + 1, k = Math.min(1, MAX / Math.max(w, h)), o = document.createElement('canvas'); o.width = Math.round(w * k); o.height = Math.round(h * k);
      const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cv, bx0, by0, w, h, 0, 0, o.width, o.height);
      out.push({ name, w: o.width, h: o.height, data: o.toDataURL('image/webp', .92) });
    }
    return out;
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), COLS, ROWS, MAX, PAD, NAMES, FLOOR]);
  for (const r of res) { if (r.err) { console.log(r.name, r.err); continue; } writeFileSync(`${outDir}/${r.name}.webp`, Buffer.from(r.data.split(',')[1], 'base64')); console.log(r.name, `${r.w}×${r.h}`); }
} finally { await b.close(); }
