// 场景图集整理：洋红底网格原图（COLS×ROWS 等分，可选只取一条横带）→ 透明图集（每格 CELL 见方）。
// 每格：抠洋红（硬抠 + 只对半透明边缘去溢色——紫色物件的实心像素不能去，否则变蓝）→ 取不透明外框 → 等比缩放塞进格子（四周留 MARGIN）→ 水平居中，ANCHOR=bottom 贴底（默认）或 center。
// 用法：SRC=…/warships_gem.jpg OUT=public/assets/scene-v2/warships.png COLS=2 ROWS=2 CELL=512 ANCHOR=center node tools/prepare-scene-sheet.mjs
// SPILL=all（对实心像素也去洋红溢色，非紫色物件的暗部有粉雾时用）；WIN（每件物件的搜索窗口 x0,y0,x1,y1 占原图比例，分号分隔，按输出格序）。可选：XSPLIT / YSPLIT（列 / 行的分界，占原图宽 / 高的比例，逗号分隔，个数 = 列数 − 1；物件越过等分线时用）、MARGIN（默认 .06）、BAND=y0,y1（只取原图高度的这段，如 .25,.75，网格排在带里）、KEYHARD / KEYSOFT、SCALE_SHARE=1（所有格共用一个缩放：按最大一格定，保持相对大小）、COUNT（只输出前 N 格）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
const E = process.env, { SRC, OUT } = E;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const COLS = +(E.COLS ?? 4), ROWS = +(E.ROWS ?? 2), CELL = +(E.CELL ?? 256), MARGIN = +(E.MARGIN ?? .06), ANCHOR = E.ANCHOR ?? 'bottom', SHARE = E.SCALE_SHARE === '1';
const XSPLIT = E.XSPLIT ? E.XSPLIT.split(',').map(Number) : null, YSPLIT = E.YSPLIT ? E.YSPLIT.split(',').map(Number) : null;
const WIN = E.WIN ? E.WIN.split(';').map(s => s.split(',').map(Number)) : null; // 每件物件的搜索窗口 x0,y0,x1,y1（占原图宽 / 高的比例），按输出格序；不规则排列时用
const EXCL = E.EXCL ? E.EXCL.split(';').map(s => { const [k, r] = s.split(':'); return [+k, r.split(',').map(Number)]; }) : null; // 每格要忽略的矩形 k:x0,y0,x1,y1（占原图比例；窗口里混进邻居的碎片时用）
const [by0, by1] = (E.BAND ?? '0,1').split(',').map(Number), KH = +(E.KEYHARD ?? 140), KS = +(E.KEYSOFT ?? 60);
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.webp': 'image/webp' }[extname(SRC).toLowerCase()] ?? 'image/png';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([data, COLS, ROWS, CELL, MARGIN, ANCHOR, SHARE, by0, by1, KH, KS, XSPLIT, YSPLIT, WIN, SPILLALL, EXCL]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.max(0, Math.min(R, B) - G);
      const a = m >= KH ? 0 : m <= KS ? 1 : 1 - (m - KS) / (KH - KS); let r2 = R, b2 = B;
      if (a > 0 && a < 1) { r2 = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)); b2 = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a)); }
      const spill = (a < 1 || SPILLALL) ? Math.max(0, Math.min(r2, b2) - G) : 0; d[i] = r2 - spill; d[i + 2] = b2 - spill; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    const gy0 = Math.round(H * by0), gh = Math.round(H * (by1 - by0)), cw = W / COLS, ch = gh / ROWS, boxes = [];
    for (let k = 0; k < COLS * ROWS; k++) {
      const ci = k % COLS, ri = Math.floor(k / COLS), xs = [0, ...(XSPLIT ?? Array.from({ length: COLS - 1 }, (_, i) => (i + 1) / COLS)), 1], ys = [0, ...(YSPLIT ?? Array.from({ length: ROWS - 1 }, (_, i) => (i + 1) / ROWS)), 1];
      let x0 = Math.round(xs[ci] * W), x1 = Math.round(xs[ci + 1] * W), y0 = Math.round(H * (by0 + (by1 - by0) * ys[ri])), y1 = Math.round(H * (by0 + (by1 - by0) * ys[ri + 1]));
      if (WIN) { const w = WIN[k]; x0 = Math.round(w[0] * W); y0 = Math.round(w[1] * H); x1 = Math.round(w[2] * W); y1 = Math.round(w[3] * H); }
      let bx0 = 1e9, bx1 = -1, bY0 = 1e9, bY1 = -1; const ex = (EXCL ?? []).filter(e => e[0] === k).map(e => e[1]);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (d[(y * W + x) * 4 + 3] > 40 && !ex.some(r => x >= r[0] * W && x < r[2] * W && y >= r[1] * H && y < r[3] * H)) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < bY0) bY0 = y; if (y > bY1) bY1 = y; }
      boxes.push(bx1 < 0 ? null : { x: bx0, y: bY0, w: bx1 - bx0 + 1, h: bY1 - bY0 + 1 });
    }
    const inner = CELL * (1 - 2 * MARGIN), sAll = Math.min(...boxes.filter(Boolean).map(o => Math.min(inner / o.w, inner / o.h)));
    const out = document.createElement('canvas'); out.width = CELL * COLS; out.height = CELL * ROWS; const og = out.getContext('2d'); og.imageSmoothingQuality = 'high'; const info = [];
    boxes.forEach((o, k) => {
      if (!o) { info.push(k + ': 空'); return; }
      const s = SHARE ? sAll : Math.min(inner / o.w, inner / o.h), dw = o.w * s, dh = o.h * s, cx = (k % COLS) * CELL, cy = Math.floor(k / COLS) * CELL;
      const exs = (EXCL ?? []).filter(e => e[0] === k).map(e => e[1]); let srcCv = cv, sx0 = o.x, sy0 = o.y;
      if (exs.length) { const tc = document.createElement('canvas'); tc.width = o.w; tc.height = o.h; const tg = tc.getContext('2d'); tg.drawImage(cv, o.x, o.y, o.w, o.h, 0, 0, o.w, o.h); for (const r of exs) tg.clearRect(r[0] * W - o.x, r[1] * H - o.y, (r[2] - r[0]) * W, (r[3] - r[1]) * H); srcCv = tc; sx0 = 0; sy0 = 0; }
      og.drawImage(srcCv, sx0, sy0, o.w, o.h, cx + (CELL - dw) / 2, ANCHOR === 'center' ? cy + (CELL - dh) / 2 : cy + CELL - CELL * MARGIN - dh, dw, dh);
      info.push(`${k}: ${o.w}×${o.h} → ${Math.round(dw)}×${Math.round(dh)}`);
    });
    return { url: out.toDataURL('image/png'), info };
  }, [`data:${mime};base64,` + readFileSync(SRC).toString('base64'), COLS, ROWS, CELL, MARGIN, ANCHOR, SHARE, by0, by1, KH, KS, XSPLIT, YSPLIT, WIN, E.SPILL === 'all', EXCL]);
  writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64')); console.log(OUT, res.info.join(' | '));
} finally { await b.close(); }
