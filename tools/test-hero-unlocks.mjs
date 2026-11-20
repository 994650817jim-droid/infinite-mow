// 可玩武将解锁（2026-11-19 hero-unlock-design.md，用户批准）：新存档只有刘关张赵、各节点来投、貂蝉走「三英战吕布」挑战线、诸葛亮第一章后、老存档补齐、
// 主页选将剪影 + 提示、「新武将 · 来投」揭幕、武将谱锁定行、?dev=1 默认全解锁。截图 assets/review/hero-unlocks/。
// 用法：BASE=http://127.0.0.1:5743/ node tools/test-hero-unlocks.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/hero-unlocks';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info).slice(0, 900)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const KEYS = ['im_hero_unlocks_v1', 'im_roster_v1', 'im_world_v1', 'im_heroes_v1', 'im_achievements', 'im_story_v1', 'im_story_seen_v1', 'im_last_hero', 'im_chapter1_cleared'];
await p.addInitScript(keys => { if (!sessionStorage.getItem('hu-seeded')) { for (const k of keys) localStorage.removeItem(k); sessionStorage.setItem('hu-seeded', '1'); } }, KEYS);
const open = async q => { await p.goto(BASE + '?dev=1&layout=desktop' + q); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 }); await p.waitForTimeout(900); };
await open('&unlock=real');
const M = "import('/src/systems/HeroUnlocks.ts')";

