// 剧情插画整理：即梦 / Gemini 出的横版 3:2 原图 → 1280 宽 WebP（public/assets/story/<键>.webp）。
// 去掉即梦左上角半透明「AI生成」水印：先裁掉顶部 TOP（默认 10%），再左右对称裁成 3:2，最后缩到 1280×853。
// 用法：SRC=public/assets/story/originals/story_longzhong_jm.png KEY=story_longzhong node tools/prepare-story-art.mjs
// 可选：TOP（顶部裁掉比例，默认 .10；Gemini / ChatGPT 无水印的图设 0）、QUALITY（默认 .9）、PREVIEW=1（同时输出 PNG 预览）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC, KEY } = process.env;
if (!SRC || !KEY) { console.error('需要 SRC 和 KEY'); process.exit(2); }
const TOP = +(process.env.TOP ?? .10), Q = +(process.env.QUALITY ?? .9);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([data, TOP, Q]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, sy = Math.round(H * TOP), h = H - sy, w = Math.min(W, Math.round(h * 1.5)), sx = Math.round((W - w) / 2);
    const c = document.createElement('canvas'); c.width = 1280; c.height = 853; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, sx, sy, w, w / 1.5, 0, 0, 1280, 853);
    return { webp: c.toDataURL('image/webp', Q), png: c.toDataURL('image/png'), box: `${W}×${H} → 裁 ${w}×${Math.round(w / 1.5)} @(${sx},${sy})` };
  }, ['data:image/png;base64,' + readFileSync(SRC).toString('base64'), TOP, Q]);
  writeFileSync(`public/assets/story/${KEY}.webp`, Buffer.from(r.webp.split(',')[1], 'base64'));
  if (process.env.PREVIEW) writeFileSync(`assets/review/story-${KEY}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  console.log(KEY, r.box);
} finally { await b.close(); }
