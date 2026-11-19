// 首领台词卡设计稿用的手绘 UI 件（2026-11-19，ChatGPT 透明底出图）→ 裁成单件透明 PNG：
//   originals/strips_gpt.png（上下 3 条）→ brush.png（撕边墨带）、scroll.png（手卷）、bar.png（黑漆细条）
//   originals/frames_gpt.png（左右 3 个）→ moon.png（月洞窗框）、fan.png（扇窗框）、medal.png（圆徽框）
//   epic-home/opening/ink_bloom.png（白底黑墨 4×2 帧，UI 会话的墨迹扩散）→ inkbloom.png（透明底，墨色即不透明度，每格 256）
// 切法：按不透明像素的行 / 列投影找空隙，每件裁到自己的外接框（留 4 像素）。
// 用法：node tools/build-barkcard-ui.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const DIR = 'public/assets/ui/barkcard/';
const jobs = [
  { src: DIR + 'originals/strips_gpt.png', axis: 'y', names: ['brush', 'scroll', 'bar'] },
  { src: DIR + 'originals/frames_gpt.png', axis: 'x', names: ['moon', 'fan', 'medal'] },
].filter(j => existsSync(j.src));
const b = await chromium.launch({ channel: 'chrome', headless: true }); const p = await b.newPage();
for (const j of jobs) {
  const outs = await p.evaluate(async ([u, axis, n]) => {
    const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, L = axis === 'y' ? H : W, prof = new Float32Array(L);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 24) prof[axis === 'y' ? y : x]++;
    // 连续有内容的段；太小的（零星噪点）不算；取最大的 n 段，按位置排
    const segs = []; let s0 = -1;
    for (let i = 0; i <= L; i++) { const on = i < L && prof[i] > 2; if (on && s0 < 0) s0 = i; if (!on && s0 >= 0) { segs.push([s0, i]); s0 = -1; } }
    const big = segs.filter(([a, z]) => z - a > 12).sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, n).sort((a, b) => a[0] - b[0]);
    return big.map(([a, z]) => {
      // 段内再求另一方向的范围
      let lo = Infinity, hi = -1;
      for (let i = a; i < z; i++) for (let k = 0; k < (axis === 'y' ? W : H); k++) { const x = axis === 'y' ? k : i, y = axis === 'y' ? i : k; if (d[(y * W + x) * 4 + 3] > 24) { if (k < lo) lo = k; if (k > hi) hi = k; } }
      const pad = 4, x0 = Math.max(0, (axis === 'y' ? lo : a) - pad), y0 = Math.max(0, (axis === 'y' ? a : lo) - pad), x1 = Math.min(W, (axis === 'y' ? hi : z) + pad), y1 = Math.min(H, (axis === 'y' ? z : hi) + pad);
      const o = document.createElement('canvas'); o.width = x1 - x0; o.height = y1 - y0; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      return { url: o.toDataURL('image/png'), w: o.width, h: o.height };
    });
  }, ['data:image/png;base64,' + readFileSync(j.src).toString('base64'), j.axis, j.names.length]);
  outs.forEach((o, i) => { writeFileSync(DIR + j.names[i] + '.png', Buffer.from(o.url.split(',')[1], 'base64')); console.log('→', DIR + j.names[i] + '.png', o.w + '×' + o.h); });
}
// 墨迹扩散：白底黑墨 → 透明底墨色（不透明度 = 1 - 亮度），缩成每格 256
const ink = 'public/assets/epic-home/opening/ink_bloom.png';
if (existsSync(ink)) {
  const url = await p.evaluate(async u => {
    const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, 1024, 512);
    const id = g.getImageData(0, 0, 1024, 512), a = id.data;
    for (let i = 0; i < a.length; i += 4) { const lum = (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11); a[i + 3] = Math.round(Math.max(0, Math.min(255, (255 - lum) * 1.15))); a[i] = 18; a[i + 1] = 12; a[i + 2] = 8; }
    g.putImageData(id, 0, 0); return c.toDataURL('image/png');
  }, 'data:image/png;base64,' + readFileSync(ink).toString('base64'));
  writeFileSync(DIR + 'inkbloom.png', Buffer.from(url.split(',')[1], 'base64')); console.log('→', DIR + 'inkbloom.png', '1024×512（4×2 每格 256）');
}
await b.close();
