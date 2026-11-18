// 手绘道具贴图整理（ChatGPT 纯色底 → 透明单张）：洋红 #FF00FF 或绿 #00FF00 底硬抠 + 去溢色，按给定框裁出每个物件、补边到目标宽高比、缩到目标尺寸。
// 用于武将武器小贴图（飞刀 / 团扇 / 蛇矛 / 魅惑心，2026-11-18 高清重画）。
// 用法：SRC=… KEY=magenta|green ITEMS='[{"out":"public/assets/hero-fx/sun_knife.png","box":[x,y,w,h],"size":[w,h]}]' node tools/prepare-props-key.mjs
//   box 为源图里的裁切框（会按 size 的宽高比向四周补透明边，物件居中）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC } = process.env, KEY = process.env.KEY ?? 'magenta', ITEMS = JSON.parse(process.env.ITEMS ?? '[]');
if (!SRC || !ITEMS.length) { console.error('需要 SRC 与 ITEMS'); process.exit(2); }
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, KEY, ITEMS]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data, green = KEY === 'green';
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], bb = d[i + 2];
    // 键色强度：洋红 = min(R,B) − G；绿 = G − max(R,B)
    const k = green ? gg - Math.max(r, bb) : Math.min(r, bb) - gg;
    if (k >= 110) { d[i + 3] = 0; continue; }
    if (k > 30) { d[i + 3] = Math.round(255 * (1 - (k - 30) / 80)); }
    // 去溢色：边缘残留的键色压回中性
    if (k > 0) { if (green) d[i + 1] = Math.max(r, bb); else { const m = gg + k * .15; d[i] = Math.min(d[i], Math.max(m, d[i] - k)); d[i + 2] = Math.min(d[i + 2], Math.max(m, d[i + 2] - k)); } }
  }
  g.putImageData(id, 0, 0);
  const outs = [];
  for (const it of ITEMS) {
    const [bx, by, bw, bh] = it.box, [tw, th] = it.size, ar = tw / th;
    let cw = bw, ch = bh; if (cw / ch < ar) cw = ch * ar; else ch = cw / ar;
    const cx = bx + bw / 2, cy = by + bh / 2, o = document.createElement('canvas'); o.width = tw; o.height = th;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, tw, th);
    outs.push({ out: it.out, url: o.toDataURL('image/png') });
  }
  return { size: [W, H], outs };
}, [readFileSync(SRC).toString('base64'), KEY, ITEMS]);
for (const o of res.outs) { writeFileSync(o.out, Buffer.from(o.url.split(',')[1], 'base64')); console.log('→', o.out); }
console.log('源图', res.size.join('×'));
await b.close();
