// 行营军需商人立绘（即梦 Seedream 5.5，水墨淡彩白底 2:3，左上角半透明「AI生成」水印）→ public/assets/camp/merchant.webp（透明底）
//   node tools/prepare-merchant-art.mjs [原图，默认 public/assets/camp/originals/merchant_ink.png] [输出，默认 merchant.webp]
//   WM=0 不清左上角水印区（下载的原图没有水印时）。军医：WM=0 node tools/prepare-merchant-art.mjs public/assets/camp/originals/medic_ink.png public/assets/camp/medic_figure.webp
// 抠图：从四边洪泛「近白」像素（亮度 > 212 且低饱和）为背景，背景内按白度转半透明并反乘白色（淡墨晕染边缘自然过渡）；
// 左上角水印区（宽 26% × 高 9%）整块清掉。输出最长边 900（游戏里电脑版约 140×240 显示，留 2–3 倍余量）。不需要开发服务器。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2] ?? 'public/assets/camp/originals/merchant_ink.png', out = process.argv[3] ?? 'public/assets/camp/merchant.webp';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([data, wm]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    const lum = i => .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2], sat = i => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    const bg = new Uint8Array(W * H), stack = [];
    const seed = (x, y) => { const k = y * W + x; if (!bg[k] && lum(k * 4) > 212 && sat(k * 4) < 40) { bg[k] = 1; stack.push(k); } };
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); } for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
    while (stack.length) { const k = stack.pop(), x = k % W, y = (k / W) | 0; if (x) seed(x - 1, y); if (x < W - 1) seed(x + 1, y); if (y) seed(x, y - 1); if (y < H - 1) seed(x, y + 1); }
    // 背景边缘再向外扩 2 像素做羽化带
    const band = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (bg[k]) continue; for (let dy = -2; dy <= 2 && !band[k]; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) { band[k] = 1; break; } } }
    for (let k = 0; k < W * H; k++) {
      const i = k * 4; if (!bg[k] && !band[k]) continue;
      const white = Math.min(d[i], d[i + 1], d[i + 2]); let a = Math.max(0, Math.min(1, (232 - white) / 90)); if (band[k]) a = Math.max(a, .45);
      if (a <= 0) { d[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, (d[i + c] - (1 - a) * 255) / a));
      d[i + 3] = Math.round(a * 255);
    }
    const wx = wm ? Math.round(W * .26) : 0, wy = Math.round(H * .09); for (let y = 0; y < wy; y++) for (let x = 0; x < wx; x++) d[(y * W + x) * 4 + 3] = 0;
    g.putImageData(img, 0, 0);
    // 裁到不透明外框（留 8 像素），缩到最长边 900
    let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, x0 - 8); y0 = Math.max(0, y0 - 8); x1 = Math.min(W - 1, x1 + 8); y1 = Math.min(H - 1, y1 + 8);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, 900 / Math.max(cw, ch)), o = document.createElement('canvas'); o.width = Math.round(cw * s); o.height = Math.round(ch * s);
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cv, x0, y0, cw, ch, 0, 0, o.width, o.height);
    return { src: [W, H], crop: [x0, y0, cw, ch], size: [o.width, o.height], webp: o.toDataURL('image/webp', .9) };
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), process.env.WM !== '0']);
  writeFileSync(out, Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log(out, '原图', r.src.join('×'), '裁切', r.crop.join(','), '输出', r.size.join('×'));
} finally { await b.close(); }
