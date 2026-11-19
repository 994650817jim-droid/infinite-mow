// 背景不是纯洋红（AI 画成渐变 / 灰色光晕）时的预处理：从图四边与每个格子的边缘出发，沿「相邻像素颜色相近」的区域洪水填充，填成纯洋红 #FF00FF，
// 碰到人物的深色描边（亮度明显低于背景）就停。输出 PNG，再交给 prepare-artv2.mjs。
// 用法：SRC=…/artv2_xxx_attack.png OUT=…/artv2_xxx_attack_flat.png [COLS=4 ROWS=4] [GREY=1 把低饱和灰色块（被围住的背景）也填掉] [STEP=9 邻像素色差阈值] [DARK=60 比背景暗这么多算描边] node tools/flood-magenta.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const E = process.env, { SRC, OUT } = E;
if (!SRC || !OUT) { console.error('需要 SRC / OUT'); process.exit(2); }
const COLS = +(E.COLS ?? 4), ROWS = +(E.ROWS ?? 4), STEP = +(E.STEP ?? 9), DARK = +(E.DARK ?? 60), SEED = +(E.SEED ?? 6), GREY = E.GREY === '1', GREYMIN = +(E.GREYMIN ?? 400);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const url = await p.evaluate(async ([data, COLS, ROWS, STEP, DARK, SEED, GREY, GREYMIN]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    const lum = i => d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
    const seen = new Uint8Array(W * H), stack = [];
    // 种子：整图边缘 + 每个格子的边缘一圈（格间洋红带若有则也成为种子）
    const cw = W / COLS, ch = H / ROWS;
    const push = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const k = y * W + x; if (!seen[k]) { seen[k] = 1; stack.push(k); } };
    for (let c = 0; c <= COLS; c++) for (let y = 0; y < H; y++) for (let t = -SEED; t <= SEED; t++) push(Math.min(W - 1, Math.max(0, Math.round(c * cw) + t)), y);
    for (let r = 0; r <= ROWS; r++) for (let x = 0; x < W; x++) for (let t = -SEED; t <= SEED; t++) push(x, Math.min(H - 1, Math.max(0, Math.round(r * ch) + t)));
    // 种子本身若是深色（描边）不填
    const bgLum = []; for (const k of stack) bgLum.push(lum(k * 4));
    bgLum.sort((a, b) => a - b); const base = bgLum[Math.floor(bgLum.length * .5)] ?? 128;
    const filled = new Uint8Array(W * H);
    const q = []; for (const k of stack) if (lum(k * 4) > base - DARK) { filled[k] = 1; q.push(k); }
    while (q.length) {
      const k = q.pop(), x = k % W, y = (k / W) | 0, i = k * 4;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (filled[nk]) continue; const j = nk * 4;
        const diff = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
        if (diff <= STEP && lum(j) > base - DARK - 30) { filled[nk] = 1; q.push(nk); }
      }
    }
    if (GREY) { // 被围住的背景（弓与身体之间、马腿之间）：低饱和 + 局部平滑（人物有纹理，背景光晕是平滑渐变）的连通块，面积够大才填
      const cand = new Uint8Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x, i = k * 4; if (filled[k]) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), L = lum(i); if (mx - mn > 60 || L < 90 || L > 245) continue;
        let sm = 0; for (const o of [4, -4, W * 4, -W * 4]) sm += Math.abs(d[i] - d[i + o]) + Math.abs(d[i + 1] - d[i + 1 + o]) + Math.abs(d[i + 2] - d[i + 2 + o]); if (sm <= 18) cand[k] = 1; }
      const lab = new Uint8Array(W * H);
      for (let k0 = 0; k0 < W * H; k0++) { if (!cand[k0] || lab[k0]) continue; const comp = [k0]; lab[k0] = 1; for (let n = 0; n < comp.length; n++) { const k = comp[n], x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (cand[nk] && !lab[nk]) { lab[nk] = 1; comp.push(nk); } } } if (comp.length >= GREYMIN) for (const k of comp) filled[k] = 1; }
    }
    for (let k = 0; k < W * H; k++) if (filled[k]) { const i = k * 4; d[i] = 255; d[i + 1] = 0; d[i + 2] = 255; }
    g.putImageData(img, 0, 0); return cv.toDataURL('image/png');
  }, ['data:image/' + (SRC.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + readFileSync(SRC).toString('base64'), COLS, ROWS, STEP, DARK, SEED, GREY, GREYMIN]);
  writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64')); console.log('ok', OUT);
} finally { await b.close(); }
