// 营寨草料堆 + 拴马桩（即梦 Seedream 5.5，白底一张图左右两物件）→ public/assets/props-v2/camp-hay-rail.png（2 帧横排，每帧 256，物件底边贴帧底、居中，透明底）。
// 抠图：从四边泛洪去掉近白底（容差），左上角「AI生成」水印区清掉；左右各取一半，按不透明像素裁边后等比缩进 240 内。
// 用法：node tools/prepare-camp-hay.mjs
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'public/assets/props-v2/originals/walk_camp_hay_rail_jimeng.png', OUT = 'public/assets/props-v2/camp-hay-rail.png', CELL = 256, FIT = 240;
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const out = await p.evaluate(async ({ d, CELL, FIT }) => {
  const im = new Image(); im.src = d; await im.decode(); const W = im.width, H = im.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const id = g.getImageData(0, 0, W, H), px = id.data, bg = new Uint8Array(W * H), near = i => px[i * 4] > 232 && px[i * 4 + 1] > 232 && px[i * 4 + 2] > 226;
  const q = []; for (let x = 0; x < W; x++) { q.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) { q.push(y * W, y * W + W - 1); }
  while (q.length) { const i = q.pop(); if (bg[i] || !near(i)) continue; bg[i] = 1; const x = i % W, y = (i / W) | 0; if (x > 0) q.push(i - 1); if (x < W - 1) q.push(i + 1); if (y > 0) q.push(i - W); if (y < H - 1) q.push(i + W); }
  for (let i = 0; i < W * H; i++) if (bg[i]) px[i * 4 + 3] = 0;
  // 水印：左上角 22% × 12%
  for (let y = 0; y < H * .12; y++) for (let x = 0; x < W * .22; x++) px[(y * W + x) * 4 + 3] = 0;
  // 去白边溢色：贴着透明区的半白像素压暗一点
  g.putImageData(id, 0, 0);
  const o = document.createElement('canvas'); o.width = CELL * 2; o.height = CELL; const og = o.getContext('2d');
  for (const [k, x0, x1] of [[0, 0, W / 2], [1, W / 2, W]]) {
    let l = W, r = 0, t = H, bt = 0; for (let y = 0; y < H; y++) for (let x = x0 | 0; x < x1; x++) if (px[(y * W + x) * 4 + 3] > 30) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bt) bt = y; }
    const w = r - l + 1, h = bt - t + 1, s = Math.min(FIT / w, FIT / h);
    og.imageSmoothingQuality = 'high'; og.drawImage(c, l, t, w, h, k * CELL + (CELL - w * s) / 2, CELL - 4 - h * s, w * s, h * s);
  }
  return o.toDataURL('image/png');
}, { d: 'data:image/png;base64,' + readFileSync(SRC).toString('base64'), CELL, FIT });
writeFileSync(OUT, Buffer.from(out.split(',')[1], 'base64')); await b.close(); console.log('ok', OUT);
