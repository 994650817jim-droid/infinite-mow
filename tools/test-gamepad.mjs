// Steam 版 S2：手柄支持 + Steam Deck（1280×800）界面检查。
// 用伪造的 navigator.getGamepads（标准映射虚拟手柄，见 pad-harness.mjs）只用手柄操作：
// 主页 → 选将 → 出征 → 移动 / 用药 / 护阵 / 暂停 / 滑条 → 三选一 → 打完一关进行营 → 率军出征下一关 → 阵亡结算返回；
// 设置面板、天下地图、主城的焦点导航与 Ⓑ 返回；按键提示随输入设备切换；Deck 分辨率截图 + 可点区域重叠 / 出界检查。
// 需要开发服务器 5173。用法：node tools/test-gamepad.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { PADJS, padApi } from './pad-harness.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/steam-s2';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const DECK = { viewport: { width: 1280, height: 800 } };
const G = "window.__game.scene.getScenes(true).find(s => s.player)";
const st = p => p.evaluate(G0 => { const g = eval(G0); return { scenes: window.__game.scene.getScenes(true).map(s => s.sys.settings.key).join(','), mode: g?.mode, over: g?.over, x: Math.round(g?.player?.x ?? 0), y: Math.round(g?.player?.y ?? 0), level: g?.player?.level, stage: g?.yellowStage ?? g?.stage }; }, G);
/** 可点区域：两两不重叠（容差 2px）、全部在 960×540 设计画面内。 */
async function layoutCheck(pad, name) {
  const c = await pad.cands();
  const outside = c.filter(r => r.x < -1 || r.y < -1 || r.x + r.w > 961 || r.y + r.h > 541).map(r => r.name || r.text);
  const overlaps = [];
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    const a = c[i], d = c[j], ox = Math.min(a.x + a.w, d.x + d.w) - Math.max(a.x, d.x), oy = Math.min(a.y + a.h, d.y + d.h) - Math.max(a.y, d.y);
    if (ox > 2 && oy > 2) overlaps.push(`${a.name || a.text}×${d.name || d.text}`);
  }
  ck(`Deck ${name}：可点区域 ${c.length} 个，无出界、无重叠`, c.length > 0 && !outside.length && !overlaps.length, { outside, overlaps });
}
const shot = (p, name) => p.screenshot({ path: `${out}/deck-${name}.png` });
// 老存档（带 im_last_hero、还没定主公）进主页会先弹「主公 · xx」确认窗（主公规则 2026-11-16），手柄焦点都在它上面 → 选「就用 xx」关掉
async function keepLord(p, pad) {
  const c = await pad.cands(); if (!c.some(x => x.name === 'lord-keep')) return false;
  await pad.focusTo(f => f.name === 'lord-keep'); await pad.press('A'); await p.waitForTimeout(400); return true;
}
async function newPage(seed) {
  const p = await b.newPage(DECK);
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
  await p.addInitScript(PADJS);
  if (seed) await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, seed);
  return p;
}

