// 剧情对白水墨立绘（非武将人物，2026-11-18 第三、四章）：ChatGPT 白底横版「一张并排 N 人」→ 每人一张 600×900 透明底 WebP，
// 处理与 build-ink-scroll-assets.mjs 的武将立绘完全一致（与边缘连通的近白像素转透明并反算颜色、底部 14% 渐隐），
// 人物按整列高度缩放到 900、水平居中，和 12 将立轴同比例（对白里取上 56%）。
// 用法：SRC=public/assets/ink-cast/originals/sheet_a.png IDS=jiaxu,wangyun,lijue node tools/build-ink-cast.mjs
//   PAD（默认 .14）：每格向两侧多裁的比例；两人在底部云雾里连在一起、邻居衣角混进来时设 PAD=0（只裁本格）。
//   MINBLOB（默认 .01）：离人物较远、小于最大墨块这个比例的零碎墨块丢掉；画面分格底色不一留下灰块时调大（如 .06）。
//   切分：在 W·k/N 附近 ±18% 内找「非白像素最少」的竖线当分界（人物之间的白缝）。
import { chromium } from 'playwright';
import fs from 'fs';
const { SRC } = process.env, IDS = (process.env.IDS ?? '').split(',').filter(Boolean), OUT = 'public/assets/ink-cast/';
if (!SRC || !IDS.length) { console.error('需要 SRC 与 IDS'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const res = await p.evaluate(async ([src, N, PAD, MINBLOB]) => {
  const im = new Image(); im.src = src; await im.decode();
  const W = im.width, H = im.height, c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
  const g0 = c0.getContext('2d', { willReadFrequently: true }); g0.drawImage(im, 0, 0);
  const all = g0.getImageData(0, 0, W, H).data, ink = new Float32Array(W);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y += 2) { const i = (y * W + x) * 4; if (255 - Math.min(all[i], all[i + 1], all[i + 2]) > 30) ink[x]++; }
  const cuts = [0];
  for (let k = 1; k < N; k++) { const c = W * k / N, r = W * .18 / N * 2; let best = c, bv = 1e9; for (let x = Math.round(c - r); x <= Math.round(c + r); x++) { const v = ink[x - 1] + ink[x] + ink[x + 1]; if (v < bv) { bv = v; best = x; } } cuts.push(best); }
  cuts.push(W);
  const outs = [];
  for (let k = 0; k < N; k++) {
    // 向两侧多裁 pad（兵器常伸进邻居那一格）；之后只留「重心落在本格」的墨块，邻居伸过来的兵器去掉
    const pad = Math.round(W / N * PAD), x0 = Math.max(0, cuts[k] - pad), x1 = Math.min(W, cuts[k + 1] + pad), cw = x1 - x0, c = document.createElement('canvas'); c.width = cw; c.height = H;
    const own0 = cuts[k] - x0, own1 = cuts[k + 1] - x0;
    const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, H); g.drawImage(im, -x0, 0);
    const img = g.getImageData(0, 0, cw, H), d = img.data, light = i => 255 - Math.min(d[i], d[i + 1], d[i + 2]);
    const bg = new Uint8Array(cw * H), q = new Int32Array(cw * H); let qh = 0, qt = 0;
    const push = (x, y) => { const j = y * cw + x; if (bg[j] || light(j * 4) > 48) return; bg[j] = 1; q[qt++] = j; };
    for (let x = 0; x < cw; x++) { push(x, 0); push(x, H - 1); } for (let y = 0; y < H; y++) { push(0, y); push(cw - 1, y); }
    while (qh < qt) { const j = q[qh++], x = j % cw, y = (j / cw) | 0; if (x > 0) push(x - 1, y); if (x < cw - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1); }
    // 非背景连通块（8 邻接）：重心不在本格的整块丢掉
    const lab = new Int32Array(cw * H).fill(-1), keepLab = [], sizes = []; let nl = 0;
    for (let s0 = 0; s0 < cw * H; s0++) {
      if (bg[s0] || lab[s0] >= 0) continue;
      let qa = 0, qb = 0, sx = 0, n = 0; lab[s0] = nl; q[qb++] = s0;
      while (qa < qb) { const j = q[qa++], x = j % cw, y = (j / cw) | 0; sx += x; n++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= cw || yy >= H) continue; const jj = yy * cw + xx; if (!bg[jj] && lab[jj] < 0) { lab[jj] = nl; q[qb++] = jj; } } }
      const cx = sx / n; keepLab.push(cx >= own0 && cx < own1); sizes.push(n); nl++;
    }
    // 远离人物的零碎淡墨（不到最大墨块 1%）也去掉
    const big = Math.max(0, ...sizes.filter((_, i) => keepLab[i])); for (let i = 0; i < nl; i++) if (sizes[i] < big * MINBLOB) keepLab[i] = false;
    let bx0 = cw, bx1 = 0;
    for (let j = 0; j < cw * H; j++) if (!bg[j]) { if (!keepLab[lab[j]]) bg[j] = 2; else { const x = j % cw; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; } }
    // 人物墨块向外 R 像素以内的背景才保留软边；更远处宣纸上的淡痕一律全透明（不然卷轴上会看到一道道浅灰丝）
    const R = 10, near = new Uint8Array(cw * H), tmp = new Uint8Array(cw * H);
    for (let y = 0; y < H; y++) { let last = -1e9; for (let x = 0; x < cw; x++) { if (bg[y * cw + x] === 0) last = x; if (x - last <= R) tmp[y * cw + x] = 1; } last = 1e9; for (let x = cw - 1; x >= 0; x--) { if (bg[y * cw + x] === 0) last = x; if (last - x <= R) tmp[y * cw + x] = 1; } }
    for (let x = 0; x < cw; x++) { let last = -1e9; for (let y = 0; y < H; y++) { if (tmp[y * cw + x]) last = y; if (y - last <= R) near[y * cw + x] = 1; } last = 1e9; for (let y = H - 1; y >= 0; y--) { if (tmp[y * cw + x]) last = y; if (last - y <= R) near[y * cw + x] = 1; } }
    for (let j = 0; j < cw * H; j++) {
      const i = j * 4, y = (j / cw) | 0; let a = 1;
      if (bg[j] === 2 || (bg[j] && !near[j])) a = 0;
      else if (bg[j]) a = Math.max(0, Math.min(1, (light(i) - 6) / 42));
      else if (light(i) < 18) a = Math.max(.15, Math.min(1, (light(i) - 3) / 15));
      const fy = y / H; if (fy > .86) a *= Math.max(0, 1 - (fy - .86) / .14);
      if (a < 1 && a > 0) for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (d[i + ch] - 255 * (1 - a)) / a));
      d[i + 3] = Math.round(255 * a);
    }
    g.putImageData(img, 0, 0);
    const o = document.createElement('canvas'); o.width = 600; o.height = 900; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    // 等比缩放到高 900，按留下的墨块左右范围居中（超出 600 宽的两侧裁掉）
    const s = 900 / H, mid = (bx0 + bx1) / 2; og.drawImage(c, 0, 0, cw, H, 300 - mid * s, 0, cw * s, 900);
    outs.push(o.toDataURL('image/webp', .86));
  }
  return { size: [W, H], cuts, outs };
}, ['data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), IDS.length, +(process.env.PAD ?? .14), +(process.env.MINBLOB ?? .01)]);
res.outs.forEach((u, k) => { const f = OUT + IDS[k] + '.webp', buf = Buffer.from(u.split(',')[1], 'base64'); fs.writeFileSync(f, buf); console.log('→', f, buf.length); });
console.log('源图', res.size.join('×'), '分界', res.cuts.join(','));
await b.close();
