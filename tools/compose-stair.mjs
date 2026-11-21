// 守城 v2 直梯（stair_down.png，130×200）合成（2026-11-21）：从内侧女墙缺口笔直往屏幕上方（城内）下去的石阶 + 两侧矮栏墙 + 顶端方柱 + 踏脚石板。
// 全部取自 walkway_a（石板踏面 / 女墙压顶石），不生成新图；踏面逐级压暗，级前沿亮边，级间阴影（俯视偏 3/4，越往上越是「往下走」）。
// 布局（图内像素）：左栏墙 x6..20、石阶 x20..110（90 宽）、右栏墙 x110..124；顶端踏脚石板 y6..22；8 级，每级 4 阴影 + 16 踏面，y22..182；底部 y182..200 是穿过女墙带的门槛石板；方柱 22×22 在栏墙北端。
// 用法：node tools/compose-stair.mjs     （输出 public/assets/siege-v2/defense-v2/stair_down.png + 1:1 预览 assets/review/defense-v2/art/stair_compare.png）
import { chromium } from 'playwright';
import fs from 'fs';
const D = 'public/assets/siege-v2/defense-v2/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([walk, hero, tro]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const wi = await load(walk), hi = await load(hero), ti = await load(tro);
    const W = 130, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
    const L = { rl: [6, 20], st: [20, 110], rr: [110, 124], landing: [6, 22], y0: 22, steps: 8, tread: 16, shadow: 4, thr: 182 };
    const dark = (x, y, w, h, a, col = '0,0,0') => { g.fillStyle = `rgba(${col},${a})`; g.fillRect(x, y, w, h); };
    g.fillStyle = '#3a342b'; g.fillRect(L.st[0], L.landing[0], 90, L.thr - L.landing[0]); // 石阶底色（级间阴影用实色，不留透明缝）
    // 踏脚石板（顶端）
    g.drawImage(wi, 100, 70, L.st[1] - L.st[0], L.landing[1] - L.landing[0] + 4, L.st[0], L.landing[0], L.st[1] - L.st[0], L.landing[1] - L.landing[0] + 4); dark(L.st[0], L.landing[0], 90, 20, .32);
    // 8 级：k=0 在最上（最暗），k=7 在最下（最亮）
    for (let k = 0; k < L.steps; k++) {
      const y = L.y0 + k * (L.shadow + L.tread), shade = .34 - .34 * (k / (L.steps - 1)) * .9;     // 压暗量：上 .34 → 下 .03
      g.fillStyle = '#2c2721'; g.fillRect(L.st[0], y, 90, L.shadow);                                                              // 级间阴影（前一级的落差）
      g.drawImage(wi, 40 + (k * 37) % 300, 60 + (k * 13) % 100, 90, L.tread, L.st[0], y + L.shadow, 90, L.tread); // 石板踏面（每级取 walkway 不同位置）
      dark(L.st[0], y + L.shadow, 90, L.tread, shade);
      g.fillStyle = 'rgba(255,240,205,.45)'; g.fillRect(L.st[0], y + L.shadow, 90, 2);               // 前沿亮边
    }
    // 门槛（穿过女墙带的一段）
    g.drawImage(wi, 200, 90, 90, H - L.thr, L.st[0], L.thr, 90, H - L.thr);
    // 石阶两侧栏墙脚的投影
    for (const [x0, w] of [[L.st[0], 6], [L.st[1] - 6, 6]]) { const gr = g.createLinearGradient(0, 0, 0, 1); void gr; dark(x0, L.y0, w, L.thr - L.y0, .22); }
    // 栏墙：把女墙带的压顶石（walkway 最上沿 0..20 行）转 90° 竖起来，宽 14
    const rail = (x0, x1) => { const w = x1 - x0, len = H - 8, t = document.createElement('canvas'); t.width = 160; t.height = 20; const tg = t.getContext('2d'); tg.imageSmoothingEnabled = false; tg.drawImage(wi, 160, 2, 160, 20, 0, 0, 160, 20);
      const rc = document.createElement('canvas'); rc.width = 20; rc.height = 160; const rg = rc.getContext('2d'); rg.translate(20, 0); rg.rotate(Math.PI / 2); rg.drawImage(t, 0, 0);
      g.drawImage(rc, 0, 0, 20, 160, x0, 8, w, len); dark(x0, 8, 2, len, .25); dark(x1 - 2, 8, 2, len, .45); };
    rail(...L.rl); rail(...L.rr);
    // 方柱（22×22，栏墙北端）：压顶石色块 + 一圈暗描边 + 正面
    const post = x => { g.fillStyle = '#b9ad98'; g.fillRect(x, 2, 22, 14); g.fillStyle = '#9b8f7b'; g.fillRect(x, 16, 22, 10); g.fillStyle = '#d8ccb4'; g.fillRect(x + 2, 4, 18, 3); g.strokeStyle = '#4a3f33'; g.lineWidth = 1; g.strokeRect(x + .5, 2.5, 21, 23); g.beginPath(); g.moveTo(x, 16.5); g.lineTo(x + 22, 16.5); g.stroke(); };
    post(2); post(106);
    // 栏墙南端立面（缺口两侧女墙接口处的一小块正面）
    for (const [x0, x1] of [L.rl, L.rr]) { g.fillStyle = '#8f846f'; g.fillRect(x0, H - 6, x1 - x0, 6); }
    // ---- 1:1 世界像素预览 ----
    const pw = 560, ph = 520, pv = document.createElement('canvas'); pv.width = pw; pv.height = ph; const pg = pv.getContext('2d'); pg.imageSmoothingEnabled = false; pg.fillStyle = '#8a6a3a'; pg.fillRect(0, 0, pw, ph);
    const TOP = 330; for (let x = 0; x < pw; x += 1024) pg.drawImage(wi, x, TOP);
    const sx = 215; pg.fillStyle = '#8a6a3a'; pg.fillRect(sx + 6, TOP, 118, 44); // 缺口：把女墙带在缺口处抹掉（代码里要让开）
    pg.drawImage(wi, 400, 90, 118, 44, sx + 6, TOP + 0, 118, 44);                  // 缺口里露出走道石板（女墙带厚度处的地面）
    const sy = TOP + 44 - H; pg.drawImage(c, sx, sy);
    const sprites = [[sx + 65, sy + 30], [sx + 65, sy + 105], [sx + 65, sy + 178]];
    for (const [fx, fy] of sprites) pg.drawImage(hi, 0, 0, 176, 176, fx - 40, fy - 74, 80, 80);
    pg.fillStyle = '#0ff'; pg.font = '12px sans-serif'; pg.fillText('梯顶', sx + 140, sy + 34); pg.fillText('梯腰', sx + 140, sy + 109); pg.fillText('梯底（缺口）', sx + 140, sy + 182);
    return { img: c.toDataURL('image/png'), prev: pv.toDataURL('image/png') };
  }, [rd(D + 'walkway_a.png'), rd('public/assets/processed-v2/zhaoyun_walk_sheet.png'), rd('public/assets/processed-v2/troops/halberdier_walk.png')]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  w(D + 'stair_down.png', r.img); w('assets/review/defense-v2/art/stair_compare.png', r.prev); console.log('ok');
} finally { await b.close(); }
