// 结局画卷（2026-11-21）：ChatGPT 生成的 1672×941 画（页面全屏后 1:1 分 4 块截图：A 0,0 / B 104,0 / C 0,214 / D 104,214，各 1568×727）→ 拼回 → 缩放到 1920×1080 → webp。
// 同时合成 960×540 逻辑画面叠示意文字的预览（文字区 = 下方三分之一）。输出 public/assets/ending/ending_unify.webp、ending_three.webp；预览 assets/review/ending/*_mock.png。
// 用法：node tools/make-ending-art.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/ending/', R = O + 'originals/raw/', rd = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
fs.mkdirSync('assets/review/ending', { recursive: true });
const JOBS = { pavilion: { t: '', h: '', b: '' }, unify: { t: '结局 · 天下一统', h: '四海归一', b: '五丈原一战，魏军溃退，汉室光复。关中、中原尽入版图，天下终归一统。' }, three: { t: '结局 · 三分天下', h: '据有一方', b: '五丈原一战，司马懿退守关中。然而我军占城有限，诸强割据，天下终成鼎足之势。' } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  for (const [k, j] of Object.entries(JOBS)) {
    const r = await p.evaluate(async ([tiles, j]) => {
      const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; }), T = await Promise.all(tiles.map(load));
      const st = document.createElement('canvas'); st.width = 1672; st.height = 941; const sg = st.getContext('2d'); const put = (im, ox, oy, x0, y0, x1, y1) => { sg.save(); sg.beginPath(); sg.rect(x0, y0, x1 - x0, y1 - y0); sg.clip(); sg.drawImage(im, ox, oy); sg.restore(); };
      put(T[0], 0, 0, 0, 0, 836, 470); put(T[1], 104, 0, 836, 0, 1672, 470); put(T[2], 0, 214, 0, 470, 836, 941); put(T[3], 104, 214, 836, 470, 1672, 941);
      const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(st, 0, 0, 1920, 1080);
      // 预览：960×540 逻辑画面（输出 2×），下三分之一叠示意文字（文字区 y 360..540 逻辑像素）
      const m = document.createElement('canvas'); m.width = 1920; m.height = 1080; const mg = m.getContext('2d'); mg.drawImage(c, 0, 0);
      if (!j.h) { const rx = 242, ry = 224; mg.fillStyle = '#2b1d12'; mg.font = 'bold 34px serif'; mg.textAlign = 'left'; const names = ['黄巾之乱','虎牢关','官渡','赤壁','汉中','五丈原']; names.forEach((n, i) => { const x = rx + 40 + (i % 3) * 470, y = ry + 90 + Math.floor(i / 3) * 190; mg.fillText('第' + (i + 1) + '章  ' + n, x, y); mg.fillStyle = 'rgba(160,30,20,.85)'; mg.fillRect(x + 300, y - 40, 56, 56); mg.fillStyle = '#2b1d12'; }); mg.strokeStyle = 'rgba(0,255,255,.8)'; mg.lineWidth = 2; mg.setLineDash([10, 8]); mg.strokeRect(rx, ry, 1440, 502); return { webp: c.toDataURL('image/webp', .93), mock: m.toDataURL('image/png') }; }
      mg.textAlign = 'center'; mg.shadowColor = 'rgba(0,0,0,.8)'; mg.shadowBlur = 8; mg.fillStyle = '#e7d6a8'; mg.font = '28px serif'; mg.fillText(j.t, 960, 760); mg.fillStyle = '#f6e3b0'; mg.font = 'bold 76px serif'; mg.fillText(j.h, 960, 850); mg.fillStyle = '#d9c9a0'; mg.font = '32px serif'; mg.fillText(j.b.slice(0, 22), 960, 925); mg.fillText(j.b.slice(22), 960, 970);
      mg.strokeStyle = 'rgba(0,255,255,.7)'; mg.lineWidth = 2; mg.setLineDash([10, 8]); mg.strokeRect(0, 720, 1920, 360);
      return { webp: c.toDataURL('image/webp', .93), mock: m.toDataURL('image/png') };
    }, [['A_0_0', 'B_104_0', 'C_0_214', 'D_104_214'].map(t => rd(R + `ending_${k}_gpt_1_tile${t}.jpg`)), j]);
    fs.writeFileSync(O + `ending_${k}.webp`, Buffer.from(r.webp.split(',')[1], 'base64')); fs.writeFileSync(`assets/review/ending/ending_${k}_mock.png`, Buffer.from(r.mock.split(',')[1], 'base64'));
  }
  console.log('ok');
} finally { await b.close(); }
