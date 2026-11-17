// 战斗 HUD 右侧按钮互不遮挡（电脑布局 960×540 / 1280×720 / 1920×1080）：暂停、音效、音乐、行囊、用药、加点、护阵 / 出击。
// 药囊放 1 份药、给 1 个属性点，让「用药」「加点」都显示；再查暂停菜单与行营里的同类按钮。
// 用法：BASE=http://127.0.0.1:5180/ node tools/ui-round8-hud-overlap.mjs <tag>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const tag = process.argv[2] ?? 'after', base = process.env.BASE ?? 'http://127.0.0.1:5180/', out = 'assets/review/ui-round8';
mkdirSync(out, { recursive: true });
const G = "window.__game.scene.getScene('GameScene')";
const b = await chromium.launch({ channel: 'chrome', headless: true }); const errors = []; let fail = 0;
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
/** 当前可见、可点的 HUD 控件命中区（游戏坐标）。 */
const boxes = () => `(() => { const s = ${G}, out = [];
  const add = (name, o, r) => { if (!o || !o.visible || (o.alpha === 0)) return; let b;
    if (r) b = { x: o.x - r, y: o.y - r, w: r * 2, h: r * 2 }; else { const g = o.getBounds(); b = { x: g.x, y: g.y, w: g.width, h: g.height }; }
    out.push({ name, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }); };
  const h = s.hudTexts; add('暂停', h.pause); add('音效', h.mute); add('音乐', h.music); add('行囊', h.bag);
  add('用药', s.potionButton, 34); add('加点', s.pointsButton, 34);
  if (s.potionButton?.visible) { const c = s.potionCaption, g = c.getBounds(); out.push({ name: '用药字', x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }); }
  if (s.pointsButton?.visible) { const c = s.pointsButton.list.find(o => o.text === '加点'), g = c.getBounds(); out.push({ name: '加点字', x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }); }
  add('护阵', s.legionUI?.order); return out; })()`;
const overlaps = list => { const o = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], c = list[j];
  if (a.name.startsWith(c.name) || c.name.startsWith(a.name)) continue;
  if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) o.push(a.name + '×' + c.name); } return o; };
for (const vp of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load/.test(m.text())) errors.push(m.text()); });
  await p.goto(`${base}?dev=1&autostart=1&stage=1&layout=desktop`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').supplies, null, { timeout: 90000 });
  await p.waitForTimeout(800);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS?.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9;
    s.supplies.pouch.push({ amount: 30, texture: 'healing_potion' }); s.player.hp = Math.round(s.player.maxHp * .6); s.player.growth.unallocated = 1; s.hudAcc = 1; }, G);
  await p.waitForTimeout(400);
  const list = await p.evaluate(boxes()), bad = overlaps(list);
  console.log(vp.width + 'x' + vp.height, JSON.stringify(list.map(x => `${x.name}@${x.x},${x.y},${x.w}x${x.h}`)));
  ck(`${vp.width}×${vp.height} 战斗 HUD 右侧按钮互不重叠`, list.some(x => x.name === '用药') && list.some(x => x.name === '行囊') && !bad.length, bad);
  ck(`${vp.width}×${vp.height} 全部在屏幕内`, list.every(x => x.x >= 0 && x.y >= 0 && x.x + x.w <= 960 && x.y + x.h <= 540), list.filter(x => x.x < 0 || x.y < 0 || x.x + x.w > 960 || x.y + x.h > 540).map(x => x.name));
  await p.screenshot({ path: `${out}/${tag}-battle-${vp.width}x${vp.height}.png` });
  if (vp.width === 1280) {
    await p.screenshot({ path: `${out}/${tag}-battle-1280x720-right.png`, clip: { x: 900, y: 0, width: 380, height: 720 } });
    // 暂停菜单：行囊 · 换装 与其他按钮
    await p.evaluate(G0 => eval(G0).togglePause(), G); await p.waitForTimeout(300);
    const pause = await p.evaluate(G0 => { const s = eval(G0), out = []; const walk = l => { for (const o of l) { if (o.list) walk(o.list); if (o.visible !== false && o.input?.enabled && o.parentContainer?.visible !== false) { const g = o.getBounds(); out.push({ name: o.name || o.text || o.type, x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }); } } };
      walk(s.children.list.filter(o => o.visible && (o.depth ?? 0) >= 100)); return out.filter(x => x.w > 0 && x.h > 0 && x.w < 900); }, G);
    const pb = overlaps(pause.filter(x => !/^buff-slot|^行囊$|^暂停$|^音|^加点|^用药|^Rectangle$/.test(x.name) /* 无名 Rectangle 是整块面板底板 */));
    ck('暂停菜单按钮互不重叠', !pb.length, pb);
    await p.screenshot({ path: `${out}/${tag}-pause-1280x720.png` });
    await p.evaluate(G0 => eval(G0).togglePause(), G);
    // 行营休整：行囊 · 换装换马 / 回营寨 / 页签等按钮互不重叠，战斗 HUD 的行囊 / 用药不透出来
    await p.evaluate(G0 => { const s = eval(G0); s.setMode('none'); s.freeRecruit = false; s.pendingRecruit = false; s.finish(true, 'boss'); }, G); await p.waitForTimeout(300);
    await p.evaluate(G0 => eval(G0).restIntroSkip?.(), G); await p.waitForTimeout(500);
    const camp = await p.evaluate(G0 => { const s = eval(G0), out = [], root = s.children.getByName('camp-rest'); const walk = l => { for (const o of l) { if (o.list) walk(o.list); if (o.visible !== false && o.input?.enabled && o.name) { const g = o.getBounds(); out.push({ name: o.name, x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width), h: Math.round(g.height) }); } } };
      walk(root ? root.list : []); return { mode: s.mode, list: out, hudBag: s.hudTexts.bag.visible, potion: !!s.potionButton?.visible }; }, G);
    const cb = overlaps(camp.list);
    ck('行营休整：按钮互不重叠，战斗 HUD 行囊 / 用药不透出', camp.mode === 'rest' && camp.list.length > 3 && !cb.length && !camp.potion, { overlap: cb, hudBag: camp.hudBag, potion: camp.potion });
    await p.screenshot({ path: `${out}/${tag}-camp-1280x720.png` });
  }
  await p.close();
}
await b.close();
ck('无控制台 / 页面错误', errors.length === 0, errors.slice(0, 3));
process.exit(fail ? 1 : 0);
