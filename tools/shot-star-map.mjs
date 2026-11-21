// 星图正式界面（ui/StarMapUI）实机检查 + 截图（2026-11-21）。开关 ?starMap=1（只在开发构建生效）。
// 战斗内 C 键面板：选中 → 点亮（播 12 帧特效）→ 滚轮缩放 → 拖动平移；营寨武将谱属性页：自动打开整屏星图、洗点、返回。另验 1366×768、1600×1000 两个非 16:9 窗口不报错、图在屏内。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-star-map.mjs → assets/review/star-map/ui-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/star-map'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 500))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = []; let p;
const fresh = async (q, scene, w = 1280, h = 720) => { if (p) await p.close(); p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_city_intro_v3', 'im_mount_guide_v1', 'im_home_seen']) localStorage.setItem(k, '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('s', '1'); } });
  await p.goto(BASE + q, { timeout: 180000 }); await p.waitForFunction(k => window.__game?.scene.isActive(k), scene, { timeout: 180000 }); await p.waitForTimeout(1200); };
const hide = () => p.evaluate(() => document.querySelectorAll('[id^="dev-"]').forEach(e => { e.style.display = 'none'; }));
/** 屏幕像素坐标（电脑布局逻辑尺寸 960×540，画布等比缩放居中）。 */
const toScreen = (gx, gy) => p.evaluate(([x, y]) => { const c = document.querySelector('canvas').getBoundingClientRect(), g = window.__game; const gw = 960; void g; return { x: c.left + x * c.width / gw, y: c.top + y * c.height / 540 }; } /* 逻辑坐标 960×540（画布按清晰度设置可能是 2× 像素） */, [gx, gy]);
const nodePos = (scene, id) => p.evaluate(([k, i]) => { const s = window.__game.scene.getScene(k); let z = null; const walk = l => { for (const o of l) { if (o.name === 'star-' + i) z = o; if (o.list) walk(o.list); } }; walk(s.children.list); if (!z) return null; const m = z.getWorldTransformMatrix(); return { x: m.tx, y: m.ty }; }, [scene, id]);
const ui = (scene, fn) => p.evaluate(([k, f]) => { const s = window.__game.scene.getScene(k); let r = null; const walk = l => { for (const o of l) { if (o.name === 'star-map') r = o; if (o.list) walk(o.list); } }; walk(s.children.list); return eval('(' + f + ')')(r, s); }, [scene, String(fn)]);

