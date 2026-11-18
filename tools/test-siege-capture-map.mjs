// 攻城胜利 → 存档 → 天下地图归我方 → 疆域更新 → 可攻标记 / 不可攻原因（2026-11-18 用户：
// 「我攻城成功后检查那个城市有没有被玩家占领和势力图有没有划入进去…让玩家更加清晰哪个地方可以进攻进入天下地图后」）。
// 正式模式（不加 ?dev=1、非章节测试局）：从地图点城 → 出征攻城 → 战斗内判定胜利（直接走正式结算 settleSiege）→ 结算面板回天下地图。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-siege-capture-map.mjs   截图在 assets/review/siege-map/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/siege-map';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
// 讨董已通关（第叁章群雄开放未打）；已占官渡（小城），营寨已升县城
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu'], eraSeen: 1, capturedEver: ['guandu'], chapterSeen: 3, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).setWorldRandom(() => .99)); // 不触发攻城后反扑
await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(900);
const M = "window.__game.scene.getScene('WorldMapScene')", G = "window.__game.scene.getScene('SiegeGameScene')";
const city = id => p.evaluate(([M0, id]) => { const s = eval(M0), m = s.cityMarkers.find(x => x.city.id === id); m.hit.emit('pointerover'); const tip = s.children.getByName('world-tip')?.list?.[1]?.text ?? ''; m.hit.emit('pointerout');
  m.hit.emit('pointerup', { getDistance: () => 0 }); return { status: m.root.getData('status'), tag: !!m.root.getByName('attack-tag-' + id), ring: !!m.root.getByName('attack-ring-' + id), iconAlpha: m.root.getData('icon')?.alpha, banner: m.root.getData('banner'), tip, detail: s.detail.text, action: s.action.text.text }; }, [M, id]);
const map = () => p.evaluate(M0 => { const s = eval(M0); return { owned: s.owned, realm: s.layer.list.find(o => o.name === 'world-realm')?.texture.key, guide: s.children.getByName('world-next-label')?.list?.[1]?.text, guideVis: !!s.children.getByName('world-next-label')?.visible, key: !!s.children.getByName('world-map-key'), inks: s.inks.filter(e => e.btn.image.visible).length, test: s.registry.get('chapterTest') }; }, M);

