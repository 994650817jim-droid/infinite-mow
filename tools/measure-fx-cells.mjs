// 量特效图集每格里不透明内容的包围盒（占格宽 / 格高的比例），用来定 WarnFx 的 RING_FRAC / SWEEP_* / LANE_FRAC。
// 用法：node tools/measure-fx-cells.mjs <png> <每行帧数> <格宽>[x格高] [行数]
import { chromium } from 'playwright'; import { readFileSync } from 'node:fs';
const [f, nS, cellS, rowsS] = process.argv.slice(2), N = +nS, [CW, CH] = cellS.includes('x') ? cellS.split('x').map(Number) : [+cellS, +cellS], ROWS = +(rowsS ?? 1);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([url, N, CW, CH, ROWS]) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, out = [];
    for (let r = 0; r < ROWS; r++) { const row = [];
      for (let k = 0; k < N; k++) { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
        for (let y = r * CH; y < (r + 1) * CH; y++) for (let x = k * CW; x < (k + 1) * CW; x++) if (d[(y * c.width + x) * 4 + 3] > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        row.push(x1 < 0 ? null : { w: +((x1 - x0) / CW).toFixed(2), h: +((y1 - y0) / CH).toFixed(2), l: +((x0 - k * CW) / CW).toFixed(2), r: +((x1 - k * CW) / CW).toFixed(2), cy: +(((y0 + y1) / 2 - r * CH) / CH).toFixed(2) });
      } out.push(row); }
    return out;
  }, ['data:image/png;base64,' + readFileSync(f).toString('base64'), N, CW, CH, ROWS]);
  res.forEach((row, i) => console.log('row', i + 1, JSON.stringify(row)));
} finally { await b.close(); }
