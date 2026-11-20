// 结算 UI（2026-11-17 用户：「关于打败boss后结算ui也要优化一下」）：正式模式打赢 2-3（虎牢关）看结算面板、打赢 1-1 看入营「战报」、1-3 看章节告捷、败走看结算。
// 用法：BASE=http://127.0.0.1:5180/ TAG=after node tools/ui-round17-result.mjs   （TAG=before 时只截图不检查新面板）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', tag = process.env.TAG ?? 'after', out = 'assets/review/ui-round17';
const after = tag === 'after';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
async function page(w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push('console ' + m.text()); });
  await p.addInitScript(() => {
    window.__find = (root, name) => { const walk = o => { if (!o) return null; if (o.name === name) return o; for (const c of o.list ?? []) { const r = walk(c); if (r) return r; } return null; }; return walk(root); };
    if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); }
  });
  return { ctx, p };
}
// 正式模式开不了未解锁的关：先进 1-1，再像「下一关」按钮那样带新 runConfig 重开本场景
const boot = async (p, q) => { await p.goto(base + '?autostart=1&layout=desktop', { timeout: 120000, waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 120000 }); await p.waitForTimeout(1200);
  const cfg = q.includes('hulao') ? { chapter: 'hulao', stage: undefined, westStage: 3 } : q.includes('stage=3') ? { chapter: 'huangjin', stage: 3 } : null;
  if (cfg) { await p.evaluate(c => { const w = JSON.parse(localStorage.getItem('im_world_v1') ?? '{}'); w.yellowStages = c.chapter === 'hulao' ? 3 : 2; w.dongzhuoStages = c.chapter === 'hulao' ? 2 : 0; if (c.chapter === 'hulao') { w.cleared = { ...(w.cleared ?? {}), huangjin: true }; localStorage.setItem('im_chapter1_cleared', 'true'); } localStorage.setItem('im_world_v1', JSON.stringify(w)); const s = window.__game.scene.getScene('GameScene'); s.registry.set('runConfig', { ...s.runConfig, ...c }); s.scene.restart(); }, cfg); await p.waitForTimeout(600); await p.waitForFunction(c => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.chapter && (c.westStage ? s.chapter.westStage === c.westStage : s.chapter.stage === c.stage); }, cfg, { timeout: 60000 }); await p.waitForTimeout(1200); } };
// 正式模式打赢：真杀两名精英、首领战功 + 本场经验 + 一件首领遗珍、两件兵装
const win = (p, relic) => p.evaluate(([G0, relic0]) => { const s = eval(G0);
  for (const kind of ['elite', 'elite']) { const e = s.spawnEnemy(kind, s.player.x + 300, s.player.y, 1, true); e.hp = 0; s.killEnemy(e); }
  s.kills = 1287; s.damageDealt = 486210; s.elapsed = 512; s.player.runXp = 2600; s.bossKilled = true; s.runMerit.boss++;
  const loot = s.itemDrops?.runLoot; if (loot && relic0) loot.push({ uid: 'r1', base: relic0, quality: 'orange', affixes: [{ id: 'xp', value: 12 }, { id: 'ally', value: 10 }], special: 'xiangguo' });
  if (loot) loot.push({ uid: 'g1', base: loot.length ? 'iron_helm' : 'iron_helm', quality: 'blue', affixes: [{ id: 'hp', value: 30 }] });
  s.finish(true, 'boss'); return s.mode; }, [G, relic]);

