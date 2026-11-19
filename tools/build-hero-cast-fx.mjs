// 武将出招起手特效（2026-11-19，ChatGPT 黑底 6 列 × 4 行出图，每行一位武将 6 帧）→ 每人一条透明横排 6 帧（每格 256）：
//   public/assets/hero-fx/cast/cast_<武将>.png（SKILL_FX fx_cast_<武将>，systems/HeroCastFx.ts 用）
// 去底：黑底发光图按亮度反解不透明度（同 build-zhuge-tianhuo-fx.mjs），适合 ADD 叠加；每格等比缩进 256、居中；左上角 ChatGPT 不加水印，不处理。
// 原图：public/assets/hero-fx/cast/originals/cast_sheet_{1,2,3}.png，行序见 SHEETS。
// 用法：node tools/build-hero-cast-fx.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const DIR = 'public/assets/hero-fx/cast/', INSET = +(process.env.INSET ?? 8);
const SHEETS = [
  { src: 'cast_sheet_1.png', rows: ['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong'] },
  { src: 'cast_sheet_2.png', rows: ['machao', 'weiyan', 'liubei', 'zhuge'] },
  { src: 'cast_sheet_3.png', rows: ['pangtong', 'huangyueying', 'sunshangxiang', 'diaochan'] },
];
mkdirSync(DIR, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
for (const sh of SHEETS) {
  const path = DIR + 'originals/' + sh.src; if (!existsSync(path)) { console.log('跳过（没有原图）', path); continue; }
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
  }, ['data:image/png;base64,' + readFileSync(path).toString('base64'), sh.rows.length, INSET]);
  strips.forEach((u, i) => { const f = DIR + 'cast_' + sh.rows[i] + '.png'; writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log('→', f); });
}
await b.close();
