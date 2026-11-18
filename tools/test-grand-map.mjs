// 宏大版天下地图（2026-11-18 用户「天下地图可以做宏大点」）：新舆图分块按需载入、镜头三档（全国 / 州郡 / 城池）、
// 平移、滚轮换档、双击城池推近、打开时聚焦我方与下一目标、坐标迁移校验（城池 / 章节 / 关卡点都落在新图陆地上、水域与旧图吻合）、
// 与战争迷雾叠加、军旗飘动、势力图例、帧率；手机版不报错。
// 用法：BASE=http://127.0.0.1:5180/ node tools/test-grand-map.mjs   截图在 assets/review/grand-map/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/grand-map';
mkdirSync(out, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const save = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao', 'qunxiong'], ownedCities: ['guandu'], eraSeen: 1, capturedEver: ['guandu'], chapterSeen: 3, tutorialDone: true };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const open = async layout => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(layout + ' ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); localStorage.setItem('im_home_seen', '1'); localStorage.setItem('im_tutorial_done', '1'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__game.scene.getScene('MenuScene').scene.start('WorldMapScene'); }); await p.waitForFunction(() => window.__game.scene.isActive('WorldMapScene')); await p.waitForTimeout(1500);
  return p;
};
const M = "window.__game.scene.getScene('WorldMapScene')";
const p = await open('desktop');
const view = () => p.evaluate(M0 => { const s = eval(M0); return { zoom: s.zoom / s.minZoom, tier: s.children.getByName('world-zoom-tier')?.text, lx: s.layer.x, ly: s.layer.y, tiles: s.tiles.map(t => ({ k: t.r + '' + t.c, img: !!t.img, vis: !!t.img?.visible, loading: t.loading })) }; }, M);

// ① 坐标迁移：城池 / 营寨 / 章节节点 / 关卡点在界内、落在新舆图陆地上；新旧图水域吻合
const coords = await p.evaluate(async M0 => {
  const s = eval(M0), W = 1536, H = 1024;
  const mask = async src => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4; const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data, m = new Uint8Array(c.width * c.height), grey = /water_mask/.test(src); for (let i = 0; i < m.length; i++) { const r = d[i * 4], gg = d[i * 4 + 1], bb = d[i * 4 + 2]; m[i] = grey ? (r > 128 ? 1 : 0) : bb > r + 25 && bb > 95 && bb >= gg - 12 ? 1 : 0; } return { m, w: c.width, h: c.height }; };
  // 水域图（旧战略图算出，新舆图按它 1:1 重绘）；新图上水域处应明显比陆地偏青（b−r 均值差），错位时这个差会塌掉
  const old = await mask('assets/world/strategy-map.webp');
  const pix = async src => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4; const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height).data; };
  const nd = await pix('assets/world/grand/overview.webp'); let sw = 0, nw = 0, sl = 0, nl = 0; for (let i = 0; i < old.m.length; i++) { const v = nd[i * 4 + 2] - nd[i * 4]; if (old.m[i]) { sw += v; nw++; } else { sl += v; nl++; } }
  const shifted = await (async () => { let a = 0, n = 0; for (let y = 0; y < old.h; y++) for (let x = 0; x < old.w; x++) { const j = y * old.w + Math.min(old.w - 1, x + 24); if (old.m[j]) { const i = y * old.w + x; a += nd[i * 4 + 2] - nd[i * 4]; n++; } } return a / n - sl / nl; })();
  const wm = await mask('assets/world/grand/water_mask.png'), wet = (x, y) => { let n = 0, t = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = Math.round(x / 4) + dx, yy = Math.round(y / 4) + dy; if (xx < 0 || yy < 0 || xx >= wm.w || yy >= wm.h) continue; t++; n += wm.m[yy * wm.w + xx]; } return n / t > .5; };
  const pts = [...s.cityMarkers.map(m => ({ id: 'city:' + m.city.id, x: m.city.x, y: m.city.y })), { id: 'home', x: 799, y: 573 }, ...s.markers.map(m => ({ id: 'node:' + m.node.id, x: m.node.x * W, y: m.node.y * H }))];
  const STAGES = (await import('/src/world/ChapterTimeline.ts')).STAGE_POINTS; for (const [ch, list] of Object.entries(STAGES)) list.forEach((q, i) => pts.push({ id: `stage:${ch}-${i + 1}`, x: q.x, y: q.y }));
  const outOf = pts.filter(q => q.x < 0 || q.y < 0 || q.x > W || q.y > H).map(q => q.id), onWater = pts.filter(q => q.id.startsWith('city:') && wet(q.x, q.y)).map(q => q.id);
  // 屏幕位置 = 地图层变换
  const drift = s.cityMarkers.map(m => Math.hypot(m.root.x - (s.layer.x + m.city.x * s.zoom), m.root.y - (s.layer.y + m.city.y * s.zoom))).reduce((a, b) => Math.max(a, b), 0);
  return { n: pts.length, cities: s.cityMarkers.length, outOf, onWater, contrast: +(sw / nw - sl / nl).toFixed(1), shifted: +shifted.toFixed(1), drift: +drift.toFixed(2) };
}, M);
ck('坐标迁移：31 城、营寨、章节节点、全部关卡点都在图内；城池都落在新舆图陆地上；新图在旧图水域处明显偏青（对齐；错开 24 格后差值明显变小）；标记跟随地图层变换', coords.cities === 31 && coords.outOf.length === 0 && coords.onWater.length === 0 && coords.contrast >= 25 && coords.shifted < coords.contrast * .75 && coords.drift < .5, coords);

