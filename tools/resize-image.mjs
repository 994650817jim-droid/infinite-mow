// 把图片缩放到指定边长（高质量），用于把 2048 的新地面贴图缩到和现有 ground_*.png 一样的 1254。
// 用法：node tools/resize-image.mjs <in.png> <out.png> <边长>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out, size] = process.argv.slice(2);
if (!inp || !out || !size) { console.error('用法：node tools/resize-image.mjs <in> <out> <size>'); process.exit(2); }
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const url = await p.evaluate(async ([data, S]) => { const im = new Image(); im.src = data; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, S, S); return c.toDataURL('image/png'); }, ['data:image/png;base64,' + readFileSync(inp).toString('base64'), +size]);
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out, size);
} finally { await b.close(); }
