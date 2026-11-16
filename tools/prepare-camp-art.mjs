// 营寨新建筑美术（ChatGPT 生成，洋红底 3×3 网格：列 = 讲武堂 / 马厩 / 招贤馆，行 = Lv1 / Lv2 / Lv3）→ public/assets/city/<id>_<lv>.webp
//   node tools/prepare-camp-art.mjs <原图.png>
// 抠图与 prepare-city-art.mjs 相同（洋红色键 + 去溢色），每格取不透明外框，最长边 ≤ 512。需要开发服务器（BASE，默认 5173）用浏览器 canvas 编码。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = process.argv[2], OUT = 'public/assets/city', COLS = ['academy', 'stable', 'talent'], ROWS = 3;
if (!src) throw new Error('用法：node tools/prepare-camp-art.mjs <原图.png>');
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage(); await p.goto(process.env.BASE ?? 'http://127.0.0.1:5173/');
  const r = await p.evaluate(async ([data, nc, nr]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.max(0, Math.min(R, B) - G);
      const a = m >= 200 ? 0 : m <= 18 ? 1 : 1 - (m - 18) / 182; let r2 = R, b2 = B;
      if (a > 0 && a < 1) { r2 = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)); b2 = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a)); }
      const spill = Math.max(0, Math.min(r2, b2) - G); d[i] = r2 - spill; d[i + 2] = b2 - spill; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    const op = (x, y) => d[(y * W + x) * 4 + 3] > 40;
    const colCount = (x, y0, y1) => { let k = 0; for (let y = y0; y < y1; y++) if (op(x, y)) k++; return k; };
    const rowCount = (y, x0, x1) => { let k = 0; for (let x = x0; x < x1; x++) if (op(x, y)) k++; return k; };
    const cut = (len, parts, count) => { const cuts = [0]; for (let k = 1; k < parts; k++) { const c = Math.round(len * k / parts), r0 = Math.round(len * .08); let best = c, bn = Infinity; for (let v = c - r0; v <= c + r0; v++) { const q = count(v); if (q < bn) { bn = q; best = v; } } cuts.push(best); } cuts.push(len); return cuts; };
    const ys = cut(H, nr, y => rowCount(y, 0, W)), cells = [];
    for (let r = 0; r < nr; r++) {
      const xs = cut(W, nc, x => colCount(x, ys[r], ys[r + 1]));
      for (let c = 0; c < nc; c++) {
        const X0 = xs[c], X1 = xs[c + 1], Y0 = ys[r], Y1 = ys[r + 1];
        let x0 = X1, x1 = X0, y0 = Y1, y1 = Y0;
        for (let x = X0; x < X1; x++) if (colCount(x, Y0, Y1) > (Y1 - Y0) * .01) { if (x < x0) x0 = x; x1 = x + 1; }
        for (let y = Y0; y < Y1; y++) if (rowCount(y, X0, X1) > (X1 - X0) * .01) { if (y < y0) y0 = y; y1 = y + 1; }
        cells.push({ r, c, x0, y0, x1, y1 });
      }
    }
    const outs = cells.map(c => {
      const w = c.x1 - c.x0, h = c.y1 - c.y0, k = Math.min(1, 512 / Math.max(w, h)), o = document.createElement('canvas'); o.width = Math.max(1, Math.round(w * k)); o.height = Math.max(1, Math.round(h * k));
      const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cv, c.x0, c.y0, w, h, 0, 0, o.width, o.height);
      return o.toDataURL('image/webp', .9).split(',')[1];
    });
    return { W, H, cells: cells.map(c => [c.r, c.c, c.x1 - c.x0, c.y1 - c.y0]), outs };
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), COLS.length, ROWS]);
  console.log(`原图 ${r.W}×${r.H}，各格外框（行, 列, 宽, 高）：` + JSON.stringify(r.cells));
  const bad = r.cells.filter(([, , w, h]) => w < r.W / 10 || h < r.H / 8); if (bad.length) throw new Error('有格子没找到建筑：' + JSON.stringify(bad));
  r.cells.forEach(([row, col], i) => writeFileSync(`${OUT}/${COLS[col]}_${row + 1}.webp`, Buffer.from(r.outs[i], 'base64')));
  console.log(`已输出 ${OUT}/{${COLS.join(',')}}_{1,2,3}.webp`);
} finally { await b.close(); }
