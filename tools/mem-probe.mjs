// 手机内存测量（iPhone 竖屏 390×844、DPR 3 的 Chromium 仿真）：首页 → 进 1-1 → 切到第十章 10-1，
// 每个节点记录纹理张数、解码后估算显存（宽 × 高 × 4，按源图尺寸）、JS 堆，以及 30 张最大的纹理和首次出现的节点。
// 用法：BASE=http://127.0.0.1:5187/ node tools/mem-probe.mjs [输出 json 路径] [--desktop]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '', DESKTOP = process.argv.includes('--desktop');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--enable-precise-memory-info'] });
const ctx = DESKTOP ? await b.newContext({ viewport: { width: 1280, height: 720 } }) : await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
});
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
const firstSeen = {}, steps = [];
const snap = async step => {
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const g = window.__game, tm = g.textures, list = [];
    for (const key of tm.getTextureKeys()) { const t = tm.get(key); let bytes = 0, w = 0, h = 0, rt = false; for (const s of t.source) { const lr = s.image?.__loReal, sw = lr ? lr[0] : s.width, sh = lr ? lr[1] : s.height; bytes += sw * sh * 4; w = sw; h = sh; rt = rt || !!s.isRenderTexture; } list.push({ key, w, h, mb: bytes / 1048576, rt }); }
    const c = g.canvas; return { list, canvas: [c.width, c.height], scenes: g.scene.getScenes(true).map(s => s.scene.key), sounds: g.sound?.sounds?.length ?? 0, render: g.renderer.width };
  });
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  for (const t of r.list) firstSeen[t.key] ??= step;
  const total = r.list.reduce((a, t) => a + t.mb, 0), canvasMb = r.canvas[0] * r.canvas[1] * 4 / 1048576;
  const row = { step, textures: r.list.length, textureMB: +total.toFixed(1), canvas: r.canvas, canvasMB: +canvasMb.toFixed(1), jsHeapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), scenes: r.scenes, sounds: r.sounds, top: [...r.list].sort((a, c) => c.mb - a.mb).slice(0, 30).map(t => ({ ...t, mb: +t.mb.toFixed(1), from: firstSeen[t.key] })) };
  steps.push(row); console.log(`${step}: ${row.textures} textures, ${row.textureMB} MB decoded, canvas ${row.canvas.join('×')}, JS heap ${row.jsHeapMB} MB, scenes ${row.scenes.join(',')}`);
};
await p.goto(BASE + '?dev=1');
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000 });
await snap('home');
await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } });
await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 120000 });
await snap('1-1');
await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('MenuScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 120000 });
await p.evaluate(() => window.__game.scene.getScene('MenuScene').scene.start('YilingChapterScene'));
await p.waitForFunction(() => window.__game.scene.isActive('YilingChapterScene'), null, { timeout: 120000 }); await p.waitForTimeout(800);
await p.evaluate(() => { const g = window.__game; g.registry.set('yilingStage', 1); g.registry.set('runConfig', { character: 'zhaoyun', thirdStage: 1 }); g.registry.remove('yilingTransfer'); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('YilingGameScene'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('YilingGameScene'); return s?.player && s.scene.isActive(); }, null, { timeout: 120000 });
await snap('10-1');
await b.close();
console.log('errors', JSON.stringify(errs.slice(0, 3)));
for (const s of steps) { console.log(`\n== ${s.step} top 30 ==`); for (const t of s.top) console.log(`${t.mb.toString().padStart(6)} MB  ${t.w}×${t.h}  ${t.key}${t.rt ? ' (RT)' : ''}  [${t.from}]`); }
if (OUT) writeFileSync(OUT, JSON.stringify(steps, null, 1));
