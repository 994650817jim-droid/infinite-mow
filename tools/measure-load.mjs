// 加载量测量：到主页为止、再进某章 / 某场景各发了多少请求、下载多少字节，以及有没有 404 / 缺图（__MISSING）。
// 静态服务一个「开发模式构建 + 压缩后的 assets」目录（tools 里 scratch 脚本 / README 说明的做法：vite build --mode development --outDir .build-tmp/<名>，再换上 dist/assets），
// 用法：DIR=.build-tmp/base LABEL=before node tools/measure-load.mjs [--scenes GameScene:huangjin:1,ThirdGameScene:thirdStage:1,…] [--url-query "?dev=1&layout=desktop&story=off"]
// 输出：每个里程碑（主页 / 各场景进场）的累计与增量请求数、MB，失败请求，缺图对象数；JSON 同时写 assets/review/load/<LABEL>.json
import { chromium } from 'playwright';
import http from 'node:http'; import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'; import { extname, join, resolve } from 'node:path';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DIR = resolve(process.env.DIR ?? '.build-tmp/base'), LABEL = process.env.LABEL ?? 'run', PORT = +(process.env.PORT ?? 5296), QUERY = arg('url-query', '?dev=1&layout=desktop&story=off');
const SHELL = arg('shell', '').split(',').filter(Boolean); // 界面场景（进场后记一次里程碑 + 缺图对象数）
const SCENES = arg('scenes', 'GameScene:huangjin:1,ThirdGameScene:thirdStage:1,GuanduGameScene:guanduStage:1,ChibiGameScene:chibiStage:1,JingnanGameScene:jingnanStage:1,ShuGameScene:shuStage:1,HanzhongGameScene:hanzhongStage:1,XiangfanGameScene:xiangfanStage:1,YilingGameScene:yilingStage:1,NanzhengGameScene:nanzhengStage:1,BeifaGameScene:beifaStage:1').split(',').filter(Boolean);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = join(DIR, p); if (!f.startsWith(DIR) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; } res.writeHead(200, { 'content-type': mime[extname(f)] ?? 'application/octet-stream', 'content-length': statSync(f).size }); createReadStream(f).pipe(res); }).listen(PORT, '127.0.0.1');
const base = `http://127.0.0.1:${PORT}/`;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const out = { label: LABEL, dir: DIR, milestones: [], failed: [], errors: [] };
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  let reqs = 0, bytes = 0; const failed = new Map(); const byDir = new Map();
  p.on('response', async r => { const u = r.url(); if (!u.startsWith(base)) return; reqs++; const len = +(r.headers()['content-length'] ?? 0); bytes += len; const d = u.slice(base.length).split('/').slice(0, 3).join('/'); const o = byDir.get(d) ?? [0, 0]; o[0]++; o[1] += len; byDir.set(d, o); if (r.status() >= 400 && !/favicon/.test(u)) failed.set(u.slice(base.length), r.status()); });
  p.on('requestfailed', r => { if (!/favicon/.test(r.url())) failed.set(r.url().replace(base, ''), 'FAILED'); });
  p.on('pageerror', e => out.errors.push(String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) out.errors.push('console ' + m.text().slice(0, 160)); });
  await p.addInitScript(() => { localStorage.clear(); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_opening_seen', '1'); localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 4, heroes: { zhaoyun: { level: 20, xp: 0, attributes: { strength: 0, agility: 0, intellect: 0, command: 0 } } } })); });
  let snap = new Map(); const delta = () => { const out = []; for (const [d, [n, by]] of byDir) { const o = snap.get(d) ?? [0, 0]; if (by - o[1] > 0) out.push([d.split('/').slice(0, 2).join('/'), n - o[0], by - o[1]]); } snap = new Map([...byDir].map(([k, v]) => [k, [...v]])); const agg = new Map(); for (const [d, n, by] of out) { const a = agg.get(d) ?? [0, 0]; a[0] += n; a[1] += by; agg.set(d, a); } return [...agg].sort((a, c) => c[1][1] - a[1][1]).slice(0, +(process.env.TOPN ?? 8)).map(([d, [n, by]]) => `${(by / 1048576).toFixed(1)}MB/${n}个 ${d}`); };
  const mark = async (name, extra = {}) => { const missing = await p.evaluate(() => { const g = window.__game; let n = 0; if (!g) return -1; for (const sc of g.scene.getScenes(true)) { const walk = l => { for (const o of l) { if (o.texture?.key === '__MISSING') n++; if (o.list) walk(o.list); } }; walk(sc.children.list); } return n; });
    const prev = out.milestones.at(-1); out.milestones.push({ name, reqs, mb: +(bytes / 1048576).toFixed(1), dReqs: reqs - (prev?.reqs ?? 0), dMB: +((bytes - (prev ? prev.mb * 1048576 : 0)) / 1048576).toFixed(1), missingObjects: missing, top: delta(), ...extra }); };
  const t0 = Date.now();
  await p.goto(base + QUERY, { timeout: 240000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 240000, polling: 300 }); await p.waitForTimeout(1500);
  await mark('主页', { sec: +((Date.now() - t0) / 1000).toFixed(1) });
  for (const key of SHELL) {
    const t1 = Date.now(); await p.evaluate(k => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(k); }, key); await p.waitForTimeout(4000);
    await mark('界面 ' + key, { sec: +((Date.now() - t1) / 1000).toFixed(1) });
  }
  for (const sc of SCENES) {
    const [key, reg, st] = sc.split(':'), t1 = Date.now();
    await p.evaluate(([key, reg, st]) => { const g = window.__game; g.registry.remove('campaignTransfer'); g.registry.remove('thirdTransfer'); let run = { character: 'zhaoyun' }; if (reg === 'huangjin') run = { ...run, chapter: 'huangjin', stage: +st }; else { g.registry.set(reg, +st); run = { ...run, thirdStage: +st }; }
      g.registry.set('runConfig', run); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); }, [key, reg, st]);
    await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player; }, key, { timeout: 300000, polling: 300 }); await p.waitForTimeout(2500);
    await mark(key, { sec: +((Date.now() - t1) / 1000).toFixed(1) });
  }
  out.failed = [...failed].slice(0, 40); out.topDirs = [...byDir].sort((a, c) => c[1][1] - a[1][1]).slice(0, +(process.env.TOPN ?? 12)).map(([d, [n, by]]) => `${(by / 1048576).toFixed(1)} MB ${n} 个 ${d}`);
} finally { await b.close(); server.close(); }
console.log(JSON.stringify(out, null, 1)); mkdirSync('assets/review/load', { recursive: true }); writeFileSync(`assets/review/load/${LABEL}.json`, JSON.stringify(out, null, 1));
