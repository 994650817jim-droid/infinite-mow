// 首领骑乘图一键拼装：骑行 4×4 原图 + 马上出招 4×4 原图 + 坠马 2×2 原图 → public/assets/ride-v2/boss_<id>_ride.png（4×9，1024×2304，每格 256，脚底 240）。
// 用法：node tools/build-boss-ride.mjs <id> <top.png|jpg> <bottom.png|jpg> <fall.png|jpg> [FIG=104]
//   坠马 2×2 每格直接缩到 256 排成一行；拼接 + 抠洋红 / 定高调用 tools/artv2-stack.mjs 与 tools/prepare-artv2.mjs。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
const [id, top, bottom, fall, fig = '104'] = process.argv.slice(2);
if (!id || !top || !bottom || !fall) { console.error('用法：node tools/build-boss-ride.mjs <id> <top> <bottom> <fall> [FIG=104]'); process.exit(2); }
const work = join(tmpdir(), 'boss-ride-' + id); mkdirSync(work, { recursive: true });
const mime = f => ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(f).toLowerCase()] ?? 'image/png');
const b = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const p = await b.newPage();
  const data = await p.evaluate(async url => {
    const im = new Image(); im.src = url; await im.decode();
    const C = im.width / 2, c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 1024, 256); g.imageSmoothingQuality = 'high';
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy], i) => g.drawImage(im, cx * C, cy * C, C, C, i * 256, 0, 256, 256));
    return c.toDataURL('image/png');
  }, `data:${mime(fall)};base64,` + readFileSync(fall).toString('base64'));
  writeFileSync(join(work, 'fallrow.png'), Buffer.from(data.split(',')[1], 'base64'));
} finally { await b.close(); }
const src = `public/assets/ride-v2/originals/boss_${id}_ride_src.png`;
execFileSync('node', ['tools/artv2-stack.mjs', src, top, bottom, join(work, 'fallrow.png')], { stdio: 'inherit' });
execFileSync('node', ['tools/prepare-artv2.mjs'], { stdio: 'inherit', env: { ...process.env, SRC: src, OUT: `public/assets/ride-v2/boss_${id}_ride.png`, ROWS: '9', CELL: '256', FOOT: '240', FIG: fig, REF: '0,1,2,3', FIT: '1', KEYHARD: '140', KEYSOFT: '100' } });
