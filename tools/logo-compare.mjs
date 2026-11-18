// 应用 logo 方案对比图：每个图标一行（512 大图 + 256 / 64 / 32 / 16 缩小，分别放在深色和浅色底上），下面依次放标题字方案。
// 用法：node tools/logo-compare.mjs <out.png> --icon 标签=图.png ... --mark 标签=图.png ...
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2), out = argv.shift(), icons = [], marks = [];
for (let i = 0; i < argv.length; i++) { const [lab, f] = argv[i + 1].split('='); (argv[i] === '--icon' ? icons : marks).push({ lab, url: 'data:image/png;base64,' + readFileSync(f).toString('base64') }); i++; }
const font = 'data:font/woff2;base64,' + readFileSync('public/assets/fonts/war-heading.woff2').toString('base64');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async ({ icons, marks, font }) => {
    const ff = new FontFace('H', `url(${font})`); await ff.load(); document.fonts.add(ff);
    const load = async u => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const W = 1800, rowH = 600, markH = 520, H = 80 + icons.length * rowH + marks.length * markH;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#efe6d4'; g.fillRect(0, 0, W, H); g.fillStyle = '#2a211a'; g.font = '40px H'; g.fillText('三国：乱世千军 · logo 方案（水墨风）', 40, 56);
    let y = 80;
    for (const ic of icons) {
      const im = await load(ic.url); g.fillStyle = '#2a211a'; g.font = '32px H'; g.fillText(ic.lab, 40, y + 44);
      g.drawImage(im, 40, y + 64, 512, 512);
      const sizes = [256, 64, 32, 16]; let x = 600;
      for (const [bgc, oy] of [['#15110e', y + 64], ['#ffffff', y + 64 + 280]]) {
        let xx = x; g.fillStyle = bgc; g.fillRect(x - 12, oy - 12, 256 + 64 + 32 + 16 + 4 * 28 + 12, 256 + 24);
        for (const s of sizes) { g.imageSmoothingQuality = 'high'; g.drawImage(im, xx, oy + (256 - s) / 2, s, s); xx += s + 28; }
      }
      g.fillStyle = '#5a4a3a'; g.font = '22px H'; g.fillText('右侧：256 / 64 / 32 / 16', 1040, y + 110); g.fillText('上排深色底、下排白底', 1040, y + 140);
      y += rowH;
    }
    for (const mk of marks) {
      const im = await load(mk.url); g.fillStyle = '#2a211a'; g.font = '32px H'; g.fillText(mk.lab, 40, y + 44);
      const s = Math.min((W - 80) / im.width, (markH - 80) / im.height); g.drawImage(im, 40, y + 64, im.width * s, im.height * s); y += markH;
    }
    return c.toDataURL('image/png');
  }, { icons, marks, font });
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64')); console.log(out, icons.length, '图标', marks.length, '标题字');
} finally { await b.close(); }
