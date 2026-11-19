// 诸葛亮「七星灯 · 天火」手绘特效（2026-11-18，Gemini 黑底出图）→ 透明序列帧：
//   public/assets/hero-fx/zhuge_tianhuo.png：8 列 × 3 行、每格 256（行 0 星位 6 帧、行 1 天火 8 帧、行 2 八阵 6 帧；对应 weapons/zhugeTianhuo.ts ZGFX）
//   public/assets/hero-fx/zhuge_eastwind.png：1 行 6 帧、每帧 512×128（东风火龙横条）
// 去底：黑底发光图按亮度反解不透明度（a = max(r,g,b)，颜色 /a），适合 ADD 叠加；每格等比缩放进目标格（不拉伸），居中。
// 用法：STAR=原图 FALL=原图 BAZHEN=原图 WIND=原图 [INSET=12] node tools/build-zhuge-tianhuo-fx.mjs
//   原图版式：STAR 3 列 × 2 行、FALL 4 列 × 2 行、BAZHEN 3 列 × 2 行、WIND 1 列 × 6 行。缺哪张就跳过那一部分（原有格子保持透明）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const INSET = +(process.env.INSET ?? 12), OUT = 'public/assets/hero-fx/';
// 可选 STAR_PICK / FALL_PICK / BAZHEN_PICK：按源图格子序号（0 起）挑帧组成序列，如 2,3,4,5,4,3（源图帧不一致时用来拼出能循环的一组）
const PICK = Object.fromEntries(['STAR', 'FALL', 'BAZHEN'].map(k => [k, process.env[k + '_PICK'] ? process.env[k + '_PICK'].split(',').map(Number) : null]));
const src = k => process.env[k] && existsSync(process.env[k]) ? 'data:image/' + (/\.png$/i.test(process.env[k]) ? 'png' : 'jpeg') + ';base64,' + readFileSync(process.env[k]).toString('base64') : null;
const jobs = { STAR: { cols: 3, rows: 2, n: 6, row: 0 }, FALL: { cols: 4, rows: 2, n: 8, row: 1 }, BAZHEN: { cols: 3, rows: 2, n: 6, row: 2 } };
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const res = await p.evaluate(async ([jobs, srcs, wind, INSET, pick]) => {
  const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
  // 黑底 → 透明（亮度即不透明度），返回处理后的整张画布
  const key = im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); let al = m < 14 ? 0 : Math.min(255, (m - 14) * 255 / 241); if (al > 0) { const k = 255 / Math.max(m, 1); a[i] = Math.min(255, a[i] * k); a[i + 1] = Math.min(255, a[i + 1] * k); a[i + 2] = Math.min(255, a[i + 2] * k); } a[i + 3] = al; }
    g.putImageData(d, 0, 0); return c; };
  const fit = (dst, src, sx, sy, sw, sh, dx, dy, dw, dh) => { const s = Math.min(dw / sw, dh / sh), w = sw * s, h = sh * s; dst.drawImage(src, sx, sy, sw, sh, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h); };
  const sheet = document.createElement('canvas'); sheet.width = 2048; sheet.height = 768; const sg = sheet.getContext('2d'); sg.imageSmoothingQuality = 'high';
  const done = [];
  for (const [name, j] of Object.entries(jobs)) {
    if (!srcs[name]) continue; const k = key(await load(srcs[name])), cw = k.width / j.cols, ch = k.height / j.rows;
    for (let f = 0; f < j.n; f++) { const sf = pick[name]?.[f] ?? f, cx = sf % j.cols, cy = Math.floor(sf / j.cols); fit(sg, k, cx * cw + INSET, cy * ch + INSET, cw - INSET * 2, ch - INSET * 2, f * 256, j.row * 256, 256, 256); }
    done.push(name);
  }
  let windUrl = null;
  if (wind) { const k = key(await load(wind)), ch = k.height / 6, c = document.createElement('canvas'); c.width = 3072; c.height = 128; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    for (let f = 0; f < 6; f++) fit(g, k, INSET, f * ch + INSET, k.width - INSET * 2, ch - INSET * 2, f * 512, 0, 512, 128);
    windUrl = c.toDataURL('image/png'); done.push('WIND'); }
  return { sheet: done.some(d => d !== 'WIND') ? sheet.toDataURL('image/png') : null, wind: windUrl, done };
}, [jobs, { STAR: src('STAR'), FALL: src('FALL'), BAZHEN: src('BAZHEN') }, src('WIND'), INSET, PICK]);
// 部分重做时保留已有格子：读旧图，把本次没给的行沿用下来
if (res.sheet) {
  if (existsSync(OUT + 'zhuge_tianhuo.png') && res.done.length < 3) {
    const merged = await p.evaluate(async ([oldU, newU, keep]) => { const ld = async u => { const im = new Image(); im.src = u; await im.decode(); return im; }; const o = await ld(oldU), n = await ld(newU);
      const c = document.createElement('canvas'); c.width = 2048; c.height = 768; const g = c.getContext('2d'); g.drawImage(n, 0, 0); for (const row of keep) { g.clearRect(0, row * 256, 2048, 256); g.drawImage(o, 0, row * 256, 2048, 256, 0, row * 256, 2048, 256); } return c.toDataURL('image/png'); },
      ['data:image/png;base64,' + readFileSync(OUT + 'zhuge_tianhuo.png').toString('base64'), res.sheet, Object.entries(jobs).filter(([k]) => !res.done.includes(k)).map(([, j]) => j.row)]);
    res.sheet = merged;
  }
  writeFileSync(OUT + 'zhuge_tianhuo.png', Buffer.from(res.sheet.split(',')[1], 'base64')); console.log('→', OUT + 'zhuge_tianhuo.png');
}
if (res.wind) { writeFileSync(OUT + 'zhuge_eastwind.png', Buffer.from(res.wind.split(',')[1], 'base64')); console.log('→', OUT + 'zhuge_eastwind.png'); }
console.log('done', res.done.join(','));
await b.close();
