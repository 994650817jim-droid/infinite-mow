// 地形素材裁切：洋红底素材图 → 按窗口抠出每件物件，保持原始比例（不缩放、不塞格），输出独立透明 PNG。
// MIRROR=x|y：把裁出的件与其镜像拼成 2 倍，使首尾无缝（河岸 / 桥面平铺用）。
// 用法：SRC=…/river_kit_gpt_v1.png OUTDIR=public/assets/terrain/river PIECES="bankN1:0.0,0.05,0.25,0.30:x;boat:0.75,0.7,1,1" node tools/crop-terrain-kit.mjs
//   PIECES：名字:x0,y0,x1,y1（占原图比例）[:x|y|xy 镜像拼接[:v0,v1 只留裁后高度的这一段，如 .1,.88]]，分号分隔。SPILL=all 对实心像素也去洋红溢色。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const E = process.env, { SRC, OUTDIR } = E;
if (!SRC || !OUTDIR || !E.PIECES) { console.error('需要 SRC、OUTDIR、PIECES'); process.exit(2); }
mkdirSync(OUTDIR, { recursive: true });
const pieces = E.PIECES.split(';').filter(Boolean).map(s => { const [n, w, m, v] = s.split(':'); return { n, w: w.split(',').map(Number), m: m || '', v: v ? v.split(',').map(Number) : null }; });
const KH = +(E.KEYHARD ?? 140), KS = +(E.KEYSOFT ?? 60), SPILLALL = E.SPILL === 'all', TRIM = E.TRIM !== '0', INSET = +(E.INSET ?? 0), WFIX = E.WFIX === '1';
const data = 'data:image/png;base64,' + readFileSync(SRC).toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const res = await p.evaluate(async ([data, pieces, KH, KS, SPILLALL, TRIM, INSET, WFIX]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.max(0, Math.min(R, B) - G);
      const a = m >= KH ? 0 : m <= KS ? 1 : 1 - (m - KS) / (KH - KS); let r2 = R, b2 = B;
      if (a > 0 && a < 1) { r2 = Math.max(0, Math.min(255, (R - (1 - a) * 255) / a)); b2 = Math.max(0, Math.min(255, (B - (1 - a) * 255) / a)); }
      const spill = (a < 1 || SPILLALL) ? Math.max(0, Math.min(r2, b2) - G) : 0; d[i] = r2 - spill; d[i + 2] = b2 - spill; d[i + 3] = Math.round(a * 255);
    }
    if (WFIX) for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i + 1], B = d[i + 2]; if (B > R + 8) { const k = Math.min(1, (B - R - 8) / 30); d[i] = R * (1 - .5 * k); d[i + 1] = G * (1 - .12 * k); d[i + 2] = B * (1 - .32 * k); } } // 蓝紫水色 → 青绿（对齐水面图）
    g.putImageData(img, 0, 0);
    const out = [];
    for (const pc of pieces) {
      const x0 = Math.round(pc.w[0] * W), y0 = Math.round(pc.w[1] * H), x1 = Math.round(pc.w[2] * W), y1 = Math.round(pc.w[3] * H);
      let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      if (bx1 < 0) { out.push({ n: pc.n, err: 'empty' }); continue; }
      if (!TRIM) { bx0 = x0; bx1 = x1 - 1; by0 = y0; by1 = y1 - 1; }
      if (INSET) { bx0 += INSET; bx1 -= INSET; }
      if (pc.v) { const hh = by1 - by0 + 1; by1 = by0 + Math.round(hh * pc.v[1]) - 1; by0 = by0 + Math.round(hh * pc.v[0]); }
      const w = bx1 - bx0 + 1, h = by1 - by0 + 1, mx = pc.m === 'x' || pc.m === 'xy', my = pc.m === 'y' || pc.m === 'xy';
      const c = document.createElement('canvas'); c.width = w * (mx ? 2 : 1); c.height = h * (my ? 2 : 1); const cg = c.getContext('2d');
      cg.drawImage(cv, bx0, by0, w, h, 0, 0, w, h);
      if (mx) { cg.save(); cg.translate(w * 2, 0); cg.scale(-1, 1); cg.drawImage(cv, bx0, by0, w, h, 0, 0, w, h); cg.restore(); }
      if (my) { cg.save(); cg.translate(0, h * 2); cg.scale(1, -1); cg.drawImage(cv, bx0, by0, w, h, 0, 0, w, h); cg.restore(); }
      if (mx && my) { cg.save(); cg.translate(w * 2, h * 2); cg.scale(-1, -1); cg.drawImage(cv, bx0, by0, w, h, 0, 0, w, h); cg.restore(); }
      out.push({ n: pc.n, w: c.width, h: c.height, url: c.toDataURL('image/png') });
    }
    return out;
  }, [data, pieces, KH, KS, SPILLALL, TRIM, INSET, WFIX]);
  for (const r of res) {
    if (r.err) { console.log(r.n, r.err); continue; }
    writeFileSync(`${OUTDIR}/${r.n}.png`, Buffer.from(r.url.split(',')[1], 'base64')); console.log(r.n, r.w + 'x' + r.h);
  }
} finally { await b.close(); }
