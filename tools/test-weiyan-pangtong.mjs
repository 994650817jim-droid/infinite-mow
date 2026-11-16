// 魏延 / 庞统重做：专属本命武器与被动。
// 魏延「镇北环首刀」：劈地裂波直线穿透；被动「镇守汉中」受击积拒敌，满 5 层「谁敢杀我」六向裂波 + 3 秒减伤 30%。
// 庞统「凤雏连环令」：布火雷，踩中引爆、附近火雷连锁；被动「连环计」一次连锁 ≥3 枚积计策，满 3 层「火烧连环」；落凤坡伏兵。
// 手机 390×844 与电脑 1280×720 各跑一遍；选将卡显示新武器名与专属武学；无 pageerror / console error。截图 assets/review/weiyan-pangtong/。
// 用法：BASE=http://127.0.0.1:5173/ [LAYOUT=desktop|mobile] node tools/test-weiyan-pangtong.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/weiyan-pangtong';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const LAYOUTS = Object.fromEntries(Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 720 } }).filter(([k]) => !process.env.LAYOUT || process.env.LAYOUT === k));
const HEROES = { weiyan: { name: '魏延', weapon: 'zhenbei_blade' }, pangtong: { name: '庞统', weapon: 'lianhuan_mines' } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(tag + ' ' + m.text()); }); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const [layout, viewport] of Object.entries(LAYOUTS)) for (const [hero, h] of Object.entries(HEROES)) {
  const tag = `${h.name}(${layout === 'mobile' ? '手机' : '电脑'})`;
  const p = await b.newPage({ viewport }); watch(p, tag);
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 30000 });
  await sleep(1500);
  await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, hero]);
  await sleep(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 20000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await sleep(300);
  const st = await p.evaluate(G0 => { const s = eval(G0), pl = s.player; return { weapon: pl.weapons[0].id, passive: pl.passive.snapshot(s.combatNow).character, max: pl.passive.snapshot(s.combatNow).maxStacks, actions: pl.hasActions, hp: pl.maxHp }; }, G);
  ck(`${tag}：本命武器 ${h.weapon}、专属被动、动作图`, st.weapon === h.weapon && st.passive === hero && st.actions, st);

  if (hero === 'weiyan') {
    // 1) 劈地裂波：正前方一列敌人（超出关刀扇形宽度的直线远端也要命中）。
    //    比较贴身 / 远端伤害时关掉暴击（基础 5%）：远端那一刀暴击会到 ×1.8，曾让断言随机失败（41 vs 57）。
    const crack = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, foes = [], crit0 = pl.stats.critChance; pl.stats.critChance = -1;
      for (let i = 0; i < 5; i++) { const e = s.spawnEnemy('infantry', pl.x + 40 + i * 38, pl.y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; foes.push(e); } }
      const t0 = performance.now(); while (performance.now() - t0 < 5000 && !foes.every(e => e.hp < e.maxHp)) await new Promise(r => setTimeout(r, 40));
      pl.stats.critChance = crit0;
      const far = foes[foes.length - 1]; return { hit: foes.filter(e => e.hp < e.maxHp).length, farDist: Math.round(far.x - pl.x), nearLoss: foes[0].maxHp - foes[0].hp, farLoss: far.maxHp - far.hp };
    }, G);
    ck(`${tag}：裂波直线穿透一列 5 敌（最远 ${crack.farDist}px），贴身伤害更高`, crack.hit === 5 && crack.nearLoss > crack.farLoss, crack);
    // 2) 镇守汉中：受击积拒敌，满 5 层后「谁敢杀我」
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; pl.damageImmune = false; const got = [];
      // 前一步的敌人还在刀下，满 5 层后随时可能在积层循环里就放出「谁敢杀我」，所以从一开始就盯飘字（飘字约 1.1 秒后消失）
      let shout = false, guard = 1; const watch = setInterval(() => { if (!shout && s.children.getByName('weiyan-whodares')) { shout = true; guard = pl.passive.damageTakenMultiplier(s.combatNow); } }, 20);
      for (let i = 0; i < 8 && !shout && pl.passive.snapshot(s.combatNow).stacks < 5; i++) { pl.invulnUntil = 0; pl.takeDamage(1, s.combatNow); pl.hp = pl.maxHp; got.push(pl.passive.snapshot(s.combatNow).stacks); await new Promise(r => setTimeout(r, 560)); }
      pl.damageImmune = true; const t0 = performance.now();
      while (!shout && performance.now() - t0 < 6000) await new Promise(r => setTimeout(r, 30));
      clearInterval(watch);
      return { got, shout, guard, triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, G);
    ck(`${tag}：受击积满 5 层拒敌 → 谁敢杀我（飘字、减伤 ×0.7）`, r.got.includes(5) && r.shout && Math.abs(r.guard - .7) < 1e-6 && r.triggers >= 1, r);
    await sleep(150);
  } else {
    // 2026-11-16 方案 A「铁索连环」：边走边落雷、雷与雷之间拉铁索。测试里用脚本让庞统匀速走动（每 50ms 挪 8 像素 ≈ 160 像素/秒），
    // 并让一名定身「诱敌」跟在他上方 260 处——没有 320 内的敌人时不落雷。
    const WALK = `(s, pl, steps, fn) => new Promise(res => { let i = 0; const bait = s.spawnEnemy('infantry', pl.x, pl.y - 260, 1); if (bait) { bait.hp = bait.maxHp = 99999; bait.stunUntil = 1e12; }
      pl.weapons[0].cooldownLeft = 999; const h = setInterval(() => { const p = fn(i++); if (i === 1) pl.weapons[0].cooldownLeft = 0; pl.sprite.x = p.x; pl.sprite.y = p.y; if (bait) { bait.sprite.x = pl.x; bait.sprite.y = pl.y - 260; } if (i >= steps) { clearInterval(h); bait?.deactivate(); pl.weapons[0].cooldownLeft = 999; res(); } }, 50); })`;
    const mk = "(x, y) => { const e = s.spawnEnemy('infantry', x, y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } return e; }";
    const clear = async G0 => { const s = eval(G0); for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate(); (await import('/src/weapons/heroWeapons.ts')).lianhuanClear(s.player); s.player.weapons[0].cooldownLeft = 999; };
    await p.evaluate(clear, G); await sleep(200);
    // 1) Lv1：直线走 3 秒 → 脚下落雷，相邻两雷之间拉起铁索
    const lay = await p.evaluate(async ([G0, W]) => {
      const s = eval(G0), pl = s.player, walk = eval(W), x0 = pl.x, y0 = pl.y; pl.weapons[0].level = 1;
      await walk(s, pl, 60, i => ({ x: x0 + i * 8, y: y0 }));
      const mines = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active), tethers = s.children.list.filter(o => o.name === 'pangtong-tether' && o.active);
      return { mines: mines.length, onPath: mines.every(o => Math.abs(o.y - y0) <= 4), tethers: tethers.length, hot: s.textures.exists('pangtong_fx') };
    }, [G, WALK]);
    ck(`${tag}：Lv1 边走边在脚下落雷（≥4 枚），相邻火雷拉起铁索`, lay.mines >= 4 && lay.onPath && lay.tethers >= lay.mines - 1, lay);
    // 2) 铁索减速；Lv2 铁索灼伤（敌人站在铁索中段，不碰雷）
    const burn = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK); const ms = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).sort((a, b) => a.x - b.x);
      const a = ms[ms.length - 2], b = ms[ms.length - 1], e = mk((a.x + b.x) / 2, (a.y + b.y) / 2); e.stunUntil = 0; e.def = { ...e.def, speed: 0 };
      await new Promise(r => setTimeout(r, 300)); const slow = { mul: e.martialSlow, on: e.martialSlowUntil > s.combatNow }, hp1 = e.hp;
      await new Promise(r => setTimeout(r, 1100)); const lv1Hurt = hp1 - e.hp; pl.weapons[0].level = 2; const hp2 = e.hp;
      await new Promise(r => setTimeout(r, 1100)); return { gap: Math.round(Math.hypot(b.x - a.x, b.y - a.y)), slow, lv1Hurt, lv2Hurt: hp2 - e.hp, minesLeft: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length };
    }, [G, mk]);
    ck(`${tag}：铁索上的敌人减速 25%；Lv1 不灼伤，Lv2 起每 0.5 秒灼伤`, burn.slow.on && Math.abs(burn.slow.mul - .75) < 1e-6 && burn.lv1Hurt === 0 && burn.lv2Hurt > 0, burn);
    await p.evaluate(clear, G); await sleep(300);
    // 2b) 引信（用户：「地雷触发太快了，炸不到人」）：敌人踩雷后约 1 秒才爆，期间再有人踩不重新计时；后面走进来的敌人也被炸到
    await p.evaluate(clear, G); await sleep(200);
    const fuse = await p.evaluate(async ([G0, W, MK]) => {
      const s = eval(G0), pl = s.player, walk = eval(W), mk = eval(MK), x0 = pl.x, y0 = pl.y; pl.weapons[0].level = 1;
      await walk(s, pl, 16, i => ({ x: x0 + i * 8, y: y0 }));
      const m = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).sort((a, b) => a.x - b.x)[0];
      await new Promise(r => setTimeout(r, 600)); // 过了布雷后的 0.5 秒待发
      const { PASSIVE_RULES } = await import('/src/data/passives.ts');
      const a = mk(m.x, m.y); const t0 = performance.now(); let boomAt = -1;
      const watch = setInterval(() => { if (boomAt < 0 && !m.active) boomAt = performance.now() - t0; }, 10);
      await new Promise(r => setTimeout(r, 450)); const b = mk(m.x + 4, m.y + 3); // 引信中途又有人踩上来
      await new Promise(r => setTimeout(r, 150)); const c = mk(m.x + 34, m.y - 10);  // 后面跟上来的敌人（在爆炸范围内、不在踩雷判定里）
      const aliveAt700 = m.active, aHurtAt700 = a.maxHp - a.hp;
      while (performance.now() - t0 < 2500 && boomAt < 0) await new Promise(r => setTimeout(r, 20));
      clearInterval(watch);
      return { fuseMs: PASSIVE_RULES.mineFuseMs, boomAt: Math.round(boomAt), aliveAt700, aHurtAt700, hurt: [a, b, c].map(e => e.maxHp - e.hp) };
    }, [G, WALK, mk]);
    ck(`${tag}：踩雷后先烧约 1 秒引信再爆（期间再踩不重新计时），爆炸能炸到多名敌人`, fuse.fuseMs === 1000 && fuse.aliveAt700 && fuse.aHurtAt700 === 0 && fuse.boomAt >= 850 && fuse.boomAt <= 1350 && fuse.hurt.every(h => h > 0), fuse);
    await p.evaluate(clear, G); await sleep(300);
    // 3) Lv3 火走铁索：一名敌人踩雷 → 连锁 ≥3 枚、积 1 层计策，火沿铁索烧过去，站在铁索上的敌人也挨打
    const chain = await p.evaluate(async ([G0, W, MK]) => {
      const s = eval(G0), pl = s.player, walk = eval(W), mk = eval(MK), x0 = pl.x, y0 = pl.y; pl.weapons[0].level = 3;
      await walk(s, pl, 50, i => ({ x: x0 + i * 8, y: y0 }));
      const ms = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).sort((a, b) => a.x - b.x), before = ms.length, gains0 = pl.passive.snapshot(s.combatNow).gains;
      const mid = mk((ms[1].x + ms[2].x) / 2, ms[1].y); mid.def = { ...mid.def, speed: 0 }; const hp0 = mid.hp; let run = false; const t0 = performance.now();
      const stepper = mk(ms[0].x, ms[0].y);
      while (performance.now() - t0 < 3000) { await new Promise(r => setTimeout(r, 15)); run = run || !!s.children.getByName('pangtong-firerun') || !!s.children.getByName('pangtong-link'); }
      return { before, after: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length, gains: pl.passive.snapshot(s.combatNow).gains - gains0, run, midHurt: hp0 - mid.hp, stepperHurt: stepper.maxHp - stepper.hp };
    }, [G, WALK, mk]);
    ck(`${tag}：Lv3 踩雷连锁 ≥3 枚并积 1 层计策，火沿铁索烧过去、铁索上的敌人也挨打`, chain.before - chain.after >= 3 && chain.gains >= 1 && chain.run && chain.midHurt > 0 && chain.stepperHurt > 0, chain);
    await p.evaluate(clear, G); await sleep(300);
    // 4) Lv4 双链：每枚新雷连 2 条铁索（铁索段数明显多于雷数 - 1）
    const dbl = await p.evaluate(async ([G0, W]) => {
      const s = eval(G0), pl = s.player, walk = eval(W), x0 = pl.x, y0 = pl.y; pl.weapons[0].level = 4;
      // 走「之」字，让每枚新雷附近有两枚旧雷
      await walk(s, pl, 70, i => ({ x: x0 + i * 4, y: y0 + ((i >> 3) % 2 ? 40 : -40) }));
      return { mines: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length, tethers: s.children.list.filter(o => o.name === 'pangtong-tether' && o.active).length };
    }, [G, WALK]);
    ck(`${tag}：Lv4 双链——每枚新雷连 2 条铁索`, dbl.mines >= 4 && dbl.tethers >= dbl.mines + 1, dbl);
    await p.evaluate(clear, G); await sleep(300);
    // 5) Lv5 铁索连舟：绕一圈（半径 90）让铁索首尾相接 → 圈内整片地火（灼伤 + 减速 40%），3 秒后整圈齐爆
    const loop = await p.evaluate(async ([G0, W, MK]) => {
      const s = eval(G0), pl = s.player, walk = eval(W), mk = eval(MK), cx = pl.x, cy = pl.y; pl.weapons[0].level = 5;
      for (const o of s.children.list.filter(o => o.name === 'pangtong-mine' && o.active)) o.setVisible(false);
      const center = mk(cx, cy); center.def = { ...center.def, speed: 0 };
      let seen = false, inside = { slow: 1, hurt: 0 }; const hp0 = center.hp;
      const watch = setInterval(() => { if (!seen && s.children.getByName('pangtong-loopfire')) seen = true; if (seen && center.martialSlowUntil > s.combatNow) inside.slow = Math.min(inside.slow, center.martialSlow); }, 30);
      await walk(s, pl, 80, i => { const a = i * 8 / 90; return { x: cx + Math.cos(a) * 90, y: cy + Math.sin(a) * 90 }; });
      const t0 = performance.now(); while (performance.now() - t0 < 4500 && (!seen || s.children.getByName('pangtong-loopfire'))) await new Promise(r => setTimeout(r, 50));
      clearInterval(watch); inside.hurt = hp0 - center.hp;
      return { seen, ...inside, gone: !s.children.getByName('pangtong-loopfire'), ground: s.textures.exists('pangtong_fx') };
    }, [G, WALK, mk]);
    ck(`${tag}：Lv5 铁索连舟——绕一圈首尾相接，圈内地火灼伤并减速 40%，3 秒后整圈齐爆`, loop.seen && loop.hurt > 0 && Math.abs(loop.slow - .6) < 1e-6 && loop.gone, loop);
    await p.evaluate(clear, G); await sleep(300);
    // 6) 火烧连环：计策满 3 层后布下锁链环（Lv1 踏入或 2 秒后齐爆；Lv5 先化作整片地火）
    const ring = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; pl.weapons[0].level = 1; pl.weapons[0].cooldownLeft = 0; while (pl.passive.snapshot(s.combatNow).stacks < 3) pl.passive.onMineChain(3);
      const bait = s.spawnEnemy('infantry', pl.x + 250, pl.y, 1); if (bait) { bait.hp = bait.maxHp = 99999; bait.stunUntil = 1e12; }
      const t0 = performance.now(); let seen = false; while (performance.now() - t0 < 6000) { await new Promise(r => setTimeout(r, 40)); if (s.children.getByName('pangtong-ring')) { seen = true; break; } }
      const ringMines = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active && Math.abs(Math.hypot(o.x - pl.x, o.y - pl.y) - 110) < 6).length;
      await new Promise(r => setTimeout(r, 2600));
      const lv1 = { seen, ringMines, gone: !s.children.getByName('pangtong-ring'), triggers: pl.passive.snapshot(s.combatNow).triggers };
      pl.weapons[0].level = 5; while (pl.passive.snapshot(s.combatNow).stacks < 3) pl.passive.onMineChain(3);
      let fire = false; const t1 = performance.now(); while (performance.now() - t1 < 6000 && !fire) { await new Promise(r => setTimeout(r, 40)); fire = !!s.children.getByName('pangtong-loopfire'); }
      return { lv1, lv5Fire: fire };
    }, G);
    ck(`${tag}：火烧连环——6 枚环形火雷以锁链相连，2 秒内齐爆；满级时圈内先整片起火`, ring.lv1.seen && ring.lv1.ringMines === 6 && ring.lv1.gone && ring.lv1.triggers >= 1 && ring.lv5Fire, ring);
    await sleep(3500);
    // 7) 落凤坡伏兵：4 枚火雷以铁索连成方阵
    const fp = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; for (const e of s.enemies) if (e.active && e.kind !== 'boss') e.deactivate();
      const n0 = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length, t0n = s.children.list.filter(o => o.name === 'pangtong-tether' && o.active).length; pl.hp = Math.round(pl.maxHp * .2);
      const t0 = performance.now(); let text = false; while (performance.now() - t0 < 2000) { await new Promise(r => setTimeout(r, 30)); if (s.children.getByName('pangtong-fengpo')) { text = true; break; } }
      return { text, added: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length - n0, tethers: s.children.list.filter(o => o.name === 'pangtong-tether' && o.active).length - t0n };
    }, G);
    ck(`${tag}：生命 <30% 落凤坡伏兵，脚下 4 枚火雷以铁索连成方阵`, fp.text && fp.added >= 4 && fp.tethers >= 4, fp);
    await sleep(100);
  }
  await p.screenshot({ path: `${out}/${hero}-battle-${layout}.png` });
  await p.close();
}

// 选将卡：新武器名与专属武学
for (const [layout, viewport] of Object.entries(LAYOUTS)) {
  const p = await b.newPage({ viewport }); watch(p, 'picker-' + layout);
  await p.goto(base + `?layout=${layout}`); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 }); await sleep(600);
  for (const [id, idx] of [['weiyan', 6], ['pangtong', 8]]) {
    const c = await p.evaluate(async i => { const hp = window.__game.scene.getScene('MenuScene').heroPicker; hp.open(i); await new Promise(r => setTimeout(r, 400)); const card = hp.cards[i]; return { weapon: card.weapon.text, skills: card.skills.text }; }, idx);
    const want = id === 'weiyan' ? ['镇北环首刀', '开山', '孤军深入'] : ['凤雏连环令', '伏雷', '连营'];
    ck(`选将(${layout})：${HEROES[id].name}卡显示 ${want.join(' / ')}`, c.weapon.includes(want[0]) && c.skills.includes(want[1]) && c.skills.includes(want[2]), c);
    await p.screenshot({ path: `${out}/picker-${id}-${layout}.png` });
  }
  await p.close();
}
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
