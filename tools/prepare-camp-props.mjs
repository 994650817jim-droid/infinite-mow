// 营寨小道具：洋红底一张图（左竖条 = 「义」字大旗；右 4×3 格 = 火塘 8 帧 + 木人桩 3 帧）
// → public/assets/props-v2/camp-banner.png（1 帧 256×512）、camp-firepit.png（8 帧 每帧 256×256）、camp-dummy.png（3 帧 每帧 256×256）。
// 同一道具的各帧用同一个缩放；水平按「底部 35% 不透明像素的中心」对齐（火塘 / 木人桩底座每帧不动，只有火苗 / 歪斜变化），底边贴格子下沿。
// 用法：node tools/prepare-camp-props.mjs <原图.png>（不需要开发服务器）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = process.argv[2];
if (!src) throw new Error('用法：node tools/prepare-camp-props.mjs <原图.png>');
mkdirSync('public/assets/props-v2', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async data => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.max(0, Math.min(R, B) - G);
      const a = m >= 200 ? 0 : m <= 18 ? 1 : 1 - (m - 18) / 182; let r2 = R, b2 = B;
      if (a > 0 && a < 1) { r2 = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)); b2 = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a)); }
      const spill = Math.max(0, Math.min(r2, b2) - G); d[i] = r2 - spill; d[i + 2] = b2 - spill; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    const bbox = ([x, y, w, h]) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (d[(yy * W + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      let sx = 0, n = 0; const yLow = y1 - Math.round((y1 - y0 + 1) * .35);
      for (let yy = yLow; yy <= y1; yy++) for (let xx = x; xx < x + w; xx++) if (d[(yy * W + xx) * 4 + 3] > 40) { sx += xx; n++; }
      return { x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1, cx: n ? sx / n : (x0 + x1) / 2 };
    };
    // 一组帧 → 一条横排图：共用缩放，底部中心对齐
    const strip = (rects, fw, fh, pad, centerBy) => {
      const bs = rects.map(bbox), s = Math.min(...bs.map(o => Math.min((fw - 2 * pad) / o.bw, (fh - pad) / o.bh)));
      const o = document.createElement('canvas'); o.width = fw * rects.length; o.height = fh; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      bs.forEach((bb, k) => {
        const dw = bb.bw * s, dh = bb.bh * s, cx = centerBy === 'bbox' ? (bb.x0 + bb.x1) / 2 : bb.cx;
        og.drawImage(cv, bb.x0, bb.y0, bb.bw, bb.bh, k * fw + fw / 2 - (cx - bb.x0) * s, fh - dh - 2, dw, dh);
      });
      return { url: o.toDataURL('image/png'), scale: +s.toFixed(3), boxes: bs.map(o => o.bw + '×' + o.bh) };
    };
    const cw = 273, ch = 341, gx = 435, fire = [], dummy = [];
    for (let k = 0; k < 8; k++) fire.push([gx + (k % 4) * cw, k < 4 ? 0 : 335, cw, k < 4 ? 335 : 300]);
    for (let k = 0; k < 3; k++) dummy.push([gx + k * cw, 640, cw, H - 640]);
    return { banner: strip([[0, 0, 384, H]], 256, 512, 2, 'bbox'), fire: strip(fire, 256, 256, 2, 'base'), dummy: strip(dummy, 256, 256, 2, 'base') };
  }, 'data:image/png;base64,' + readFileSync(src).toString('base64'));
  for (const [k, f] of [['banner', 'camp-banner'], ['fire', 'camp-firepit'], ['dummy', 'camp-dummy']]) { writeFileSync(`public/assets/props-v2/${f}.png`, Buffer.from(res[k].url.split(',')[1], 'base64')); console.log(f, '缩放', res[k].scale, '外框', res[k].boxes.join(' ')); }
} finally { await b.close(); }
