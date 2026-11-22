// 「全剧终」题字预览：黑底 + 暗化的结局画卷，题字按 960×540 逻辑画面居中（输出 2×）。→ assets/review/ending/ending_finis_preview.png
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/ending/', rd = f => 'data:image/' + (f.endsWith('webp') ? 'webp' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (srcs) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const [bg, A, B] = await Promise.all(srcs.map(load));
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 1920, 1080); g.globalAlpha = .3; g.drawImage(bg, 0, 0, 1920, 1080); g.globalAlpha = 1;
    g.drawImage(A, 960 - A.width / 2, 300); g.drawImage(B, 960 - B.width / 2, 560); g.fillStyle = '#888'; g.font = '20px sans-serif'; g.fillText('备选 A / 备选 B（960×540 逻辑画面，2× 输出）', 20, 1050);
    return c.toDataURL('image/png');
  }, [rd(O + 'ending_three.webp'), rd(O + 'finis_a.png'), rd(O + 'finis_b.png')]);
  fs.writeFileSync('assets/review/ending/ending_finis_preview.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
