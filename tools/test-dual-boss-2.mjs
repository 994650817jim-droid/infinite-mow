// 双首领第二批（2026-11-19）：3-1 李傕 + 郭汜（李郭内讧）、11-3 孟获 + 祝融夫人（飞刀、七擒照旧）。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-dual-boss-2.mjs   （ONLY=changan,nanzhong 只跑部分）；截图在 assets/review/dual-boss-2/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/dual-boss-2';
mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean), want = k => !ONLY.length || ONLY.includes(k);
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(() => { if (!sessionStorage.getItem('dual-seeded')) { for (const k of ['im_story_v1', 'im_roster_v1']) localStorage.removeItem(k); sessionStorage.setItem('dual-seeded', '1'); } window.__IM_PARLEY_LIVE = true; });
  await p.goto(BASE + '?dev=1&layout=desktop&story=full');
  await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 90000 });
  const unlocked = await p.evaluate(async () => { const W = await import('/src/world/WorldStore.ts'); const s = W.loadWorld(); s.yellowStages = 3; s.worldAvailable = true; s.cleared.huangjin = true; s.provisions = (s.provisions ?? 0) + 500; localStorage.setItem('im_world_v1', JSON.stringify(s)); return W.worldUnlocked(); });
  if (!unlocked) throw new Error('天下地图没能开放（测试存档）');

  const S = scene => `window.__game.scene.getScene('${scene}')`;
  /** 开某关、跳过剧情卷轴、首领出场；dual：等第二位登场。 */
  const open = async (scene, reg, run, dual = true) => {
    // 每关前清掉上一例留下的降将 / 招降斩杀旗标（否则已在降将栏的首领不弹窗）
    await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('im_story_v1') ?? '{}'); if (v.flags) for (const k of Object.keys(v.flags)) if (/^(surrendered|executed|neverSeen|hebei_|yanliang_by|wenchou_by)/.test(k)) delete v.flags[k]; localStorage.setItem('im_story_v1', JSON.stringify(v)); const r = JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}'); if (r.captives) r.captives = []; localStorage.setItem('im_roster_v1', JSON.stringify(r)); });
    await p.evaluate(([key, reg, run]) => { const g = window.__game; for (const k of ['campaignTransfer', 'thirdTransfer', 'guanduTransfer', 'hanzhongTransfer']) g.registry.remove(k); for (const [k, v] of Object.entries(reg)) g.registry.set(k, v); g.registry.set('runConfig', { character: 'zhaoyun', ...run }); const cur = g.scene.getScene(key); if (cur && g.scene.isActive(key)) cur.scene.restart(); else { for (const s of g.scene.getScenes(true)) s.scene.stop(); g.scene.start(key); } }, [scene, reg, run]);
    await p.waitForTimeout(500);
    await p.waitForFunction(S0 => { const s = eval(S0); return s?.player && s.scene.isActive(); }, S(scene), { timeout: 90000 }); await p.waitForTimeout(800);
    const ev = (fn, arg) => p.evaluate(([S0, f, a]) => { const s = eval(S0); if (s && (s.mode === 'levelup' || s.mode === 'recruit')) s.__DEV_ACTIONS?.closePopup?.(); return eval('(' + f + ')')(s, a); }, [S(scene), String(fn), arg]);
    await ev(s => { s.player.damageImmune = true; for (const k of ['grantBossChest', 'spawnBossChest']) if (Object.prototype.hasOwnProperty.call(s, k)) delete s[k]; /* restart 复用同一场景对象：去掉上一例装的包装 */ });
    for (let i = 0; i < 150 && !(await ev(s => !!s.boss?.active)); i++) { await ev(s => { if (s.mode === 'story') { for (const st of s.children.list) { const btn = st.list?.find(o => /-(next|confirm)$/.test(o.name ?? '')); if (btn) { btn.emit('pointerup'); break; } } } if (!s.boss?.active && !s.bossSpawned && s.mode === 'none') s.spawnBoss(); }); await p.waitForTimeout(150); }
    if (!(await ev(s => !!s.boss?.active))) await ev(s => { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); if (s.mode === 'story') s.setMode('none'); s.spawnBoss(); });
    if (dual) for (let i = 0; i < 40 && !(await ev(s => (s.dual?.entries.length ?? 0) >= 2)); i++) { await ev(s => { if (s.mode === 'story') { for (const o of [...s.children.list]) if (/^story/.test(o.name ?? '')) o.destroy(); s.setMode('none'); } }); await p.waitForTimeout(150); }
    await ev(s => { s.spawnTimer = 1e9; s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate(); });
    return ev;
  };
  const snap = ev => ev(s => s.dual?.snapshot());
  /** 把某位首领打到 frac（不致死时直接改血，致死时走 hitEnemy → killEnemy）。 */
  const hurtE = (ev, id, frac) => ev((s, a) => { const x = s.dual.entries.find(y => y.id === a.id); const e = x.enemy; if (!e.active) return null; e.invulnerable = false; x.invulnUntil = 0; if (a.frac > 0) { e.hp = Math.max(1, Math.floor(e.maxHp * a.frac)); s.hitEnemy(e, 1, s.combatNow, 'melee', false, false); } else s.hitEnemy(e, 1e7, s.combatNow, 'melee', false, false); return { hp: e.hp / e.maxHp, mode: s.mode }; }, { id, frac });
  const waitPanel = async ev => { for (let i = 0; i < 25; i++) { const r = await ev(s => s.mode === 'parley' && !!s.children.getByName('parley-panel')); if (r) return true; await p.waitForTimeout(120); } return false; };
  const roll = (ev, v) => ev((s, v) => { const P = s.dual.entries.find(x => x.parley)?.parley?.constructor; if (P) P.random = () => v; }, v);
  /** 让某位首领了结：execute / persuade（劝降掷骰先设好）。 */
  const finish = async (ev, id, how) => { await hurtE(ev, id, .12); const ok = await waitPanel(ev); if (!ok) { console.log('  [finish] 没弹窗', id, JSON.stringify(await ev(s => ({ roster: (() => { const r = JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}'); return { owned: (r.owned ?? []).map(o => o.name + ':' + (o.boss ?? '')), cap: (r.captives ?? []).map(o => o.name) }; })(), mode: s.mode, story: s.children.list.filter(o => /^story/.test(o.name ?? '')).map(o => o.name), e: s.dual.entries.map(x => ({ id: x.id, hp: Math.round(x.enemy.hp), active: x.enemy.active, done: x.done, parley: x.parley?.state, inv: x.enemy.invulnerable })) })))); return false; } await ev((s, c) => s.choose(c), how); await p.waitForTimeout(how === 'persuade' ? 1700 : 600); return true; };
  // 横幅按字排（一个字一个 Text）：容器里的字连起来也算一条
  const texts = ev => ev(s => { const out = []; const walk = o => { if (!o || !o.visible) return; if (o.type === 'Text' && o.text) out.push(o.text); if (o.list) { const j = o.list.filter(c => c.type === 'Text' && c.visible).map(c => c.text).join(''); if (j) out.push(j); for (const c of o.list) walk(c); } }; for (const o of s.children.list) walk(o); return out; });
  const flags = () => p.evaluate(() => (JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {}));
  const G42 = ['GuanduGameScene', { guanduStage: 2 }], H82 = ['HanzhongGameScene', { hanzhongStage: 2 }, { thirdStage: 2 }];

  const cards = ev => ev(s => [...(s.data.get('__storyBarkCardLog') ?? [])]);
  const gwait = async (ev, ms) => { const t0 = await ev(s => s.combatNow), r0 = Date.now(); while ((await ev(s => s.combatNow)) - t0 < ms && Date.now() - r0 < ms * 6) await p.waitForTimeout(60); };
  const hit = (ev, id, raw) => ev((s, a) => { const x = s.dual.entries.find(y => y.id === a.id); if (!x?.enemy.active) return false; x.enemy.invulnerable = false; s.hitEnemy(x.enemy, a.raw, s.combatNow, 'melee', false, false); return true; }, { id, raw });

  // ———— 3-1 长安：李傕 + 郭汜 · 李郭内讧 ————
  if (want('changan')) {
    const ev = await open('ThirdGameScene', { thirdStage: 1 }, {});
    const c = await snap(ev), tex = await ev(s => s.dual.entries.map(x => x.enemy.sprite.texture.key));
    ck('3-1 登场：李傕（骑马）+ 郭汜（步战、自己的 v2 图 third_guosi）', c?.entries.length === 2 && c.entries[0].id === 'lijue' && c.entries[1].id === 'guosi' && c.entries[0].mounted === true && c.entries[1].mounted === false && tex[1] === 'third_guosi', { ids: c?.entries.map(x => x.id), tex, mounted: c?.entries.map(x => x.mounted) });
    await ev(s => { s.dual.comboNow(s.combatNow + 1e9); for (const w of s.player.weapons) w.cooldownLeft = 1e9; }); // 只量内讧：配合技推后、主将武器停手
    // 挑拨：轮流打两人（每次隔 1 秒），猜忌涨、血条下写「猜忌」
    const st0 = await ev(s => s.dual.plan.feudState());
    let mid = null;
    for (let k = 0; k < 4; k++) { await hit(ev, k % 2 ? 'guosi' : 'lijue', 4); await gwait(ev, 1000); if (k === 2) mid = await ev(s => ({ f: s.dual.plan.feudState(), st: s.dual.entries.map(x => x.status) })); }
    ck('内讧 · 挑拨：2.5 秒内先后打到两人，猜忌上涨，血条下写「猜忌 NN%」', mid && mid.f.meter > st0.meter + 30 && mid.st.every(t => /^猜忌 \d+%$/.test(t)), { st0, mid });
    // 继续挑拨到满：两人冲向对方互砍 → 各掉约 6% → 各愣 2.6 秒、受伤 +25%
    const hp0 = await ev(s => s.dual.entries.map(x => x.enemy.hp / x.enemy.maxHp));
    for (let k = 0; k < 6 && !(await ev(s => s.dual.plan.feudState().feuds)); k++) { await hit(ev, k % 2 ? 'guosi' : 'lijue', 4); await gwait(ev, 1000); }
    await gwait(ev, 700);
    const f = await ev(s => ({ f: s.dual.plan.feudState(), now: s.combatNow, combos: s.dual.log.combos.map(x => x.id), st: s.dual.entries.map(x => x.status), hp: s.dual.entries.map(x => x.enemy.hp / x.enemy.maxHp), beat: s.dual.entries.map(x => x.ctrl.beat?.phase) }));
    await p.screenshot({ path: `${OUT}/changan-feud-1280x720.png` });
    const drop = f.hp.map((h, i) => hp0[i] - h);
    ck('内讧 · 满了就反目：放「李郭内讧」，两人互砍各掉约 6% 血，都在收招破绽、血条写「内讧」', f.f.feuds === 1 && f.combos.includes('neihong') && drop.every(d => d >= .045) && f.st.every(t => t === '内讧') && f.beat.every(b => b === 'recover'), { f, drop });
    const mul = await ev(s => s.dual.plan.incomingMul(s.dual, s.dual.entries[0], false, s.combatNow));
    ck('内讧 · 破绽期间主将打他们受伤 ×1.25；之后 14 秒内猜忌不涨', Math.abs(mul - 1.25) < 1e-6 && f.f.quietUntil - f.now > 10000, { mul, quiet: f.f.quietUntil - f.now });
    // 冷却期间一人掉一成以上血：不骂、不涨（冷却外才骂同伴、猜忌 +34）
    const before = await cards(ev);
    await ev(s => { const x = s.dual.entries[1]; x.enemy.invulnerable = false; s.hitEnemy(x.enemy, x.enemy.maxHp * .13, s.combatNow, 'melee', true, false); });
    await gwait(ev, 400);
    const after = await cards(ev), newCards = after.slice(before.length);
    const quiet = await ev(s => s.dual.plan.feudState().quietUntil > s.combatNow);
    ck('台词卡：李郭对白走侧边立绘卡（名字郭汜 / 李傕）', after.some(t => t.startsWith('郭汜')) && after.some(t => t.startsWith('李傕')), after.slice(-6));
    ck('内讧冷却中：重伤不骂、不涨猜忌（14 秒冷却）', quiet && !newCards.some(t => /李稚然|郭阿多/.test(t)), { quiet, newCards });
  }

  // ———— 11-3 南中：孟获 + 祝融夫人 · 飞刀 · 七擒照旧 ————
  if (want('nanzhong')) {
    const ev = await open('NanzhengGameScene', { nanzhengStage: 3, nzNoStory: 'all' }, {});
    const c = await snap(ev), tex = await ev(s => s.dual.entries.map(x => x.enemy.sprite.texture.key));
    ck('11-3 登场：孟获 + 祝融（自己的 v2 图 nz_zhurong）', c?.entries.length === 2 && c.entries[0].id === 'menghuo' && c.entries[1].id === 'zhurong' && tex[1] === 'nz_zhurong', { ids: c?.entries.map(x => x.id), tex });
    await ev(s => s.dual.comboNow(s.combatNow + 1e9));
    // 飞刀：祝融朝主将扇射 5 把手绘飞刀；刀尖飞过主将才算命中
    const r = await ev(async s => {
      const { BOSS_MOVES } = await import('/src/data/bossMoves.ts'); const z = s.dual.entries[1], fan = BOSS_MOVES.zhurong.p1.moves.find(m => m.kind === 'fan');
      z.enemy.sprite.setPosition(s.player.x + 260, s.player.y); z.ctrl.combo(fan, s.combatNow, { aim: { x: s.player.x, y: s.player.y } });
      return { knives: fan.knives, count: fan.count };
    });
    await gwait(ev, 900);
    const fly = await ev(s => ({ imgs: s.children.list.filter(o => o.name === 'zhurong-knife' && o.visible).length, ks: { ...s.dual.entries[1].ctrl.knifeStats } }));
    await p.screenshot({ path: `${OUT}/nanzhong-knives-1280x720.png` });
    await gwait(ev, 900);
    const ks = await ev(s => ({ ...s.dual.entries[1].ctrl.knifeStats }));
    ck('祝融飞刀：扇射 5 把手绘旋转飞刀（KnifeFx），刀飞过主将命中', fly.imgs >= 3 && ks.thrown === r.count && ks.hits >= 1, { r, fly, ks });
    // 七擒：孟获第一次被打倒 → 逃回蛮洞（离场：不当主目标），祝融断后一句（台词卡）
    const before = (await cards(ev)).length;
    const knock = () => ev(s => { const x = s.dual.entries[0]; x.enemy.invulnerable = false; s.hitEnemy(x.enemy, x.enemy.maxHp * 3, s.combatNow, 'melee', false, false); });
    await knock(); await gwait(ev, 300);
    const cap = await ev(s => ({ nz: s.nzState, away: s.dual.entries[0].away, st: s.dual.entries[0].status, primary: s.boss === s.dual.entries[1].enemy, done: s.dual.entries.map(x => x.done) }));
    const cover = (await cards(ev)).slice(before);
    ck('七擒照旧：孟获被打倒 → 逃回蛮洞（双首领里离场、祝融成主目标），没真倒', cap.nz.captured === 1 && cap.nz.hidden && cap.away && cap.st === '逃回蛮洞' && cap.primary && cap.done.every(d => d === null), cap);
    ck('祝融断后：台词卡「大王快走，妾身断后！」', cover.some(t => t.startsWith('祝融') && t.includes('断后')), cover);
    await ev(s => { s.mhReturnAt = 0; }); await gwait(ev, 300);
    const back = await ev(s => ({ hidden: s.nzState.hidden, away: s.dual.entries[0].away, vis: s.dual.entries[0].enemy.sprite.visible }));
    ck('孟获杀回来：回场（不再离场）', !back.hidden && !back.away && back.vis, back);
    // 第二擒、第三擒（真倒）→ 祝融随夫归降（不狂怒，1.6 秒后退走）
    await knock(); await gwait(ev, 300); await ev(s => { s.mhReturnAt = 0; }); await gwait(ev, 300);
    await knock(); await gwait(ev, 300);
    const fall = await ev(s => ({ captured: s.nzState.captured, st: s.dual.entries[1].status, rage: s.dual.log.rage, out: s.dual.log.outcomes }));
    await gwait(ev, 2200);
    const end = await ev(s => ({ out: s.dual.log.outcomes, rage: s.dual.log.rage }));
    ck('第三擒孟获真倒 → 祝融「随夫归降」、不狂怒，随后放下兵刃退走', fall.captured === 3 && fall.st === '随夫归降' && !fall.rage.includes('zhurong') && end.out.map(o => o.id + ':' + o.how).join() === 'menghuo:killed,zhurong:retreated', { fall, end });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 5));
} finally { await b.close(); }
const pass = rows.filter(Boolean).length; console.log(`SUMMARY: ${pass}/${rows.length} passed`); process.exit(pass === rows.length ? 0 : 1);
