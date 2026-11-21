// 出征前整军 · 浏览器走两条路（总制作人 11-21：「战败重进都先回行营整军再出征」）。正式模式（不带 ?dev=1）、电脑布局、新存档赵云。
// 1-1 直接判胜 → 行营招 5 个兵 → 率军出征 1-2 → 判负 → 路一「再战此关」→ 应先进整军（出征 · 1-2，兵 5、粮同出征时）→ 再招 1 个 → 出征开战
// → 再判负 → 路二「返回主菜单」→ 主页「匡扶汉室」→ 应先进整军（兵 6）。截图 assets/review/precamp/。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-precamp-retry.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/precamp';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
const wait = ms => p.waitForTimeout(ms);
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('ns')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('ns', '1'); } });
  await p.goto(BASE + '?layout=desktop', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await wait(2000);
  const menuEmit = n => p.evaluate(n0 => { const m = window.__game.scene.getScene('MenuScene'); if (!m?.sys.isActive()) return false; const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(m.children.list); const o = all.find(x => x.name === n0 && x.input?.enabled !== false && x.visible !== false); if (!o) return false; o.emit('pointerdown'); o.emit('pointerup'); return true; }, n);
  /** 从主页进到 GameScene：点「匡扶汉室」/ 选赵云 / 确认，直到战斗场景起来。 */
  const enterFromMenu = async (start) => {
    for (let i = 0; i < 150; i++) {
      const st = await p.evaluate(() => ({ game: window.__game.scene.isActive('GameScene'), menu: window.__game.scene.isActive('MenuScene') }));
      if (st.game) return true;
      if (st.menu) { if (start) await menuEmit('start-campaign'); await menuEmit('pick-zhaoyun'); await menuEmit('hero-confirm'); }
      await wait(700);
    }
    return false;
  };
  const G = "window.__game.scene.getScene('GameScene')";
  /** 关掉剧情卷轴 / 引导，直到 mode 不是 story。 */
  const skipStory = async () => { for (let i = 0; i < 40; i++) { const m = await p.evaluate(G0 => { const s = eval(G0); if (!s?.sys.isActive()) return 'gone'; if (s.mode !== 'story') return s.mode; const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => /^story-.*(confirm|next)$|-opening-next$|confirm$/.test(x.name ?? '') && x.active && x.visible !== false && x.input?.enabled); if (o) { o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); } return 'story'; }, G); if (m !== 'story') return m; await wait(400); } return 'story'; };
  const state = () => p.evaluate(G0 => { const s = eval(G0); return { stage: s.chapter?.stage, name: s.chapter?.name, mode: s.mode, preCamp: s.preCamp, resting: s.resting, count: s.legion?.count, food: s.legion?.food, next: s.campUI?.next?.text, over: s.over }; }, G);
  const defeat = () => p.evaluate(G0 => { const s = eval(G0); s.player.hp = 0; s.player.alive = false; s.finish(false, 'death'); return s.over; }, G);
  const clickIn = n => p.evaluate(([G0, n0]) => { const s = eval(G0); const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => x.name === n0 && x.active && x.input?.enabled); if (!o) return false; o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); return true; }, [G, n]);
  /** 等到 mode === want（期间点掉剧情）。 */
  const waitMode = async (want, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const st = await state().catch(() => null); if (st?.mode === want) return st; if (st?.mode === 'story') await skipStory(); await wait(500); } return state().catch(() => null); };

  // ———— 新存档 1-1 → 判胜 → 行营招 5 个 → 出征 1-2
  ck('主页进 1-1', await enterFromMenu(true));
  await p.waitForFunction(G0 => !!eval(G0)?.player, G, { timeout: 60000 }); await wait(1500); await skipStory();
  await p.evaluate(G0 => { const s = eval(G0); s.bossKilled = true; s.finish(true, 'boss'); }, G);
  const rest1 = await waitMode('rest', 20000);
  ck('1-1 告捷进行营', rest1?.mode === 'rest' && rest1?.resting, rest1);
  await wait(2500); // 入营过场
  const hired = await p.evaluate(G0 => { const s = eval(G0); s.legion.food += 400; for (let i = 0; i < 5; i++) s.legion.recruit(i % 2 ? 'spearman' : 'swordsman', 1); s.campUI.render(); return { count: s.legion.count, food: s.legion.food }; }, G);
  ck('行营招 5 个兵', hired.count === 5, hired);
  ck('率军出征', await clickIn('camp-depart'));
  await p.waitForFunction(G0 => { const s = eval(G0); return s?.sys.isActive() && s.chapter?.stage === 2 && !!s.player; }, G, { timeout: 60000 }); await wait(1500);
  const s12 = await state(); ck('进 1-2（同章连打，不整军）、带着 5 个兵', s12.stage === 2 && !s12.preCamp && s12.count === 5, s12);
  await skipStory();

  // ———— 路一：判负 →「再战此关」
  await defeat(); await wait(4500);
  const home1 = await p.evaluate(G0 => eval(G0).resultPanel?.getByName('result-home')?.text, G);
  ck('败走面板主按钮「再战此关」', home1 === '再战此关', home1);
  await clickIn('result-home');
  ck('「再战此关」回到战斗场景', await enterFromMenu(false));
  await p.waitForFunction(G0 => { const s = eval(G0); return s?.sys.isActive() && !!s.player; }, G, { timeout: 60000 });
  const pre1 = await waitMode('rest', 30000);
  ck('路一：先进整军（行营），右上「出征 · 本关」，兵 5、粮同出征时', pre1?.mode === 'rest' && pre1?.preCamp && pre1?.stage === 2 && /^出征 · /.test(pre1?.next ?? '') && pre1?.count === 5 && pre1?.food === hired.food, pre1);
  await wait(2500); await p.screenshot({ path: OUT + '/path1-precamp.png' });
  const more = await p.evaluate(G0 => { const s = eval(G0); const ok = s.legion.recruit('archer', 1); s.campUI.render(); return { ok, count: s.legion.count, food: s.legion.food }; }, G);
  ck('整军里再招 1 个（花随军粮）', more.ok && more.count === 6, more);
  await clickIn('camp-depart'); await wait(1200);
  const go1 = await state(); const t0 = await p.evaluate(G0 => eval(G0).combatNow, G); await wait(1500); const t1 = await p.evaluate(G0 => eval(G0).combatNow, G);
  ck('率军出征 → 本关开战（不跳关、计时在走）', !go1.preCamp && !go1.resting && go1.stage === 2 && (go1.mode === 'none' || go1.mode === 'story') && (t1 > t0 || go1.mode === 'story'), { go1, t0, t1 });

  // ———— 路二：判负 →「返回主菜单」→ 主页「匡扶汉室」
  await skipStory(); await defeat(); await wait(4500);
  ck('点「返回主菜单」', await clickIn('result-restart'));
  await p.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 60000 }); await wait(1500);
  ck('主页「匡扶汉室」继续征程', await enterFromMenu(true));
  await p.waitForFunction(G0 => { const s = eval(G0); return s?.sys.isActive() && !!s.player; }, G, { timeout: 60000 });
  const pre2 = await waitMode('rest', 30000);
  ck('路二：先进整军，兵 6（整军里招的没回滚）、粮同上次出征', pre2?.mode === 'rest' && pre2?.preCamp && pre2?.stage === 2 && pre2?.count === 6 && pre2?.food === more.food, pre2);
  await wait(2500); await p.screenshot({ path: OUT + '/path2-precamp.png' });
} catch (e) { fail++; console.log('FAIL 异常', String(e).slice(0, 300)); }
ck('控制台无报错', errors.length === 0, errors.slice(0, 3));
await b.close();
console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
