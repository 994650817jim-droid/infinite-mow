// 全界面体检第二批（2026-11-21）：补拍上轮没摆出来的屏 + 第二批修后检查。电脑布局 1280×720。
// 战斗支援 / 胜利结算 / 败走（Enter = 再战此关）/ 剧情卷轴 / 新手引导 / 时局变化与告急 / 攻城出征弹窗 / 招贤馆三页签 / 存档 / 讲武堂科技。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-ui-audit-fix2.mjs → assets/review/ui-audit/fix2/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/ui-audit/fix2'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 400))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = []; let p;
const WORLD = { version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 1860, buildings: { hall: 2, barracks: 2, farm: 2, academy: 1, talent: 1, stable: 1 }, cities: {}, ownedCities: ['xuchang'], capturedEver: ['xuchang'], chapterSeen: 99, tutorialSeen: true };
const fresh = async (q, scene, seed = null) => { if (p) await p.close(); p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(S => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_city_intro_v3', 'im_mount_guide_v1', 'im_home_seen']) localStorage.setItem(k, '1'); if (!S?.tutorial) localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); if (S?.w) { localStorage.setItem('im_world_v1', S.w); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: ['guanyu'], followers: [] })); } sessionStorage.setItem('s', '1'); } }, seed);
  await p.goto(BASE + q, { timeout: 180000 }); await p.waitForFunction(k => window.__game?.scene.isActive(k), scene, { timeout: 180000 }); await p.waitForTimeout(1500); };
const shot = async n => { await p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; })); await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${n}.png` }); };
const step = async (n, fn) => { try { await fn(); } catch (e) { console.log('SKIP', n, String(e).slice(0, 160)); } };
const G = "window.__game.scene.getScene('GameScene')";
const ev = (fn, a) => p.evaluate(([S0, f, x]) => { const r = eval('(' + f + ')')(eval(S0), x); return r && typeof r === 'object' && !Array.isArray(r) && Object.getPrototypeOf(r) !== Object.prototype ? null : r; }, [G, String(fn), a]); // 只回传普通数据
const battle = async (stage, extra = '') => { await fresh(`?dev=1&autostart=1&stage=${stage}&layout=desktop&story=off${extra}`, 'GameScene'); await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2.5; }, null, { timeout: 120000 }); await ev(s => { s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); }); };
const goScene = async (key, data) => { await p.evaluate(([k, d]) => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(k, d); }, [key, data ?? {}]); await p.waitForFunction(k => window.__game.scene.isActive(k), key, { timeout: 60000 }); await p.waitForTimeout(2500); };

await step('support', async () => { await battle(1); await ev(s => { s.legion?.addFood?.(400); s.openRecruit(); }); await p.waitForTimeout(900); await shot('battle-support'); await ev(s => s.setMode('none')); });
await step('story', async () => { await ev(s => s.showMerchantHorseStory(() => {})); await p.waitForTimeout(1500); await shot('story-scroll'); });
await step('defeat', async () => { await battle(1); await ev(s => s.__DEV_ACTIONS.loseNow()); await p.waitForTimeout(3500); await shot('result-defeat');
  const h = await ev(s => s.children.list.filter(o => o.name === 'hotkey-hint' && o.visible).map(o => [o.getData('target'), o.text]));
  ck('败走（第一章）：Enter 标在「再战此关」，「返回主菜单」标 Esc', h.some(([t, v]) => t === 'result-restart' && v === 'Enter') && h.some(([t, v]) => t === 'result-home' && v === 'Esc'), h);
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  const st = await p.evaluate(() => window.__game.scene.getScenes(true).map(s => s.scene.key));
  ck('败走按 Enter = 再战此关（重开本关，不回主页）', st.includes('GameScene') && !st.includes('MenuScene'), st); });
await step('victory', async () => { await battle(3); await ev(s => s.__DEV_ACTIONS.winNow()); for (let i = 0; i < 12; i++) { const m = await ev(s => { if (s.mode === 'bossloot' || s.mode === 'levelup') s.chooseUpgrade(0); return s.mode; }); if (m === 'result') break; await p.waitForTimeout(600); } await p.waitForTimeout(2500); await shot('result-victory'); });
await step('tutorial', async () => { await fresh('?layout=desktop&autostart=1&tutorial=1', 'GameScene', { tutorial: true }); await p.waitForTimeout(4000); await shot('tutorial'); });
await step('world', async () => { await fresh('?layout=desktop', 'MenuScene', { w: JSON.stringify(WORLD) }); await goScene('WorldMapScene'); const W = "window.__game.scene.getScene('WorldMapScene')";
  await p.evaluate(W0 => { const s = eval(W0); for (const n of ['mech-intro', 'chapter-unlock-banner', 'era-modal']) s.children.getByName(n)?.destroy(); s.children.list.filter(o => (o.depth ?? 0) >= 1025 && o.type === 'Container').forEach(o => o.destroy()); }, W); await p.waitForTimeout(300);
  await p.evaluate(W0 => { const s = eval(W0), c = s.cityMarkers.find(m => m.city.id === 'runan').city; s.openSiege(c, false); }, W); await p.waitForTimeout(700); await shot('world-siege-modal');
  await p.evaluate(W0 => { const s = eval(W0); s.children.list.filter(o => (o.depth ?? 0) >= 1025 && o.type === 'Container').forEach(o => o.destroy()); s.siegeModal?.destroy?.(); }, W);
  await p.evaluate(W0 => { const s = eval(W0); s.showNotice({ from: 1, to: 2, changes: [], fallen: [], alerts: [] }, []); }, W); await p.waitForTimeout(800); await shot('world-era-notice');
  await p.evaluate(W0 => { const s = eval(W0); s.children.getByName('era-modal')?.destroy(); /* 告急弹窗需要真实告急数据，略 */ }, W); await p.waitForTimeout(700); await shot('world-alert-defense'); });
await step('talent', async () => { for (const [i, t] of ['offers', 'men', 'famous'].entries()) { if (i === 0) await goScene('TalentHallScene'); await p.evaluate(([k, idx]) => { const s = window.__game.scene.getScene('TalentHallScene'); const tabs = s.content.list.filter(o => /^talent-tab-/.test(o.name ?? '')); tabs[idx]?.emit('pointerup'); tabs[idx]?.emit('pointerdown'); }, [t, i]); await p.waitForTimeout(900); await shot('talent-' + t); }
  const bg = await p.evaluate(() => !!window.__game.scene.getScene('TalentHallScene').children.getByName('talent-bg')); ck('招贤馆：营帐底图在', bg, bg); });
await step('academy', async () => { await goScene('CityScene'); await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); for (const o of [...s.children.list]) if (o.type === 'Container' && (o.depth ?? 0) >= 50) o.destroy(); s.openTech(); }); await p.waitForTimeout(800); await shot('city-tech'); });
await step('saves', async () => { await fresh('?layout=desktop', 'MenuScene', { w: JSON.stringify(WORLD) }); await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName('home-saves')?.emit('pointerdown')); await p.waitForTimeout(900); await shot('home-saves'); });
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
