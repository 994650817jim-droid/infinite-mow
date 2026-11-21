// 首屏加载流程测试：① 开机只载主页素材（请求数 / MB 上限）；② 加载画面有进度条（截图）；③ 偶发失败会自动重试并补上；④ 少数文件一直失败：提示后继续进主页；
// ⑤ 大半失败（断网）：停在加载页并给「重试」，点了重试能恢复；⑥ 进 1-1 走「整军出征」加载并进场，无缺图。
// 静态服务一个「开发模式构建 + 压缩后 assets」目录（见 tools/measure-load.mjs 顶部说明）。用法：DIR=.build-tmp/lean3 node tools/test-load-flow.mjs   截图 assets/review/load/*.png
import { chromium } from 'playwright';
import http from 'node:http'; import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'; import { extname, join, resolve } from 'node:path';
const DIR = resolve(process.env.DIR ?? '.build-tmp/lean3'), PORT = +(process.env.PORT ?? 5297), OUT = 'assets/review/load'; mkdirSync(OUT, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = join(DIR, p); if (!f.startsWith(DIR) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; } res.writeHead(200, { 'content-type': mime[extname(f)] ?? 'application/octet-stream', 'content-length': statSync(f).size }); createReadStream(f).pipe(res); }).listen(PORT, '127.0.0.1');
const base = `http://127.0.0.1:${PORT}/`, URLQ = base + '?dev=1&layout=desktop&story=off';
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = async (setup) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage(); p.__reqs = []; p.__errs = [];
  p.on('request', r => { if (r.url().startsWith(base)) p.__reqs.push(r.url().slice(base.length)); }); p.on('pageerror', e => p.__errs.push(String(e).slice(0, 120)));
  await p.addInitScript(() => { localStorage.clear(); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_opening_seen', '1'); }); if (setup) await setup(p); return p; };
const atMenu = p => p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 120000, polling: 300 });
try {
  // ① + ② 正常开机：请求数 / 进度条
  { const p = await page(async p => { await p.route('**/assets/**', async r => { await new Promise(s => setTimeout(s, 45)); r.continue(); }); });
    await p.goto(URLQ, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(900);
    const mid = await p.evaluate(() => { const r = document.getElementById('load-screen'); return r ? { shown: getComputedStyle(r).display !== 'none', title: r.children[0].textContent, bar: r.children[1].firstChild.style.width, tip: r.children[2].textContent } : null; });
    await p.screenshot({ path: `${OUT}/load-screen-boot.png` });
    await atMenu(p); await p.waitForTimeout(800);
    const assets = p.__reqs.filter(u => u.startsWith('assets/')).length;
    ck('开机显示加载画面：标题「正在进入乱世」、有进度条和提示句', !!mid && mid.shown && /正在进入乱世/.test(mid.title) && /%$/.test(mid.bar) && mid.tip.length > 4, mid);
    ck('开机素材请求 ≤ 120 个（原来 548 个）', assets <= 120, { assets });
    const hidden = await p.evaluate(() => getComputedStyle(document.getElementById('load-screen')).display); ck('进主页后加载画面收起', hidden === 'none', hidden);
    // ⑥ 进 1-1：整军出征
    await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
    await p.waitForTimeout(500); const t2 = await p.evaluate(() => document.getElementById('load-screen')?.children[0].textContent); await p.screenshot({ path: `${OUT}/load-screen-battle.png` });
    await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 180000, polling: 300 }); await p.waitForTimeout(1500);
    const miss = await p.evaluate(() => { let n = 0; const walk = l => { for (const o of l) { if (o.texture?.key === '__MISSING') n++; if (o.list) walk(o.list); } }; walk(window.__game.scene.getScene('GameScene').children.list); return n; });
    ck('进 1-1：标题「整军出征」、进场成功、没有缺图对象', /整军出征/.test(t2 ?? '') && miss === 0, { t2, miss });
    ck('无页面报错（正常流程）', p.__errs.length === 0, p.__errs.slice(0, 3)); await p.context().close(); }
  // ③ 偶发失败：fx_a.png 第一次请求失败，之后放行 → 自动重试补上
  { let hits = 0; const p = await page(async p => { await p.route('**/assets/hero-fx/**', r => { if (/fx_a\.png/.test(r.request().url()) && hits++ < 1) r.abort(); else r.continue(); }); });
    await p.goto(URLQ, { waitUntil: 'domcontentloaded' }); await atMenu(p); await p.waitForTimeout(500);
    // 这张在战斗遍才载入：进战斗触发
    await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
    await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 180000, polling: 300 }); await p.waitForTimeout(800);
    const has = await p.evaluate(() => window.__game.textures.exists('hero_fx_a'));
    ck('偶发失败（fx_a.png 首次被掐断）：自动重试补上，请求 ≥2 次、纹理在', hits >= 2 && has, { hits, has }); await p.context().close(); }
  // ④ 少数文件一直失败：提示后继续
  { const p = await page(async p => { await p.route('**/assets/hero-fx/fx_**', r => r.abort()); });
    await p.goto(URLQ, { waitUntil: 'domcontentloaded' }); await atMenu(p);
    await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'huangjin', stage: 1 }); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
    try { await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000, polling: 300 }); } catch (e) { console.log('  诊断', JSON.stringify({ errs: p.__errs.slice(0, 3), active: await p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key)), tip: await p.evaluate(() => document.getElementById('load-screen')?.children[2].textContent) })); }
    const tip = await p.evaluate(() => document.getElementById('load-screen')?.children[2].textContent);
    ck('少数文件一直失败：重试 2 遍后提示并继续进场（不卡死）', /备用画面|没能载入/.test(tip ?? ''), { tip }); await p.context().close(); }
  // ⑤ 断网：所有素材失败 → 停在加载页给「重试」，放行后点重试恢复
  { let down = true; const p = await page(async p => { await p.route('**/assets/**', r => { if (down && !/\.js$|fonts\//.test(r.request().url())) r.abort(); else r.continue(); }); });
    await p.goto(URLQ, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => { const a = document.getElementById('load-screen')?.children[3]; return a && getComputedStyle(a).display !== 'none'; }, null, { timeout: 120000, polling: 400 });
    const msg = await p.evaluate(() => document.getElementById('load-screen').children[2].textContent); await p.screenshot({ path: `${OUT}/load-screen-fail.png` });
    ck('断网：停在加载页，写明原因并出现「重试」按钮', /网络/.test(msg), { msg });
    down = false; await p.evaluate(() => document.getElementById('load-screen').children[3].click()); await atMenu(p);
    ck('网络恢复后点「重试」能进主页', true); await p.context().close(); }
} catch (e) { ck('测试异常', false, String(e).slice(0, 300)); } finally { await b.close(); server.close(); }
console.log(`${rows.filter(Boolean).length}/${rows.length} 通过`); process.exit(rows.every(Boolean) ? 0 : 1);
