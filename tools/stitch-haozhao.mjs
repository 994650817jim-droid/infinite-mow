// 郝昭帧表拼接（2026-11-21）：Gemini 生成的 1024×1024 洋红底（页面全屏 1:1 上 / 下两块截图，各 1568×727）拼回 → 行走 4 行 + 攻击 4 行 → 1024×2048 洋红底原图（供 prepare-artv2.mjs 使用）。
// 输出 public/assets/bosses-v2/originals/haozhao_4x8_src.png。用法：node tools/stitch-haozhao.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const R = 'public/assets/bosses-v2/originals/', rd = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const u = await p.evaluate(async (S) => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [wt, wb, at, ab] = await Promise.all(S.map(load)), c = document.createElement('canvas'); c.width = 1024; c.height = 2048; const g = c.getContext('2d'); g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 1024, 2048);
    const sheet = (t, bt, y0) => { g.save(); g.beginPath(); g.rect(0, y0, 1024, 1024); g.clip(); g.drawImage(t, 0, y0, 1024, 512, 0, 0, 0, 0); g.restore(); };
    const put = (t, bt, y0) => { const s = document.createElement('canvas'); s.width = 1024; s.height = 1024; const sg = s.getContext('2d'); sg.drawImage(t, 0, 0, 1024, 512, 0, 0, 1024, 512); sg.drawImage(bt, 0, 215, 1024, 512, 0, 512, 1024, 512); g.drawImage(s, 0, y0); };
    put(wt, wb, 0); put(at, ab, 1024); return c.toDataURL('image/png');
  }, [rd(R + 'raw/haozhao_walk_gemini_1_tileTop_0_0.jpg'), rd(R + 'raw/haozhao_walk_gemini_1_tileBottom_0_297.jpg'), rd(R + 'raw/haozhao_attack_gemini_1_tileTop_0_0.jpg'), rd(R + 'raw/haozhao_attack_gemini_1_tileBottom_0_297.jpg')]);
  fs.writeFileSync(R + 'haozhao_4x8_src.png', Buffer.from(u.split(',')[1], 'base64')); console.log('ok');
} finally { await b.close(); }
