// 钱币（2026-11-21 军粮改钱币）：战斗 HUD 钱袋 + 铜钱飞入（数值立即入账、显示落袋后跳）+ 捡钱音效；行营资源行钱袋 + 飞入。
// 音效验证：Chrome 加 --autoplay-policy=no-user-gesture-required，Sfx 的 stats 里 coin / coinPurse 的 played（真的创建并启动了振荡器）> 0。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-coins.mjs → assets/review/coins/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/coins'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 500))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] }); const errs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_home_seen']) localStorage.setItem(k, '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('s', '1'); } });
await p.goto(BASE + '?dev=1&autostart=1&stage=1&layout=desktop&story=off', { timeout: 180000 });
await p.waitForFunction(() => { const s = window.__game?.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2.5; }, null, { timeout: 180000 });
await p.mouse.click(640, 400); // 一次手势，确保音频解锁
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, a) => p.evaluate(([S0, f, x]) => { const r = eval('(' + f + ')')(eval(S0), x); return r && typeof r === 'object' && Object.getPrototypeOf(r) !== Object.prototype && !Array.isArray(r) ? null : r; }, [G, String(fn), a]);
await ev(s => { s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); s.sfx.unlock?.(); document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }); });
await p.waitForTimeout(3000); // 开局镜头缩放停下
// ① 战斗：在主将右上方 140px 处「打死」一个精英（+5）、一个首领（+20），各自从击杀处飞
const before = await ev(s => ({ food: s.legion.food, hud: s.legionUI.status.text, purse: !!s.legionUI.purse?.visible }));
await ev(s => { s.legion.foodFrom = { x: s.player.x + 140, y: s.player.y - 90, t: performance.now() }; s.legion.food += 5; });
await p.waitForTimeout(60);
await ev(s => { s.legion.foodFrom = { x: s.player.x - 160, y: s.player.y + 40, t: performance.now() }; s.legion.food += 20; });
await p.waitForTimeout(160);
const mid = await ev(s => ({ food: s.legion.food, hud: s.legionUI.status.text, flying: s.coinFly.flying })); await p.screenshot({ path: `${OUT}/battle-coins-flying.png` }); // 先量再拍（截图本身要几百毫秒）
await p.waitForTimeout(1100);
const after = await ev(s => ({ food: s.legion.food, hud: s.legionUI.status.text, flying: s.children.list.filter(o => o.name === 'coin-fly').length, sfx: { coin: s.sfx.stats?.coin, purse: s.sfx.stats?.coinPurse } }));
ck('战斗 HUD：钱袋图标在、写「钱币 N」', before.purse && /^钱币 \d+/.test(before.hud), before);
ck('得钱时数值立即入账（+25），铜钱在飞（3 + 5 枚分档）、数字先不跳', mid.food === before.food + 25 && mid.flying >= 4 && /^钱币 (\d+)/.exec(mid.hud)[1] !== String(mid.food), { before, mid });
ck('落袋后数字跳到新值、铜钱都没了', after.flying === 0 && new RegExp('^钱币 ' + after.food + '\\b').test(after.hud), after);
ck('捡钱音效与落袋音效真的播放了（Sfx.stats played > 0）', (after.sfx.coin?.played ?? 0) > 0 && (after.sfx.purse?.played ?? 0) > 0, after.sfx);
// ② 同屏上限：一次来 20 笔，飞行的铜钱不超过 12
await ev(s => { for (let i = 0; i < 20; i++) s.legion.food += 30; });
await p.waitForTimeout(30); await ev(s => { for (let i = 0; i < 20; i++) s.legion.food += 30; });
await p.waitForTimeout(120);
const cap = await ev(s => s.children.list.filter(o => o.name === 'coin-fly').length);
ck('同屏飞行铜钱不超过 12 枚', cap <= 12 && cap > 0, cap);
// ③ 暂停：飞到一半打开暂停，数值不丢；关掉后显示等于真值
await ev(s => { s.legion.food += 40; }); await p.waitForTimeout(80); await ev(s => s.togglePause()); await p.waitForTimeout(1200); await ev(s => s.togglePause()); await p.waitForTimeout(300);
const pz = await ev(s => ({ food: s.legion.food, hud: s.legionUI.status.text }));
ck('飞到一半暂停：不丢计数，恢复后显示 = 真值', new RegExp('^钱币 ' + pz.food + '\\b').test(pz.hud), pz);
// ④ 行营：休整时得钱（卖兵装之类）→ 飞向资源行钱袋
await ev(s => { s.resting = true; s.setMode('rest'); s.campUI.open('coins', '定军山'); });
await p.waitForTimeout(2500);
await ev(s => { s.children.getByName('rest-summary')?.emit('pointerdown'); }); await p.waitForTimeout(900); // 先关战报，行营面板才出来
await ev(s => { for (const o of s.children.list) if (/^rest-summary|hero-bark|toast/.test(o.name ?? '')) o.setVisible?.(false); });
await p.waitForFunction(() => window.__game.scene.getScene('GameScene').campUI.root.visible, null, { timeout: 10000 });
await ev(s => { s.legion.food += 30; }); await p.waitForTimeout(200);
const camp = await ev(s => ({ res: s.campUI.resources.text, purse: !!s.campUI.purse?.visible, flying: s.campCoinFly?.flying ?? 0 })); await p.screenshot({ path: `${OUT}/camp-coins.png` });
ck('行营资源行：钱袋图标 +「随军钱币 N」，得钱时铜钱飞向钱袋', camp.purse && /^随军钱币 \d+/.test(camp.res) && camp.flying > 0, camp);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
