// 招贤馆模板头像：public/assets/recruits/originals/dsh_recruit_faces.png（ChatGPT 生成，2×2 四宫格，洋红 #FF00FF 底，原图不入库）
// 抠掉洋红底并去掉边缘的洋红溢色，按象限切出人物，等比缩放进 128×128（底边对齐 y=124），
// 输出 public/assets/recruits/recruit_faces.png（512×128，帧顺序：枪 / 刀 / 弓 / 谋）。
// 用法：node tools/prepare-recruit-faces.mjs（不需要开发服务器）
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
const SRC = process.env.SRC ?? 'public/assets/recruits/originals/dsh_recruit_faces.png', OUT = 'public/assets/recruits';
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const src = 'data:image/png;base64,' + readFileSync(SRC).toString('base64');
  const r = await p.evaluate(async src => {
    const im = new Image(); im.src = src; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const W = c.width, H = c.height, img = g.getImageData(0, 0, W, H), d = img.data;
    // 洋红：R、B 都高且 G 低。按「洋红程度」降透明度，并把残留洋红拉回中性
    let keyed = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], m = Math.min(R, B) - G;
      if (m > 120 && R > 170 && B > 170) { d[i + 3] = 0; keyed++; continue; }
      if (m > 40) { const k = Math.min(1, (m - 40) / 80); d[i + 3] = Math.round(d[i + 3] * (1 - k)); const cap = G + 40; d[i] = Math.min(R, cap); d[i + 2] = Math.min(B, cap); }
    }
    g.putImageData(img, 0, 0);
    const A = (x, y) => d[(y * W + x) * 4 + 3];
    const o = document.createElement('canvas'); o.width = 512; o.height = 128; const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    const quads = [[0, 0], [1, 0], [0, 1], [1, 1]]; // 左上 枪、右上 刀、左下 弓、右下 谋
    const boxes = quads.map(([qx, qy], i) => {
      const M = 10, x0 = Math.floor(qx * W / 2) + M, x1 = Math.floor((qx + 1) * W / 2) - 1 - M, y0 = Math.floor(qy * H / 2) + M, y1 = Math.floor((qy + 1) * H / 2) - 1 - M; // 离象限边界留 10 像素，避开邻格越线的弓梢 / 枪尖
      let bx0 = x1, bx1 = x0, by0 = y1, by1 = y0, n = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (A(x, y) > 40) { n++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
      if (n < 500) return { error: 'quadrant ' + i + ' empty' };
      const w = bx1 - bx0 + 1, h = by1 - by0 + 1, k = Math.min(122 / w, 122 / h), dw = w * k, dh = h * k;
      og.drawImage(c, bx0, by0, w, h, i * 128 + (128 - dw) / 2, 124 - dh, dw, dh);
      return { box: [bx0, by0, w, h], scale: +k.toFixed(3) };
    });
    return { url: o.toDataURL('image/png'), boxes, size: [W, H], keyed };
  }, src);
  const bad = r.boxes.find(x => x.error); if (bad) throw new Error(bad.error);
  writeFileSync(`${OUT}/recruit_faces.png`, Buffer.from(r.url.split(',')[1], 'base64'));
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ source: 'ChatGPT「生成武将头像」2026-11-16，originals/dsh_recruit_faces.png（不入库）', texture: 'recruit_faces', frameWidth: 128, frameHeight: 128, frames: ['spear', 'blade', 'bow', 'strategist'] }, null, 2) + '\n');
  console.log(JSON.stringify({ size: r.size, keyed: r.keyed, boxes: r.boxes }));
} finally { await b.close(); }
