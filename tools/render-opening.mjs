// 开场动画曲离线渲染（不需要 dev server；无头浏览器静音）。
// 用法：node tools/render-opening.mjs [输出 wav，默认 screenshots/opening/opening_theme.wav]
// 输出 20.5 秒立体声 WAV（18 秒起线性淡出），再由 ffmpeg 转 ogg / mp3（见 tools/render-opening.sh 说明 / 报告）。
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const outFile = process.argv[2] || 'screenshots/opening/opening_theme.wav';
mkdirSync(dirname(outFile), { recursive: true });
const bundle = await build({
  stdin: {
    contents: `
      import { EpicBgm } from './src/systems/EpicBgm';
      function wav(buf) {
        const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
        const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
        data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
        const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
        for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
        return new Uint8Array(data.buffer);
      }
      window.__render = async () => {
        const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(20.5 * sr), sr), fade = ctx.createGain();
        fade.gain.setValueAtTime(1, 0); fade.gain.setValueAtTime(1, 18); fade.gain.linearRampToValueAtTime(0, 20.4); fade.connect(ctx.destination);
        new EpicBgm(ctx, fade).openingTheme(0);
        const buf = await ctx.startRendering(), bytes = wav(buf); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
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
writeFileSync(outFile, Buffer.from(await page.evaluate(() => window.__render()), 'base64'));
await browser.close();
console.log('WAV ->', outFile);
