// 城墙端头合成（守城 v2，2026-11-21）：ChatGPT 出的「右端头」（已去绿并裁边的透明 PNG）→ 平台加深到与走道一致 → 缩放到与 wall_seg / gate_passable_v2 同比例 → 输出 wallend_right.png / wallend_left.png（水平镜像）+ 1:1 拼接预览。
// 做法同 compose-gate-v2：在平台上沿下方切开，插入 INSERT 行；左侧平台区整条换成 walkway_a 石板（按世界 1:1 尺寸缩放），右侧「向后收的侧面城垛墙」区用侧墙自己的一段竖向平铺延长。
// 用法：SRC=…/end_trim.png（宽 1000 的裁边图）node tools/compose-wallend.mjs     （可选 CUT=402 INSERT=319 SCALE=.4986 SIDEX=880 BACKTOP=280 MERLON=488 PAVE0=402）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/siege-v2/defense-v2/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const A = { cut: +(E.CUT ?? 402), insert: +(E.INSERT ?? 319), scale: +(E.SCALE ?? .4986), sidex: +(E.SIDEX ?? 880), backTop: +(E.BACKTOP ?? 280), merlon: +(E.MERLON ?? 488), bandA: +(E.BANDA ?? 440), bandB: +(E.BANDB ?? 560), filter: E.FILTER ?? 'saturate(.8) brightness(.99)' };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([src, walk, seg, hero, tro, A]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const si = await load(src), wi = await load(walk), sg = await load(seg), hi = await load(hero), ti = await load(tro), W = si.width, H = si.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H + A.insert; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(si, 0, 0, W, A.cut, 0, 0, W, A.cut); g.drawImage(si, 0, A.cut, W, H - A.cut, 0, A.cut + A.insert, W, H - A.cut);
    // 右侧侧面墙区：用侧墙一段 [bandA, bandB) 竖向循环铺满 [cut, cut+insert)
    { const bh = A.bandB - A.bandA; let y = A.cut; while (y < A.cut + A.insert) { const h = Math.min(bh, A.cut + A.insert - y); g.drawImage(si, A.sidex, A.bandA, W - A.sidex, h, A.sidex, y, W - A.sidex, h); y += bh; } }
    // 左侧平台：走道石板（按 (1/.75)/scale 倍缩放），覆盖 [cut, 前城垛顶)
    { const k = (1 / .75) / A.scale, PE = A.merlon + A.insert; g.imageSmoothingEnabled = false; g.drawImage(wi, 0, 44, Math.round(A.sidex / k), (PE - A.cut) / k, 0, A.cut, A.sidex, PE - A.cut); g.imageSmoothingEnabled = true; }
    const ow = Math.round(c.width * A.scale), oh = Math.round(c.height * A.scale), o = document.createElement('canvas'); o.width = ow; o.height = oh; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.filter = A.filter; og.drawImage(c, 0, 0, ow, oh); og.filter = 'none';
    const mir = cv => { const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height; const mg = m.getContext('2d'); mg.translate(cv.width, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); return m; };
    const key = { backTop: Math.round(A.backTop * A.scale), merlonTop: Math.round((A.merlon + A.insert) * A.scale), ground: oh - 6, platformX: [0, Math.round(A.sidex * A.scale)], towerBase: Math.round(395 * A.scale) };
    // 1:1 世界像素预览（gs = .75）：左边接一段 wall_seg + walkway，右边是端头，上面站赵云 + 2 戟兵
    const gs = .75, pw = 1500, ph = 900, pv = document.createElement('canvas'); pv.width = pw; pv.height = ph; const pg = pv.getContext('2d'); pg.imageSmoothingEnabled = false; pg.fillStyle = '#8a6a3a'; pg.fillRect(0, 0, pw, ph);
    const G = 800, CT = G - 270, Wl = CT + 50, TOP = Wl - 240; const ex = 760, ey = CT - key.merlonTop * gs;   // 端头图放置：外侧城垛顶落在 CT
    for (let x = 0; x < ex + 10; x += 1024) pg.drawImage(wi, x, TOP);
    pg.drawImage(sg, 0, 92, sg.width, sg.height - 92, ex - sg.width * gs + 40, CT, sg.width * gs, (sg.height - 92) * gs);
    pg.drawImage(o, ex, ey, ow * gs, oh * gs);
    const spr = [[-300, TOP + 150, hi], [150, TOP + 170, ti], [260, TOP + 120, ti]]; for (const [dx, fy, im] of spr) pg.drawImage(im, 0, 0, 176, 176, ex + dx - 48, fy - 90, 96, 96);
    pg.strokeStyle = '#0ff'; pg.setLineDash([8, 6]); for (const yy of [TOP, CT, G]) { pg.beginPath(); pg.moveTo(0, yy); pg.lineTo(pw, yy); pg.stroke(); }
    return { size: [ow, oh], key, right: o.toDataURL('image/png'), left: mir(o).toDataURL('image/png'), prev: pv.toDataURL('image/png') };
  }, [rd(E.SRC), rd(D + 'walkway_a.png'), rd('public/assets/siege-v2/luoyang/wall_seg.png'), rd('public/assets/processed-v2/zhaoyun_walk_sheet.png'), rd('public/assets/processed-v2/troops/halberdier_walk.png'), A]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  w(D + 'wallend_right.png', r.right); w(D + 'wallend_left.png', r.left); w(E.PREVIEW ?? 'assets/review/defense-v2/art/wallend_compare.png', r.prev);
  console.log(JSON.stringify({ size: r.size, key: r.key }));
} finally { await b.close(); }
