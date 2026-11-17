// 加强图集里指定行的不透明度（手绘预警行太淡、读不出范围时用）：a' = min(1, a × mul)，颜色不变。
// 用法：node tools/boost-alpha.mjs <png> <格高> <行号,行号…(从 1 起)> <倍数>（原地改写）
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const [f, chS, rowsS, mulS] = process.argv.slice(2), CH = +chS, ROWS = rowsS.split(',').map(Number), MUL = +mulS;
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ([url, CH, ROWS, MUL]) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (const r of ROWS) for (let y = (r - 1) * CH; y < r * CH && y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4 + 3; a[i] = Math.min(255, Math.round(a[i] * MUL)); }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, ['data:image/png;base64,' + readFileSync(f).toString('base64'), CH, ROWS, MUL]);
  writeFileSync(f, Buffer.from(data, 'base64')); console.log('boosted', f, ROWS.join(','), '×' + MUL);
} finally { await b.close(); }
