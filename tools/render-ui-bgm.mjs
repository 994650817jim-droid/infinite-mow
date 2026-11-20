// 界面曲各情绪离线渲染成 WAV（试听用；不需要 dev server，无头浏览器静音）。
// 用法：node tools/render-ui-bgm.mjs [输出目录] [秒数]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const outDir = process.argv[2] || 'screenshots/ui-bgm', SECS = Number(process.argv[3] || 40);
mkdirSync(outDir, { recursive: true });
const bundle = await build({ stdin: { contents: `
  import { Music, MENU_MOODS } from './src/systems/Music';
  function wav(buf) { const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2)); const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const cs = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, cs[c][i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
    const b = new Uint8Array(data.buffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }
  window.__moods = [...MENU_MOODS];
  window.__render = async (m, secs) => { const mu = new Music('menu'); mu.setMood(m, true); return wav(await mu.renderOffline(secs, null)); };
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env.DEV': 'false' } });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage(); await p.setContent('<html><body></body></html>'); await p.addScriptTag({ content: bundle.outputFiles[0].text });
for (const m of await p.evaluate(() => window.__moods)) { writeFileSync(join(outDir, `ui-bgm-${m}.wav`), Buffer.from(await p.evaluate(([m, s]) => window.__render(m, s), [m, SECS]), 'base64')); console.log('WAV', m); }
await b.close();
