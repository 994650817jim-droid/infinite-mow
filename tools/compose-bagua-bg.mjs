// 八卦阵底图合成（星图 · 2026-11-21）：现有 bg_starmap.png（保留四角区色晕）+ 中心太极八角环板（ChatGPT 生成，黑底）+ 八卦爻线表切出的 8 个卦象（ChatGPT 生成，黑底）
// 黑底当透明（screen 叠加），整体压暗到节点暗态底座以下。卦象按 star-map-nodes.json 的坐标摆在节点外侧空白处（1600×900 合成图坐标 → ×1.2 = 1920×1080）。
// 用法：NODES=…/star-map-nodes.json node tools/compose-bagua-bg.mjs    （可选 PLATE_B=.5 TRI_B=.55 PLATE_D=360 TRI_W=84）
// 输出：public/assets/star-map/bg_starmap_bagua.webp（1920×1080）+ 校核图 assets/review/star-map/bagua_bg_check.png（卦象 / 太极板的位置框 + 节点点位，仅检查用）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/star-map/', rd = f => 'data:image/' + (f.endsWith('jpg') ? 'jpeg' : 'png') + ';base64,' + fs.readFileSync(f).toString('base64');
const nodes = JSON.parse(fs.readFileSync(E.NODES, 'utf8')), cfg = { plateB: +(E.PLATE_B ?? .3), triB: +(E.TRI_B ?? .5), plateD: +(E.PLATE_D ?? 360), triW: +(E.TRI_W ?? 120) };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([bgU, plU, trU, nodes, cfg]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; }), bg = await load(bgU), pl = await load(plU), tr = await load(trU), S = 1.2;
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bg, 0, 0, 1920, 1080);
    // 太极八角环板：截图 1568×727 里圆环外缘约 x447..1112、y38..690；顶部 y<44 有一块「Claude is working here」提示条（x677..891）先涂黑
    const pc = document.createElement('canvas'); pc.width = 680; pc.height = 680; const pg = pc.getContext('2d'); pg.drawImage(pl, 440, 24, 680, 680, 0, 0, 680, 680); pg.fillStyle = '#000'; pg.fillRect(677 - 440 - 4, 0, 891 - 677 + 8, 46 - 24);
    // 画布四边 6px 清黑（截图橙色边框 / 抗锯齿）
    pg.fillRect(0, 0, 680, 6); pg.fillRect(0, 674, 680, 6); pg.fillRect(0, 0, 6, 680); pg.fillRect(674, 0, 6, 680);
    const TAIJI = 392, sc = cfg.plateD / TAIJI, side = 680 * sc; g.save(); g.globalCompositeOperation = 'screen'; g.filter = `contrast(1.25) brightness(${cfg.plateB})`; g.drawImage(pc, 960 - side / 2 + 2 * sc, 540 - side / 2 + 0, side, side); g.restore();
    // 卦象：爻线表 1774×887 → 截图 1568 宽版里每个卦象块（含卦名）。这里直接在原图坐标切（缩放比 1774/1568）
    const k = 1, cell = { cols: [[150, 395], [495, 740], [840, 1085], [1180, 1430]], rows: [[95, 320], [415, 635]] }; // 截图坐标下的切块（含名）
    const names = [['乾', '巽', '离', '坤'], ['震', '兑', '坎', '艮']];
    const pos = { '乾': [300, 150], '巽': [1300, 150], '离': [1300, 750], '坤': [300, 750], '震': [800, 100], '兑': [1300, 450], '坎': [800, 800], '艮': [300, 450] }; // 1600×900 坐标：块中心
    const boxes = [];
    for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) {
      const [x0, x1] = cell.cols[q], [y0, y1] = cell.rows[r], sw = (x1 - x0), sh = (y1 - y0), W = cfg.triW, H = W * sh / sw, [cx, cy] = pos[names[r][q]];
      g.save(); g.globalCompositeOperation = 'screen'; g.filter = `contrast(1.25) brightness(${cfg.triB})`; g.drawImage(tr, x0 * k, y0 * k, sw * k, sh * k, cx * S - W / 2, cy * S - H / 2, W, H); g.restore(); boxes.push([names[r][q], cx * S - W / 2, cy * S - H / 2, W, H]);
    }
    // 校核：节点点位 + 卦象 / 太极板框
    const ck = document.createElement('canvas'); ck.width = 1920; ck.height = 1080; const cg = ck.getContext('2d'); cg.drawImage(c, 0, 0);
    cg.fillStyle = 'rgba(255,60,60,.9)'; for (const n of nodes.nodes) { cg.beginPath(); cg.arc(n.x * S, n.y * S, (n.kind === 'keystone' ? 32 : n.kind === 'small' ? 10 : 24) * S * .62 * 1.6, 0, 7); cg.fill(); }
    cg.strokeStyle = '#0f0'; cg.lineWidth = 2; for (const [, x, y, w, h] of boxes) cg.strokeRect(x, y, w, h); cg.strokeStyle = '#0ff'; cg.strokeRect(960 - side / 2, 540 - side / 2, side, side);
    return { bg: c.toDataURL('image/webp', .92), png: c.toDataURL('image/png'), check: ck.toDataURL('image/png') };
  }, [rd(D + 'originals/bg_starmap.png'), rd(D + 'originals/raw/bagua_plate_gpt_1_screenshot.jpg'), rd(D + 'originals/raw/bagua_trigrams_gpt_1_screenshot.jpg'), nodes, cfg]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  w(D + 'bg_starmap_bagua.webp', r.bg); w(D + 'originals/bg_starmap_bagua.png', r.png); w('assets/review/star-map/bagua_bg_check.png', r.check); console.log('ok');
} finally { await b.close(); }