// ① 新存档：只有四人
const fresh = await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'), R = await import('/src/systems/RosterStore.ts');
  return { locked: U.lockedHeroes(), starters: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'].every(U.heroUnlocked), owned: R.heroOwned('zhuge'), lord: R.canPickLord('zhuge'), pending: U.pendingReveals() }; });
ck('新存档：只有刘备、关羽、张飞、赵云可玩，其余 13 位锁定（含 P2 吕布、张辽、周瑜、太史慈、曹操；不能选主将 / 主公）', fresh.locked.length === 13 && ['lvbu', 'zhangliao', 'zhouyu', 'taishici', 'mengde'].every(id => fresh.locked.includes(id)) && fresh.starters && !fresh.owned && !fresh.lord && fresh.pending.length === 0, fresh);

// ② 各节点：差一步不解锁、到了就解锁（纯规则，进度整份注入）
const rules = await p.evaluate(async () => {
  const U = await import('/src/systems/HeroUnlocks.ts');
  const P = (o = {}) => ({ ch1: false, lubu: 0, arc: a => (o.arc ?? {})[a] ?? 0, arcOpen: a => !!(o.open ?? {})[a], flag: k => (o.flag ?? {})[k], ...o.top });
  const R = U.UNLOCK_RULES, t = (id, before, at) => ({ id, before: R[id](P(before)), at: R[id](P(at)) });
  return [
    t('zhuge', {}, { top: { ch1: true } }),
    t('diaochan', { arc: { qunxiong: 2 } }, { arc: { qunxiong: 3 } }),
    t('diaochan', { top: { lubu: 0 } }, { top: { lubu: 1 } }),             // 三英战吕布挑战线
    t('huangyueying', { arc: { chibi: 1 } }, { arc: { chibi: 2 } }),
    t('sunshangxiang', { arc: { chibi: 2 } }, { arc: { chibi: 3 } }),
    t('weiyan', { arc: { jingnan: 2 } }, { arc: { jingnan: 3 } }),
    t('huangzhong', { arc: { jingnan: 3 }, flag: { spared_huangzhong: false } }, { arc: { jingnan: 3 }, flag: { spared_huangzhong: true } }),
    t('huangzhong', { arc: { jingnan: 3 }, flag: { spared_huangzhong: false } }, { arc: { jingnan: 3 }, flag: { spared_huangzhong: false }, open: { hanzhong: true } }), // 打死 → 第八章开放前来投
    t('pangtong', { arc: { jingnan: 3 } }, { arc: { shu: 1 } }),
    t('machao', { arc: { shu: 2 } }, { arc: { shu: 3 } }),
    t('lvbu', { top: { lubu: 1, persuaded: id => id === 'chengong' } }, { top: { persuaded: id => id === 'lubu' } }), // P2：打赢吕布不算，劝降吕布才来投
    t('zhangliao', { top: { persuaded: id => id === 'lubu' } }, { top: { persuaded: id => id === 'zhangliao' } }), // P2：劝降张辽才来投
    t('zhouyu', { top: { persuaded: id => id === 'chengpu' } }, { top: { persuaded: id => id === 'zhouyu' } }), // P2：劝降周瑜才来投（程普先降只是前置）
    t('taishici', { top: { persuaded: id => id === 'zhouyu' } }, { top: { persuaded: id => id === 'taishici' } }), // P2：劝降太史慈
    t('mengde', { top: { persuaded: id => id === 'xiahoudun' } }, { top: { persuaded: id => id === 'caocao' } }), // P2：曹操归附（首领 id 仍是 caocao）
  ];
});
ck('各节点：诸葛亮第一章后、貂蝉第三章白门楼、黄月英 5-2、孙尚香 5-3、魏延 / 黄忠 6-3、庞统 7-1、马超 7-3、吕布 / 张辽 / 周瑜 / 太史慈劝降、曹操归附——差一步不解锁、到了就解锁', rules.every(r => !r.before && r.at), rules);
ck('貂蝉挑战线：「三英战吕布」赢一次就来投（先于白门楼）', rules[2].at && !rules[2].before, rules[2]);
ck('黄忠保底：长沙打死（未放过）→ 第八章开放前伤愈来投', rules[7].at && !rules[7].before, rules[7]);

// ③ 真存档：按进度补查 → 写账号解锁、待揭幕；本档来投只给一次
const flow = await p.evaluate(async () => {
  const U = await import('/src/systems/HeroUnlocks.ts');
  const base = { ch1: false, lubu: 0, arc: () => 0, arcOpen: () => false, flag: k => JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags?.[k] };
  const granted = [];
  const a = U.refreshUnlocks({ ...base, ch1: true }, id => { granted.push(id); return true; });
  const pend = U.pendingReveals(), z = U.heroUnlocked('zhuge');
  const again = U.refreshUnlocks({ ...base, ch1: true }, id => { granted.push(id); return true; });
  const c = U.refreshUnlocks({ ...base, ch1: true, lubu: 1 }, () => false);
  return { a, pend, z, again, granted, c, dc: U.heroUnlocked('diaochan'), joinedFlag: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags?.hero_joined_zhuge };
});
ck('第一章通关 → 诸葛亮账号解锁、待揭幕；本档来投（入麾下）只给一次', flow.a.join() === 'zhuge' && flow.z && flow.pend.includes('zhuge') && flow.again.length === 0 && flow.granted.join() === 'zhuge' && flow.joinedFlag === true, flow);
ck('三英战吕布胜一场 → 貂蝉解锁', flow.c.join() === 'diaochan' && flow.dc, flow);

// ④ 截图：主页选将剪影（解锁诸葛亮、貂蝉后，其余 6 位剪影 + 提示）
const pick = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('MenuScene'); s.heroPicker.open(0); await new Promise(r => setTimeout(r, 900));
  s.heroPicker.turn?.(1); await new Promise(r => setTimeout(r, 700));
  const lt = s.heroPicker.root.list.flatMap(o => o.list ?? []).filter(o => /^pick-lock-/.test(o.name ?? '') && o.visible && o.parentContainer?.visible).map(o => o.name.replace('pick-lock-', '') + ':' + o.text.replace(/\n/g, ' '));
  return { lt };
});
await p.screenshot({ path: `${OUT}/picker-silhouettes.png` });
ck('主页选将：没归附的立绘压成剪影，只写「尚未归附 · 需劝降招募」（不透露哪一章、哪一关）', pick.lt.length >= 2 && pick.lt.every(t => /尚未归附 需劝降招募/.test(t) && !/章|关|白门|赤壁|长沙|成都|入蜀|联姻|吕布/.test(t)), pick);
await p.evaluate(() => { const s = window.__game.scene.getScene('MenuScene'); s.heroPicker.root.setVisible(false); });

