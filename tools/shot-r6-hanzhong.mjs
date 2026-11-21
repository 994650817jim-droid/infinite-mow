// 总制作人第六轮试玩（8-1 阳平关）浏览器实走：正式模式（不带 ?dev=1）、电脑布局、新存档赵云。
// 1-1 判胜（存下征程构筑）→ 存档推到入蜀打完、占许昌 → 天下地图选「汉中之战」出征 → 8-1 应先进整军（首次出征）
// → 率军出征 → 判负 → 结算「退守 许昌」→ 真的进许昌城（城里军医 / 募兵所，弹败退提示）→ 返回天下地图：选中的是汉中之战（不是许昌）
// → 主按钮再出征 → 8-1 又先进整军（主将带伤 55%、部曲折损）。截图 assets/review/r6/。
// 用法：BASE=http://127.0.0.1:5197/ node tools/shot-r6-hanzhong.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/r6';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const active = k => p.evaluate(k0 => !!window.__game?.scene.isActive(k0), k);
const until = async (f, ms, a) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(f, a).catch(() => false)) return true; await wait(400); } return false; };
/** 点某个场景里名字为 n 的可点对象。 */
const clickIn = (key, n) => p.evaluate(([k, n0]) => { const s = window.__game.scene.getScene(k); if (!s?.sys.isActive()) return false; const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => x.name === n0 && x.active && x.input?.enabled); if (!o) return false; o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); return true; }, [key, n]);
/** 关掉剧情卷轴 / 引导。 */
const skipStory = async key => { for (let i = 0; i < 40; i++) { const m = await p.evaluate(k => { const s = window.__game.scene.getScene(k); if (!s?.sys.isActive()) return 'gone'; if (s.mode !== 'story') return s.mode; const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(s.children.list); const o = all.find(x => /^story-.*(confirm|next)$|-opening-next$|confirm$/.test(x.name ?? '') && x.active && x.visible !== false && x.input?.enabled); if (o) { o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); } return 'story'; }, key); if (m !== 'story') return m; await wait(400); } return 'story'; };
const state = key => p.evaluate(k => { const s = window.__game.scene.getScene(k); return { mode: s.mode, preCamp: s.preCamp, resting: s.resting, count: s.legion?.count, hp: s.player ? +(s.player.hp / s.player.maxHp).toFixed(2) : null, next: s.campUI?.next?.text, over: s.over, stage: s.chapter?.name }; }, key);
const waitMode = async (key, want, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const st = await state(key).catch(() => null); if (st?.mode === want) return st; if (st?.mode === 'story') await skipStory(key); await wait(500); } return state(key).catch(() => null); };
const HZ = 'HanzhongGameScene';
try {
  await p.addInitScript(() => { if (!sessionStorage.getItem('ns')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('ns', '1'); } });
  await p.goto(BASE + '?layout=desktop', { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await wait(1500);
  // ———— 新存档 1-1 判胜：存下征程构筑（汉中要从存档点开打）
  const menuEmit = n => p.evaluate(n0 => { const m = window.__game.scene.getScene('MenuScene'); if (!m?.sys.isActive()) return false; const all = []; const w = l => { for (const o of l) { all.push(o); if (o.list) w(o.list); } }; w(m.children.list); const o = all.find(x => x.name === n0 && x.input?.enabled && x.visible !== false); if (!o) return false; o.emit('pointerdown', { x: o.x, y: o.y }); o.emit('pointerup', { x: o.x, y: o.y }); return true; }, n);
  for (let i = 0; i < 150 && !(await active('GameScene')); i++) { if (await active('MenuScene')) { await menuEmit('start-campaign'); await menuEmit('pick-zhaoyun'); await menuEmit('hero-confirm'); } await wait(700); }
  await p.waitForFunction(() => !!window.__game.scene.getScene('GameScene')?.player, null, { timeout: 60000 }); await wait(1500); await skipStory('GameScene');
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.bossKilled = true; s.finish(true, 'boss'); });
  await waitMode('GameScene', 'rest', 20000);
  const build = await p.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('im_campaign_v1')).heroes.zhaoyun; } catch { return false; } });
  ck('1-1 告捷：存下赵云的征程构筑', build);
  // ———— 存档推到入蜀打完、占许昌（汉中之战开放）
  await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); W.saveWorld(); const s = JSON.parse(localStorage.getItem('im_world_v1'));
    const F = { huangjin: 'yellowStages', hulao: 'dongzhuoStages', qunxiong: 'warlordStages', guandu: 'guanduStages', chibi: 'chibiStages', jingnan: 'jingnanStages', shu: 'shuStages' };
    for (const k of Object.values(F)) s[k] = 3; Object.assign(s, { worldAvailable: true, chapterSeen: 8, tutorialDone: true, provisions: 3000, alerts: [] });
    s.cleared = { ...s.cleared, huangjin: true, hulao: true }; s.nodes = [...new Set([...(s.nodes ?? []), 'home', ...Object.keys(F), 'hanzhong'])]; s.ownedCities = [...new Set([...(s.ownedCities ?? []), 'xuchang'])];
    localStorage.setItem('im_world_v1', JSON.stringify(s)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_story', 'off'); });
  await p.reload(); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await wait(1200);
  // ———— 天下地图选「汉中之战」出征
  const toMap = () => p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'WorldMapScene') s.scene.stop(); g.scene.start('WorldMapScene'); });
  const launchHanzhong = () => p.evaluate(async () => { const N = await import('/src/world/WorldNodes.ts'), m = window.__game.scene.getScene('WorldMapScene'); const node = N.WORLD_NODES.find(n => n.campaign === 'hanzhong'); m.selected = { kind: 'node', node }; m.launch(false); return !!node; });
  await toMap(); await until(() => window.__game.scene.isActive('WorldMapScene'), 60000); await wait(1500);
  ck('天下地图：选「汉中之战」出征', await launchHanzhong());
  await until(k => !!window.__game.scene.getScene(k)?.player && window.__game.scene.isActive(k), 120000, HZ);
  const pre1 = await waitMode(HZ, 'rest', 40000);
  ck('8-1 首次出征：先进整军（行营），右上「出征 · 本关」', pre1?.mode === 'rest' && pre1?.preCamp && /^出征 · /.test(pre1?.next ?? ''), pre1);
  await wait(2000); await p.screenshot({ path: OUT + '/r6-1-muster-first.png' });
  // 招几个兵再出征（战败后看部曲折损）
  const hired = await p.evaluate(k => { const s = window.__game.scene.getScene(k); s.legion.food += 600; for (let i = 0; i < 6; i++) s.legion.recruit(i % 2 ? 'spearman' : 'swordsman', 1); s.campUI.render(); return s.legion.count; }, HZ);
  ck('率军出征 → 开战', await clickIn(HZ, 'camp-depart'));
  await wait(1500); await skipStory(HZ);
  const go = await state(HZ); ck('出征后开战（不在整军里）', !go.preCamp && !go.resting, { ...go, hired });
  // ———— 判负 → 「退守 许昌」→ 真的进许昌城
  await p.evaluate(k => { const s = window.__game.scene.getScene(k); s.player.hp = 0; s.player.alive = false; s.finish(false, 'death'); }, HZ);
  await until(k => window.__game.scene.getScene(k).resultPanel?.visible, 12000, HZ); await wait(600);
  const btn = await p.evaluate(k => window.__game.scene.getScene(k).resultPanel.getByName('result-home')?.text, HZ);
  ck('战败结算主按钮「退守 许昌」', btn === '退守 许昌', btn);
  await p.screenshot({ path: OUT + '/r6-2-defeat.png' });
  await clickIn(HZ, 'result-home');
  const town = await until(() => window.__game.scene.isActive('TownScene'), 60000);
  await wait(1400);
  const tt = await p.evaluate(() => { const t = window.__game.scene.getScene('TownScene'); return { city: t.cityId, toast: t.children.getByName('town-toast')?.text ?? '' }; });
  ck('点了真的进许昌城（TownScene），弹败退提示（军医、回地图再出征、开打前先整军）', town && tt.city === 'xuchang' && /失利/.test(tt.toast) && /军医/.test(tt.toast) && /整军/.test(tt.toast), tt);
  await p.screenshot({ path: OUT + '/r6-3-town.png' });
  // ———— 返回天下地图：选中的是汉中之战
  ck('点「返回天下地图」', await clickIn('TownScene', 'town-back'));
  await until(() => window.__game.scene.isActive('WorldMapScene'), 60000); await wait(1800);
  const sel = await p.evaluate(() => { const m = window.__game.scene.getScene('WorldMapScene'); return { kind: m.selected?.kind, node: m.selected?.node?.id, city: m.selected?.city?.id, action: m.action?.text?.text ?? m.action?.caption?.text ?? null }; });
  ck('回到地图选中的是「汉中之战」（不是许昌），主按钮就是再出征', sel.kind === 'node' && sel.node === 'hanzhong', sel);
  await p.screenshot({ path: OUT + '/r6-4-map.png' });
  // ———— 再出征：又先整军，主将带伤、部曲折损
  await p.evaluate(() => window.__game.scene.getScene('WorldMapScene').launch(false));
  await until(k => !!window.__game.scene.getScene(k)?.player && window.__game.scene.isActive(k), 120000, HZ);
  const pre2 = await waitMode(HZ, 'rest', 40000);
  ck('战败后再出征：又先进整军，主将带伤（≈55%）、部曲折损（少于出征时）', pre2?.mode === 'rest' && pre2?.preCamp && pre2?.hp !== null && pre2.hp <= .56 && pre2?.count < hired, { pre2, hired });
  await wait(2000); await p.screenshot({ path: OUT + '/r6-5-muster-retry.png' });
} catch (e) { fail++; console.log('FAIL 异常', String(e).slice(0, 400)); }
ck('控制台无报错', errors.length === 0, errors.slice(0, 3));
await b.close(); console.log(fail ? `\n${fail} 项失败` : '\n全部通过'); process.exit(fail ? 1 : 0);