// ② 打开时聚焦：以义军营寨为中心、州郡档
const t0 = await view(), want = await p.evaluate(M0 => { const s = eval(M0), z = s.zoom, a = s.area, x0 = (a.x - s.layer.x) / z, y0 = (a.y - s.layer.y) / z, x1 = x0 + a.w / z, y1 = y0 + a.h / z, out = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (c * 512 < x1 && (c + 1) * 512 > x0 && r * 1024 / 3 < y1 && (r + 1) * 1024 / 3 > y0) out.push(r + '' + c); return out; }, M);
const got = t0.tiles.filter(t => t.img || t.loading).map(t => t.k);
ck('分块按需载入：打开时只载入最终视野碰到的块（不是全部预载）', got.length > 0 && got.join() === want.join(), { got, want });
// 2026-11-18 用户「展开天下地图后，请视角定位在义军营寨那里」：以营寨为中心、州郡档；「下一步」在视野外只在屏幕边缘给箭头
const focusInfo = () => p.evaluate(M0 => { const s = eval(M0), t = s.guideTarget, cx = s.area.x + s.area.w / 2, cy = (s.area.y + s.viewBottom) / 2, hx = s.layer.x + 799 * s.zoom, hy = s.layer.y + 573 * s.zoom, inView = (x, y) => { const sx = s.layer.x + x * s.zoom, sy = s.layer.y + y * s.zoom; return sx > s.area.x + 24 && sx < s.area.x + s.area.w - 24 && sy > s.area.y + 24 && sy < s.viewBottom - 24; }, e = s.children.getByName('world-next-edge'); return { zoom: +(s.zoom / s.minZoom).toFixed(3), off: Math.round(Math.hypot(hx - cx, hy - cy)), target: t ? inView(t.x, t.y) : null, edge: !!e?.visible, guide: t?.text }; }, M);
const f0 = await focusInfo();
ck('打开地图：镜头以义军营寨为中心、州郡档；「下一步」目标在视野内则不显示边缘箭头', f0.off <= 2 && Math.abs(f0.zoom - 2) < .01 && f0.edge === (f0.target === false), f0);
// 把镜头拉到远处：「下一步」出了视野 → 屏幕边缘出现方向箭头，镜头不动
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(150, 150, s.minZoom * 3.6, 0); }, M); await p.waitForTimeout(200);
const f1 = await focusInfo(), edgeAngle = await p.evaluate(M0 => { const s = eval(M0), e = s.children.getByName('world-next-edge'), t = s.guideTarget, b = { x: s.layer.x + t.x * s.zoom, y: s.layer.y + t.y * s.zoom }, a = Math.atan2(b.y - e.y, b.x - e.x), r = e.getByName('world-next-edge-arrow').rotation; return Math.round(Math.abs(Math.atan2(Math.sin(a - r), Math.cos(a - r))) * 57); }, M);
ck('「下一步」在视野外：屏幕边缘出现小箭头，指向目标方向', f1.target === false && f1.edge && edgeAngle < 20, { ...f1, edgeAngle });
await p.screenshot({ path: `${out}/next-edge-arrow-1280x720.png` });
await p.evaluate(M0 => { const s = eval(M0); s.focusPlayer(0); }, M);
await p.screenshot({ path: `${out}/open-focus-1280x720.png` });

