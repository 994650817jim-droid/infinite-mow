// 构筑总览（2026-11-18 用户：「这个玩家看自己 build 不清楚，需要优化一下」）：行营「将帅帐」与战斗内「战法构筑」共用 ui/BuildOverview。
// 检查：各栏数据与实际构筑一致（武将 / 本命 / 武学 / 属性、战法格、信物格、六派势与档位、下一步提示）、悬停有说明、
// 空构筑正常显示；截图：空构筑、中期、六派满势、战斗内面板。电脑布局 1280×720。（2026-11-19 流派重做：八系 / 觉醒改为六派势）
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
    // 2026-11-19 流派重做：六派「势 n」+ 已达档位名 + 下一步（再 n 势：解锁 / 觉醒【…】）
    tags: Object.fromEntries(['fire', 'stratagem', 'archery', 'cavalry', 'warrior', 'formation'].map(t => [t, txt(P + '-tag-' + t)])),
    tiers: Object.fromEntries(['fire', 'stratagem', 'archery', 'cavalry', 'warrior', 'formation'].map(t => [t, txt(P + '-tag-tier-' + t)])),
    next: [txt(P + '-next-0'), txt(P + '-next-1')],
    // 实际构筑
    real: { name: s.player.growth.character, lv: s.player.level, tags: b.tags(), learned: Object.keys(b.tactics).filter(id => b.level(id) > 0), levels: Object.fromEntries(Object.keys(b.tactics).map(id => [id, b.level(id)])), attrs: { ...g.attributes }, weapon: s.player.weapons[0]?.level },
  };
}, [G, prefix]);
const truth = () => p.evaluate(async G0 => { const s = eval(G0), sc = await window.__mod('data/schools.ts'), b = s.player.growth.build, tags = b.tags();
  return { tags, names: Object.fromEntries(sc.SCHOOL_IDS.map(id => [id, sc.SCHOOLS[id].name])), tierNames: Object.fromEntries(sc.SCHOOL_IDS.map(id => [id, [2, 4, 6].filter(x => tags[id] >= x).map(x => sc.SCHOOLS[id].tiers[x].name)])) }; }, G);
const tagsMatch = (v, t) => Object.entries(t.tags).every(([k, n]) => v.tags[k] === '势 ' + n);
const tiersMatch = (v, t) => Object.entries(t.tierNames).every(([k, l]) => !l.length || l.every(x => (v.tiers[k] ?? '').includes(x)));
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
ck('空构筑：六派的势与 build.tags() 一致（赵云亲和骑突 1 势）；下一步写「再 n 势：解锁【…】」', tagsMatch(v, t) && t.tags.cavalry >= 1 && /^.+再 \d 势：(解锁|觉醒)【.+】$/.test(v.next[0] ?? ''), { tags: v.tags, real: t.tags, next: v.next });
const emptyTip = await hover('camp-build-tactic-0');
ck('悬停空战法格：说明「可在升级 / 商人处获得」', /空战法格/.test(emptyTip?.title ?? '') && /三选一|军需商人/.test(emptyTip?.body ?? ''), emptyTip);

