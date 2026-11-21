// 八卦阵「分层」素材（星图 · 2026-11-21 第二版）：把 ChatGPT 生成的太极八角环板 / 八卦爻线表（黑底）转成透明 PNG（亮度→alpha，颜色取归一化的古金色），
// 供界面按星图坐标放进 map 容器、跟着图平移缩放。输出 public/assets/star-map/bagua/：taiji_plate.png（2×，750×750）、trigram_<id>.png ×8（2×，112×104）、layout.json（星图坐标系 + 建议 alpha）。
// 来源：originals/raw/bagua_plate_gpt_1_tileA_top.jpg + tileB_bottom.jpg（同一张 1254² 原图 1:1 的上 / 下两段截图，拼起来）、bagua_trigrams_gpt_1_screenshot.jpg（爻线表整张截图）。
// 太极直径 PLATE_D（星图坐标，默认 228）；外圈细圆线和飞溅点被遮掉（只留太极 + 双层八角环）。
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/star-map/', O = D + 'bagua/', rd = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
const PLATE_D = +(E.PLATE_D ?? 228), TRI_W = +(E.TRI_W ?? 56);
fs.mkdirSync(O, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([A, B, T, PLATE_D, TRI_W]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const ia = await load(A), ib = await load(B), it = await load(T);
    // 亮度→alpha：alpha = (max(r,g,b) - floor) / (peak - floor)，颜色 = 通道按 max 归一化（古金色），透明底
    const toAlpha = (cv, floor, peak) => { const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height), a = d.data; for (let i = 0; i < a.length; i += 4) { const m = Math.max(a[i], a[i + 1], a[i + 2]); const al = Math.max(0, Math.min(1, (m - floor) / (peak - floor))); if (m > 0) { a[i] = Math.min(255, a[i] * 255 / m); a[i + 1] = Math.min(255, a[i + 1] * 255 / m); a[i + 2] = Math.min(255, a[i + 2] * 255 / m); } a[i + 3] = Math.round(al * 255); } g.putImageData(d, 0, 0); return cv; };
    // 1) 太极板：拼 1254×1254（截图里图左缘在 x=157）
    const st = document.createElement('canvas'); st.width = 1254; st.height = 1254; const sg = st.getContext('2d'); sg.fillStyle = '#000'; sg.fillRect(0, 0, 1254, 1254);
    sg.drawImage(ib, -157, 527); sg.save(); sg.beginPath(); sg.rect(0, 0, 1254, 620); sg.clip(); sg.drawImage(ia, -157, 0); sg.restore();
    const CX = 618, CY = 615, RMASK = 545, k = (PLATE_D / 2) / (675 / 2), S = Math.round(2 * RMASK * k * 2) / 2, side = Math.round(2 * RMASK * k * 2); // 2× 输出边长
    const pl = document.createElement('canvas'); pl.width = pl.height = side; const pg = pl.getContext('2d'); pg.imageSmoothingQuality = 'high';
    pg.save(); pg.beginPath(); pg.arc(side / 2, side / 2, side / 2 - 2, 0, 7); pg.clip(); pg.drawImage(st, CX - RMASK, CY - RMASK, RMASK * 2, RMASK * 2, 0, 0, side, side); pg.restore();
    toAlpha(pl, 14, 150);
    // 2) 八个卦象：爻线表截图（1568 宽）里每块（含卦名）中心；裁 232×216 缩到 112×104
    const names = [['乾', 'qian'], ['巽', 'xun'], ['离', 'li'], ['坤', 'kun'], ['震', 'zhen'], ['兑', 'dui'], ['坎', 'kan'], ['艮', 'gen']];
    const cx = [272, 617, 962, 1305], cy = [208, 525], out = {};
    names.forEach(([nm, id], i) => { const c = document.createElement('canvas'); c.width = 112; c.height = 104; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#000'; g.fillRect(0, 0, 112, 104); g.drawImage(it, cx[i % 4] - 116, cy[Math.floor(i / 4)] - 108, 232, 216, 0, 0, 112, 104); toAlpha(c, 14, 175); out[id] = c.toDataURL('image/png'); });
    return { plate: pl.toDataURL('image/png'), side, tri: out };
  }, [rd(D + 'originals/raw/bagua_plate_gpt_1_tileA_top.jpg'), rd(D + 'originals/raw/bagua_plate_gpt_1_tileB_bottom.jpg'), rd(D + 'originals/raw/bagua_trigrams_gpt_1_screenshot.jpg'), PLATE_D, TRI_W]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
  w(O + 'taiji_plate.png', r.plate); for (const [id, u] of Object.entries(r.tri)) w(O + `trigram_${id}.png`, u);
  const CENTER = { x: 800, y: 450 }, TW = 56, TH = 52;
  const T = [['qian', '乾', 505, 235, '左上·力量·主星内侧（千钧圈内空白）'], ['xun', '巽', 1095, 235, '右上·敏捷'], ['li', '离', 1095, 665, '右下·智力'], ['kun', '坤', 505, 665, '左下·统御'], ['zhen', '震', 800, 255, '正上·桥（桥要星内侧，朝中心）'], ['dui', '兑', 1000, 450, '正右·桥'], ['kan', '坎', 800, 645, '正下·桥'], ['gen', '艮', 600, 450, '正左·桥']];
  const layout = { note: '星图坐标系（与 star-map-nodes.json 同一坐标，放进 map 容器，随平移缩放；x,y 是图片中心，w,h 是 1× 显示尺寸，图本身 2×）。alpha 是建议不透明度（图是满强度）。淡出请按图片中心用与节点相同的 fadeAt。',
    plate: { key: 'bagua/taiji_plate.png', x: CENTER.x, y: CENTER.y, w: r.side / 2, h: r.side / 2, alpha: .2, depthBelow: 'edges' },
    trigrams: T.map(([id, name, x, y, where]) => ({ id, name, key: `bagua/trigram_${id}.png`, x, y, w: TW, h: TH, alpha: .32, where })) };
  fs.writeFileSync(O + 'layout.json', JSON.stringify(layout, null, 2)); console.log(JSON.stringify(layout.plate), r.side);
} finally { await b.close(); }
