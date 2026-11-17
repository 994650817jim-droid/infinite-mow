// 人物画风 v2：把几张同宽的网格图上下拼成一张（Gemini 只出正方形图，首领 4×8 分两张 4×4 出：行走 + 动作）。
// 用法：node tools/artv2-stack.mjs <out.png> <top.png> <bottom.png> [...]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [out, ...ins] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async urls => {
    const ims = await Promise.all(urls.map(async u => { const i = new Image(); i.src = u; await i.decode(); return i; }));
    const W = ims[0].width, c = document.createElement('canvas');
    c.width = W; c.height = ims.reduce((h, i) => h + Math.round(i.height * W / i.width), 0);
    const g = c.getContext('2d'); let y = 0;
    for (const i of ims) { const h = Math.round(i.height * W / i.width); g.drawImage(i, 0, y, W, h); y += h; }
    return c.toDataURL('image/png');
  }, ins.map(f => 'data:image/png;base64,' + readFileSync(f).toString('base64')));
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(out, '拼接', ins.length, '张');
} finally { await b.close(); }
