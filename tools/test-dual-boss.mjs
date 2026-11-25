// 双首领关（dual-boss-spec.md 第九节 17 条验收）：4-2 颜良 + 文丑、8-2 夏侯渊 + 张郃；4-1 颜良负伤败走；败退型。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5188/ node tools/test-dual-boss.mjs   （ONLY=entrance,token,... 只跑部分）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/dual-boss';
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
    await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('im_story_v1') ?? '{}'); if (v.flags) for (const k of Object.keys(v.flags)) if (/^(surrendered|executed|honored|neverSeen|hebei_|pair_fixture_|yanliang_by|wenchou_by)/.test(k)) delete v.flags[k]; localStorage.setItem('im_story_v1', JSON.stringify(v)); const r = JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}'); if (r.captives) r.captives = []; localStorage.setItem('im_roster_v1', JSON.stringify(r)); });
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
  const finish = async (ev, id, how) => { await hurtE(ev, id, .12); const never=await ev((s,id)=>s.dual.entries.find(x=>x.id===id)?.parley?.def.tier==='never',id);
    if(never){
      const state=await ev(s=>({panel:!!s.children.getByName('parley-panel'),mode:s.mode}));
      if(state.panel||state.mode==='parley')throw new Error('宁死不降触发了劝降弹窗');
      if(how==='execute')await hurtE(ev,id,0);
      return how==='execute';
    }
    const ok = await waitPanel(ev); if (!ok) { console.log('  [finish] 没弹窗', id, JSON.stringify(await ev(s => ({ roster: (() => { const r = JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}'); return { owned: (r.owned ?? []).map(o => o.name + ':' + (o.boss ?? '')), cap: (r.captives ?? []).map(o => o.name) }; })(), mode: s.mode, story: s.children.list.filter(o => /^story/.test(o.name ?? '')).map(o => o.name), e: s.dual.entries.map(x => ({ id: x.id, hp: Math.round(x.enemy.hp), active: x.enemy.active, done: x.done, parley: x.parley?.state, inv: x.enemy.invulnerable })) })))); return false; } await ev((s, c) => s.choose(c), how); await p.waitForTimeout(how === 'persuade' ? 1700 : 600); return true; };
  // 正式河北两将均为 never。通用双首领劝降分支以正式可降的李傕、张绣作组合夹具。
  // 只替换测试场内的两个角色和剧情键；不改任何正式配置和存档。
  const recruitablePair=async()=>{
    const ev=await open(...G42);
    await ev(async s=>{
      const {surrenderDef}=await import('/src/data/surrender.ts');
      const pair=s.dual.entries;
      s.dual.plan={...s.dual.plan,outcomeFlag:'pair_fixture_outcome'};
      for(const [i,key] of ['qunxiong-1:lijue','qunxiong-2:zhangxiu'].entries()){
        const e=pair[i],def=surrenderDef(key);
        e.id=def.id;e.name=def.name;
        e.parley=s.makeParley(()=>!e.done&&e.enemy.active?e.enemy:null,def,{partner:()=>s.dual.partnerOdds(e)});
      }
    });
    return ev;
  };
  // 横幅按字排（一个字一个 Text）：容器里的字连起来也算一条
  const texts = ev => ev(s => { const out = []; const walk = o => { if (!o || !o.visible) return; if (o.type === 'Text' && o.text) out.push(o.text); if (o.list) { const j = o.list.filter(c => c.type === 'Text' && c.visible).map(c => c.text).join(''); if (j) out.push(j); for (const c of o.list) walk(c); } }; for (const o of s.children.list) walk(o); return out; });
  const flags = () => p.evaluate(() => (JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {}));
  const G42 = ['GuanduGameScene', { guanduStage: 2 }], H82 = ['HanzhongGameScene', { hanzhongStage: 2 }, { thirdStage: 2 }];

  // ① 登场：错开 1.2 秒；名牌 / 火环两份；两条血条名字与百分比
  if (want('entrance')) {
    const ev = await open(G42[0], G42[1], {}, false);
    const a = await snap(ev);
    for (let i = 0; i < 30 && !(await ev(s => s.dual?.entries.length >= 2)); i++) await p.waitForTimeout(100);
    await p.waitForTimeout(700);
    const c = await snap(ev), st = await ev(s => ({ ...s.presence.stats })), t = await ev(s => [0, 1, 2, 3, 4, 5].map(i => { const o = s.children.getByName('dual-hud-' + i); return o?.visible ? o.text : ''; }));
    await p.screenshot({ path: `${OUT}/entrance-1280x720.png` });
    const gap = c.entries[1]?.spawnedAt - c.entries[0]?.spawnedAt;
    ck('登场：颜良先、文丑后，相隔约 1.2 秒（战斗时钟）', a.entries.length === 1 && a.entries[0].id === 'yanliang' && c.entries[1]?.id === 'wenchou' && gap >= 1150 && gap <= 1500, { a: a.entries.map(x => x.id), gap });
    ck('登场：两人各有名牌、火环（辉光按渲染器）', st.plates === 2 && st.rings === 2, st);
    ck('双血条：左颜良 / 右文丑，名字与 100% 正确', t[0].startsWith('颜良') && t[1] === '100%' && t[3].startsWith('文丑') && t[4] === '100%', t);
    ck('双将压力：每人生命 ×0.9（2026-11-18 平衡由 0.65 上调）、伤害 ×0.8、间隔 ×1.4、召兵减半', c.entries.every(x => x.maxHp === Math.round(x.baseMaxHp * .9) && Math.abs(x.dmgMul - .8) < 1e-6 && Math.abs(x.gapMul - 1.4) < 1e-6 && x.summonMul === .5), c.entries);
    ck('双将：文丑骑马、颜良步战', c.entries[0].mounted === false && c.entries[1].mounted === true, c.entries.map(x => x.mounted));
  }
  // ② 大招令牌：普通招式预警不重叠，两人起手间隔 ≥ 0.8 秒
  if (want('token')) {
    const ev = await open(...G42);
    await ev(s => { s.dual.comboNow(s.combatNow + 1e9); const p = s.player; s.dual.entries.forEach((x, i) => { x.enemy.sprite.x = p.x + (i ? 160 : -160); x.enemy.sprite.y = p.y - 60; }); });
    const starts = { a: 0, b: 0 };
    for (let i = 0; i < 70; i++) { await p.waitForTimeout(250); const r = await ev(s => s.dual.entries.map(x => x.lastStart)); if (r[0] > -1e8) starts.a++; if (r[1] > -1e8) starts.b++; await ev(s => { const p = s.player; for (const [i, x] of s.dual.entries.entries()) if (Math.hypot(x.enemy.x - p.x, x.enemy.y - p.y) > 400) { x.enemy.sprite.x = p.x + (i ? 160 : -160); x.enemy.sprite.y = p.y - 60; } }); }
    const r = await snap(ev);
    ck('大招令牌：17 秒混战两人都出过招，普通招式预警从不重叠，起手间隔 ≥ 0.8 秒', starts.a > 0 && starts.b > 0 && r.log.overlap === 0 && (r.log.minGap ?? 9999) >= 800, { overlap: r.log.overlap, minGap: r.log.minGap, starts });
  }
  // ③ 配合技：首次 12 秒、之后 20 秒（二阶段 15 秒；2026-11-18 平衡）、500 像素内、横幅 + 预警 ×1.5 + 同时出手 + 1.5 秒破绽
  if (want('combo')) {
    const ev = await open(...G42);
    const n0 = await ev(s => s.dual.snapshot().nextCombo - s.dual.entries[1].spawnedAt);
    // 一人在 900 像素外 → 到点也不放
    await ev(s => { const p = s.player, [a, b] = s.dual.entries; a.enemy.sprite.x = p.x - 150; a.enemy.sprite.y = p.y - 60; b.enemy.sprite.x = p.x + 900; b.enemy.sprite.y = p.y; s.dual.comboNow(s.combatNow); });
    await p.waitForTimeout(800);
    const far = await snap(ev);
    await ev(s => { const p = s.player, [a, b] = s.dual.entries; for (const x of [a, b]) { x.ctrl.state = 'approach'; } b.enemy.sprite.x = p.x + 200; b.enemy.sprite.y = p.y - 40; s.dual.comboNow(s.combatNow); });
    let fired = null;
    for (let i = 0; i < 30; i++) { await p.waitForTimeout(100); const r = await snap(ev); if (r.combo?.fired) { fired = r; break; } }
    await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/combo-warning-1280x720.png` });
    const tx = await texts(ev);
    let after = null, last = null; for (let i = 0; i < 120; i++) { await p.waitForTimeout(100); const r = await snap(ev); last = { combo: r.combo, st: r.entries.map(x => x.state), mode: await ev(s => s.mode + '@' + Math.round(s.combatNow)) }; if (!r.combo) { after = r; break; } }
    ck('配合技：首发在第二位登场后 12 秒', Math.abs(n0 - 12000) < 1300, n0);
    ck('配合技：有人超出 500 像素时不放', !far.combo && far.log.combos.length === 0, far.log.combos);
    ck('配合技「夹击」：横幅、预警 ×1.5、两人同时出手（横幅见 combo-warning 截图）', !!fired && fired.log.combos[0]?.id === 'jiaji' && fired.log.combos[0].warnMul === 1.5 && fired.entries.every(x => x.busy), { fired: fired?.entries.map(x => x.state), tx: tx.filter(t => t.includes('夹') || t.includes('双雄')) });
    ck('配合技之后两人都进收招破绽，下一次 20 秒后', !!after && after.entries.every(x => x.state === 'recover') && Math.abs(after.nextCombo - (await ev(s => s.combatNow)) - 20000) < 1500, after ? { st: after.entries.map(x => x.state), next: after.nextCombo } : last);
    // 二阶段：刀枪合璧可用、间隔 15 秒
    await ev(s => { for (const x of s.dual.entries) x.ctrl.forcePhase2(s.combatNow); });
    await p.waitForTimeout(1500);
    await ev(s => { const p = s.player, [a, b] = s.dual.entries; a.enemy.sprite.x = p.x - 150; a.enemy.sprite.y = p.y - 60; b.enemy.sprite.x = p.x + 200; b.enemy.sprite.y = p.y - 40; s.dual.comboNow(s.combatNow); });
    let c2 = null; for (let i = 0; i < 40; i++) { await p.waitForTimeout(100); const r = await snap(ev); if (r.log.combos.length >= 2) { c2 = r; break; } }
    let after2 = null, last2 = null; for (let i = 0; i < 140; i++) { await p.waitForTimeout(100); const r = await snap(ev); last2 = { combo: r.combo, st: r.entries.map(x => x.state + (x.done ?? '')), mode: await ev(s => s.mode + '@' + Math.round(s.combatNow)) }; if (!r.combo) { after2 = r; break; } }
    ck('二阶段：轮到「刀枪合璧」，下一次 15 秒后', c2?.log.combos[1]?.id === 'heben' && !!after2 && Math.abs(after2.nextCombo - (await ev(s => s.combatNow)) - 15000) < 1500, { c2: c2?.log.combos, next: after2 && after2.nextCombo, last2 });
  }
  // ④ 一人被斩：狂怒；⑨ 关羽在队「斩颜良」只在斩杀时
  if (want('rage')) {
    const ev = await open(G42[0], G42[1], { character: 'guanyu' });
    await ev(s => s.dual.comboNow(s.combatNow + 1e9));
    const base = await snap(ev);
    const ok = await finish(ev, 'yanliang', 'execute');
    const r = await snap(ev), f = await flags(), tx = await texts(ev);
    await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/rage-1280x720.png` });
    const w = r.entries[1];
    ck('颜良被斩：文丑狂怒——2 秒无敌转场、伤害 +25%（×0.8×1.25）、间隔 −25%、移速 +15%、立刻进二阶段', ok && w.rage && w.invulnerable && Math.abs(w.dmgMul - 1) < 1e-6 && Math.abs(w.gapMul - 1.05) < 1e-6 && Math.abs(w.speed - base.entries[1].speed * 1.15) < .01 && w.phase2, w);
    ck('关羽在队斩颜良：「斩颜良」横幅 + 旗标 yanliang_by_guanyu', f.yanliang_by_guanyu === true && tx.some(t => t.includes('斩颜良')), { f: f.yanliang_by_guanyu, tx: tx.filter(t => t.includes('颜良')) });
    await p.waitForTimeout(3400);
    const t2 = await ev(s => [0, 1, 2, 3, 4, 5].map(i => { const o = s.children.getByName('dual-hud-' + i); return o?.visible ? o.text : ''; }));
    const r2 = await snap(ev);
    await p.screenshot({ path: `${OUT}/bars-merged-1280x720.png` });
    ck('狂怒转场 2 秒后解除无敌；血条合并到中间并标「狂怒」', !r2.entries[1].invulnerable && t2.some(t => t.includes('狂怒')) && !t2[0], t2);
    // 关羽劝降文丑：不记「诛文丑」
    await roll(ev, .01); await ev(s => { s.dual.entries[1].invulnUntil = 0; s.dual.entries[1].enemy.invulnerable = false; });
    await finish(ev, 'wenchou', 'persuade');
    const f2 = await flags();
    ck('关羽在队劝降文丑：不记 wenchou_by_guanyu', !f2.wenchou_by_guanyu, f2.wenchou_by_guanyu);
  }
  // ⑤ 一人被劝降：心乱；⑦ 一降一斩：一个宝箱、降者进降将栏
  if (want('shaken')) {
    const ev = await recruitablePair();
    await ev(s => s.dual.comboNow(s.combatNow + 1e9)); await roll(ev, .01);
    await ev(s => { s.__chests = []; const g = s.grantBossChest.bind(s); s.grantBossChest = () => { const out = g(); s.__chests.push(out.map(o => o.name + '|' + o.tag)); return out; }; });
    await finish(ev, 'zhangxiu', 'persuade');
    await p.waitForTimeout(1900);
    const r = await snap(ev), y = r.entries[0], tx = await texts(ev);
    ck('张绣归降：李傕「心乱」15 秒（伤害 ×0.85）、不狂怒', y.shaken && !y.rage && Math.abs(y.dmgMul - .8 * .85) < 1e-6 && tx.some(t => t.includes('心乱')), y);
    const odds = await ev(s => s.dual.entries[0].parley.odds());
    ck('张绣已降 → 劝李傕把握 +20%（表里「张绣已降」与同伴已降不重复加）', odds.parts.filter(p => p.add === 20).length === 1 && odds.pct === odds.parts.reduce((sum,p)=>sum+p.add,0), odds);
    await finish(ev, 'lijue', 'execute');
    await p.waitForTimeout(1200);
    const ch = await ev(s => s.bossChests.length), cap = await p.evaluate(() => (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? []).map(o => o.boss).filter(Boolean));
    ck('一降一斩：只掉一个宝箱（最后了结处），张绣进降将栏', ch === 1 && cap.includes('zhangxiu'), { ch, cap });
    // 走到宝箱：双将宝箱额外兵装 + 首次斩杀紫装
    await ev(s => { const c = s.bossChests[0]; if (c) { s.player.x = c.x ?? s.player.x; s.player.y = c.y ?? s.player.y; } });
    for (let i = 0; i < 20 && !(await ev(s => s.__chests.length)); i++) { await ev(s => { const c = s.bossChests[0]; const o = c?.sprite ?? c?.img ?? c?.root; if (o) { s.player.sprite.x = o.x; s.player.sprite.y = o.y; } }); await p.waitForTimeout(200); }
    const out = await ev(s => s.__chests);
    ck('双将宝箱：额外一次兵装；李傕首次斩杀紫装', out.length === 1 && out[0].some(t => t.endsWith('|双将')) && out[0].some(t => t.startsWith('紫色兵装')), out);
    const f = await flags();
    ck('剧情旗标 pair_fixture_outcome = 李斩张降（kp）', f.pair_fixture_outcome === 'kp', f.pair_fixture_outcome);
  }
  // ⑥ 双降：横幅、军粮 +100、不掉宝箱、算告捷；⑧ 两人都首斩：两件紫装
  if (want('double')) {
    const ev = await recruitablePair();
    await ev(s => s.dual.comboNow(s.combatNow + 1e9)); await roll(ev, .01);
    await ev(s=>{
      s.__pairNotices=[];
      const sample=()=>{const n=s.children.getByName('combat-notice');if(n?.visible){const t=n.list.filter(o=>o.type==='Text').map(o=>o.text).join(' ');if(t.includes('同归麾下'))s.__pairNotices.push(t);}};
      s.events.on('postupdate',sample);s.events.once('shutdown',()=>s.events.off('postupdate',sample));
    });
    const g0 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions);
    await finish(ev, 'lijue', 'persuade'); await p.waitForTimeout(1800);
    await ev(s => { const x = s.dual.entries[1]; x.invulnUntil = 0; x.enemy.invulnerable = false; });
    await finish(ev, 'zhangxiu', 'persuade'); await p.waitForTimeout(100);
    const tx = await texts(ev); await p.screenshot({ path: `${OUT}/double-surrender-1280x720.png` });
    const r = await ev(s => ({ chests: s.bossChests.length, killed: s.bossKilled })), g1 = await p.evaluate(async () => (await import('/src/world/WorldStore.ts')).loadWorld().provisions), f = await flags();
    const notice = await ev(s => s.__pairNotices);
    ck('双降：横幅「河北双雄 · 同归麾下」、不掉宝箱、算击败首领', (tx.some(t => t.includes('同归麾下')) || notice.some(t => t.includes('同归麾下'))) && r.chests === 0 && r.killed, { r, tx: tx.filter(t => t.includes('麾下')) });
    ck('双降：钱币 +100（另加各自首次劝降 +60）', g1 - g0 === 100 + 60 + 60, { g0, g1 });
    ck('剧情旗标 pair_fixture_outcome = 双降（pp）', f.pair_fixture_outcome === 'pp', f.pair_fixture_outcome);
  }
  if (want('bothkill')) {
    await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('im_story_v1') ?? '{}'); if (v.flags) { delete v.flags.executed; delete v.flags.executed_yanliang; delete v.flags.executed_wenchou; } localStorage.setItem('im_story_v1', JSON.stringify(v)); });
    const ev = await open(...G42);
    await ev(s => { s.dual.comboNow(s.combatNow + 1e9); s.__chests = []; s.__spawn = []; const g = s.grantBossChest.bind(s); s.grantBossChest = () => { const out = g(); s.__chests.push(out.map(o => o.name + '|' + o.tag)); return out; }; const sp = s.spawnBossChest.bind(s); s.spawnBossChest = (x, y, d) => { s.__spawn.push(String(new Error().stack).slice(0, 400)); return sp(x, y, d); }; });
    await finish(ev, 'wenchou', 'execute'); await p.waitForTimeout(400);
    const mid = await ev(s => ({ chests: s.bossChests.length, killed: s.bossKilled }));
    await ev(s => { const x = s.dual.entries[0]; x.invulnUntil = 0; x.enemy.invulnerable = false; });
    await finish(ev, 'yanliang', 'execute'); await p.waitForTimeout(1200);
    for (let i = 0; i < 20 && !(await ev(s => s.__chests.length)); i++) { await ev(s => { const c = s.bossChests[0]; const o = c?.sprite ?? c?.img ?? c?.root; if (o) { s.player.sprite.x = o.x; s.player.sprite.y = o.y; } }); await p.waitForTimeout(200); }
    const out = await ev(s => s.__chests), f = await flags();
    ck('先倒的不掉宝箱、不结算；宝箱只在最后一人了结时掉一次', mid.chests === 0 && !mid.killed && out.length === 1, { mid, out, spawn: await ev(s => s.__spawn), chests: await ev(s => s.bossChests.length) });
    ck('两人都是本存档首次斩杀 → 两件紫装', out[0]?.filter(t => t.startsWith('紫色兵装')).length === 2, out[0]);
    ck('剧情旗标 hebei_outcome = 双斩（kk）', f.hebei_outcome === 'kk', f.hebei_outcome);
  }
  // ⑩ 夏侯渊张郃：代督退兵 / 张郃先退；张郃不死不弹窗
  if (want('dingjun')) {
    let ev = await open(...H82);
    await ev(s => s.dual.comboNow(s.combatNow + 1e9));
    const a = await snap(ev);
    ck('8-2：夏侯渊（左、骑马）+ 张郃（右、步战），张郃没有招降窗', a.entries[0].id === 'xiahouyuan' && a.entries[1].id === 'zhanghe' && a.entries[0].mounted && !a.entries[1].mounted && a.entries[1].parley === null, a.entries);
    await finish(ev, 'xiahouyuan', 'execute'); await p.waitForTimeout(1800);
    const r = await snap(ev), z = r.entries[1], now = await ev(s => s.combatNow), tx = await texts(ev);
    ck('夏侯渊先倒：张郃不狂怒，「代督退兵」——4 名亲卫、30 秒撤军倒计时', !z.rage && z.status === '代督退兵' && z.guards === 4 && Math.abs(z.retreatAt - now - 30000) < 2500 && tx.some(t => t.includes('代督')), { z, left: z.retreatAt - now });
    await ev(s => { s.dual.entries[1].retreatAt = s.combatNow; }); await p.waitForTimeout(900);
    const r2 = await snap(ev), ch = await ev(s => ({ chests: s.bossChests.length, killed: s.bossKilled }));
    ck('撤军倒计时到：张郃退走（不死），掉宝箱，告捷', r2.entries[1].done === 'retreated' && ch.chests === 1 && ch.killed, { done: r2.entries[1].done, ch });
    ev = await open(...H82);
    await ev(s => s.dual.comboNow(s.combatNow + 1e9));
    await hurtE(ev, 'zhanghe', .1); await p.waitForTimeout(800);
    const r3 = await snap(ev), pan = await ev(s => s.mode);
    ck('张郃先打到 15%：直接退走（不弹窗），夏侯渊狂怒', r3.entries[1].done === 'retreated' && pan !== 'parley' && r3.entries[0].rage, { z: r3.entries[1].done, mode: pan, rage: r3.entries[0].rage });
    // 张郃打到 0 也不死
    ev = await open(...H82);
    await ev(s => { s.dual.comboNow(s.combatNow + 1e9); const x = s.dual.entries[1]; s.hitEnemy(x.enemy, 1e7, s.combatNow, 'melee', false, false); });
    await p.waitForTimeout(500);
    const r4 = await snap(ev);
    ck('张郃一击打穿也只是退走（不倒地）', r4.entries[1].done === 'retreated', r4.entries[1].done);
  }
  // ⑪ 4-1 颜良负伤败走；败退型（8-1 张郃）
  if (want('retreat')) {
    let ev = await open('GuanduGameScene', { guanduStage: 1 }, {}, false);
    const r0 = await ev(s => ({ parley: !!s.parley, dual: !!s.dual }));
    await ev(s => { s.boss.invulnerable = false; s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); });
    await p.waitForTimeout(500);
    const r1 = await ev(s => ({ mode: s.mode, ghost: !!s.children.getByName('boss-retreat'), chests: s.bossChests.length, killed: s.bossKilled, corpse: s.children.list.some(o => o.type === 'Image' && o.texture?.key === 'guandu_yanliang' && o.frame?.name >= 28 && o.visible) }));
    ck('4-1 颜良：不弹窗、负伤败走（淡出、不倒地），照掉宝箱、算击败首领', !r0.parley && !r0.dual && r1.mode !== 'parley' && r1.ghost && !r1.corpse && r1.chests === 1 && r1.killed, { r0, r1 });
    ev = await open('HanzhongGameScene', { hanzhongStage: 1 }, { thirdStage: 1 }, false);
    const z0 = await ev(s => ({ parley: !!s.parley, tier: s.surrenderKey() }));
    await ev(s => { s.boss.invulnerable = false; s.hitEnemy(s.boss, 1e7, s.combatNow, 'melee', false, false); });
    await p.waitForTimeout(500);
    const z1 = await ev(s => ({ mode: s.mode, ghost: !!s.children.getByName('boss-retreat'), chests: s.bossChests.length }));
    ck('8-1 张郃（败退型）：不弹窗、淡出退走、照掉宝箱', !z0.parley && z1.mode !== 'parley' && z1.ghost && z1.chests === 1, { z0, z1 });
  }
  // ⑫ 4-2 首次通关幕间四种结果
  if (want('interlude')) {
    const r = await p.evaluate(async () => {
      const St = await import('/src/systems/Story.ts'), G = (await import('/src/data/story/guandu.ts'));
      const ch = Object.values(G).find(v => v?.stages?.[2]); const node = ch.stages[2].after[0], ctx = { lord: 'zhaoyun', team: () => ['zhaoyun'], recruited: () => false };
      const out = {}; for (const v of ['kk', 'pp', 'pk', 'kp']) { St.setStoryFlag('hebei_outcome', v); St.setStoryFlag('yanliang_by_guanyu', v[0] === 'k'); out[v] = St.resolveLines(node, ctx).map(l => l.text).join('/'); }
      St.setStoryFlag('yanliang_by_guanyu', false); return out;
    });
    ck('幕间四支：双斩 / 双降 / 颜降文斩 / 颜斩文降各一句旁白，再接「两军相持」', r.kk.includes('相继授首') && r.pp.includes('一并归降') && r.pk.includes('颜良归降，文丑战死') && r.kp.includes('颜良授首，文丑归降') && Object.values(r).every(t => t.includes('两军相持') && t.split('/').length >= 3), r);
    ck('关羽斩了颜良才接「云长真神人也」', r.kk.includes('云长真神人') && !r.pp.includes('云长真神人'), r);
  }
  // ⑬ 镜头：两人都在画面里、主将在中间 60%；远了两色屏外箭头
  if (want('camera')) {
    const ev = await open(...G42);
    await ev(s => { s.dual.comboNow(s.combatNow + 1e9); for (const x of s.dual.entries) x.ctrl.holdUntil(s.combatNow + 1e9); });
    const near = [];
    for (let i = 0; i < 12; i++) { await ev(s => { const p = s.player, [a, b] = s.dual.entries; a.enemy.sprite.x = p.x - 300; a.enemy.sprite.y = p.y - 150; b.enemy.sprite.x = p.x + 120; b.enemy.sprite.y = p.y - 260; }); await p.waitForTimeout(120); }
    near.push(await ev(s => { const v = s.cameras.main.worldView, p = s.player, inV = e => e.x > v.x && e.x < v.right && e.y > v.y && e.y < v.bottom; return { both: s.dual.entries.every(x => inV(x.enemy)), px: (p.x - v.x) / v.width, py: (p.y - v.y) / v.height }; }));
    for (let i = 0; i < 8; i++) { await ev(s => { const p = s.player, [a, b] = s.dual.entries; a.enemy.sprite.x = p.x - 1500; a.enemy.sprite.y = p.y; b.enemy.sprite.x = p.x + 1400; b.enemy.sprite.y = p.y + 200; }); await p.waitForTimeout(120); }
    const far = await ev(s => ({ ...s.presence.stats }));
    const n = near[0];
    ck('镜头：两首领在一屏内时都在画面里，主将在中间 60%', n.both && n.px >= .2 && n.px <= .8 && n.py >= .2 && n.py <= .8, n);
    ck('两首领远离：两个颜色的屏外箭头（左金右朱）', far.arrows === 2 && far.arrowColors.includes('gold') && far.arrowColors.includes('red'), far);
  }
  // ⑭ 弹劝降窗时另一个首领也暂停；关窗后两人恢复
  if (want('pause')) {
    const ev = await recruitablePair();
    await ev(s => s.dual.comboNow(s.combatNow + 1e9));
    await hurtE(ev, 'lijue', .12); await waitPanel(ev);
    const a = await ev(s => ({ t: s.combatNow, w: { x: s.dual.entries[1].enemy.x, y: s.dual.entries[1].enemy.y } }));
    await p.waitForTimeout(1200);
    const b2 = await ev(s => ({ t: s.combatNow, w: { x: s.dual.entries[1].enemy.x, y: s.dual.entries[1].enemy.y }, mode: s.mode }));
    ck('弹劝降窗：战斗时钟停、张绣不动', b2.mode === 'parley' && b2.t === a.t && b2.w.x === a.w.x && b2.w.y === a.w.y, { a, b2 });
    await ev(s => s.choose('press')); await p.waitForTimeout(1000);
    const c = await ev(s => ({ t: s.combatNow, mode: s.mode }));
    ck('关窗（再压一压）后恢复', c.mode === 'none' && c.t > b2.t, c);
  }
  // ⑮ 中途退出回滚：两人的招降 / 斩杀旗标一起回滚
  if (want('rollback')) {
    const sn = () => p.evaluate(() => { const f = (JSON.parse(localStorage.getItem('im_story_v1') ?? '{}').flags ?? {}); return { sur: f.surrendered ?? '', exe: f.executed ?? '', out: f.pair_fixture_outcome ?? '', cap: (JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}').captives ?? []).map(o => o.boss).filter(Boolean).sort().join(',') }; });
    await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('im_story_v1') ?? '{}'); if (v.flags) { for (const k of ['surrendered', 'executed', 'surrendered_yanliang', 'surrendered_wenchou', 'executed_yanliang', 'executed_wenchou']) delete v.flags[k]; } localStorage.setItem('im_story_v1', JSON.stringify(v)); const r = JSON.parse(localStorage.getItem('im_roster_v1') ?? '{}'); if (r.captives) r.captives = r.captives.filter(c => c.boss !== 'lijue' && c.boss !== 'zhangxiu'); localStorage.setItem('im_roster_v1', JSON.stringify(r)); });
    const ev = await recruitablePair();
    await p.evaluate(async () => { (await import('/src/systems/BattleSnapshot.ts')).beginBattle('test-dual-boss'); });
    await ev(s => s.dual.comboNow(s.combatNow + 1e9)); await roll(ev, .01);
    const a0 = await sn();
    await finish(ev, 'zhangxiu', 'persuade'); await p.waitForTimeout(1800);
    await ev(s => { const x = s.dual.entries[0]; x.invulnUntil = 0; x.enemy.invulnerable = false; });
    await finish(ev, 'lijue', 'execute'); await p.waitForTimeout(600); /* 宝箱未捡：战斗未结算 */
    const a1 = await sn();
    await p.evaluate(async () => { (await import('/src/systems/BattleSnapshot.ts')).rollbackBattle(); });
    const a2 = await sn();
    ck('中途退出回滚：张绣劝降（旗标 + 降将栏）与两人结果旗标 pair_fixture_outcome（李斩张降）一起撤销', a1.sur.includes('zhangxiu') && a1.cap.includes('zhangxiu') && a1.out === 'kp' && a2.sur === a0.sur && a2.exe === a0.exe && a2.cap === a0.cap && a2.out === a0.out, { a0, a1, a2 });
  }
  // ⑯ 帧率：双将关首领在场 vs 同章单首领关（各采样 5 秒）
  if (want('fps')) {
    const sample = async (ev, ms) => { const xs = []; for (let i = 0; i < ms / 250; i++) { await p.waitForTimeout(250); xs.push(await ev(s => s.game.loop.actualFps)); } return xs.reduce((a, b) => a + b, 0) / xs.length; };
    const fill = ev => ev(s => { s.spawnTimer = 0.2; s.eliteTimer = 1e9; });
    let ev = await open('GuanduGameScene', { guanduStage: 1 }, {}, false); await fill(ev); await p.waitForTimeout(2500);
    const single = await sample(ev, 5000);
    ev = await open(...G42); await ev(s => s.dual.comboNow(s.combatNow + 1e9)); await fill(ev); await p.waitForTimeout(2500);
    const dual = await sample(ev, 5000);
    ck(`帧率：双将关平均 ${dual.toFixed(1)} 不低于单首领关 ${single.toFixed(1)}（容差 10%）`, dual >= single * .9, { single, dual });
  }
  ck('无页面报错', !errs.length, errs.slice(0, 5));
} finally { await b.close(); }
const pass = rows.filter(Boolean).length; console.log(`SUMMARY: ${pass}/${rows.length} passed`); process.exit(pass === rows.length ? 0 : 1);
