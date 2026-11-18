// 构筑总览（2026-11-18 用户：「这个玩家看自己 build 不清楚，需要优化一下」）：行营「将帅帐」与战斗内「战法构筑」共用 ui/BuildOverview。
// 检查：各栏数据与实际构筑一致（武将 / 本命 / 武学 / 属性、战法格、信物格、八系进度、已觉醒、下一步提示）、悬停有说明、
// 觉醒进度算对、空构筑正常显示；截图：空构筑、中期、满觉醒、战斗内面板。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-build-overview.mjs     （ONLY_SHOT=before：只截改前的将帅帐，给对比图用）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/build-overview', onlyShot = process.env.ONLY_SHOT;
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 500) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'zhaoyun'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop', { timeout: 180000 });
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const G = "window.__game.scene.getScene('GameScene')";
// 进行营休整 → 将帅帐
await p.evaluate(G0 => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.resting = true; s.setMode('rest'); s.renderRecruit(); }, G);
await p.waitForTimeout(5200); // 入营水墨过场
const tab = () => p.evaluate(G0 => { const s = eval(G0), f = l => { for (const o of l) { if (o.name === 'camp-tab-3') return o; if (o.list) { const r = f(o.list); if (r) return r; } } }; f(s.campUI.root.list)?.emit('pointerdown'); }, G);
await tab(); await p.waitForTimeout(400);
if (onlyShot) { await p.screenshot({ path: `${out}/${onlyShot}-camp.png` }); await b.close(); console.log('shot', onlyShot); process.exit(0); }

