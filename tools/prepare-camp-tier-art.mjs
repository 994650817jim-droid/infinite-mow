// 营寨档建筑（大殿 1 级用的帐篷版）：洋红底 2×2 网格（左上 中军大帐 / 右上 招贤帐 / 左下 讲武校场 / 右下 军营）
// → public/assets/city/camp_hall.webp、camp_talent.webp、camp_academy.webp、camp_barracks.webp。
// 每张的画布尺寸与对应的原图（hall_1 / talent_1 / academy_1 / barracks_1）一致：抠洋红 → 取不透明外框 → 等比缩放塞进原画布（宽高都不超）→ 底边居中贴底。
// 用法：node tools/prepare-camp-tier-art.mjs <原图.png>（不需要开发服务器）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2];
if (!src) throw new Error('用法：node tools/prepare-camp-tier-art.mjs <原图.png>');
const CELLS = [['hall', 'hall_1'], ['talent', 'talent_1'], ['academy', 'academy_1'], ['barracks', 'barracks_1']];
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([data, refs]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const im = await load(data), W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    // 洋红色键 + 去溢色（同 prepare-camp-art.mjs）
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.max(0, Math.min(R, B) - G);
      const a = m >= 200 ? 0 : m <= 18 ? 1 : 1 - (m - 18) / 182; let r2 = R, b2 = B;
      if (a > 0 && a < 1) { r2 = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)); b2 = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a)); }
      const spill = Math.max(0, Math.min(r2, b2) - G); d[i] = r2 - spill; d[i + 2] = b2 - spill; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    const out = [];
    for (let k = 0; k < 4; k++) {
      const cx = (k % 2) * W / 2, cy = Math.floor(k / 2) * H / 2, cw = W / 2, ch = H / 2;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = Math.floor(cy); y < cy + ch; y++) for (let x = Math.floor(cx); x < cx + cw; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const ref = await load(refs[k]), RW = ref.width, RH = ref.height, bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const s = Math.min(RW / bw, RH / bh), dw = Math.round(bw * s), dh = Math.round(bh * s);
      const o = document.createElement('canvas'); o.width = RW; o.height = RH; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      og.drawImage(cv, x0, y0, bw, bh, Math.round((RW - dw) / 2), RH - dh, dw, dh);
      out.push({ url: o.toDataURL('image/webp', .92), RW, RH, box: [bw, bh], fit: [dw, dh] });
    }
    return out;
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), CELLS.map(([, r]) => 'data:image/webp;base64,' + readFileSync(`public/assets/city/${r}.webp`).toString('base64'))]);
  res.forEach((r, k) => { const f = `public/assets/city/camp_${CELLS[k][0]}.webp`; writeFileSync(f, Buffer.from(r.url.split(',')[1], 'base64')); console.log(f, `${r.RW}×${r.RH}`, '外框', r.box.join('×'), '→', r.fit.join('×')); });
} finally { await b.close(); }
