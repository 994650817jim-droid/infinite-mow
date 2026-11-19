// 首领 4×4 动作图（行 = 下 / 左 / 右 / 上，列 = 4 帧）：洋红底 → 透明底，每格归一（全图同一缩放 SCALE、脚底对齐 FOOT、按重心居中）。
// 用法：COLS=4 ROWS=4 CELL=288 SCALE=.8 FOOT=256 node tools/prepare-boss-sheet.mjs in.png out.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2), e = process.env;
const P = { COLS: +(e.COLS ?? 4), ROWS: +(e.ROWS ?? 4), CELL: +(e.CELL ?? 288), DIST0: +(e.DIST0 ?? 26), DIST1: +(e.DIST1 ?? 140), PATCH: 16, INSET: 8, SCALE: +(e.SCALE ?? .8), MIN2: +(e.MIN2 ?? 120), FOOT: +(e.FOOT ?? 256), MINAREA: +(e.MINAREA ?? 300), EDGE: +(e.EDGE ?? 2) };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const res = await page.evaluate(async ([url, P]) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), px = d.data, alpha = new Float32Array(W * H), cw = W / P.COLS, ch = H / P.ROWS;
    const patch = (x, y) => { let r = 0, gg = 0, bb = 0, n = 0; for (let yy = y; yy < y + P.PATCH; yy++) for (let xx = x; xx < x + P.PATCH; xx++) { const i = (yy * W + xx) * 4; r += px[i]; gg += px[i + 1]; bb += px[i + 2]; n++; } return [r / n, gg / n, bb / n]; };
    // 1) 每格抠色（背景色 = 四角小块平均色的双线性插值）
    for (let cy = 0; cy < P.ROWS; cy++) for (let cx = 0; cx < P.COLS; cx++) {
      const x0 = Math.floor(cx * cw), y0 = Math.floor(cy * ch), x1 = Math.floor((cx + 1) * cw), y1 = Math.floor((cy + 1) * ch), I = P.INSET, S = P.PATCH;
      const tl = patch(x0 + I, y0 + I), tr = patch(x1 - I - S, y0 + I), bl = patch(x0 + I, y1 - I - S), br = patch(x1 - I - S, y1 - I - S), lerp = (a, b2, t) => a + (b2 - a) * t;
      for (let y = y0; y < y1; y++) { const v = (y - y0) / (y1 - y0 - 1); for (let x = x0; x < x1; x++) {
        const u = (x - x0) / (x1 - x0 - 1), i = (y * W + x) * 4, bg = [0, 1, 2].map(k => lerp(lerp(tl[k], tr[k], u), lerp(bl[k], br[k], u), v));
        const R = px[i], G = px[i + 1], B = px[i + 2], dist = Math.hypot(R - bg[0], G - bg[1], B - bg[2]);
        const a = Math.max(0, Math.min(1, (dist - P.DIST0) / (P.DIST1 - P.DIST0)));
        if (a < .04) { alpha[y * W + x] = 0; px[i + 3] = 0; continue; }
        let fr = (R - (1 - a) * bg[0]) / a, fg = (G - (1 - a) * bg[1]) / a, fb = (B - (1 - a) * bg[2]) / a;
        fr = Math.max(0, Math.min(255, fr)); fg = Math.max(0, Math.min(255, fg)); fb = Math.max(0, Math.min(255, fb)); if (a < .97) fb = Math.min(fb, fr * .9);
        px[i] = fr; px[i + 1] = fg; px[i + 2] = fb; px[i + 3] = Math.round(a * 255); alpha[y * W + x] = a;
      } }
    }
    // 2) 边缘取色回填（去粉边）
    { const rgb = new Uint8ClampedArray(px.length); rgb.set(px);
      const inner = k => alpha[k] >= .97 && alpha[k - 1] >= .5 && alpha[k + 1] >= .5 && alpha[k - W] >= .5 && alpha[k + W] >= .5 && alpha[k - W - 1] >= .5 && alpha[k - W + 1] >= .5 && alpha[k + W - 1] >= .5 && alpha[k + W + 1] >= .5;
      for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) { const k = y * W + x, a = alpha[k]; if (a <= .04 || inner(k)) continue; let r = 0, gg = 0, bb = 0, n = 0;
        for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const k2 = k + yy * W + xx; if (inner(k2)) { const i2 = k2 * 4; r += rgb[i2]; gg += rgb[i2 + 1]; bb += rgb[i2 + 2]; n++; } }
        if (!n) { for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) { const k2 = k + yy * W + xx; if (alpha[k2] >= .6 && k2 !== k) { const i2 = k2 * 4; r += rgb[i2]; gg += rgb[i2 + 1]; bb += rgb[i2 + 2]; n++; } } } // 兜底：细毛丝（尾巴 / 鬃毛）周围没有内部像素，改取 6px 内较实的像素
        if (n) { const i = k * 4; px[i] = r / n; px[i + 1] = gg / n; px[i + 2] = bb / n; } } }
    // 3) 连通域：去杂点、去贴格边的块（格边色带）
    const solid = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) solid[k] = alpha[k] > .3 ? 1 : 0;
    const label = new Int32Array(W * H).fill(-1), comps = [], stack = [];
    for (let s0 = 0; s0 < W * H; s0++) { if (!solid[s0] || label[s0] >= 0) continue; const id = comps.length; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; stack.push(s0); label[s0] = id;
      while (stack.length) { const k = stack.pop(), x = k % W, y = (k / W) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) if (nk >= 0 && solid[nk] && label[nk] < 0) { label[nk] = id; stack.push(nk); } }
      const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, cell = Math.min(P.COLS - 1, Math.floor(cxm / cw)) + P.COLS * Math.min(P.ROWS - 1, Math.floor(cym / ch)), cx0 = (cell % P.COLS) * cw, cy0 = Math.floor(cell / P.COLS) * ch;
      const touches = x0 <= cx0 + P.EDGE || y0 <= cy0 + P.EDGE || x1 >= cx0 + cw - 1 - P.EDGE || y1 >= cy0 + ch - 1 - P.EDGE;
      comps.push({ n, x0, y0, x1, y1, cell, keep: n >= P.MINAREA && !touches }); }
    // 3b) 武器伸到格边的大块不能丢：每格里最大的连通域一律保留（只靠 touches 去掉的是格边色带 / 小块）
    { const big = new Array(P.COLS * P.ROWS).fill(-1); comps.forEach((k, i) => { if (big[k.cell] < 0 || k.n > comps[big[k.cell]].n) big[k.cell] = i; }); for (const k of comps) if (!k.keep && k.n >= P.MIN2) k.keep = true; }
    // 4) 每格归一：先收集每格保留的像素 + 包围盒；全图用同一个缩放（人物比例一致），脚底对齐到格内 FOOT（按每行包围盒底边的中位数，避免刀刃低垂时把脚抬高），水平按重心居中
    const nCells = P.COLS * P.ROWS, outC = document.createElement('canvas'); outC.width = P.COLS * P.CELL; outC.height = P.ROWS * P.CELL; const og = outC.getContext('2d'); og.imageSmoothingQuality = 'high';
    const report = [], kept = new Array(nCells).fill(0); for (const k of comps) if (k.keep) kept[k.cell]++;
    const CW = Math.round(cw), CH = Math.round(ch), PAD = Math.round(CW / 2), FW = CW + 2 * PAD, FH = CH + 2 * PAD, cells = [];   // 武器可能伸过原图的格线：每格按「属于这格的连通域」取像素，窗口向四周多开半格
    for (let f = 0; f < nCells; f++) {
      const ox = Math.floor((f % P.COLS) * cw), oy = Math.floor(Math.floor(f / P.COLS) * ch), fc = document.createElement('canvas'); fc.width = FW; fc.height = FH; const fg2 = fc.getContext('2d'), fd = fg2.createImageData(FW, FH);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1, sx = 0, sn = 0;
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const gx = ox - PAD + x, gy = oy - PAD + y; if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue; const k = gy * W + gx, i = k * 4, j = (y * FW + x) * 4; if (alpha[k] <= .04) continue; const lb = label[k];
        let ok = lb >= 0 && comps[lb].keep && comps[lb].cell === f; if (!ok && alpha[k] <= .3) { for (let yy = -2; yy <= 2 && !ok; yy++) for (let xx = -2; xx <= 2; xx++) { const nx = gx + xx, ny = gy + yy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const l2 = label[ny * W + nx]; if (l2 >= 0 && comps[l2].keep && comps[l2].cell === f) { ok = true; break; } } }
        if (!ok) continue; fd.data[j] = px[i]; fd.data[j + 1] = px[i + 1]; fd.data[j + 2] = px[i + 2]; fd.data[j + 3] = px[i + 3]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; if (px[i + 3] > 200) { sx += x; sn++; } }
      fg2.putImageData(fd, 0, 0); cells.push({ fc, bx0, by0, bx1, by1, cx: sn ? sx / sn : (bx0 + bx1) / 2 });
    }
    const med = a2 => { const t = [...a2].sort((p, q) => p - q); return t[Math.floor(t.length / 2)]; };
    const S0 = P.SCALE * P.CELL / CW, rowBottom = []; for (let r = 0; r < P.ROWS; r++) rowBottom.push(med(cells.slice(r * P.COLS, (r + 1) * P.COLS).map(c => c.by1)));
    for (let f = 0; f < nCells; f++) { const c = cells[f], r = Math.floor(f / P.COLS), col = f % P.COLS;
      const S = Math.min(S0, (P.CELL - 8) / (c.bx1 - c.bx0 + 1));   // 武器伸得特别长的帧：整格缩一点，保证画得下（不压到邻格）
      let dx = col * P.CELL + P.CELL / 2 - c.cx * S; const dy = r * P.CELL + P.FOOT - rowBottom[r] * S;
      dx = Math.max(col * P.CELL + 4 - c.bx0 * S, Math.min(dx, (col + 1) * P.CELL - 4 - (c.bx1 + 1) * S));   // 左右都留 4px
      og.save(); og.beginPath(); og.rect(col * P.CELL, r * P.CELL, P.CELL, P.CELL); og.clip();
      og.drawImage(c.fc, 0, 0, FW, FH, dx, dy, FW * S, FH * S); og.restore();
      report.push({ f, comps: kept[f], box: [Math.round(c.bx0 * S + dx - col * P.CELL), Math.round(c.by0 * S + dy - r * P.CELL), Math.round((c.bx1 - c.bx0 + 1) * S), Math.round((c.by1 - c.by0 + 1) * S)] }); }
    const pv = document.createElement('canvas'); pv.width = outC.width; pv.height = outC.height; const pg = pv.getContext('2d');
    for (let y = 0; y < pv.height; y += 16) for (let x = 0; x < pv.width; x += 16) { pg.fillStyle = ((x + y) / 16) % 2 ? '#3b5a3b' : '#2b2b44'; pg.fillRect(x, y, 16, 16); } pg.drawImage(outC, 0, 0);
    return { sheet: outC.toDataURL('image/png'), preview: pv.toDataURL('image/png'), report, comps: comps.length };
  }, ['data:' + (src.endsWith('.png') ? 'image/png' : 'image/webp') + ';base64,' + readFileSync(src).toString('base64'), P]);
  writeFileSync(out, Buffer.from(res.sheet.split(',')[1], 'base64')); writeFileSync(out.replace(/\.png$/, '_preview.png'), Buffer.from(res.preview.split(',')[1], 'base64'));
  console.log(out, `${P.COLS * P.CELL}×${P.ROWS * P.CELL}`, 'components', res.comps); for (const r of res.report) console.log(JSON.stringify(r));
} finally { await b.close(); }
