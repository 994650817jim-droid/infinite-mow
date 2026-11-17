// 测试模式（?dev=1）第一批：测试存档隔离、电脑布局面板、选将、选关。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-dev-panel.mjs [tag]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5180/', tag = process.argv[2] ?? 'after', out = 'assets/review/ui-round9';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 300) : '')); };
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use: troop_portrait/.test(m.text())) errors.push(m.text()); }); };
const battle = async (p, q = '') => { await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop${q}`); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 }); await p.waitForTimeout(800); };

// ---------- 1) 测试存档隔离 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); watch(p);
  // 非测试模式写一份正式存档
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(() => { localStorage.setItem('im_world_v1', JSON.stringify({ version: 4, yellowStages: 3, dongzhuoStages: 3, worldAvailable: true, cleared: { huangjin: true, hulao: true } })); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_slot_1', '{"im_last_hero":"guanyu"}'); });
  await p.reload(); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(1200);
  const snap = () => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('im_') && !/im_dev_panel|im_render_scale|im_layout/.test(k)) o[k] = localStorage.getItem(k); } return o; });
  const real0 = await snap();
  // 测试模式：打一局（升级 + 杀首领），面板跳主城，再回主页
  await battle(p);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS.autoLevel5(); s.spawnBoss(); s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee'); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.collectBossChests?.(); }); await p.waitForTimeout(600);
  const inDev = await p.evaluate(() => ({ badge: document.getElementById('dev-test-save')?.textContent, changed: window.__testSave?.changed() }));
  await p.evaluate(() => window.__game.scene.getScene('GameScene').__DEV_ACTIONS.homeCity()); await p.waitForTimeout(2500);
  await p.goto(base + '?dev=1&layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(1000);
  const devView = await snap();
  // 离开测试模式看正式存档
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(1000);
  const real1 = await snap();
  const diff = Object.keys({ ...real0, ...real1 }).filter(k => real0[k] !== real1[k] && !/im_slot_touched|im_home_seen/.test(k));
  ck('测试模式显示「测试存档」角标', /测试存档/.test(inDev.badge ?? ''), inDev.badge);
  ck('测试模式的改动只进测试存档（测试视图里确实变了）', Object.keys(devView).some(k => devView[k] !== real0[k]), Object.keys(devView).filter(k => devView[k] !== real0[k]));
  ck('正式存档（含存档位 im_slot_1）一项都没变', diff.length === 0 && real1.im_slot_1 === real0.im_slot_1, diff);
  ck('测试模式外看不到测试改动', real1.im_heroes_v1 === real0.im_heroes_v1, { heroes: (real1.im_heroes_v1 ?? '∅').slice(0, 60) });
  // 清空测试存档 → 测试视图是空档；正式存档仍在
  await battle(p);
  p.once('dialog', d => d.accept());
  await p.evaluate(() => window.__game.scene.getScene('GameScene').__DEV_ACTIONS.testSaveClear());
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(500);
  const cleared = await p.evaluate(() => ({ world: localStorage.getItem('im_world_v1'), cleared1: localStorage.getItem('im_chapter1_cleared'), slot: localStorage.getItem('im_slot_1') }));
  // 自动开局会重新写 im_last_hero（新档本来如此），这里看进度键
  ck('清空测试存档：测试视图变全新空档', cleared.world === null && cleared.cleared1 === null && cleared.slot === null, cleared);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(600);
  const real2 = await snap();
  ck('清空测试存档后正式存档仍完整', real2.im_world_v1 === real0.im_world_v1 && real2.im_slot_1 === real0.im_slot_1, Object.keys(real2));
  await p.close();
}

// ---------- 2) 电脑布局面板 ----------
for (const vp of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const p = await b.newPage({ viewport: vp }); watch(p);
  await p.goto(base + '?layout=desktop'); await p.evaluate(() => localStorage.removeItem('im_dev_panel'));
  await battle(p);
  const hud = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'), c = document.querySelector('canvas').getBoundingClientRect(), k = c.width / 960; /* HUD 用 960×540 设计坐标 */
    const r = o => { const g = o.getBounds(); return { x: c.x + g.x * k, y: c.y + g.y * k, w: g.width * k, h: g.height * k }; };
    return { hp: r(s.hudTexts.hp), timer: r(s.hudTexts.timer), pause: r(s.hudTexts.pause), wave: r(s.hudTexts.wave) }; });
  const rect = () => p.evaluate(() => { const r = document.getElementById('dev-panel').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const hit = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
  const closed = await rect();
  ck(`${vp.width}×${vp.height} 收起时只占顶部一条，不压主将血条 / 计时 / 暂停 / 波次`, closed.h <= 34 && !Object.values(hud).some(h => hit(closed, h)), { closed, hud });
  await p.screenshot({ path: `${out}/${tag}-collapsed-${vp.width}x${vp.height}.png` });
  await p.click('#dev-panel > div'); await p.waitForTimeout(300);
  const open = await rect();
  ck(`${vp.width}×${vp.height} 展开后整块在屏幕内`, open.x >= 0 && open.y >= 0 && open.x + open.w <= vp.width && open.y + open.h <= vp.height, open);
  const groups = await p.evaluate(() => [...document.querySelectorAll('#dev-panel div')].filter(d => /测试存档|选将|选关/.test(d.textContent) && d.querySelector('span')).length);
  ck(`${vp.width}×${vp.height} 有测试存档 / 选将 / 选关分组`, groups >= 3, groups);
  await p.screenshot({ path: `${out}/${tag}-open-${vp.width}x${vp.height}.png` });
  await p.close();
}

// ---------- 3) 选将 / 选关 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); watch(p);
  await battle(p);
  await p.evaluate(() => window.__game.scene.getScene('GameScene').__DEV_ACTIONS.hero_guanyu());
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'guanyu'; }, null, { timeout: 30000 });
  ck('选将：关羽直接出战', await p.evaluate(() => window.__game.scene.getScene('GameScene').player.growth.character === 'guanyu'));
  await p.evaluate(() => { const a = window.__game.scene.getScene('GameScene').__DEV_ACTIONS; a.lordToggle(); a.hero_zhangfei(); });
  await p.waitForFunction(() => window.__game.scene.getScene('GameScene')?.runConfig?.character === 'zhangfei' && window.__game.scene.getScene('GameScene').player, null, { timeout: 30000 });
  ck('选将 + 同时设主公：主公变张飞（只在测试存档）', await p.evaluate(() => JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').lord === 'zhangfei'));
  const cases = [['stage_1_3', 'GameScene'], ['stage_2_2', 'GameScene'], ['stage_3_2', 'ThirdGameScene'], ['stage_4_1', 'GuanduGameScene'], ['stage_5_2', 'ChibiGameScene'], ['intelBandit', 'IntelGameScene'], ['intelBounty', 'IntelGameScene'], ['lubuChallenge', 'LubuGameScene']];
  const siegeKey = await p.evaluate(() => Object.keys(window.__game.scene.getScene('GameScene').__DEV_ACTIONS).find(k => k.startsWith('siege_')));
  cases.push([siegeKey, 'SiegeGameScene']);
  for (const [key, sceneKey] of cases) {
    const from = await p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key).find(k => /GameScene$/.test(k)));
    await p.evaluate(([from, key]) => window.__game.scene.getScene(from).__DEV_ACTIONS[key](), [from, key]);
    let ok = true; try { await p.waitForFunction(k => { const s = window.__game.scene.getScene(k); return window.__game.scene.isActive(k) && s?.player && s.__DEV_ACTIONS; }, sceneKey, { timeout: 45000 }); } catch { ok = false; }
    await p.waitForTimeout(600);
    const st = await p.evaluate(k => { const s = window.__game.scene.getScene(k); return { active: window.__game.scene.isActive(k), hero: s?.player?.growth.character, chapter: s?.chapter?.name }; }, sceneKey);
    ck(`选关 ${key} → ${sceneKey}（张飞出战）`, ok && st.active && st.hero === 'zhangfei', st);
    if (key === 'stage_4_1') await p.screenshot({ path: `${out}/${tag}-stage-4-1.png` });
  }
  await p.close();
}
// ---------- 4) 随行 ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); watch(p);
  await battle(p);
  const A = act => p.evaluate(k => window.__game.scene.getScene('GameScene').__DEV_ACTIONS[k](), act);
  const team = () => p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); return (s.followers?.members ?? []).map(m => ({ id: m.recruit.id, lv: m.level, on: m.sprite.active && m.sprite.visible })); });
  await A('follow_guanyu'); await A('follow_huangzhong'); await p.waitForTimeout(300);
  const t1 = await team();
  ck('随行：不用重开，当场加入关羽、黄忠', t1.length === 2 && t1[0].id === 'guanyu' && t1[1].id === 'huangzhong' && t1.every(x => x.on), t1);
  await A('follow_r_9011'); await A('follow_r_9001'); await p.waitForTimeout(300);
  const t2 = await team();
  ck('随行最多 3 人，再加就替换最早的一位；人才库人物也能带', t2.length === 3 && !t2.some(x => x.id === 'guanyu') && t2.some(x => x.id === 'r_9011') && t2.some(x => x.id === 'r_9001'), t2);
  await A('followLv20'); await p.waitForTimeout(700); /* 分组小字每 0.5 秒刷新 */
  const t3 = await team(), note = await p.evaluate(() => [...document.querySelectorAll('#dev-panel span')].map(e => e.textContent).find(t => /Lv20/.test(t ?? '')));
  ck('随行等级设为 20，面板显示当前随行和等级', t3.every(x => x.lv === 20) && !!note, { t3, note });
  // 主将换成随行里的人：自动去掉同名随行；选将 / 重开后随行自动带上
  await A('hero_huangzhong');
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.runConfig?.character === 'huangzhong' && s.player && s.__DEV_ACTIONS; }, null, { timeout: 30000 }); await p.waitForTimeout(500);
  const t4 = await team();
  ck('换主将后随行保留（同名的自动让出）', t4.length === 2 && !t4.some(x => x.id === 'huangzhong'), t4);
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, e = s.spawnEnemy('infantry', s.player.x + Math.cos(a) * 90, s.player.y + Math.sin(a) * 90, 1); if (e) { e.hp = e.maxHp = 99999; e.speed = 0; } } }); await p.waitForTimeout(4000);
  const fought = await p.evaluate(() => window.__game.scene.getScene('GameScene').followers?.stats.hits ?? 0);
  ck('随行会自动作战', fought > 0, fought);
  await p.click('#dev-panel > div'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${tag}-followers-1280x720.png` });
  await A('followClear'); await p.waitForTimeout(200);
  ck('清空随行', (await team()).length === 0);
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
