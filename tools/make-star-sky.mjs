// 星空底图（星图 · 2026-11-21）：ChatGPT 生成的「星点场」（1672×941，黑底）+「星宿连线图」（1536×1024，黑底）→ 亮度转 alpha（古金 / 银白色，透明底）
// → 按区域加权（文字栏 / 节点密集区压淡，四周空处保留）→ 叠到现有 bg_starmap.png 上，输出 bg_starmap_stars.webp（1920×1080，不覆盖 bg_starmap.webp）。
// 原图是在页面全屏显示后 1:1 分块截图拼的：星点场 4 块（A 0,0 / B 104,0 / C 0,214 / D 104,214，各 1568×727），星宿图 2 块（上 0,0 / 下 0,297）。
// 用法：node tools/make-star-sky.mjs   （可选 STAR_G=.6 CON_G=.5 调整整体强度）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/star-map/', R = D + 'originals/raw/', rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([bgU, tiles, cons, G]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const bg = await load(bgU), T = await Promise.all(tiles.map(load)), C = await Promise.all(cons.map(load));
    const toAlpha = (cv, floor, peak) => { const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height), a = d.data; for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); const al = Math.max(0, Math.min(1, (m - floor) / (peak - floor))); if (m > 0) { a[i] = Math.min(255, a[i] * 255 / m); a[i + 1] = Math.min(255, a[i + 1] * 255 / m); a[i + 2] = Math.min(255, a[i + 2] * 255 / m); } a[i + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0); return cv; };
    // 星点场 1672×941：四块拼（A 左上 / B 右上 / C 左下 / D 右下）
    const sf = document.createElement('canvas'); sf.width = 1672; sf.height = 941; const sg = sf.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, 1672, 941);
    const put = (im, ox, oy, x0, y0, x1, y1) => { sg.save(); sg.beginPath(); sg.rect(x0, y0, x1 - x0, y1 - y0); sg.clip(); sg.drawImage(im, -ox, -oy); sg.restore(); };
    put(T[0], 0, 0, 0, 0, 836, 470); put(T[1], 104, 0, 836, 0, 1672, 470); put(T[2], 0, 214, 0, 470, 836, 941); put(T[3], 104, 214, 836, 470, 1672, 941);
    const field = document.createElement('canvas'); field.width = 1920; field.height = 1080; const fg = field.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(sf, 0, 0, 1920, 1080); toAlpha(field, 12, 110);
    // 星宿图 1536×1024：上下两块
    const cs = document.createElement('canvas'); cs.width = 1536; cs.height = 1024; const cg = cs.getContext('2d'); cg.fillStyle = '#000'; cg.fillRect(0, 0, 1536, 1024); cg.drawImage(C[0], 0, 0, 1536, 512, 0, 0, 1536, 512); cg.drawImage(C[1], 0, 215, 1536, 512, 0, 512, 1536, 512);
    toAlpha(cs, 14, 200);
    // 区域权重（1920×1080）：文字栏 / 节点密集区压淡；四周空处保留。先画成小图再放大（天然平滑）
    const wc = document.createElement('canvas'); wc.width = 192; wc.height = 108; const wg = wc.getContext('2d'); const S = 0.1;
    const rect = (x0, y0, x1, y1, w) => { wg.fillStyle = `rgb(${Math.round(w * 255)},${Math.round(w * 255)},${Math.round(w * 255)})`; wg.fillRect(x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S); };
    rect(0, 0, 1920, 1080, .95);                                // 默认（上 / 下边条）
    rect(420, 56, 1460, 1024, .5);                            // 节点密集区：更稀更淡
    rect(0, 0, 420, 1080, .8); rect(1460, 0, 1920, 1080, .8);  // 文字栏范围：只留淡小星
    rect(0, 0, 330, 700, .3); rect(1470, 0, 1920, 340, .3); rect(1470, 860, 1920, 1080, .3); // 有字的位置：最淡
    const wm = document.createElement('canvas'); wm.width = 1920; wm.height = 1080; const wmg = wm.getContext('2d'); wmg.imageSmoothingQuality = 'high'; wmg.filter = 'blur(10px)'; wmg.drawImage(wc, 0, 0, 1920, 1080);
    const wd = wmg.getImageData(0, 0, 1920, 1080).data;
    const fd = fg.getImageData(0, 0, 1920, 1080), f = fd.data; for (let i = 0; i < f.length; i += 4) f[i + 3] = Math.round(f[i + 3] * (wd[i] / 255) * G.star); fg.putImageData(fd, 0, 0);
    // 星宿：四组（青龙 / 白虎 / 玄武 / 朱雀）切出来，缩放摆在文字栏里空着的位置（1920 坐标，中心）；不进文字位置
    const groups = [['青龙', [100, 175, 610, 170], 300, 770], ['玄武', [210, 620, 370, 220], 190, 940], ['白虎', [870, 145, 560, 240], 1700, 430], ['朱雀', [860, 625, 580, 220], 1700, 700]];
    const lay = document.createElement('canvas'); lay.width = 1920; lay.height = 1080; const lg = lay.getContext('2d'); lg.imageSmoothingQuality = 'high'; const placed = [];
    for (const [nm, [x, y, w, h], cx, cy] of groups) { const k = 0.52; lg.save(); lg.globalAlpha = G.con; lg.drawImage(cs, x, y, w, h, cx - w * k / 2, cy - h * k / 2, w * k, h * k); lg.restore(); placed.push([nm, cx - w * k / 2, cy - h * k / 2, w * k, h * k]); }
    const layer = document.createElement('canvas'); layer.width = 1920; layer.height = 1080; const yg = layer.getContext('2d'); yg.drawImage(field, 0, 0); yg.drawImage(lay, 0, 0);
    const out = document.createElement('canvas'); out.width = 1920; out.height = 1080; const og = out.getContext('2d'); og.drawImage(bg, 0, 0, 1920, 1080); og.drawImage(layer, 0, 0);
    return { bg: out.toDataURL('image/webp', .92), png: out.toDataURL('image/png'), layer: layer.toDataURL('image/png'), placed };
  }, [rd(D + 'originals/bg_starmap.png'), ['A_0_0', 'B_104_0', 'C_0_214', 'D_104_214'].map(t => rd(R + `stars_field_gpt_1_tile${t}.jpg`)), [rd(R + 'stars_constellations_gpt_1_tileTop_0_0.jpg'), rd(R + 'stars_constellations_gpt_1_tileBottom_0_297.jpg')], { star: +(E.STAR_G ?? 1), con: +(E.CON_G ?? .9) }]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  w(D + 'bg_starmap_stars.webp', r.bg); w(D + 'originals/bg_starmap_stars.png', r.png); w(D + 'originals/stars_layer_transparent.png', r.layer); console.log(JSON.stringify(r.placed.map(a => a.map(v => typeof v === 'number' ? Math.round(v) : v))));
} finally { await b.close(); }
