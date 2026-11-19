// 天下地图挑战关「虎牢关 · 三英战吕布」开放条件（2026-11-18 用户「三英战吕布是打完第二章才开的」）：
// 第二章没打完（2-2 已过）→ 锁、悬停写开放条件、点出征无效；第二章通关 → 开放并有金色脉冲（还没胜过时）。电脑版。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-lubu-lock.mjs   截图在 assets/review/lubu-lock/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/lubu-lock';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 360) : '')); };
const mk = o => ({ version: 7, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 300, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], chapterSeen: 2, tutorialDone: true, ...o });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const M = "window.__game.scene.getScene('WorldMapScene')";
const look = async (save, name) => {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(1800);
  const r = await p.evaluate(M0 => { const s = eval(M0), m = s.markers.find(x => x.node.id === 'lubu'); s.centerOn(m.node); s.selected = { kind: 'node', node: m.node }; s.refresh();
    const hit = m.root.list.find(o => o.name === 'node-lubu'); hit.emit('pointerover'); const tip = s.children.getByName('world-tip')?.list?.[1]?.text ?? '';
    return { state: s.nodeState(m.node), glyph: m.root.getData('icon')?.texture?.key ?? '', pulse: !!m.root.list.find(o => o.name === 'node-pulse-lubu'), tip, detail: s.detail.text, action: s.action.text.text, actionOn: !!s.action.image.input?.enabled }; }, M);
  await p.screenshot({ path: `${out}/${name}.png` });
  // 点出征：锁着时不能进
  await p.evaluate(M0 => { const s = eval(M0); s.action.image.emit('pointerup'); s.launch(false); }, M); await p.waitForTimeout(1500);
  r.entered = await p.evaluate(() => window.__game.scene.isActive('LubuGameScene') || window.__game.registry.get('pendingWarlord') === 'LubuGameScene');
  await p.close(); return r;
};
const locked = await look(mk(), 'locked-after-2-2');
ck('2-2 荥阳已过、第二章未通关：挑战关锁着（锁印）、悬停写「通关第二章「讨伐董卓」后开放」、出征按钮不可点、进不去', locked.state === 'locked' && !locked.pulse && /通关第二章「讨伐董卓」后开放/.test(locked.tip) && /通关第二章「讨伐董卓」后开放/.test(locked.detail) && locked.action === '尚未解锁' && !locked.actionOn && !locked.entered, locked);
const open = await look(mk({ dongzhuoStages: 3, cleared: { huangjin: true, hulao: true } }), 'unlocked-after-ch2');
ck('第二章通关：挑战关开放（战旗 + 金色脉冲新开放提示）、悬停写首胜赤兔、可挑战', open.state === 'open' && open.pulse && /赤兔/.test(open.tip) && open.action === '挑战吕布' && open.actionOn && open.entered, open);
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
