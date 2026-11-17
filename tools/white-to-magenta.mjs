// Gemini 出的图是白底（JPEG、不透明）：把背景白换成洋红 #FF00FF，接上现有的 prepare-artv2 / prepare-props（它们按洋红抠图）。
// 做法：从四边做泛洪（近白 = 三通道都 ≥ HI 且色差 ≤ CHROMA），再把四面被人物围住、面积 ≥ HOLE 的近白块也当背景（腿间、臂弯的空隙）；
// 最后贴着背景的偏白杂边（JPEG 晕边，三通道 ≥ EDGE、色差小）向内吃 EDGEPASS 圈。人物身上的小块高光不动。
// 用法：SRC=~/Downloads/x.jpg OUT=public/assets/.../originals/x_magenta.png node tools/white-to-magenta.mjs
//   GRID=4x8：Gemini 的行列不等分时重排成等分网格（按前景最少的线找真实分界，每格底边对齐贴进新画布），再交给 prepare-artv2
//   可选 HI（默认 232）、CHROMA（默认 26）、HOLE（默认 220）、EDGE（默认 196）、EDGEPASS（默认 2）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const env = process.env, SRC = env.SRC, OUT = env.OUT;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const GRID = env.GRID ? env.GRID.split('x').map(Number) : null;
const HI = +(env.HI ?? 232), CHROMA = +(env.CHROMA ?? 26), HOLE = +(env.HOLE ?? 220), EDGE = +(env.EDGE ?? 196), EDGEPASS = +(env.EDGEPASS ?? 2);
const mime = /\.jpe?g$/i.test(SRC) ? 'image/jpeg' : 'image/png';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ({ src, HI, CHROMA, HOLE, EDGE, EDGEPASS, GRID }) => {
    const im = new Image(); im.src = src; await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, W, H), px = d.data;
    const white = i => { const r = px[i * 4], gg = px[i * 4 + 1], bb = px[i * 4 + 2], mn = Math.min(r, gg, bb), mx = Math.max(r, gg, bb); return mn >= HI && mx - mn <= CHROMA; };
    const bg = new Uint8Array(W * H), q = new Int32Array(W * H);
    let qh = 0, qt = 0;
    const push = i => { if (!bg[i] && white(i)) { bg[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (qh < qt) { const i = q[qh++], x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
    // 被围住的大块近白
    const seen = new Uint8Array(W * H); let holes = 0;
    for (let s = 0; s < W * H; s++) {
      if (bg[s] || seen[s] || !white(s)) continue;
      const list = [s]; seen[s] = 1;
      for (let k = 0; k < list.length; k++) { const i = list[k], x = i % W, y = (i / W) | 0; for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (n >= 0 && !seen[n] && !bg[n] && white(n)) { seen[n] = 1; list.push(n); } }
      if (list.length >= HOLE) { holes++; for (const i of list) bg[i] = 1; }
    }
    // 晕边
    const pale = i => { const r = px[i * 4], gg = px[i * 4 + 1], bb = px[i * 4 + 2], mn = Math.min(r, gg, bb), mx = Math.max(r, gg, bb); return mn >= EDGE && mx - mn <= CHROMA + 10; };
    for (let pass = 0; pass < EDGEPASS; pass++) {
      const add = [];
      for (let i = 0; i < W * H; i++) { if (bg[i] || !pale(i)) continue; const x = i % W, y = (i / W) | 0; if ((x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W])) add.push(i); }
      for (const i of add) bg[i] = 1;
    }
    let n = 0; for (let i = 0; i < W * H; i++) if (bg[i]) { px[i * 4] = 255; px[i * 4 + 1] = 0; px[i * 4 + 2] = 255; px[i * 4 + 3] = 255; n++; }
    g.putImageData(d, 0, 0);
    if (!GRID) return { url: c.toDataURL('image/png'), W, H, bgPct: Math.round(n / (W * H) * 100), holes };
    // 重排网格：Gemini 的行列并不等分（第一行常常比 H/行数 高）。在每条预期分界线附近 ±35% 格高内找前景最少的一条线作真实分界，
    // 再把每格内容按「底边对齐、水平居中」贴进等分的新画布（格子取各格最大宽高）；越界的刀尖在分界线处被切开，不会和邻格粘成一块。
    const [gc, gr] = GRID, rowFg = new Float64Array(H), colFg = new Float64Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!bg[y * W + x]) { rowFg[y]++; colFg[x]++; }
    const cuts = (prof, len, k) => { const out = [0]; for (let j = 1; j < k; j++) { const e = j * len / k, r = len / k * .35; let best = Math.round(e), bv = Infinity; for (let t = Math.max(1, Math.round(e - r)); t <= Math.min(len - 2, Math.round(e + r)); t++) { let v = 0; for (let q = -3; q <= 3; q++) v += prof[Math.max(0, Math.min(len - 1, t + q))]; v += Math.abs(t - e) * .02; if (v < bv) { bv = v; best = t; } } out.push(best); } out.push(len); return out; };
    const ys = cuts(rowFg, H, gr), xs = cuts(colFg, W, gc);
    let cw = 0, ch = 0; for (let j = 0; j < gc; j++) cw = Math.max(cw, xs[j + 1] - xs[j]); for (let j = 0; j < gr; j++) ch = Math.max(ch, ys[j + 1] - ys[j]);
    const o = document.createElement('canvas'); o.width = cw * gc; o.height = ch * gr; const og = o.getContext('2d'); og.fillStyle = '#ff00ff'; og.fillRect(0, 0, o.width, o.height);
    for (let r = 0; r < gr; r++) for (let q = 0; q < gc; q++) { const w = xs[q + 1] - xs[q], h = ys[r + 1] - ys[r]; og.drawImage(c, xs[q], ys[r], w, h, q * cw + Math.floor((cw - w) / 2), r * ch + (ch - h), w, h); }
    return { url: o.toDataURL('image/png'), W: o.width, H: o.height, bgPct: Math.round(n / (W * H) * 100), holes, cuts: { ys, xs } };
  }, { src: `data:${mime};base64,` + readFileSync(SRC).toString('base64'), HI, CHROMA, HOLE, EDGE, EDGEPASS, GRID });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(`${OUT} · ${res.W}×${res.H} · 背景 ${res.bgPct}% · 围住的空隙 ${res.holes} 块` + (res.cuts ? ` · 行分界 ${res.cuts.ys.join(",")} · 列分界 ${res.cuts.xs.join(",")}` : ""));
} finally { await b.close(); }
