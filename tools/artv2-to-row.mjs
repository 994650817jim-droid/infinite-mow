// 人物画风 v2：把 C 列 × R 行的方格图集按「从左到右、从上到下」排成 1 行（例：倒地帧 2×2 → 1×4）。
// 用法：node tools/artv2-to-row.mjs <in.png> <out.png> <列数>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out, colsArg] = process.argv.slice(2), COLS = +colsArg;
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ([url, COLS]) => {
    const img = new Image(); img.src = url; await img.decode();
    const cell = img.width / COLS, rows = Math.round(img.height / cell), c = document.createElement('canvas');
    c.width = cell * COLS * rows; c.height = cell; const g = c.getContext('2d');
    for (let r = 0; r < rows; r++) for (let k = 0; k < COLS; k++) g.drawImage(img, k * cell, r * cell, cell, cell, (r * COLS + k) * cell, 0, cell, cell);
    return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), COLS]);
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(out);
} finally { await b.close(); }
