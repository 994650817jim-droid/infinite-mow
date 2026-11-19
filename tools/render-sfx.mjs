// 出手音效离线渲染 + 检查（不需要 dev server；无头浏览器静音）。
// 用法：node tools/render-sfx.mjs [输出目录]
// 输出：每位武将一段 WAV（各出手音效依次各奏 3 次，每次随机变体 + 音高），兵种一段；打印各音效峰值 / 响度。
// 检查：每个出手音效都有配方、非静音、无 NaN、峰值 ≤ -3 dBFS（单发，留给叠加的余量）；兵种峰值低于武将平均。
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] || 'screenshots/sfx';
mkdirSync(outDir, { recursive: true });

const bundle = await build({
  stdin: {
    contents: `
      import { renderSfxInto } from './src/systems/Sfx';
      import { ATTACK_SFX_CONFIG, WEAPON_ATTACK_SFX } from './src/systems/HeroSfx';
      import { CONTENT_SFX_CONFIG } from './src/systems/ContentSfx';
      function wav(buf) {
        const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
        const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
        data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
        const d = buf.getChannelData(0); let o = 44;
        for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, d[i])); data.setInt16(o, v < 0 ? v * 32768 : v * 32767, true); o += 2; }
        let s = ''; const b = new Uint8Array(data.buffer); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s);
      }
      // 游戏里的主音量：音效 0.9 × 1.25
      const MASTER = 1.125;
      window.__keys = { all: Object.keys(ATTACK_SFX_CONFIG), weapons: WEAPON_ATTACK_SFX, content: Object.keys(CONTENT_SFX_CONFIG) };
      /** 单个音效：峰值与 RMS（dB）。 */
      window.__measure = async (kind) => {
        const ctx = new OfflineAudioContext(1, 44100 * 1.6, 44100), g = ctx.createGain(); g.gain.value = MASTER; g.connect(ctx.destination);
        const dur = renderSfxInto(ctx, g, kind, .02);
        const buf = await ctx.startRendering(), d = buf.getChannelData(0);
        let peak = 0, sum = 0, nan = 0, n = Math.max(1, Math.floor((dur + .02) * 44100));
        for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { nan++; continue; } const a = Math.abs(v); if (a > peak) peak = a; if (i < n) sum += v * v; }
        return { dur: +dur.toFixed(2), peakDb: +(20 * Math.log10(peak + 1e-9)).toFixed(1), rmsDb: +(20 * Math.log10(Math.sqrt(sum / n) + 1e-9)).toFixed(1), nan };
      };
      /** 一串音效依次各奏 times 次。 */
      window.__reel = async (kinds, times) => {
        const gap = .55, total = kinds.length * times * gap + 1.2;
        const ctx = new OfflineAudioContext(1, Math.ceil(44100 * total), 44100), g = ctx.createGain(); g.gain.value = MASTER; g.connect(ctx.destination);
        let t = .1; for (const k of kinds) { for (let i = 0; i < times; i++) { renderSfxInto(ctx, g, k, t, 1 + (Math.random() * 2 - 1) * .06); t += Math.max(gap, ((ATTACK_SFX_CONFIG[k] ?? CONTENT_SFX_CONFIG[k])?.dur ?? .3) + .25); } t += .3; }
        return wav(await ctx.startRendering());
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

let fail = 0;
const keys = await page.evaluate(() => window.__keys);
const meas = {};
for (const k of keys.all) {
  const m = await page.evaluate(kind => window.__measure(kind), k); meas[k] = m;
  const ok = m.nan === 0 && m.dur > 0 && m.rmsDb > -60 && m.peakDb <= -3;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k} :: ${JSON.stringify(m)}`);
}
// 对照：打击感与旧出手音效（只打印，不判定）
for (const k of ['hitLight', 'hitHeavy', 'hitCrit', 'killThud', 'bossHit', 'allySlash', 'allySpear', 'crossbow', 'flameBoom', 'warCry']) console.log(`REF  ${k} :: ${JSON.stringify(await page.evaluate(kind => window.__measure(kind), k))}`);
const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const heroPeak = avg(keys.all.filter(k => k.startsWith('atk_')).map(k => meas[k].peakDb)), troopPeak = avg(keys.all.filter(k => k.startsWith('troop_')).map(k => meas[k].peakDb));
const lighter = troopPeak < heroPeak - 3;
if (!lighter) fail++;
console.log(`${lighter ? 'PASS' : 'FAIL'} troops_lighter_than_heroes :: hero avg peak ${heroPeak.toFixed(1)} dB, troop avg peak ${troopPeak.toFixed(1)} dB`);

// 新内容音效（ContentSfx，2026-11-19）：同样检查非静音 / 无 NaN / 峰值 ≤ -3 dBFS；环境声（amb_）另要求比战斗特效轻
const cm = {};
for (const k of keys.content) {
  const m = await page.evaluate(kind => window.__measure(kind), k); cm[k] = m;
  const ok = m.nan === 0 && m.dur > 0 && m.rmsDb > -60 && m.peakDb <= -3;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${k} :: ${JSON.stringify(m)}`);
}
{ const fx = keys.content.filter(k => !k.startsWith('amb_')).map(k => cm[k].peakDb), amb = keys.content.filter(k => k.startsWith('amb_')).map(k => cm[k].peakDb);
  const ok = Math.max(...amb) < avg(fx) - 3; if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ambient_quieter_than_fx :: fx avg peak ${avg(fx).toFixed(1)} dB, ambient max peak ${Math.max(...amb).toFixed(1)} dB`); }
const GROUPS = { 'cast-heroes': k => k.startsWith('cast_'), 'boss-themes': k => /^b(cast|hit|burst)/.test(k), zhuge: k => k.startsWith('zg_'), dianwei: k => k.startsWith('dw_'),
  minions: k => /^(mn_|fire_ignite|ship_boom|roll_)/.test(k), events: k => /^(bridge_|tent_|lubu_|cap_|flag_|toast_)/.test(k), camp: k => /^(shop_|medic_|amb_)/.test(k) };
for (const [g, f] of Object.entries(GROUPS)) writeFileSync(join(outDir, `content-${g}.wav`), Buffer.from(await page.evaluate(([l]) => window.__reel(l, 1), [keys.content.filter(f)]), 'base64'));
const HERO = { spear_orbit: 'zhaoyun', guandao: 'guanyu', baodiao_bow: 'huangzhong', flame_banner: 'zhuge', dangyang_roar: 'zhangfei', zhanjin_lance: 'machao', zhenbei_blade: 'weiyan', shuanggu_swords: 'liubei', lianhuan_mines: 'pangtong', crossbow: 'huangyueying', sun_knives: 'sunshangxiang', diaochan_fans: 'diaochan' };
for (const [w, list] of Object.entries(keys.weapons)) writeFileSync(join(outDir, `sfx-${HERO[w]}.wav`), Buffer.from(await page.evaluate(([l]) => window.__reel(l, 3), [list]), 'base64'));
writeFileSync(join(outDir, 'sfx-troops.wav'), Buffer.from(await page.evaluate(([l]) => window.__reel(l, 3), [keys.all.filter(k => k.startsWith('troop_'))]), 'base64'));
console.log(`WAV -> ${outDir}`);
await browser.close();
console.log(fail ? `RENDER-SFX FAIL ${fail}` : 'RENDER-SFX OK');
process.exit(fail ? 1 : 0);
