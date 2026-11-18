// 死亡特效兵器 / 头巾小图集（即梦 Seedream 5.5 出图，2026-11-18）：粉洋红底 3 列 × 2 行 6 件 → 透明底 3×2 图集（每格 256×256）。
// 用法：node tools/prepare-death-props.mjs [in.webp] [out.png]
//   默认 public/assets/fx/originals/death_props_jimeng_v1.webp → public/assets/fx/death_props.png（游戏里 SKILL_FX.fx_death_props，帧 0–5）
//   帧：0 环首刀 1 红缨长枪 2 反曲弓 3 圆藤牌 4 铁边重盾 5 黄头巾
// 处理步骤（浏览器 canvas 里逐像素，和 prepare-death-dust 一样用 Playwright）：
//  1. 背景色不是纯 #FF00FF，是偏粉的洋红（约 #F12792），各格色调略有差别、格边有色带：每格用四个角各一小块的平均色做双线性插值，得到「这个像素位置的背景色」。
//     格 0 左上角有「AI生成」水印，那一角改取水印下方的一块。
//  2. 抠色：像素与该处背景色的 RGB 距离 → 透明度（DIST0 以内全透明，DIST1 以上不透明，中间线性）。
//  3. 去溢色（despill）：半透明边缘按 前景 = (像素 − (1−a)·背景) / a 反解；再把边缘的 B 压到不超过 R 的 0.9 倍（粉边的 B 偏高，兵器 / 木 / 铁 / 黄布的 B 本来就低）；
//     最后做「边缘取色回填」：轮廓最外一圈的颜色改用邻近内部像素的平均色（只保留透明度），粉边就没有颜色可留了。
//  4. 清水印：左上角整块（原图坐标）清掉；再按连通域去掉面积太小的杂点，以及贴着格边的块（格边色带）。
//  5. 每件物品取自己的外框，按同一个最大边 FIT 缩放（保持长宽比）、在 256 格里居中；输出 768×512 + 一张棋盘格底的预览。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src = 'public/assets/fx/originals/death_props_jimeng_v1.webp', out = 'public/assets/fx/death_props.png'] = process.argv.slice(2), e = process.env;
const P = { COLS: 3, ROWS: 2, CELL: +(e.CELL ?? 256), FIT: +(e.FIT ?? 210), DIST0: +(e.DIST0 ?? 26), DIST1: +(e.DIST1 ?? 140), PATCH: 16, INSET: 8, MINAREA: +(e.MINAREA ?? 300), EDGE: +(e.EDGE ?? 3), WATERMARK: [0, 0, 230, 125] };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const res = await page.evaluate(async ([url, P]) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), px = d.data, alpha = new Float32Array(W * H), cw = W / P.COLS, ch = H / P.ROWS;
    const patch = (x, y) => { let r = 0, gg = 0, bb = 0, n = 0; for (let yy = y; yy < y + P.PATCH; yy++) for (let xx = x; xx < x + P.PATCH; xx++) { const i = (yy * W + xx) * 4; r += px[i]; gg += px[i + 1]; bb += px[i + 2]; n++; } return [r / n, gg / n, bb / n]; };
    const bgInfo = [];
    for (let cy = 0; cy < P.ROWS; cy++) for (let cx = 0; cx < P.COLS; cx++) {
      const x0 = Math.floor(cx * cw), y0 = Math.floor(cy * ch), x1 = Math.floor((cx + 1) * cw), y1 = Math.floor((cy + 1) * ch), I = P.INSET, S = P.PATCH;
      const tlY = (cx === 0 && cy === 0) ? P.WATERMARK[3] + 12 : y0 + I;     // 格 0 的左上角被水印占着，改取水印下方
      const tl = patch(x0 + I, tlY), tr = patch(x1 - I - S, y0 + I), bl = patch(x0 + I, y1 - I - S), br = patch(x1 - I - S, y1 - I - S);
      bgInfo.push({ tl, tr, bl, br });
      const lerp = (a, b2, t) => a + (b2 - a) * t;
      for (let y = y0; y < y1; y++) { const v = (y - y0) / (y1 - y0 - 1); for (let x = x0; x < x1; x++) {
        const u = (x - x0) / (x1 - x0 - 1), i = (y * W + x) * 4, bg = [0, 1, 2].map(k => lerp(lerp(tl[k], tr[k], u), lerp(bl[k], br[k], u), v));
        const R = px[i], G = px[i + 1], B = px[i + 2], dist = Math.hypot(R - bg[0], G - bg[1], B - bg[2]);
        let a = Math.max(0, Math.min(1, (dist - P.DIST0) / (P.DIST1 - P.DIST0)));
        if (a < .04) { alpha[y * W + x] = 0; px[i + 3] = 0; continue; }
        // 去溢色：反解前景色，边缘再压 B
        let fr = (R - (1 - a) * bg[0]) / a, fg = (G - (1 - a) * bg[1]) / a, fb = (B - (1 - a) * bg[2]) / a;
        fr = Math.max(0, Math.min(255, fr)); fg = Math.max(0, Math.min(255, fg)); fb = Math.max(0, Math.min(255, fb));
        if (a < .97) fb = Math.min(fb, fr * .9);
        px[i] = fr; px[i + 1] = fg; px[i + 2] = fb; px[i + 3] = Math.round(a * 255); alpha[y * W + x] = a;
      } }
    }
    // 边缘取色回填（去粉边）：轮廓线最外一圈（半透明，或紧贴透明像素的那一圈）的颜色是「深色轮廓 + 粉底」的混色，反解也留不干净；
    // 这一圈的颜色改用 radius 3 内「内部像素」（a ≥ 0.97 且 8 邻域都不透明）的平均色，只保留透明度；邻域里没有内部像素的保持反解结果。
    { const rgb = new Uint8ClampedArray(px.length); rgb.set(px);
      const inner = k => alpha[k] >= .97 && alpha[k - 1] >= .5 && alpha[k + 1] >= .5 && alpha[k - W] >= .5 && alpha[k + W] >= .5 && alpha[k - W - 1] >= .5 && alpha[k - W + 1] >= .5 && alpha[k + W - 1] >= .5 && alpha[k + W + 1] >= .5;
      for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) { const k = y * W + x, a = alpha[k]; if (a <= .04 || inner(k)) continue; let r = 0, gg = 0, bb = 0, n = 0;
        for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const k2 = k + yy * W + xx; if (inner(k2)) { const i2 = k2 * 4; r += rgb[i2]; gg += rgb[i2 + 1]; bb += rgb[i2 + 2]; n++; } }
        if (n) { const i = k * 4; px[i] = r / n; px[i + 1] = gg / n; px[i + 2] = bb / n; } } }
    // 清水印
    const [wx0, wy0, wx1, wy1] = P.WATERMARK; for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) { alpha[y * W + x] = 0; px[(y * W + x) * 4 + 3] = 0; }
    // 连通域（4 邻接）：去杂点、去贴格边的块（格边色带）
    const solid = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) solid[k] = alpha[k] > .3 ? 1 : 0;
    const label = new Int32Array(W * H).fill(-1), comps = [], stack = [];
    for (let s0 = 0; s0 < W * H; s0++) { if (!solid[s0] || label[s0] >= 0) continue; const id = comps.length; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; stack.push(s0); label[s0] = id;
      while (stack.length) { const k = stack.pop(), x = k % W, y = (k / W) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) if (nk >= 0 && solid[nk] && label[nk] < 0) { label[nk] = id; stack.push(nk); } }
      const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, cell = Math.min(P.COLS - 1, Math.floor(cxm / cw)) + P.COLS * Math.min(P.ROWS - 1, Math.floor(cym / ch)), cx0 = (cell % P.COLS) * cw, cy0 = Math.floor(cell / P.COLS) * ch;
      const touches = x0 <= cx0 + P.EDGE || y0 <= cy0 + P.EDGE || x1 >= cx0 + cw - 1 - P.EDGE || y1 >= cy0 + ch - 1 - P.EDGE;
      comps.push({ n, x0, y0, x1, y1, cell, keep: n >= P.MINAREA && !touches }); }
    // 每格：保留的连通域 + 紧贴它们的半透明边缘一起算外框（半透明边缘按与保留连通域相邻的像素带入）
    const nCells = P.COLS * P.ROWS, box = Array.from({ length: nCells }, () => ({ x0: 1e9, y0: 1e9, x1: -1, y1: -1 })), kept = new Uint8Array(nCells);
    for (const k of comps) if (k.keep) { const bx = box[k.cell]; bx.x0 = Math.min(bx.x0, k.x0); bx.y0 = Math.min(bx.y0, k.y0); bx.x1 = Math.max(bx.x1, k.x1); bx.y1 = Math.max(bx.y1, k.y1); kept[k.cell]++; }
    const outC = document.createElement('canvas'); outC.width = nCells * 0 + P.COLS * P.CELL; outC.height = P.ROWS * P.CELL; const og = outC.getContext('2d'); og.imageSmoothingQuality = 'high';
    const src2 = document.createElement('canvas'); src2.width = W; src2.height = H; const sg = src2.getContext('2d'); const report = [];
    for (let f = 0; f < nCells; f++) {
      const bx = box[f]; if (bx.x1 < 0) { report.push({ f, error: 'no component' }); continue; }
      const m = 4, ex0 = Math.max(0, bx.x0 - m), ey0 = Math.max(0, bx.y0 - m), ex1 = Math.min(W - 1, bx.x1 + m), ey1 = Math.min(H - 1, bx.y1 + m), w = ex1 - ex0 + 1, h = ey1 - ey0 + 1;
      const fd = sg.createImageData(w, h), cx0 = (f % P.COLS) * cw, cy0 = Math.floor(f / P.COLS) * ch;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gx = ex0 + x, gy = ey0 + y, k = gy * W + gx, i = k * 4, j = (y * w + x) * 4;
        if (alpha[k] <= .04) continue; const lb = label[k]; // 保留的连通域像素，或紧贴保留连通域的半透明边缘像素（5×5 邻域里有保留的）
        let ok = lb >= 0 && comps[lb].keep; if (!ok && alpha[k] <= .3) { for (let yy = -2; yy <= 2 && !ok; yy++) for (let xx = -2; xx <= 2; xx++) { const nx = gx + xx, ny = gy + yy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const l2 = label[ny * W + nx]; if (l2 >= 0 && comps[l2].keep && comps[l2].cell === f) { ok = true; break; } } }
        if (!ok) continue; fd.data[j] = px[i]; fd.data[j + 1] = px[i + 1]; fd.data[j + 2] = px[i + 2]; fd.data[j + 3] = px[i + 3]; }
      const fc = document.createElement('canvas'); fc.width = w; fc.height = h; fc.getContext('2d').putImageData(fd, 0, 0);
      const scale = P.FIT / Math.max(w, h), dw = w * scale, dh = h * scale, dx = (f % P.COLS) * P.CELL + (P.CELL - dw) / 2, dy = Math.floor(f / P.COLS) * P.CELL + (P.CELL - dh) / 2;
      og.drawImage(fc, dx, dy, dw, dh); report.push({ f, comps: kept[f], box: [bx.x0 - cx0, bx.y0 - cy0, bx.x1 - bx.x0 + 1, bx.y1 - bx.y0 + 1], scale: +scale.toFixed(3) });
    }
    const pv = document.createElement('canvas'); pv.width = outC.width; pv.height = outC.height; const pg = pv.getContext('2d');
    for (let y = 0; y < pv.height; y += 16) for (let x = 0; x < pv.width; x += 16) { pg.fillStyle = ((x + y) / 16) % 2 ? '#3b5a3b' : '#2b2b44'; pg.fillRect(x, y, 16, 16); } pg.drawImage(outC, 0, 0);
    return { sheet: outC.toDataURL('image/png'), preview: pv.toDataURL('image/png'), report, comps: comps.length, bgInfo };
  }, ['data:' + (src.endsWith('.png') ? 'image/png' : 'image/webp') + ';base64,' + readFileSync(src).toString('base64'), P]);
  writeFileSync(out, Buffer.from(res.sheet.split(',')[1], 'base64')); writeFileSync(out.replace(/\.png$/, '_preview.png'), Buffer.from(res.preview.split(',')[1], 'base64'));
  console.log(out, `${P.COLS * P.CELL}×${P.ROWS * P.CELL}`, 'components', res.comps); for (const r of res.report) console.log(JSON.stringify(r));
  console.log('bg (tl)', res.bgInfo.map(x => x.tl.map(Math.round).join(',')).join(' | '));
} finally { await b.close(); }
