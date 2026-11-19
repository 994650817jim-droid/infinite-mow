// 诸葛亮补充手绘特效（2026-11-18 晚，即梦 Seedream 5.5 黑底出图）→ 透明 8 帧单行图集：
//   KIND=ember：天火余烬「星火焦土」，源图 4 列 × 2 行 → public/assets/hero-fx/zhuge_ember.png（每格 256×256；0 星火落地、1 七星焦土燃起、2–5 灼烧循环、6 余火转暗、7 零星火星）
//   KIND=wind ：借东风「东风气流」，源图 2 列 × 4 行横条 → public/assets/hero-fx/zhuge_wind.png（每格 512×128；0 起风、1 拉长、2–5 横扫、6 变淡、7 残风）
// 去底与 build-zhuge-tianhuo-fx.mjs 一样：黑底发光图按亮度反解不透明度，适合 ADD 叠加。即梦左上角「AI生成」水印先涂黑（WM=宽,高 比例，默认 .12,.09）。
// 每格等比缩放进目标格（不拉伸）、居中；wind 横条两端各羽化 14%。对应 weapons/zhugeTianhuo.ts emberFx / eastWindFx。
// 用法：KIND=ember|wind [SRC=原图] [INSET=10] node tools/build-zhuge-extra-fx.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const KIND = process.env.KIND ?? 'ember';
const CFG = { ember: { src: 'zhuge_ember_jimeng.png', out: 'zhuge_ember.png', cols: 4, rows: 2, fw: 256, fh: 256 }, wind: { src: 'zhuge_wind_jimeng.png', out: 'zhuge_wind.png', cols: 2, rows: 4, fw: 512, fh: 128, feather: .14 } }[KIND];
if (!CFG) { console.error('KIND 只能是 ember / wind'); process.exit(2); }
const SRC = process.env.SRC ?? 'public/assets/hero-fx/originals/' + CFG.src, OUT = 'public/assets/hero-fx/' + CFG.out, INSET = +(process.env.INSET ?? 10);
const [WMW, WMH] = (process.env.WM ?? '.12,.09').split(',').map(Number);
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const url = await p.evaluate(async ([u, c0, INSET, WMW, WMH]) => {
  const im = new Image(); im.src = u; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  g.fillStyle = '#000'; g.fillRect(0, 0, Math.round(im.width * WMW), Math.round(im.height * WMH)); // 水印
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); const al = m < 14 ? 0 : Math.min(255, (m - 14) * 255 / 241); if (al > 0) { const k = 255 / Math.max(m, 1); a[i] = Math.min(255, a[i] * k); a[i + 1] = Math.min(255, a[i + 1] * k); a[i + 2] = Math.min(255, a[i + 2] * k); } a[i + 3] = al; }
  g.putImageData(d, 0, 0);
  const n = c0.cols * c0.rows, out = document.createElement('canvas'); out.width = c0.fw * n; out.height = c0.fh; const og = out.getContext('2d'); og.imageSmoothingQuality = 'high';
  const cw = c.width / c0.cols, ch = c.height / c0.rows;
  for (let f = 0; f < n; f++) { const sx = (f % c0.cols) * cw + INSET, sy = Math.floor(f / c0.cols) * ch + INSET, sw = cw - INSET * 2, sh = ch - INSET * 2, s = Math.min(c0.fw / sw, c0.fh / sh), w = sw * s, h = sh * s;
    const t = document.createElement('canvas'); t.width = c0.fw; t.height = c0.fh; const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high';
    tg.drawImage(c, sx, sy, sw, sh, (c0.fw - w) / 2, (c0.fh - h) / 2, w, h);
    // 横条两端羽化：源图风痕常顶到格子边，直接切开在游戏里是一道硬边（单独一格画布上做，destination-in 会清掉画布上其余部分）
    if (c0.feather) { const gr = tg.createLinearGradient(0, 0, c0.fw, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(c0.feather, 'rgba(0,0,0,1)'); gr.addColorStop(1 - c0.feather, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      tg.globalCompositeOperation = 'destination-in'; tg.fillStyle = gr; tg.fillRect(0, 0, c0.fw, c0.fh); }
    og.drawImage(t, f * c0.fw, 0); }
  return out.toDataURL('image/png');
}, ['data:image/png;base64,' + readFileSync(SRC).toString('base64'), CFG, INSET, WMW, WMH]);
writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64')); console.log('→', OUT);
await b.close();
