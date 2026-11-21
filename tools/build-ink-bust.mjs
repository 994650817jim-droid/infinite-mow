// 剧情对白水墨半身像（网格版，2026-11-20）：Gemini 一张 N×M 宫格（每格一人，米白 / 白底半身像）→ 每人一张 600×900 透明底 WebP，
// 与 build-ink-cast.mjs 的输出规格一致（600×900，对白里取上 56%）。半身像放在画布上部，底部渐隐。
// 用法：SRC=public/assets/ink-cast/originals/gemini_cast9_a.png COLS=3 ROWS=3 IDS=liuxun,fazheng,... node tools/build-ink-bust.mjs
//   IDS 按行优先（左到右、上到下）。可选：INSET（每格四边内缩像素，默认 6）、WIDTH（半身像缩到的宽度，默认 560）、TOP（顶部留白像素，默认 10）、KEEPBOTTOM=1（底部也作为背景种子）。
// 背景：从每格的上 / 左 / 右边缘出发，沿「近白 / 米色」连通区域洪水填充成透明（底边不作种子，免得白袍从底边漏出去被抠掉）。
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, SRC = E.SRC, COLS = +(E.COLS ?? 3), ROWS = +(E.ROWS ?? 3), IDS = (E.IDS ?? '').split(',').filter(Boolean), OUT = 'public/assets/ink-cast/';
if (!SRC || IDS.length !== COLS * ROWS) { console.error(`需要 SRC，且 IDS 个数 = COLS×ROWS（${COLS * ROWS}）`); process.exit(2); }
const INSET = +(E.INSET ?? 6), WIDTH = +(E.WIDTH ?? 560), TOP = +(E.TOP ?? 10), KEEPBOTTOM = E.KEEPBOTTOM === '1';
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
const res = await p.evaluate(async ([src, COLS, ROWS, INSET, WIDTH, TOP, KEEPBOTTOM]) => {
  const im = new Image(); im.src = src; await im.decode();
  const W = im.width, H = im.height, outs = [];
  for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
    const x0 = Math.round(W * k / COLS) + INSET, x1 = Math.round(W * (k + 1) / COLS) - INSET, y0 = Math.round(H * r / ROWS) + INSET, y1 = Math.round(H * (r + 1) / ROWS) - INSET;
    const cw = x1 - x0, ch = y1 - y0, c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, x0, y0, cw, ch, 0, 0, cw, ch);
    const img = g.getImageData(0, 0, cw, ch), d = img.data, light = i => 255 - Math.min(d[i], d[i + 1], d[i + 2]);
    const bg = new Uint8Array(cw * ch), q = new Int32Array(cw * ch); let qh = 0, qt = 0;
    const push = (x, y) => { const j = y * cw + x; if (bg[j] || light(j * 4) > 48) return; bg[j] = 1; q[qt++] = j; };
    for (let x = 0; x < cw; x++) { push(x, 0); if (KEEPBOTTOM) push(x, ch - 1); } for (let y = 0; y < ch; y++) { push(0, y); push(cw - 1, y); }
    while (qh < qt) { const j = q[qh++], x = j % cw, y = (j / cw) | 0; if (x > 0) push(x - 1, y); if (x < cw - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < ch - 1) push(x, y + 1); }
    // 人物范围：非背景像素的左右 / 上下界
    let bx0 = cw, bx1 = 0, by0 = ch;
    for (let j = 0; j < cw * ch; j++) if (!bg[j]) { const x = j % cw, y = (j / cw) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; }
    const R = 8, near = new Uint8Array(cw * ch), tmp = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) { let last = -1e9; for (let x = 0; x < cw; x++) { if (!bg[y * cw + x]) last = x; if (x - last <= R) tmp[y * cw + x] = 1; } last = 1e9; for (let x = cw - 1; x >= 0; x--) { if (!bg[y * cw + x]) last = x; if (last - x <= R) tmp[y * cw + x] = 1; } }
    for (let x = 0; x < cw; x++) { let last = -1e9; for (let y = 0; y < ch; y++) { if (tmp[y * cw + x]) last = y; if (y - last <= R) near[y * cw + x] = 1; } last = 1e9; for (let y = ch - 1; y >= 0; y--) { if (tmp[y * cw + x]) last = y; if (last - y <= R) near[y * cw + x] = 1; } }
    for (let j = 0; j < cw * ch; j++) {
      const i = j * 4, y = (j / cw) | 0; let a = 1;
      if (bg[j] && !near[j]) a = 0; else if (bg[j]) a = Math.max(0, Math.min(1, (light(i) - 6) / 42));
      const fy = y / ch; if (fy > .82) a *= Math.max(0, 1 - (fy - .82) / .18);
      if (a < 1 && a > 0) for (let q2 = 0; q2 < 3; q2++) d[i + q2] = Math.max(0, Math.min(255, (d[i + q2] - 255 * (1 - a)) / a));
      d[i + 3] = Math.round(255 * a);
    }
    g.putImageData(img, 0, 0);
    const o = document.createElement('canvas'); o.width = 600; o.height = 900; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    const bw = Math.max(1, bx1 - bx0), s = Math.min(WIDTH / bw, 1.6), mid = (bx0 + bx1) / 2;
    og.drawImage(c, 0, by0, cw, ch - by0, 300 - mid * s, TOP, cw * s, (ch - by0) * s);
    outs.push(o.toDataURL('image/webp', .88));
  }
  return { size: [W, H], outs };
}, ['data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), COLS, ROWS, INSET, WIDTH, TOP, KEEPBOTTOM]);
fs.mkdirSync(OUT, { recursive: true });
res.outs.forEach((u, k) => { const f = OUT + IDS[k] + '.webp', buf = Buffer.from(u.split(',')[1], 'base64'); fs.writeFileSync(f, buf); console.log('→', f, buf.length); });
console.log('源图', res.size.join('×'));
await b.close();
