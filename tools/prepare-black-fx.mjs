// 黑底手绘特效序列帧 → 透明底：缩放到 SIZE（默认 1024）后按亮度取 alpha（alpha = min(1, max(R,G,B)/RAMP)，颜色反除 alpha，叠在任何底色上都和「黑底加亮」一样）。
// 用法：node tools/prepare-black-fx.mjs in.png out.png [SIZE=1024 RAMP=70]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2), SIZE = +(process.env.SIZE ?? 1024), RAMP = +(process.env.RAMP ?? 70);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const url = await page.evaluate(async ([u, S, R]) => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const m = Math.max(p[i], p[i + 1], p[i + 2]), a = Math.min(1, Math.max(0, (m - 6) / (R - 6))); if (a <= 0.004) { p[i + 3] = 0; continue; } p[i] = Math.min(255, p[i] / a); p[i + 1] = Math.min(255, p[i + 1] / a); p[i + 2] = Math.min(255, p[i + 2] / a); p[i + 3] = Math.round(a * 255); }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), SIZE, RAMP]);
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out);
} finally { await b.close(); }
