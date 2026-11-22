// 火油罐预览：战斗截图 w3-gate.jpg 一块地面上摆完好 / 碎裂（显示缩放 0.25 与 0.5 两档，主将在旁对照）+ 2 帧原图。→ assets/review/bosses/oil_jar_preview.png
import { chromium } from 'playwright';
import fs from 'fs';
const rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
fs.mkdirSync('assets/review/bosses', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (S) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const [jar, shot] = await Promise.all(S.map(load));
    const c = document.createElement('canvas'); c.width = 900; c.height = 560; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#26211c'; g.fillRect(0, 0, 900, 560);
    g.drawImage(shot, 560, 70, 360, 180, 10, 10, 360, 180); g.drawImage(shot, 560, 70, 360, 180, 380, 10, 360, 180);
    [[10, .25], [380, .5]].forEach(([ox, sc]) => { [0, 1].forEach(i => g.drawImage(jar, i * 256, 0, 256, 256, ox + 40 + i * (sc === .25 ? 120 : 160), 10 + 170 - 256 * sc + 24 * sc, 256 * sc, 256 * sc)); });
    g.drawImage(shot, 640, 100, 56, 80, 330, 110, 28, 40);
    g.fillStyle = '#ccc'; g.font = '13px sans-serif'; g.fillText('显示缩放 0.25（罐约 50px 高）/ 0.5（约 100px 高），截图里主将约 65px', 10, 205);
    g.fillStyle = '#3a342c'; g.fillRect(10, 230, 530, 270); g.drawImage(jar, 0, 0, 512, 256, 15, 240, 512, 256); g.fillStyle = '#ccc'; g.fillText('gauntlet_oil_jar.png（512×256，两帧：完好 / 碎裂）', 10, 520);
    return c.toDataURL('image/png');
  }, [rd('public/assets/props/gauntlet_oil_jar.png'), rd(process.env.SHOT)]);
  fs.writeFileSync('assets/review/bosses/oil_jar_preview.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
