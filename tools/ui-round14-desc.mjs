// 文案审校截图（电脑 1280×720）：升级三选一、行囊道具详情、战法心得页、图鉴天赋（检查 undefined）。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round14-desc.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round14';
mkdirSync(out, { recursive: true });
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load|Texture key already in use/.test(m.text())) errors.push(m.text()); });
await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`);
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player, null, { timeout: 90000 }); await p.waitForTimeout(800);
// 三选一：给几张战法让流派标签出现
for (let k = 0; k < 3; k++) {
  const cards = await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; if (s.mode !== 'none') s.setMode('none');
    s.player.growth.build.learn(['pursuit', 'eagle', 'snare'][Math.floor(Math.random() * 3)]); s.pendingLevels = 1; s.openUpgrade();
    return s.cardViews.filter(c => c.bg.visible).map(c => ({ name: c.name.text, desc: c.desc.text, tag: c.tag?.text ?? c.category?.text ?? '' })); }, G);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${tag}-levelup-${k + 1}.png` });
  console.log(JSON.stringify(cards));
  if (tag !== 'before') ck(`三选一第 ${k + 1} 次：没有 Boss / undefined / 流派 第x件 字样，正文 ≤ 4 行`, cards.every(c => !/Boss|undefined|流派 第|集齐4件|拉力/.test(c.desc + c.tag) && c.desc.split('\n').length <= 4), cards);
  await p.evaluate(G0 => { const s = eval(G0); s.chooseUpgrade(0); }, G); await p.waitForTimeout(200);
}
// 行囊道具详情（随便放几件）
await p.evaluate(async G0 => { const s = eval(G0), st = await import('/src/systems/ItemStore.ts'), it = await import('/src/data/items.ts'); st.addItems([it.rollItem('orange'), it.rollItem('purple'), it.rollItem('blue')]); s.openBattleBag(); }, G);
await p.waitForFunction(G0 => { const s = eval(G0), f = (r, n) => { for (const o of r?.list ?? []) { if (o.name === n) return o; const x = f(o, n); if (x) return x; } return null; }; return !!f(s.children.getByName('item-bag'), 'item-cell-0'); }, G, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(800);
await p.evaluate(G0 => { const s = eval(G0), f = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = f(o, n); if (x) return x; } return null; }; const c = f(s.children.getByName('item-bag'), 'item-cell-0'); c?.emit('pointerdown'); c?.emit('pointerup'); }, G); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/${tag}-bag-detail.png` });
await p.evaluate(G0 => { const s = eval(G0); s.children.getByName('item-bag')?.getData('ui')?.close(); }, G); await p.waitForTimeout(200);
// 战法心得页（悬停一张显示说明）
await p.evaluate(async G0 => { const s = eval(G0), C = await import('/src/ui/HeroCodexUI.ts'); if (s.mode === 'none') s.togglePause(); C.openHeroCodex(s, 'zhaoyun'); await new Promise(r => setTimeout(r, 200));
  const f = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = f(o, n); if (x) return x; } return null; }, root = s.children.getByName('hero-codex'); f(root, 'codex-tab-xinde').emit('pointerdown'); await new Promise(r => setTimeout(r, 150));
  f(s.children.getByName('hero-codex'), 'codex-tactic-traction')?.emit('pointerover'); }, G); await p.waitForTimeout(300);
const hover = await p.evaluate(G0 => { const s = eval(G0), f = (r, n) => { for (const o of r.list ?? []) { if (o.name === n) return o; const x = f(o, n); if (x) return x; } return null; }; return f(s.children.getByName('hero-codex'), 'codex-tactic-desc')?.text; }, G);
if (tag !== 'before') ck('战法心得悬停「牵机」：说清楚拉多少人、减速、对首领无效', /拉向命中点/.test(hover ?? '') && /减速12%/.test(hover ?? '') && /对首领无效/.test(hover ?? ''), hover);
await p.screenshot({ path: `${out}/${tag}-xinde-hover.png` });
await p.evaluate(G0 => { const s = eval(G0); s.children.getByName('hero-codex')?.getData('ui')?.close(); }, G);
await p.close();
// 图鉴天赋：12 名武将都不显示 undefined
const q = await b.newPage({ viewport: { width: 1280, height: 720 } }); q.on('pageerror', e => errors.push(e.message));
await q.goto(`${base}?layout=desktop`); await q.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.startButton, null, { timeout: 90000 }); await q.waitForTimeout(800);
const codex = await q.evaluate(async () => { const m = window.__game.scene.getScene('MenuScene'), C = await import('/src/ui/GameCodex.ts'), D = await import('/src/data/characters.ts'), out = [];
  const ui = new C.GameCodex(m, () => {}); await new Promise(r => setTimeout(r, 300));
  for (let i = 0; i < D.CHARACTERS.length; i++) { ui.index = i; ui.render?.(); await new Promise(r => setTimeout(r, 30)); const texts = []; const walk = l => { for (const o of l) { if (o.type === 'Text' && o.visible) texts.push(o.text); if (o.list) walk(o.list); } }; walk(ui.root.list); out.push({ id: D.CHARACTERS[i].id, bad: texts.some(t => /undefined/.test(t)), talent: (texts.find(t => /天赋被动/.test(t)) ?? '').split('\n').slice(-6, -3).join(' ').slice(0, 60) }); }
  ui.index = 5; ui.render?.(); return out; });
await q.waitForTimeout(300); await q.screenshot({ path: `${out}/${tag}-codex-machao.png` });
console.log(JSON.stringify(codex.map(c => c.id + (c.bad ? '❌undefined' : ''))));
if (tag !== 'before') ck('图鉴 12 名武将的天赋说明都不是 undefined', codex.length === 12 && codex.every(c => !c.bad), codex.filter(c => c.bad).map(c => c.id));
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
