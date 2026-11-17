// 手绘特效序列帧整理（ChatGPT 洋红底 → 透明横排序列帧）。用于 public/assets/skill-fx/（规格见该目录 ASSET_REQUEST.md）。
// 去底用“颜色转透明”（以 #FF00FF 为键色反解出不透明度与原色），发光边缘、半透明拖尾都能保留，不会留洋红毛边。
// 步骤：颜色转透明 → 按 COLS 等分取每帧 → 每帧取以格中心为中心的正方形（边长 = 格宽，CY 可指定纵向中心比例）→ 缩到 CELL → 横排输出。
// 用法：SRC=public/assets/skill-fx/originals/walk_fx_drag_wave.png OUT=public/assets/skill-fx/drag_wave.png COLS=6 CELL=256 node tools/prepare-fx.mjs
// 可选：UNMIX=.8（碎片 + 尘雾：按“不偏洋红、不偏绿”的暖色约束反解不透明度，实心碎片保持原色、尘雾保留半透明）、OPAQUE=1（不透明像素画道具：硬抠洋红、保留原色，不做颜色转透明）、ROWS（多行网格，默认 1；道具图集用 ROWS=4）、SMOKE=.62（最亮通道低于此值的像素按烟处理成暖灰）、RAMP=gold|ember|silver|dust（按亮度统一上色：白金 / 橙红火星 / 月白）、WARM=1（暖色特效去绿紫偏色）、CY（正方形中心在图高的比例，默认 .5）、SIZE（正方形边长占格宽比例，默认 1）、FLOOR（不透明度低于此值清零，默认 .03）、NOISE（背景噪点容差，默认 .1）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const { SRC, OUT } = process.env;
if (!SRC || !OUT) { console.error('需要 SRC 和 OUT'); process.exit(2); }
const RAMPS = { gold: [[0, 200, 110, 50], [.45, 245, 180, 110], [.75, 255, 228, 180], [1, 255, 252, 244]], ember: [[0, 170, 40, 20], [.4, 235, 90, 30], [.7, 255, 160, 60], [1, 255, 236, 190]], silver: [[0, 130, 125, 160], [.5, 205, 200, 228], [1, 252, 252, 255]], dust: [[0, 92, 70, 50], [.45, 168, 138, 104], [.8, 214, 190, 152], [1, 238, 224, 196]] };
const RAMP = RAMPS[process.env.RAMP ?? ''] ?? null;
const OPAQUE = process.env.OPAQUE === '1', ROWS = +(process.env.ROWS ?? 1), SMOKE = process.env.SMOKE ? +process.env.SMOKE : 0, WARM = process.env.WARM === '1', COLS = +(process.env.COLS ?? 6), CELL = +(process.env.CELL ?? 256), CY = +(process.env.CY ?? .5), SIZE = +(process.env.SIZE ?? 1), FLOOR = +(process.env.FLOOR ?? .03), NOISE = +(process.env.NOISE ?? .1), UNMIX = process.env.UNMIX ? +process.env.UNMIX : 0;
const b = await chromium.launch({ channel: 'chrome', headless: true }), p = await b.newPage();
const res = await p.evaluate(async ([src, COLS, CELL, CY, SIZE, FLOOR, WARM, NOISE, RAMP, SMOKE, ROWS, OPAQUE, UNMIX]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, W, H), d = id.data;
  // 键色取实际背景（四角 24×24 的中位色），ChatGPT 的“洋红”常偏暗偏灰，按纯 #FF00FF 反解会让发光边偏绿
  const samp = [[0, 0], [W - 24, 0], [0, H - 24], [W - 24, H - 24]].flatMap(([x0, y0]) => { const out = []; for (let y = y0; y < y0 + 24; y += 3) for (let x = x0; x < x0 + 24; x += 3) { const i = (y * W + x) * 4; out.push([d[i], d[i + 1], d[i + 2]]); } return out; });
  const med = k => samp.map(v => v[k]).sort((a, b) => a - b)[samp.length >> 1], K = [med(0), med(1), med(2)];
  if (UNMIX) for (let i = 0; i < d.length; i += 4) { // UNMIX=w（半透明暖色：火焰外缘、尘雾）：按“还原色不偏洋红（蓝 ≤ w×绿）且不偏绿（红 ≥ 绿）”反解每个像素的不透明度与原色。
      const PR=d[i],PG=d[i+1],PB=d[i+2],[KR,KG,KB]=K,w=UNMIX;
      let a=Math.min((w*(PG-KG)+(KB-PB))/(KB-w*KG),1);
      a=Math.max(a,((PG-KG)+(KR-PR))/(KR-KG),(KR-PR)/KR,(PG-KG)/(255-KG),(KB-PB)/KB,0);
      if(a>.9)a=1; if(a<FLOOR){d[i+3]=0;continue;}
      d[i]=Math.max(0,Math.min(255,KR+(PR-KR)/a));d[i+1]=Math.max(0,Math.min(255,KG+(PG-KG)/a));d[i+2]=Math.max(0,Math.min(255,KB+(PB-KB)/a));d[i+3]=Math.round(a*255); }
  else if (OPAQUE) for (let i = 0; i < d.length; i += 4) {
    // 不透明像素画（道具）：按 min(R,B)−G 硬抠洋红，只在 KEYSOFT～KEYHARD 之间半透明，并去掉边缘的洋红溢色；不改原色
    const k = Math.min(d[i], d[i + 2]) - d[i + 1];
    if (k >= 110) { d[i + 3] = 0; continue; }
    if (k > 40) { d[i + 3] = Math.round(255 * (1 - (k - 40) / 70)); const sp = k * .85; d[i] = Math.max(0, d[i] - sp); d[i + 2] = Math.max(0, d[i + 2] - sp); }
  }
  else for (let i = 0; i < d.length; i += 4) {
    // GIMP 式颜色转透明：每通道离键色的相对距离取最大即不透明度
    // 每通道离键色的距离按该通道的可用范围归一（键色接近 255 的通道按 0–255 全程算，避免 1–3 级噪点被放大成整块不透明）
    let a = 0; for (let k = 0; k < 3; k++) { const v = d[i + k], key = K[k]; const ak = Math.abs(v - key) / (key > 127 ? key : 255 - key || 1); if (ak > a) a = ak; }
    // 背景有噪点：低于 NOISE 的不透明度当背景，其余按比例拉回 0–1
    a = (a - NOISE) / (1 - NOISE);
    if (a < FLOOR) { d[i + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - K[k]) / a + K[k]));
    // WARM=1（暖色特效：白 / 金 / 橙红）：绿不超过红、蓝不超过绿，去掉反解残留的绿 / 紫偏色
    if (WARM) { if (d[i + 1] > d[i]) d[i + 1] = d[i]; if (d[i + 2] > d[i + 1]) d[i + 2] = d[i + 1]; }
    // SMOKE=<亮度阈值>：暗部（烟）改成同亮度的暖灰，避免洋红反解后烟发紫 / 发绿；亮的火焰不动
    if (SMOKE) { const l = (d[i] * .3 + d[i + 1] * .5 + d[i + 2] * .2) / 255, mx = Math.max(d[i], d[i + 1], d[i + 2]) / 255; if (mx < SMOKE || ((d[i + 1] > d[i] + 6 || d[i + 2] > d[i] + 6) && l < .72)) { const v = Math.min(200, l * 255); d[i] = v * 1.06; d[i + 1] = v; d[i + 2] = v * .92; } }
    // RAMP：按亮度重新上色（保留明暗与透明度），统一到指定色带，避免洋红污染后的偏色
    if (RAMP) { const l = (d[i] * .3 + d[i + 1] * .5 + d[i + 2] * .2) / 255; let j = 0; while (j < RAMP.length - 2 && l > RAMP[j + 1][0]) j++; const [l0, c0] = [RAMP[j][0], RAMP[j].slice(1)], [l1, c1] = [RAMP[j + 1][0], RAMP[j + 1].slice(1)], t = Math.max(0, Math.min(1, (l - l0) / (l1 - l0 || 1))); for (let k = 0; k < 3; k++) d[i + k] = c0[k] + (c1[k] - c0[k]) * t; }
    d[i + 3] = Math.round(a * 255);
  }
  g.putImageData(id, 0, 0);
  const cw = W / COLS, ch = H / ROWS, side = cw * SIZE, out = document.createElement('canvas'); out.width = CELL * COLS; out.height = CELL * ROWS; const o = out.getContext('2d'); o.imageSmoothingQuality = 'high';
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) { const sx = i * cw + (cw - side) / 2, sy = ROWS > 1 ? r * ch + (ch - side) / 2 : H * CY - side / 2; o.drawImage(c, sx, sy, side, side, i * CELL, r * CELL, CELL, CELL); }
  // 每帧是否碰到格边（内容越格的提示）
  const od = o.getImageData(0, 0, out.width, CELL).data, edge = []; // 只检查第一行
  for (let i = 0; i < COLS; i++) { let hit = 0; for (let y = 0; y < CELL; y++) for (const x of [i * CELL, i * CELL + CELL - 1]) if (od[(y * out.width + x) * 4 + 3] > 40) hit++; for (let x = i * CELL; x < i * CELL + CELL; x++) for (const y of [0, CELL - 1]) if (od[(y * out.width + x) * 4 + 3] > 40) hit++; edge.push(hit); }
  return { url: out.toDataURL('image/png'), size: [W, H], edge, key: K };
}, [readFileSync(SRC).toString('base64'), COLS, CELL, CY, SIZE, FLOOR, WARM, NOISE, RAMP, SMOKE, ROWS, OPAQUE, UNMIX]);
writeFileSync(OUT, Buffer.from(res.url.split(',')[1], 'base64'));
console.log(`${OUT}  源图 ${res.size.join('×')}  键色 ${res.key.join(',')} → ${COLS}×${CELL}  碰到格边的像素数 ${res.edge.join(' ')}`);
await b.close();
