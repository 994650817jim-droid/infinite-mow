// 人物画风 v2：通用敌兵图（第一章黄巾军共用）调色——洋红串色 / 灰褐布衣 → 黄褐布衣，头巾 / 腰带 → 明黄；肤色、木弓、马匹基本不动。
// 用法：node tools/artv2-recolor.mjs <in.png> [out.png]（省略 out 则覆盖原文件）
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out = src] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const url = 'data:image/png;base64,' + readFileSync(src).toString('base64');
  const res = await p.evaluate(async url => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    const rgb2hsl = (r, gg, bb) => { r /= 255; gg /= 255; bb /= 255; const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const dd = mx - mn, s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn); let h = mx === r ? (gg - bb) / dd + (gg < bb ? 6 : 0) : mx === gg ? (bb - r) / dd + 2 : (r - gg) / dd + 4; return [h * 60, s, l]; };
    const hsl2rgb = (h, s, l) => { h /= 360; const f = (pp, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < .5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; }; if (!s) return [l, l, l].map(v => Math.round(v * 255)); const q = l < .5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q; return [f(pp, q, h + 1 / 3), f(pp, q, h), f(pp, q, h - 1 / 3)].map(v => Math.round(v * 255)); };
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 8) continue;
      let [h, s, l] = rgb2hsl(a[i], a[i + 1], a[i + 2]);
      if (l < .12) continue; // 描边 / 最暗阴影不动
      let nh = h, ns = s;
      if (h >= 290 || h < 16) { nh = 36; ns = Math.min(s, .32) * .9 + .06; }             // 洋红串色、偏粉红的布：拉回黄褐
      else if (h < 52 && s < .34) { nh = 36 + (h - 30) * .15; ns = s * 1.15 + .07; }      // 灰褐布衣：黄褐 / 土黄
      else if (h >= 30 && h < 56 && s >= .34) { nh = 46; ns = Math.min(1, s * 1.15 + .05); l = Math.min(.82, l * 1.05); } // 头巾 / 腰带：明黄
      else continue;
      const [r, gg, bb] = hsl2rgb(nh, Math.min(1, ns), l); a[i] = r; a[i + 1] = gg; a[i + 2] = bb; n++;
    }
    g.putImageData(d, 0, 0);
    return { n, data: c.toDataURL('image/png') };
  }, url);
  writeFileSync(out, Buffer.from(res.data.split(',')[1], 'base64'));
  console.log(out, '改色像素', res.n);
} finally { await b.close(); }
