// 主页彩绘立绘抠图（2026-11-20）：Bing / ChatGPT 出的「单色底全身像」→ 600×900 透明 PNG + WebP，与 assets/epic-home/<id>.png|webp 同规格。
// 背景不必是纯洋红：取四边平均色为底色，从四边出发沿「与底色接近」的连通区域洪水填充成透明（被人物围住的同色块不会被挖掉），边缘 1 像素收缩 + 软边。
// 用法：SRC=public/assets/epic-home/originals/raw/bing_ganning.jpg ID=ganning [TOL=60] [H=880] node tools/cut-epic-home.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, SRC = E.SRC, ID = E.ID, TOL = +(E.TOL ?? 60), BAND = +(E.BAND ?? 6), DESP = +(E.DESP ?? 0), H = +(E.H ?? 880), OUT = 'public/assets/epic-home/';
if (!SRC || !ID) { console.error('需要 SRC / ID'); process.exit(2); }
const mime = SRC.endsWith('.png') ? 'png' : 'jpeg';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([src, TOL, H, BAND, DESP]) => {
    const im = new Image(); im.src = src; await im.decode();
    const W = im.width, Ht = im.height, c = document.createElement('canvas'); c.width = W; c.height = Ht;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const img = g.getImageData(0, 0, W, Ht), d = img.data;
    // 底色：四边像素平均
    let r = 0, gg = 0, bl = 0, n = 0; const add = (x, y) => { const i = (y * W + x) * 4; r += d[i]; gg += d[i + 1]; bl += d[i + 2]; n++; };
    for (let x = 0; x < W; x++) { add(x, 0); add(x, Ht - 1); } for (let y = 0; y < Ht; y++) { add(0, y); add(W - 1, y); }
    const BR = r / n, BG = gg / n, BB = bl / n;
    const dist = j => { const i = j * 4; return Math.hypot(d[i] - BR, d[i + 1] - BG, d[i + 2] - BB); };
    const bg = new Uint8Array(W * Ht), q = new Int32Array(W * Ht); let qh = 0, qt = 0;
    const push = (x, y) => { const j = y * W + x; if (bg[j] || dist(j) > TOL) return; bg[j] = 1; q[qt++] = j; };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, Ht - 1); } for (let y = 0; y < Ht; y++) { push(0, y); push(W - 1, y); }
    while (qh < qt) { const j = q[qh++], x = j % W, y = (j / W) | 0; if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < Ht - 1) push(x, y + 1); }
    // 被人物围住的背景块（披风与手臂之间、两腿之间）：与底色很接近（≤POCKET）且面积足够大的连通块也挖掉
    const st = new Int32Array(W * Ht);
    for (const [POCKET, MIN] of [[TOL * .75, 600], [TOL * .5, 20], [TOL * .4, 3]]) { const seen = new Uint8Array(W * Ht);
    for (let s0 = 0; s0 < W * Ht; s0++) {
      if (bg[s0] || seen[s0] || dist(s0) > POCKET) continue; let sp = 0, cnt = 0; const comp = []; st[sp++] = s0; seen[s0] = 1;
      while (sp) { const j = st[--sp]; comp.push(j); cnt++; const x = j % W, y = (j / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Ht) continue; const k = yy * W + xx; if (!seen[k] && !bg[k] && dist(k) <= POCKET) { seen[k] = 1; st[sp++] = k; } } }
      if (cnt > MIN) for (const j of comp) bg[j] = 1;
    } }
    // 收缩 1 像素：背景邻居的前景像素按到底色的距离做软边
    const a = new Float32Array(W * Ht).fill(1);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < W; x++) {
      const j = y * W + x; if (bg[j]) { a[j] = 0; continue; }
      let nb = false; for (let dy = -1; dy <= 1 && !nb; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < Ht && bg[yy * W + xx]) { nb = true; break; } }
      if (nb) a[j] = Math.max(0, Math.min(1, (dist(j) - TOL * .5) / (TOL * 1.2)));
    }
    // 边缘带（离透明区 BAND 像素以内）去洋红溢色：min(红,蓝)-绿 超过 DESP 的像素按程度降不透明度、把蓝压回去；带外不动，免得误伤红色披风
    const dd = new Int16Array(W * Ht).fill(99); const qq = []; for (let j = 0; j < W * Ht; j++) if (a[j] < .5) { dd[j] = 0; qq.push(j); }
    for (let h = 0; h < qq.length; h++) { const j = qq[h], x = j % W, y = (j / W) | 0; if (dd[j] >= BAND) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Ht) continue; const k = yy * W + xx; if (dd[k] > dd[j] + 1) { dd[k] = dd[j] + 1; qq.push(k); } } }
    for (let j = 0; j < W * Ht; j++) { if (dd[j] > BAND || a[j] <= 0) continue; const i = j * 4, R = d[i], G = d[i + 1], B = d[i + 2], tint = Math.max(0, Math.min(R, B) - G - DESP); if (tint > 0) { a[j] *= Math.max(0, 1 - tint / 45); d[i + 2] = Math.min(B, G + (R - G) * .5 + 8); d[i] = Math.min(R, G + (R - G) * .85 + 8); } }
    let x0 = W, x1 = 0, y0 = Ht, y1 = 0;
    for (let j = 0; j < W * Ht; j++) if (a[j] > .5) { const x = j % W, y = (j / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let j = 0; j < W * Ht; j++) { const i = j * 4; if (a[j] < 1 && a[j] > 0) for (let k = 0; k < 3; k++) { const base = [BR, BG, BB][k]; d[i + k] = Math.max(0, Math.min(255, (d[i + k] - base * (1 - a[j])) / a[j])); } d[i + 3] = Math.round(255 * a[j]); }
    g.putImageData(img, 0, 0);
    const o = document.createElement('canvas'); o.width = 600; o.height = 900; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = Math.min(H / bh, 580 / bw), dw = bw * s, dh = bh * s;
    og.drawImage(c, x0, y0, bw, bh, (600 - dw) / 2, 900 - 10 - dh, dw, dh);
    return { bg: [BR, BG, BB].map(Math.round), bbox: [x0, y0, x1, y1], png: o.toDataURL('image/png'), webp: o.toDataURL('image/webp', .9) };
  }, [`data:image/${mime};base64,` + fs.readFileSync(SRC).toString('base64'), TOL, H, BAND, DESP]);
  fs.writeFileSync(OUT + ID + '.png', Buffer.from(res.png.split(',')[1], 'base64'));
  fs.writeFileSync(OUT + ID + '.webp', Buffer.from(res.webp.split(',')[1], 'base64'));
  console.log('底色', res.bg, '人物框', res.bbox, '→', OUT + ID + '.png|webp');
} finally { await b.close(); }