// ① 战斗内 C 键
await fresh('?dev=1&autostart=1&stage=1&layout=desktop&story=off&starMap=1', 'GameScene');
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2; }, null, { timeout: 120000 });
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.damageImmune = true; for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); s.player.growth.unallocated = 6; s.heroLv = 7; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); let ok = false; const walk = l => { for (const o of l) { if (o.name === 'star-map-hero') ok = true; if (o.list) walk(o.list); } }; walk(s.children.list); return ok; }, null, { timeout: 60000 });
await hide(); await p.waitForTimeout(3000); // 开局镜头缩放还在动，等它停
const gate = await p.evaluate(() => window.__game.scene.getScene('GameScene').player.growth.starGate);
// 入口相邻的一颗星：单击选中，再点「点亮」
const target = await p.evaluate(g => { return import('/src/data/starMap.ts').then(SM => SM.starNeighbors(g).find(id => SM.starNode(id).kind === 'small') ?? SM.starNeighbors(g)[0]); }, gate);
let q = await nodePos('GameScene', target); let sp = await toScreen(q.x, q.y); await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(300);
const sel = await ui('GameScene', r => r.list.find(o => o.name === 'star-map-sel-name')?.text);
ck('单击选中：右栏写出这颗星', !!sel && sel !== '选一颗星', sel);
const lb = await ui('GameScene', r => { const h = r.list.find(o => o.name === 'star-map-light'); const m = h.getWorldTransformMatrix(); return { x: m.tx, y: m.ty }; }); sp = await toScreen(lb.x, lb.y); await p.mouse.click(sp.x, sp.y);
await p.waitForTimeout(420); await p.screenshot({ path: `${OUT}/ui-battle-light-fx.png` });
const after = await p.evaluate(t => window.__game.scene.getScene('GameScene').player.growth.stars.includes(t), target);
const fxSeen = await ui('GameScene', r => { let n = 0; const walk = l => { for (const o of l) { if (o.name === 'star-map-fx') n++; if (o.list) walk(o.list); } }; walk(r.list); return n; });
ck('「点亮」后这颗星点亮、播序列帧特效', after && fxSeen > 0, { after, fxSeen });
// 双击点亮下一颗
const t2 = await p.evaluate(([g, t]) => import('/src/data/starMap.ts').then(SM => SM.starNeighbors(t).find(id => id !== g && SM.lightBlock([t], id, g) === null)), [gate, target]);
q = await nodePos('GameScene', t2); sp = await toScreen(q.x, q.y); await p.mouse.dblclick(sp.x, sp.y); await p.waitForTimeout(900);
ck('双击直接点亮', await p.evaluate(t => window.__game.scene.getScene('GameScene').player.growth.stars.includes(t), t2), t2);
// 不能点的星：说明原因
const far = await p.evaluate(g => import('/src/data/starMap.ts').then(SM => SM.STAR_NODES.find(n => n.kind === 'keystone').id), gate);
q = await nodePos('GameScene', far); sp = await toScreen(q.x, q.y); await p.mouse.click(sp.x, sp.y); await p.waitForTimeout(300);
const why = await ui('GameScene', r => r.list.find(o => o.name === 'star-map-sel-status')?.text);
ck('点不了的星写出原因（lightBlock）', /不能点亮/.test(why ?? ''), why);
// 滚轮缩放 / 拖动
const s0 = await ui('GameScene', r => { const m = r.list.find(o => o.name === 'star-map-layer'); return { s: m.scaleX, x: m.x, y: m.y }; });
const mid = await toScreen(480, 270); await p.mouse.move(mid.x, mid.y); for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(60); }
const s1 = await ui('GameScene', r => r.list.find(o => o.name === 'star-map-layer').scaleX);
for (let i = 0; i < 16; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(40); }
const s2 = await ui('GameScene', r => r.list.find(o => o.name === 'star-map-layer').scaleX);
ck('滚轮缩放在 0.8–1.6 倍之间', Math.abs(s1 / s0.s - 1.6) < .02 && Math.abs(s2 / s0.s - .8) < .02, { s0: s0.s, s1, s2 });
const e = await toScreen(470, 100); await p.mouse.move(e.x, e.y); await p.mouse.down(); await p.mouse.move(e.x + 120, e.y + 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
const s3 = await ui('GameScene', r => { const m = r.list.find(o => o.name === 'star-map-layer'); return { x: m.x, y: m.y }; });
ck('拖动平移', Math.abs(s3.x - s0.x) > 20 || Math.abs(s3.y - s0.y) > 20, { s0, s3 });
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(40); }
// 验收第 1 条：放大 + 拖动后，左右文字栏和底部提示行范围内的星 / 线都淡出（不压字），也点不到
const leak = await ui('GameScene', (r, s) => { const W = 960, H = 540, out = []; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (/^star-base-/.test(o.name ?? '') && o.alpha > .05) { const b = o.getBounds(), cx = b.centerX, cy = b.centerY; if (cx < 210 || cx > W - 230 || cy > H - 30) out.push([o.name, Math.round(cx), Math.round(cy), +o.alpha.toFixed(2)]); } } }; walk(r.list); return out; });
const hidden = await ui('GameScene', r => { let n = 0; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (/^star-base-/.test(o.name ?? '') && o.alpha <= .05) n++; } }; walk(r.list); return n; });
ck('放大拖动后文字栏 / 底部提示下的星都淡出（星图不压字）', leak.length === 0 && hidden > 0, { leak: leak.slice(0, 6), hidden });
await p.screenshot({ path: `${OUT}/ui-battle-zoom-clip.png` });
// 八卦阵：太极盘 + 8 卦在场、在星图层里跟着平移缩放（位置 = 星图层位置 + 坐标 × 缩放）、文字栏 / 底部提示下淡出、不可点
const bagua = await ui('GameScene', r => { const layer = r.list.find(o => o.name === 'star-map-layer'), W = 960, H = 540, out = { n: 0, follow: true, leak: [], hidden: 0, interactive: 0, belowLines: true };
  const firstLine = layer.list.findIndex(o => o.type === 'TileSprite');
  layer.list.forEach((o, i) => { if (!/^star-bagua-/.test(o.name ?? '')) return; out.n++; if (o.input) out.interactive++; if (i > firstLine) out.belowLines = false;
    const m = o.getWorldTransformMatrix(), ex = layer.x + o.x * layer.scaleX, ey = layer.y + o.y * layer.scaleY; if (Math.abs(m.tx - ex) > 1 || Math.abs(m.ty - ey) > 1) out.follow = false;
    if (m.tx < 210 || m.tx > W - 230 || m.ty > H - 24) { if (o.alpha > .02) out.leak.push([o.name, +o.alpha.toFixed(2)]); else out.hidden++; } });
  out.scale = +layer.scaleX.toFixed(3); return out; });
