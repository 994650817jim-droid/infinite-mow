// 入口玉璧中心放区字（2026-11-21）：把 力 / 敏 / 智 / 统 的毛笔字烘进 nodes/<region>/gate_<state>.png 的深色凹槽里（点亮 100% / 可点 72% / 未到 42% 不透明），neutral 套不放字。
// 纯净版先备份为 gate_plain_<state>.png（只在不存在时备份，所以可重复运行）。凹槽半径取 sockets.json。
import { chromium } from 'playwright';
import fs from 'fs';
const N = 'public/assets/star-map/nodes/', G = 'public/assets/star-map/glyphs/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const sock = JSON.parse(fs.readFileSync(N + 'sockets.json', 'utf8')).gate, REG = { strength: 'strength', agility: 'agility', intellect: 'intellect', command: 'command' }, ST = { off: .42, ready: .72, on: 1 };
const files = {}; for (const r of Object.keys(REG)) { files['g_' + r] = rd(G + `glyph_${r}.png`); for (const s of Object.keys(ST)) { const plain = N + `${r}/gate_plain_${s}.png`, cur = N + `${r}/gate_${s}.png`; if (!fs.existsSync(plain)) fs.copyFileSync(cur, plain); files[`${r}_${s}`] = rd(plain); } }
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const out = await p.evaluate(async ([files, sock, ST]) => {
    const L = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; }), res = {};
    for (const r of ['strength', 'agility', 'intellect', 'command']) { const gl = await L(files['g_' + r]); for (const [s, a] of Object.entries(ST)) { const base = await L(files[`${r}_${s}`]), c = document.createElement('canvas'); c.width = base.width; c.height = base.height; const g = c.getContext('2d'); g.drawImage(base, 0, 0); const sz = sock.socketRadius * 2 * .8; g.globalAlpha = a; g.drawImage(gl, c.width / 2 - sz / 2, c.height / 2 - sz / 2, sz, sz); res[`${r}/gate_${s}.png`] = c.toDataURL('image/png'); } }
    return res;
  }, [files, sock, ST]);
  for (const [f, u] of Object.entries(out)) fs.writeFileSync(N + f, Buffer.from(u.split(',')[1], 'base64')); console.log('baked', Object.keys(out).length);
} finally { await b.close(); }