// 2) 中期构筑：连击 2 + 暴击 2（激活「无双追击」）+ 游击 1，追袭 2 级
await p.evaluate(G0 => { const s = eval(G0), b = s.player.growth.build, g = s.player.growth; for (const id of ['pursuit', 'pursuit', 'chain', 'eagle', 'sunder', 'windstep']) b.learn(id); g.attributes.agility = 4; g.attributes.strength = 2; g.masteries.dragon_gallop = 2; s.player.weapons[0].level = 3; }, G);
await rerender(); await p.waitForTimeout(300);
v = await read('camp-build'); t = await truth();
await p.screenshot({ path: `${out}/after-mid-camp.png` });
const NAMES = { pursuit: '追袭', chain: '连环', eagle: '鹰眼', sunder: '断金', windstep: '踏风步' };
ck('中期：战法格名字 / 等级点与实际一致（5 种、追袭 ●●○）', v.count === '战法  5 / 6' && v.real.learned.every((id, i) => v.tacticNames[i] === NAMES[id]) && v.tacticLv[0] === '●●○' && v.tacticNames[5] === null, { names: v.tacticNames, lv: v.tacticLv, learned: v.real.learned });
ck('中期：势按战法等级算（追袭 2 级 + 连环 → 猛将 3 势、鹰眼 + 断金 → 弓弩 2 势），与 build.tags() 一致；已达档位名写出', tagsMatch(v, t) && t.tags.warrior === 3 && t.tags.archery === 2 && tiersMatch(v, t) && /鏖战/.test(v.tiers.warrior ?? '') && /神射/.test(v.tiers.archery ?? ''), { tags: v.tags, tiers: v.tiers, real: t.tags });
ck('中期：下一步 = 势最高、还没到 6 势的两派，写清再几势解锁什么', /猛将再 1 势：解锁【震荡】/.test(v.next[0] ?? '') && !!v.next[1], { next: v.next });
ck('中期：属性数字、本命等级与实际一致', v.attrs.join() === [v.real.attrs.strength, v.real.attrs.agility, v.real.attrs.intellect, v.real.attrs.command].join() && /●●●○○/.test(v.weapon ?? ''), { attrs: v.attrs, weapon: v.weapon });
const tipTac = await hover('camp-build-tactic-0'), tipTag = await hover('camp-build-tag-hit-warrior'), tipAttr = await hover('camp-build-attr-hit-agility');
ck('悬停：战法（名字 + 当前效果 + 下一级）、流派条（势、三档说明、势的来源）、属性都有说明卡', /追袭/.test(tipTac?.title ?? '') && /下一级/.test(tipTac?.body ?? '') && /猛将/.test(tipTag?.title ?? '') && /2 势/.test(tipTag?.body ?? '') && /势的来源/.test(tipTag?.body ?? '') && /敏捷|身法/.test(tipAttr?.title ?? ''), { tipTac, tipTag, tipAttr });

// 3) 六派都到 6 势（bonus 模拟亲和 / 随行 / 信物来源），再学一个火种凑满 6 格
await p.evaluate(G0 => { const s = eval(G0), b = s.player.growth.build; b.bonus = { fire: 6, stratagem: 6, archery: 6, cavalry: 6, warrior: 6, formation: 6 }; b.learn('ember'); }, G);
await rerender(); await p.waitForTimeout(300);
v = await read('camp-build'); t = await truth();
await p.screenshot({ path: `${out}/after-full-camp.png` });
ck('六派都到 6 势：势条全满、三档名都写出（含觉醒名），没有「下一步」', tagsMatch(v, t) && Object.values(t.tags).every(n => n >= 6) && tiersMatch(v, t) && !v.next[0] && v.count === '战法  6 / 6', { tags: v.tags, tiers: v.tiers, next: v.next, count: v.count });

// 4) 战斗内暂停菜单「战法构筑」用同一组件
await p.evaluate(G0 => { const s = eval(G0); s.campUI.setVisible(false); s.resting = false; s.setMode('pause'); s.openBuildPanel(); }, G);
await p.waitForTimeout(400);
const bp = await read('build-panel');
await p.screenshot({ path: `${out}/after-battle-panel.png` });
ck('战斗内「战法构筑」面板：同一组件、同样的数据（战法 6/6、六派都 6 势以上）', bp.count === '战法  6 / 6' && Object.values(bp.tags).every(x => /^势 ([6-9]|\d\d)$/.test(x ?? '')) && bp.hero === '赵云', bp);
const tipBp = await hover('build-panel-tactic-0');
ck('战斗内面板悬停也有说明卡', /追袭/.test(tipBp?.title ?? ''), tipBp);

ck('无页面报错', errors.length === 0, errors.slice(0, 5));
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