ck('八卦阵：太极 + 8 卦在场、随缩放平移、在连线之下、不可点、文字栏下淡出', bagua.n === 9 && bagua.follow && bagua.belowLines && bagua.interactive === 0 && bagua.leak.length === 0, bagua);
// 验收第 2 条：悬停在当前选中的星上不弹悬停框（不盖右栏）
const tipChk = await ui('GameScene', r => { const zones = []; const walk = l => { for (const o of l) { if (/^star-/.test(o.name ?? '') && o.type === 'Zone') zones.push(o); if (o.list) walk(o.list); } }; walk(r.list); const tip = r.list.find(o => o.name === 'star-map-tip'), sel = r.list.find(o => o.name === 'star-map-sel-name').text; const vis = zones.filter(z => z.input?.enabled); vis[0].emit('pointerup', { upTime: 1 }); /* 选中第一颗可见的星 */ vis[0].emit('pointerover'); const onSel = tip.visible; vis[0].emit('pointerout'); vis[vis.length - 1].emit('pointerover'); const b = tip.getBounds(); const other = { visible: tip.visible, right: Math.round(b.right) }; vis[vis.length - 1].emit('pointerout'); return { sel, onSel, other }; });
ck('悬停在选中的星上不弹框；别的星的悬停框不伸进右栏', !tipChk.onSel && tipChk.other.visible && tipChk.other.right <= 960 - 230, tipChk);
// 验收第 4 条：星点完（没有可用的星）后按 C 也能打开星图
await ui('GameScene', r => r.list.find(o => o.name === 'star-map-close').emit('pointerup')); await p.waitForTimeout(400);
await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.player.growth.unallocated = 0; });
await p.mouse.click(10, 10); await p.keyboard.press('KeyC'); await p.waitForTimeout(800);
const cOpen = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); let v = false; const walk = (l, vis) => { for (const o of l) { const ok = vis && o.visible; if (o.name === 'star-map' && ok) v = true; if (o.list) walk(o.list, ok); } }; walk(s.children.list, true); return { mode: s.mode, v }; });
ck('没有可用的星时按 C 仍能打开星图', cOpen.mode === 'attributes' && cOpen.v, cOpen);

