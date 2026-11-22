// 郝昭预览（2026-11-21）：① 整表 1/2 缩放；② 在实机截图 w3-gate.jpg 上按显示尺寸摆：郝昭行走（下 / 左 / 右 / 上 各 1 帧）+ 攻击 4 帧（朝下），旁边放刘度（旧借图）同尺寸对比（显示缩放假定 0.5：figure 216 → 约 108px，约为主将的 1.6 倍；实际缩放以 ArtStyle 为准）。→ assets/review/bosses/haozhao_preview.png
import { chromium } from 'playwright';
import fs from 'fs';
const rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
fs.mkdirSync('assets/review/bosses', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (S) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; }); const [hz, ld, shot] = await Promise.all(S.map(load));
    const c = document.createElement('canvas'); c.width = 1400; c.height = 640; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#26211c'; g.fillRect(0, 0, 1400, 640);
    g.drawImage(hz, 0, 0, 1152, 2304, 10, 10, 288, 576); // 整表 1/4
    const sc = .5, cell = 288 * sc; g.imageSmoothingEnabled = true;
    // 实机地面背景块
    g.drawImage(shot, 400, 560, 900, 120, 320, 10, 900, 120);
    const bg = (x, y, w, h) => { g.drawImage(shot, 500, 400, w, h, x, y, w, h); };
    const frame = (img, col, row, x, y) => g.drawImage(img, col * 288, row * 288, 288, 288, x, y, cell, cell);
    const rowsY = 150; bg(320, rowsY, 1050, 160);
    // 行走：下 / 左 / 右 / 上
    [0, 1, 2, 3].forEach((r, i) => frame(hz, 1, r, 330 + i * 140, rowsY + 10));
    // 攻击朝下 4 帧
    [0, 1, 2, 3].forEach((f, i) => frame(hz, f, 4, 330 + 600 + i * 110 - 0, rowsY + 10));
    // 攻击朝左 / 右 满弓
    g.fillStyle = '#ccc'; g.font = '13px sans-serif'; g.fillText('行走 下 / 左 / 右 / 上（各第 2 帧）', 330, rowsY + 175); g.fillText('攻击（朝下）4 帧：抽箭 / 满弓 / 撒放 / 收弓', 930, rowsY + 175);
    // 攻击左 / 右 4 帧
    bg(320, 360, 1050, 160); [0, 1, 2, 3].forEach((f, i) => frame(hz, f, 5, 330 + i * 110, 370)); [0, 1, 2, 3].forEach((f, i) => frame(hz, f, 6, 330 + 500 + i * 110, 370)); g.fillStyle = '#ccc'; g.fillText('攻击朝左 4 帧 / 朝右 4 帧（镜像）', 330, 535);
    // 对比：刘度（旧借图）同尺寸 下行走 + 攻击
    g.fillStyle = '#ccc'; g.fillText('对照：刘度（旧借图）', 330, 560); [0, 1, 2].forEach((i) => g.drawImage(ld, i * 288, 0, 288, 288, 330 + i * 150, 560 - 0, cell * .6, cell * .6));
    return c.toDataURL('image/png');
  }, [rd('public/assets/bosses-v2/beifa_haozhao.png'), rd('public/assets/bosses-v2/jingnan_liudu.png'), rd(process.env.SHOT)]);
  fs.writeFileSync('assets/review/bosses/haozhao_preview.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
