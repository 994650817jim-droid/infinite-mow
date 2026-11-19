// 4×4 方向 × 动作图集前后对比 GIF（上排旧图、下排新图，同步循环 4 帧，4 列 = 下 / 左 / 右 / 上）。需要 ffmpeg 和开发服务器（取图用）。
// 用法：BASE=http://127.0.0.1:5260/ OLD=assets/bosses-v2/originals/xxx_old.png NEW=assets/bosses-v2/xxx.png NAME=zhangliang-attack node tools/record-sheet-compare-gif.mjs → assets/review/boss-ride/<NAME>-compare.gif
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
const E = process.env, BASE = E.BASE ?? 'http://127.0.0.1:5173/', OLD = E.OLD, NEW = E.NEW, NAME = E.NAME ?? 'sheet', OUT = 'assets/review/boss-ride', vid = `${OUT}/video-${NAME}`, FF = E.FFMPEG ?? 'ffmpeg', FPS = +(E.FPS ?? 4);
mkdirSync(vid, { recursive: true }); rmSync(vid, { recursive: true, force: true }); mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1152, height: 640 }, recordVideo: { dir: vid, size: { width: 1152, height: 640 } } }), p = await ctx.newPage();
await p.setContent(`<body style="margin:0;background:#8a6b43"><canvas id=c width=1152 height=640></canvas></body>`);
await p.evaluate(async ([base, old, nw, fps]) => {
  const load = u => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = base + u.replace(/^public\//, ''); });
  const [a, c2] = await Promise.all([load(old), load(nw)]), cv = document.getElementById('c'), g = cv.getContext('2d'); let t0 = performance.now();
  const draw = () => { const f = Math.floor((performance.now() - t0) / (1000 / fps)) % 4; g.fillStyle = '#8a6b43'; g.fillRect(0, 0, 1152, 640);
    [[a, 0], [c2, 320]].forEach(([img, y]) => { for (let r = 0; r < 4; r++) g.drawImage(img, f * 288, r * 288, 288, 288, r * 288, y, 288, 288); });
    g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.fillText('旧（上）  下 / 左 / 右 / 上', 8, 22); g.fillStyle = '#ffd'; g.fillText('新（下）', 8, 342); requestAnimationFrame(draw); };
  draw();
}, [BASE, OLD, NEW, FPS]);
await p.waitForTimeout(4000); await ctx.close(); await b.close();
const f = readdirSync(vid).find(n => n.endsWith('.webm'));
execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', '0.6', '-t', '3.2', '-i', `${vid}/${f}`, '-vf', 'fps=12,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${OUT}/${NAME}-compare.gif`]);
rmSync(vid, { recursive: true, force: true }); console.log('gif', `${OUT}/${NAME}-compare.gif`);
