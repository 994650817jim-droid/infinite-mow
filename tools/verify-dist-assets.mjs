// 发布包素材核对：对着「瘦身 + 无损 WebP 转换后」的 dist 构建（开发模式构建 + 换上压缩后的 assets，才有 __game 可驱动），
// 逐章进场（12 章 + 3 座大城）、刷出首领、再开武将谱 / 天下地图，记录所有 4xx / 请求失败 / 页面报错 / 图片解码失败。
// 用法：BASE=http://127.0.0.1:5292/ node tools/verify-dist-assets.mjs [--chapters 1,2,…]
import { chromium } from 'playwright';
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const base = process.env.BASE ?? 'http://127.0.0.1:5292/';
const CH = { 1: ['GameScene', { chapter: 'huangjin', stage: 1 }], 2: ['GameScene', { chapter: 'hulao', westStage: 1 }], 3: ['ThirdGameScene', 'thirdStage'], 4: ['GuanduGameScene', 'guanduStage'], 5: ['ChibiGameScene', 'chibiStage'], 6: ['JingnanGameScene', 'jingnanStage'], 7: ['ShuGameScene', 'shuStage'], 8: ['HanzhongGameScene', 'hanzhongStage'], 9: ['XiangfanGameScene', 'xiangfanStage'], 10: ['YilingGameScene', 'yilingStage'], 11: ['NanzhengGameScene', 'nanzhengStage'], 12: ['BeifaGameScene', 'beifaStage'], 101: ['SiegeGameScene', { siege: 'luoyang' }], 102: ['SiegeGameScene', { siege: 'chengdu' }], 103: ['SiegeGameScene', { siege: 'ye' }] };
const chapters = arg('chapters', Object.keys(CH).join(',')).split(',').map(Number);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const bad = new Map(), errs = [];
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) bad.set(r.url().replace(base, ''), r.status()); });
p.on('requestfailed', r => { if (!/favicon/.test(r.url())) bad.set(r.url().replace(base, ''), 'FAILED ' + (r.failure()?.errorText ?? '')); });
p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errs.push('console ' + m.text().slice(0, 160)); });
await p.addInitScript(() => { localStorage.clear(); localStorage.setItem('im_story', 'off'); localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 4, heroes: { zhaoyun: { level: 20, xp: 0, attributes: { strength: 0, agility: 0, intellect: 0, command: 0 } } } })); });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop&story=off`, { timeout: 180000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__IM, null, { timeout: 180000, polling: 500 }); await p.waitForTimeout(1500);
const summary = [];
for (const n of chapters) {
  const [key, cfg] = CH[n]; const before = bad.size;
  try {
    await p.evaluate(([key, cfg]) => { const g = window.__game, s0 = g.scene.getScene('GameScene'); s0.registry.remove('campaignTransfer'); s0.registry.remove('thirdTransfer');
      let run = { character: 'zhaoyun' }; if (typeof cfg === 'string') { g.registry.set(cfg, 1); run = { ...run, thirdStage: 1 }; } else if (cfg.siege) g.registry.set('siegeCity', cfg.siege); else run = { ...run, ...cfg };
      g.registry.set('runConfig', run); for (const sc of g.scene.getScenes(true)) if (sc.scene.key !== key) sc.scene.stop(); g.scene.start(key); }, [key, cfg]);
    await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player; }, key, { timeout: 120000, polling: 500 }); await p.waitForTimeout(1500);
    await p.evaluate(k => { const s = window.__game.scene.getScene(k); s.__DEV_ACTIONS?.closePopup?.(); window.__IM?.god?.(); s.spawnTimer = s.eliteTimer = 1e9; try { s.spawnBoss?.(); } catch { /* 部分场景首领走剧情触发 */ } }, key);
    await p.waitForTimeout(3500);
    summary.push(`${n} ${key}: 新增失败请求 ${bad.size - before}`);
  } catch (e) { summary.push(`${n} ${key}: 进场失败 ${String(e).slice(0, 100)}`); }
}
console.log(summary.join('\n')); console.log('失败 / 4xx 请求共', bad.size); for (const [u, s] of [...bad].slice(0, 40)) console.log('  ', s, u);
console.log('页面报错', errs.length, errs.slice(0, 5)); await b.close(); process.exitCode = bad.size ? 1 : 0;
