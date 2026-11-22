// 大结局四屏（2026-11-21 重做）实机截图 + 检查：结局画卷 → 麒麟阁 → 功臣 → 收尾；「继续」逐屏、Esc 直接到收尾、「回到天下」。
// 存档：大部分章节打通、末章 2/3、占 20 城（天下一统）、麾下关羽 / 张飞 / 黄忠 / 魏延；非 16:9 窗口 1366×768、1600×1000 也各走一遍。
// 用法：BASE=http://127.0.0.1:5180/ node tools/shot-ending.mjs → assets/review/ending/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/ending'; mkdirSync(OUT, { recursive: true });
let fail = 0; const ck = (n, ok, d) => { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' · ' + JSON.stringify(d).slice(0, 500))); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const errs = []; let p;
const E = "window.__game.scene.getScene('EndingScene')";
const run = async (w, h, tag, ownedN = 26) => {
  if (p) await p.close(); p = await b.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); for (const k of ['im_opening_seen', 'im_tutorial_done', 'im_home_seen']) localStorage.setItem(k, '1'); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('s', '1'); } });
  await p.goto(BASE + '?layout=desktop', { timeout: 180000 }); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 180000 }); await p.waitForTimeout(800);
  await p.evaluate(async ownedN => {
    const W = await import('/src/world/WorldStore.ts'), C = await import('/src/world/WorldCities.ts'); const s = W.loadWorld();
    Object.assign(s, { yellowStages: 3, dongzhuoStages: 3, warlordStages: 3, guanduStages: 3, chibiStages: 3, jingnanStages: 3, shuStages: 3, hanzhongStages: 3, xiangfanStages: 3, yilingStages: 1, nanzhengStages: 3, beifaStages: 2, worldAvailable: true });
    s.cleared = { ...s.cleared, huangjin: true, hulao: true }; s.ownedCities = C.CITIES.slice(0, ownedN).map(c => c.id); localStorage.setItem('im_world_v1', JSON.stringify(s));
    localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: ['guanyu', 'zhangfei', 'huangzhong', 'weiyan'].map((id, i) => ({ id: 'h' + i, kind: 'hero', hero: id, name: id, template: 'blade', quality: 'gold', rank: 1, picks: [] })), followers: [] }));
    const g = window.__game; for (const sc of g.scene.getScenes(true)) sc.scene.stop(); g.scene.start('EndingScene', { lord: 'zhaoyun' });
  }, ownedN);
  await p.waitForFunction(E0 => !!eval(E0)?.children.getByName('ending-story'), E, { timeout: 60000 });
  const mus = [], rec = async () => mus.push(await p.evaluate(() => { const m = window.__menuMusic; return m ? m.mood + ':' + m.endingSection : 'none'; }));
  const cont = () => p.evaluate(E0 => eval(E0).children.getByName(eval(E0).children.list.find(o => /^ending-/.test(o.name)).name).list.find(o => o.name === 'ending-continue')?.emit('pointerup'), E);
  const st = () => p.evaluate(E0 => { const s = eval(E0), r = s.children.list.find(o => /^ending-/.test(o.name ?? '')); const ink = r.list.filter(o => o.type === 'Image' && /ink|brush/.test(o.texture?.key ?? '') && o.displayWidth > 80).length; return { screen: s.screen, kind: s.kind, n: r.list.length, ink, rects: r.list.filter(o => o.type === 'Rectangle' && o.alpha > .01 && o.width > 40 && o.name !== '').length }; }, E);
  // ① 画卷：等字逐段淡入完
  await p.waitForTimeout(8800); /* 标题 + 各段逐段淡入约 7 秒 */ await p.screenshot({ path: `${OUT}/${tag}-1-story.png` });
  const s1 = await p.evaluate(E0 => { const r = eval(E0).children.getByName('ending-story'); const art = r.list.find(o => o.name === 'ending-art'); return { title: r.list.find(o => o.name === 'ending-title')?.text, lines: r.list.filter(o => /^ending-line-/.test(o.name)).map(o => +o.alpha.toFixed(2)), titleY: Math.round(r.list.find(o => o.name === 'ending-title').y), pushed: art ? +(art.scaleX / (Math.max(960 / art.width, 540 / art.height))).toFixed(3) : 0 }; }, E);
  ck(`[${tag}] ① 结局画卷：标题 + 逐段文字都显出、压在下方三分之一、画面在缓慢推近`, s1.title && s1.lines.length >= 3 && s1.lines.every(a => a > .95) && s1.titleY > 540 * .5 && s1.pushed > 1.0 && s1.pushed <= 1.061, s1);
  await rec(); await cont(); await p.waitForTimeout(400);
  // ② 麒麟阁
  await p.waitForTimeout(3200); await p.screenshot({ path: `${OUT}/${tag}-2-pavilion.png` });
  const s2 = await p.evaluate(E0 => { const r = eval(E0).children.getByName('ending-pavilion'); const cols = r.list.filter(o => /^ending-chapter-/.test(o.name)); const seals = cols.flatMap(c => c.list.filter(o => /^ending-seal-(?!empty)/.test(o.name))).length, empty = cols.flatMap(c => c.list.filter(o => /^ending-seal-empty-/.test(o.name))).length; const xs = cols.map(c => c.list[0].x); return { cols: cols.length, seals, empty, rtl: xs.every((x, i) => i === 0 || x < xs[i - 1]), summary: r.list.find(o => o.name === 'ending-summary')?.text, rects: r.list.filter(o => o.type === 'Rectangle' && o.alpha * (o.fillAlpha ?? 1) > .01).length }; }, E); // 「继续」的命中区是 0.001 透明的矩形，不算
  ck(`[${tag}] ② 麒麟阁：十二章从右到左、已平定盖朱印 / 未至淡墨虚框、顶部摘要、没有矩形格子`, s2.cols === 12 && s2.rtl && s2.seals > 0 && s2.empty > 0 && s2.seals + s2.empty === 36 && /主将/.test(s2.summary) && s2.rects === 0, s2);
  await rec(); await cont(); await p.waitForTimeout(2200); await p.screenshot({ path: `${OUT}/${tag}-3-heroes.png` }); await rec();
  const s3 = await p.evaluate(E0 => { const r = eval(E0).children.getByName('ending-heroes'); const strip = r?.list.find(o => o.name === 'ending-hero-strip'); return { ok: !!r, heroes: strip ? strip.list.filter(o => /^ending-hero-/.test(o.name)).map(o => o.name.slice('ending-hero-'.length)) : [] }; }, E);
  ck(`[${tag}] ③ 功臣：本局麾下武将的水墨立绘（主将在前）`, s3.ok && s3.heroes[0] === 'zhaoyun' && s3.heroes.includes('guanyu') && s3.heroes.length >= 5, s3);
  await cont(); await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/${tag}-4-finale.png` }); await rec();
  const want = ownedN >= 20 ? 'ending_unify' : 'ending_tri';
  ck(`[${tag}] 结局专属曲：${want === 'ending_unify' ? '天下一统《山河定》' : '三分天下《三分歌》'}，四屏依次进 0 / 1 / 2 / 3 段`, mus.join(',') === [0, 1, 2, 3].map(i => want + ':' + i).join(','), mus);
  const s4 = await p.evaluate(E0 => { const r = eval(E0).children.getByName('ending-finale'); return { finis: r?.list.find(o => o.name === 'ending-inscription')?.texture?.key, thanks: r?.list.find(o => o.name === 'ending-thanks')?.text, tips: r?.list.find(o => o.name === 'ending-tips')?.text, ret: r?.list.find(o => o.name === 'ending-return')?.type }; }, E);
  ck(`[${tag}] ④ 收尾：感谢游玩 + 还能做什么（未占城 / 未平定关 / 乱世难度）+「回到天下」文字按钮`, s4.thanks === '感谢游玩' && /座城未占/.test(s4.tips) && /关未平定/.test(s4.tips) && /乱世难度/.test(s4.tips) && s4.ret === 'Text', s4);
  return p;
};
await run(1280, 720, 'main');
// Esc：从第一屏直接跳到收尾；「回到天下」进天下地图
await p.evaluate(E0 => eval(E0).show('story'), E); await p.waitForTimeout(500); await p.mouse.click(400, 300); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
ck('Esc 从任一屏直接跳到收尾', await p.evaluate(E0 => eval(E0).screen, E) === 'finale', null);
await p.evaluate(E0 => eval(E0).children.getByName('ending-finale').list.find(o => o.name === 'ending-return').emit('pointerup'), E); await p.waitForTimeout(2500);
ck('「回到天下」进天下地图', await p.evaluate(() => window.__game.scene.isActive('WorldMapScene') || window.__game.scene.isActive('WorldMapSceneV1')), null);
ck('离开结局后界面曲换回地图曲（同一实例淡出淡入）', await p.evaluate(() => window.__menuMusic?.mood) === 'map', await p.evaluate(() => window.__menuMusic?.mood));
ck('结局不放主菜单曲（界面曲情绪 ≠ home）', await p.evaluate(async () => { const m = await import('/src/scenes/EndingScene.ts'); return m.ENDING_MUSIC !== 'home'; }), null);
for (const [w, h] of [[1366, 768], [1600, 1000]]) await run(w, h, `${w}x${h}`);
// 三分天下：占城少 → 三分天下的画、收尾题字用「山河为证」
await run(1280, 720, 'three', 6);
ck('[three] 结局是三分天下、收尾题字用 finis_b', await p.evaluate(E0 => { const s = eval(E0), im = s.children.getByName('ending-finale')?.list.find(o => o.name === 'ending-inscription'); return s.kind === 'tripartite' && im?.texture?.key === 'ending_finis_b'; }, E), null);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close(); process.exit(fail ? 1 : 0);
