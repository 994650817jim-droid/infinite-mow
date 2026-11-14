// 发布包瘦身回归：在开发服务器上走主要入口，收集所有实际请求的 assets/ 路径，确认每个都存在于 dist。
// 用法：先 npm run build，开发服务器运行在 5173，再 node tools/test-release-prune.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const routes = [
  '?layout=mobile', '?layout=desktop',
  '?dev=1&autostart=1&layout=mobile', '?dev=1&autostart=1&stage=3',
  '?dev=1&layout=desktop&chapter=hulao&autostart=1', '?dev=1&stage=3&autostart=1&chapter=hulao',
  '?dev=1&encounter=sishui&autostart=1', '?dev=1&encounter=xingyang&autostart=1',
  '?dev=1&thirdStage=1&layout=mobile', '?dev=1&thirdStage=2&layout=mobile', '?dev=1&thirdStage=3&layout=desktop',
];
const requested = new Set(), failed = [], errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const r of routes) {
    const mobile = !r.includes('desktop');
    const p = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
    p.on('pageerror', (e) => errors.push(r + ' ' + e.message));
    p.on('requestfinished', async (q) => { const u = new URL(q.url()); if (u.pathname.startsWith('/assets/')) { requested.add(decodeURIComponent(u.pathname.slice(1))); const s = (await q.response())?.status(); if (s && s >= 400) failed.push(s + ' ' + u.pathname); } });
    p.on('requestfailed', (q) => failed.push('ERR ' + q.url()));
    await p.goto(base + r);
    await p.waitForTimeout(9000);
    await p.close();
  }
} finally { await browser.close(); }
const missing = [...requested].filter((f) => !existsSync(join('dist', f)) && !f.endsWith('.ts') && !f.includes('/@'));
console.log(`入口 ${routes.length}，请求素材 ${requested.size}，dist 缺失 ${missing.length}，请求失败 ${failed.length}，pageerror ${errors.length}`);
for (const x of [...missing, ...failed, ...errors]) console.log('  ' + x);
process.exit(missing.length || failed.length || errors.length ? 1 : 0);
