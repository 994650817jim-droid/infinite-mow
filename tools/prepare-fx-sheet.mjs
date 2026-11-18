// 手绘光效序列帧（黑底、叠加混合用）：整张缩放到 COLS×CELL_W 宽、ROWS×CELL_H 高，并把接近黑的底压成纯黑（叠加时不留灰雾）。
// 用法：COLS=4 ROWS=4 CELL_W=128 CELL_H=256 [FLOOR=10] [GAIN=1（整体提亮倍数）] [ALPHA=1] node tools/prepare-fx-sheet.mjs <in.png> <out.png>
// ALPHA=1：再把黑底反解成透明（不透明度 = 最亮通道 × ALPHA_GAIN（默认 1；>1 让实体部分保持不透明、保住手绘明暗），颜色按不透明度还原），游戏里用普通混合也能在亮地面上保住银白 / 淡青，不会叠成一片白（赵云被动特效）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2), e = process.env;
const ALPHA = e.ALPHA === '1', AGAIN = +(e.ALPHA_GAIN ?? 1), COLS = +(e.COLS ?? 4), ROWS = +(e.ROWS ?? 4), CW = +(e.CELL_W ?? 128), CH = +(e.CELL_H ?? 256), FLOOR = +(e.FLOOR ?? 10), GAIN = +(e.GAIN ?? 1);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ([url, COLS, ROWS, CW, CH, FLOOR, GAIN, ALPHA, AGAIN]) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = COLS * CW; c.height = ROWS * CH;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
    const sw = img.width / COLS, sh = img.height / ROWS;
    for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) g.drawImage(img, k * sw, r * sh, sw, sh, k * CW, r * CH, CW, CH);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data, s = GAIN * 255 / (255 - FLOOR);
    for (let i = 0; i < a.length; i += 4) for (let j = 0; j < 3; j++) a[i + j] = Math.max(0, Math.min(255, Math.round((a[i + j] - FLOOR) * s)));
    if (ALPHA) for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); if (!m) { a[i + 3] = 0; continue; } const al = Math.min(255, m * AGAIN); for (let j = 0; j < 3; j++) a[i + j] = Math.min(255, Math.round(a[i + j] * 255 / al)); a[i + 3] = al; }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + readFileSync(src).toString("base64"), COLS, ROWS, CW, CH, FLOOR, GAIN, ALPHA, AGAIN]);
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(out, `${COLS * CW}×${ROWS * CH}`);
} finally { await b.close(); }
