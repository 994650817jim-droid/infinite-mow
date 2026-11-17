// 地面 / 路面贴图整理成可无缝平铺（ChatGPT 出的“无缝”图边缘往往接不上）。
// 做法：原图与“错开半张”的原图按到边缘的距离交叉淡化——中间用原图，靠近四边用错开图（错开图的四边正好是原图中间，天然连续），
// 两张图的接缝都落在对方的不透明区之外。不缩放、保持像素颗粒。可选只在横向无缝（路面条）。
// 用法：SRC=public/assets/env-v2/originals/walk_env_ground_guanzhong.png OUT=public/assets/env-v2/ground_guanzhong.png node tools/prepare-ground.mjs
// 可选：BAND（淡化带宽占边长比例，默认 .18）、AXIS=x（只做横向无缝，路面用）、PREVIEW=路径（输出 2×2 平铺预览）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC, OUT, PREVIEW } = process.env;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const BAND = +(process.env.BAND ?? .18), AXIS = process.env.AXIS ?? 'xy';
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, BAND, AXIS]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, W, H).data, out = g.createImageData(W, H), o = out.data;
  const sx = AXIS.includes('x') ? W >> 1 : 0, sy = AXIS.includes('y') ? H >> 1 : 0, bw = W * BAND, bh = H * BAND;
  const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // 权重：离左右 / 上下边越近，越多用错开图
    const wx = AXIS.includes('x') ? smooth(Math.min(x, W - 1 - x) / bw) : 1, wy = AXIS.includes('y') ? smooth(Math.min(y, H - 1 - y) / bh) : 1, w = Math.min(wx, wy);
    const i = (y * W + x) * 4, j = (((y + sy) % H) * W + ((x + sx) % W)) * 4;
    for (let k = 0; k < 4; k++) o[i + k] = a[i + k] * w + a[j + k] * (1 - w);
  }
  g.putImageData(out, 0, 0);
  const url = c.toDataURL('image/png');
  const pv = document.createElement('canvas'); pv.width = W * 2; pv.height = H * 2; const pg = pv.getContext('2d'); for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) pg.drawImage(c, xx * W, yy * H);
  return { url, preview: pv.toDataURL('image/png'), size: [W, H] };
}, [readFileSync(SRC).toString('base64'), BAND, AXIS]);
writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64'));
if (PREVIEW) writeFileSync(PREVIEW, Buffer.from(res.preview.split(',')[1], 'base64'));
console.log(`${OUT}  ${res.size.join('×')}  无缝：${AXIS}`);
await b.close();
