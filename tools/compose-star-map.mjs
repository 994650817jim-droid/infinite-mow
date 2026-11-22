// 星图效果图合成 v3（第二步，2026-11-21）：底图 + 预染色节点底座（含入口区字）+ 28 个图标 + 手绘连线贴图（淡墨 / 流金）按 star-map-nodes.json 坐标拼图；
// 输出（assets/review/star-map/）：star_map_mock_1600x900.png（演示状态）、star_map_mock_alloff.png（一颗星都没点：看走向）、star_map_actual_size_crop.png（900×700 不放大）、
// star_map_icon_table.png（28 图标按实际大小摆在点亮底座上 + 同图 2×）、star_map_fx_strip.png（点亮特效 12 帧逐帧条 + 套在要星 / 主星上的样子）。
// 显示尺寸（1×）：入口 44 / 小星 20 / 要星 44 / 主星 64；图标：要星 28 / 主星 40。
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/star-map/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const nodes = JSON.parse(fs.readFileSync(E.NODES, 'utf8')), files = {};
for (const s of ['neutral', 'strength', 'agility', 'intellect', 'command']) for (const k of ['gate', 'small', 'notable', 'keystone']) for (const t of ['off', 'ready', 'on']) files[`${s}/${k}_${t}`] = rd(D + `nodes/${s}/${k}_${t}.png`);
const ICONS = { '千钧': 'qianjun', '破阵': 'pozhen', '斩将': 'zhanjiang', '铁骨': 'tiegu', '背水': 'beishui', '万人敌': 'wanrendi', '轻骑': 'qingqi', '游刃': 'youren', '疾影': 'jiying', '连击': 'lianji', '追风': 'zhuifeng', '一骑当千': 'yiqi', '凝神': 'ningshen', '连珠': 'lianzhu', '广域': 'guangyu', '余烬': 'yujin', '妙算': 'miaosuan', '火烧连营': 'huoshao', '励军': 'lijun', '募众': 'muzhong', '同袍': 'tongpao', '严阵': 'yanzhen', '号令': 'haoling', '三军统帅': 'sanjun', '骁锐': 'xiaorui', '奇谋': 'qimou', '帷幄': 'weiwo', '身先士卒': 'shenxian' };
for (const id of Object.values(ICONS)) files['icon_' + id] = rd(D + `icon_${id}.png`);
files.bg = rd(E.BG || (D + 'originals/bg_starmap.png')); files.lineInk = rd(D + 'line_ink.png'); files.lineGold = rd(D + 'line_gold.png'); files.fx = rd(D + 'fx_light_strip.png');
const LAY = E.DECOR ? JSON.parse(fs.readFileSync(E.DECOR + 'layout.json', 'utf8')) : null; if (LAY) { files['d_plate'] = rd(E.DECOR + 'taiji_plate.png'); for (const t of LAY.trigrams) files['d_' + t.id] = rd(E.DECOR + 'trigram_' + t.id + '.png'); }
if (E.STARS) files.stars = rd(E.STARS);
const A1 = E.A1 ? rd(E.A1) : null; if (A1) files.a1 = A1;
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([nodes, files, ICONS, LAY]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; }); const IM = {}; for (const [k, u] of Object.entries(files)) IM[k] = await load(u);
    const DISP = { gate: 44, small: 20, notable: 44, keystone: 64 }, D2 = { gate: 88, small: 40, notable: 88, keystone: 128 }, ICON = { notable: 28, keystone: 40 }, KEYS = ['万人敌', '一骑当千', '火烧连营', '三军统帅'];
    const setOf = n => ['strength', 'agility', 'intellect', 'command'].includes(n.region) ? n.region : 'neutral';
    const byId = Object.fromEntries(nodes.nodes.map(n => [n.id, n])), nm = Object.fromEntries(nodes.nodes.map(n => [n.name, n]));
    const makeStates = (demo) => { const lit = new Set(); if (demo) { for (const n of nodes.nodes) if (n.region === 'strength') lit.add(n.id); lit.add('agility.G'); if (nm['游刃']) lit.add(nm['游刃'].id); } const ready = new Set(); for (const [a, b2] of nodes.edges) { if (lit.has(a) && !lit.has(b2)) ready.add(b2); if (lit.has(b2) && !lit.has(a)) ready.add(a); } if (demo && nm['连珠']) ready.add(nm['连珠'].id); return n => lit.has(n.id) ? 'on' : ready.has(n.id) ? 'ready' : 'off'; };
    const drawMap = (demo, withBg = true) => {
      const stateOf = makeStates(demo), isLit = id => stateOf(byId[id]) === 'on';
      const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; if (withBg) g.drawImage(IM.bg, 0, 0, 1600, 900);
      if (LAY) { const pl = LAY.plate; g.save(); g.globalAlpha = pl.alpha; g.drawImage(IM.d_plate, pl.x - pl.w / 2, pl.y - pl.h / 2, pl.w, pl.h); for (const t of LAY.trigrams) { g.globalAlpha = t.alpha; g.drawImage(IM['d_' + t.id], t.x - t.w / 2, t.y - t.h / 2, t.w, t.h); } g.restore(); }
      g.strokeStyle = 'rgba(200,180,140,.35)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); g.arc(800, 450, 44, 0, 7); g.stroke(); g.setLineDash([]);
      for (const [a, b2] of nodes.edges) {
        const A = byId[a], B = byId[b2]; if (!A || !B) continue; const both = isLit(a) && isLit(b2), im = both ? IM.lineGold : IM.lineInk, len = Math.hypot(B.x - A.x, B.y - A.y), ang = Math.atan2(B.y - A.y, B.x - A.x), sc = .5, ph = im.height * sc;
        g.save(); g.translate(A.x, A.y); g.rotate(ang); if (!both) { g.filter = 'brightness(1.0)'; g.globalAlpha = .72; } const pt = g.createPattern(im, 'repeat-x'); pt.setTransform(new DOMMatrix().scale(sc, sc)); g.fillStyle = pt; g.translate(0, -ph / 2); g.fillRect(0, 0, len, ph); g.restore();
      }
      const order = { gate: 0, small: 1, notable: 2, keystone: 3 };
      for (const n of [...nodes.nodes].sort((a, b2) => order[a.kind] - order[b2.kind])) {
        const k = n.kind, st = stateOf(n), im = IM[`${setOf(n)}/${k}_${st}`], sc = DISP[k] / D2[k]; g.drawImage(im, n.x - im.width * sc / 2, n.y - im.height * sc / 2, im.width * sc, im.height * sc);
        const ic = ICONS[n.name]; if (ic && ICON[k]) { g.globalAlpha = st === 'on' ? 1 : st === 'ready' ? .75 : .45; const sz = ICON[k]; g.drawImage(IM['icon_' + ic], n.x - sz / 2, n.y - sz / 2, sz, sz); g.globalAlpha = 1; }
      }
      return c;
    };
    const full = drawMap(true), alloff = drawMap(false);
    const crop = document.createElement('canvas'); crop.width = 900; crop.height = 700; crop.getContext('2d').drawImage(full, 400, 60, 900, 700, 0, 0, 900, 700);
    // 28 图标总表：每格左 = 实际大小（要星底座 44 / 主星 64），右 = 2×
    const groups = [['strength', ['千钧', '破阵', '斩将', '铁骨', '背水', '万人敌']], ['agility', ['轻骑', '游刃', '疾影', '连击', '追风', '一骑当千']], ['intellect', ['凝神', '连珠', '广域', '余烬', '妙算', '火烧连营']], ['command', ['励军', '募众', '同袍', '严阵', '号令', '三军统帅']], ['neutral', ['骁锐', '奇谋', '帷幄', '身先士卒']]];
    const tb = document.createElement('canvas'); tb.width = 6 * 170 + 20; tb.height = 5 * 170 + 20; const tg = tb.getContext('2d'); tg.fillStyle = '#17120e'; tg.fillRect(0, 0, tb.width, tb.height); tg.font = '12px sans-serif';
    groups.forEach(([set, names], gi) => names.forEach((name, ni) => {
      const k = KEYS.includes(name) ? 'keystone' : 'notable', sc = DISP[k] / D2[k], sz = ICON[k], base = IM[`${set}/${k}_on`], icn = IM['icon_' + ICONS[name]], x0 = 10 + ni * 170, y0 = 10 + gi * 170, c1x = x0 + 36, c1y = y0 + 56, c2x = x0 + 112, c2y = y0 + 56;
      tg.drawImage(base, c1x - base.width * sc / 2, c1y - base.height * sc / 2, base.width * sc, base.height * sc); tg.drawImage(icn, c1x - sz / 2, c1y - sz / 2, sz, sz);
      tg.drawImage(base, c2x - base.width * sc, c2y - base.height * sc, base.width * sc * 2, base.height * sc * 2); tg.drawImage(icn, c2x - sz, c2y - sz, sz * 2, sz * 2);
      tg.fillStyle = '#bbb'; tg.fillText(name, x0 + 6, y0 + 140);
    }));
    // 特效逐帧条
    const fx = IM.fx, N = 12, fsz = 192, fc = document.createElement('canvas'); fc.width = N * 100 + 10; fc.height = 400; const fg = fc.getContext('2d'); fg.fillStyle = '#17120e'; fg.fillRect(0, 0, fc.width, fc.height); fg.font = '12px sans-serif';
    for (let k = 0; k < N; k++) { fg.drawImage(fx, k * fsz, 0, fsz, fsz, 10 + k * 100, 10, 96, 96); fg.fillStyle = '#bbb'; fg.fillText(String(k + 1), 10 + k * 100 + 40, 120); }
    for (let k = 0; k < N; k++) { const nb = IM['strength/notable_on'], sc = 44 / 88, cx = 10 + k * 100 + 48; fg.drawImage(nb, cx - nb.width * sc / 2, 180 - nb.height * sc / 2, nb.width * sc, nb.height * sc); fg.drawImage(IM['icon_qianjun'], cx - 14, 166, 28, 28); fg.drawImage(fx, k * fsz, 0, fsz, fsz, cx - 44, 136, 88, 88); }
    for (let k = 0; k < N; k++) { const kb = IM['command/keystone_on'], sc = 64 / 128, cx = 10 + k * 100 + 48; fg.drawImage(kb, cx - kb.width * sc / 2, 300 - kb.height * sc / 2, kb.width * sc, kb.height * sc); fg.drawImage(IM['icon_sanjun'], cx - 20, 280, 40, 40); fg.drawImage(fx, k * fsz, 0, fsz, fsz, cx - 64, 236, 128, 128); }
    fg.fillStyle = '#bbb'; fg.fillText('上：12 帧（96px）；中：套在要星（特效 88px）；下：套在主星（特效 128px）', 10, 392);

    // 实机版式（960×540，输出 2×）：底图 + 星图层（fit=.64，home=可见区中心）+ 左右文字栏取自实机截图 a1-open.jpg；可见区外淡出（界面里按元素中心淡出，这里按像素近似）
    const frames = {};
    if (LAY && IM.a1) { const ml = drawMap(true, false), FIT = .64, CL = { l: 210, r: 730, t: 4, b: 516 };
      const mk = (zoom, px, py) => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(IM.bg, 0, 0, 1920, 1080);
        const t = document.createElement('canvas'); t.width = 1920; t.height = 1080; const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; const s = FIT * zoom * 2; tg.drawImage(ml, 470 * 2 - px * s, 264 * 2 - py * s, 1600 * s, 900 * s);
        const mask = (x0, x1, y0, y1) => { const m = document.createElement('canvas'); m.width = 1920; m.height = 1080; const mg = m.getContext('2d'); const gh = mg.createLinearGradient(0, 0, 1920, 0); const E2 = 32 / 1920; gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(x0 * 2 / 1920, 'rgba(0,0,0,0)'); gh.addColorStop(x0 * 2 / 1920 + E2, '#000'); gh.addColorStop(x1 * 2 / 1920 - E2, '#000'); gh.addColorStop(x1 * 2 / 1920, 'rgba(0,0,0,0)'); gh.addColorStop(1, 'rgba(0,0,0,0)'); mg.fillStyle = gh; mg.fillRect(0, 0, 1920, 1080); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(m, 0, 0); const m2 = document.createElement('canvas'); m2.width = 1920; m2.height = 1080; const m2g = m2.getContext('2d'); const gv = m2g.createLinearGradient(0, 0, 0, 1080); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(y0 * 2 / 1080, 'rgba(0,0,0,0)'); gv.addColorStop(y0 * 2 / 1080 + E2 * 1.78, '#000'); gv.addColorStop(y1 * 2 / 1080 - E2 * 1.78, '#000'); gv.addColorStop(y1 * 2 / 1080, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,0)'); m2g.fillStyle = gv; m2g.fillRect(0, 0, 1920, 1080); tg.drawImage(m2, 0, 0); tg.globalCompositeOperation = 'source-over'; };
        mask(CL.l, CL.r, CL.t, CL.b); g.drawImage(t, 0, 0);
        g.drawImage(IM.a1, 0, 0, 205, 540, 0, 0, 410, 1080); g.drawImage(IM.a1, 735, 0, 225, 540, 1470, 0, 450, 1080); g.drawImage(IM.a1, 205, 516, 530, 24, 410, 1032, 1060, 48);
        if (IM.stars) { g.save(); g.beginPath(); g.rect(0, 0, 410, 1080); g.rect(1470, 0, 450, 1080); g.clip(); g.drawImage(IM.stars, 0, 0, 1920, 1080); g.restore(); } return c; };
      frames.A = mk(1, 800, 450).toDataURL('image/png'); frames.B = mk(1.5, 900, 450).toDataURL('image/png'); }
    return { frames, full: full.toDataURL('image/png'), alloff: alloff.toDataURL('image/png'), crop: crop.toDataURL('image/png'), table: tb.toDataURL('image/png'), fx: fc.toDataURL('image/png') };
  }, [nodes, files, ICONS, LAY]);
  const w = (f, u) => fs.writeFileSync('assets/review/star-map/' + f, Buffer.from(u.split(',')[1], 'base64')), T = E.TAG || '';
  if (r.frames.A) { w(`star_map_frame${T}.png`, r.frames.A); w(`star_map_frame_zoom${T}.png`, r.frames.B); }
  w(`star_map_mock_1600x900${T}.png`, r.full); w(`star_map_mock_alloff${T}.png`, r.alloff); w(`star_map_actual_size_crop${T}.png`, r.crop); if (!T) { w('star_map_icon_table.png', r.table); w('star_map_fx_strip.png', r.fx); } console.log('ok');
} finally { await b.close(); }
