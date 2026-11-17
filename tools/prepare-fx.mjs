// 手绘特效序列帧整理（ChatGPT 洋红底 → 透明横排序列帧）。用于 public/assets/skill-fx/（规格见该目录 ASSET_REQUEST.md）。
// 去底用“颜色转透明”（以 #FF00FF 为键色反解出不透明度与原色），发光边缘、半透明拖尾都能保留，不会留洋红毛边。
// 步骤：颜色转透明 → 按 COLS 等分取每帧 → 每帧取以格中心为中心的正方形（边长 = 格宽，CY 可指定纵向中心比例）→ 缩到 CELL → 横排输出。
// 用法：SRC=public/assets/skill-fx/originals/walk_fx_drag_wave.png OUT=public/assets/skill-fx/drag_wave.png COLS=6 CELL=256 node tools/prepare-fx.mjs
// 可选：RAMP=gold|ember|silver（按亮度统一上色：白金 / 橙红火星 / 月白）、WARM=1（暖色特效去绿紫偏色）、CY（正方形中心在图高的比例，默认 .5）、SIZE（正方形边长占格宽比例，默认 1）、FLOOR（不透明度低于此值清零，默认 .03）、NOISE（背景噪点容差，默认 .1）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC, OUT } = process.env;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const RAMPS = { gold: [[0, 200, 110, 50], [.45, 245, 180, 110], [.75, 255, 228, 180], [1, 255, 252, 244]], ember: [[0, 170, 40, 20], [.4, 235, 90, 30], [.7, 255, 160, 60], [1, 255, 236, 190]], silver: [[0, 130, 125, 160], [.5, 205, 200, 228], [1, 252, 252, 255]] };
const RAMP = RAMPS[process.env.RAMP ?? ''] ?? null;
const WARM = process.env.WARM === '1', COLS = +(process.env.COLS ?? 6), CELL = +(process.env.CELL ?? 256), CY = +(process.env.CY ?? .5), SIZE = +(process.env.SIZE ?? 1), FLOOR = +(process.env.FLOOR ?? .03), NOISE = +(process.env.NOISE ?? .1);
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, COLS, CELL, CY, SIZE, FLOOR, WARM, NOISE, RAMP]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  // 键色取实际背景（四角 24×24 的中位色），ChatGPT 的“洋红”常偏暗偏灰，按纯 #FF00FF 反解会让发光边偏绿
  const samp = [[0, 0], [W - 24, 0], [0, H - 24], [W - 24, H - 24]].flatMap(([x0, y0]) => { const out = []; for (let y = y0; y < y0 + 24; y += 3) for (let x = x0; x < x0 + 24; x += 3) { const i = (y * W + x) * 4; out.push([d[i], d[i + 1], d[i + 2]]); } return out; });
  const med = k => samp.map(v => v[k]).sort((a, b) => a - b)[samp.length >> 1], K = [med(0), med(1), med(2)];
  for (let i = 0; i < d.length; i += 4) {
    // GIMP 式颜色转透明：每通道离键色的相对距离取最大即不透明度
    // 每通道离键色的距离按该通道的可用范围归一（键色接近 255 的通道按 0–255 全程算，避免 1–3 级噪点被放大成整块不透明）
    let a = 0; for (let k = 0; k < 3; k++) { const v = d[i + k], key = K[k]; const ak = Math.abs(v - key) / (key > 127 ? key : 255 - key || 1); if (ak > a) a = ak; }
    // 背景有噪点：低于 NOISE 的不透明度当背景，其余按比例拉回 0–1
    a = (a - NOISE) / (1 - NOISE);
    if (a < FLOOR) { d[i + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - K[k]) / a + K[k]));
    // WARM=1（暖色特效：白 / 金 / 橙红）：绿不超过红、蓝不超过绿，去掉反解残留的绿 / 紫偏色
    if (WARM) { if (d[i + 1] > d[i]) d[i + 1] = d[i]; if (d[i + 2] > d[i + 1]) d[i + 2] = d[i + 1]; }
    // RAMP：按亮度重新上色（保留明暗与透明度），统一到指定色带，避免洋红污染后的偏色
    if (RAMP) { const l = (d[i] * .3 + d[i + 1] * .5 + d[i + 2] * .2) / 255; let j = 0; while (j < RAMP.length - 2 && l > RAMP[j + 1][0]) j++; const [l0, c0] = [RAMP[j][0], RAMP[j].slice(1)], [l1, c1] = [RAMP[j + 1][0], RAMP[j + 1].slice(1)], t = Math.max(0, Math.min(1, (l - l0) / (l1 - l0 || 1))); for (let k = 0; k < 3; k++) d[i + k] = c0[k] + (c1[k] - c0[k]) * t; }
    d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(id, 0, 0);
  const cw = W / COLS, side = cw * SIZE, out = document.createElement('canvas'); out.width = CELL * COLS; out.height = CELL; const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
  for (let i = 0; i < COLS; i++) { const sx = i * cw + (cw - side) / 2, sy = H * CY - side / 2; o.drawImage(c, sx, sy, side, side, i * CELL, 0, CELL, CELL); }
  // 每帧是否碰到格边（内容越格的提示）
  const od = o.getImageData(0, 0, out.width, CELL).data, edge = [];
  for (let i = 0; i < COLS; i++) { let hit = 0; for (let y = 0; y < CELL; y++) for (const x of [i * CELL, i * CELL + CELL - 1]) if (od[(y * out.width + x) * 4 + 3] > 40) hit++; for (let x = i * CELL; x < i * CELL + CELL; x++) for (const y of [0, CELL - 1]) if (od[(y * out.width + x) * 4 + 3] > 40) hit++; edge.push(hit); }
  return { url: out.toDataURL('image/png'), size: [W, H], edge, key: K };
}, [readFileSync(SRC).toString('base64'), COLS, CELL, CY, SIZE, FLOOR, WARM, NOISE, RAMP]);
writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`${OUT}  源图 ${res.size.join('×')}  键色 ${res.key.join(',')} → ${COLS}×${CELL}  碰到格边的像素数 ${res.edge.join(' ')}`);
await b.close();
