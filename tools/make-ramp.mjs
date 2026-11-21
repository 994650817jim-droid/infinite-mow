// 马道（守城 v2 登城坡道）处理（2026-11-21）：ChatGPT 绿底原图 → 去绿 → 裁边缩放到宽 W → 调色（贴近 wall_seg 的暖灰）→ 输出
//   ramp_left.png（底层，整张）、ramp_left_front.png（上层：画面最下沿那条内侧女墙带，带缺口，画在人物前面）、ramp_right.png / ramp_right_front.png（水平镜像）；
//   并出 1:1 世界像素拼接预览（走道 + wall_seg + 马道 + 主将站在坡道上）。
// 用法：SRC=…/ramp_left_gpt_2.png node tools/make-ramp.mjs     （可选 W=420 BANDH=18 SAT=.82）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/siege-v2/defense-v2/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([src, walk, seg, hero, W, BANDH, SAT, GAPW]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const si = await load(src), wi = await load(walk), sg = await load(seg), hi = await load(hero);
    const H = Math.round(si.height * W / si.width), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.filter = `saturate(${SAT}) brightness(1.02)`; g.drawImage(si, 0, 0, W, H);
    const front = document.createElement('canvas'); front.width = W; front.height = H; front.getContext('2d').drawImage(c, 0, H - BANDH, W, BANDH, 0, H - BANDH, W, BANDH);
    const mirror = cv => { const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height; const mg = m.getContext('2d'); mg.translate(cv.width, 0); mg.scale(-1, 1); mg.drawImage(cv, 0, 0); return m; };
    // 找缺口（带上透明列）：最下一行里连续透明列
    const d = g.getImageData(0, H - 8, W, 1).data; let g0 = -1, g1 = -1, run = 0, best = 0; for (let x = 0; x <= W; x++) { if (x < W && d[x * 4 + 3] < 40) run++; else { if (run > best) { best = run; g1 = x - 1; g0 = x - run; } run = 0; } }
    // 把缺口加宽到 GAPW（用户要约 90 宽，原图缺口只有 52）：在栏墙带行里把缺口两侧各清掉一些列（底层和上层同步）
    if (GAPW > g1 - g0 + 1) { const cx = (g0 + g1) / 2, a = Math.round(cx - GAPW / 2), bb = Math.round(cx + GAPW / 2); for (const cv of [c, front]) cv.getContext('2d').clearRect(a, H - BANDH - 1, bb - a, BANDH + 1); g0 = a; g1 = bb; }
    // 拼接预览：1:1 世界像素。走道 y=TOP；坡道底沿对齐 走道上沿 + BANDH。
    const pw = 1400, ph = 640, pv = document.createElement('canvas'); pv.width = pw; pv.height = ph; const pg = pv.getContext('2d'); pg.imageSmoothingEnabled = false; pg.fillStyle = '#8a6a3a'; pg.fillRect(0, 0, pw, ph);
    const TOP = 330; for (let x = 0; x < pw; x += 1024) pg.drawImage(wi, x, TOP);
    const gs = .75; const drawSeg = x0 => pg.drawImage(sg, 0, 92, sg.width, sg.height - 92, x0, TOP + 190, sg.width * gs, (sg.height - 92) * gs); drawSeg(-300); drawSeg(-300 + sg.width * gs - 40);
    const ox = 640, oy = TOP + BANDH - H; pg.drawImage(c, ox, oy); // 底层
    // 缺口处让走道路面露出：缺口在 ramp 的 g0..g1，下方就是走道石板（已画）
    const fx = ox + (g0 + g1) / 2 - 20, fy = oy + H - BANDH - 40; pg.drawImage(hi, 0, 0, 176, 176, fx - 48, fy - 80, 96, 96);
    pg.drawImage(front, ox, oy); // 上层（栏墙带）盖在人物前面
    return { size: [W, H], gap: [g0, g1], base: c.toDataURL('image/png'), front: front.toDataURL('image/png'), baseR: mirror(c).toDataURL('image/png'), frontR: mirror(front).toDataURL('image/png'), prev: pv.toDataURL('image/png') };
  }, [rd(E.SRC), rd(D + 'walkway_a.png'), rd('public/assets/siege-v2/luoyang/wall_seg.png'), rd('public/assets/processed-v2/zhaoyun_walk_sheet.png'), +(E.W ?? 420), +(E.BANDH ?? 18), +(E.SAT ?? .82), +(E.GAPW ?? 88)]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  w(D + 'ramp_left.png', r.base); w(D + 'ramp_left_front.png', r.front); w(D + 'ramp_right.png', r.baseR); w(D + 'ramp_right_front.png', r.frontR);
  w(E.PREVIEW ?? 'assets/review/defense-v2/art/ramp_compare.png', r.prev); console.log(JSON.stringify({ size: r.size, gapCols: r.gap }));
} finally { await b.close(); }
