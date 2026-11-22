// 印章预览：把 seal_red_* / seal_ghost_* 放在麒麟阁长卷纸面上（1× 96×96 与 2×），朱印上叠示意白字。→ assets/review/ending/ending_seals_preview.png
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/ending/', rd = f => 'data:image/' + (f.endsWith('webp') ? 'webp' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async ([paper, seals]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const P = await load(paper), S = await Promise.all(seals.map(load));
    const c = document.createElement('canvas'); c.width = 1100; c.height = 420; const g = c.getContext('2d'); g.drawImage(P, 300, 300, 1100, 420, 0, 0, 1100, 420); g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = ['黄', '官', '赤'];
    S.forEach((im, i) => { const red = i < 3, x = 40 + (i % 3) * 170, y = red ? 30 : 230; g.drawImage(im, x, y, 96, 96); if (red) { g.fillStyle = '#fff3e0'; g.font = 'bold 52px serif'; g.fillText(chars[i], x + 48, y + 52); } });
    S.forEach((im, i) => { const red = i < 3, x = 600 + (i % 3) * 170, y = red ? 20 : 220; g.drawImage(im, x, y, 192 * .8, 192 * .8); });
    g.fillStyle = '#2b1d12'; g.font = '14px sans-serif'; g.textAlign = 'left'; g.fillText('左：1×（96×96）  右：2× 原图放大示意', 10, 410);
    return c.toDataURL('image/png');
  }, [rd(O + 'ending_pavilion.webp'), ['red_1', 'red_2', 'red_3', 'ghost_1', 'ghost_2', 'ghost_3'].map(k => rd(O + `seal_${k}.png`))]);
  fs.writeFileSync('assets/review/ending/ending_seals_preview.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
