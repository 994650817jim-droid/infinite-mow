// 行营人物的对话气泡与朱印角标（ChatGPT 出图，洋红底 1536×1024：左边宣纸气泡、右边空白朱文方印）
//   → public/assets/camp/speech_bubble.webp、public/assets/camp/seal.webp（透明底）
//   node tools/prepare-camp-bubble.mjs [原图，默认 public/assets/camp/originals/bubble_seal_chatgpt.png]
// 抠图同 prepare-camp-art.mjs（洋红色键 + 去溢色）；按洋红空隙把画面切成左右两块，各取不透明外框。不需要开发服务器。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const src = process.argv[2] ?? 'public/assets/camp/originals/bubble_seal_chatgpt.png';
const OUT = [['public/assets/camp/speech_bubble.webp', 600], ['public/assets/camp/seal.webp', 128]];
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const parts = await p.evaluate(async ([data, maxes]) => {
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
    // 按列找不透明区段（左右两块之间是整列透明）
    const col = x => { for (let y = 0; y < H; y++) if (d[(y * W + x) * 4 + 3] > 24) return true; return false; };
    const runs = []; let start = -1; for (let x = 0; x <= W; x++) { const on = x < W && col(x); if (on && start < 0) start = x; if (!on && start >= 0) { if (x - start > 20) runs.push([start, x - 1]); start = -1; } }
    return runs.slice(0, 2).map(([x0, x1], k) => {
      let y0 = H, y1 = 0; for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] > 24) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, maxes[k] / Math.max(cw, ch)), o = document.createElement('canvas'); o.width = Math.round(cw * s); o.height = Math.round(ch * s);
      const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cv, x0, y0, cw, ch, 0, 0, o.width, o.height);
      return { box: [x0, y0, cw, ch], size: [o.width, o.height], webp: o.toDataURL('image/webp', .9) };
    });
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), OUT.map(o => o[1])]);
  if (parts.length < 2) throw new Error('没找到两块素材：' + parts.length);
  parts.forEach((r, k) => { writeFileSync(OUT[k][0], Buffer.from(r.webp.split(',')[1], 'base64')); console.log(OUT[k][0], '原图框', r.box.join(','), '输出', r.size.join('×')); });
} finally { await b.close(); }
