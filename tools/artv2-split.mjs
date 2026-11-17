// 人物画风 v2：把处理好的 4 列 × N 行图集按行切成几张（例：4×8 → 行走 4×4 + 攻击 4×4）。
// 用法：node tools/artv2-split.mjs <in.png> <out1.png>:<起始行>:<行数> [<out2.png>:<起始行>:<行数> …]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, ...outs] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const url = 'data:image/png;base64,' + readFileSync(src).toString('base64');
  for (const spec of outs) {
    const [out, from, rows] = spec.split(':').reduce((acc, part, i, all) => i < all.length - 2 ? [acc[0] ? acc[0] + ':' + part : part] : [...acc, +part], []);
    const data = await p.evaluate(async ([url, from, rows]) => {
      const img = new Image(); img.src = url; await img.decode();
      const cell = img.width / 4, c = document.createElement('canvas'); c.width = img.width; c.height = cell * rows;
      c.getContext('2d').drawImage(img, 0, from * cell, img.width, cell * rows, 0, 0, img.width, cell * rows);
      return c.toDataURL('image/png');
    }, [url, from, rows]);
    writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
    console.log(out, `行 ${from}~${from + rows - 1}`);
  }
} finally { await b.close(); }
