// 背面冲车 4 帧图集（2026-11-21）：ChatGPT 绿底 4×1 → 去绿 → 每帧 256×256 透明格，整张 1024×256；并排预览（上：现有正面 ram.png 前 4 帧；下：背面）。
// 缩放：整套用同一个比例，让「第 1 帧车体宽」= 正面冲车第 1 帧车体宽（大小对齐）；每帧车轮底边落在第 FOOT 行、水平按车体重心居中。
// 用法：SRC=…/ram_back_keyed.png（已去绿的透明 PNG）FRONT=public/assets/siege-v2/ram.png OUT=public/assets/siege-v2/defense-v2/ram_back.png PREVIEW=…/ram_back_compare.png node tools/make-ram-back.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'), FOOT = +(E.FOOT ?? 244);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([src, front, FOOT]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const bi = await load(src), fi = await load(front), cw = bi.width / 4, bbox = (im, x0, y0, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, x0, y0, w, h, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; let a = w, b2 = 0, c2 = h, e = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < a) a = x; if (x > b2) b2 = x; if (y < c2) c2 = y; if (y > e) e = y; } return [a, c2, b2, e]; };
    const fb = bbox(fi, 0, 0, 256, 256), frontW = fb[2] - fb[0] + 1, frontH = fb[3] - fb[1] + 1;
    const bb = [0, 1, 2, 3].map(k => bbox(bi, k * cw, 0, cw, bi.height)); const w0 = bb[0][2] - bb[0][0] + 1, s = frontW / w0;
    const out = document.createElement('canvas'); out.width = 1024; out.height = 256; const g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
    const info = [];
    for (let k = 0; k < 4; k++) { const [x0, y0, x1, y1] = bb[k], w = x1 - x0 + 1, h = y1 - y0 + 1, dw = w * s, dh = h * s; // 车体范围：忽略顶部露出的撞锤，用车轮底 y1 对齐 FOOT，水平按框中心
      g.drawImage(bi, k * cw + x0, y0, w, h, k * 256 + 128 - dw / 2, FOOT - dh, dw, dh); info.push([Math.round(dw), Math.round(dh)]); }
    const pv = document.createElement('canvas'); pv.width = 1024; pv.height = 520; const pg = pv.getContext('2d'); pg.fillStyle = '#777'; pg.fillRect(0, 0, 1024, 520);
    pg.drawImage(fi, 0, 0, 1024, 256, 0, 0, 1024, 256); pg.drawImage(out, 0, 264); pg.fillStyle = '#0ff'; pg.font = '14px sans-serif'; pg.fillText('现有正面 ram.png 前 4 帧', 6, 14); pg.fillText('背面 ram_back.png', 6, 278);
    return { frontBox: [frontW, frontH], scale: s, info, sheet: out.toDataURL('image/png'), prev: pv.toDataURL('image/png') };
  }, [rd(E.SRC), rd(E.FRONT), FOOT]);
  fs.writeFileSync(E.OUT, Buffer.from(r.sheet.split(',')[1], 'base64')); if (E.PREVIEW) fs.writeFileSync(E.PREVIEW, Buffer.from(r.prev.split(',')[1], 'base64'));
  console.log(JSON.stringify({ front: r.frontBox, scale: r.scale, frames: r.info }));
} finally { await b.close(); }
