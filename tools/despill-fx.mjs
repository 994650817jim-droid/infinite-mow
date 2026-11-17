// 去洋红溢色：切好帧的透明特效图（暖色系：金 / 红 / 橙），边缘半透明处残留的洋红色偏 → 蓝通道压到不超过绿通道，并按溢色程度降低不透明度。
// 只适合本身不该带紫 / 粉色的特效（首领手绘特效 boss-fx）。用法：node tools/despill-fx.mjs <png>...（原地改写）
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  for (const f of process.argv.slice(2)) {
    const url = 'data:image/png;base64,' + readFileSync(f).toString('base64');
    const out = await p.evaluate(async url => {
      const im = new Image(); im.src = url; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), a = d.data; let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue; const r = a[i], gr = a[i + 1], bl = a[i + 2];
        if (bl > gr + 8) { const spill = bl - gr; a[i + 2] = gr; a[i] = Math.max(gr, r - spill * .35); a[i + 3] = Math.round(a[i + 3] * Math.max(.15, 1 - spill / 255 * .9)); n++; }
      }
      g.putImageData(d, 0, 0); return { n, data: c.toDataURL('image/png').split(',')[1] };
    }, url);
    writeFileSync(f, Buffer.from(out.data, 'base64')); console.log(f, 'despilled px', out.n);
  }
} finally { await b.close(); }