// ———— 1. 新存档：主页 → 选将 → 出征，战斗操作 ————
{
  const p = await newPage({});
  await p.goto(base + '?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  const pad = padApi(p);
  await shot(p, 'home');
  await pad.press('A'); await p.waitForTimeout(500);
  const picker = await pad.focus();
  ck('主页 Ⓐ（默认焦点「匡扶汉室」）→ 新存档先弹选将，焦点在「确认出战」', picker?.name === 'hero-confirm', picker);
  await shot(p, 'hero-picker'); await layoutCheck(pad, '选将');
  await pad.press('LEFT'); const moved = await pad.focus();
  ck('选将：方向键移动焦点', moved && moved.name !== 'hero-confirm', moved);
  await pad.press('B'); await p.waitForTimeout(300);
  const closed = await p.evaluate(() => !window.__game.scene.getScene('MenuScene').heroModal?.visible);
  ck('Ⓑ 关闭选将弹窗', closed);
  // Ⓐ 重新打开选将 → Ⓐ 第一次「确认出战」（新存档要定主公：只弹「主公选定后不可更改 · 再点一次」提示）→ Ⓐ 第二次才确认（主公规则 2026-11-16）
  await pad.press('A'); await p.waitForTimeout(400); await pad.press('A'); await p.waitForTimeout(400);
  const armed = await p.evaluate(() => window.__game.scene.getScene('MenuScene').children.getByName?.('hero-locked-hint')?.text ?? [...window.__game.scene.getScene('MenuScene').children.list].flatMap(o => o.list ?? [o]).find(o => o.name === 'hero-locked-hint')?.text ?? '');
  ck('新存档第一次「确认出战」先提示主公选定后不可更改', /再点一次/.test(armed), armed);
  await pad.press('A'); await p.waitForTimeout(400);
  const home2 = await pad.focus();
  ck('确认出战后焦点回到「匡扶汉室」', home2?.name === 'start-campaign', home2);
  await layoutCheck(pad, '主页');
  await pad.press('A');
  await p.waitForFunction(G0 => eval(G0)?.mode === 'none', G, { timeout: 20000 });
  await p.waitForTimeout(600);
  await p.evaluate(G0 => { const g = eval(G0); g.player.damageImmune = true; g.spawnTimer = 1e9; }, G);
  const s0 = await st(p);
  await pad.stick(1, 0.4, 700);
  const s1 = await st(p);
  ck('Ⓐ 出征进入战斗；左摇杆移动主角', s0.scenes === 'GameScene' && s1.x - s0.x > 60, { s0, s1 });
  const dpad0 = await st(p); await p.evaluate(() => { window.__vpad.buttons[13] = 1; }); await p.waitForTimeout(500); await p.evaluate(() => { window.__vpad.buttons[13] = 0; }); const dpad1 = await st(p);
  ck('十字键也能移动', dpad1.y - dpad0.y > 40, { dpad0, dpad1 });
  const hints = await p.evaluate(G0 => { const g = eval(G0); return { potion: g.potionCaption?.text, pause: g.hudTexts.pause.text, order: g.legionUI.keyHint?.text }; }, G);
  ck('用手柄时 HUD 提示换成手柄键（用药 Ⓧ / 暂停 ☰ / 护阵 Ⓨ）', hints.potion === '用药 Ⓧ' && hints.pause === '☰ 暂停' && hints.order === 'Ⓨ', hints);
  await shot(p, 'battle-hud');
  const o0 = await p.evaluate(G0 => eval(G0).legion.order, G); await pad.press('Y'); const o1 = await p.evaluate(G0 => eval(G0).legion.order, G);
  ck('Ⓨ 切换护阵 / 出击', o0 !== o1, { o0, o1 });
  const potion = await p.evaluate(G0 => { const g = eval(G0); g.player.hp = g.player.maxHp * .5; g.supplies.pouch.length = 0; g.supplies.pouch.push({ amount: 20, texture: 'healing_potion', name: '药瓶' }); return g.supplies.pouch.length; }, G);
  await pad.press('X');
  const potion1 = await p.evaluate(G0 => eval(G0).supplies.pouch.length, G);
  ck('Ⓧ 用药（药囊 -1）', potion === 1 && potion1 === 0, { potion, potion1 });
  await pad.press('START');
  const paused = await st(p), pf = await pad.focus();
  ck('☰ 暂停，焦点在「继续战斗」', paused.mode === 'pause' && pf?.name === 'pause-resume', { mode: paused.mode, pf });
  await shot(p, 'pause'); await layoutCheck(pad, '暂停');
  // 滑条：下移到战场音乐，右键 +10%
  let slider = null;
  for (let i = 0; i < 4 && !slider; i++) { await pad.press('DOWN'); const f = await p.evaluate(() => !!window.__pad.focused?.getData?.('padAdjust')); if (f) slider = true; }
  const v0 = await p.evaluate(G0 => eval(G0).music.getVolume(), G); await pad.press('RIGHT'); const v1 = await p.evaluate(G0 => eval(G0).music.getVolume(), G);
  await pad.press('LEFT');
  ck('暂停面板：焦点到音量滑条，左右键调节', slider && Math.round(v1 - v0) === 10, { v0, v1 });
  await pad.press('B');
  ck('Ⓑ 继续战斗', (await st(p)).mode === 'none');
  // 三选一
  const lv0 = await p.evaluate(G0 => { const g = eval(G0); g.devGrantLevels?.(1, false); return { mode: g.mode, level: g.player.level }; }, G);
  await p.waitForTimeout(300);
  const card = await pad.focus();
  await shot(p, 'levelup'); await layoutCheck(pad, '三选一');
  const cardHint = await p.evaluate(G0 => eval(G0).cardViews.map(v => v.hint.text), G);
  await pad.press('RIGHT'); const card2 = await pad.focus();
  await pad.press('A'); await p.waitForTimeout(200);
  const lv1 = await st(p);
  ck('三选一：焦点在卡片上、提示「Ⓐ 选择」、左右换卡、Ⓐ 选中后回到战斗', lv0.mode === 'levelup' && /^upgrade-card-/.test(card?.name) && cardHint.every(t => t === 'Ⓐ 选择') && card2?.name !== card?.name && lv1.mode === 'none', { lv0, card, card2, cardHint, lv1: lv1.mode });
  // 键鼠接管后提示恢复
  await p.keyboard.press('Shift');
  const kb = await p.evaluate(G0 => { const g = eval(G0); return { potion: g.potionCaption?.text, pause: g.hudTexts.pause.text, order: g.legionUI.keyHint?.text, frame: window.__game.scene.getScene('GameScene').children.list.some(o => o.type === 'Graphics' && o.depth === 1e7 && o.visible) }; }, G);
  ck('按键盘后提示恢复为键盘（用药 / 暂停 / E）、焦点框隐藏', kb.potion === '用药' && kb.pause === '暂停' && kb.order === 'E' && !kb.frame, kb);

  // ———— 2. 只用手柄打完一关：三选一 / 招募 / 战利品全部用 Ⓐ，行营里「率军出征」进下一关 ————
  await p.evaluate(G0 => { const g = eval(G0); g.player.damageImmune = true; g.devOneHit = true; g.devTimeScale = 5; g.spawnTimer = 0; }, G);
  const t0 = Date.now(); let ang = 0, rest = null, modes = new Set(), firstStage = (await st(p)).stage;
  while (Date.now() - t0 < 150000) {
    const s = await st(p);
    if (s.mode) modes.add(s.mode);
    if (s.mode === 'rest') { rest = s; break; }
    if (s.mode === 'none') { ang += .8; await pad.stick(Math.cos(ang), Math.sin(ang), 350); continue; }
    await pad.press('A'); await p.waitForTimeout(200);
  }
  ck('只用手柄打完一关进入行营（经过的界面：' + [...modes].join('/') + '）', !!rest, rest);
  if (rest) {
    // 入营先播水墨过场：Ⓐ 跳过
    await p.waitForTimeout(300);
    const introShown = await p.evaluate(G0 => !!eval(G0).children.getByName('rest-intro'), G);
    await pad.press('A'); await p.waitForTimeout(300);
    ck('入营水墨过场可用 Ⓐ 跳过', introShown && !(await p.evaluate(G0 => !!eval(G0).children.getByName('rest-intro'), G)));
    const rf = await pad.focus();
    await shot(p, 'camp-rest'); await layoutCheck(pad, '行营');
    await pad.press('A');
    await p.waitForFunction(G0 => eval(G0)?.mode === 'none' && !eval(G0).over, G, { timeout: 20000 });
    const next = await st(p);
    ck('行营默认焦点「率军出征」，Ⓐ 进入下一关', rf?.name === 'camp-depart' && next.mode === 'none', { rf, firstStage, stage: next.stage });
  }
  // ———— 3. 阵亡结算：手柄返回 ————
  await p.evaluate(G0 => { const g = eval(G0); g.finish(false); }, G);
  await p.waitForTimeout(1200);
  const rf = await pad.focus(), rs = await st(p);
  await shot(p, 'result'); await layoutCheck(pad, '结算');
  ck('阵亡结算界面有焦点按钮', rs.mode === 'result' && !!rf, { rs: rs.mode, rf });
  let left = false;
  for (let i = 0; i < 6 && !left; i++) { await pad.press('A'); await p.waitForTimeout(800); left = !(await st(p)).scenes.includes('GameScene') || (await st(p)).mode === 'none'; if (!left) await pad.press('DOWN'); }
  ck('结算界面用 Ⓐ 离开（返回主页或再战）', left, await st(p));
  await p.close();
}

// ———— 4. 设置面板 / 图鉴 / 战役回顾 ————
{
  const p = await newPage({ im_last_hero: 'zhaoyun' });
  await p.goto(base + '?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  const pad = padApi(p);
  await keepLord(p, pad);
  await pad.press('DOWN');
  const sf = await pad.focusTo(f => f.name === 'home-settings');
  await pad.press('A'); await p.waitForTimeout(300);
  const opened = await p.evaluate(() => !!window.__game.scene.getScene('MenuScene').children.getByName('home-settings-panel'));
  ck('方向键移到「设置」，Ⓐ 打开', !!sf && opened, sf);
  await shot(p, 'settings'); await layoutCheck(pad, '设置');
  await pad.focusTo(f => /^settings-row-0-/.test(f.name));
  const m0 = await p.evaluate(() => localStorage.getItem('im_bgm_vol') ?? '40');
  await pad.press('LEFT');
  const m1 = await p.evaluate(() => localStorage.getItem('im_bgm_vol'));
  ck('设置：焦点在音乐行时左键 -10%', Number(m1) === Number(m0) - 10, { m0, m1 });
  await pad.press('B'); await p.waitForTimeout(200);
  ck('Ⓑ 关闭设置', !(await p.evaluate(() => !!window.__game.scene.getScene('MenuScene').children.getByName('home-settings-panel'))));
  for (const [name, label] of [['home-codex', '图鉴'], ['home-review', '战役回顾']]) {
    await pad.focusTo(f => f.name === name);
    await pad.press('A'); await p.waitForTimeout(700);
    const inside = await pad.cands();
    await shot(p, name); await layoutCheck(pad, label);
    await pad.press('B'); await p.waitForTimeout(500);
    const back = await pad.cands();
    ck(`${label}：Ⓐ 打开、Ⓑ 关闭回主页`, !inside.some(c => c.name === name) && back.some(c => c.name === 'start-campaign'), { inside: inside.length, back: back.map(c => c.name).slice(0, 8) });
  }
  await p.close();
}

// ———— 5. 天下地图与主城（已解锁存档） ————
{
  const world = { version: 7, yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 100, provisions: 200, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [] };
  const p = await newPage({ im_world_v1: JSON.stringify(world), im_last_hero: 'zhaoyun' });
  await p.goto(base + '?layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const pad = padApi(p);
  await keepLord(p, pad);
  await pad.press('UP');
  const wf = await pad.focusTo(f => f.name === 'home-world');
  await pad.press('A'); await p.waitForTimeout(1500);
  const inWorld = await p.evaluate(() => window.__game.scene.getScene('WorldMapScene')?.sys.isActive());
  ck('主页 → 天下地图（手柄）', !!wf && inWorld, wf);
  if (inWorld) {
    await pad.press('RIGHT'); await p.waitForTimeout(200);
    const f1 = await pad.focus(); await pad.press('DOWN'); const f2 = await pad.focus();
    ck('天下地图：焦点可在城池 / 按钮间移动', !!f1 && !!f2, { f1, f2 });
    await shot(p, 'world-map');
  }
  await p.goto(base + '?layout=desktop'); await p.waitForFunction(() => window.__game?.scene.getScene('MenuScene')?.sys.isActive(), null, { timeout: 30000 }); await p.waitForTimeout(1200);
  await keepLord(p, pad);
  await pad.press('UP');
  const cf = await pad.focusTo(f => f.name === 'home-city');
  await pad.press('A'); await p.waitForTimeout(1500);
  const inCity = await p.evaluate(() => window.__game.scene.getScene('CityScene')?.sys.isActive());
  ck('主页 → 主城（手柄）', !!cf && inCity, cf);
  if (inCity) { await shot(p, 'city'); await layoutCheck(pad, '主城'); }
  await p.close();
}

ck('无 pageerror / 控制台错误', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
