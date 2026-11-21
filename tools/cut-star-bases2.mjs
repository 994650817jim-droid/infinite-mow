// 星图节点底座 v2（玉璧 / 铜钱 / 印章框，2026-11-21）：ChatGPT 绿底 3 列(暗/可点/已点亮) × 4 行(入口/小星/要星/主星) 的已去绿 PNG
//  → 切 12 张，同一行三态同缩放同中心；再「预染色」出 5 套（neutral 中性 + strength 朱砂 + agility 青 + intellect 紫 + command 赭金）：
//  只重染中心深色凹槽（点亮 = 较深的朱砂 / 青 / 紫 / 赭金，不发白；可点 = 凹槽略带区色；未到 = 近黑），金色笔触边框保持原样，所以不会出现霓虹。
// 输出 public/assets/star-map/nodes/<set>/<kind>_<state>.png（2× 图；1× 显示直径：入口 44 / 小星 20 / 要星 44 / 主星 64）+ nodes/sockets.json（凹槽圆心半径，供代码放图标）。
// 用法：SRC=public/assets/star-map/originals/bases2_keyed.png node tools/cut-star-bases2.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const SRC = process.env.SRC, OUT = 'public/assets/star-map/nodes/', rd = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const KINDS = [['gate', 88], ['small', 40], ['notable', 88], ['keystone', 128]], STATES = ['off', 'ready', 'on'];
const CY = [200, 530, 855, 1215], HALF = [170, 125, 175, 190], CX = [180, 540, 905];
const SETS = { neutral: { on: [58, 46, 34], ready: [40, 32, 24], off: [22, 18, 15] }, strength: { on: [112, 34, 24], ready: [66, 30, 22], off: [26, 17, 15] }, agility: { on: [18, 80, 72], ready: [24, 54, 48], off: [17, 24, 22] }, intellect: { on: [68, 46, 116], ready: [48, 36, 76], off: [22, 19, 30] }, command: { on: [102, 74, 22], ready: [70, 52, 22], off: [26, 21, 14] } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const r = await p.evaluate(async ([src, KINDS, STATES, CY, HALF, CX, SETS]) => {
    const im = new Image(); im.src = src; await im.decode(); const files = {}, sock = {};
    for (let ri = 0; ri < 4; ri++) {
      const [kind, D] = KINDS[ri], H = HALF[ri], C = Math.round(D * 1.45 / 2) * 2;
      const crop = ci => { const c = document.createElement('canvas'); c.width = H * 2; c.height = H * 2; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, CX[ci] - H, CY[ri] - H, H * 2, H * 2, 0, 0, H * 2, H * 2); return { c, g }; };
      const d0 = crop(0).g.getImageData(0, 0, H * 2, H * 2).data; let x0 = 1e9, x1 = 0, y0 = 1e9, y1 = 0; for (let y = 0; y < H * 2; y++) for (let x = 0; x < H * 2; x++) if (d0[(y * H * 2 + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = D / Math.max(bw, bh), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // 凹槽：从圆心向外找「亮度 < 60」的连续范围，取四方向平均半径
      const lum = (x, y) => { const i = (Math.round(y) * H * 2 + Math.round(x)) * 4; return (d0[i] + d0[i + 1] + d0[i + 2]) / 3; }; let rs = []; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7], [.7, -.7], [-.7, .7]]) { let r = 0; while (r < H && lum(cx + dx * r, cy + dy * r) < 62 && d0[(Math.round(cy + dy * r) * H * 2 + Math.round(cx + dx * r)) * 4 + 3] > 128) r++; rs.push(r); } const rIn = rs.reduce((a, v) => a + v, 0) / rs.length; sock[kind] = { canvas: C, diameter: D, socketRadius: +(rIn * s).toFixed(1) };
      for (let ci = 0; ci < 3; ci++) {
        const cc = crop(ci).c; const o = document.createElement('canvas'); o.width = C; o.height = C; const og = o.getContext('2d', { willReadFrequently: true }); og.imageSmoothingQuality = 'high'; og.drawImage(cc, 0, 0, H * 2, H * 2, C / 2 - cx * s, C / 2 - cy * s, H * 2 * s, H * 2 * s);
        const base = og.getImageData(0, 0, C, C);
        for (const [setName, cols] of Object.entries(SETS)) {
          const col = cols[STATES[ci]], img = new ImageData(new Uint8ClampedArray(base.data), C, C), d = img.data, R = rIn * s * 0.96, ctr = C / 2;
          for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const dx = x - ctr, dy = y - ctr, dd = Math.sqrt(dx * dx + dy * dy); if (dd > R) continue; const i = (y * C + x) * 4; if (d[i + 3] < 128) continue; const l = (d[i] + d[i + 1] + d[i + 2]) / 3 / 255, k = Math.max(.55, Math.min(1.1, .9 + (l - .13) * 4)), edge = Math.max(0, Math.min(1, (R - dd) / 3)), vig = 1.05 - .4 * (dd / R) ** 2; for (let q = 0; q < 3; q++) d[i + q] = Math.max(0, Math.min(255, d[i + q] * (1 - edge) + col[q] * k * vig * edge)); }
          const oc = document.createElement('canvas'); oc.width = C; oc.height = C; oc.getContext('2d').putImageData(img, 0, 0); (files[setName] ??= {})[`${kind}_${STATES[ci]}.png`] = oc.toDataURL('image/png');
        }
      }
    }
    return { files, sock };
  }, [rd(SRC), KINDS, STATES, CY, HALF, CX, SETS]);
  for (const [setName, fs2] of Object.entries(r.files)) { fs.mkdirSync(OUT + setName, { recursive: true }); for (const [f, u] of Object.entries(fs2)) fs.writeFileSync(OUT + setName + '/' + f, Buffer.from(u.split(',')[1], 'base64')); }
  fs.writeFileSync(OUT + 'sockets.json', JSON.stringify(r.sock, null, 1)); console.log(JSON.stringify(r.sock));
} finally { await b.close(); }
