// 敌军骑兵的暗橄榄褐战马行走图（即梦 Seedream 5.5 出图，2026-11-18）：粉洋红底 4 列 × 4 行 → 透明底 4×4 行走图（每格 288，和 horses-v2/generic_walk.png 同格式：
// 行 = 下 / 左 / 右 / 上，列 = 4 帧；regridV2 按 宽/4 切成 down_0…up_3）。
// 用法：node tools/prepare-enemy-horse.mjs [in.webp] [out.png]
//   默认 public/assets/fx/originals/enemy_horse_jimeng_v1.webp → public/assets/horses-v2/enemy_brown_walk.png（ART_V2_FILES.horse_v2_enemy_brown_walk）
// 和 prepare-death-props 同一套抠图（每格四角采样 + 双线性插值估背景色 → 距离抠色 + 反解混合 + 去溢色 → 连通域去杂点和贴格边的块 → 轮廓最外一圈取内部像素平均色去粉边），
// 区别：不逐帧重新居中——原图每格里马的脚底线、左右位置本来就一致，逐帧居中会让「抬腿的帧」上下跳；这里按格子原位整体缩放到 CELL。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src = 'public/assets/fx/originals/enemy_horse_jimeng_v1.webp', out = 'public/assets/horses-v2/enemy_brown_walk.png'] = process.argv.slice(2), e = process.env;
const P = { COLS: +(e.COLS ?? 4), ROWS: +(e.ROWS ?? 4), CELL: +(e.CELL ?? 288), DIST0: +(e.DIST0 ?? 26), DIST1: +(e.DIST1 ?? 140), PATCH: 16, INSET: 8, MINAREA: +(e.MINAREA ?? 300), EDGE: +(e.EDGE ?? 2) };
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
    // 4) 每格原位输出：只保留保留的连通域（及紧贴它们的半透明边缘），整格缩放到 CELL
    const nCells = P.COLS * P.ROWS, outC = document.createElement('canvas'); outC.width = P.COLS * P.CELL; outC.height = P.ROWS * P.CELL; const og = outC.getContext('2d'); og.imageSmoothingQuality = 'high';
    const report = [], kept = new Array(nCells).fill(0);
    for (const k of comps) if (k.keep) kept[k.cell]++;
    const CW = Math.round(cw), CH = Math.round(ch);
    for (let f = 0; f < nCells; f++) {
      const ox = Math.floor((f % P.COLS) * cw), oy = Math.floor(Math.floor(f / P.COLS) * ch), fc = document.createElement('canvas'); fc.width = CW; fc.height = CH; const fg2 = fc.getContext('2d'), fd = fg2.createImageData(CW, CH);
      let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const gx = ox + x, gy = oy + y; if (gx >= W || gy >= H) continue; const k = gy * W + gx, i = k * 4, j = (y * CW + x) * 4; if (alpha[k] <= .04) continue; const lb = label[k];
        let ok = lb >= 0 && comps[lb].keep; if (!ok && alpha[k] <= .3) { for (let yy = -2; yy <= 2 && !ok; yy++) for (let xx = -2; xx <= 2; xx++) { const nx = gx + xx, ny = gy + yy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const l2 = label[ny * W + nx]; if (l2 >= 0 && comps[l2].keep && comps[l2].cell === f) { ok = true; break; } } }
        if (!ok) continue; fd.data[j] = px[i]; fd.data[j + 1] = px[i + 1]; fd.data[j + 2] = px[i + 2]; fd.data[j + 3] = px[i + 3]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      fg2.putImageData(fd, 0, 0); og.drawImage(fc, 0, 0, CW, CH, (f % P.COLS) * P.CELL, Math.floor(f / P.COLS) * P.CELL, P.CELL, P.CELL);
      report.push({ f, comps: kept[f], box: [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1] });
    }
    const pv = document.createElement('canvas'); pv.width = outC.width; pv.height = outC.height; const pg = pv.getContext('2d');
    for (let y = 0; y < pv.height; y += 16) for (let x = 0; x < pv.width; x += 16) { pg.fillStyle = ((x + y) / 16) % 2 ? '#3b5a3b' : '#2b2b44'; pg.fillRect(x, y, 16, 16); } pg.drawImage(outC, 0, 0);
    return { sheet: outC.toDataURL('image/png'), preview: pv.toDataURL('image/png'), report, comps: comps.length };
  }, ['data:' + (src.endsWith('.png') ? 'image/png' : 'image/webp') + ';base64,' + readFileSync(src).toString('base64'), P]);
  writeFileSync(out, Buffer.from(res.sheet.split(',')[1], 'base64')); writeFileSync(out.replace(/\.png$/, '_preview.png'), Buffer.from(res.preview.split(',')[1], 'base64'));
  console.log(out, `${P.COLS * P.CELL}×${P.ROWS * P.CELL}`, 'components', res.comps); for (const r of res.report) console.log(JSON.stringify(r));
} finally { await b.close(); }
