// 黑底手绘特效序列帧 → 透明底：缩放到 SIZE（默认 1024）后按亮度取 alpha（alpha = min(1, max(R,G,B)/RAMP)，颜色反除 alpha，叠在任何底色上都和「黑底加亮」一样）。
// 用法：node tools/prepare-black-fx.mjs in.png out.png [SIZE=1024 RAMP=70]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2), SIZE = +(process.env.SIZE ?? 1024), RAMP = +(process.env.RAMP ?? 70), FADE_ROWS = (process.env.FADE_ROWS ?? '').split(',').filter(Boolean).map(Number), FADE = +(process.env.FADE ?? 40);   // FADE_ROWS：这些行（0 起）的每格左右边缘各 FADE px 渐隐（贯穿整格的冲击带，拉伸后两端不要有硬边）
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const url = await page.evaluate(async ([u, S, R, FR, FD]) => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const m = Math.max(p[i], p[i + 1], p[i + 2]), a = Math.min(1, Math.max(0, (m - 6) / (R - 6))); if (a <= 0.004) { p[i + 3] = 0; continue; } p[i] = Math.min(255, p[i] / a); p[i + 1] = Math.min(255, p[i + 1] / a); p[i + 2] = Math.min(255, p[i + 2] / a); p[i + 3] = Math.round(a * 255); }
    if (FR.length) { const cell = S / 4; for (const row of FR) for (let y = row * cell; y < (row + 1) * cell; y++) for (let x = 0; x < S; x++) { const cx = x % cell, e = Math.min(cx, cell - 1 - cx); if (e < FD) p[(y * S + x) * 4 + 3] *= e / FD; } }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), SIZE, RAMP, FADE_ROWS, FADE]);
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out);
} finally { await b.close(); }
