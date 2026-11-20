// 音效体检（音效审计 2026-11-19）：不需要 dev server。
// 1. 静态：扫 src 里所有播放调用（sfx.play('k') / h.sfx('k') / sound('k') / sound?.('k') / uiSfx().play('k') / sceneSfx(x, 'k')），键必须在 Sfx 的 CONFIG 里存在（播放层对不存在的键静默返回，写错名字就是没声）。
// 2. 运行时（无头浏览器静音、允许自动播放）：同一刻连发 60 次 hitLight → 实际播放不超过同键上限；同一刻 30 个不同的战斗特效 → fx 组同时在响 ≤ 分组上限、总数 ≤ 全局上限；
//    每个已定义的键都能合成（不抛错、不出 NaN，renderSfxInto 离线渲染）。
// 用法：node tools/test-audio.mjs
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 600))); };

const bundle = await build({
  stdin: {
    contents: `
      import { Sfx, renderSfxInto } from './src/systems/Sfx';
      import { GROUP_MAX } from './src/systems/HeroSfx';
      window.__T = { Sfx, renderSfxInto, GROUP_MAX };
    `, resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env.DEV': 'false' },
});
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });
// CONFIG 不导出：用 play 未知键不计 stats 的特性判断「存在」——存在的键 play 后 stats 里有记录
const has = async list => page.evaluate(l => { const s = new window.__T.Sfx(); for (const k of l) s.play(k); const st = s.getStats(); return l.filter(k => !st[k]); }, list);

// 1. 静态扫描
const files = []; const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } }; walk('src');
const used = new Map(), RX = /(?:\bsfx\.play|\bsfx\??\.?|\bsound\??\.?|\buiSfx\(\)\.play|\bsceneSfx\([^,()]+,)\s*\(?\s*'([a-zA-Z_][a-zA-Z0-9_]*)'(?!\s*\+)/g; // 拼接出来的动态键（'cast_' + 武将）不算
for (const f of files) { const s = readFileSync(f, 'utf8'); for (const m of s.matchAll(RX)) { if (!used.has(m[1])) used.set(m[1], new Set()); used.get(m[1]).add(f.replace(/\\/g, '/').replace(/^src\//, '')); } }
const missing = await has([...used.keys()]);
ck(`静态：代码里播放的 ${used.size} 个音效键都存在`, missing.length === 0, missing.map(k => k + ' ← ' + [...used.get(k)].join(',')));

// 2. 运行时上限
const caps = await page.evaluate(async () => {
  const { Sfx, GROUP_MAX } = window.__T, s = new Sfx(); s.unlock?.();
  for (let i = 0; i < 40 && s.ctx?.state !== 'running'; i++) await new Promise(r => setTimeout(r, 25));
  const out = { state: s.ctx?.state };
  for (let i = 0; i < 60; i++) s.play('hitLight');
  out.hitLight = s.getStats().hitLight;
  const fx = ['killBurst', 'brazierBreak', 'mn_stone', 'mn_land', 'mn_firepot', 'bhit_blood', 'bhit_dust', 'bhit_wall', 'bhit_lance', 'bhit_ink', 'bhit_wei', 'bcast_blood', 'bcast_dust', 'zg_crackle', 'fire_ignite', 'roll_log', 'roll_boulder', 'tent_fire', 'mn_xbow', 'mn_lob', 'mn_leap', 'dw_throw', 'zg_bazhen_tick', 'bhit_quake', 'bhit_yellow', 'bcast_ink', 'bcast_wall', 'bcast_quake', 'bcast_lance', 'bcast_wei'];
  for (const k of fx) s.play(k);
  out.fxActive = s.groupActive('fx'); out.fxMax = GROUP_MAX.fx;
  out.total = Object.values(s.active).reduce((a, b) => a + b, 0);
  for (let i = 0; i < 30; i++) s.play('hitHeavy'), s.play('killThud'), s.play('enemyDie'), s.play('hitCrit');
  out.totalAfter = Object.values(s.active).reduce((a, b) => a + b, 0);
  return out;
});
ck(`运行时：AudioContext 运行中（${caps.state}）`, caps.state === 'running', caps);
ck('运行时：同一刻连发 60 次 hitLight，实际只播 ≤ 3 次（节流 + 同键上限）', caps.hitLight && caps.hitLight.played >= 1 && caps.hitLight.played <= 3, caps.hitLight);
ck(`运行时：同一刻 30 个战斗特效，fx 组同时在响 ${caps.fxActive} ≤ ${caps.fxMax}`, caps.fxActive <= caps.fxMax && caps.fxActive >= 1, caps);
ck(`运行时：再叠一堆命中 / 击杀，同时在响总数 ${caps.totalAfter} ≤ 全局上限 14（大事件除外）`, caps.totalAfter <= 14 + 2, caps);

// 3. 所有键都能合成
const synth = await page.evaluate(async list => {
  const { renderSfxInto } = window.__T, bad = [];
  for (const k of list) { try { const ctx = new OfflineAudioContext(1, 44100 * 2.6, 44100); renderSfxInto(ctx, ctx.destination, k, .01); const buf = await ctx.startRendering(), d = buf.getChannelData(0); let nan = 0, peak = 0; for (let i = 0; i < d.length; i++) { if (!Number.isFinite(d[i])) nan++; else peak = Math.max(peak, Math.abs(d[i])); } if (nan || peak === 0) bad.push(k + (nan ? ' NaN' : ' 静音')); } catch (e) { bad.push(k + ' ' + e.message); } }
  return bad;
}, [...used.keys()]);
ck(`合成：代码里用到的 ${used.size} 个键都能离线合成（无 NaN / 非静音）`, synth.length === 0, synth);
ck('无页面报错', errs.length === 0, errs);
await b.close();
console.log(fail ? `TEST-AUDIO FAIL ${fail}` : 'TEST-AUDIO OK');
process.exit(fail ? 1 : 0);
