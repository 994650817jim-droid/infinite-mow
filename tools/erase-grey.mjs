// 处理后图集里残留的低饱和灰块（AI 背景光晕被围在弓 / 马腿之间）擦成透明：node tools/erase-grey.mjs <in.png> <out.png> <max-min 阈值 16> <亮度下限 120> <亮度上限 215>；先用 flood-magenta.mjs 填外围背景。
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const [src, out, mxmn, lo, hi] = process.argv.slice(2); const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const url = await p.evaluate(async ([data, MM, LO, HI]) => { const im = new Image(); im.src = data; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, c.width, c.height), d = img.data; let n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), L = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; if (mx - mn < MM && L > LO && L < HI) { d[i + 3] = 0; n++; } }
  g.putImageData(img, 0, 0); return c.toDataURL('image/png') + '|' + n; }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), +mxmn, +lo, +hi]);
const [u, n] = url.split('|'); writeFileSync(out, Buffer.from(u.split(',')[1], 'base64')); console.log('erased', n); await b.close();
