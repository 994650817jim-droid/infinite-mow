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
  return { total: (await import('/src/data/characters.ts')).CHARACTERS.length, locked: U.lockedHeroes(), starters: ['liubei', 'guanyu', 'zhangfei', 'zhaoyun'].every(U.heroUnlocked), owned: R.heroOwned('zhuge'), lord: R.canPickLord('zhuge'), pending: U.pendingReveals() }; });
ck('新存档：只有刘备、关羽、张飞、赵云可玩，其余全部锁定（含 P2 吕布、张辽、周瑜、太史慈、曹操；不能选主将 / 主公）', fresh.locked.length >= 13 && fresh.locked.length === fresh.total - 4 && ['lvbu', 'zhangliao', 'zhouyu', 'taishici', 'mengde'].every(id => fresh.locked.includes(id)) && fresh.starters && !fresh.owned && !fresh.lord && fresh.pending.length === 0, fresh);

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
    t('ganning', { top: { persuaded: id => id === 'huangzu' } }, { top: { persuaded: id => id === 'ganning' } }), // P3：劝降甘宁（江夏支线江夏外围）
    t('dianwei', { top: { persuaded: id => id === 'xiahoudun' } }, { top: { persuaded: id => id === 'caocao' } }), // P3：曹操归附时随曹公来投
    t('sunquan', { top: { persuaded: id => id === 'zhoutai' } }, { top: { persuaded: id => id === 'sunquan' } }), // P3：孙权归附（东吴支线吴郡）
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
ck('第一章通关 → 诸葛亮账号解锁、待揭幕；refreshUnlocks 的 grant 回调只给一次（游戏里已不再传 grant：解锁只代表可选为主将）', flow.a.join() === 'zhuge' && flow.z && flow.pend.includes('zhuge') && flow.again.length === 0 && flow.granted.join() === 'zhuge' && flow.joinedFlag === true, flow);
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
ck('揭幕：水墨立轴 + 卧龙 · 诸葛亮 + 来投那一刻的话 + 本命与亲和 + 「往招贤馆招募」提示，「准其归附」关闭', rv.on && rv.name === '诸葛亮' && rv.epi === '卧龙' && /卧龙/.test(rv.lines ?? '') && /本命/.test(rv.meta ?? '') && /招贤馆/.test(rv.meta ?? '') && rv.portrait && closed, { rv, closed });

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

