// 破门版门楼合成（2026-11-21）：把 ChatGPT 重绘的拱门裁图（原裁图 ×3 放大版）对齐后，只贴回「拱门区域」到 gate_passable_v2.png，其余一像素不动，输出 gate_passable_v2_broken.png。
// 裁图：x 290..590、y 536..816（300×280）。拱门区域掩膜 = 拱石外缘（圆心 CX,CY 半径 R 的上半圆 + 下方矩形，外扩 MARGIN）。
// 对齐：在 ±SEARCH 像素内搜索平移（和缩放 1），使掩膜外一圈（墙面）与原图差异最小。
// 用法：SRC=…/ChatGPT 重绘图.png OUT=public/assets/siege-v2/defense-v2/gate_passable_v2_broken.png PREVIEW=assets/review/defense-v2/art/gate_broken_compare.png node tools/paste-broken-gate.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const E = process.env, D = 'public/assets/siege-v2/defense-v2/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const P = { x0: 290, y0: 536, w: 300, h: 280, cx: 432.5, cy: 691, r: 121, left: 311, right: 554, margin: +(E.MARGIN ?? 3), search: +(E.SEARCH ?? 8), sx: +(E.SX ?? 3) };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([orig, gen, P]) => {
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const oi = await load(orig), gi = await load(gen), W = oi.width, H = oi.height;
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const og = oc.getContext('2d', { willReadFrequently: true }); og.drawImage(oi, 0, 0);
    const O = og.getImageData(0, 0, W, H);
    // 掩膜（整图坐标）
    const inMask = (x, y, m) => { const dx = x - P.cx, dy = y - P.cy; if (y > 807) return false; if (y > 802 && (x < 343 || x > 523)) return false; if (y >= P.cy) return x >= P.left - m && x <= P.right + m; return dx * dx + dy * dy <= (P.r + m) * (P.r + m); };
    // 生成图缩回到裁图尺寸（300×280），带搜索平移
    const gc = document.createElement('canvas'); gc.width = P.w; gc.height = P.h; const gg = gc.getContext('2d', { willReadFrequently: true });
    const diffAt = (tx, ty) => { gg.clearRect(0, 0, P.w, P.h); gg.imageSmoothingQuality = 'high'; gg.drawImage(gi, tx, ty, P.w, P.h); const G = gg.getImageData(0, 0, P.w, P.h).data; let s = 0, n = 0; for (let y = 0; y < P.h; y += 2) for (let x = 0; x < P.w; x += 2) { const X = P.x0 + x, Y = P.y0 + y; if (inMask(X, Y, 10) || O.data[(Y * W + X) * 4 + 3] < 200) continue; const i = (Y * W + X) * 4, j = (y * P.w + x) * 4; s += Math.abs(O.data[i] - G[j]) + Math.abs(O.data[i + 1] - G[j + 1]) + Math.abs(O.data[i + 2] - G[j + 2]); n++; } return s / n; };
    let best = [1e9, 0, 0]; for (let ty = -P.search; ty <= P.search; ty++) for (let tx = -P.search; tx <= P.search; tx++) { const d = diffAt(tx, ty); if (d < best[0]) best = [d, tx, ty]; }
    diffAt(best[1], best[2]); const G = gg.getImageData(0, 0, P.w, P.h).data;
    // 贴回：掩膜内用生成图，掩膜外保持原样；掩膜边缘 2 像素做羽化混合
    const out = new ImageData(new Uint8ClampedArray(O.data), W, H), d = out.data;
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) { const X = P.x0 + x, Y = P.y0 + y; if (!inMask(X, Y, P.margin)) continue; const edge = !inMask(X, Y, P.margin - 2), i = (Y * W + X) * 4, j = (y * P.w + x) * 4, a = edge ? .5 : 1; for (let k = 0; k < 3; k++) d[i + k] = Math.round(O.data[i + k] * (1 - a) + G[j + k] * a); d[i + 3] = O.data[i + 3]; }
    const oc2 = document.createElement('canvas'); oc2.width = W; oc2.height = H; oc2.getContext('2d').putImageData(out, 0, 0);
    // 差异检查：掩膜外（外扩 MARGIN 以外）是否有任何像素变化
    let changedOutside = 0, changedInside = 0; for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { const i = (Y * W + X) * 4; if (O.data[i] !== d[i] || O.data[i + 1] !== d[i + 1] || O.data[i + 2] !== d[i + 2] || O.data[i + 3] !== d[i + 3]) { if (inMask(X, Y, P.margin)) changedInside++; else changedOutside++; } }
    // 并排预览
    const pv = document.createElement('canvas'); pv.width = W * 2 + 20; pv.height = H; const pg = pv.getContext('2d'); pg.fillStyle = '#777'; pg.fillRect(0, 0, pv.width, H); pg.drawImage(oi, 0, 0); pg.drawImage(oc2, W + 20, 0);
    return { best, changedOutside, changedInside, out: oc2.toDataURL('image/png'), prev: pv.toDataURL('image/png') };
  }, [rd(D + 'gate_passable_v2.png'), rd(E.SRC), P]);
  fs.writeFileSync(E.OUT, Buffer.from(res.out.split(',')[1], 'base64')); if (E.PREVIEW) fs.writeFileSync(E.PREVIEW, Buffer.from(res.prev.split(',')[1], 'base64'));
  console.log(JSON.stringify({ align: { meanDiff: +res.best[0].toFixed(1), tx: res.best[1], ty: res.best[2] }, changedOutsideMask: res.changedOutside, changedInsideMask: res.changedInside }));
} finally { await b.close(); }
