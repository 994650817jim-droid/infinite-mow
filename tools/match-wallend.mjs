// 城墙端头墙面向 wall_seg 做色彩匹配（2026-11-21）：端头外侧城垛顶（y>=TOP）以下的像素，按 RGB 三通道的均值 / 标准差对齐到 wall_seg 墙面（y>=92）；
// 再在左缘 FADE 像素内按「端头左缘列均值 → wall_seg 右缘列均值」的残差做渐变修正，让接缝平顺。角楼、平台（y<TOP）不动。
// 输入 wallend_right.png（compose-wallend 的输出）；输出覆盖 wallend_right.png 并重生成 wallend_left.png（镜像）。原未匹配版存 originals/wallend_right_unmatched.png。
// 用法：node tools/match-wallend.mjs   （可选 TOP=402 FADE=14 STRENGTH=1）
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/siege-v2/defense-v2/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const src = fs.existsSync(D + 'originals/wallend_right_unmatched.png') ? D + 'originals/wallend_right_unmatched.png' : D + 'wallend_right.png';
if (!fs.existsSync(D + 'originals/wallend_right_unmatched.png')) fs.copyFileSync(D + 'wallend_right.png', D + 'originals/wallend_right_unmatched.png');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([endU, segU, TOP, FADE, K, MOTTLE]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const ei = await load(endU), si = await load(segU), W = ei.width, H = ei.height;
    const px = (im, x0, y0, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, x0, y0, w, h, 0, 0, w, h); return g.getImageData(0, 0, w, h); };
    const stats = (img, y0) => { const d = img.data, w = img.width, n = [0, 0, 0], m = [0, 0, 0], s2 = [0, 0, 0]; let cnt = 0; for (let y = y0; y < img.height; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] < 200) continue; cnt++; for (let k = 0; k < 3; k++) { m[k] += d[i + k]; s2[k] += d[i + k] * d[i + k]; } } return { mean: m.map(v => v / cnt), std: m.map((v, k) => Math.sqrt(s2[k] / cnt - (v / cnt) ** 2)), cnt }; };
    const E = px(ei, 0, 0, W, H), S = px(si, 0, 0, si.width, si.height), se = stats(E, TOP), ss = stats(S, 92), d = E.data;
    // 通道映射：(v-mean_e)*std_s/std_e + mean_s，再按 K 与原值混合
    for (let y = TOP; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] === 0) continue; for (let k = 0; k < 3; k++) { const v = (d[i + k] - se.mean[k]) * (ss.std[k] / se.std[k]) + ss.mean[k]; d[i + k] = Math.max(0, Math.min(255, d[i + k] * (1 - K) + v * K)); } }
    // 低频斑驳：取 wall_seg 墙面的亮度「带通」(blur 3px − blur 22px) 作为明暗斑块图，按端头行 y ↔ seg 行 92+(y-TOP) 对应加上去（两张图同一资产比例），让墙面也有 wall_seg 那种一块块深浅不一的斑驳
    if (MOTTLE > 0) { const bl = (r) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.filter = 'grayscale(1) blur(' + r + 'px)'; g.drawImage(si, 300, 92 - TOP, W, H, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
      const a = bl(3), b2 = bl(22); for (let y = TOP + 62; y < H - 36; y++) for (let x = 0; x < 436; x++) { const i = (y * W + x) * 4; if (d[i + 3] === 0) continue; const m = (a[i] - b2[i]) * MOTTLE; for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, d[i + k] + m)); } }
    // 左缘渐变：端头左缘（x<4）匹配后的列均值 vs wall_seg 右缘（最后 4 列、y>=92）列均值，残差按距离线性衰减
    const edgeMean = (img, xa, xb, y0, y1) => { const m = [0, 0, 0]; let c = 0; for (let y = y0; y < y1; y++) for (let x = xa; x < xb; x++) { const i = (y * img.width + x) * 4; if (img.data[i + 3] < 200) continue; c++; for (let k = 0; k < 3; k++) m[k] += img.data[i + k]; } return m.map(v => v / c); };
    const eEdge = edgeMean(E, 0, 4, TOP + 40, H - 80), sEdge = edgeMean(S, S.width - 40, S.width - 20, 230, 380), res = eEdge.map((v, k) => sEdge[k] - v);
    for (let y = TOP; y < H; y++) for (let x = 0; x < FADE; x++) { const i = (y * W + x) * 4; if (d[i + 3] === 0) continue; const w = 1 - x / FADE; if (!res.every(Number.isFinite)) break; for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, d[i + k] + res[k] * w)); }
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H; oc.getContext('2d').putImageData(E, 0, 0);
    const m = document.createElement('canvas'); m.width = W; m.height = H; const mg = m.getContext('2d'); mg.translate(W, 0); mg.scale(-1, 1); mg.drawImage(oc, 0, 0);
    return { endStats: se, segStats: ss, residual: res, right: oc.toDataURL('image/png'), left: m.toDataURL('image/png') };
  }, [rd(src), rd('public/assets/siege-v2/luoyang/wall_seg.png'), +(E.TOP ?? 402), +(E.FADE ?? 14), +(E.STRENGTH ?? 1), +(E.MOTTLE ?? 1.6)]);
  const w = (f, u) => fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); w(D + 'wallend_right.png', r.right); w(D + 'wallend_left.png', r.left);
  console.log(JSON.stringify({ end: r.endStats.mean.map(Math.round), endStd: r.endStats.std.map(Math.round), seg: r.segStats.mean.map(Math.round), segStd: r.segStats.std.map(Math.round), residual: r.residual.map(Math.round) }));
} finally { await b.close(); }
