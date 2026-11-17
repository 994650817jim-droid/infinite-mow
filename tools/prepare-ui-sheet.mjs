// 手绘厚涂 UI 素材切图（不像素化）。用法：node tools/prepare-ui-sheet.mjs <jobs.json>
// jobs.json：[{ src, mode, ... }]，三种 mode：
//   "full"  不透明底图：crop [x,y,w,h]（省略=整张）→ 缩放到 out:{name:"a.webp",w,h}
//   "cells" 洋红底图集：cols×rows 等分（或 rects 指定各格 [x,y,w,h]），outs 按格子顺序 [{name,w,h,fit?}|null]；
//           全图洋红抠透明（连同框内的洋红，中间透明的边框也能抠）→ 去洋红溢色 → 按不透明区域裁边
//           → fit:"contain"(默认，等比放进 w×h 居中) | "stretch"(拉满 w×h) | 数字(固定缩放倍数，按主体中心居中) → webp
//   "ink"   白底墨线剪影：同 cells 切格；亮度转透明度（越黑越不透明），颜色统一成 ink（默认 #2a2420）
// 公共可选：dir（输出目录，默认 public/assets/bag/）、pad（裁边后留白比例，默认 .02）、q（webp 质量，默认 .9）、
//           key:[hard,soft]（洋红判定阈值，默认 [90,30]；判定值 = min(R,B)-G-0.6|R-B|，紫色物件靠 |R-B| 区分）；
//           各格 outs[i] 也可单独给 key（如紫色物件 [200,120]）、warm:true（金 / 橙 / 铜 / 朱红物件：按「前景蓝≈0.35绿」从洋红里反解透明度，
//           光晕不留粉边）、rect:[x,y,w,h]（只取格内这块，防邻格光晕串进来）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  for (const job of jobs) {
    const dir = job.dir ?? 'public/assets/bag/'; mkdirSync(dir, { recursive: true });
    const res = await p.evaluate(async ({ url, job }) => {
      const im = new Image(); im.src = url; await im.decode();
      const W = im.width, H = im.height, q = job.q ?? .9, pad = job.pad ?? .02;
      const out = [];
      const toWebp = (c, w, h, fit, fade = 0) => {
        const o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
        const done = () => { // fade：画布边缘 fade 像素内透明度渐变到 0（被裁掉的光晕不留硬边）
          if (fade > 0) { const im2 = g.getImageData(0, 0, w, h), e = im2.data; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const dd = Math.min(xx, yy, w - 1 - xx, h - 1 - yy); if (dd < fade) e[(yy * w + xx) * 4 + 3] *= dd / fade; } g.putImageData(im2, 0, 0); }
          return o.toDataURL('image/webp', q);
        };
        if (fit === 'stretch') g.drawImage(c, 0, 0, w, h);
        else if (typeof fit === 'number') g.drawImage(c, (w - c.width * fit) / 2, (h - c.height * fit) / 2, c.width * fit, c.height * fit); // 固定缩放、按主体中心居中（同组图对齐用，超出画布的光晕裁掉）
        else { const s = Math.min(w / c.width, h / c.height); g.drawImage(c, (w - c.width * s) / 2, (h - c.height * s) / 2, c.width * s, c.height * s); }
        return done();
      };
      if (job.mode === 'full') {
        const [x, y, w, h] = job.crop ?? [0, 0, W, H];
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, -x, -y);
        out.push({ name: job.out.name, data: toWebp(c, job.out.w, job.out.h, 'stretch'), info: `${w}×${h} → ${job.out.w}×${job.out.h}` });
        return out;
      }
      const cols = job.cols ?? 1, rows = job.rows ?? 1;
      const rects = job.rects ?? Array.from({ length: cols * rows }, (_, i) => { const cx = i % cols, cy = (i / cols) | 0; const x0 = Math.round(cx * W / cols), y0 = Math.round(cy * H / rows); return [x0, y0, Math.round((cx + 1) * W / cols) - x0, Math.round((cy + 1) * H / rows) - y0]; });
      const [hard, soft] = job.key ?? [90, 30];
      job.outs.forEach((o, i) => {
        if (!o) return;
        const [x, y, w, h] = o.rect ?? rects[i];
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, -x, -y); const img = g.getImageData(0, 0, w, h), d = img.data;
        for (let k = 0; k < d.length; k += 4) {
          const R = d[k], G = d[k + 1], B = d[k + 2];
          if (job.mode === 'ink') {
            const L = (R * .3 + G * .59 + B * .11), a = Math.max(0, Math.min(1, (238 - L) / 200));
            const ink = job.ink ?? [42, 36, 32]; d[k] = ink[0]; d[k + 1] = ink[1]; d[k + 2] = ink[2]; d[k + 3] = Math.round(255 * Math.pow(a, .9));
            continue;
          }
          const [hd, sf] = o.key ?? [hard, soft];
          if (o.warm) {
            // 金 / 橙光晕与洋红的混合：假设前景蓝 ≈ 0.35×绿，观测蓝 = 0.35G + (1-a)·255 → 反解不透明度 a 与前景色
            const ex = B - .35 * G;
            if (ex > 36) {
              const a = Math.max(0, Math.min(1, 1 - ex / 255 * 1.08));
              if (a < .04) { d[k + 3] = 0; continue; }
              d[k] = Math.min(255, Math.max(0, (R - (1 - a) * 255) / a)); d[k + 1] = Math.min(255, G / a, d[k] * .82); d[k + 2] = Math.min(d[k + 1], Math.max(0, (B - (1 - a) * 255) / a));
              d[k + 3] = Math.round(d[k + 3] * a);
            }
            continue;
          }
          const m = Math.min(R, B) - G - .6 * Math.abs(R - B);
          if (m >= hd) { d[k + 3] = 0; continue; }
          if (m > sf) {
            const a = 1 - (m - sf) / (hd - sf); d[k + 3] = Math.round(d[k + 3] * a);
            const lim = G + 20; if (R > lim) d[k] = Math.max(lim, R - (m - sf)); if (B > lim) d[k + 2] = Math.max(lim, B - (m - sf));
          }
        }
        // 去掉零星的半透明洋红残点：完全被透明包围的孤点清掉
        g.putImageData(img, 0, 0);
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
        if (x1 < 0) { out.push({ name: o.name, error: 'empty cell' }); return; }
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, px = Math.round(bw * pad), py = Math.round(bh * pad);
        const t = document.createElement('canvas'); t.width = bw + px * 2; t.height = bh + py * 2; t.getContext('2d').drawImage(c, x0, y0, bw, bh, px, py, bw, bh);
        out.push({ name: o.name, data: toWebp(t, o.w, o.h, o.fit, o.fade), info: `格 ${i} 主体 ${bw}×${bh} → ${o.w}×${o.h}${o.fit === 'stretch' ? ' 拉伸' : typeof o.fit === 'number' ? ' ×' + o.fit.toFixed(3) : ''}` });
      });
      return out;
    }, { url: 'data:image/png;base64,' + readFileSync(job.src).toString('base64'), job });
    for (const r of res) {
      if (r.error) { console.log('跳过', r.name, r.error); continue; }
      const buf = Buffer.from(r.data.split(',')[1], 'base64'); writeFileSync(dir + r.name, buf);
      console.log(dir + r.name, (buf.length / 1024).toFixed(0) + 'KB', r.info);
    }
  }
} finally { await b.close(); }
