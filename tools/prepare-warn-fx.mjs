// 警示特效序列帧：洋红底原图 → 等格精灵表（透明底）。
// 按「空白带」切：先找行（整行都是背景的横带隔开），每行再按竖向空白带切成 N 帧（多了合并最近的，少了按等分补）。
// 每帧保持它在本行里的相对位置（同一行的帧上下对齐），整张图统一缩放到格子里，不拉伸。
// 用法：node tools/prepare-warn-fx.mjs <原图> <输出 png> <每行帧数> <格宽>[x格高] [行数] [grid]
// demag：把残留的洋红色偏（半透明暗影和洋红底混出来的紫色）改成暖褐色，并按色偏程度降低不透明度（本身不该带紫色的图用）。
// grid：不按内容切，整张图按 行数 × 每行帧数 等分，每格原样缩放进输出格子（横扫这类「圆心固定在格子某处」的图用）。
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const [src, out, perRowS, cellS, rowsS, mode] = process.argv.slice(2); const GRID = /grid/.test(mode || ''), DEMAG = /demag/.test(mode || ''); const N = +perRowS, [CW, CH] = cellS.includes("x") ? cellS.split("x").map(Number) : [+cellS, +cellS], ROWS = rowsS ? +rowsS : 0;
const dataUrl = 'data:image/png;base64,' + readFileSync(src).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([url, N, CW, CH, ROWS, GRID, DEMAG]) => {
    const im = new Image(); im.src = url; await im.decode(); const W = im.width, H = im.height;
    const sc = document.createElement('canvas'); sc.width = W; sc.height = H; const sg = sc.getContext('2d'); sg.drawImage(im, 0, 0);
    const img = sg.getImageData(0, 0, W, H), d = img.data;
    // 抠洋红：红蓝都高、绿低 → 背景；介于之间按程度给半透明并去掉洋红色溢
    for (let i = 0; i < W * H; i++) { const r = d[i * 4], g = d[i * 4 + 1], bl = d[i * 4 + 2], m = Math.min(r, bl);
      // 只抠接近纯洋红的像素（特效本身常有紫色，不能按色相抠）：距 #FF00FF 越近越透明
      const dist = Math.hypot(255 - r, g, 255 - bl);
      if (dist < 70) d[i * 4 + 3] = 0; else if (dist < 120 && g < 110) { d[i * 4 + 3] = Math.round(255 * (dist - 70) / 50); d[i * 4] = Math.min(r, g + 90); d[i * 4 + 2] = Math.min(bl, g + 90); } }
    if (DEMAG) for (let i = 0; i < W * H; i++) { if (d[i * 4 + 3] === 0) continue; const r = d[i * 4], g = d[i * 4 + 1], bl = d[i * 4 + 2], m = Math.min(r, bl);
      if (m > g * 1.6 && Math.abs(r - bl) < 80) { const L = (r + g + bl) / 3, cast = (m - g) / 255; d[i * 4] = Math.min(255, L * 1.1); d[i * 4 + 1] = L * .78; d[i * 4 + 2] = L * .55; d[i * 4 + 3] = Math.round(d[i * 4 + 3] * Math.max(.3, 1 - cast)); } }
    // 去孤立杂点（四周都透明的单像素）
    const solid = i => d[i * 4 + 3] > 40;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (solid(i) && !solid(i - 1) && !solid(i + 1) && !solid(i - W) && !solid(i + W)) d[i * 4 + 3] = 0; }
    sg.putImageData(img, 0, 0);
    const rowOcc = new Array(H).fill(0); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(y * W + x)) rowOcc[y]++;
    const bands = (occ, minGap, min = 2) => { const out = []; let s = -1, gap = 0; for (let i = 0; i < occ.length; i++) { if (occ[i] >= min) { if (s < 0) s = i; gap = 0; } else if (s >= 0) { gap++; if (gap >= minGap) { out.push([s, i - gap]); s = -1; gap = 0; } } } if (s >= 0) out.push([s, occ.length - 1]); return out; };
    let rows = bands(rowOcc, 10, 3).filter(([a, z]) => z - a > 20);
    if (ROWS && (rows.length !== ROWS || GRID)) { const h = H / ROWS; rows = Array.from({ length: ROWS }, (_, i) => [Math.round(i * h), Math.round((i + 1) * h) - 1]); }
    const frames = [];
    for (const [t, bt] of rows) {
      const colOcc = new Array(W).fill(0); for (let x = 0; x < W; x++) for (let y = t; y <= bt; y++) if (solid(y * W + x)) colOcc[x]++;
      let segs = bands(colOcc, 6, 1).filter(([a, z]) => z - a > 4);
      while (segs.length > N) { let bi = 0, bg = 1e9; for (let i = 0; i < segs.length - 1; i++) { const g = segs[i + 1][0] - segs[i][1]; if (g < bg) { bg = g; bi = i; } } segs.splice(bi, 2, [segs[bi][0], segs[bi + 1][1]]); }
      if (segs.length < N || GRID) { const w = W / N; segs = Array.from({ length: N }, (_, i) => [Math.round(i * w), Math.round((i + 1) * w) - 1]); }
      if (GRID) { for (const [l, rr] of segs) frames.push({ l, r: rr, t, b: bt, rowT: t, rowB: bt }); continue; }
      for (const [l, rr] of segs) { let tt = bt, bb = t; for (let y = t; y <= bt; y++) for (let x = l; x <= rr; x++) if (solid(y * W + x)) { if (y < tt) tt = y; if (y > bb) bb = y; } frames.push({ l, r: rr, t: tt, b: bb, rowT: t, rowB: bt }); }
    }
    const maxW = Math.max(...frames.map(f => f.r - f.l + 1)), maxH = Math.max(...frames.map(f => f.rowB - f.rowT + 1));
    const s = Math.min(1, (CW - 4) / maxW, (CH - 4) / maxH), R = rows.length;
    const oc = document.createElement('canvas'); oc.width = CW * N; oc.height = CH * R; const og = oc.getContext('2d'); og.imageSmoothingEnabled = s < 1;
    frames.forEach((f, i) => { const col = i % N, row = Math.floor(i / N), w = f.r - f.l + 1, h = f.rowB - f.rowT + 1;
      og.drawImage(sc, f.l, f.rowT, w, h, col * CW + (CW - w * s) / 2, row * CH + (CH - h * s) / 2, w * s, h * s); });
    return { url: oc.toDataURL('image/png'), W, H, rows: R, frames: frames.length, scale: +s.toFixed(3) };
  }, [dataUrl, N, CW, CH, ROWS, GRID, DEMAG]);
  writeFileSync(out, Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(JSON.stringify({ ...r, url: undefined, out }));
} finally { await b.close(); }
