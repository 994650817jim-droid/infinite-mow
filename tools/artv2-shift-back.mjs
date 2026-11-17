// 人物画风 v2：倒地帧（1 行 N 帧、朝右）把第 FROM 帧起的身体整体往后（左）移，让身体右端不超过脚底中心 + MARGIN（像素，原生）。
// 首领倒地后宝箱落在原地，尸体不压住宝箱。用法：[FROM=1] [MARGIN=40] node tools/artv2-shift-back.mjs <in.png> [out.png]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out = src] = process.argv.slice(2), FROM = +(process.env.FROM ?? 1), MARGIN = +(process.env.MARGIN ?? 40);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([url, FROM, MARGIN]) => {
    const img = new Image(); img.src = url; await img.decode();
    const cell = img.height, n = Math.round(img.width / cell), c = document.createElement('canvas'); c.width = img.width; c.height = cell;
    const g = c.getContext('2d', { willReadFrequently: true }), log = [];
    for (let f = 0; f < n; f++) {
      const t = document.createElement('canvas'); t.width = t.height = cell; const tg = t.getContext('2d', { willReadFrequently: true });
      tg.drawImage(img, f * cell, 0, cell, cell, 0, 0, cell, cell);
      let dx = 0;
      if (f >= FROM) {
        const d = tg.getImageData(0, 0, cell, cell).data; let x0 = cell, x1 = -1;
        for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (d[(y * cell + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
        if (x1 >= 0) { const want = cell / 2 + MARGIN; dx = Math.min(0, want - x1); dx = Math.max(dx, -x0); } // 只往左移，且不移出格子
      }
      g.drawImage(t, f * cell + dx, 0); log.push(dx);
    }
    return { data: c.toDataURL('image/png'), log };
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), FROM, MARGIN]);
  writeFileSync(out, Buffer.from(res.data.split(',')[1], 'base64'));
  console.log(out, '各帧左移', res.log.join(' '));
} finally { await b.close(); }