// ⑤ 揭幕：「新武将 · 来投」
await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'), R = await import('/src/ui/HeroJoinReveal.ts'); window.__revealDone = false; R.showHeroJoin(s, 'zhuge', () => { window.__revealDone = true; }); });
await p.waitForTimeout(1800);
const rv = await p.evaluate(() => { const s = window.__game.scene.getScene('MenuScene'), r = s.children.getByName('hero-join-reveal'); const g = n => r?.getByName(n); return { on: !!r, name: g('hero-join-name')?.text, epi: g('hero-join-epithet')?.text, lines: g('hero-join-lines')?.text, meta: g('hero-join-meta')?.text, portrait: !!g('hero-join-portrait') }; });
await p.screenshot({ path: `${OUT}/join-reveal.png` });
await p.evaluate(() => { const s = window.__game.scene.getScene('MenuScene'); s.children.getByName('hero-join-reveal')?.getByName('hero-join-ok')?.emit('pointerdown'); });
await p.waitForTimeout(500);
const closed = await p.evaluate(() => window.__revealDone && !window.__game.scene.getScene('MenuScene').children.getByName('hero-join-reveal'));
ck('揭幕：水墨立轴 + 卧龙 · 诸葛亮 + 来投那一刻的话 + 本命与亲和，「收入麾下」关闭', rv.on && rv.name === '诸葛亮' && rv.epi === '卧龙' && /卧龙/.test(rv.lines ?? '') && /本命/.test(rv.meta ?? '') && rv.portrait && closed, { rv, closed });

// ⑥ 武将谱：没来投的在名册末尾「未来投」、点开是剪影 + 提示
const codex = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('MenuScene'), { HeroCodexUI } = await import('/src/ui/HeroCodexUI.ts');
  const ui = new HeroCodexUI(s, 'zhaoyun', () => undefined); window.__codex = ui; await new Promise(r => setTimeout(r, 300));
  const find = (o, n) => o.name === n ? o : (o.list ?? []).map(c => find(c, n)).find(Boolean); find(ui.root, 'codex-locked-machao')?.emit('pointerdown'); await new Promise(r => setTimeout(r, 900));
  const all = [], objs = []; const walk = o => { if (o.name) { all.push(o.name); objs.push(o); } (o.list ?? []).forEach(walk); }; walk(ui.root);
  const hint = objs.find(o => o.name === 'codex-locked-hint')?.text;
  return { rows: all.filter(n => /^codex-locked-/.test(n)), hint };
}).catch(e => ({ err: String(e) }));
await p.screenshot({ path: `${OUT}/codex-locked.png` });
ck('武将谱：没归附的列在名册末尾「未归附」，点开只写「尚未归附 · 需劝降招募」（不透露章节）', (codex.rows ?? []).length >= 6 && codex.hint === '需劝降招募' && !/章|关|成都/.test(JSON.stringify(codex)), codex);
await p.evaluate(() => { window.__codex?.root?.destroy?.(); });

// ⑦ 老存档补齐：主公 / 已在麾下 / 练过级的都算解锁，且不弹揭幕
const legacy = await p.evaluate(async () => {
  const U = await import('/src/systems/HeroUnlocks.ts');
  localStorage.removeItem('im_hero_unlocks_v1');
  localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'machao', lordFinal: true, owned: [{ id: 'machao', kind: 'hero', hero: 'machao' }, { id: 'weiyan', kind: 'hero', hero: 'weiyan' }], followers: [], offers: [], captives: [], season: 0, manual: 0, dry: 0, seq: 0, hall: 1 }));
  localStorage.setItem('im_heroes_v1', JSON.stringify({ heroes: { pangtong: { level: 6, xp: 10 } } }));
  return { lord: U.heroUnlocked('machao'), owned: U.heroUnlocked('weiyan'), leveled: U.heroUnlocked('pangtong'), still: U.heroUnlocked('sunshangxiang'), pending: U.pendingReveals() };
});
ck('老存档补齐：当前主公（马超）、已在麾下（魏延）、练过级（庞统）都算解锁，没进度的仍锁，补齐不弹揭幕', legacy.lord && legacy.owned && legacy.leveled && !legacy.still && legacy.pending.length === 0, legacy);

// ⑧ 开发测试默认全解锁
await open('');
const dev = await p.evaluate(async () => (await import('/src/systems/HeroUnlocks.ts')).lockedHeroes().length);
ck('?dev=1 默认全部解锁（?unlock=real 才看真实锁定）', dev === 0, { dev });
ck('无页面报错', errs.length === 0, errs.slice(0, 4));
await p.evaluate(keys => { for (const k of keys) localStorage.removeItem(k); }, KEYS);
await b.close();
const pass = rows.filter(Boolean).length; console.log(`\n${pass}/${rows.length} 通过`); process.exit(pass === rows.length ? 0 : 1);