// ② 营寨武将谱 · 属性页
await fresh('?layout=desktop&starMap=1', 'MenuScene');
await p.evaluate(async () => { localStorage.setItem('im_world_v1', JSON.stringify({ version: 10, yellowStages: 3, dongzhuoStages: 3, warlordStages: 1, worldAvailable: true, cleared: { huangjin: true, hulao: true }, provisions: 1860, buildings: { hall: 2, barracks: 2 }, cities: {}, ownedCities: ['xuchang'], capturedEver: ['xuchang'], chapterSeen: 99, tutorialSeen: true })); localStorage.setItem('im_chapter1_cleared', 'true'); localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: ['guanyu'], followers: [] }));
  const SM = await import('/src/data/starMap.ts'), HP = await import('/src/systems/HeroProgress.ts'); HP.setHeroStars('zhaoyun', SM.orderStars(SM.STAR_NODES.filter(n => n.region === 'agility' && n.kind !== 'keystone').map(n => n.id), SM.heroGate('zhaoyun')).slice(0, 14), 26);
  const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('CityScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('CityScene'), null, { timeout: 60000 }); await p.waitForTimeout(2500);
await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); for (const o of [...s.children.list]) if (o.type === 'Container' && (o.depth ?? 0) >= 50) o.destroy(); s.openCodex(); });
await p.waitForTimeout(1200);
await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); let t = null; const walk = l => { for (const o of l) { if (o.name === 'codex-tab-attrs') t = o; if (o.list) walk(o.list); } }; walk(s.children.list); t?.emit('pointerdown'); t?.emit('pointerup'); });
await p.waitForFunction(() => { const s = window.__game.scene.getScene('CityScene'); return s.children.list.some(o => o.name === 'star-map'); }, null, { timeout: 60000 }); await p.waitForTimeout(1500);
await hide(); await p.screenshot({ path: `${OUT}/ui-codex-starmap.png` });
const dim = await ui('CityScene', r => { const out = []; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (/^star-base-/.test(o.name ?? '') && o.alpha < .79) out.push([o.name, +o.alpha.toFixed(2)]); } }; walk(r.list); return out; });
ck('默认视图（一屏放下）里没有被淡出的星', dim.length === 0, dim.slice(0, 6));
const cod = await ui('CityScene', r => ({ hero: r.list.find(o => o.name === 'star-map-hero')?.text, stats: r.list.find(o => o.name === 'star-map-stats')?.text, respec: !!r.list.find(o => o.name === 'star-map-respec'), face: (() => { let f = false; const walk = l => { for (const o of l) { if (o.name === 'star-map-face') f = true; if (o.list) walk(o.list); } }; walk(r.list); return f; })() }));
ck('武将谱属性页自动打开整屏星图：武将名、星数、四维生效点、洗点、中心头像', cod.hero === '赵云' && /生效/.test(cod.stats) && cod.respec && cod.face, cod);
const rs = await ui('CityScene', r => { r.list.find(o => o.name === 'star-map-respec').emit('pointerup'); return r.list.find(o => o.name === 'star-map-msg')?.text; });
const left = await p.evaluate(() => import('/src/systems/HeroProgress.ts').then(HP => HP.heroStars('zhaoyun').length));
ck('洗点（MasteryStore.respec）清空已点亮的星', left === 0, { rs, left });
await ui('CityScene', r => r.list.find(o => o.name === 'star-map-close').emit('pointerup'));
await p.waitForTimeout(300);
ck('返回后回到武将谱属性页', await p.evaluate(() => { const s = window.__game.scene.getScene('CityScene'); return !s.children.list.some(o => o.name === 'star-map') && s.children.list.some(o => o.name === 'hero-codex'); }), null);

// ③ 非 16:9 窗口
for (const [w, h] of [[1366, 768], [1600, 1000]]) {
  await fresh('?dev=1&autostart=1&stage=1&layout=desktop&story=off&starMap=1', 'GameScene', w, h);
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.__DEV_ACTIONS && s.elapsed > 2; }, null, { timeout: 120000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); for (let i = 0; i < 4 && s.mode !== 'none'; i++) s.__DEV_ACTIONS.closePopup?.(); s.player.growth.unallocated = 3; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); });
  await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); let ok = false; const walk = l => { for (const o of l) { if (o.name === 'star-map-hero') ok = true; if (o.list) walk(o.list); } }; walk(s.children.list); return ok; }, null, { timeout: 60000 });
  await hide(); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/ui-battle-${w}x${h}.png` });
  const box = await ui('GameScene', (r, s) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const walk = l => { for (const o of l) { if (o.list) walk(o.list); else if (/^star-base-/.test(o.name ?? '')) { const b = o.getBounds(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom); } } }; walk(r.list); return { x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1), W: s.scale.gameSize.width, H: s.scale.gameSize.height }; });
  ck(`${w}×${h}：整张图在屏内、不压左右文字栏`, box.x0 >= 200 && box.x1 <= box.W - 220 && box.y0 >= 0 && box.y1 <= box.H, box);
}
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
