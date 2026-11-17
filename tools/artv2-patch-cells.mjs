// 人物画风 v2：在原图（未处理的网格图）上用别的格子顶替画错的格子，可水平镜像。处理前用，之后照常跑 prepare-artv2。
// 用法：COLS=4 ROWS=4 node tools/artv2-patch-cells.mjs <in> <out.png> <目标格:来源格[:m]> ...
//   格号从 0 起、从左到右从上到下；:m = 镜像（例：朝左行缺盾的帧用朝右行同一帧镜像顶替）。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [src, out, ...specs] = process.argv.slice(2), COLS = +(process.env.COLS ?? 4), ROWS = +(process.env.ROWS ?? 4);
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ([url, COLS, ROWS, specs]) => {
    const im = new Image(); im.src = url; await im.decode();
    const cw = im.width / COLS, ch = im.height / ROWS, c = document.createElement('canvas');
    c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    for (const s of specs) {
      const [d, f, m] = s.split(':'), dx = (+d % COLS) * cw, dy = Math.floor(+d / COLS) * ch, sx = (+f % COLS) * cw, sy = Math.floor(+f / COLS) * ch;
      g.save(); g.clearRect(dx, dy, cw, ch);
      if (m === 'm') { g.translate(dx + cw, dy); g.scale(-1, 1); g.drawImage(im, sx, sy, cw, ch, 0, 0, cw, ch); }
      else g.drawImage(im, sx, sy, cw, ch, dx, dy, cw, ch);
      g.restore();
    }
    return c.toDataURL('image/png');
  }, ['data:image/png;base64,' + readFileSync(src).toString('base64'), COLS, ROWS, specs]);
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log(out, '已替换', specs.join(' '));
} finally { await b.close(); }
