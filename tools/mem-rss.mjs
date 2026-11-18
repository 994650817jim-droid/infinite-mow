// 手机内存实测（iPhone 仿真 390×844、DPR 3）：每个阶段同时记录 ① 纹理估算（宽×高×4，按真实像素）② 整个浏览器进程树的实际内存（Windows 工作集 / 私有字节）及加载期间的峰值。
// 阶段：home 首页 → open 开场 → b11 进 1-1 → map 天下地图 → siege 攻城。--desktop 用电脑视口对比。
// 用法：BASE=http://127.0.0.1:5187/ node tools/mem-rss.mjs <标签> [--desktop] [--lores=0|1]
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.argv[2] || 'run', DESKTOP = process.argv.includes('--desktop');
const LORES = (process.argv.find(a => a.startsWith('--lores=')) ?? '').split('=')[1];
const OUT = 'C:/Users/99465/AppData/Local/Temp/claude/86a970a7c168047d/f71de033-5dc9-48b9-8a87-973ba4b7121f/scratchpad/rss'; mkdirSync(OUT, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'imrss-'));
const ctx = await chromium.launchPersistentContext(dir, DESKTOP ? { channel: 'chrome', headless: true, viewport: { width: 1280, height: 720 }, args: ['--mute-audio'] } : {
  channel: 'chrome', headless: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, args: ['--mute-audio'],
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1' });
const key = dir.replace(/\\/g, '\\\\').replace(/\//g, '\\\\');
const ps = `$k='${dir.replace(/\\/g, '\\\\')}'; $a=Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*imrss-*" -and $_.CommandLine -like "*$([IO.Path]::GetFileName($k))*" }; $ws=($a|Measure-Object WorkingSetSize -Sum).Sum; $pv=($a|Measure-Object PrivatePageCount -Sum).Sum; $t=$a|ForEach-Object{ $ty=if($_.CommandLine -match '--type=([a-z-]+)'){$matches[1]}else{'browser'}; "$ty="+[math]::Round($_.PrivatePageCount/1MB) }; "$ws $pv "+($t -join ',')`;
const rss = () => new Promise(res => execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 15000 }, (e, so) => { const parts = String(so).trim().split(/\s+/), [w, v] = parts.map(Number); res({ ws: Math.round((w || 0) / 1048576), priv: Math.round((v || 0) / 1048576), byType: parts[2] ?? '' }); }));
let peak = { ws: 0, priv: 0 }, sampling = true;
const sampler = (async () => { while (sampling) { const r = await rss(); peak.ws = Math.max(peak.ws, r.ws); peak.priv = Math.max(peak.priv, r.priv); } })();
const p = ctx.pages()[0] ?? await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
if (process.env.BLANK) { await p.goto('about:blank'); await p.waitForTimeout(3000); const r = await rss(); console.log('blank page browser tree', JSON.stringify(r)); sampling = false; await sampler; await ctx.close(); process.exit(0); }
const rows = [];
const snap = async step => {
  await p.waitForTimeout(2500);
  const t = await p.evaluate(() => { const tm = window.__game.textures; let mb = 0, n = 0; for (const k of tm.getTextureKeys()) { const t = tm.get(k); for (const s of t.source) { const lr = s.image?.__loReal; mb += (lr ? lr[0] * lr[1] : s.width * s.height) * 4 / 1048576; } n++; } return { n, mb: +mb.toFixed(1), scenes: window.__game.scene.getScenes(true).map(s => s.scene.key).join(',') }; });
  const r = await rss(); const row = { step, tex: t.n, texMB: t.mb, rssNow: r.ws, privNow: r.priv, byType: r.byType, rssPeakSoFar: peak.ws, privPeakSoFar: peak.priv, scenes: t.scenes };
  rows.push(row); console.log(JSON.stringify(row));
};
await (async () => {})();
const q = (LORES ? `&lores=${LORES}` : '') + '&layout=' + (DESKTOP ? 'desktop' : 'mobile');
await p.goto(BASE + '?dev=1' + q);
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene') || window.__game?.scene.isActive('OpeningScene'), null, { timeout: 180000 });
await p.evaluate(() => { window.__lean = !!window.__game.registry.get('shellTextureKeys'); });
await snap('home');
await p.evaluate(() => { window.__go = (k, data) => { const g = window.__game, cur = g.scene.getScenes(true).filter(s => s.scene.key !== 'BootScene').pop(); if (cur) cur.scene.start(k, data); else g.scene.start(k, data); }; });
// 1-1
await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); if (g.registry.get('battleReady') || window.__lean) window.__go('GameScene'); else { g.registry.set('loadBattle', true); window.__go('BootScene'); } });
await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 180000 });
await snap('1-1');
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); });
await p.waitForTimeout(8000); await snap('1-1 +8s');
// 天下地图
await p.evaluate(() => window.__go('WorldMapScene'));
await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 120000 }); await snap('map');
// 攻城
await p.evaluate(() => { const g = window.__game; g.registry.set('siegeCity', 'runan'); g.registry.set('runConfig', { character: 'zhaoyun' }); if (g.registry.get('battleReady') || window.__lean) window.__go('SiegeGameScene'); else { g.registry.set('pendingWarlord', 'SiegeGameScene'); g.registry.set('loadBattle', true); window.__go('BootScene'); } });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('SiegeGameScene'); return s?.player && window.__game.scene.isActive('SiegeGameScene'); }, null, { timeout: 180000 }); await snap('siege');
sampling = false; await sampler; console.log('PEAK rss(ws)', peak.ws, 'MB  private', peak.priv, 'MB', 'errors', JSON.stringify(errs.slice(0, 3)));
writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify({ rows, peak, errs }, null, 1));
await ctx.close();
