// 横向无缝化 + 像素化（2026-11-20）：把一张条状贴图处理成左右可无缝平铺的指定尺寸。
// 做法：out = img·m + roll(img, W/2)·(1-m)，m 在两端各 FEATHER 像素内线性降到 0（两端都等于 roll(img) 的同一列，所以首尾相接）。
// 然后可选「像素化」：先缩到 1/PIX 再最近邻放大回来（和洛阳城墙一样的颗粒），可选整体降饱和 SAT（0~1，默认 1 不变）。
// 用法：SRC=…/walkway_gpt_1.png OUT=…/walkway_a.png W=1024 H=256 [FEATHER=96] [PIX=2] [SAT=.8] node tools/make-seamless.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, SRC = E.SRC, OUT = E.OUT, W = +(E.W ?? 1024), H = +(E.H ?? 256), F = +(E.FEATHER ?? 96), PIX = +(E.PIX ?? 1), SAT = +(E.SAT ?? 1);
if (!SRC || !OUT) { console.error('需要 SRC / OUT'); process.exit(2); }
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const url = await p.evaluate(async ([src, W, H, F, PIX, SAT]) => {
    const im = new Image(); im.src = src; await im.decode();
    const sw = Math.round(W / PIX), sh = Math.round(H / PIX);
    const c = document.createElement('canvas'); c.width = sw; c.height = sh; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, sw, sh);
    const a = g.getImageData(0, 0, sw, sh), d = a.data, o = new Uint8ClampedArray(d), f = Math.round(F / PIX), half = sw >> 1;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const m = Math.min(1, Math.min(x, sw - 1 - x) / f), i = (y * sw + x) * 4, r = (y * sw + ((x + half) % sw)) * 4;
      for (let k = 0; k < 3; k++) o[i + k] = d[i + k] * m + d[r + k] * (1 - m);
      o[i + 3] = 255;
    }
    if (SAT !== 1) for (let i = 0; i < o.length; i += 4) { const l = .3 * o[i] + .59 * o[i + 1] + .11 * o[i + 2]; for (let k = 0; k < 3; k++) o[i + k] = l + (o[i + k] - l) * SAT; }
    g.putImageData(new ImageData(o, sw, sh), 0, 0);
    const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'); og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, W, H);
    return out.toDataURL('image/png');
  }, ['data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), W, H, F, PIX, SAT]);
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64')); console.log('→', OUT);
} finally { await b.close(); }
