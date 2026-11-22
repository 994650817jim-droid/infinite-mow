// 钱币 / 钱袋预览（2026-11-21）：① 实机战斗截图 w3-gate.jpg 左上 HUD 区 1:1（不放大）：钱袋 40px（平常 + 鼓起）、资源行「钱币 N」前 20px 图标、飞行铜钱 6 帧（20px）沿弧线飞向钱袋；② 2× 原图与帧条。→ assets/review/coins/coins_preview.png
// 用法：SHOT=…/docs/defense-walk/w3-gate.jpg node tools/compose-coin-preview.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const D = 'public/assets/coins/', rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
fs.mkdirSync('assets/review/coins', { recursive: true });
const names = ['pouch_normal', 'pouch_full', 'coin_string', 'coin_pile', 'coin_flip'];
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async ([imgs, shotU]) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const IM = {}; for (const [k, s] of Object.entries(imgs)) IM[k] = await load(s); const shot = await load(shotU);
    const c = document.createElement('canvas'); c.width = 1100; c.height = 620; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#222'; g.fillRect(0, 0, 1100, 620);
    // ① 1:1 HUD 区（截图 0..520 × 100..260）；下面拼 3 张：平常 / 收到钱币鼓起 / 飞行中
    const frames = [[0, 'pouch_normal', null], [1, 'pouch_full', null], [2, 'pouch_normal', 1]];
    frames.forEach(([i, pk, fly]) => { const ox = i * 340; g.save(); g.beginPath(); g.rect(ox, 0, 330, 160); g.clip(); g.drawImage(shot, 0, 100, 330, 160, ox, 0, 330, 160);
      g.fillStyle = 'rgba(10,8,6,.85)'; g.fillRect(ox + 8, 118 - 100 + 100 - 100 + 0, 0, 0); // 占位，不改动
      // 钱袋放在 HUD 资源行右侧（x≈250,y≈62），40×40；资源行「钱币」前 20px 图标（原「随军粮」图标位置约 x 38,y 62）
      g.drawImage(IM[pk], ox + 255, 40, 40, 40); g.drawImage(IM.coin_pile, ox + 14, 52, 20, 20);
      if (fly) { const t = [0, .2, .4, .6, .8, 1]; for (let k = 0; k < 3; k++) { const f = Math.floor((k * 2 + 1) % 6), tt = .25 + k * .3, x = 40 + (255 + 20 - 40) * tt, y = 95 - 35 * tt - 28 * Math.sin(tt * Math.PI); g.drawImage(IM.coin_flip, f * 48, 0, 48, 48, ox + x - 10, y - 10, 20, 20); } }
      g.restore(); });
    g.fillStyle = '#ccc'; g.font = '13px sans-serif'; g.fillText('① 1:1 实机 HUD 区：左 平常 / 中 鼓起（刚收到钱币）/ 右 铜钱飞向钱袋（钱袋 40px，钱币图标 20px，飞行铜钱 20px）', 10, 180);
    // ② 2× 原图
    let x = 10; for (const k of ['pouch_normal', 'pouch_full', 'coin_string', 'coin_pile']) { const im = IM[k]; g.fillStyle = '#3a342c'; g.fillRect(x, 200, im.width * 2 + 10, im.height * 2 + 10); g.drawImage(im, x + 5, 205, im.width * 2, im.height * 2); x += im.width * 2 + 24; }
    g.fillStyle = '#ccc'; g.fillText('② 2× 放大看细节（96² 钱袋 ×2 / 64² 资源图标 ×2）', 10, 420);
    g.fillStyle = '#3a342c'; g.fillRect(10, 436, 6 * 48 * 2 + 12, 108); g.drawImage(IM.coin_flip, 0, 0, 288, 48, 16, 442, 576, 96);
    g.fillStyle = '#ccc'; g.fillText('③ 铜钱翻转 6 帧（48×48 ×2）', 10, 560);
    // 同尺寸小图对比
    let y = 575; [28, 36, 48].forEach((s, i) => g.drawImage(IM.pouch_full, 640 + i * 70, 440, s, s)); [16, 24].forEach((s, i) => g.drawImage(IM.coin_pile, 860 + i * 40, 450, s, s)); g.fillText('钱袋 28 / 36 / 48 · 钱币 16 / 24', 640, 520);
    return c.toDataURL('image/png');
  }, [Object.fromEntries(names.map(k => [k, rd(D + k + '.png')])), rd(process.env.SHOT)]);
  fs.writeFileSync('assets/review/coins/coins_preview.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
