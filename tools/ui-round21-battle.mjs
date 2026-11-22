// 战斗内（2026-11-17 用户）：「军中设置」去掉属性点 / 行囊，「返回营寨」改「撤退」→ 回滚 → 天下地图；「用药」按钮换手绘药罐。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round21-battle.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/ui-round21';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const S = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push(m.text()); });
const world = { version: 10, yellowStages: 3, dongzhuoStages: 1, worldAvailable: true, cleared: { huangjin: true }, provisions: 100, buildings: { barracks: 1, farm: 1 }, cities: {}, chapterSeen: 99, tutorialSeen: true };
await p.addInitScript(W0 => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('im_world_v1', W0); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_tutorial_done', '1'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: [], followers: [] })); }, JSON.stringify(world));
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 120000 }); await p.waitForTimeout(800);
// 正式出征 2-2（讨董）：进关记快照
await p.evaluate(() => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', chapter: 'hulao', westStage: 2 }); g.registry.set('worldCampaign', true); for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('GameScene'); });
await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S, { timeout: 90000 }); await p.waitForTimeout(1200);
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('im_world_v1')).provisions);
// 用药：药囊里放两份，看按钮
await p.evaluate(S0 => { const s = eval(S0); s.player.damageImmune = true; s.player.hp = s.player.maxHp * .5; for (let i = 0; i < 2; i++) s.supplies.pouch.push({ amount: 30, texture: 'healing_potion', name: '回血药' }); s.supplies.spawnPotion?.(s.player.x + 60, s.player.y); }, S);
await p.waitForTimeout(700);
const pot = await p.evaluate(S0 => { const s = eval(S0), b = s.potionButton; return { vis: b.visible, icon: s.potionIcon.texture.key, badge: s.potionBadge.text, ground: s.supplies.potions?.filter(x => x.active).map(x => x.image.texture.key) }; }, S);
ck('用药按钮：手绘药罐（不再是像素药瓶），角标数字', pot.vis && pot.icon === 'potion_jar' && pot.badge === '2', pot);
await p.screenshot({ path: `${out}/potion-button-1280x720.png` });
await p.screenshot({ path: `${out}/potion-button-zoom.png`, clip: { x: 1100, y: 280, width: 180, height: 200 } });
// 军中设置
await p.evaluate(S0 => { const s = eval(S0); W => 0; window.__W = JSON.parse(localStorage.getItem('im_world_v1')); }, S);
await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); W.addProvisions(55); });
await p.evaluate(S0 => eval(S0).togglePause(), S); await p.waitForTimeout(300);
const panel = await p.evaluate(S0 => { const s = eval(S0), g = n => s.pausePanel.getByName(n); return { attr: g('pause-attributes')?.visible, bag: g('pause-bag')?.visible, build: g('pause-build')?.visible, exit: g('pause-exit')?.text }; }, S);
ck('军中设置：去掉「分配属性点」「行囊 · 换装」，留「查看构筑」，「撤退」', panel.attr === false && panel.bag === false && panel.build && panel.exit === '撤退', panel);
await p.screenshot({ path: `${out}/settings-panel-1280x720.png` });
const confirm = await p.evaluate(S0 => { const e = eval(S0).pausePanel.getByName('pause-exit'); e.emit('pointerdown'); return e.text; }, S);
ck('撤退要二次确认：「撤退？退出后本场获得的等级与资源不保留，确定？」', /^撤退？退出后本场获得的等级与资源不保留/.test(confirm), confirm);
await p.screenshot({ path: `${out}/settings-retreat-confirm-1280x720.png` });
const nav = p.waitForEvent('load', { timeout: 30000 }).catch(() => null);
await p.evaluate(S0 => eval(S0).pausePanel.getByName('pause-exit').emit('pointerdown'), S);
await nav;
await p.waitForFunction(() => window.__game?.scene.getScene('WorldMapScene')?.sys.isActive() || window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 120000 }); await p.waitForTimeout(1500);
const back = await p.evaluate(() => ({ scenes: window.__game.scene.getScenes(true).map(s => s.scene.key), prov: JSON.parse(localStorage.getItem('im_world_v1')).provisions, snap: !!localStorage.getItem('im_battle_snapshot') }));
ck('确认撤退 → 回滚本场所得（钱币回到进关前）→ 重载后直接在天下地图', back.scenes.includes('WorldMapScene') && back.prov === before, { ...back, before });
await p.screenshot({ path: `${out}/retreat-worldmap-1280x720.png` });
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
