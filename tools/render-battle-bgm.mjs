// 战斗 BGM 离线渲染（宣传片配乐用，2026-11-18）：EpicBgm 战斗主题按游戏同样的十六分音符步进排程，OfflineAudioContext 渲染成 WAV。
// 用法：node tools/render-battle-bgm.mjs [输出 wav] [主题 key，默认 hulao] [秒数，默认 42]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const outFile = process.argv[2] || 'screenshots/battle_bgm.wav', THEME = process.argv[3] || 'hulao', SECS = Number(process.argv[4] || 42);
mkdirSync(dirname(outFile), { recursive: true });
const bundle = await build({
  stdin: {
    contents: `
      import { EpicBgm, BATTLE_THEMES } from './src/systems/EpicBgm';
      function wav(buf) {
        const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
        const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
        data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
        const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let o = 44;
        for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
        return new Uint8Array(data.buffer);
      }
      window.__render = async (key, secs) => {
        const sr = 44100, ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr), out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
        const e = new EpicBgm(ctx, out); e.setBattleTheme(key); const sd = 60 / BATTLE_THEMES[key].bpm / 4;
        for (let step = 0, t = .05; t < secs - .1; step++, t += sd) e.battleStep(step, t, sd, false);
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
writeFileSync(outFile, Buffer.from(await page.evaluate(([k, n]) => window.__render(k, n), [THEME, SECS]), 'base64'));
await browser.close();
console.log('WAV ->', outFile);