const fogInfo = () => p.evaluate(M0 => { const s = eval(M0), v = Object.fromEntries(s.fogVis), img = s.layer.list.find(o => o.name === 'world-fog'); return { v, tex: img?.texture.key, alpha: img?.alpha, painted: s.fogPainted, tile: s.textures.exists('wfog_tile'), brush: s.textures.get('wfog_brush')?.frameTotal }; }, M);
const zoomShot = async name => { await p.evaluate(M0 => { const s = eval(M0); s.setZoom(s.minZoom, s.area.x + s.area.w / 2, s.area.y + s.area.h / 2); }, M); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${name}` }); };
// ⓪ 战争迷雾：开局视野
const f0 = await fogInfo(), cnt = v => Object.values(v).reduce((o, k) => (o[k] = (o[k] ?? 0) + 1, o), {});
ck('迷雾：手绘宣纸云雾平铺 + 墨晕笔刷挖开，按局面缓存成纹理（官渡、相邻许昌 clear，有半透明圈与迷雾区）', f0.tile && f0.brush >= 4 && /^wfog_v_\d+_guandu_$/.test(f0.tex) && f0.alpha > .8 && f0.v.guandu === 'clear' && f0.v.xuchang === 'clear' && cnt(f0.v).dim > 0 && cnt(f0.v).hidden > 0, { tex: f0.tex, counts: cnt(f0.v) });
const hid = Object.keys(f0.v).find(k => f0.v[k] === 'hidden');
const h0 = await p.evaluate(([M0, id]) => { const s = eval(M0), m = s.cityMarkers.find(x => x.city.id === id); m.hit.emit('pointerover'); const tip = s.children.getByName('world-tip')?.list?.[1]?.text ?? ''; m.hit.emit('pointerout'); m.hit.emit('pointerup', { getDistance: () => 0 }); s.openSiege(m.city); return { label: m.label.text, icon: m.root.getData('icon')?.visible, tip, title: s.detailTitle.text, action: s.action.text.text, enabled: !!s.action.image.input?.enabled, modal: !!s.children.getByName('siege-modal') }; }, [M, hid]);
ck('迷雾下的城：名牌「？」、不画城郭；悬停「迷雾未散，需先攻下相邻城池」；不能出征', h0.label === '？' && h0.icon === false && h0.tip.includes('迷雾未散，需先攻下相邻城池') && h0.title === '迷雾未散' && h0.action === '尚不可攻打' && !h0.enabled && !h0.modal, { hid, ...h0 });
const tagAbove = await p.evaluate(M0 => { const s = eval(M0), fog = s.layer.list.find(o => o.name === 'world-fog'), m = s.cityMarkers.find(x => x.city.id === 'xuchang'), g = s.children.getByName('world-next-label'); const list = s.children.list; return { tag: list.indexOf(m.root) > list.indexOf(s.layer), guide: list.indexOf(g) > list.indexOf(s.layer) }; }, M);
ck('可攻标记与「下一步」引导画在迷雾之上', tagAbove.tag && tagAbove.guide, tagAbove);
await zoomShot('fog-before-overview-1280x720.png');
await p.evaluate(M0 => { const s = eval(M0); s.setZoom(s.minZoom * 1.75, s.area.x + s.area.w / 2, s.area.y + s.area.h / 2); s.centerOnCity(s.cityMarkers.find(m => m.city.id === 'xuchang').city); }, M);
// ① 攻城前：可攻 / 章节未开 / 不相邻
const m0 = await map();
ck('攻城前：我方只有官渡，疆域图按领地生成，有图例与「下一步」引导，界面只留一处水墨笔刷', m0.owned.join() === 'guandu' && /^world_realm_\d_guandu$/.test(m0.realm) && m0.key && !!m0.guide && m0.guideVis && m0.inks <= 1, m0);
const xc = await city('xuchang');
ck('许昌可攻：朱红描边 +「可攻」牌；悬停写城名、档次、守军、推荐等级、奖励', xc.status === 'attack' && xc.tag && xc.ring && /许昌 · 中城 · 豫州 · 可攻/.test(xc.tip) && /守军：\S+ · /.test(xc.tip) && /推荐等级 ★★☆/.test(xc.tip) && /奖励：军粮 \+\d+（首次 \+50%）/.test(xc.tip) && xc.action === '亲征 · 攻城', xc);
const wc = await city('wuchao');
ck('乌巢（与官渡相邻、属第肆章）不可攻：调暗，原因「通关第肆章「官渡之战」后开放攻城」', wc.status === 'gate' && !wc.tag && wc.iconAlpha < .7 && /不可攻/.test(wc.tip) && wc.tip.includes('通关第肆章「官渡之战」后开放攻城') && wc.detail.includes('通关第肆章') && wc.action.endsWith('后开放攻城'), wc);
const ly = await city('luoyang');
ck('洛阳不相邻：调暗，原因写「需先攻下许昌…」', ly.status === 'far' && !ly.tag && ly.iconAlpha < .7 && /需先攻下.*许昌/.test(ly.tip) && /尚不相邻：需先攻下.*许昌/.test(ly.detail) && ly.action === '尚不可攻打', ly);
await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === 'xuchang').hit.emit('pointerup', { getDistance: () => 0 }); }, M); await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/map-before-1280x720.png` });
await p.evaluate(M0 => { const s = eval(M0), m = s.cityMarkers.find(x => x.city.id === 'xuchang'); m.hit.emit('pointerover'); }, M);
await p.screenshot({ path: `${out}/map-hover-attackable.png` });
await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(x => x.city.id === 'xuchang').hit.emit('pointerout'); const m = s.cityMarkers.find(x => x.city.id === 'luoyang'); m.hit.emit('pointerover'); }, M);
await p.screenshot({ path: `${out}/map-hover-locked.png` });
await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(x => x.city.id === 'luoyang').hit.emit('pointerout'); }, M);