// ⑨ 解锁 ≠ 随从（2026-11-20 用户「角色解锁是指可以玩到的角色，不是解锁就可以跟随了，需要去招贤那里招」）
const hire = await p.evaluate(async () => {
  const U = await import('/src/systems/HeroUnlocks.ts'), R = await import('/src/systems/RosterStore.ts'), out = {};
  localStorage.setItem('im_world_v1', JSON.stringify({ version: 8, yellowStages: 3, dongzhuoStages: 3, warlordStages: 0, guanduStages: 0, worldAvailable: true, cleared: { huangjin: true, hulao: true }, merits: 0, provisions: 100, buildings: { barracks: 1, farm: 1, clinic: 1 }, town: { levels: { hall: 3, barracks: 1, farm: 1, talent: 3 } } }));
  localStorage.setItem('im_roster_v1', JSON.stringify({ version: 1, lord: 'zhaoyun', lordFinal: true, owned: [{ id: 'zhaoyun', kind: 'hero', hero: 'zhaoyun' }], followers: [], offers: [], captives: [], season: -1, manual: 0, dry: 0, seq: 0, hall: 3 }));
  U.resetUnlocks(true); U.refreshUnlocks({ ch1: true, lubu: 0, arc: () => 0, arcOpen: () => false, flag: () => false }); // 解锁诸葛亮（不传 grant）
  const s0 = R.loadRoster(), heroOf = id => s0.owned.find(r => r.hero === id);
  out.starters = ['liubei', 'guanyu', 'zhangfei'].every(h => !!heroOf(h)); out.starterFollow = s0.followers.filter(id => ['liubei', 'guanyu', 'zhangfei'].includes(id)).length;
  out.zhugeUnlocked = U.heroUnlocked('zhuge'); out.zhugePlayable = R.canPickLord('zhuge') || R.heroOwned('zhuge') || true; out.zhugeHired0 = R.heroHired('zhuge');
  out.locked = R.hireHero('pangtong'); out.poor = R.hireHero('zhuge'); out.cost = R.heroHireCost('zhuge');
  const w = JSON.parse(localStorage.getItem('im_world_v1')); w.provisions = 3000; localStorage.setItem('im_world_v1', JSON.stringify(w));
  out.ok = R.hireHero('zhuge'); const s1 = R.loadRoster(); out.zhugeHired1 = R.heroHired('zhuge'); out.grain = JSON.parse(localStorage.getItem('im_world_v1')).provisions; out.again = R.hireHero('zhuge');
  // 劝降可玩武将（黄忠）：只解锁可玩，不入麾下
  out.persuade = R.joinByPersuasion('黄忠', 'huangzhong'); out.hzOwned = R.loadRoster().owned.some(r => r.hero === 'huangzhong');
  // 席位里不再随机挂可玩武将
  R.setRosterRandom(() => 0); for (let i = 0; i < 4; i++) R.manualRefresh(); out.heroOffers = R.loadRoster().offers.filter(o => o.kind === 'hero').length; R.setRosterRandom();
  void s1; return out;
});
ck('新存档：开局刘关张赵默认已招，主公之外的三人随行（名额内）', hire.starters && hire.starterFollow >= 1, hire);
ck('解锁诸葛亮只代表可选为主将：没招之前不在麾下（不能当随从）', hire.zhugeUnlocked && !hire.zhugeHired0, hire);
ck('招贤馆「名将」：未归附的招不了（尚未归附）、军粮不够招不了', !hire.locked.ok && /尚未归附/.test(hire.locked.message) && !hire.poor.ok && /军粮不足/.test(hire.poor.message), hire);
ck('付军粮招募后入麾下、能随行；扣粮 = 档次价（诸葛亮 ' + hire.cost + '），不能重复招', hire.ok.ok && hire.zhugeHired1 && hire.grain === 3000 - hire.cost && !hire.again.ok, hire);
ck('劝降可玩武将（黄忠）只解锁可玩，提示往招贤馆招募，不直接入麾下', /招贤馆/.test(hire.persuade.message) && !hire.hzOwned, hire);
ck('招贤馆席位不再随机出可玩武将（改在「名将」页招募）', hire.heroOffers === 0, hire);
// 截图：招贤馆「名将」页
// 再解锁貂蝉（三英战吕布胜一场）→ 名将页里有一位「可招募」
await p.evaluate(async () => { const U = await import('/src/systems/HeroUnlocks.ts'); U.refreshUnlocks({ ch1: true, lubu: 1, arc: () => 0, arcOpen: () => false, flag: () => false }); window.__game.scene.getScene('MenuScene').scene.start('TalentHallScene'); });
await p.waitForFunction(() => window.__game.scene.isActive('TalentHallScene'), null, { timeout: 30000 }); await p.waitForTimeout(900);
const hall = await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'); s.tab = 'heroes'; const names = []; const walk = c => { for (const o of c.list ?? []) { if (o.name) names.push([o.name, o.text]); if (o.list) walk(o); } }; for (let pg = 3; pg >= 0; pg--) { s.page = pg; s.render(); walk(s.content); } /* 未归附的排在后面几页 */ return { tab: names.find(n => n[0] === 'talent-tab-heroes')?.[1], zhuge: names.find(n => n[0] === 'talent-hero-status-zhuge')?.[1], locked: names.find(n => n[0] === 'talent-hero-status-pangtong')?.[1], hireBtn: names.find(n => n[0] === 'talent-hire-diaochan')?.[1] ?? null, dc: names.find(n => n[0] === 'talent-hero-status-diaochan')?.[1] }; });
await p.waitForTimeout(300); await p.screenshot({ path: OUT + '/talent-heroes.png' });
ck('招贤馆「名将」页：已招的写「已在麾下」，未归附的只写「尚未归附 · 需劝降招募」', /已在麾下/.test(hall.zhuge ?? '') && /尚未归附/.test(hall.locked ?? '') && /需在此招募/.test(hall.dc ?? ''), hall);

// ⑧ 开发测试默认全解锁
await open('');
const dev = await p.evaluate(async () => (await import('/src/systems/HeroUnlocks.ts')).lockedHeroes().length);
ck('?dev=1 默认全部解锁（?unlock=real 才看真实锁定）', dev === 0, { dev });
ck('无页面报错', errs.length === 0, errs.slice(0, 4));
await p.evaluate(keys => { for (const k of keys) localStorage.removeItem(k); }, KEYS);
await b.close();
const pass = rows.filter(Boolean).length; console.log(`\n${pass}/${rows.length} 通过`); process.exit(pass === rows.length ? 0 : 1);
