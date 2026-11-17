// 路面条整理：ChatGPT 出的「上下 N 条横向路面、洋红底」→ 每条一张竖向可平铺的路面贴图（透明路肩）。
// 步骤：按行等分取每条 → 硬抠洋红（不透明像素画）→ 横向首尾交叉淡化成无缝 → 转 90° 成竖条（游戏里竖向平铺，横路用旋转）。
// 用法：SRC=public/assets/env-v2/originals/walk_env_roads.png OUT=public/assets/env-v2/road_{i}.png N=3 NAMES=dirt,stone,plank node tools/prepare-road.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC } = process.env, N = +(process.env.N ?? 3), NAMES = (process.env.NAMES ?? 'dirt,stone,plank').split(','), OUT = process.env.OUT ?? 'public/assets/env-v2/road_{i}.png';
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, N]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const W = img.width, H = img.height, sh = Math.floor(H / N), outs = [];
  for (let s = 0; s < N; s++) {
    const c = document.createElement('canvas'); c.width = W; c.height = sh; const g = c.getContext('2d'); g.drawImage(img, 0, s * sh, W, sh, 0, 0, W, sh);
    const id = g.getImageData(0, 0, W, sh), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const k = Math.min(d[i], d[i + 2]) - d[i + 1]; if (k >= 85) { d[i + 3] = 0; continue; } if (k > 18) { d[i + 3] = Math.round(255 * (1 - (k - 18) / 67)); const sp = k * 1.05; d[i] = Math.max(0, d[i] - sp); d[i + 2] = Math.max(0, d[i + 2] - sp); } }
    // 裁掉上下全透明行
    let top = 0, bot = sh - 1; const rowEmpty = y => { for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 20) return false; return true; };
    while (top < sh - 1 && rowEmpty(top)) top++; while (bot > top && rowEmpty(bot)) bot--;
    const hh = bot - top + 1, band = W * .16, half = W >> 1, out = new Uint8ClampedArray(W * hh * 4);
    const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    for (let y = 0; y < hh; y++) for (let x = 0; x < W; x++) { const w = sm(Math.min(x, W - 1 - x) / band), i = ((y + top) * W + x) * 4, j = ((y + top) * W + (x + half) % W) * 4, o = (y * W + x) * 4; const ai = d[i + 3] * w, aj = d[j + 3] * (1 - w), at = ai + aj; out[o + 3] = at; if (at > 0) for (let k = 0; k < 3; k++) out[o + k] = (d[i + k] * ai + d[j + k] * aj) / at; } // 按不透明度加权混色：透明像素（洋红底色）不参与，路肩不泛粉
    // 转成竖条：宽 = 路宽（hh），高 = 长度（W）
    const flat = document.createElement('canvas'); flat.width = W; flat.height = hh; flat.getContext('2d').putImageData(new ImageData(out, W, hh), 0, 0);
    const v = document.createElement('canvas'); v.width = hh; v.height = W; const vg = v.getContext('2d'); vg.translate(hh, 0); vg.rotate(Math.PI / 2); vg.drawImage(flat, 0, 0);
    outs.push({ url: v.toDataURL('image/png'), w: hh, h: W });
  }
  return outs;
}, [readFileSync(SRC).toString('base64'), N]);
res.forEach((r, i) => { const f = OUT.replace('{i}', NAMES[i] ?? String(i)); writeFileSync(f, Buffer.from(r.url.split(',')[1], 'base64')); console.log(`${f}  ${r.w}×${r.h}（竖条：宽 = 路宽）`); });
await b.close();
