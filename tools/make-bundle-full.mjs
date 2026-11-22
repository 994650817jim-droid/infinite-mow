// 行囊「鼓起」态（2026-11-21）：在原 public/assets/bag/bundle.webp 上做——同尺寸同角度：袋身中段水平略鼓（最多 +4.5%，上下端不动，结口 / 底边严丝合缝）、结口上方探出两枚铜钱（Gemini 绿幕图抠出，叠在袋子后面）、一团淡金光 + 小星点（Gemini 黑底图叠加）。
// 输出：public/assets/coins/bundle_full.png（与 bundle.webp 同尺寸的透明 PNG）+ 对比图 assets/review/coins/bundle_compare.png。用法：node tools/make-bundle-full.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const O = 'public/assets/coins/', R = O + 'originals/raw/', rd = (f, m) => `data:image/${m};base64,` + fs.readFileSync(f).toString('base64');
fs.mkdirSync('assets/review/coins', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([bun, coins, glow]) => {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const B = await load(bun), C = await load(coins), G = await load(glow), W = B.width, H = B.height;
    const bc = document.createElement('canvas'); bc.width = W; bc.height = H; const bg = bc.getContext('2d', { willReadFrequently: true }); bg.drawImage(B, 0, 0);
    const d = bg.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // 两枚铜钱（左变体：整张 1024×687 的左半 x 60..300、y 110..340，坐标取自截图 1:1）
    const cc = document.createElement('canvas'); cc.width = 380; cc.height = 380; const cg = cc.getContext('2d', { willReadFrequently: true }); cg.drawImage(C, 90, 150, 380, 380, 0, 0, 380, 380);
    const cd = cg.getImageData(0, 0, 380, 380), a = cd.data; for (let i = 0; i < a.length; i += 4) { const gn = a[i + 1] - Math.max(a[i], a[i + 2]); let al = Math.max(0, Math.min(1, (112 - gn) / 60)); if (al < 1) al = al * al; const m = Math.max(a[i], a[i + 2]); if (a[i + 1] > m - 4) a[i + 1] = Math.max(0, m - 4); a[i + 3] = Math.round(al * 255); } cg.putImageData(cd, 0, 0);
    const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
    const gb0 = null;
    // 0) 金光先画在最底层（袋子后面，只在结口两翼之间和轮廓外透出）
    const gcv = document.createElement('canvas'); gcv.width = 380; gcv.height = 380; const gcg = gcv.getContext('2d', { willReadFrequently: true }); gcg.drawImage(G, 70, 150, 380, 380, 0, 0, 380, 380); { const dd = gcg.getImageData(0, 0, 380, 380), qq = dd.data; for (let i = 0; i < qq.length; i += 4) { const m = Math.max(qq[i], qq[i + 1], qq[i + 2]); if (m > 0) { qq[i] = Math.min(255, qq[i] * 255 / m); qq[i + 1] = Math.min(255, qq[i + 1] * 255 / m); qq[i + 2] = Math.min(255, qq[i + 2] * 255 / m); } qq[i + 3] = Math.round(Math.max(0, Math.min(1, (m - 20) / 200)) * 255); } gcg.putImageData(dd, 0, 0); }
    { const gs0 = bw * .58; g.save(); g.globalAlpha = .8; g.drawImage(gcv, cx - gs0 / 2, y0 + bh * .22 - gs0 / 2, gs0, gs0); g.restore(); }
    // 1) 铜钱（在袋子后面，探出结口）：宽约 .46 bw，中心在结口上方
    const csz = 380 * .17; g.drawImage(cc, cx - csz / 2, y0 + bh * .19 - csz / 2, csz, csz);
    // 2) 鼓起的袋身：按行水平放大，s(y) = 1 + .045 * sin(π * t)，t 在 [.30, 1] 的袋身段（结口以上、底边不动）
    const top = y0 + bh * .30, bot = y1 + 1;
    for (let y = 0; y < H; y++) { let s = 1; if (y >= top && y < bot) s = 1 + .045 * Math.sin(Math.PI * (y - top) / (bot - top)); g.drawImage(B, 0, y, W, 1, cx - cx * s, y, W * s, 1); }
    // 3) 金光 + 小星点：黑底图左圆光（截图左半 x 70..440、y 150..520）亮度当 alpha，叠加在结口上方
    const gc = document.createElement('canvas'); gc.width = 380; gc.height = 380; const gg = gc.getContext('2d', { willReadFrequently: true }); gg.drawImage(G, 70, 150, 380, 380, 0, 0, 380, 380);
    const gd = gg.getImageData(0, 0, 380, 380), q = gd.data; for (let i = 0; i < q.length; i += 4) { const m = Math.max(q[i], q[i + 1], q[i + 2]); if (m > 0) { q[i] = Math.min(255, q[i] * 255 / m); q[i + 1] = Math.min(255, q[i + 1] * 255 / m); q[i + 2] = Math.min(255, q[i + 2] * 255 / m); } q[i + 3] = Math.round(Math.max(0, Math.min(1, (m - 20) / 235)) * 255); } gg.putImageData(gd, 0, 0);
    const gsz = bw * .52; g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = .12; g.drawImage(gc, cx - gsz / 2, y0 + bh * .2 - gsz / 2, gsz, gsz); g.restore();
    // 对比图：原 / 鼓起 / 来回切换叠差（左 原，中 鼓起，右 两者半透明叠在一起看对齐）
    const cmp = document.createElement('canvas'); cmp.width = W * 3 + 40; cmp.height = H + 20; const cp = cmp.getContext('2d'); cp.fillStyle = '#2a2420'; cp.fillRect(0, 0, cmp.width, cmp.height); cp.drawImage(B, 10, 10); cp.drawImage(out, W + 20, 10); cp.drawImage(B, 2 * W + 30, 10); cp.globalAlpha = .5; cp.drawImage(out, 2 * W + 30, 10);
    return { png: out.toDataURL('image/png'), cmp: cmp.toDataURL('image/png'), dim: [W, H, x0, y0, x1, y1] };
  }, [rd('public/assets/bag/bundle.webp', 'webp'), rd(R + 'bundle_coins_gemini_1_screenshot.jpg', 'jpeg'), rd(R + 'bundle_glow_gemini_1_screenshot.jpg', 'jpeg')]);
  fs.writeFileSync(O + 'bundle_full.png', Buffer.from(r.png.split(',')[1], 'base64')); fs.writeFileSync('assets/review/coins/bundle_compare.png', Buffer.from(r.cmp.split(',')[1], 'base64')); console.log(JSON.stringify(r.dim));
} finally { await b.close(); }
