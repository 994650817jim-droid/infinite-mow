// 星图节点底座切图（2026-11-21）：ChatGPT 绿底 3 列(暗/可点/已点亮) × 4 行(入口/小星/要星/主星) 的已去绿透明 PNG → 12 张底座 PNG，
// 每行三态用同一缩放和同一中心（取「暗」态主体包围盒），保证切态时不跳位。输出 2× 显示尺寸（1× 显示直径：入口 44 / 小星 20 / 要星 36 / 主星 56）。
// 文件名 node_<gate|small|notable|keystone>_<off|ready|on>.png；染色测试表 node_tint_test.png（程序按区染色：朱红 / 青绿 / 紫 / 金，用 CSS hue-rotate + saturate）。
// 用法：SRC=public/assets/star-map/originals/bases_keyed.png node tools/cut-star-bases.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const SRC = process.env.SRC, OUT = 'public/assets/star-map/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const ROWS = [['gate', 88], ['small', 40], ['notable', 72], ['keystone', 112]], CY = [215, 515, 820, 1195], HALF = [160, 100, 165, 170], CX = [197, 545, 886], STATES = ['off', 'ready', 'on'];
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([src, ROWS, STATES, CY, HALF, CX]) => {
    const im = new Image(); im.src = src; await im.decode(); const out = {}, info = {};
    for (let ri = 0; ri < 4; ri++) {
      const [kind, D] = ROWS[ri], C = Math.round(D * 1.5 / 2) * 2;
      const cw = HALF[ri] * 2, ch = cw; const cell = (ci) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, CX[ci] - HALF[ri], CY[ri] - HALF[ri], cw, ch, 0, 0, cw, ch); return { c, g }; };
      const d0 = cell(0).g.getImageData(0, 0, cw, ch).data; let x0 = cw, x1 = 0, y0 = ch, y1 = 0; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d0[(y * cw + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = D / Math.max(bw, bh), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; info[kind] = { D, canvas: C, srcBox: [bw, bh] };
      for (let ci = 0; ci < 3; ci++) { const o = document.createElement('canvas'); o.width = C; o.height = C; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(cell(ci).c, 0, 0, cw, ch, C / 2 - cx * s, C / 2 - cy * s, cw * s, ch * s); out[`node_${kind}_${STATES[ci]}.png`] = o.toDataURL('image/png'); }
    }
    // 染色测试：每种底座的「已点亮」态 + 「可点」态，在 4 个区颜色下（朱红 / 青绿 / 紫 / 金）
    const hues = [['朱红', 'hue-rotate(-34deg) saturate(1.5)'], ['青绿', 'hue-rotate(118deg) saturate(1.3)'], ['紫', 'hue-rotate(222deg) saturate(1.3)'], ['金', 'none']];
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const tc = document.createElement('canvas'); tc.width = 4 * 190 + 90; tc.height = 4 * 190 + 40; const tg = tc.getContext('2d'); tg.fillStyle = '#17120e'; tg.fillRect(0, 0, tc.width, tc.height); tg.fillStyle = '#ccc'; tg.font = '14px sans-serif';
    for (let hi = 0; hi < 4; hi++) { tg.fillText(hues[hi][0], 90 + hi * 190 + 70, 22); }
    for (let ri = 0; ri < 4; ri++) for (let hi = 0; hi < 4; hi++) for (const [si, st] of [[0, 'on'], [1, 'ready']]) { const im2 = await load(out[`node_${ROWS[ri][0]}_${st}.png`]); tg.filter = hues[hi][1]; tg.drawImage(im2, 90 + hi * 190 + si * 90, 30 + ri * 190 + 20, im2.width * 1, im2.height * 1); tg.filter = 'none'; }
    for (let ri = 0; ri < 4; ri++) tg.fillText(ROWS[ri][0], 6, 30 + ri * 190 + 100);
    return { out, info, tint: tc.toDataURL('image/png') };
  }, [rd(SRC), ROWS, STATES, CY, HALF, CX]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); for (const [f, u] of Object.entries(r.out)) w(OUT + f, u); w(OUT + 'originals/node_tint_test.png', r.tint); console.log(JSON.stringify(r.info));
} finally { await b.close(); }