/** 读总览：按名字找对象（prefix = camp-build / build-panel）。 */
const read = prefix => p.evaluate(([G0, P]) => {
  const s = eval(G0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
  const by = n => all.find(o => o.name === n), txt = n => by(n)?.text;
  const g = s.player.growth, b = g.build;
  return {
    hero: txt(P + '-hero-name'), level: txt(P + '-hero-level'), weapon: txt(P + '-weapon'),
    attrs: ['strength', 'agility', 'intellect', 'command'].map(id => txt(P + '-attr-' + id)),
    count: txt(P + '-tactic-count'), tacticNames: [0, 1, 2, 3, 4, 5].map(i => txt(P + '-tactic-name-' + i) ?? null), tacticLv: [0, 1, 2, 3, 4, 5].map(i => txt(P + '-tactic-lv-' + i) ?? null),
    tacticHits: [0, 1, 2, 3, 4, 5].filter(i => !!by(P + '-tactic-' + i)).length,
    tags: Object.fromEntries(['combo', 'critical', 'skirmish', 'charge', 'flame', 'control', 'command', 'bulwark'].map(t => [t, txt(P + '-tag-' + t)])),
    gaps: Object.fromEntries(['combo', 'critical', 'skirmish', 'charge', 'flame', 'control', 'command', 'bulwark'].map(t => [t, txt(P + '-tag-gap-' + t)])),
    awakeCount: txt(P + '-awake-count'), awakes: all.filter(o => o.name?.startsWith(P + '-awake-') && !['-awake-count', '-awake-none'].some(x => o.name.endsWith(x))).map(o => o.name.slice((P + '-awake-').length)),
    none: txt(P + '-awake-none'), next: [txt(P + '-next-0'), txt(P + '-next-1')],
    // 实际构筑
    real: { name: s.player.growth.character, lv: s.player.level, tags: b.tags(), learned: Object.keys(b.tactics).filter(id => b.level(id) > 0), levels: Object.fromEntries(Object.keys(b.tactics).map(id => [id, b.level(id)])), attrs: { ...g.attributes }, weapon: s.player.weapons[0]?.level },
  };
}, [G, prefix]);
const truth = () => p.evaluate(async G0 => { const s = eval(G0), aw = await window.__mod('data/awakenings.ts'), bo = await window.__mod('ui/BuildOverview.ts'), b = s.player.growth.build, tags = b.tags();
  return { active: aw.activeAwakenings(tags).map(a => a.id), near: bo.nearestAwakenings(tags, 2).map(x => ({ id: x.a.id, name: x.a.name, missing: x.missing })), gaps: Object.fromEntries(Object.entries(tags).map(([t, n]) => [t, bo.tagGap(n).left])) }; }, G);
/** 用真实鼠标悬停某个命中区，读说明卡标题。 */
const hover = async name => {
  const pt = await p.evaluate(([G0, n]) => { const s = eval(G0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
    const o = all.find(x => x.name === n); if (!o) return null; const bd = o.getBounds(), R = s.game.canvas.getBoundingClientRect(), k = R.width / s.scale.width * s.cameras.main.zoom;
    return { x: R.left + (bd.x + bd.width / 2) * k, y: R.top + (bd.y + bd.height / 2) * k }; }, [G, name]);
  if (!pt) return null; await p.mouse.move(pt.x, pt.y, { steps: 3 }); await p.waitForTimeout(200);
  const r = await p.evaluate(G0 => { const s = eval(G0), all = []; const walk = l => { for (const o of l) { all.push(o); if (o.list) walk(o.list); } }; walk(s.children.list);
    const t = all.filter(o => o.name === 'item-tooltip' && o.visible); const root = t.at(-1); if (!root) return null; const ti = root.list.find(o => o.name === 'info-tooltip-title' || o.name === 'item-tooltip-name'); const body = root.list.find(o => o.name === 'info-tooltip-body'); return { title: ti?.text, body: body?.text }; }, G);
  await p.mouse.move(5, 5); await p.waitForTimeout(100); return r;
};
const rerender = () => p.evaluate(G0 => { const s = eval(G0); s.campUI.render(); }, G);

// 1) 空构筑
let v = await read('camp-build'), t = await truth();
await p.screenshot({ path: `${out}/after-empty-camp.png` });
ck('空构筑：武将卡（赵云、等级、本命武器）、战法 0/6、6 个空格都在', v.hero === '赵云' && v.level === `武将 Lv.${v.real.lv}` && /七探盘龙枪/.test(v.weapon ?? '') && v.count === '战法  0 / 6' && v.tacticHits === 6 && v.tacticNames.every(x => x === null), v);
ck('空构筑：八系 0/4、各差 2；没有觉醒的提示；下一步写「再拿 … 来源，即可激活」', Object.values(v.tags).every(x => x === '0/4') && Object.values(v.gaps).every(x => x === '差2') && /还没有觉醒/.test(v.none ?? '') && /^再拿 .+来源，即可激活「.+」$/.test(v.next[0] ?? '') && v.awakeCount === '已觉醒 0', v);
const emptyTip = await hover('camp-build-tactic-0');
ck('悬停空战法格：说明「可在升级 / 商人处获得」', /空战法格/.test(emptyTip?.title ?? '') && /三选一|军需商人/.test(emptyTip?.body ?? ''), emptyTip);

// 2) 中期构筑：连击 2 + 暴击 2（激活「无双追击」）+ 游击 1，追袭 2 级
await p.evaluate(G0 => { const s = eval(G0), b = s.player.growth.build, g = s.player.growth; for (const id of ['pursuit', 'pursuit', 'chain', 'eagle', 'sunder', 'windstep']) b.learn(id); g.attributes.agility = 4; g.attributes.strength = 2; g.masteries.dragon_gallop = 2; s.player.weapons[0].level = 3; }, G);
await rerender(); await p.waitForTimeout(300);
v = await read('camp-build'); t = await truth();
await p.screenshot({ path: `${out}/after-mid-camp.png` });
const NAMES = { pursuit: '追袭', chain: '连环', eagle: '鹰眼', sunder: '断金', windstep: '踏风步' };
ck('中期：战法格名字 / 等级点与实际一致（5 种、追袭 ●●○）', v.count === '战法  5 / 6' && v.real.learned.every((id, i) => v.tacticNames[i] === NAMES[id]) && v.tacticLv[0] === '●●○' && v.tacticNames[5] === null, { names: v.tacticNames, lv: v.tacticLv, learned: v.real.learned });
ck('中期：八系条与 build.tags() 一致；离门槛差几个算对', Object.entries(v.real.tags).every(([k, n]) => v.tags[k] === `${Math.min(n, 4)}/4`) && Object.entries(t.gaps).every(([k, n]) => v.gaps[k] === (n ? `差${n}` : '满')), { tags: v.tags, real: v.real.tags, gaps: v.gaps });
ck('中期：已觉醒 = activeAwakenings（连击 2 + 暴击 2 → 无双追击）', v.awakeCount === `已觉醒 ${t.active.length}` && t.active.includes('peerless') && t.active.every(id => v.awakes.includes(id)), { shown: v.awakes, active: t.active });
ck('中期：下一步提示 = 最接近的 2 个觉醒，写清还差几个哪系', t.near.every((x, i) => (v.next[i] ?? '').includes(x.name) && x.missing.every(([tag, k]) => (v.next[i] ?? '').includes(`${k} 个〔`))), { next: v.next, near: t.near });
ck('中期：属性数字、本命等级与实际一致', v.attrs.join() === [v.real.attrs.strength, v.real.attrs.agility, v.real.attrs.intellect, v.real.attrs.command].join() && /●●●○○/.test(v.weapon ?? ''), { attrs: v.attrs, weapon: v.weapon });
const tipTac = await hover('camp-build-tactic-0'), tipTag = await hover('camp-build-tag-hit-combo'), tipAw = await hover('camp-build-awake-peerless'), tipAttr = await hover('camp-build-attr-hit-agility'), tipNext = await hover('camp-build-next-hit-0');
ck('悬停：战法（名字 + 当前效果 + 下一级）、流派条（大白话 + 觉醒名）、觉醒卡、属性、下一步都有说明卡', /追袭/.test(tipTac?.title ?? '') && /下一级/.test(tipTac?.body ?? '') && /连击/.test(tipTag?.title ?? '') && /凑满 4 个/.test(tipTag?.body ?? '') && /无双追击/.test(tipAw?.title ?? '') && /敏捷|身法/.test(tipAttr?.title ?? '') && !!tipNext?.title, { tipTac, tipTag, tipAw, tipAttr, tipNext });

// 3) 满觉醒：每系都凑满 4 个（extraTags 模拟信物 / 宝物来源）
await p.evaluate(G0 => { const s = eval(G0), b = s.player.growth.build; for (const t of ['combo', 'critical', 'skirmish', 'charge', 'flame', 'control', 'command', 'bulwark']) for (let i = 0; i < 4; i++) b.extraTags.push(t); b.learn('ember'); }, G);
await rerender(); await p.waitForTimeout(300);
v = await read('camp-build'); t = await truth();
await p.screenshot({ path: `${out}/after-full-camp.png` });
ck('满觉醒：12 个觉醒全激活，八系全满，下一步写「全部觉醒都已激活」', t.active.length === 12 && v.awakeCount === '已觉醒 12' && Object.values(v.tags).every(x => x === '4/4') && Object.values(v.gaps).every(x => x === '满') && v.next[0] === '全部觉醒都已激活' && v.count === '战法  6 / 6', { awake: v.awakeCount, next: v.next, count: v.count });

// 4) 战斗内暂停菜单「战法构筑」用同一组件
await p.evaluate(G0 => { const s = eval(G0); s.campUI.setVisible(false); s.resting = false; s.setMode('pause'); s.openBuildPanel(); }, G);
await p.waitForTimeout(400);
const bp = await read('build-panel');
await p.screenshot({ path: `${out}/after-battle-panel.png` });
ck('战斗内「战法构筑」面板：同一组件、同样的数据（战法 6/6、已觉醒 12、八系全满）', bp.count === '战法  6 / 6' && bp.awakeCount === '已觉醒 12' && Object.values(bp.tags).every(x => x === '4/4') && bp.hero === '赵云', bp);
const tipBp = await hover('build-panel-tactic-0');
ck('战斗内面板悬停也有说明卡', /追袭/.test(tipBp?.title ?? ''), tipBp);

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
