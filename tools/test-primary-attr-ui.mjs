// 加点面板主属性说明（2026-11-18 用户「关于每个英雄主属性，在加点那里要说出来有什么特殊加成」，ui/PrimaryAttrInfo）：
// 主属性一行写「主属性：X · 每点效果 ×倍率」（倍率读 PRIMARY_MUL）+ 专精三档（已解锁点亮，未解锁「再加 X 点」）；整行 / 专精悬停或点按弹完整说明；
// 其他属性行不变；行营将帅帐构筑总览的武将卡显示同一份摘要。手机（用户 11-18 暂停手机适配）只查不报错。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-primary-attr-ui.mjs   截图 assets/review/primary-attr/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/primary-attr';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = async (mobile, hero = 'zhaoyun') => {
  const p = await b.newPage(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push((mobile ? '[手机] ' : '') + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push((mobile ? '[手机] ' : '') + 'console ' + m.text()); });
  await p.addInitScript(h => {
    window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
    if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', h); sessionStorage.setItem('seeded', '1'); }
  }, hero);
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${mobile ? 'mobile' : 'desktop'}`, { timeout: 180000 });
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
  return p;
};
const G = "window.__game.scene.getScene('GameScene')";
const p = await page(false);

// ① 12 位武将的摘要（直接用 ui/PrimaryAttrInfo，倍率 / 档位 / 专精都读 data/attributes）
const sum = await p.evaluate(async () => {
  const A = await window.__mod('/src/data/attributes.ts'), U = await window.__mod('/src/ui/PrimaryAttrInfo.ts'), C = await window.__mod('/src/data/characters.ts');
  const mul = '×' + +A.PRIMARY_MUL.toFixed(2), rows = [];
  for (const [hero, attr] of Object.entries(A.PRIMARY_ATTRIBUTE)) {
    const name = A.ATTRIBUTE_INFO[attr].name, perks = A.PRIMARY_PERK_INFO[attr], T = A.PRIMARY_TIERS;
    const at = n => U.primarySummary(hero, n);
    const s0 = at(0), sMid = at(T[1] - 1), sMax = at(10);
    rows.push({
      hero, heroName: C.getCharacter(hero).name, attr,
      head: s0.head === `主属性：${name} · 每点效果 ${mul}`,
      zero: s0.chips.join('|') === perks.map((q, k) => `◇ ${q.name} · 再加 ${T[k]} 点`).join('|') && s0.next === `专精 0/3 · 下一档「${perks[0].name}」再加 ${T[0]} 点`,
      mid: sMid.chips[0] === `◆ ${perks[0].name}` && sMid.chips[1] === `◇ ${perks[1].name} · 再加 1 点` && sMid.chips[2] === `◇ ${perks[2].name} · 再加 ${T[2] - T[1] + 1} 点`,
      max: sMax.chips.every(c => c.startsWith('◆ ')) && sMax.next === '专精 3/3 · 三档全开',
      tip: s0.tip.title === `主属性：${name}` && s0.tip.sub.startsWith(C.getCharacter(hero).name) && s0.tip.body.startsWith(`每点效果 ${mul}：`) && perks.every((q, k) => s0.tip.body.includes(`满 ${T[k]} 点「${q.name}」${q.desc}（再加 ${T[k]} 点）`)) && sMax.tip.body.includes('（已解锁）'),
    });
  }
  return { mul, rows };
});
ck(`12 位武将都有主属性摘要（倍率读 data：${sum.mul}）`, sum.rows.length === 12, sum.rows.map(r => r.hero));
for (const r of sum.rows) ck(`${r.heroName}（${r.attr}）：「主属性：X · 每点效果 ${sum.mul}」、0 点三档都写再加几点、差 1 点到第二档、满 10 点三档全开、完整说明`, r.head && r.zero && r.mid && r.max && r.tip, r);

// ② 实战加点面板：四种主属性各一位，点「＋」档位跟着变
async function startAs(hero, attrs) {
  await p.evaluate(async ([h, a]) => {
    localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 3, heroes: { [h]: { level: 11, xp: 0, attributes: { strength: 0, agility: 0, intellect: 0, command: 0, ...a } } } }));
    (await window.__mod('/src/systems/HeroProgress.ts')).resetHeroCache();
    const s = window.__game.scene.getScene('GameScene'); s.registry.remove('campaignTransfer'); s.registry.set('runConfig', { character: h, chapter: 'huangjin', stage: 1 }); s.scene.start('GameScene');
  }, [hero, attrs]);
  await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.player.growth.character === h; }, hero, { timeout: 60000 });
  await p.waitForTimeout(800);
}
const panel = () => p.evaluate(G0 => {
  const s = eval(G0), all = s.attributePanel.list.flatMap(o => [o, ...(o.list ?? [])]), by = n => all.find(o => o.name === n);
  const head = by('attribute-primary-head'), chips = [1, 2, 3].map(k => by('attribute-perk-' + k)), row = s.attributeRows.find(r => r.perks);
  const rowRight = s.attributePanel.list.find(o => o.name === 'attribute-primary-hit');
  return {
    head: head?.text, headRight: head ? Math.round(head.getBounds().right) : 0, pipX: row?.pipX,
    chips: chips.map(c => c?.text), lit: chips.map(c => c?.style.color === '#ffe3a0'), chipRight: Math.round(chips[2]?.getBounds().right ?? 0),
    rowRight: Math.round(s.attributeRows[0].button.x + 25),
    names: ['strength', 'agility', 'intellect', 'command'].map(id => by('attribute-name-' + id)?.text ?? null),
    unallocated: s.player.growth.unallocated, primary: s.player.growth.primaryTier(),
  };
}, G);
const add = (id, n) => p.evaluate(([G0, id, n]) => { const s = eval(G0), btn = s.attributePanel.list.find(o => o.name === 'attribute-add-' + id); for (let i = 0; i < n; i++) btn.emit('pointerdown'); }, [G, id, n]);
const NAMES = { strength: '力量', agility: '敏捷', intellect: '智力', command: '统御' };
for (const [hero, attr] of [['guanyu', 'strength'], ['zhaoyun', 'agility'], ['zhuge', 'intellect'], ['liubei', 'command']]) {
  await startAs(hero, {});
  await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); if (s.player.growth.unallocated < 10) s.player.growth.unallocated = 10; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }, G);
  await p.waitForTimeout(250);
  const a0 = await panel(); await add(attr, 4); await p.waitForTimeout(150); const a4 = await panel(); await add(attr, 3); await p.waitForTimeout(150); const a7 = await panel();
  const others = Object.entries(NAMES).filter(([id]) => id !== attr);
  ck(`${hero}：主属性一行「主属性：${NAMES[attr]} · 每点效果 ${sum.mul}」；其他属性行仍只写名字`, a0.head === `主属性：${NAMES[attr]} · 每点效果 ${sum.mul}` && others.every(([id, nm]) => a0.names[['strength', 'agility', 'intellect', 'command'].indexOf(id)] === nm), a0);
  ck(`${hero}：档位随点数变（0 点全暗 → 4 点亮一档、第二档「再加 3 点」→ 7 点亮两档）`, a0.lit.every(x => !x) && a4.lit.join() === 'true,false,false' && /再加 3 点$/.test(a4.chips[1]) && a7.lit.join() === 'true,true,false' && /再加 3 点$/.test(a7.chips[2]) && a7.primary === 2, { a0: a0.chips, a4: a4.chips, a7: a7.chips });
  ck(`${hero}：放得下（摘要不压点数条，专精三档在行内）`, a7.headRight <= a7.pipX && a7.chipRight <= a7.rowRight, { headRight: a7.headRight, pipX: a7.pipX, chipRight: a7.chipRight, rowRight: a7.rowRight });
  if (hero === 'zhaoyun') await p.screenshot({ path: `${out}/desktop-attr-panel.png` });
}

// ③ 悬停整行 / 专精，点按（手机）也弹；移开收起；离开面板收起
const tipState = () => p.evaluate(G0 => { const s = eval(G0), t = s.children.list.find(o => o.name === 'item-tooltip'); return { vis: !!t?.visible, title: t?.getByName('info-tooltip-title')?.text ?? '', body: t?.getByName('info-tooltip-body')?.text ?? '' }; }, G);
const fire = (name, ev) => p.evaluate(([G0, name, ev]) => { const s = eval(G0), o = s.attributePanel.list.find(x => x.name === name); o.emit(ev, { x: o.x * 1.33 + 40, y: o.y * 1.33 + 10 }); }, [G, name, ev]);
await fire('attribute-primary-hit', 'pointerover'); await p.waitForTimeout(100); const h1 = await tipState();
await p.screenshot({ path: `${out}/desktop-attr-tooltip.png` });
await fire('attribute-primary-hit', 'pointerout'); const h2 = await tipState();
await fire('attribute-perk-3', 'pointerdown'); const h3 = await tipState();
await p.evaluate(G0 => eval(G0).setMode('none'), G); const h4 = await tipState();
ck('悬停主属性一行：弹完整说明（标题「主属性：统御」、每点效果、三档专精），移开收起', h1.vis && h1.title === '主属性：统御' && h1.body.includes('每点效果 ' + sum.mul) && h1.body.includes('满 10 点「同袍」') && !h2.vis, { h1, h2: h2.vis });
ck('点按专精（手机点触）也弹说明；离开加点面板自动收起', h3.vis && h3.title === '主属性：统御' && !h4.vis, { h3: h3.vis, h4: h4.vis });

// ④ 行营将帅帐构筑总览：武将卡同一份摘要，悬停同一份说明
await startAs('zhaoyun', { agility: 5 });
await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.resting = true; s.setMode('rest'); s.renderRecruit(); }, G);
await p.waitForTimeout(5200);
await p.evaluate(G0 => { const s = eval(G0), f = l => { for (const o of l) { if (o.name === 'camp-tab-3') return o; if (o.list) { const r = f(o.list); if (r) return r; } } }; f(s.campUI.root.list)?.emit('pointerdown'); }, G);
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/camp-build-overview.png` });
const ov = await p.evaluate(async G0 => {
  const s = eval(G0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
  const by = n => all.find(o => o.name === n), U = await window.__mod('/src/ui/PrimaryAttrInfo.ts'), want = U.primarySummary('zhaoyun', s.player.growth.attributes.agility);
  const hit = by('camp-build-primary-hit'); hit?.emit('pointerover', { x: 300, y: 300 });
  const t = all.find(o => o.name === 'item-tooltip' && o.visible) ?? s.children.list.find(o => o.name === 'item-tooltip' && o.visible);
  const r = { head: by('camp-build-primary-head')?.text, next: by('camp-build-primary-next')?.text, want: { head: want.head, next: want.next }, tip: t?.getByName('info-tooltip-title')?.text, pts: s.player.growth.attributes.agility };
  return r;
}, G);
await p.screenshot({ path: `${out}/camp-build-tooltip.png` });
ck('将帅帐武将卡：同一份摘要（主属性：敏捷 · 每点效果 / 专精进度「下一档再加几点」），悬停弹同一份说明', ov.head === ov.want.head && ov.next === ov.want.next && /下一档「游刃」再加 2 点/.test(ov.next) && ov.tip === '主属性：敏捷', ov);

// ⑤ 手机（用户 11-18 暂停手机适配）：打开加点面板、悬停说明不报错
const m = await page(true);
await m.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.player.growth.unallocated = 10; s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); }, G);
await m.waitForTimeout(300);
const mm = await m.evaluate(G0 => { const s = eval(G0), all = s.attributePanel.list, btn = all.find(o => o.name === 'attribute-add-agility'); for (let i = 0; i < 4; i++) btn.emit('pointerdown'); const hit = all.find(o => o.name === 'attribute-primary-hit'); hit.emit('pointerdown', { x: 100, y: 300 }); return { head: all.find(o => o.name === 'attribute-primary-head')?.text, chip: all.find(o => o.name === 'attribute-perk-1')?.text, tip: !!s.children.list.find(o => o.name === 'item-tooltip' && o.visible) }; }, G);
ck('手机：打开加点面板、加点、点按说明都能执行（布局不验收，只查不报错，见下一项）', !!mm, mm);

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} 通过，${fail} 失败`);
await b.close();
process.exit(fail ? 1 : 0);
