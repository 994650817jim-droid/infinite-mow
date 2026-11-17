// 手绘特效序列帧整理（Gemini 白底 / 黑底 → 透明序列帧）。2026-11-17：ChatGPT 额度用完后改用 Gemini Pro 出图，Gemini 只出白底。
// 去底：以白色为键色做“颜色转透明”（每通道离白的距离取最大即不透明度，再反解原色），尘雾、发光边缘保留半透明。
// 版式：源图按 ROWS×COLS 等分，每格缩放到 FW×FH 原样输出（不裁正方形，适合横长条的裂波 / 拖影）。
// 用法：SRC=public/assets/hero-fx/originals/weiyan_crack_gemini.jpg OUT=public/assets/hero-fx/weiyan_crack.png ROWS=6 COLS=1 FW=1024 FH=256 node tools/prepare-fx-white.mjs
// 可选：KEY=black（黑底发光特效：按亮度反解不透明度，适合加亮光效）、INSET（每格四边内缩的源图像素，去掉 Gemini 自带的格线，默认 0）、NOISE（白底噪点容差，默认 .06）、FLOOR（不透明度低于此值清零，默认 .03）、WARM=1（去掉反解残留的绿 / 紫偏色）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC, OUT } = process.env;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const ROWS = +(process.env.ROWS ?? 6), COLS = +(process.env.COLS ?? 1), FW = +(process.env.FW ?? 1024), FH = +(process.env.FH ?? 256);
const KEY = process.env.KEY ?? 'white', INSET = +(process.env.INSET ?? 0);
const NOISE = +(process.env.NOISE ?? .06), FLOOR = +(process.env.FLOOR ?? .03), WARM = process.env.WARM === '1';
const mime = /\.png$/i.test(SRC) ? 'image/png' : 'image/jpeg';
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, mime, ROWS, COLS, FW, FH, NOISE, FLOOR, WARM, KEY, INSET]) => {
  const img = new Image(); img.src = `data:${mime};base64,` + src; await img.decode();
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const bk = KEY === 'black'; let a = 0; for (let k = 0; k < 3; k++) a = Math.max(a, (bk ? d[i + k] : 255 - d[i + k]) / 255);
    a = (a - NOISE) / (1 - NOISE);
    if (a < FLOOR) { d[i + 3] = 0; continue; }
    if (a > 1) a = 1;
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, bk ? d[i + k] / a : 255 - (255 - d[i + k]) / a));
    if (WARM) { if (d[i + 1] > d[i]) d[i + 1] = d[i]; if (d[i + 2] > d[i + 1]) d[i + 2] = d[i + 1]; }
    d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(id, 0, 0);
  const cw = W / COLS, ch = H / ROWS, out = document.createElement('canvas'); out.width = FW * COLS; out.height = FH * ROWS; const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) o.drawImage(c, i * cw + INSET, r * ch + INSET, cw - 2 * INSET, ch - 2 * INSET, i * FW, r * FH, FW, FH);
  // 每帧碰到格边的像素数（内容越格的提示）与内容横向范围（便于定原点）
  const od = o.getImageData(0, 0, out.width, out.height).data, info = [];
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) {
    let edge = 0, x0 = FW, x1 = 0;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const al = od[((r * FH + y) * out.width + i * FW + x) * 4 + 3]; if (al > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y === 0 || y === FH - 1 || x === 0 || x === FW - 1) edge++; } }
    info.push(`${edge}/${x0}-${x1}`);
  }
  return { url: out.toDataURL('image/png'), size: [W, H], info };
}, [readFileSync(SRC).toString('base64'), mime, ROWS, COLS, FW, FH, NOISE, FLOOR, WARM, KEY, INSET]);
writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`${OUT}  源图 ${res.size.join('×')} → ${COLS}×${ROWS} 帧 ${FW}×${FH}  每帧 碰边像素/内容横向范围：${res.info.join('  ')}`);
await b.close();
