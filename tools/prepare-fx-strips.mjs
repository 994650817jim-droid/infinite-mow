// 黑底 6 列 × N 行特效图 → 每行一条透明横条（W×256；SkillFxSheets 按 cell 256 切帧）。亮度取 alpha（alpha = min(1, max(R,G,B)/RAMP)，颜色反除 alpha）。
// 用法：node tools/prepare-fx-strips.mjs in.png outDir name1,name2,name3,name4   （每个名字对应一行，输出 outDir/<name>.png；RAMP=70 COLS=6 CELL=256 ROWS=4）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [src, outDir, names = ''] = process.argv.slice(2), E = process.env, COLS = +(E.COLS ?? 6), CELL = +(E.CELL ?? 256), RAMP = +(E.RAMP ?? 70), ROWS = names.split(',').length;
mkdirSync(outDir, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const urls = await page.evaluate(async ([u, W, H, R, C]) => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const m = Math.max(p[i], p[i + 1], p[i + 2]), a = Math.min(1, Math.max(0, (m - 6) / (R - 6))); if (a <= .004) { p[i + 3] = 0; continue; } p[i] = Math.min(255, p[i] / a); p[i + 1] = Math.min(255, p[i + 1] / a); p[i + 2] = Math.min(255, p[i + 2] / a); p[i + 3] = Math.round(a * 255); }
    g.putImageData(d, 0, 0); const out = [];
    for (let r = 0; r < H / C; r++) { const s = document.createElement('canvas'); s.width = W; s.height = C; s.getContext('2d').drawImage(c, 0, r * C, W, C, 0, 0, W, C); out.push(s.toDataURL('image/png')); }
    return out;
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), COLS * CELL, ROWS * CELL, RAMP, CELL]);
  names.split(',').forEach((n, i) => { writeFileSync(`${outDir}/${n}.png`, Buffer.from(urls[i].split(',')[1], 'base64')); console.log('wrote', `${outDir}/${n}.png`); });
} finally { await b.close(); }
