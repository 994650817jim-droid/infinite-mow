// 洋红底「反混合」：半透明的烟尘 / 火光和洋红底混在一起时，按「前景蓝 ≈ kb × 前景绿」的色系假设反解出透明度和本色，
// 避免直接抠色留下粉边或把淡淡的预警烟尘整片抠掉。输出透明 PNG（再交给 prepare-warn-fx 切帧）。
// 用法：node tools/unmix-magenta.mjs <原图> <输出> [kb=0.7]
//   kb：暖色系（火 / 土 / 金 / 红）用 0.6~0.8；紫金雷电用 1.2 左右。
import { chromium } from 'playwright'; import { readFileSync, writeFileSync } from 'node:fs';
const [src, out, kbS] = process.argv.slice(2), KB = Number(kbS ?? .7);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ([url, KB]) => {
    const im = new Image(); im.src = url; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], gr = a[i + 1], bl = a[i + 2];
      let al = 1 - (bl - KB * gr) / 255; al = Math.max(0, Math.min(1, al));
      if (al < .1) { a[i + 3] = 0; continue; } // 背景洋红有轻微噪点，透明度 <10% 的一律当背景
      // kb 只用来估透明度；有了透明度后三个通道都按混合公式精确反解（不透明处保持原色，金色不会被染紫）
      const fr = (r - (1 - al) * 255) / al, fg = gr / al, fb = (bl - (1 - al) * 255) / al;
      a[i] = Math.max(0, Math.min(255, fr)); a[i + 1] = Math.max(0, Math.min(255, fg)); a[i + 2] = Math.max(0, Math.min(255, fb)); a[i + 3] = Math.round(al * 255);
    }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), KB]);
  writeFileSync(out, Buffer.from(data, 'base64')); console.log('unmixed', out, 'kb', KB);
} finally { await b.close(); }
