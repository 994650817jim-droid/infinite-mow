// 吕布方天画戟特效（2026-11-19，ChatGPT 黑底 6 列 × 4 行，每行 6 帧）→ 每行一条透明横排 6 帧（每格 256）：
//   行 0 戟刺 → public/assets/hero-fx/lvbu/thrust.png（fx_lvbu_thrust，朝右）
//   行 1 横扫 → public/assets/hero-fx/lvbu/sweep.png（fx_lvbu_sweep）
//   行 2 掷戟 → public/assets/hero-fx/lvbu/halberd.png（fx_lvbu_halberd，循环）
//   行 3 无双 → public/assets/hero-fx/cast/cast_lvbu.png（fx_cast_lvbu，HeroCastFx / 无双爆发）
// 去底同 build-hero-cast-fx.mjs（黑底按亮度反解不透明度，适合 ADD 叠加）。原图 public/assets/hero-fx/lvbu/originals/lvbu_fx_sheet.png。
// 用法：node tools/build-lvbu-fx.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const DIR = 'public/assets/hero-fx/lvbu/', INSET = +(process.env.INSET ?? 8);
const OUT = [DIR + 'thrust.png', DIR + 'sweep.png', DIR + 'halberd.png', 'public/assets/hero-fx/cast/cast_lvbu.png'];
mkdirSync(DIR, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const strips = await p.evaluate(async ([u, n, INSET]) => {
  const im = new Image(); im.src = u; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); const al = m < 16 ? 0 : Math.min(255, (m - 16) * 255 / 239); if (al > 0) { const k = 255 / Math.max(m, 1); a[i] = Math.min(255, a[i] * k); a[i + 1] = Math.min(255, a[i + 1] * k); a[i + 2] = Math.min(255, a[i + 2] * k); } a[i + 3] = al; }
  g.putImageData(d, 0, 0);
  const cw = c.width / 6, ch = c.height / n, out = [];
  for (let r = 0; r < n; r++) {
    const o = document.createElement('canvas'); o.width = 256 * 6; o.height = 256; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    for (let f = 0; f < 6; f++) { const sx = f * cw + INSET, sy = r * ch + INSET, sw = cw - INSET * 2, shh = ch - INSET * 2, s = Math.min(256 / sw, 256 / shh), w = sw * s, h = shh * s; og.drawImage(c, sx, sy, sw, shh, f * 256 + (256 - w) / 2, (256 - h) / 2, w, h); }
    out.push(o.toDataURL('image/png'));
  }
  return out;
}, ['data:image/png;base64,' + readFileSync(DIR + 'originals/lvbu_fx_sheet.png').toString('base64'), 4, INSET]);
strips.forEach((u, i) => { writeFileSync(OUT[i], Buffer.from(u.split(',')[1], 'base64')); console.log('→', OUT[i]); });
await b.close();
