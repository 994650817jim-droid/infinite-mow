// 首领招降（surrender-spec.md §十二 验收）。第一阶段：1 档行为、2 成功率、3 失败、4 再压一压、5 宁死不降、6 已在麾下 / 降将栏不弹窗。电脑布局。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-surrender.mjs   （ONLY=odds,huaxiong,... 只跑部分）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/surrender';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('surrender-seeded')) { for (const k of ['im_story_v1', 'im_roster_v1']) localStorage.removeItem(k); sessionStorage.setItem('surrender-seeded', '1'); } window.__IM_PARLEY_LIVE = true; });
  await p.goto(BASE + '?dev=1&layout=desktop&story=full');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  // 招贤馆随天下地图开放：用 WorldStore 自己的接口把这个测试存档开到第二章之后
  const unlocked = await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); s.yellowStages = 3; s.worldAvailable = true; s.cleared.huangjin = true; s.provisions = (s.provisions ?? 0) + 500; localStorage.setItem('im_world_v1', JSON.stringify(s)); return W.worldUnlocked(); });
  if (!unlocked) throw new Error('天下地图没能开放（测试存档）');
  const mod = path => p.evaluate(async path => { const m = await import(path); window.__m = m; return Object.keys(m); }, path);

  // ② 成功率（纯函数）
  if (want('odds')) {
    await mod('/src/data/surrender.ts');
    const o = await p.evaluate(() => {
      const M = window.__m, d = k => M.surrenderDef(k), base = { lord: 'zhaoyun', team: ['zhaoyun'], surrendered: [], followerBosses: [], flags: {}, pressed: false };
      const pct = (k, c) => M.surrenderOdds(d(k), { ...base, ...c }).pct;
      return {
        zhangxiuLiubei2: pct('qunxiong-2:zhangxiu', { lord: 'liubei', team: ['liubei'], surrendered: ['huaxiong', 'xurong'] }),
        zhangxiuLiubei2Press: pct('qunxiong-2:zhangxiu', { lord: 'liubei', team: ['liubei'], surrendered: ['huaxiong', 'xurong'], pressed: true }),
        yanliang: pct('hulao-2:xurong', {}), yanliangPress: pct('hulao-2:xurong', { pressed: true }),
        renownCap: pct('hulao-2:xurong', { surrendered: ['a', 'b', 'c', 'd'], honored: ['e', 'f', 'g', 'h'] }),
        sameCampOnce: pct('hulao-2:xurong', { followerBosses: ['huaxiong', 'lijue'] }),
        wenchouYan: pct('caowei-4:xiahoudun', { surrendered: ['caocao'] }),
        dunBlocked: M.surrenderOdds(d('caowei-4:xiahoudun'), base), chunyuBlocked: M.surrenderOdds(d('guandu-3:chunyuqiong'), base),
        dunPartner: pct('caowei-4:xiahoudun', { partner: { id: 'caocao', persuaded: true, executed: false } }) > 0,
        zhouyu0: M.surrenderOdds(d('nanjun-2:zhouyu'), base).blocked, zhouyu1: pct('nanjun-2:zhouyu', { surrendered: ['chengpu'] }),
        neverTiers: ['hulao-1:huaxiong', 'guandu-2:yanliang', 'guandu-2:wenchou', 'xiapi-2:gaoshun', 'hebei-4:yuanshao', 'gongsun-3:gongsunzan'].map(k => d(k).tier),
        reasons: M.SURRENDER_DEFS.filter(x => !x.reason).map(x => x.key),
        recruit: ['典韦', '陈宫', '张任', '庞德', '高览', '太史慈'].map(n => M.recruitableName(n)),
        chunyuBurn: pct('guandu-3:chunyuqiong', { flags: { depotsAllBurned: true } }),
        lubuDiao: pct('lubu-1:lubu', { team: ['zhaoyun', 'diaochan'] }), lubuLiubei: pct('lubu-1:lubu', { lord: 'liubei', team: ['liubei'] }),
        cap: pct('qunxiong-2:zhangxiu', { lord: 'liubei', surrendered: ['a', 'b', 'c', 'd', 'e'], followerBosses: ['zhangxiu2'], pressed: true, team: ['liubei'] }),
        sure: M.surrenderOdds(d('jingnan-1:zhaofan'), base), never: pct('qunxiong-3:yuanshu', {}),
        count: M.SURRENDER_DEFS.filter(x => /^(huangjin|hulao|lubu|qunxiong|guandu|chibi|jingnan|shu|hanzhong|xiangfan|yiling|nanzheng|beifa)-/.test(x.key)).length, tiers: M.SURRENDER_DEFS.filter(x => /^(huangjin|hulao|lubu|qunxiong|guandu|chibi|jingnan|shu|hanzhong|xiangfan|yiling|nanzheng|beifa)-/.test(x.key)).reduce((a, x) => (a[x.tier] = (a[x.tier] ?? 0) + 1, a), {}),
      };
    });
    ck('成功率：刘备主公、已降 2 人劝张绣 = 55+10+4 = 69%；再压一压 84%', o.zhangxiuLiubei2 === 69 && o.zhangxiuLiubei2Press === 84, o);
    ck('成功率：赵云劝徐荣 15%、再压一压 30%', o.yanliang === 15 && o.yanliangPress === 30, o);
    ck('仁名上限 +10（劝降 4 人 + 厚葬 4 人 → 15+10 = 25%）', o.renownCap === 25, o);
    ck('同阵营降将在队只算一次（两名董卓旧部 → +10）', o.sameCampOnce === 25, o);
    ck('关系 / 旗标：曹操已降劝夏侯惇 +30、粮仓尽焚劝淳于琼 +15、貂蝉在侧劝吕布 +20、刘备主公劝吕布（+10 −20）', o.wenchouYan === 45 + 2 && o.chunyuBurn === 30 && o.lubuDiao === 35 && o.lubuLiubei === 5, o);
    ck('前置条件（surrender-rules）：夏侯惇要曹操先归附（本场同伴已降也算）、淳于琼要先焚尽粮仓、周瑜要程普先降——没满足时把握 0 并写条件', o.dunBlocked.pct === 0 && /曹操已归附/.test(o.dunBlocked.blocked) && /粮仓/.test(o.chunyuBlocked.blocked) && o.dunPartner && /程普已降/.test(o.zhouyu0) && o.zhouyu1 > 0, o);
    ck('宁死不降改档：华雄、颜良、文丑、高顺、袁绍、公孙瓒；每个首领都写了依据；典韦 / 陈宫 / 张任 / 庞德不进招贤馆，高览 / 太史慈可以', o.neverTiers.every(t => t === 'never') && o.reasons.length === 0 && o.recruit.join() === 'false,false,false,false,true,true', o);
    ck('上限 90%；必降 100% 不掷骰；宁死不降 0', o.cap === 90 && o.sure.pct === 100 && o.sure.sure && o.never === 0, o);
    ck('主线招降表：39 个首领（含挑战关吕布），可降 3 / 必降 3 / 难降 6 / 宁死不降 13（华雄、颜良、文丑、兀突骨改宁死不降）+ 败退型 3 + 第一章 3 / 剧情 7 / 孟获 1', o.count === 39 && o.tiers.retreat === 3 && o.tiers.can === 3 && o.tiers.sure === 3 && o.tiers.hard === 6 && o.tiers.never === 13 && o.tiers.story === 7 && o.tiers.silent === 3 && o.tiers.meng === 1, o.tiers);
  }

  // 场景工具：开某关、首领出场、把首领打到残血
  const S = scene => `window.__game.scene.getScene('${scene}')`;
  const open = async (scene, reg, run) => {
    await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [scene, reg, run]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S(scene), { timeout: 90000 }); await p.waitForTimeout(800);
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S(scene), String(fn), arg]);
    await ev(s => { s.player.damageImmune = true; });
    for (let i = 0; i < 150 && !(await ev(s => !!s.boss?.active)); i++) { await ev(s => { if (s.mode === 'story') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.boss?.active && !s.bossSpawned) { const w = s.chapter?.waves; s.devSetTime?.(w?.length ? w[w.length - 1].start + 1 : 999); } }); await p.waitForTimeout(200); }
    // 章头剧情卷轴挡着（名字不一）时：收掉卷轴、直接让首领出场
    if (!(await ev(s => !!s.boss?.active))) await ev(s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); s.spawnBoss(); });
    await p.waitForTimeout(600);
    return ev;
  };
  const hurtTo = (ev, frac) => ev((s, f) => { const b = s.boss; if (!b?.active) return null; b.invulnerable = false; const dmg = b.hp - b.maxHp * f + 1; s.hitEnemy(b, Math.max(1, dmg), s.combatNow, 'melee', false, false); return { hp: b.hp / b.maxHp, mode: s.mode }; }, frac);
  const waitPanel = async ev => { for (let i = 0; i < 25; i++) { const r = await ev(s => s.mode === 'parley' && !!s.children.getByName('parley-panel')); if (r) return true; await p.waitForTimeout(120); } return false; };
  const buttons = ev => ev(s => { const pn = s.children.getByName('parley-panel'); return pn ? pn.list.filter(o => /^parley-(persuade|execute|press)$/.test(o.name ?? '') && o.input?.enabled).map(o => o.name) : []; });

  // ① 第一章不弹窗（张梁）
  if (want('ch1')) {
    const ev = await open('GameScene', {}, { chapter: 'huangjin', stage: 1 });
    const r = await ev(s => ({ parley: !!s.parley, key: s.surrenderKey() }));
    await hurtTo(ev, .1); await p.waitForTimeout(400);
    const r2 = await ev(s => ({ mode: s.mode, panel: !!s.children.getByName('parley-panel') }));
    ck('第一章（张梁）不建招降、不弹窗', !r.parley && r.key === 'huangjin-1:zhangliang' && !r2.panel && r2.mode !== 'parley', { r, r2 });
  }
  // ① 剧情首领不弹窗（2-3 董卓）
  if (want('story')) {
    const ev = await open('GameScene', {}, { chapter: 'hulao', westStage: 3 });
    const r = await ev(s => ({ parley: !!s.parley, key: s.surrenderKey() }));
    ck('剧情首领（2-3 董卓）不建招降、不弹窗', !r.parley && r.key === 'hulao-3:dongzhuo', r);
  }
  // ③ 失败：难降华雄掷骰失败 → 拒绝台词 + 横幅、25% 血、伤害 +20%，本场不再弹窗；打死掉宝箱
  if (want('huaxiong')) {
    const ev = await open('GameScene', {}, { chapter: 'hulao', westStage: 2 });
    await ev(s => { s.parley.constructor.random = () => .99; });
    const dmg0 = await ev(s => s.boss.def.damage);
    await hurtTo(ev, .12);
    const panel = await waitPanel(ev);
    const bt = await buttons(ev);
    await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/seal-hard.png` });
    const pre = await ev(s => s.parley.snapshot());
    ck('难降（徐荣）：15% 血弹窗，三个按钮、把握 15%、黄印「难降」', panel && bt.length === 3 && pre.odds.pct === 15 && pre.tier === 'hard', { panel, bt, pre });
    await ev(s => s.choose('persuade')); await p.waitForTimeout(300);
    const f = await ev(s => ({ ...s.parley.snapshot(), hp: s.boss.hp / s.boss.maxHp, dmg: s.boss.def.damage, mode: s.mode, banner: (() => { const all = []; const walk = l => { for (const o of l) { if (o.type === 'Text') all.push(o.text); if (o.list) walk(o.list); } }; walk(s.children.list); return all.find(t => t?.includes('劝降不成')); })() }));
    await p.screenshot({ path: `${OUT}/fail-banner.png` });
    ck('劝降失败：红横幅「劝降不成 · 徐荣怒而再战」、回到 25% 血、伤害 +20%', f.state === 'failed' && f.hp >= .249 && Math.abs(f.dmg - dmg0 * 1.2) < .01 && f.mode === 'none' && !!f.banner, { f, dmg0 });
    await hurtTo(ev, .05); await p.waitForTimeout(300);
    const again = await ev(s => ({ panel: !!s.children.getByName('parley-panel'), opens: s.parley.log.opens }));
    ck('失败后本场不再弹窗', !again.panel && again.opens === 1, again);
    await ev(s => { s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }); await p.waitForTimeout(700);
    const k = await ev(s => ({ boss: !!s.boss?.active, chests: s.bossChests.length }));
    ck('失败后打死：照常倒地掉首领宝箱', !k.boss && k.chests >= 1, k);
  }
  // ④ 再压一压 → 成功（张绣，可降）：首领打不到 5% 以下、到 5% 再弹窗只有两个按钮；成功不掉宝箱
  if (want('zhangxiu')) {
    const ev = await open('ThirdGameScene', { thirdStage: 2 }, { thirdStage: 2 });
    await ev(s => { s.parley.constructor.random = () => .01; });
    await hurtTo(ev, .12); await waitPanel(ev);
    await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/seal-can.png` });
    await ev(s => s.choose('press')); await p.waitForTimeout(250);
    const lock = await ev(s => { const b = s.boss; s.hitEnemy(b, b.maxHp, s.combatNow, 'melee', false, false); return { hp: b.hp / b.maxHp, active: b.active }; });
    const second = await waitPanel(ev), bt = await buttons(ev), snap = await ev(s => s.parley.snapshot());
    ck('再压一压：一击也打不死、锁在 5%，到 5% 再弹窗只有「劝降 / 斩杀」，把握 +15（55+15 = 70%）', lock.active && lock.hp >= .049 && lock.hp <= .06 && second && bt.length === 2 && snap.odds.pct === 70, { lock, second, bt, snap });
    await ev(s => s.choose('persuade')); await p.waitForTimeout(250);
    await p.screenshot({ path: `${OUT}/success-banner.png` });
    for (let i = 0; i < 20 && !(await ev(s => !s.boss?.active)); i++) await p.waitForTimeout(150);
    await p.waitForTimeout(800);
    const r = await ev(s => ({ ok: s.parley?.persuadedOk, chests: s.bossChests.length, killed: s.bossKilled, mode: s.mode, over: s.over, roster: JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? [], flags: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {} }));
    ck('劝降成功：算击败首领、不倒地不掉宝箱，张绣进降将栏、记入 surrendered', r.ok && r.chests === 0 && r.killed && r.roster.some(o => o.boss === 'zhangxiu') && String(r.flags.surrendered).includes('zhangxiu'), r);
  }
  // ⑤ 宁死不降（袁术）：本存档第一次弹窗，劝降必拒后只能斩杀；第二次不弹窗、倒下播临终台词
  if (want('yuanshu')) {
    let ev = await open('ThirdGameScene', { thirdStage: 3 }, { thirdStage: 3 });
    await hurtTo(ev, .12); const first = await waitPanel(ev);
    await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/seal-never.png` });
    const bt0 = await buttons(ev), why = await ev(s => { const pn = s.children.getByName('parley-panel'); return { reason: pn.getByName('parley-reason')?.text, honor: pn.getByName('parley-honor')?.text, grey: pn.list.filter(o => o.type === 'Text').map(o => o.text).includes('宁死不降') }; });
    await ev(s => s.choose('persuade')); await p.waitForTimeout(250);
    const bt1 = await buttons(ev), st = await ev(s => s.parley.snapshot());
    ck('宁死不降（袁术）首次：弹窗就写「宁死不降 · 依据」与厚葬奖励，劝降置灰（按钮写「宁死不降」）、点了没反应，只能斩杀', first && bt0.length === 1 && bt0[0] === 'parley-execute' && /^宁死不降 · 僭号称帝/.test(why.reason ?? '') && /厚葬/.test(why.honor ?? '') && why.grey && st.state === 'open' && st.log.rolls.length === 0 && bt1.length === 1, { first, bt0, bt1, why, st });
    const food0 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions ?? 0);
    await ev(s => s.choose('execute')); await p.waitForTimeout(700);
    const k = await ev(s => ({ boss: !!s.boss?.active, chests: s.bossChests.length }));
    ck('斩杀袁术：倒地掉宝箱', !k.boss && k.chests >= 1, k);
    const hon = await ev(s => { const out = []; s.parleyExecuteRewards(out); return { names: out.map(o => o.name), flags: JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {} }; });
    const food1 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions ?? 0);
    ck('宁死不降的替代奖励：本存档首次厚葬袁术 · 军粮 +60 · 仁名 +1（记入 honored）', hon.names.some(n => /^厚葬袁术 · 军粮 \+60 · 仁名 \+1/.test(n)) && String(hon.flags.honored).includes('yuanshu') && food1 - food0 >= 60, { hon, food0, food1 });
    ev = await open('ThirdGameScene', { thirdStage: 3 }, { thirdStage: 3 });
    const r = await ev(s => ({ state: s.parley?.state }));
    await hurtTo(ev, .1); await p.waitForTimeout(300);
    const r2 = await ev(s => ({ panel: !!s.children.getByName('parley-panel'), mode: s.mode }));
    await p.waitForTimeout(3000); // 等主将「来将通名」那句过去（场上只留一个大字台词气泡）
    await ev(s => { s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); }); await p.waitForTimeout(300);
    const r3 = await ev(s => { const all = []; const walk = l => { for (const o of l) { if (o.type === 'Text') all.push(o.text); if (o.list) walk(o.list); } }; walk(s.children.list); return { boss: !!s.boss?.active, lines: all.filter(Boolean).join('|') }; });
    ck('宁死不降第二次：不弹窗，倒下播拒绝台词当临终台词', r.state === 'skip' && !r2.panel && r3.lines.split('|').join('').includes('朕乃天子'), { r, r2, r3: r3.lines.slice(0, 200) });
  }
  // ① 必降（赵范）不掷骰必成；⑥ 已在降将栏的首领不弹窗
  if (want('zhaofan')) {
    let ev = await open('JingnanGameScene', { jingnanStage: 1 }, { thirdStage: 1 });
    await hurtTo(ev, .12); await waitPanel(ev);
    const s0 = await ev(s => s.parley.snapshot());
    await ev(s => s.choose('persuade')); await p.waitForTimeout(1500);
    const s1 = await ev(s => ({ ...s.parley?.snapshot(), captives: (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? []).map(o => o.boss) }));
    ck('必降（赵范）：把握「必成」、不掷骰、成功进降将栏（原来直接入麾下）', s0.odds.sure && s0.odds.pct === 100 && s1.log.rolls.length === 1 && s1.log.rolls[0].ok && s1.captives.includes('zhaofan'), { s0, s1 });
    ev = await open('JingnanGameScene', { jingnanStage: 1 }, { thirdStage: 1 });
    const r = await ev(s => ({ state: s.parley?.state }));
    await hurtTo(ev, .1); await p.waitForTimeout(300);
    const r2 = await ev(s => ({ panel: !!s.children.getByName('parley-panel') }));
    ck('赵范已在降将栏：重打 6-1 不弹窗', r.state === 'skip' && !r2.panel, { r, r2 });
  }
  // ⑦ 降将栏：首领降将 4 季、名将价 500（六折 300）、橙色、栏位 8、挤出顺序；普通俘虏不变
  if (want('captives')) {
    await mod('/src/systems/RosterStore.ts');
    const r = await p.evaluate(() => {
      const M = window.__m, save = JSON.parse(localStorage.getItem('im_roster_v1') ?? 'null') ?? M.loadRoster();
      const base = { ...M.loadRoster(), captives: [1, 2, 3].map(n => ({ kind: 'named', name: '俘虏' + n, template: 'spear', quality: 'purple', cost: 500, expires: 999 })) };
      localStorage.setItem('im_roster_v1', JSON.stringify(base));
      const got = []; for (let n = 1; n <= 7; n++) got.push(M.captureBoss({ id: 'tb' + n, name: '测首领' + n, template: 'blade' }));
      const mid = M.loadRoster().captives.map(o => o.name);
      const last = M.captureBoss({ id: 'tb8', name: '测首领8', template: 'blade' }), last2 = M.captureBoss({ id: 'tb9', name: '测首领9', template: 'blade' });
      const end = M.loadRoster().captives, o = end.find(x => x.boss === 'tb9');
      const res = { mid, end: end.map(x => x.name), evicted: [last?.evicted, last2?.evicted], quality: o.quality, price: Math.ceil(o.cost * .6), left: M.captiveSeasonsLeft(o), plain: M.captiveSeasonsLeft({ expires: undefined }) };
      localStorage.setItem('im_roster_v1', JSON.stringify(save)); return res;
    });
    ck('降将栏 8 格：首领降将挤掉最早的普通俘虏（3 名普通俘虏先被挤）', r.mid.length === 8 && !r.mid.some(n => n.startsWith('俘虏')) === false && r.end.length === 8 && !r.end.some(n => n.startsWith('俘虏')), r);
    ck('全是首领降将时挤掉最早的首领降将，并提示被挤走的名字', r.evicted[1]?.length === 1 && !r.end.includes('测首领1'), r);
    ck('首领降将：橙色、招降价 300 军粮、剩 4 季', r.quality === 'orange' && r.price === 300 && r.left === 4, r);
  }
  // ⑧ 特例：文丑换台词、吕布对刘备的拒绝台词；于禁 9-2 胜利后进降将栏；孟获心服直接入麾下、不掉宝箱
  if (want('special')) {
    await mod('/src/data/surrender.ts');
    const lines = await p.evaluate(() => { const M = window.__m, d = k => M.surrenderDef(k); return { wen: M.surrenderLine(d('caowei-4:xiahoudun'), true, { lord: 'zhaoyun', team: [], surrendered: ['caocao'] }), wen0: M.surrenderLine(d('caowei-4:xiahoudun'), true, { lord: 'zhaoyun', team: [], surrendered: [] }), lubu: M.surrenderLine(d('lubu-1:lubu'), false, { lord: 'liubei', team: [], surrendered: [] }), pang: M.surrenderLine(d('xiangfan-2:pangde'), false, { lord: 'zhaoyun', team: ['machao'], surrendered: [] }) }; });
    ck('曹操已降时夏侯惇换归降台词；吕布对刘备「大耳儿最叵信」；马超在队庞德换拒绝台词', lines.wen.startsWith('孟德既已归附') && lines.wen0.startsWith('孟德都降了') && lines.lubu.startsWith('大耳儿') && lines.pang.startsWith('孟起'), lines);
    let ev = await open('XiangfanGameScene', { xiangfanStage: 2 }, { thirdStage: 2 });
    await ev(s => { s.finish(true, 'boss'); }); await p.waitForTimeout(300);
    const yj = await p.evaluate(() => (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? []).filter(o => o.boss === 'yujin').map(o => o.quality));
    ck('9-2 水淹七军胜利：于禁自动进降将栏（不掷骰，橙）', yj.length === 1 && yj[0] === 'orange', yj);
    ev = await open('NanzhengGameScene', { nanzhengStage: 3 }, { thirdStage: 3 });
    await ev(s => { s.__mhDone = false; s.spawnBossChest(s.player.x, s.player.y, () => { s.__mhDone = true; }); });
    await p.waitForTimeout(1300);
    const mh = await ev(s => ({ done: s.__mhDone, chests: s.bossChests.length, owned: (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').owned ?? []).filter(r => r.boss === 'menghuo').map(r => r.quality) }));
    ck('11-3 七擒之后孟获心服：直接入麾下（橙）、不掉首领宝箱', mh.done && mh.chests === 0 && mh.owned.length === 1 && mh.owned[0] === 'orange', mh);
  }
  // ⑨ 奖励：首次劝降 +60（再劝不给）；首次斩杀紫装（再斩不给）；劝降成功不掉宝箱（见 ④）
  if (want('rewards')) {
    await mod('/src/world/WorldStore.ts');
    const food = () => p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions ?? 0);
    // 张绣劝降两次（第二次前把他从降将栏挪走，模拟过期）：第一次 +60，第二次不给
    const drop = () => p.evaluate(() => { const r = JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}'); r.captives = (r.captives ?? []).filter(o => o.boss !== 'zhangxiu'); localStorage.setItem('im_roster_v1', JSON.stringify(r)); });
    const persuadeOnce = async () => { await drop(); const ev = await open('ThirdGameScene', { thirdStage: 2 }, { thirdStage: 2 }); const pl = await ev(s => ({ has: !!s.parley, key: s.surrenderKey?.(), state: s.parley?.state, boss: !!s.boss?.active })); if (!pl.has) return { pl }; await ev(s => { s.parley.constructor.random = () => .01; }); const f0 = await food(); await hurtTo(ev, .12); await waitPanel(ev); await ev(s => s.choose('persuade')); await p.waitForTimeout(1500); return { f0, f1: await food(), again: await p.evaluate(() => (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? []).some(o => o.boss === 'zhangxiu')), first: await p.evaluate(() => String((JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {}).surrendered ?? '').includes('zhangxiu')) }; };
    const was = await p.evaluate(() => String((JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {}).surrendered ?? '').includes('zhangxiu'));
    const one = was ? null : await persuadeOnce(), two = await persuadeOnce();
    ck('劝降奖励：本存档首次劝降张绣 +60 军粮；再劝（已劝降过）照样进降将栏，但不再给', (was || (one.f1 === one.f0 + 60)) && two.again && two.f1 === two.f0, { was, one, two });
    const ev = await open('ThirdGameScene', { thirdStage: 2 }, { thirdStage: 2 });
    const ex = await ev(s => { const out1 = [], out2 = []; s.parley = { def: { id: 'test_exec_boss' }, persuadedOk: false }; s.parleyExecuteRewards(out1); s.parleyExecuteRewards(out2); s.parley = null; return { first: out1.map(o => o.name), second: out2.map(o => o.name) }; });
    ck('斩杀奖励：首次斩杀此人紫色兵装 + 军粮 25，再斩只有军粮', ex.first[0]?.startsWith('紫色兵装') && ex.second[0] === '军粮 +25', ex);
  }
  // ⑩ 「斩颜良」横幅 / 旗标只在斩杀时出现（关羽在队）
  if (want('yanliang')) {
    // 2026-11-20 更新：4-2 颜良现在是「宁死不降」（surrender.ts guandu-2:yanliang tier never）；「斩颜良」旗标改由官渡剧情在关羽随行打赢时写（story/guandu.ts），不再走劝降。
    // 这里查：双首领关的劝降面板写「宁死不降」、点劝降没反应（面板仍开）、斩杀能结束（顺带验 GameScene.openParley：双首领的面板属于各首领自己的 Parley）。
    const ev = await open('GuanduGameScene', { guanduStage: 2 }, { character: 'guanyu' });
    await ev(s => { const y = s.dual.entries.find(x => x.id === 'yanliang') ?? s.dual.entries[0]; const e = y.enemy; e.invulnerable = false; e.hp = Math.floor(e.maxHp * .12); s.hitEnemy(e, 1, s.combatNow, 'melee', false, false); });
    const panel = await waitPanel(ev), never = await ev(s => s.children.getByName('parley-panel')?.list?.some(o => o.type === 'Text' && /宁死不降/.test(o.text)) ?? false);
    await ev(s => s.choose('persuade')); await p.waitForTimeout(300);
    const afterPersuade = await ev(s => ({ mode: s.mode, e: s.dual?.snapshot().entries.map(x => x.id + ':' + x.done + ':' + x.parley) }));
    await ev(s => s.choose('execute')); await p.waitForTimeout(800);
    const afterExecute = await ev(s => ({ mode: s.mode, e: s.dual?.snapshot().entries.map(x => x.id + ':' + x.done + ':' + x.parley) }));
    ck('4-2 颜良宁死不降：面板写「宁死不降」、点劝降没反应；斩杀（双首领面板也能用 choose / 手柄）后颜良倒下', panel && never && afterPersuade.mode === 'parley' && afterExecute.mode !== 'parley' && afterExecute.e.some(x => x.startsWith('yanliang:killed')), { panel, never, afterPersuade, afterExecute });
  }
  // ⑪ 试炼 / 调试战斗不改人才库；⑫ 中途退出回滚旗标与降将栏
  if (want('rollback')) {
    // 2026-11-20：3-1 改成双首领（李傕 + 郭汜，劝降走各首领自己的 Parley），回滚检查换到单首领的 5-2 蔡瑁（4-3 淳于琼要先焚尽粮仓才可劝）
    const snap = () => p.evaluate(() => ({ cap: (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? []).map(o => o.boss).filter(Boolean).sort().join(','), sur: (JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {}).surrendered ?? '' }));
    let ev = await open('ChibiGameScene', { chibiStage: 2 }, { thirdStage: 2 });
    await p.evaluate(() => { window.__IM_PARLEY_LIVE = false; });
    await ev(s => { s.parley.constructor.random = () => .01; });
    const a0 = await snap(); await hurtTo(ev, .12); await waitPanel(ev); await ev(s => s.choose('persuade')); await p.waitForTimeout(1500); const a1 = await snap();
    ck('试炼 / 调试战斗劝降成功：不改人才库、不记旗标', a0.cap === a1.cap && a0.sur === a1.sur && !a1.cap.includes('caimao'), { a0, a1 });
    await p.evaluate(() => { window.__IM_PARLEY_LIVE = true; });
    ev = await open('ChibiGameScene', { chibiStage: 2 }, { thirdStage: 2 });
    await p.evaluate(async () => { (await import('/src/systems/BattleSnapshot.ts')).beginBattle('test-surrender'); });
    await ev(s => { s.parley.constructor.random = () => .01; });
    // 劝降结果在选择当下就写进存档；跪降 1 秒 + 0.5 秒后告捷进营会 commitBattle（快照作废），所以要在告捷前回滚（原来等 1.5 秒正好卡在边上，偶发失败）
    const b0 = await snap(); await hurtTo(ev, .12); await waitPanel(ev); await ev(s => s.choose('persuade')); await p.waitForTimeout(300); const b1 = await snap();
    await p.evaluate(async () => { (await import('/src/systems/BattleSnapshot.ts')).rollbackBattle(); });
    const b2 = await snap();
    ck('中途退出回滚：劝降蔡瑁进栏 + surrendered 旗标，回滚后一起撤销', b1.cap.includes('caimao') && b1.sur.includes('caimao') && b2.cap === b0.cap && b2.sur === b0.sur, { b0, b1, b2 });
  }
  // ⑬ 降将栏卡片截图（招贤馆）
  if (want('hall')) {
    await p.evaluate(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start('TalentHallScene'); });
    await p.waitForTimeout(1500);
    const seal = await p.evaluate(() => { const s = window.__game.scene.getScene('TalentHallScene'); if (!s?.scene.isActive()) return null; const all = []; const walk = l => { for (const o of l) { all.push(o.name); if (o.list) walk(o.list); } }; walk(s.children.list); return { seal: all.includes('talent-boss-seal'), names: all.filter(n => n === 'talent-offer-name').length }; });
    await p.screenshot({ path: `${OUT}/captive-card.png` });
    ck('招贤馆降将栏：首领降将卡片带「首领」小印、剩 N 季', seal?.seal, seal);
  }
  ck('无页面报错', !errs.length, errs.slice(0, 3));
} finally { await b.close(); }
const bad = rows.filter(x => !x).length; console.log(bad ? `FAIL ${bad}/${rows.length}` : `PASS ${rows.length}/${rows.length}`); if (bad) process.exit(1);
