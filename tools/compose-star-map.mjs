// 星图效果图合成（2026-11-21，第一步样张）：把底图、节点底座（按区染色）、图标试样按 star-map-nodes.json 的坐标拼成 1600×900 效果图，
// 并另存一张「1:1 实际显示尺寸」裁图（不放大）。连线是程序占位（第二步会换手绘连线贴图）；中心头像位是占位虚线圈。
// 用法：NODES=…/star-map-nodes.json node tools/compose-star-map.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/star-map/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const nodes = JSON.parse(fs.readFileSync(E.NODES, 'utf8'));
const files = {}; for (const k of ['gate', 'small', 'notable', 'keystone']) for (const s of ['off', 'ready', 'on']) files[`${k}_${s}`] = rd(D + `node_${k}_${s}.png`);
for (const id of ['qianjun', 'youren', 'lianzhu', 'lijun', 'wanrendi']) files['icon_' + id] = rd(D + `icon_${id}.png`);
files.bg = rd(D + 'originals/bg_starmap.png');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([nodes, files]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; }); const IM = {}; for (const [k, u] of Object.entries(files)) IM[k] = await load(u);
    const HUE = { strength: 'hue-rotate(-34deg) saturate(1.5)', agility: 'hue-rotate(118deg) saturate(1.3)', intellect: 'hue-rotate(222deg) saturate(1.3)', command: 'none' };
    const LINE = { strength: '#e07a5f', agility: '#5fd0b0', intellect: '#b09cff', command: '#e8b84a' };
    const DISP = { gate: 44, small: 20, notable: 36, keystone: 56 }, ICON = { notable: 24, keystone: 40 }, ICONS = { '千钧': 'qianjun', '游刃': 'youren', '连珠': 'lianzhu', '励军': 'lijun', '万人敌': 'wanrendi' };
    const byId = Object.fromEntries(nodes.nodes.map(n => [n.id, n])), lit = new Set(nodes.nodes.filter(n => n.region === 'strength').map(n => n.id)); lit.add('agility.G'); const youren = nodes.nodes.find(n => n.name === '游刃'); if (youren) lit.add(youren.id);
    const ready = new Set(); for (const [a, b2] of nodes.edges) { if (lit.has(a) && !lit.has(b2)) ready.add(b2); if (lit.has(b2) && !lit.has(a)) ready.add(a); } const lianzhu = nodes.nodes.find(n => n.name === '连珠'); if (lianzhu) ready.add(lianzhu.id);
    const stateOf = n => lit.has(n.id) ? 'on' : ready.has(n.id) ? 'ready' : 'off';
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(IM.bg, 0, 0, 1600, 900);
    // 占位：中心头像位
    g.strokeStyle = 'rgba(200,180,140,.35)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); g.arc(800, 450, 44, 0, 7); g.stroke(); g.setLineDash([]);
    // 连线（程序占位）：未点亮淡墨线，两端都点亮 = 流金线
    for (const [a, b2] of nodes.edges) { const A = byId[a], B = byId[b2]; if (!A || !B) continue; const both = lit.has(a) && lit.has(b2), one = lit.has(a) || lit.has(b2); g.save(); g.lineCap = 'round'; if (both) { g.strokeStyle = '#e6c46a'; g.lineWidth = 2.4; g.shadowColor = 'rgba(255,200,90,.7)'; g.shadowBlur = 6; } else { g.strokeStyle = one ? 'rgba(170,150,110,.55)' : 'rgba(120,108,90,.32)'; g.lineWidth = 1.4; } g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.restore(); }
    // 节点
    const order = { gate: 0, small: 1, notable: 2, keystone: 3 }; for (const n of [...nodes.nodes].sort((a, b2) => order[a.kind] - order[b2.kind])) {
      const k = n.kind, st = stateOf(n), im = IM[`${k}_${st}`], s = DISP[k] / (k === 'gate' ? 88 : k === 'small' ? 40 : k === 'notable' ? 72 : 112), w = im.width * s, h = im.height * s;
      g.filter = st === 'off' ? HUE[n.region] + ' brightness(.9)' : HUE[n.region]; g.drawImage(im, n.x - w / 2, n.y - h / 2, w, h); g.filter = 'none';
      const ic = ICONS[n.name]; if (ic && ICON[k]) { g.globalAlpha = st === 'on' ? 1 : st === 'ready' ? .7 : .38; const sz = ICON[k]; g.drawImage(IM['icon_' + ic], n.x - sz / 2, n.y - sz / 2, sz, sz); g.globalAlpha = 1; }
    }
    // 1:1 裁图：力量区上部 640×400，不放大
    const crop = document.createElement('canvas'); crop.width = 640; crop.height = 400; crop.getContext('2d').drawImage(c, 380, 40, 640, 400, 0, 0, 640, 400);
    return { full: c.toDataURL('image/png'), crop: crop.toDataURL('image/png'), lit: lit.size, ready: ready.size };
  }, [nodes, files]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); w(E.FULL ?? 'assets/review/star-map/star_map_mock_1600x900.png', r.full); w(E.CROP ?? 'assets/review/star-map/star_map_actual_size_crop.png', r.crop); console.log('lit', r.lit, 'ready', r.ready);
} finally { await b.close(); }
