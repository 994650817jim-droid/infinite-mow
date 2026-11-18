// 死亡特效专属尘土（即梦 Seedream 5.5 出图，2026-11-18）：洋红底 3 列 × 2 行 6 帧 → 透明底 6 帧横排表（每格 256×256）。
// 用法：node tools/prepare-death-dust.mjs [in.webp] [out.png]
//   默认 public/assets/fx/originals/death_dust_jimeng_v1.webp → public/assets/fx/death_dust.png（游戏里 SKILL_FX.fx_death_dust）
// 处理步骤（浏览器 canvas 里逐像素，和 prepare-fx-sheet 一样用 Playwright，不依赖额外图像库）：
//  1. 抠洋红底：像素 = a·前景 + (1−a)·洋红(255,0,255)。洋红度 m = min(R,B) − G；前景是土黄（B < G）时 m ≈ −KFG，纯洋红 m = 255，
//     所以 a = clamp((255 − m) / (255 + KFG))（反解混合比例，边缘半透明的尘土也保得住）。
//  2. 去溢色（despill）：前景色 = (像素 − (1−a)·洋红) / a；再把 B 压到不超过 G（土黄的 B 本来就比 G 低），边缘不再留粉色。
//  3. 清水印：左上角「AI生成」半透明水印（纯洋红区域）整块清掉（WATERMARK 矩形，原图 1080×1080 坐标）。
//  4. 分帧：把不透明区域膨胀后做连通域，按各连通域的重心归到所属格子（所以某一帧略微越过格子也不会被切掉或串到邻格）；碎屑小块也跟着主体走。
//  5. 重新居中：每帧取自己的外框，按同一个缩放（保留帧间大小关系）放进 256×256 的格子：水平居中、外框底边对齐到地面线（GROUND 比例）。
// 输出 6 帧横排 1536×256 PNG，另输出一张 *_preview.png（棋盘格底，看抠得干不干净）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src = 'public/assets/fx/originals/death_dust_jimeng_v1.webp', out = 'public/assets/fx/death_dust.png'] = process.argv.slice(2), e = process.env;
const P = { COLS: +(e.COLS ?? 3), ROWS: +(e.ROWS ?? 2), CELL: +(e.CELL ?? 256), KFG: +(e.KFG ?? 40), AMIN: +(e.AMIN ?? .06), DILATE: +(e.DILATE ?? 12), FIT: +(e.FIT ?? .94), GROUND: +(e.GROUND ?? .8), WATERMARK: [0, 0, 230, 120] };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await b.newPage();
  const mime = src.endsWith('.png') ? 'image/png' : 'image/webp';
  const res = await page.evaluate(async ([url, P]) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), px = d.data, alpha = new Float32Array(W * H);
    // 1–2) 抠洋红 + 去溢色
    for (let i = 0, k = 0; i < px.length; i += 4, k++) {
      const R = px[i], G = px[i + 1], B = px[i + 2], m = Math.min(R, B) - G;
      let a = Math.max(0, Math.min(1, (255 - m) / (255 + P.KFG)));
      if (a < P.AMIN) { alpha[k] = 0; px[i + 3] = 0; continue; }
      const fr = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)), fg = Math.max(0, Math.min(255, G / a)), fb = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a));
      px[i] = fr; px[i + 1] = fg; px[i + 2] = Math.min(fb, fg); // 去粉：B 不超过 G
      px[i + 3] = Math.round(a * 255); alpha[k] = a;
    }
    // 3) 清水印
    const [wx0, wy0, wx1, wy1] = P.WATERMARK; for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) { alpha[y * W + x] = 0; px[(y * W + x) * 4 + 3] = 0; }
    // 4) 膨胀 + 连通域（4 邻接，迭代栈），各连通域按重心归格
    const r = P.DILATE, solid = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) solid[k] = alpha[k] > .15 ? 1 : 0;
    const dil = new Uint8Array(W * H), tmp = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W + r; x++) { if (x < W && solid[y * W + x]) run = r + 1; if (run > 0) { if (x - r >= 0 && x - r < W) tmp[y * W + x - r] = 1; } if (run > 0) run--; } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tmp[y * W + x]) for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++) dil[yy * W + x] = 1;
    const label = new Int32Array(W * H).fill(-1), comps = []; const stack = [];
    for (let s = 0; s < W * H; s++) { if (!dil[s] || label[s] >= 0) continue; const id = comps.length; let sx = 0, sy = 0, n = 0; stack.push(s); label[s] = id;
      while (stack.length) { const k = stack.pop(), x = k % W, y = (k / W) | 0; if (solid[k]) { sx += x; sy += y; n++; } for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) if (nk >= 0 && dil[nk] && label[nk] < 0) { label[nk] = id; stack.push(nk); } }
      comps.push({ n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 }); }
    const cw = W / P.COLS, ch = H / P.ROWS, owner = comps.map(c => c.n < 20 ? -1 : Math.min(P.COLS - 1, Math.max(0, Math.floor(c.cx / cw))) + P.COLS * Math.min(P.ROWS - 1, Math.max(0, Math.floor(c.cy / ch))));
    // 5) 每帧外框（只算归属本帧的不透明像素）
    const n = P.COLS * P.ROWS, box = Array.from({ length: n }, () => ({ x0: 1e9, y0: 1e9, x1: -1, y1: -1 }));
    for (let k = 0; k < W * H; k++) { if (alpha[k] <= .02) continue; const o = label[k] >= 0 ? owner[label[k]] : -1; if (o < 0) continue; const x = k % W, y = (k / W) | 0, bx = box[o]; if (x < bx.x0) bx.x0 = x; if (x > bx.x1) bx.x1 = x; if (y < bx.y0) bx.y0 = y; if (y > bx.y1) bx.y1 = y; }
    const maxW = Math.max(...box.map(b2 => b2.x1 - b2.x0 + 1)), maxH = Math.max(...box.map(b2 => b2.y1 - b2.y0 + 1)), scale = Math.min(P.CELL * P.FIT / maxW, P.CELL * P.GROUND * P.FIT / maxH);
    const src2 = document.createElement('canvas'); src2.width = W; src2.height = H; src2.getContext('2d').putImageData(d, 0, 0);
    const outC = document.createElement('canvas'); outC.width = n * P.CELL; outC.height = P.CELL; const og = outC.getContext('2d'); og.imageSmoothingQuality = 'high';
    const report = [];
    for (let f = 0; f < n; f++) {
      const bx = box[f], w = bx.x1 - bx.x0 + 1, h = bx.y1 - bx.y0 + 1;
      // 只画归属本帧的像素（别的帧越界进来的像素不画）：先在临时画布上把非本帧像素清掉
      const fc = document.createElement('canvas'); fc.width = w; fc.height = h; const fg2 = fc.getContext('2d'), fd = fg2.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (bx.y0 + y) * W + bx.x0 + x, o = label[k] >= 0 ? owner[label[k]] : -1, i = k * 4, j = (y * w + x) * 4; if (o !== f || alpha[k] <= .02) continue; fd.data[j] = px[i]; fd.data[j + 1] = px[i + 1]; fd.data[j + 2] = px[i + 2]; fd.data[j + 3] = px[i + 3]; }
      fg2.putImageData(fd, 0, 0);
      const dw = w * scale, dh = h * scale, dx = f * P.CELL + (P.CELL - dw) / 2, dy = P.CELL * P.GROUND - dh;     // 水平居中；外框底边落在地面线
      og.drawImage(fc, dx, dy, dw, dh); report.push({ f, box: [bx.x0, bx.y0, w, h], placed: [Math.round(dx - f * P.CELL), Math.round(dy), Math.round(dw), Math.round(dh)] });
    }
    // 预览：棋盘格底
    const pv = document.createElement('canvas'); pv.width = outC.width; pv.height = outC.height; const pg = pv.getContext('2d');
    for (let y = 0; y < pv.height; y += 16) for (let x = 0; x < pv.width; x += 16) { pg.fillStyle = ((x + y) / 16) % 2 ? '#3b5a3b' : '#2b2b44'; pg.fillRect(x, y, 16, 16); } pg.drawImage(outC, 0, 0);
    return { sheet: outC.toDataURL('image/png'), preview: pv.toDataURL('image/png'), scale, report, comps: comps.length, W, H };
  }, ['data:' + mime + ';base64,' + readFileSync(src).toString('base64'), P]);
  writeFileSync(out, Buffer.from(res.sheet.split(',')[1], 'base64')); writeFileSync(out.replace(/\.png$/, '_preview.png'), Buffer.from(res.preview.split(',')[1], 'base64'));
  console.log(out, `${6 * P.CELL}×${P.CELL}`, 'scale', res.scale.toFixed(3), 'components', res.comps); for (const r of res.report) console.log(JSON.stringify(r));
} finally { await b.close(); }
