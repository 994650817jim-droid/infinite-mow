// 星图效果图合成 v2（2026-11-21）：底图 + 预染色节点底座（nodes/<set>/）+ 图标，按 star-map-nodes.json 坐标拼 1600×900 效果图；
// 另存 1:1 实际显示尺寸裁图（900×700，含点亮 / 可点 / 暗的要星和点亮的主星，图标都放进去）、以及「5 图标 28px / 40px 摆在点亮底座上的对比条」。
// 显示尺寸（1×）：入口 44 / 小星 20 / 要星 44 / 主星 64；图标：要星 28 / 主星 40。连线与头像位仍是程序占位。
// 用法：NODES=…/star-map-nodes.json node tools/compose-star-map.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/star-map/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const nodes = JSON.parse(fs.readFileSync(E.NODES, 'utf8')), files = {};
for (const s of ['neutral', 'strength', 'agility', 'intellect', 'command']) for (const k of ['gate', 'small', 'notable', 'keystone']) for (const t of ['off', 'ready', 'on']) files[`${s}/${k}_${t}`] = rd(D + `nodes/${s}/${k}_${t}.png`);
for (const id of ['qianjun', 'youren', 'lianzhu', 'lijun', 'wanrendi']) files['icon_' + id] = rd(D + `icon_${id}.png`);
files.bg = rd(D + 'originals/bg_starmap.png');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([nodes, files]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; }); const IM = {}; for (const [k, u] of Object.entries(files)) IM[k] = await load(u);
    const DISP = { gate: 44, small: 20, notable: 44, keystone: 64 }, D2 = { gate: 88, small: 40, notable: 88, keystone: 128 }, ICON = { notable: 28, keystone: 40 }, ICONS = { '千钧': 'qianjun', '游刃': 'youren', '连珠': 'lianzhu', '励军': 'lijun', '万人敌': 'wanrendi' };
    const setOf = n => ['strength', 'agility', 'intellect', 'command'].includes(n.region) ? n.region : 'neutral';
    const byId = Object.fromEntries(nodes.nodes.map(n => [n.id, n])), nm = Object.fromEntries(nodes.nodes.map(n => [n.name, n]));
    const lit = new Set(nodes.nodes.filter(n => n.region === 'strength').map(n => n.id)); lit.add('agility.G'); if (nm['游刃']) lit.add(nm['游刃'].id);
    const ready = new Set(); for (const [a, b2] of nodes.edges) { if (lit.has(a) && !lit.has(b2)) ready.add(b2); if (lit.has(b2) && !lit.has(a)) ready.add(a); } if (nm['连珠']) ready.add(nm['连珠'].id);
    const stateOf = n => lit.has(n.id) ? 'on' : ready.has(n.id) ? 'ready' : 'off';
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(IM.bg, 0, 0, 1600, 900);
    g.strokeStyle = 'rgba(200,180,140,.35)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); g.arc(800, 450, 44, 0, 7); g.stroke(); g.setLineDash([]);
    for (const [a, b2] of nodes.edges) { const A = byId[a], B = byId[b2]; if (!A || !B) continue; const both = lit.has(a) && lit.has(b2), one = lit.has(a) || lit.has(b2); g.save(); g.lineCap = 'round'; if (both) { g.strokeStyle = '#d9b45a'; g.lineWidth = 2.4; g.shadowColor = 'rgba(255,200,90,.55)'; g.shadowBlur = 5; } else { g.strokeStyle = one ? 'rgba(170,150,110,.55)' : 'rgba(120,108,90,.32)'; g.lineWidth = 1.4; } g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.restore(); }
    const order = { gate: 0, small: 1, notable: 2, keystone: 3 };
    for (const n of [...nodes.nodes].sort((a, b2) => order[a.kind] - order[b2.kind])) { const k = n.kind, st = stateOf(n), im = IM[`${setOf(n)}/${k}_${st}`], sc = DISP[k] / D2[k]; g.drawImage(im, n.x - im.width * sc / 2, n.y - im.height * sc / 2, im.width * sc, im.height * sc);
      const ic = ICONS[n.name]; if (ic && ICON[k]) { g.globalAlpha = st === 'on' ? 1 : st === 'ready' ? .72 : .4; const sz = ICON[k]; g.drawImage(IM['icon_' + ic], n.x - sz / 2, n.y - sz / 2, sz, sz); g.globalAlpha = 1; } }
    const crop = document.createElement('canvas'); crop.width = 900; crop.height = 700; crop.getContext('2d').drawImage(c, 400, 60, 900, 700, 0, 0, 900, 700);
    // 对比条：5 图标在点亮底座上，要星 28px、主星 40px 实际大小（左半），右半同图放大 3× 方便看
    const st = document.createElement('canvas'); st.width = 760; st.height = 300; const sg = st.getContext('2d'); sg.fillStyle = '#17120e'; sg.fillRect(0, 0, 760, 300); sg.fillStyle = '#bbb'; sg.font = '12px sans-serif'; sg.fillText('实际大小 1:1（要星底座 44、图标 28；主星底座 64、图标 40）', 10, 16); sg.fillText('同图放大 3×（前 4 个）', 10, 110);
    const demo = [['qianjun', 'strength', 'notable'], ['youren', 'agility', 'notable'], ['lianzhu', 'intellect', 'notable'], ['lijun', 'command', 'notable'], ['wanrendi', 'strength', 'keystone']];
    demo.forEach(([ic, set, k], i) => { for (const [mul, oy] of [[1, 30], [3, 120]]) { const x = 40 + i * 150 * (mul === 1 ? 1 : 1) + (mul === 3 ? 0 : 0), cx = 70 + i * 140, cy = oy + (mul === 1 ? 32 : 72); const base = IM[`${set}/${k}_on`], sc = DISP[k] / D2[k] * mul; if (mul === 3 && i > 3) continue; sg.drawImage(base, cx - base.width * sc / 2, cy - base.height * sc / 2, base.width * sc, base.height * sc); const sz = ICON[k] * mul; sg.drawImage(IM['icon_' + ic], cx - sz / 2, cy - sz / 2, sz, sz); void x; } });
    return { full: c.toDataURL('image/png'), crop: crop.toDataURL('image/png'), strip: st.toDataURL('image/png') };
  }, [nodes, files]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); w('assets/review/star-map/star_map_mock_1600x900.png', r.full); w('assets/review/star-map/star_map_actual_size_crop.png', r.crop); w('assets/review/star-map/star_map_icon_strip.png', r.strip); console.log('ok');
} finally { await b.close(); }
