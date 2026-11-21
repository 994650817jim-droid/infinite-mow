// 守城 v2 城门楼 v2 合成（2026-11-21）：把 gate_passable.png 在 CUT 行切开，中间补 INSERT 行平台石板（用平台自己的一条石板带循环平移 + 交叉渐变，免重复感），
// 再整体按 SCALE 缩放，输出 gate_passable_v2.png；同时拼一张 1:1 世界像素的验收图（左右 wall_seg + walkway，中间门楼，再摆人物精灵站在平台上）。
// 用法：node tools/compose-gate-v2.mjs  （参数见下 env：CUT=312 INSERT=117 SCALE=.853 BAND=300:340 ACTORS=1）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/siege-v2/defense-v2/', CUT = +(E.CUT ?? 312), INSERT = +(E.INSERT ?? 128), SCALE = +(E.SCALE ?? .853), B0 = +(E.BAND0 ?? 316), B1 = +(E.BAND1 ?? 356);
const rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([gate, walk, seg, CUT, INSERT, SCALE, B0, B1, actors]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const gi = await load(gate), W = gi.width, H = gi.height;
    // ---- 合成（原图像素）----
    const c = document.createElement('canvas'); c.width = W; c.height = H + INSERT; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(gi, 0, 0, W, CUT, 0, 0, W, CUT);                       // 上半
    g.drawImage(gi, 0, CUT, W, H - CUT, 0, CUT + INSERT, W, H - CUT);  // 下半
    const bandH = B1 - B0; let y = CUT, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (y < CUT + INSERT) {
      const h = Math.min(bandH, CUT + INSERT - y), sh = Math.floor(rnd() * W);
      for (const dx of [0, -W]) g.drawImage(gi, 0, B0, W, h, sh + dx, y, W, h);   // 循环平移
      y += h;
    }
    // 各接缝处交叉渐变（把上下两边的 6 行各自混一点，免硬切）
    const blendSeam = (yy) => { const a = g.getImageData(0, yy - 3, W, 6), d = a.data; for (let k = 0; k < 3; k++) for (let x = 0; x < W; x++) { const i1 = ((2 - k) * W + x) * 4, i2 = ((3 + k) * W + x) * 4, t = (k + 1) / 8; for (let q = 0; q < 3; q++) { const u = d[i1 + q], v = d[i2 + q]; d[i1 + q] = u * (1 - t) + v * t; d[i2 + q] = v * (1 - t) + u * t; } } g.putImageData(a, 0, yy - 3); };
    for (let yy = CUT; yy < CUT + INSERT; yy += bandH) if (yy > 6) blendSeam(yy); blendSeam(CUT + INSERT);
    // 平台改用走道石板：把 [PS, 外侧城垛顶) 整条换成 walkway_a 的路面（缩放到和世界里的走道同尺寸），和两边走道连成一片；城垛缺口里透出的那一点原石板保留
    { const wal = await load(walk), k = (1 / .75) / SCALE, PS = 306, PE = 398 + INSERT, rowsNeeded = (PE - PS) / k;
      g.imageSmoothingEnabled = false; g.drawImage(wal, 0, 44, Math.round(W / k), rowsNeeded, 0, PS, W, PE - PS); g.imageSmoothingEnabled = true; }
    // ---- 缩放 ----
    const ow = Math.round(c.width * SCALE), oh = Math.round(c.height * SCALE), o = document.createElement('canvas'); o.width = ow; o.height = oh;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, ow, oh);
    // ---- 1:1 世界验收图：gs = .75（270 / 360），墙脚 G ----
    const wi = await load(walk), si = await load(seg), gs = .75, G = 1000, CT = G - 270, Wl = CT + 50, TOP = Wl - 240;
    const pw = 3200, ph = 1100, p = document.createElement('canvas'); p.width = pw; p.height = ph; const pg = p.getContext('2d'); pg.imageSmoothingEnabled = false;
    pg.fillStyle = '#7a5a32'; pg.fillRect(0, 0, pw, ph); pg.fillStyle = '#4a3a2a'; pg.fillRect(0, 0, pw, TOP - 40);
    for (let x = 0; x < pw; x += 1024) pg.drawImage(wi, x, TOP);                         // 走道（1:1 世界像素）
    const gx = pw / 2, gwWorld = ow * gs, segW = si.width * gs, segCrenel = 92 * gs;
    const drawSeg = x0 => pg.drawImage(si, 0, 92, si.width, si.height - 92, x0, CT, segW, (si.height - 92) * gs);   // 外立面从城垛顶往下（走道由 walkway 提供）
    for (let x = gx - gwWorld / 2 - segW + 40; x > -segW; x -= segW - 40) drawSeg(x);
    for (let x = gx + gwWorld / 2 - 40; x < pw; x += segW - 40) drawSeg(x);
    // 门楼：整图 gs 缩放；它的外侧城垛顶要落在 CT，所以 y0 = CT - (merlonTop * gs)
    const merlonTop = (398 + INSERT) * SCALE, y0 = CT - merlonTop * gs;
    pg.drawImage(o, gx - gwWorld / 2, y0, gwWorld, oh * gs);
    // 人物：用一个简易色块占位（主将 + 2 士兵），站在平台上，脚在 TOP+120 / +150（走道中部）
    if (actors) { const sp = await Promise.all([actors[0], actors[1], actors[1]].map(load)); const spec = [[-60, TOP + 150, 0], [40, TOP + 175, 1], [120, TOP + 140, 2]];
      for (const [dx, fy, k] of spec) { const sc = .55, cs = 176; pg.drawImage(sp[k], 0, 0, cs, cs, gx + dx - cs * sc / 2, fy - cs * sc * .92, cs * sc, cs * sc); } }
    pg.strokeStyle = '#00ffcc'; pg.setLineDash([8, 6]); for (const yy of [TOP, Wl - 50, G]) { pg.beginPath(); pg.moveTo(0, yy); pg.lineTo(pw, yy); pg.stroke(); }
    const crop = document.createElement('canvas'); crop.width = 2000; crop.height = 1100; crop.getContext('2d').drawImage(p, (pw - 2000) / 2, 0, 2000, 1100, 0, 0, 2000, 1100);
    return { size: [ow, oh], full: o.toDataURL('image/png'), cmp: crop.toDataURL('image/png'),
      key: { backCrenelTop: Math.round(218 * SCALE), baseBottom: Math.round(305 * SCALE), merlonTop: Math.round(merlonTop), ground: Math.round((820 + INSERT) * SCALE) } };
  }, [rd(D + 'originals/gate_passable_v1.png'), rd(D + 'walkway_a.png'), rd('public/assets/siege-v2/luoyang/wall_seg.png'), CUT, INSERT, SCALE, B0, B1, E.ACTORS === '0' ? null : [rd('public/assets/processed-v2/zhaoyun_walk_sheet.png'), rd('public/assets/processed-v2/troops/halberdier_walk.png')]]);
  fs.writeFileSync(D + 'gate_passable_v2.png', Buffer.from(r.full.split(',')[1], 'base64'));
  fs.writeFileSync(E.CMP ?? 'assets/review/defense-v2/art/gate_v2_compare.png', Buffer.from(r.cmp.split(',')[1], 'base64'));
  console.log(JSON.stringify({ size: r.size, key: r.key }));
} finally { await b.close(); }
