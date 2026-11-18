// 应用图标 v2（2026-11-17 用户选定：即梦生成「武将骑马冲锋」第 4 张，原图 assets/icon-source/jimeng_rider_original.png）
// 原图是白底上的圆角金框方图：从四角泛洪把框外的白底变透明（边缘按亮度做半透明过渡），再输出
// → electron/icon.png（512）、electron/icon.ico（16–256 多尺寸 PNG 内嵌）、public/favicon.png（64）、assets/icon-source/icon_1024.png（透明底母版）
// 用法：开发服务器 5173 运行时 node tools/prepare-app-icon-v2.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'assets/icon-source/jimeng_rider_original.png', SIZES = [16, 24, 32, 48, 64, 128, 256];
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage(); await p.goto(process.env.BASE ?? 'http://127.0.0.1:5173/');
  const out = await p.evaluate(async ([src, sizes]) => {
    const im = new Image(); im.src = src; await im.decode();
    const W = im.width, H = im.height, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    // 白底判定：三通道都亮、几乎不带颜色
    const whiteness = i => { const r = d[i], gg = d[i + 1], bb = d[i + 2], mn = Math.min(r, gg, bb), mx = Math.max(r, gg, bb); return mx - mn > 28 ? 0 : mn; };
    const seen = new Uint8Array(W * H), stack = [];
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) stack.push(y * W + x);
    let cleared = 0;
    while (stack.length) {
      const p2 = stack.pop(); if (seen[p2]) continue; seen[p2] = 1;
      const i = p2 * 4, w = whiteness(i); if (w < 200) continue; // 碰到金框 / 画面就停
      // 越白越透明：255→全透明，200→保留一半（抗锯齿边）
      const a = Math.max(0, Math.min(1, (255 - w) / 55)); d[i + 3] = Math.round(d[i + 3] * a); cleared++;
      const x = p2 % W, y = (p2 / W) | 0;
      if (x > 0) stack.push(p2 - 1); if (x < W - 1) stack.push(p2 + 1); if (y > 0) stack.push(p2 - W); if (y < H - 1) stack.push(p2 + W);
    }
    g.putImageData(img, 0, 0);
    const render = n => { const c = document.createElement('canvas'); c.width = c.height = n; const cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(cv, 0, 0, W, H, 0, 0, n, n); return c.toDataURL('image/png').split(',')[1]; };
    return { size: [W, H], cleared, master: render(1024), big: render(512), fav: render(64), icons: sizes.map(n => [n, render(n)]) };
  }, ['data:image/png;base64,' + readFileSync(SRC).toString('base64'), SIZES]);
  writeFileSync('assets/icon-source/icon_1024.png', Buffer.from(out.master, 'base64'));
  writeFileSync('electron/icon.png', Buffer.from(out.big, 'base64'));
  writeFileSync('public/favicon.png', Buffer.from(out.fav, 'base64'));
  // ICO：头 6 字节 + 每项 16 字节目录 + 各尺寸 PNG 数据（Windows Vista 起支持 PNG 内嵌）
  const pngs = out.icons.map(([n, b64]) => [n, Buffer.from(b64, 'base64')]);
  const head = Buffer.alloc(6 + 16 * pngs.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([n, buf], i) => { const o = 6 + i * 16; head.writeUInt8(n >= 256 ? 0 : n, o); head.writeUInt8(n >= 256 ? 0 : n, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12); offset += buf.length; });
  writeFileSync('electron/icon.ico', Buffer.concat([head, ...pngs.map(x => x[1])]));
  console.log('原图', out.size, '去白底像素', out.cleared, '→ icon_1024 / electron/icon.png / icon.ico（' + SIZES.join('/') + '）/ public/favicon.png');
} finally { await b.close(); }
