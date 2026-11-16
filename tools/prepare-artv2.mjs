// 人物画风 v2「营火写实像素」图集整理（规范：共享笔记 art-style-v2-spec.md）。
// 输入：ChatGPT 生成的网格图（洋红 #FF00FF 底，COLS×ROWS 等分），原图放 <模块>/originals/（不入库）。
// 步骤：抠洋红 → 按网格切帧取人物外框 → 全表统一缩放（参照行的中位身高 = FIG 美术像素）→ 面积平均降采样成真像素
//      → 全表共用 ≤PAL 色调色板（k-means）→ 去孤立杂点 → 1 像素深褐黑外描边 → 脚底对齐第 FOOT 行、按腿部重心水平居中
//      → 最近邻放大 UP 倍拼回图集（宽度须大于 HdHeroSheets 的标清阈值，才会按 宽/4 重切帧）。
// 用法（不需要开发服务器）：
//   SRC=public/assets/hero-actions-v2/originals/artv2_zhaoyun_walk.png OUT=public/assets/processed-v2/zhaoyun_walk_sheet.png ROWS=4 node tools/prepare-artv2.mjs
//   SRC=... OUT=public/assets/hero-actions-v2/zhaoyun.png ROWS=7 CELL=96 FOOT=88 REF=0 node tools/prepare-artv2.mjs
// 可选：COLS（默认 4）、CELL（原生格，默认 72）、FOOT（脚底行，默认 CELL-4）、FIG（人物身高，默认 60）、
//      DEMAGENTA（去洋红偏色强度，默认 .7）、GAMMA（中间调，默认 .85，<1 提亮）、SAT（饱和度，默认 1.12）、
//      MINBLOB（小于此像素数的碎块丢弃，默认 40）、REF（参与定身高的行，逗号分隔，默认全部）、PAL（调色板色数，默认 32）、UP（放大倍数，默认 4）、
//      ORDER（输出行取自原图哪一行，逗号分隔，默认 0..ROWS-1；用于 ChatGPT 行序与规范不同时重排）、
//      MIRROR（这些输出行用前一参数里的源行水平镜像，如 MIRROR=1 表示第 1 行镜像自 ORDER[1]）。
// 同时输出原生 1 倍预览 <OUT 所在目录>/originals/<名>_1x.png（不打包）与逐帧统计。
import { chromium } from 'playwright';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const env = process.env;
const SRC = env.SRC, OUT = env.OUT;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const COLS = +(env.COLS ?? 4), ROWS = +(env.ROWS ?? 4), CELL = +(env.CELL ?? 72), FOOT = +(env.FOOT ?? CELL - 4);
const FIG = +(env.FIG ?? 60), PAL = +(env.PAL ?? 32), UP = +(env.UP ?? 4), MINBLOB = +(env.MINBLOB ?? 40);
const DEMAGENTA = +(env.DEMAGENTA ?? .7), GAMMA = +(env.GAMMA ?? .85), SAT = +(env.SAT ?? 1.12);
const SRC_ROWS = +(env.SRC_ROWS ?? ROWS);
const ORDER = env.ORDER ? env.ORDER.split(',').map(Number) : Array.from({ length: ROWS }, (_, i) => i);
const MIRROR = env.MIRROR ? env.MIRROR.split(',').map(Number) : [];
const REF = env.REF ? env.REF.split(',').map(Number) : Array.from({ length: SRC_ROWS }, (_, i) => i);
const OUTLINE = [26, 19, 16];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const src = 'data:image/png;base64,' + readFileSync(SRC).toString('base64');
  const res = await page.evaluate(async ({ src, COLS, ROWS, SRC_ROWS, CELL, FOOT, FIG, PAL, UP, ORDER, MIRROR, REF, OUTLINE, MINBLOB, DEMAGENTA, GAMMA, SAT }) => {
    const im = new Image(); im.src = src; await im.decode();
    const W = im.width, H = im.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    // 1) 抠洋红（含边缘溢色）
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.min(R, B) - G;
      if (m > 110 && R > 160 && B > 160) { d[i + 3] = 0; continue; }
      if (m > 40) { const k = Math.min(1, (m - 40) / 70); d[i + 3] = Math.round(d[i + 3] * (1 - k)); const cap = G + 30; d[i] = Math.min(R, cap); d[i + 2] = Math.min(B, cap); }
      // 去洋红偏色：ChatGPT 在洋红底上画的人物整体偏品红（R、B 同时高于 G），银甲发紫。只削 R、B 共同高出 G 的部分，蓝披风（B 高 R 低）不受影响
      const r0 = d[i], g0 = d[i + 1], b0 = d[i + 2], ex = Math.min(r0, b0) - g0;
      let r = r0, gg = g0, bb = b0; if (ex > 0) { r -= ex * DEMAGENTA; bb -= ex * DEMAGENTA; }
      // 中间调提亮 + 轻微加饱和：战场是亮沙地，太暗的人物只剩剪影
      const l = r * .3 + gg * .59 + bb * .11, lift = l > 0 ? 255 * Math.pow(l / 255, GAMMA) / l : 1;
      const f = c0 => Math.max(0, Math.min(255, (l + (c0 - l) * SAT) * lift));
      d[i] = f(r); d[i + 1] = f(gg); d[i + 2] = f(bb);
    }
    // 2) 按连通块分帧：整张图做 8 连通标记，每块归到「重心所在的格子」。
    //    这样举过格线的枪尖仍属于本帧，伸进邻格的部分也不会变成邻帧的杂点；小于 MINBLOB 像素的碎点丢弃。
    const cw = W / COLS, ch = H / SRC_ROWS, nCell = COLS * SRC_ROWS;
    const label = new Int32Array(W * H).fill(-1), owner = [];
    const stack = new Int32Array(W * H);
    for (let start = 0; start < W * H; start++) {
      if (label[start] >= 0 || d[start * 4 + 3] <= 60) continue;
      const id = owner.length; let sp = 0, n = 0, sx = 0, sy = 0; stack[sp++] = start; label[start] = id;
      while (sp) {
        const p = stack[--sp], x = p % W, y = (p - x) / W; n++; sx += x; sy += y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx; if (label[q] < 0 && d[q * 4 + 3] > 60) { label[q] = id; stack[sp++] = q; }
        }
      }
      const cx = sx / n, cy = sy / n;
      owner.push(n < MINBLOB ? -1 : Math.min(SRC_ROWS - 1, Math.floor(cy / ch)) * COLS + Math.min(COLS - 1, Math.floor(cx / cw)));
    }
    // 半透明边缘（alpha ≤ 60）跟随相邻已标记像素的归属
    const cellOf = new Int16Array(W * H).fill(-1);
    for (let i = 0; i < W * H; i++) if (label[i] >= 0) cellOf[i] = owner[label[i]];
    for (let i = 0; i < W * H; i++) if (cellOf[i] < 0 && d[i * 4 + 3] > 0) {
      const x = i % W; for (const q of [i - 1, i + 1, i - W, i + W]) if (q >= 0 && q < W * H && Math.abs((q % W) - x) <= 1 && label[q] >= 0) { cellOf[i] = owner[label[q]]; break; }
    }
    const boxes = Array.from({ length: nCell }, () => null);
    for (let i = 0; i < W * H; i++) { const c0 = cellOf[i]; if (c0 < 0 || d[i * 4 + 3] <= 60) continue; const x = i % W, y = (i - x) / W, b = boxes[c0];
      if (!b) boxes[c0] = { x0: x, y0: y, x1: x, y1: y }; else { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; } }
    boxes.forEach((b, i) => { if (b) boxes[i] = { x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, cell: i }; });
    // 3) 全表统一缩放
    const refH = REF.flatMap(r => boxes.slice(r * COLS, r * COLS + COLS)).filter(Boolean).map(b => b.h).sort((a, b) => a - b);
    if (!refH.length) return { error: '参照行没有人物' };
    const medH = refH[Math.floor(refH.length / 2)], s = FIG / medH;
    // 4) 面积平均降采样（预乘 alpha），alpha ≥ .5 视为不透明
    const frames = boxes.map(b => {
      if (!b) return null;
      const tw = Math.max(1, Math.round(b.w * s)), th = Math.max(1, Math.round(b.h * s));
      const px = new Float32Array(tw * th * 4);
      for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
        const sx0 = b.x + tx / s, sx1 = b.x + (tx + 1) / s, sy0 = b.y + ty / s, sy1 = b.y + (ty + 1) / s;
        let r = 0, gg = 0, bb = 0, a = 0, wsum = 0;
        for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
          const wy = Math.min(y + 1, sy1) - Math.max(y, sy0); if (wy <= 0 || y < 0 || y >= H) continue;
          for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
            const wx = Math.min(x + 1, sx1) - Math.max(x, sx0); if (wx <= 0 || x < 0 || x >= W) continue;
            const i = (y * W + x) * 4, al = cellOf[y * W + x] === b.cell ? d[i + 3] / 255 : 0, w = wx * wy;
            r += d[i] * al * w; gg += d[i + 1] * al * w; bb += d[i + 2] * al * w; a += al * w; wsum += w;
          }
        }
        const o = (ty * tw + tx) * 4, al = wsum ? a / wsum : 0;
        if (al >= .5) { px[o] = r / a; px[o + 1] = gg / a; px[o + 2] = bb / a; px[o + 3] = 1; }
      }
      return { w: tw, h: th, px };
    });
    // 5) 全表共用调色板：按亮度分位初始化的 k-means
    const samples = [];
    for (const f of frames) if (f) for (let i = 0; i < f.px.length; i += 4) if (f.px[i + 3]) samples.push([f.px[i], f.px[i + 1], f.px[i + 2]]);
    const lum = p => p[0] * .3 + p[1] * .59 + p[2] * .11;
    const sorted = [...samples].sort((a, b) => lum(a) - lum(b));
    const k = Math.min(PAL, sorted.length);
    let centers = Array.from({ length: k }, (_, i) => [...sorted[Math.floor((i + .5) * sorted.length / k)]]);
    const nearest = p => { let bi = 0, bd = Infinity; for (let i = 0; i < centers.length; i++) { const q = centers[i], dd = (p[0] - q[0]) ** 2 * .3 + (p[1] - q[1]) ** 2 * .59 + (p[2] - q[2]) ** 2 * .11; if (dd < bd) { bd = dd; bi = i; } } return bi; };
    for (let it = 0; it < 10; it++) {
      const acc = centers.map(() => [0, 0, 0, 0]);
      for (const p of samples) { const a = acc[nearest(p)]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; }
      centers = centers.map((c0, i) => acc[i][3] ? [acc[i][0] / acc[i][3], acc[i][1] / acc[i][3], acc[i][2] / acc[i][3]] : c0);
    }
    centers = centers.map(c0 => c0.map(Math.round));
    // 6) 量化 + 去孤立杂点 + 外描边 + 放进原生格
    const outRows = ORDER.length, OW = COLS * CELL, OH = outRows * CELL;
    const out = new Uint8ClampedArray(OW * OH * 4), stats = [];
    for (let r = 0; r < outRows; r++) for (let col = 0; col < COLS; col++) {
      const f = frames[ORDER[r] * COLS + col], mirror = MIRROR.includes(r);
      if (!f) { stats.push({ r, col, empty: true }); continue; }
      const { w, h, px } = f, q = new Int16Array(w * h).fill(-1);
      for (let i = 0; i < w * h; i++) if (px[i * 4 + 3]) q[i] = nearest([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
      const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && q[y * w + x] >= 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y) && !on(x - 1, y) && !on(x + 1, y) && !on(x, y - 1) && !on(x, y + 1)) q[y * w + x] = -1;
      // 腿部（下 35%）水平重心 → 格中心；脚底（最低不透明行）→ FOOT-1，描边落在 FOOT
      let bottom = -1; for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (on(x, y)) { bottom = y; break; }
      let sx = 0, n = 0; for (let y = Math.floor(bottom - (bottom + 1) * .35); y <= bottom; y++) for (let x = 0; x < w; x++) if (on(x, y)) { sx += x; n++; }
      const cx = n ? sx / n : w / 2;
      const ox = col * CELL + Math.round(CELL / 2 - (mirror ? w - 1 - cx : cx) - .5), oy = r * CELL + (FOOT - 1 - bottom);
      let clipped = 0;
      const put = (x, y, rgb) => {
        const X = ox + (mirror ? w - 1 - x : x), Y = oy + y;
        if (X < col * CELL || X >= (col + 1) * CELL || Y < r * CELL || Y >= (r + 1) * CELL) { clipped++; return; }
        const o = (Y * OW + X) * 4; out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; out[o + 3] = 255;
      };
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
        if (on(x, y)) put(x, y, centers[q[y * w + x]]);
        else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) put(x, y, OUTLINE);
      }
      stats.push({ r, col, w: w + 2, h: h + 2, clipped });
    }
    const o1 = document.createElement('canvas'); o1.width = OW; o1.height = OH;
    o1.getContext('2d').putImageData(new ImageData(out, OW, OH), 0, 0);
    const o4 = document.createElement('canvas'); o4.width = OW * UP; o4.height = OH * UP;
    const g4 = o4.getContext('2d'); g4.imageSmoothingEnabled = false; g4.drawImage(o1, 0, 0, OW * UP, OH * UP);
    return { scale: s, medH, palette: centers.length, stats, one: o1.toDataURL('image/png'), big: o4.toDataURL('image/png'), size: [OW * UP, OH * UP] };
  }, { src, COLS, ROWS, SRC_ROWS, CELL, FOOT, FIG, PAL, UP, ORDER, MIRROR, REF, OUTLINE, MINBLOB, DEMAGENTA, GAMMA, SAT });
  if (res.error) { console.error(res.error); process.exit(1); }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(res.big.split(',')[1], 'base64'));
  const PREV = join(dirname(OUT), 'originals', basename(OUT).replace(/\.png$/, '_1x.png'));
  mkdirSync(dirname(PREV), { recursive: true });
  writeFileSync(PREV, Buffer.from(res.one.split(',')[1], 'base64'));
  const clipped = res.stats.filter(s => s.clipped), empty = res.stats.filter(s => s.empty);
  console.log(`${OUT} ${res.size.join('×')}  缩放 ${res.scale.toFixed(4)}（参照中位身高 ${res.medH}px → ${FIG}）  调色板 ${res.palette} 色`);
  console.log('逐帧 宽×高：' + res.stats.map(s => s.empty ? '空' : `${s.w}×${s.h}`).join(' '));
  if (clipped.length) console.log('越出格子被裁：' + clipped.map(s => `r${s.r}c${s.col}(${s.clipped}px)`).join(' '));
  if (empty.length) console.log('空帧：' + empty.map(s => `r${s.r}c${s.col}`).join(' '));
} finally {
  await browser.close();
}
