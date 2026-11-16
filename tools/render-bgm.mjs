// 离线渲染 BGM 试听样品 + 基本检查（不需要 dev server，无头浏览器不出声）。
// 用法：node tools/render-bgm.mjs [输出目录] [时长倍数，默认 1 = 完整一轮]
//   输出：old/new 两版的黄巾战斗曲、张角 / 吕布首领曲 WAV，以及响度统计。
// 检查：每段非静音、无 NaN、峰值不超过 0 dBFS、新版与旧版响度相差不超过 ±4 dB（音量设置照常生效的前提）。
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] || 'screenshots/bgm';
const SCALE = Number(process.argv[3] || 1);
const ONLY = process.argv[4] || ''; // 'v2' / 'old'：只渲染一版（调音时用），跳过响度对比
mkdirSync(outDir, { recursive: true });

const bundle = await build({
  stdin: {
    contents: `
      import { Music } from './src/systems/Music';
      import { bossProfile } from './src/data/bossMusic';
      function wav(buf) {
        const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
        const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
        data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
        const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
        for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
        return new Uint8Array(data.buffer);
      }
      function stats(buf) {
        let sum = 0, peak = 0, nan = 0, n = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan++; continue; } sum += v * v; n++; const a = Math.abs(v); if (a > peak) peak = a; } }
        const rms = Math.sqrt(sum / Math.max(1, n));
        return { rmsDb: +(20 * Math.log10(rms + 1e-9)).toFixed(1), peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1), nan };
      }
      window.__renderBgm = async (version, boss, seconds, bossAt) => {
        const m = new Music('battle', version);
        const buf = await m.renderOffline(seconds, boss ? bossProfile(boss) : null, bossAt);
        const bytes = wav(buf); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { b64: btoa(s), stats: stats(buf) };
      };
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env.DEV': 'false' },
});

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const jobs = [
  ['old', null, 'battle-huangjin', 80], ['v2', null, 'battle-huangjin', 80],
  ['old', '张角', 'boss-zhangjiao', 90], ['v2', '张角', 'boss-zhangjiao', 90],
  ['old', '吕布', 'boss-lubu', 70], ['v2', '吕布', 'boss-lubu', 70],
];
const results = []; let fail = 0;
for (const [ver, boss, name, secs] of jobs.filter(j => !ONLY || j[0] === ONLY)) {
  const r = await page.evaluate(([v, b, s]) => window.__renderBgm(v, b, s, 0), [ver, boss, secs * SCALE]);
  const file = join(outDir, `${ver === 'v2' ? 'new' : 'old'}-${name}.wav`);
  writeFileSync(file, Buffer.from(r.b64, 'base64'));
  results.push({ ver, name, ...r.stats });
  const ok = r.stats.nan === 0 && r.stats.rmsDb > -40 && r.stats.peakDb <= 0;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${ver} ${name} :: ${JSON.stringify(r.stats)} -> ${file}`);
}
for (const name of ONLY ? [] : ['battle-huangjin', 'boss-zhangjiao', 'boss-lubu']) {
  const o = results.find(r => r.ver === 'old' && r.name === name), n = results.find(r => r.ver === 'v2' && r.name === name);
  const diff = +(n.rmsDb - o.rmsDb).toFixed(1), ok = Math.abs(diff) <= 4;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} loudness_match ${name} :: new-old ${diff} dB`);
}
await browser.close();
console.log(fail ? `RENDER-BGM FAIL ${fail}` : 'RENDER-BGM OK');
process.exit(fail ? 1 : 0);
