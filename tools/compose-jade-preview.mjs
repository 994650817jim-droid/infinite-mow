// 青玉军功符 / 金令牌 / 铜钱 并排预览 + 行囊鼓起态预览（2026-11-21）。→ assets/review/coins/jade_preview.png
// ① 战斗截图 w3-gate.jpg 一块 1:1：三样信物按实际显示尺寸（青玉 17 / 铜钱 17 / 金令牌 26）散落在地面；② 同一块放大 3×（只放大看，实际是 1:1）；③ 行囊原图 / 鼓起态在 HUD 右上角位置各一张（1:1）。
// 用法：SHOT=…/w3-gate.jpg node tools/compose-jade-preview.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : f.endsWith('webp') ? 'webp' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (S) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const [shot, jade, tok, coin, bun, full] = await Promise.all(S.map(load));
    const c = document.createElement('canvas'); c.width = 1000; c.height = 640; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#1c1814'; g.fillRect(0, 0, 1000, 640);
    const area = [560, 120, 320, 140]; // 截图里的一块地面 / 部曲区
    const scene = (gx, ox, oy, sc) => { gx.save(); gx.translate(ox, oy); gx.scale(sc, sc); gx.imageSmoothingEnabled = sc === 1 ? true : false; gx.drawImage(shot, area[0], area[1], area[2], area[3], 0, 0, area[2], area[3]);
      const items = [[jade, 17, 40, 95, 0], [coin, 17, 78, 100, 0], [tok, 26, 116, 92, 0], [jade, 17, 160, 108, 2], [coin, 17, 198, 112, 2], [tok, 26, 236, 100, 2], [jade, 17, 268, 90, 3], [coin, 17, 288, 95, 3]];
      items.forEach(([im, sz, x, y, f]) => { const fw = im.width / (im === tok ? 4 : 4), fh = im.height; gx.drawImage(im, f * fw, 0, fw, fh, x - sz / 2, y - sz / 2, sz, sz); }); gx.restore(); };
    scene(g, 10, 10, 1); scene(g, 350, 10, 3);
    g.fillStyle = '#ccc'; g.font = '13px sans-serif'; g.fillText('① 1:1：青玉符 17px / 铜钱 17px / 金令牌 26px（各取不同帧）', 10, 165); g.fillText('② 同一块放大 3× 看细节', 350, 10 + 140 * 3 + 16);
    // ③ 行囊：HUD 右上角（1:1）
    const hud = (ox, img, label) => { g.save(); g.beginPath(); g.rect(ox, 200, 200, 110); g.clip(); g.drawImage(shot, 1166, 120, 200, 110, ox, 200, 200, 110); g.drawImage(img, ox + 106 - 26, 200 + 50 - 26 + 8, 52, 52); g.restore(); g.fillStyle = '#ccc'; g.fillText(label, ox, 326); };
    hud(10, bun, '③ 行囊（原）'); hud(230, full, '③ 行囊（鼓起）');
    // 青玉 4 帧 2× 展示
    g.fillStyle = '#3a342c'; g.fillRect(10, 350, 4 * 128 + 10, 138); g.drawImage(jade, 0, 0, 256, 64, 15, 354, 512, 128); g.fillStyle = '#ccc'; g.fillText('④ gem_tok_small_jade 4 帧（64×64 ×2）', 10, 505);
    g.fillStyle = '#3a342c'; g.fillRect(10, 520, 4 * 128 + 10, 100); g.drawImage(tok, 0, 0, 384, 96, 15, 524, 512, 92); g.fillText('金令牌 4 帧（对照）', 540, 570); 
    return c.toDataURL('image/png');
  }, [rd(process.env.SHOT), rd('public/assets/coins/gem_tok_small_jade.png'), rd('public/assets/gems/gem_tok_large.png'), rd('public/assets/gems/gem_tok_small.png'), rd('public/assets/bag/bundle.webp'), rd('public/assets/coins/bundle_full.png')]);
  fs.writeFileSync('assets/review/coins/jade_preview.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