// ② 出征攻城（正式结算）
await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === 'chenliu').hit.emit('pointerup', { getDistance: () => 0 }); s.action.image.emit('pointerup'); s.children.getByName('siege-modal').getByName('siege-go').emit('pointerup'); }, M);
await p.waitForFunction(() => window.__game.scene.getScene('SiegeGameScene')?.player && window.__game.scene.isActive('SiegeGameScene'), null, { timeout: 60000 }); await p.waitForTimeout(600);
const g0 = await p.evaluate(G0 => { const s = eval(G0); return { test: s.test, url: location.search }; }, G);
ck('正式模式出征（非测试局、无 ?dev）', !g0.test && !/dev=1/.test(g0.url), g0);
await p.evaluate(G0 => { const s = eval(G0); s.captured = true; s.bossKilled = true; s.finish(true, 'boss'); }, G); await p.waitForTimeout(800);
const r = await p.evaluate(G0 => { const s = eval(G0); return { sub: s.resultTexts.subtitle.text, flag: window.__game.registry.get('mapCaptured') }; }, G);
const sv = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('im_world_v1')); return { owned: s.ownedCities, ever: s.capturedEver, city: s.cities?.chenliu, active: s.active?.state, hall: s.town?.levels?.hall }; });
ck('胜利结算：陈留进 ownedCities 与 capturedEver，城池建筑等级当场写进存档', r.sub.startsWith('陈留归入义军版图') && sv.owned.includes('chenliu') && sv.ever.includes('chenliu') && sv.city?.office === 1 && sv.active === 'settled', { r, sv });
// ③ 回天下地图：「陈留 归入版图」演出
await p.evaluate(G0 => eval(G0).resultPanel.getByName('result-home').emit('pointerdown'), G);
await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene'), null, { timeout: 30000 }); await p.waitForTimeout(1500);
const fx = await p.evaluate(M0 => { const s = eval(M0), root = s.children.getByName('capture-reveal'); return { reveal: !!root, title: root?.getByName('capture-banner')?.getByName('capture-title')?.text, seal: !!root?.getByName('capture-seal'), prev: !!s.layer.list.find(o => o.name === 'world-realm-prev'), sel: s.selected.kind === 'city' && s.selected.city.id }; }, M);
ck('回地图播「陈留 归入版图」：横幅、朱印「归」、旧疆域淡出，并选中陈留', fx.reveal && fx.title === '陈留 归入版图' && fx.seal && fx.sel === 'chenliu', fx);
const fx2 = await p.evaluate(M0 => { const s = eval(M0); return { tex: s.layer.list.find(o => o.name === 'world-fog')?.texture.key, disperse: !!s.layer.list.find(o => o.name === 'fog-disperse') }; }, M);
ck('攻下陈留：迷雾像墨迹退去（先显示旧迷雾逐点擦开 + 手绘云雾散开序列帧），与归入版图一起播', fx2.tex === 'wfog_anim' && fx2.disperse, fx2);
await p.screenshot({ path: `${out}/map-capture-reveal-1280x720.png` });
await p.waitForTimeout(4500);
const back = await p.evaluate(M0 => { const s = eval(M0), cx = s.area.x + s.area.w / 2, cy = (s.area.y + s.viewBottom) / 2; return { off: Math.round(Math.hypot(s.layer.x + 799 * s.zoom - cx, s.layer.y + 573 * s.zoom - cy)), zoom: +(s.zoom / s.minZoom).toFixed(2) }; }, M);
ck('归入版图演出：先对准新攻下的城，播完后镜头平移回义军营寨（州郡档）', back.off <= 3 && Math.abs(back.zoom - 2) < .02, back);
const f1 = await fogInfo();
const opened = Object.keys(f0.v).filter(k => (f0.v[k] === 'hidden' && f1.v[k] !== 'hidden') || (f0.v[k] === 'dim' && f1.v[k] === 'clear'));
ck('演出结束：迷雾纹理换成新局面缓存（含陈留），周边迷雾散开（临淄变清楚，北海、东莱由迷雾变半透明）', /^wfog_v_\d+_guandu\.chenliu_$/.test(f1.tex) && opened.length > 0 && f1.v.linzi === 'clear' && f1.v.beihai === 'dim' && f1.v.donglai === 'dim', { tex: f1.tex, opened });
const m1 = await map(), x1 = await city('chenliu');
ck('地图上陈留归我方：义旗、详情「你的城池」、按钮「进入城池」', m1.owned.includes('chenliu') && x1.status === 'own' && x1.banner === '义' && x1.detail.includes('你的城池') && x1.action === '进入城池' && /我方城池 · 每战 军粮 \+\d+/.test(x1.tip), x1);
ck('疆域图重算并把陈留划进来（纹理键含 chenliu），演出结束后旧疆域图已撤掉', /^world_realm_\d_guandu\.chenliu$/.test(m1.realm) && await p.evaluate(M0 => !eval(M0).layer.list.find(o => o.name === 'world-realm-prev') && !eval(M0).textures.exists('realm_prev_fx'), M), m1);
const lz = await city('linzi'), bh = await city('beihai');
ck('攻下陈留后：临淄现出城名与守军（属第肆章，原因写清），北海仍是半透明、不可攻', lz.status === 'gate' && lz.tip.includes('临淄') && bh.status !== 'fog' && bh.status !== 'attack' && !bh.tag, { lz: lz.tip, bh: bh.status });
const land = await p.evaluate(M0 => { const s = eval(M0); s.children.getByName('world-territory').emit('pointerup'); const t = s.children.getByName('territory-panel')?.list.find(o => o.type === 'Text')?.text; s.children.getByName('world-territory').emit('pointerup'); return { chip: s.children.getByName('world-territory').text, t }; }, M);
ck('领地面板：2 座城，城池列表有陈留，每战产出计入', land.chip.startsWith('领地 2') && /城池：.*陈留/.test(land.t) && /每战产出（各城建筑）：军粮 \+\d+/.test(land.t), land);
await p.evaluate(M0 => { const s = eval(M0); s.cityMarkers.find(m => m.city.id === 'chenliu').hit.emit('pointerup', { getDistance: () => 0 }); }, M); await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/map-after-1280x720.png` });
await zoomShot('fog-after-overview-1280x720.png');
// 迷雾缓存：局面不变时重进地图不重画
await p.evaluate(() => { window.__game.scene.getScene('WorldMapScene').scene.restart(); }); await p.waitForTimeout(1200);
const f2 = await fogInfo();
ck('迷雾按局面缓存：重进地图直接复用纹理，不重画', f2.tex === f1.tex && f2.painted === false, { tex: f2.tex, painted: f2.painted });
// ④ 营寨：城池数与每战城池产出
await p.evaluate(() => { window.__game.scene.getScene('WorldMapScene').scene.start('CityScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('CityScene')); await p.waitForTimeout(900);
const camp = await p.evaluate(async () => { const s = window.__game.scene.getScene('CityScene'), w = await import('/src/world/WorldStore.ts'), d = await import('/src/data/cityBuildings.ts'), c = await import('/src/world/WorldCities.ts'); const ws = w.loadWorld(); const grain = ws.ownedCities.reduce((n, id) => n + d.cityIncome(c.cityById(id).tier, w.cityLevels(id, ws)).grain, 0); return { text: s.children.getByName('city-domain')?.text, grain }; });
ck('营寨顶栏看得到城池：「城池 2 · 每战 军粮 +N」与各城产出合计一致', camp.text === `城池 2 · 每战 军粮 +${camp.grain}`, camp);
await p.screenshot({ path: `${out}/camp-domain-1280x720.png` });
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
