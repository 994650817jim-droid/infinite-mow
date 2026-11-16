// 关卡目标：每关 3 波；1-1 歼敌 → 张梁、1-2 普通推波 → 张宝、2-2 护送伤兵车 → 徐荣；超时判失败；HUD 目标行。需要开发服务器。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-objectives.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-content';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined && !ok ? ' · ' + JSON.stringify(d) : '')); };
const save = { version: 8, yellowStages: 3, dongzhuoStages: 2, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: false }, merits: 0, provisions: 0, buildings: { barracks: 1, farm: 1, clinic: 1 }, reserve: {}, receipts: [], nodes: ['home', 'huangjin', 'hulao'], ownedCities: [], eraSeen: 1, capturedEver: [], alerts: [], lastLost: [], chapterSeen: 2 };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const open = async (layout, cfg) => {
  const p = await b.newPage({ viewport: layout === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: layout === 'mobile' ? 2 : 1 });
  p.on('pageerror', e => errors.push(layout + ' ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(layout + ' console ' + m.text()); });
  await p.addInitScript(sv => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_world_v1', JSON.stringify(sv)); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); } }, save);
  await p.goto(base + '?layout=' + layout); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  await p.evaluate(cfg => { const g = window.__game; g.registry.set('runConfig', { character: 'zhaoyun', ...cfg }); for (const s of g.scene.getScenes(true)) s.scene.stop(); if (g.registry.get('battleReady')) g.scene.start('GameScene'); else { g.registry.set('loadBattle', true); g.scene.start('BootScene'); } }, cfg);
  await p.waitForFunction(() => window.__game.scene.isActive('GameScene') && window.__game.scene.getScene('GameScene').player, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; }, G);
  return p;
};
const info = p => p.evaluate(G0 => { const s = eval(G0); return { name: s.chapter.name, waves: s.chapter.waves.length, obj: s.objective?.o.kind ?? null, text: s.children.getByName('objective-text')?.text, boss: !!s.boss, bossName: s.chapter.bossName, state: s.objective?.state }; }, G);

// 1-1 歼敌 80 → 张梁
{
  const p = await open('mobile', { chapter: 'huangjin', stage: 1 });
  const a = await info(p);
  ck('1-1：3 波、目标「歼灭黄巾 80 人」、HUD 显示进度', a.waves === 3 && a.obj === 'kills' && /歼敌 \d+\/80/.test(a.text), a);
  const b1 = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 150; await new Promise(r => setTimeout(r, 300)); const early = !!s.boss; s.kills += 80; await new Promise(r => setTimeout(r, 600)); return { early, boss: !!s.boss, done: s.objective.done, text: s.children.getByName('objective-text').text }; }, G);
  ck('1-1：目标未完成时首领不按时间出场；歼敌满 80 后张梁出阵', !b1.early && b1.done && b1.boss && /目标达成/.test(b1.text), b1);
  await p.close();
}
// 1-2 下曲阳：用户反馈「1-2 就正常推波数进，不需要黄巾祭坛」→ 普通推波，打完 3 波张宝登场（只在电脑布局验收）
{
  const p = await open('desktop', { chapter: 'huangjin', stage: 2 });
  const a = await info(p);
  const props = await p.evaluate(G0 => { const s = eval(G0); return { altars: s.children.list.filter(o => o.type === 'Text' && /黄巾祭坛/.test(o.text)).length, textVisible: !!s.children.getByName('objective-text')?.visible }; }, G);
  ck('[desktop] 1-2：3 波、无关卡目标、场上没有黄巾祭坛', a.waves === 3 && a.obj === null && props.altars === 0 && !props.textVisible, { a, props });
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; const t = s.chapter.waves[s.chapter.waves.length - 1].start; s.elapsed = Math.max(0, t - 2); await new Promise(r => setTimeout(r, 300)); const early = !!s.boss; s.elapsed = t + .5; await new Promise(r => setTimeout(r, 700)); return { early, boss: !!s.boss, name: s.chapter.bossName, t }; }, G);
  ck('[desktop] 1-2：打完波次（最后一波开始）张宝登场，之前不出', !r.early && r.boss && r.name === '张宝', r);
  await p.screenshot({ path: `${out}/desktop-1-2-waves.png` });
  await p.close();
}
// 2-2 护送伤兵车 → 徐荣；车被毁 → 失败
for (const layout of ['mobile', 'desktop']) {
  const p = await open(layout, { chapter: 'hulao', westStage: 2 });
  const a = await info(p);
  ck(`[${layout}] 2-2：3 波、目标护送伤兵车`, a.waves === 3 && a.obj === 'escort' && /护送/.test(a.text), a);
  const s0 = await p.evaluate(G0 => eval(G0).objective.state, G); await p.waitForTimeout(1500);
  const s1 = await p.evaluate(G0 => eval(G0).objective.state, G);
  ck(`[${layout}] 2-2：主将在旁时伤兵车前进`, s1.cartY < s0.cartY && !s1.stopped, { s0, s1 });
  await p.screenshot({ path: `${out}/${layout}-objective-escort.png` });
  if (layout === 'mobile') {
    const f = await p.evaluate(async G0 => { const s = eval(G0); s.objective.hp = 0; await new Promise(r => setTimeout(r, 600)); return { failed: s.objective.failed, over: s.over, victory: s.victory, title: s.resultTexts?.title.text }; }, G);
    ck('2-2：伤兵车被毁 → 判失败（时间耗尽结局）', f.failed && f.over && f.victory === false, f);
  } else {
    const d = await p.evaluate(async G0 => { const s = eval(G0); s.player.sprite.setPosition(s.objective.cart.x, s.objective.cart.y - 1300); s.objective.forceArrive(); await new Promise(r => setTimeout(r, 700)); return { done: s.objective.done, boss: !!s.boss, name: s.chapter.bossName }; }, G);
    ck('2-2：伤兵车抵达 → 徐荣截击出阵', d.done && d.boss && d.name === '徐荣', d);
  }
  await p.close();
}
// 超时：1-1 歼敌未满，超过 200 秒 → 时间耗尽
{
  const p = await open('desktop', { chapter: 'huangjin', stage: 1 });
  const t = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 205; await new Promise(r => setTimeout(r, 600)); return { over: s.over, victory: s.victory, boss: !!s.boss }; }, G);
  ck('1-1：200 秒内没完成目标 → 时间耗尽、不出首领', t.over && t.victory === false && !t.boss, t);
  // 无目标的关：2-1 汜水关 3 波，90 秒出华雄
  await p.close();
}
{
  const p = await open('mobile', { chapter: 'hulao', westStage: 1 });
  const a = await info(p);
  const r = await p.evaluate(async G0 => { const s = eval(G0); for (let i = 0; i <= s.chapter.waves.length; i++) s.recruitedWaves.add(i); s.pendingRecruit = false; s.elapsed = 91; await new Promise(r => setTimeout(r, 600)); return { boss: !!s.boss, text: s.children.getByName('objective-text')?.visible ?? false }; }, G);
  ck('2-1 汜水关：3 波、无目标行，90 秒华雄出阵', a.waves === 3 && a.obj === null && r.boss && !r.text, { a, r });
  await p.close();
}
await b.close();
const real = errors.filter(e => !/favicon|ERR_|net::/.test(e));
ck('无页面报错 / 控制台错误', real.length === 0, real.slice(0, 5));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
