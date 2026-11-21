// 新档开局流程（2026-11-21 制作人验收）：正式模式（不带 ?dev=1）电脑布局，主页 →「匡扶汉室」→ 择一良将 → 选赵云 → 「确认出战」两次 → 直接开战（不再回主页）。
// 同时截：主页（一屏一个水墨按钮）、选将页选中态、章头卡 / 关前军情卡（去大框、「提示」签），左下没有 FPS 调试行。
// 用法：BASE=http://127.0.0.1:5180/ TAG=before|after node tools/test-new-save-flow.mjs   截图 assets/review/new-save/<TAG>-*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', TAG = process.env.TAG ?? 'after', OUT = 'assets/review/new-save', AFTER = TAG !== 'before';
mkdirSync(OUT, { recursive: true });
let fail = 0; const errors = [];
const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message.slice(0, 200)));
await p.addInitScript(() => { if (!sessionStorage.getItem('ns')) { localStorage.clear(); localStorage.setItem('im_opening_seen', '1'); sessionStorage.setItem('ns', '1'); } });
await p.goto(BASE + '?layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await p.waitForTimeout(2500);
const M = "window.__game.scene.getScene('MenuScene')";
const emit = (name, ev = 'pointerdown') => p.evaluate(([M0, n, e]) => { const m = eval(M0), all = m.children.list.flatMap(o => [o, ...(o.list ?? [])]); const o = all.find(x => x.name === n && x.input?.enabled !== false); o?.emit(e); if (e === 'pointerdown') o?.emit('pointerup'); return !!o; }, [M, name, ev]);
const shot = n => p.screenshot({ path: `${OUT}/${TAG}-${n}.png` });
await shot('home');
// 主页水墨按钮数（电脑版：「匡扶汉室」一个）
const inkHome = await p.evaluate(M0 => { const m = eval(M0); return m.children.list.filter(o => o.visible && o.type === 'NineSlice' && /btn_ink/.test(o.texture?.key ?? '')).length; }, M);
await emit('start-campaign');
await p.waitForTimeout(1200);
const opened = await p.evaluate(M0 => !!eval(M0).children.getByName('hero-picker')?.visible, M);
await emit('pick-zhaoyun'); await p.waitForTimeout(500);
await shot('picker-selected');
const pk = await p.evaluate(M0 => { const r = eval(M0).children.getByName('hero-picker'); const ink = r.list.filter(o => o.visible && o.type === 'NineSlice' && /btn_ink/.test(o.texture?.key ?? '')).length; const sel = r.getByName('hero-picker-selected'); const ys = r.list.filter(o => /^pick-/.test(o.name ?? '') && o.type === 'Container' && o.visible).map(o => [o.name, Math.round(o.y), +o.alpha.toFixed(2)]); return { ink, sel: !!sel, ys, label: r.list.find(o => o.type === 'Text' && /确认出战|选定武将/.test(o.text ?? ''))?.text }; }, M);
await emit('hero-confirm'); await p.waitForTimeout(400);
await shot('picker-confirm1');
await emit('hero-confirm'); await p.waitForTimeout(4000);
const after = await p.evaluate(() => ({ active: window.__game.scene.getScenes(true).map(s => s.scene.key) }));
await shot('after-confirm');
// 进到战斗场景后：章头 / 军情卡（剧情卷轴）——截两张，点开战
let cards = [];
for (let i = 0; i < 6; i++) {
  const info = await p.evaluate(() => { const g = window.__game.scene.getScenes(true).find(s => /GameScene/.test(s.scene.key)); if (!g) return null; const sc = g.children.list.find(o => o.type === 'Container' && o.visible && /^story|chapter-intro|brief/.test(o.name ?? '')); return { scene: g.scene.key, mode: g.mode, card: sc?.name ?? null, tips: sc ? sc.list.filter(o => o.type === 'Text' && /锦\n囊|提\n示/.test(o.text)).map(o => o.text) : [], dev: g.children.list.some(o => o.type === 'Text' && o.visible && /^FPS /.test(o.text ?? '')) }; });
  if (!info) { await p.waitForTimeout(800); continue; }
  if (info.card && !cards.find(c => c.card === info.card)) { cards.push(info); await shot('card-' + cards.length); await p.evaluate(n => { const g = window.__game.scene.getScenes(true).find(s => /GameScene/.test(s.scene.key)); const c = g.children.getByName(n); const btn = c?.list.find(o => o.input?.enabled && /-(next|confirm)$|start|go/.test(o.name ?? '')); btn?.emit('pointerup'); }, info.card); await p.waitForTimeout(1500); continue; }
  if (!info.card && info.mode === 'none') { cards.push({ ...info, card: '(battle)' }); break; }
  await p.waitForTimeout(800);
}
await shot('battle');
const dev = await p.evaluate(() => { const g = window.__game.scene.getScenes(true).find(s => /GameScene/.test(s.scene.key)); return g ? g.children.list.some(o => o.type === 'Text' && o.visible && /^FPS /.test(o.text ?? '')) : null; });
console.log('  home ink', inkHome, 'picker', JSON.stringify(pk), 'after', JSON.stringify(after), 'cards', JSON.stringify(cards));
if (AFTER) {
  ck('主页：一屏一个水墨按钮（「匡扶汉室」；「更换武将」改漆金）', inkHome === 1, inkHome);
  ck('点「匡扶汉室」（新档没选过将）打开择一良将', opened);
  ck('选将页：只一个水墨按钮（「确认出战」），「返回」漆金', pk.ink === 1, pk);
  ck('选将页：选中卷轴有金边、抬起，其余压暗', pk.sel && pk.ys.some(([n, , a]) => n === 'pick-zhaoyun' && a === 1) && pk.ys.filter(([n]) => n !== 'pick-zhaoyun').every(([, , a]) => a < 1), pk.ys);
  ck('第二次「确认出战」后直接进战斗场景（不回主页）', after.active.some(k => /GameScene/.test(k)) && !after.active.includes('MenuScene'), after);
  ck('关前卡的提示签写「提示」不写「锦囊」', cards.every(c => !c.tips?.some(t => /锦/.test(t))), cards);
  ck('正式模式（不带 ?dev=1）左下没有 FPS 调试行', dev === false, dev);
}
ck('无页面报错', errors.length === 0, errors.slice(0, 4));
await b.close();
process.exit(fail ? 1 : 0);
