// 战役回顾 · 乱世编年：按存档进度锁定/解锁，页签切换，前往选关跳转。需要开发服务器 5173。
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const checks = [], errors = [];
const ck = (n, ok, info = '') => { checks.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (info !== '' ? ' · ' + JSON.stringify(info) : '')); };
const mk = (y, d, w) => ({ version: 5, yellowStages: y, dongzhuoStages: d, warlordStages: w, worldAvailable: d >= 3, cleared: { huangjin: y >= 3, hulao: d >= 3 }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['huangjin'] });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const open = async (save, layout) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 } }); p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(sv => { localStorage.clear(); if (sv) localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene')); await p.waitForTimeout(500);
  await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-review').emit('pointerdown'));
  return p;
};
const states = p => p.evaluate(() => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'), body = c.list.find(o => o.type === 'Container'); return [0, 1, 2].map(i => body.getByName('chronicle-card-' + i).getData('state')); });
const tab = (p, i) => p.evaluate(i => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'); c.list.find(o => o.type === 'Container').getByName('chronicle-tab-' + i).emit('pointerdown'); }, i);
try {
  for (const layout of ['mobile', 'desktop']) {
    let p = await open(null, layout);
    ck(layout + ' 入口始终可见并打开编年', await p.evaluate(() => !!window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle')));
    ck(layout + ' 新存档：1-1待出征，其余锁定', JSON.stringify(await states(p)) === JSON.stringify(['next', 'locked', 'locked']), await states(p));
    await tab(p, 2); ck(layout + ' 新存档：第三章全锁', JSON.stringify(await states(p)) === JSON.stringify(['locked', 'locked', 'locked']));
    const disabled = await p.evaluate(() => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'); return !c.list.find(o => o.type === 'Container').getByName('chronicle-select'); });
    ck(layout + ' 已移除“前往选关”', disabled);
    await p.close();
    p = await open(mk(3, 1, 0), layout);
    ck(layout + ' 进度中：默认停在第二章', JSON.stringify(await states(p)) === JSON.stringify(['cleared', 'next', 'locked']), await states(p));
    await tab(p, 0); ck(layout + ' 第一章全部已平定', JSON.stringify(await states(p)) === JSON.stringify(['cleared', 'cleared', 'cleared']));
    ck(layout + ' 进行中也没有“前往选关”', await p.evaluate(() => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'); return !c.list.find(o => o.type === 'Container').getByName('chronicle-select'); }));
    await p.close();
    p = await open(mk(3, 3, 3), layout);
    // 第三章全通后第四章（官渡）开放，默认停在第四章；切回第三章检查
    ck(layout + ' 全通关后默认停在第四章（4-1 待出征）', JSON.stringify(await states(p)) === JSON.stringify(['next', 'locked', 'locked']), await states(p));
    await tab(p, 2); ck(layout + ' 全通关：第三章全部已平定', JSON.stringify(await states(p)) === JSON.stringify(['cleared', 'cleared', 'cleared']));
    await p.evaluate(() => { const c = window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle'); c.list.find(o => o.type === 'Container').getByName('chronicle-close').emit('pointerdown'); });
    ck(layout + ' 返回首页关闭编年', await p.evaluate(() => !window.__game.scene.getScene('MenuScene').children.getByName('campaign-chronicle')));
    await p.close();
  }
  ck('无 pageerror', errors.length === 0, errors.slice(0, 3));
} finally { await b.close(); }
console.log(`${checks.filter(Boolean).length}/${checks.length} 通过`); process.exit(checks.every(Boolean) ? 0 : 1);
