// 白底手绘图抠图：从图边缘洪水填充近白像素为透明（主体与底色接近时用，如浅色旗面），边缘按色差做 1–2 像素羽化。
// 用法：node tools/cutout-flood.mjs in.png out.png [容差=28]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [, , inp, outp, tolArg] = process.argv; const tol = Number(tolArg ?? 28);
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const data = 'data:image/png;base64,' + readFileSync(inp).toString('base64');
const res = await p.evaluate(async ([src, tol]) => {
  const img = new Image(); img.src = src; await img.decode(); const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), a = d.data, seen = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
  const bg = i => 255 * 3 - (a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) <= tol * 3;
  const push = i => { if (!seen[i] && bg(i)) { seen[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) { const i = q[qh++], x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  for (let i = 0; i < w * h; i++) if (seen[i]) a[i * 4 + 3] = 0;
  // 羽化：与背景相邻的主体像素按亮度降一点不透明度
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (seen[i]) continue; if (seen[i - 1] || seen[i + 1] || seen[i - w] || seen[i + w]) { const l = (a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) / 3; a[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(.35, (255 - l) / 60 + .35))); } }
  g.putImageData(d, 0, 0); return c.toDataURL('image/png');
}, [data, tol]);
writeFileSync(outp, Buffer.from(res.split(',')[1], 'base64')); await b.close(); console.log('saved', outp);
