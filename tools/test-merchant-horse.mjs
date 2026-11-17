// 第一章通关剧情「中山商旅 · 献马」：逐句翻页、收下后马厩有驽马（白品质）、只送一次、老存档已有驽马不补弹。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-merchant-horse.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/merchant-horse';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const G = "window.__game.scene.getScene('GameScene')";
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE + '?layout=desktop');
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto(BASE + '?dev=1&autostart=1&stage=3&layout=desktop&character=liubei');
  await p.waitForFunction(G0 => { const s = eval(G0); return s?.player && s.scene.isActive(); }, G, { timeout: 90000 });
  await p.waitForTimeout(1200);
  const pre = await p.evaluate(async G0 => { const s = eval(G0), m = await import('/src/data/mounts.ts'), st = await import('/src/systems/ItemStore.ts');
    return { had: s.hadStarterHorse, owned: st.ownedHorses().map(h => h.id), q: m.horseQuality(m.horseDef('nag')), qBlue: m.horseQuality(m.horseDef('grey_horse')), name: m.horseDef('nag').name, bonus: m.horseDef('nag').bonus }; }, G);
  ck('新存档：开打时没有驽马', pre.had === false && !pre.owned.includes('nag'), pre);
  ck('驽马：白品质、名字仍是驽马、加成不变（移速 +2.6%）', pre.q === 'white' && pre.qBlue === 'blue' && pre.name === '驽马' && pre.bonus.move === .026 && Object.keys(pre.bonus).length === 1, pre);
  // 测试战斗（dev）不自动播：这里直接调用剧情，验证表现与收下逻辑
  const lines = await p.evaluate(G0 => { const s = eval(G0); s.setMode?.('pause'); s.runConfig = { ...s.runConfig, character: 'liubei' }; window.__done = 0; s.showMerchantHorseStory(() => { window.__done++; }); return s.children.getByName('story-merchant-horse') ? 1 : 0; }, G);
  ck('剧情卷轴弹出', lines === 1);
  // 2026-11-17 献马剧情专属插画：横幅换成插画（缺图时退回 rest_camp），卷轴加高后台词与按钮仍在面板内、不被插画挡住
  const art = await p.evaluate(G0 => { const s = eval(G0), root = s.children.getByName('story-merchant-horse'), ill = root.list.find(o => o.name === 'story-merchant-horse-illustration'), btn = root.list.find(o => o.name === 'story-merchant-horse-next'), say = root.list.filter(o => o.type === 'Text').map(o => ({ t: o.text, y: o.y })).find(o => o.t.includes('广宗告捷')); const c = ill?._crop, top = ill ? ill.y - ill.height * ill.scaleY / 2 + c.y * ill.scaleY : null; /* getBounds 不算裁剪，按裁剪窗口算可见上下沿 */ return { tex: s.textures.exists('story_merchant_horse'), ill: !!ill, bannerTop: top === null ? null : Math.round(top), bannerBottom: top === null ? null : Math.round(top + c.height * ill.scaleY), sayY: say ? Math.round(say.y) : null, btnY: btn ? Math.round(btn.y) : null, H: s.scale.height }; }, G);
  ck('献马剧情横幅换成专属插画，台词在插画下方、按钮在画面内', art.tex && art.ill && art.sayY > art.bannerBottom && art.btnY < art.H - 20, art);
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/story-page1.png' });
  const pages = [];
  for (let i = 0; i < 10; i++) {
    const st = await p.evaluate(G0 => { const s = eval(G0), root = s.children.getByName('story-merchant-horse'); if (!root) return null; const next = root.list.find(o => o.name === 'story-merchant-horse-next'), conf = root.list.find(o => o.name === 'story-merchant-confirm'), texts = root.list.filter(o => o.type === 'Text').map(o => o.text).filter(Boolean); return { next: !!next, conf: !!conf, texts }; }, G);
    if (!st) break; pages.push(st);
    if (st.conf) { await p.screenshot({ path: OUT + '/story-last.png' }); }
    await p.evaluate(G0 => { const s = eval(G0), root = s.children.getByName('story-merchant-horse'); (root.list.find(o => o.name === 'story-merchant-horse-next') ?? root.list.find(o => o.name === 'story-merchant-confirm')).emit('pointerup'); }, G);
    await p.waitForTimeout(150);
    if (i === 2) await p.screenshot({ path: OUT + '/story-page3.png' });
  }
  const all = pages.map(x => x.texts.join('|')).join('\n');
  ck('逐句翻页：主公刘备时 6 句（含呼应起兵一句），最后一页是收下按钮', pages.length === 6 && pages[5].conf && /刘备：/.test(all) && /老实的驮马/.test(all), { n: pages.length, all });
  ck('最后一页写明获得驽马 · 白', /获得坐骑「驽马」· 白/.test(pages[pages.length - 1]?.texts.join('|') ?? ''), pages[pages.length - 1]);
  const after = await p.evaluate(async () => { const st = await import('/src/systems/ItemStore.ts'), sm = await import('/src/data/storyMerchantHorse.ts'); return { done: window.__done, owned: st.ownedHorses().map(h => h.id), seen: sm.merchantStorySeen() }; });
  ck('收下后：马厩有驽马、剧情记为已看、回调一次', after.done === 1 && after.owned.includes('nag') && after.seen, after);
  const again = await p.evaluate(async G0 => { const s = eval(G0); s.hadStarterHorse = false; s.debugModified = false; s.debugJumped = false; s.player.damageImmune = false; return { due: s.merchantStoryDue() }; }, G);
  ck('只播一次：看过之后不再触发', again.due === false, again);
  // 老存档：开打时已有驽马 → 不补弹（即使没看过剧情）
  const old = await p.evaluate(async G0 => { localStorage.removeItem('im_story_merchant_horse_v1'); const s = eval(G0); s.scene.restart(); return 1; }, G);
  void old; await p.waitForFunction(G0 => { const s = eval(G0); return s?.player && s.scene.isActive(); }, G, { timeout: 90000 }); await p.waitForTimeout(800);
  const o2 = await p.evaluate(async G0 => { const s = eval(G0), st = await import('/src/systems/ItemStore.ts'), n = st.ownedHorses().filter(h => h.id === 'nag').length; return { had: s.hadStarterHorse, due: s.merchantStoryDue(), regrant: st.grantHorse('nag'), n }; }, G);
  ck('老存档已有驽马：不补弹剧情、不重复送', o2.had === true && o2.due === false && o2.regrant === false && o2.n === 1, o2);
  // 非刘备主公：不出现刘备那句
  const lb = await p.evaluate(async () => { const m = await import('/src/data/storyMerchantHorse.ts'); const a = m.merchantHorseLines('赵云', false); return { n: a.length, liubei: a.some(l => l.who === '刘备'), lord: a.some(l => l.who === '赵云') }; });
  ck('主公不是刘备：5 句、没有刘备那句、主将台词用主公名', lb.n === 5 && !lb.liubei && lb.lord, lb);
  // 马厩：驽马白框、名字白色
  ck('无页面报错', !errs.length, errs);
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