// ③ 镜头三档：滚轮换档（全国 → 州郡 → 城池），分块按需载入、只显示视野内的块
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(768, 512, s.minZoom, 0); }, M); await p.waitForTimeout(400);
const z1 = await view();
await p.screenshot({ path: `${out}/tier-1-nation-1280x720.png` });
await p.mouse.move(560, 360); await p.mouse.wheel(0, -120); await p.waitForTimeout(700);
const z2 = await view();
await p.mouse.wheel(0, -120); await p.waitForTimeout(700);
await p.waitForFunction(M0 => { const s = eval(M0); return s.tiles.every(t => !t.loading); }, M, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(400);
const z3 = await view();
ck('滚轮按档缩放：全国 → 州郡 → 城池（档位字随之变），城池档不能再放大', z1.tier === '全国' && Math.abs(z1.zoom - 1) < .01 && z2.tier === '州郡' && Math.abs(z2.zoom - 2) < .01 && z3.tier === '城池' && Math.abs(z3.zoom - 3.6) < .01, { z1: [z1.tier, z1.zoom], z2: [z2.tier, z2.zoom], z3: [z3.tier, z3.zoom] });
const vis3 = z3.tiles.filter(t => t.vis).length, made3 = z3.tiles.filter(t => t.img).length;
ck('只画镜头范围内的分块：全国档不画分块（用低清总图），城池档只显示视野内的块（≤4 块）', z1.tiles.every(t => !t.vis) && vis3 >= 1 && vis3 <= 4, { z1: z1.tiles.filter(t => t.vis).length, vis3, made3 });
await p.screenshot({ path: `${out}/tier-3-city-1280x720.png` });
// 平移：拖动地图
const before = await view();
await p.mouse.move(600, 400); await p.mouse.down(); await p.mouse.move(400, 300, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
const after = await view();
ck('拖动平移：地图层跟着鼠标移动（窗口 1280 → 逻辑 960，拖 −200/−100 像素 = −150/−75）', Math.abs(after.lx - before.lx - -150) < 2 && Math.abs(after.ly - before.ly - -75) < 2, { dx: after.lx - before.lx, dy: after.ly - before.ly });
// 帧率：城池档平移 2 秒
const fps = await p.evaluate(async M0 => { const s = eval(M0); const g = window.__game; const t0 = performance.now(); let frames = 0; await new Promise(r => { const step = () => { frames++; s.layer.x -= 3; s.clampMap(); if (performance.now() - t0 < 2000) requestAnimationFrame(step); else r(); }; requestAnimationFrame(step); }); return { raf: +(frames / ((performance.now() - t0) / 1000)).toFixed(1), loop: +g.loop.actualFps.toFixed(1) }; }, M);
ck('城池档平移时帧率稳定（≥ 55 帧）', fps.raf >= 55 && fps.loop >= 55, fps);
// ④ 双击城池推近（从全国档）
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(768, 512, s.minZoom, 0); }, M); await p.waitForTimeout(200);
const dbl = await p.evaluate(async M0 => { const s = eval(M0), m = s.cityMarkers.find(x => x.city.id === 'xuchang'); m.hit.emit('pointerup', { getDistance: () => 0 }); m.hit.emit('pointerup', { getDistance: () => 0 }); await new Promise(r => setTimeout(r, 700)); const cx = s.area.x + s.area.w / 2, cy = (s.area.y + s.viewBottom) / 2; return { zoom: s.zoom / s.minZoom, tier: s.children.getByName('world-zoom-tier').text, off: Math.round(Math.hypot(m.root.x - cx, m.root.y - cy)), sel: s.selected.kind === 'city' && s.selected.city.id }; }, M);
ck('双击城池：镜头推到城池档并对准该城、选中它', Math.abs(dbl.zoom - 3.6) < .01 && dbl.tier === '城池' && dbl.off < 30 && dbl.sel === 'xuchang', dbl);
await p.waitForFunction(M0 => eval(M0).tiles.every(t => !t.loading), M, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/dblclick-xuchang-1280x720.png` });
// ⑤ 与迷雾叠加：迷雾在分块之上、标记在迷雾之上
const stack = await p.evaluate(M0 => { const s = eval(M0), L = s.layer.list, fi = L.findIndex(o => o.name === 'world-fog'), ti = L.map((o, i) => /^world-tile-/.test(o.name ?? '') ? i : -1).filter(i => i >= 0), ri = L.findIndex(o => o.name === 'world-realm'); return { fog: fi, realm: ri, tiles: ti, markerAbove: s.children.list.indexOf(s.cityMarkers[0].root) > s.children.list.indexOf(s.layer) }; }, M);
ck('叠加次序：舆图分块 < 势力疆域 < 战争迷雾 < 城池标记', stack.tiles.length > 0 && Math.max(...stack.tiles) < stack.realm && stack.realm < stack.fog && stack.markerAbove, stack);
// ⑥ 军旗飘动（手绘 8 帧）、势力图例
const flags = await p.evaluate(async M0 => { const s = eval(M0), sprites = s.cityMarkers.flatMap(m => (m.root.getData('flag') ?? []).filter(o => o.type === 'Sprite')); const f0 = sprites.map(o => o.frame.name); await new Promise(r => setTimeout(r, 600)); const changed = sprites.filter((o, i) => o.frame.name !== f0[i]).length; return { n: sprites.length, playing: sprites.filter(o => o.anims.isPlaying).length, changed, tint: sprites[0]?.tintTopLeft }; }, M);
ck('各势力军旗用手绘 8 帧飘动（染势力色）', flags.n >= 10 && flags.playing === flags.n && flags.changed > 0, flags);
const leg = await p.evaluate(M0 => { const s = eval(M0), L = s.children.getByName('world-faction-strip'), rows = L?.list.filter(o => /^faction-row-/.test(o.name ?? '')).map(o => o.text) ?? []; const v0 = L?.visible; s.children.getByName('world-factions').emit('pointerup'); const v1 = L?.visible; s.children.getByName('world-factions').emit('pointerup'); return { v0, v1, rows }; }, M);
ck('左上角势力图例：默认展开、列出各势力（我方置顶）与城数，可收起', leg.v0 === true && leg.v1 === false && leg.rows[0] === '义军' && leg.rows.length >= 4, leg);
// ⑦ 地图动态：浮云（全国 / 州郡档飘，城池档收起）、江河流光、有战事处冒狼烟；镜头外的暂停不画
const amb = async () => p.evaluate(M0 => { const s = eval(M0), cl = s.clouds, glint = s.ambient.filter(o => o.name === 'ambient-glint'), smoke = s.ambient.filter(o => /^ambient-smoke-/.test(o.name)); return { clouds: cl.length, cloudsVis: cl.filter(c => c.visible).length, glint: glint.length, glintPlaying: glint.filter(o => o.visible && o.anims.isPlaying).length, glintHidden: glint.filter(o => !o.visible && o.anims.isPaused).length, smoke: smoke.map(o => o.name), smokePlaying: smoke.filter(o => o.anims.isPlaying || !o.visible).length, war: [...new Set([...s.alerts.map(a => a.city), ...s.intel.map(e => e.city)])], tex: s.textures.get('wgrand_ambient')?.frameTotal }; }, M);
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(768, 512, s.minZoom, 0); }, M); await p.waitForTimeout(600);
const a1 = await amb();
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(300, 300, s.minZoom * 3.6, 0); }, M); await p.waitForTimeout(400);
const a3 = await amb();
ck('地图动态：手绘浮云 5 朵（全国档飘、城池档收起）、江河流光 13 处、军情 / 告急城上冒狼烟；镜头外的流光暂停', a1.tex >= 32 && a1.clouds === 5 && a1.cloudsVis === 5 && a3.cloudsVis === 0 && a1.glint === 13 && a1.glintPlaying >= 10 && a3.glintHidden > 0 && a1.smoke.length >= 1 && a1.smoke.length === a1.war.filter(Boolean).length && a1.smokePlaying === a1.smoke.length, { a1, a3: { cloudsVis: a3.cloudsVis, glintHidden: a3.glintHidden } });
// 全国档总览截图（带迷雾）
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(768, 512, s.minZoom, 0); }, M); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/overview-fog-1280x720.png` });
await p.evaluate(M0 => { const s = eval(M0); s.flyTo(700, 420, s.minZoom * 2, 0); }, M); await p.waitForFunction(M0 => eval(M0).tiles.every(t => !t.loading), M, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/tier-2-province-1280x720.png` });
await p.close();
// ⑦ 手机版：不报错
const q = await open('mobile');
const mob = await q.evaluate(M0 => { const s = eval(M0); return { markers: s.cityMarkers.length, zoom: s.zoom / s.minZoom }; }, M);
ck('手机版打开天下地图不报错', mob.markers === 31, mob);
await q.close();
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 4));
process.exit(fail ? 1 : 0);
