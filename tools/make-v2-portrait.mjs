// v2 武将的 512² 头像（processed/<id>_portrait.png，选将 / 天赋印 / 援军卡用）：取 hero-actions-v2/<id>.png 第一格待机帧（232²），
// 裁到不透明包围盒后等比放大进 512² 透明底（脚底留 24px）。用法：node tools/make-v2-portrait.mjs lvbu
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  for (const id of process.argv.slice(2)) {
    const url = await p.evaluate(async src => {
      const im = new Image(); im.src = src; await im.decode(); const C = 232;
      const c = document.createElement('canvas'); c.width = C; c.height = C; const g = c.getContext('2d'); g.drawImage(im, 0, 0, C, C, 0, 0, C, C);
      const d = g.getImageData(0, 0, C, C).data; let x0 = C, y0 = C, x1 = 0, y1 = 0;
      for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (d[(y * C + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const w = x1 - x0 + 1, h = y1 - y0 + 1, s = Math.min(470 / w, 470 / h);
      const o = document.createElement('canvas'); o.width = o.height = 512; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      og.drawImage(c, x0, y0, w, h, (512 - w * s) / 2, 512 - 24 - h * s, w * s, h * s);
      return o.toDataURL('image/png');
    }, 'data:image/png;base64,' + readFileSync(`public/assets/hero-actions-v2/${id}.png`).toString('base64'));
    writeFileSync(`public/assets/processed/${id}_portrait.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(id, 'portrait ok');
  }
} finally { await b.close(); }
