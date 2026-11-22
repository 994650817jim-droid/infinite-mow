// 结局印章底（2026-11-21）：Gemini 生成的绿幕印章表（1024×687，页面全屏 1:1 截图）→ 以每格背景色为底做色距抠像 → 切 6 个：seal_red_{1,2,3}.png（朱印空印，192×192，2× 图，显示 96×96）、seal_ghost_{1,2,3}.png（未盖淡墨虚框）。
// 用法：node tools/make-ending-seals.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/ending/', src = 'data:image/jpeg;base64,' + fs.readFileSync(O + 'originals/raw/ending_seals_gemini_1_screenshot.jpg').toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async (u) => {
    const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const cx = [173, 512, 851], cy = [176, 515], out = {};
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const c = document.createElement('canvas'); c.width = 240; c.height = 240; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, cx[col] - 120, cy[row] - 120, 240, 240, 0, 0, 240, 240);
      const d = g.getImageData(0, 0, 240, 240), a = d.data, bg = [0, 0, 0]; let n = 0; for (const [x, y] of [[4, 4], [235, 4], [4, 235], [235, 235], [120, 4], [120, 235]]) { const i = (y * 240 + x) * 4; bg[0] += a[i]; bg[1] += a[i + 1]; bg[2] += a[i + 2]; n++; } bg[0] /= n; bg[1] /= n; bg[2] /= n;
      const ghost = row === 1;
      for (let i = 0; i < a.length; i += 4) { const gn = a[i + 1] - Math.max(a[i], a[i + 2]); let al = ghost ? Math.max(0, Math.min(1, (186 - gn) / 45)) : Math.max(0, Math.min(1, (60 - gn) / 90));
        if (ghost) { al = Math.min(.8, al * .9); a[i] = 74; a[i + 1] = 66; a[i + 2] = 58; } else { const m = Math.max(a[i], a[i + 2]); if (a[i + 1] > m) a[i + 1] = m; if (al < 1 && al > 0) { for (let k = 0; k < 3; k++) a[i + k] = Math.max(0, Math.min(255, (a[i + k] - bg[k] * (1 - al)) / al)); const m2 = Math.max(a[i], a[i + 2]); if (a[i + 1] > m2) a[i + 1] = m2; } }
        a[i + 3] = Math.round(al * 255); }
      g.putImageData(d, 0, 0); const o = document.createElement('canvas'); o.width = o.height = 192; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, 192, 192); out[`${ghost ? 'ghost' : 'red'}_${col + 1}`] = o.toDataURL('image/png');
    }
    return out;
  }, src);
  for (const [k, u] of Object.entries(r)) fs.writeFileSync(O + `seal_${k}.png`, Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
