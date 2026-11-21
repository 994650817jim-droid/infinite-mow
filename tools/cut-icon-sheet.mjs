// 图标宫格切图（2026-11-20）：Bing / ChatGPT 出的「单色底 COLS×ROWS 图标表」→ 每格一个 256×256 透明 WebP（按内容裁边、等比居中留白）。
// 底色取整张图四边平均色，逐格从格边出发洪水填充成透明（被图标围住的同色块用较紧阈值再挖一遍），边缘 1 像素软边。
// 用法：SRC=public/assets/upgrade-icons/originals/raw/bing_icons_A.jpg COLS=3 ROWS=2 IDS=branch_gn_yexi,branch_gn_jieying,... [OUT=public/assets/upgrade-icons/] [TOL=60] [SIZE=256] [PAD=.06] node tools/cut-icon-sheet.mjs
//   IDS 按行优先；留空的格用 - 占位（跳过）。输出 <OUT><id>.webp
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, SRC = E.SRC, COLS = +(E.COLS ?? 3), ROWS = +(E.ROWS ?? 2), IDS = (E.IDS ?? '').split(','), OUT = E.OUT ?? 'public/assets/upgrade-icons/', TOL = +(E.TOL ?? 60), SIZE = +(E.SIZE ?? 256), PAD = +(E.PAD ?? .06);
if (!SRC || IDS.length !== COLS * ROWS) { console.error(`需要 SRC，且 IDS 个数 = COLS×ROWS（${COLS * ROWS}）`); process.exit(2); }
const mime = SRC.endsWith('.png') ? 'png' : 'jpeg';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([src, COLS, ROWS, TOL, SIZE, PAD]) => {
    const im = new Image(); im.src = src; await im.decode();
    const W = im.width, H = im.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    let r = 0, gg = 0, bl = 0, n = 0; const add = (x, y) => { const i = (y * W + x) * 4; r += d[i]; gg += d[i + 1]; bl += d[i + 2]; n++; };
    for (let x = 0; x < W; x++) { add(x, 0); add(x, H - 1); } for (let y = 0; y < H; y++) { add(0, y); add(W - 1, y); }
    const BR = r / n, BG = gg / n, BB = bl / n, outs = [];
    for (let ry = 0; ry < ROWS; ry++) for (let cx = 0; cx < COLS; cx++) {
      const x0 = Math.round(W * cx / COLS), x1 = Math.round(W * (cx + 1) / COLS), y0 = Math.round(H * ry / ROWS), y1 = Math.round(H * (ry + 1) / ROWS), w = x1 - x0, h = y1 - y0;
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h; const cg = cc.getContext('2d', { willReadFrequently: true }); cg.drawImage(c, x0, y0, w, h, 0, 0, w, h);
      const img = cg.getImageData(0, 0, w, h), q = img.data, dist = j => { const i = j * 4; return Math.hypot(q[i] - BR, q[i + 1] - BG, q[i + 2] - BB); };
      const bg = new Uint8Array(w * h), st = new Int32Array(w * h); let qh = 0, qt = 0;
      const push = (x, y) => { const j = y * w + x; if (bg[j] || dist(j) > TOL) return; bg[j] = 1; st[qt++] = j; };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      while (qh < qt) { const j = st[qh++], x = j % w, y = (j / w) | 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
      for (const [POCKET, MIN] of [[TOL * .75, 500], [TOL * .5, 20]]) { // 被图标围住的背景块（链环里、盾后）
        const seen = new Uint8Array(w * h);
        for (let s0 = 0; s0 < w * h; s0++) {
          if (bg[s0] || seen[s0] || dist(s0) > POCKET) continue; let sp = 0; const comp = []; st[sp++] = s0; seen[s0] = 1;
          while (sp) { const j = st[--sp]; comp.push(j); const x = j % w, y = (j / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const k = yy * w + xx; if (!seen[k] && !bg[k] && dist(k) <= POCKET) { seen[k] = 1; st[sp++] = k; } } }
          if (comp.length > MIN) for (const j of comp) bg[j] = 1;
        }
      }
      const a = new Float32Array(w * h).fill(1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const j = y * w + x; if (bg[j]) { a[j] = 0; continue; }
        let nb = false; for (let dy = -1; dy <= 1 && !nb; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && bg[yy * w + xx]) { nb = true; break; } }
        if (nb) a[j] = Math.max(0, Math.min(1, (dist(j) - TOL * .5) / (TOL * 1.2)));
      }
      let bx0 = w, bx1 = 0, by0 = h, by1 = 0;
      for (let j = 0; j < w * h; j++) if (a[j] > .5) { const x = j % w, y = (j / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      for (let j = 0; j < w * h; j++) { const i = j * 4; if (a[j] < 1 && a[j] > 0) for (let k = 0; k < 3; k++) { const base = [BR, BG, BB][k]; q[i + k] = Math.max(0, Math.min(255, (q[i + k] - base * (1 - a[j])) / a[j])); } q[i + 3] = Math.round(255 * a[j]); }
      // 去洋红溢色（同 prepare-branch-icons.py unpink）：光晕 / 烟尘里 min(红,蓝) 明显高于绿的像素降不透明度、把蓝压回去
      for (let j = 0; j < w * h; j++) { const i = j * 4; if (!q[i + 3]) continue; const R = q[i], G = q[i + 1], B = q[i + 2], tint = Math.max(0, Math.min(R, B) - G - 40); if (tint > 0) { q[i + 3] = Math.round(q[i + 3] * Math.max(0, Math.min(1, 1 - tint / 60))); q[i + 2] = Math.min(B, G + (R - G) * .5 + 10); } }
      cg.putImageData(img, 0, 0);
      const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, side = Math.max(bw, bh) * (1 + PAD * 2);
      const o = document.createElement('canvas'); o.width = SIZE; o.height = SIZE; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      const s = SIZE / side; og.drawImage(cc, bx0, by0, bw, bh, (SIZE - bw * s) / 2, (SIZE - bh * s) / 2, bw * s, bh * s);
      outs.push({ box: [bx0, by0, bx1, by1, w, h], webp: o.toDataURL('image/webp', .92) });
    }
    return { bg: [BR, BG, BB].map(Math.round), outs };
  }, [`data:image/${mime};base64,` + fs.readFileSync(SRC).toString('base64'), COLS, ROWS, TOL, SIZE, PAD]);
  fs.mkdirSync(OUT, { recursive: true });
  res.outs.forEach((o, k) => { const id = IDS[k]; if (!id || id === '-') return; const buf = Buffer.from(o.webp.split(',')[1], 'base64'); fs.writeFileSync(OUT + id + '.webp', buf); console.log('→', OUT + id + '.webp', buf.length, 'box', o.box.join(',')); });
  console.log('底色', res.bg);
} finally { await b.close(); }