for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  // 1) 2-3 虎牢关告捷：结算面板
  { const { ctx, p } = await page(w, h); await boot(p, '&chapter=hulao&westStage=3');
    const mode = await win(p, 'relic_xiangguo');
    await p.waitForTimeout(after ? 400 : 300); await p.screenshot({ path: `${out}/${tag}-result-mid-${w}x${h}.png` });
    await p.waitForTimeout(2200); await p.screenshot({ path: `${out}/${tag}-result-${w}x${h}.png` });
    const info = await p.evaluate(G0 => { const s = eval(G0), r = s.resultPanel; return { mode: s.mode, title: s.resultTexts.title.text, home: r.getByName('result-home')?.text, body: s.resultTexts.body.text.split('\n'), kicker: window.__find(r, 'result-kicker')?.text, rewards: !!window.__find(r, 'result-rewards'), relic: !!window.__find(r, 'result-relic'), xp: !!window.__find(r, 'result-xp-bar'), stats: window.__find(r, 'result-stats')?.text, done: s.resultAnimDone }; }, G);
    console.log(w, JSON.stringify(info).slice(0, 900));
    if (after) {
      ck(`${w}：2-3 告捷 · 结算面板：书法大标题 + 「2-3 告捷」+ 奖励图标格 + 首领遗珍卡 + 经验条 + 一行战况`, mode === 'result' && info.title === '国贼伏诛' && /2-3 告捷/.test(info.kicker ?? '') && info.rewards && info.relic && info.xp && /击杀/.test(info.stats ?? ''), info);
      ck(`${w}：动画 2 秒内放完`, info.done === true, info.done);
      ck(`${w}：原结算文字仍在（测试 / 逻辑读取）、按钮文字不变`, info.body.some(l => l.startsWith('武将等级')) && /天下地图/.test(info.home ?? ''), info.home);
    }
    await ctx.close(); }
  // 2) 1-1 打赢：入营「战报」
  { const { ctx, p } = await page(w, h); await boot(p, '');
    await win(p, null);
    await p.waitForFunction(G0 => !!eval(G0).children.getByName('rest-summary'), G, { timeout: 20000, polling: 100 });
    await p.waitForTimeout(after ? 2300 : 300); await p.screenshot({ path: `${out}/${tag}-rest-summary-${w}x${h}.png` });
    const sum = await p.evaluate(G0 => { const t = eval(G0).children.getByName('rest-summary'); return { text: t.text, type: t.type }; }, G);
    if (after) ck(`${w}：1-1 入营战报：仍叫 rest-summary、文字里有武将等级与本场战功`, /武将等级/.test(sum.text) && /本场战功/.test(sum.text), sum);
    if (after) { await p.evaluate(G0 => eval(G0).children.getByName('rest-summary').emit('pointerdown'), G); await p.waitForTimeout(200);
      ck(`${w}：点一下战报收起`, await p.evaluate(G0 => !eval(G0).children.getByName('rest-summary'), G)); }
    await ctx.close(); }
}
// 3) 1-3 章节告捷弹窗 + 败走（1280×720）
{ const { ctx, p } = await page(1280, 720); await boot(p, '&stage=3');
  await win(p, 'relic_jiujie');
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); const n = s.children.getByName('chapter1-volunteers'); return n && n.visible; }, null, { timeout: 20000, polling: 100 }).catch(() => {});
  if (after) { await p.waitForFunction(G0 => !!eval(G0).children.getByName('rest-summary'), G, { timeout: 20000 }); await p.waitForTimeout(2300); await p.screenshot({ path: `${out}/${tag}-chapter-summary-1280x720.png` }); const held = await p.evaluate(G0 => !eval(G0).children.getByName('chapter1-volunteers').visible, G); await p.evaluate(G0 => eval(G0).children.getByName('rest-summary').emit('pointerdown'), G); await p.waitForTimeout(200); const back = await p.evaluate(G0 => eval(G0).children.getByName('chapter1-volunteers').visible, G); ck('1-3：先看战报（告捷弹窗暂隐），收起战报后告捷弹窗出现', held && back, { held, back }); }
  await p.waitForTimeout(2400); await p.screenshot({ path: `${out}/${tag}-chapter-notice-1280x720.png` });
  await ctx.close(); }
{ const { ctx, p } = await page(1280, 720); await boot(p, '');
  await p.evaluate(G0 => { const s = eval(G0); s.kills = 312; s.elapsed = 141; s.finish(false, 'death'); }, G);
  await p.waitForTimeout(2300); await p.screenshot({ path: `${out}/${tag}-defeat-1280x720.png` });
  if (after) { const d = await p.evaluate(G0 => { const s = eval(G0), r = s.resultPanel; return { title: s.resultTexts.title.text, home: r.getByName('result-home')?.text, kicker: window.__find(r, 'result-kicker')?.text }; }, G);
    ck('败走：标题「败走」、按钮「返回主菜单」', d.title === '败走' && d.home === '返回主菜单', d); }
  // 点击跳过动画
  if (after) { await boot(p, '&chapter=hulao&westStage=3'); await win(p, 'relic_xiangguo'); await p.waitForTimeout(150);
    const skip = await p.evaluate(G0 => { const s = eval(G0); const before = s.resultAnimDone; s.resultPanel.list[0].emit('pointerdown'); return { before, after: s.resultAnimDone }; }, G);
    ck('动画中点一下直接放完', skip.before === false && skip.after === true, skip); }
  await ctx.close(); }
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
