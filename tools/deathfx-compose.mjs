// 把四段录像（现状 / A / B / C）按页面里的洋红标记对齐，合成 2×2 对比 MP4 + GIF（需要 ffmpeg）。
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
const FF = process.env.FFMPEG ?? 'ffmpeg', dir = 'assets/review/deathfx', FONT = process.env.FONT ?? '.build-tmp/msyh.ttc' /* 相对路径，避免盘符冒号；先把微软雅黑复制到这里 */;
const LABEL = { base: '现状（直接消失）', a: 'A 闪白 + 倾倒淡出', b: 'B A + 脚下尘土', c: 'C 压扁薄片（精英加墨晕）' };
// 找标记出现的时刻：左上 14×14 洋红块（G 通道很低、R/B 很高）
function markers(file) {
  const r = spawnSync(FF, ['-v', 'error', '-i', file, '-vf', 'crop=12:12:0:0,signalstats,metadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 });
  const out = [], lines = r.stdout.split('\n'); let t = 0, ok = false, prev = false;
  for (const l of lines) { const m = l.match(/pts_time:([\d.]+)/); if (m) t = +m[1]; const u = l.match(/lavfi.signalstats.VAVG=([\d.]+)/); if (u) { ok = +u[1] > 170; if (ok && !prev) out.push(t); prev = ok; } }
  return out;
}
const cuts = {};
for (const m of Object.keys(LABEL)) { const mk = markers(`${dir}/clip-${m}.webm`); cuts[m] = mk; console.log(m, 'markers', mk); }
const inputs = [], fc = []; let i = 0;
for (const m of Object.keys(LABEL)) {
  const t1 = cuts[m][0] + .12, start = Math.max(0, t1 - .7); // 标记后 120ms 开始清屏；片段从清屏前 0.7 秒起
  inputs.push('-ss', start.toFixed(2), '-t', '5.0', '-i', `${dir}/clip-${m}.webm`);
  fc.push(`[${i}:v]fps=30,crop=640:360:580:140,drawbox=0:0:640:34:black@0.55:t=fill,drawtext=fontfile='${FONT}':text='${LABEL[m]}':fontcolor=white:fontsize=22:x=10:y=5[v${i}]`); i++;
}
fc.push('[v0][v1]hstack[top];[v2][v3]hstack[bot];[top][bot]vstack[out]');
execFileSync(FF, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc.join(';'), '-map', '[out]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${dir}/deathfx-compare.mp4`]);
execFileSync(FF, ['-y', '-loglevel', 'error', '-i', `${dir}/deathfx-compare.mp4`, '-vf', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${dir}/deathfx-compare.gif`]);
console.log('done');
