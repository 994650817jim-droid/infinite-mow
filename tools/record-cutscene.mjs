// 录过场动画（电脑布局 1280×720）：?dev=1&cutscene=<id> 预览，从开播录到结束，输出 MP4（H.264）与 GIF。
// 用法：BASE=http://127.0.0.1:5188/ ID=lubu_kills_dongzhuo [HERO=zhangfei] node tools/record-cutscene.mjs   （需要 ffmpeg）
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', ID = process.env.ID ?? 'lubu_kills_dongzhuo', HERO = process.env.HERO ?? '';
const NAME = ID + (HERO ? '-' + HERO : ''), out = 'assets/review/cutscene', vid = `${out}/video-${NAME}`;
mkdirSync(vid, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: vid, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const S = "window.__game.scene.getScene('GameScene')";
await p.goto(base + `?dev=1&layout=desktop&cutscene=${ID}` + (HERO ? `&hero=${HERO}` : ''));
await p.waitForFunction(S0 => !!eval(S0)?.cutscene?.active, S, { timeout: 120000, polling: 50 });
const t0 = Date.now();
await p.waitForFunction(S0 => { const s = eval(S0); return !s.cutscene && s.lastCutscene; }, S, { timeout: 60000, polling: 100 });
await p.waitForTimeout(1200); // 留一点结束后的画面（董卓倒地、宝箱）
const dur = (Date.now() - t0) / 1000 + .4;
await p.close(); await ctx.close(); await b.close();
const webm = readdirSync(vid).filter(f => f.endsWith('.webm')).map(f => vid + '/' + f).pop();
const mp4 = `${out}/${NAME}.mp4`, gif = `${out}/${NAME}.gif`;
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur), '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-y', '-sseof', String(-dur), '-i', webm, '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', gif], { stdio: 'ignore' });
renameSync(webm, `${vid}/${NAME}.webm`);
console.log('MP4:', mp4, '\nGIF:', gif, '\n时长', dur.toFixed(1), '秒');
