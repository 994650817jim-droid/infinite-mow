// Steam 宣传片剪辑（2026-11-18）：读 marketing-trailer-record.mjs 录的分段与 segments.json，ffmpeg 交叉淡化拼接，
// 书法字幕（游戏标题字 IMWarTitle，在浏览器里渲染成透明 PNG）叠在下三分之一，配乐 = 开场曲开头 → 战斗 BGM（tools/render-battle-bgm.mjs 离线渲染《关东烽火》）→ 开场曲高潮接标题。
// 用法：BASE=http://127.0.0.1:5180/ RAW=<录屏目录> node tools/marketing-trailer-edit.mjs   输出 marketing/steam/trailer/
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', RAW = resolve(process.env.RAW ?? 'marketing/steam/trailer/raw'), OUT = resolve('marketing/steam/trailer');
mkdirSync(OUT, { recursive: true }); mkdirSync(join(RAW, 'cap'), { recursive: true });
const meta = JSON.parse(readFileSync(join(RAW, 'segments.json'), 'utf8'));
const XF = .4; // 交叉淡化秒数
/** 剪辑单：段名、从录像正片起点往后跳过几秒、用几秒、字幕（一段一句，少）。 */
const CUTS = [
  { seg: 'opening', skip: 0, dur: 5.2 },
  { seg: 'mow', skip: .8, dur: 6, cap: '千军万马 · 一骑当千' },
  { seg: 'lubu', skip: .5, dur: 6.4, cap: '名将如云 · 各怀绝技' },
  { seg: 'dual', skip: .3, dur: 3.8 },
  { seg: 'surrender', skip: .6, dur: 3.6, cap: '劝降 · 斩杀 · 由你定夺' },
  { seg: 'siege', skip: .4, dur: 4.4, cap: '攻城拔寨' },
  { seg: 'map', skip: .6, dur: 5.4, cap: '一城一池 · 尽归版图' },
  { seg: 'camp', skip: .3, dur: 3.6 },
  { seg: 'title', skip: 0, dur: 7.2 },
];
// —— 字幕 PNG：游戏书法字 + 墨色描边，透明底 ——
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const fontUrl = 'data:font/woff2;base64,' + readFileSync('public/assets/fonts/war-title.woff2').toString('base64');
await p.setContent(`<html><head><style>@font-face{font-family:IMWarTitle;src:url('${fontUrl}') format('woff2');}html,body{margin:0;background:transparent;width:1920px;height:1080px;}#c{position:absolute;left:0;right:0;bottom:150px;text-align:center;font-family:IMWarTitle,serif;font-size:84px;letter-spacing:18px;color:#f6ead0;text-shadow:0 0 18px rgba(10,6,2,.95),0 0 6px rgba(10,6,2,.95),0 3px 0 #2a1a0c;}</style></head><body><div id="c"></div></body></html>`);
await p.evaluate(() => document.fonts.load('84px IMWarTitle'));
for (const [i, c] of CUTS.entries()) if (c.cap) { await p.evaluate(t => { document.getElementById('c').textContent = t; }, c.cap); await p.waitForTimeout(100); await p.screenshot({ path: join(RAW, 'cap', `cap${i}.png`), omitBackground: true }); }
await b.close();
// —— 视频：每段裁切、统一 30fps，再链式 xfade；字幕按段叠加、淡入淡出 ——
const args = ['-y'];
for (const c of CUTS) args.push('-ss', String(meta[c.seg].start + c.skip), '-t', String(c.dur), '-i', join(RAW, c.seg + '.webm'));
const capIdx = {}; for (const [i, c] of CUTS.entries()) if (c.cap) { capIdx[i] = CUTS.length + Object.keys(capIdx).length; args.push('-loop', '1', '-t', String(c.dur), '-i', join(RAW, 'cap', `cap${i}.png`)); }
const audioOpen = resolve('public/assets/audio/opening_theme.mp3'), audioBgm = join(RAW, 'battle-bgm.wav');
const aOpen = CUTS.length + Object.keys(capIdx).length; args.push('-i', audioOpen); const aBgm = aOpen + 1; args.push('-i', audioBgm); const aOpen2 = aBgm + 1; args.push('-ss', '12.6', '-i', audioOpen);
const f = [];
CUTS.forEach((c, i) => {
  let v = `[${i}:v]fps=30,scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v${i}a]`;
  if (c.cap) v += `;[${capIdx[i]}:v]format=rgba,fade=t=in:st=.25:d=.45:alpha=1,fade=t=out:st=${(c.dur - .7).toFixed(2)}:d=.45:alpha=1,setpts=PTS-STARTPTS[c${i}];[v${i}a][c${i}]overlay=0:0:shortest=1,format=yuv420p[v${i}]`;
  else v += `;[v${i}a]null[v${i}]`;
  f.push(v);
});
let last = 'v0', t = CUTS[0].dur; const starts = [0];
for (let i = 1; i < CUTS.length; i++) { const off = t - XF; starts.push(off); f.push(`[${last}][v${i}]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}[x${i}]`); last = `x${i}`; t = off + CUTS[i].dur; }
const total = t;
f.push(`[${last}]fade=t=in:st=0:d=.6,fade=t=out:st=${(total - 1).toFixed(2)}:d=1[vout]`);
// —— 音频：开场曲 0→开场段结束（淡出），战斗 BGM 接到标题段前，开场曲 12.6s 起（刹停 → 刀光重击 → 余音）对上标题段 ——
const titleStart = starts[CUTS.length - 1], openEnd = CUTS[0].dur;
const bgmLen = titleStart - openEnd + 2 * XF + 1.2;
f.push(`[${aOpen}:a]atrim=0:${(openEnd + .6).toFixed(2)},afade=t=out:st=${(openEnd - .3).toFixed(2)}:d=.9,asetpts=PTS-STARTPTS,volume=1.0[a0]`);
f.push(`[${aBgm}:a]atrim=2:${(2 + bgmLen).toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=.8,afade=t=out:st=${(bgmLen - 1.4).toFixed(2)}:d=1.4,loudnorm=I=-18:TP=-2,adelay=${Math.round((openEnd - .5) * 1000)}|${Math.round((openEnd - .5) * 1000)}[a1]`);
f.push(`[${aOpen2}:a]atrim=0:${CUTS[CUTS.length - 1].dur.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=out:st=${(CUTS[CUTS.length - 1].dur - 1.2).toFixed(2)}:d=1.2,adelay=${Math.round(titleStart * 1000)}|${Math.round(titleStart * 1000)}[a2]`);
f.push(`[a0][a1][a2]amix=inputs=3:normalize=0:duration=longest,atrim=0:${total.toFixed(2)},alimiter=limit=.9[aout]`);
args.push('-filter_complex', f.join(';').replace(/([=:])\.(\d)/g, '$10.$2'), /* ffmpeg 不认 .25 这种写法 */ '-map', '[vout]', '-map', '[aout]', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', join(OUT, 'trailer-1080p30.mp4'));
writeFileSync(join(RAW, 'ffmpeg-args.json'), JSON.stringify(args, null, 1));
execFileSync('ffmpeg', ['-v', 'error', ...args], { stdio: 'inherit' });
console.log('trailer', join(OUT, 'trailer-1080p30.mp4'), 'duration', total.toFixed(2), 's');
