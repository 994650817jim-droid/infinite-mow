// 魏延 / 庞统重做：专属本命武器与被动。
// 魏延「镇北环首刀」：劈地裂波直线穿透；被动「镇守汉中」受击积拒敌，满 5 层「谁敢杀我」六向裂波 + 3 秒减伤 30%。
// 庞统「凤雏连环令」：布火雷，踩中引爆、附近火雷连锁；被动「连环计」一次连锁 ≥3 枚积计策，满 3 层「火烧连环」；落凤坡伏兵。
// 手机 390×844 与电脑 1280×720 各跑一遍；选将卡显示新武器名与专属武学；无 pageerror / console error。截图 assets/review/weiyan-pangtong/。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-weiyan-pangtong.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/weiyan-pangtong';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const LAYOUTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 720 } };
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
    // 1) 劈地裂波：正前方一列敌人（超出关刀扇形宽度的直线远端也要命中）
    const crack = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, foes = [];
      for (let i = 0; i < 5; i++) { const e = s.spawnEnemy('infantry', pl.x + 40 + i * 38, pl.y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; foes.push(e); } }
      const t0 = performance.now(); while (performance.now() - t0 < 5000 && !foes.every(e => e.hp < e.maxHp)) await new Promise(r => setTimeout(r, 40));
      const far = foes[foes.length - 1]; return { hit: foes.filter(e => e.hp < e.maxHp).length, farDist: Math.round(far.x - pl.x), nearLoss: foes[0].maxHp - foes[0].hp, farLoss: far.maxHp - far.hp };
    }, G);
    ck(`${tag}：裂波直线穿透一列 5 敌（最远 ${crack.farDist}px），贴身伤害更高`, crack.hit === 5 && crack.nearLoss > crack.farLoss, crack);
    // 2) 镇守汉中：受击积拒敌，满 5 层后「谁敢杀我」
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; pl.damageImmune = false; const got = [];
      for (let i = 0; i < 8 && pl.passive.snapshot(s.combatNow).stacks < 5; i++) { pl.invulnUntil = 0; pl.takeDamage(1, s.combatNow); pl.hp = pl.maxHp; got.push(pl.passive.snapshot(s.combatNow).stacks); await new Promise(r => setTimeout(r, 560)); }
      pl.damageImmune = true; const t0 = performance.now(); let shout = false, guard = 1;
      while (performance.now() - t0 < 6000) { await new Promise(r => setTimeout(r, 30)); if (s.children.getByName('weiyan-whodares')) { shout = true; guard = pl.passive.damageTakenMultiplier(s.combatNow); break; } }
      return { got, shout, guard, triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, G);
    ck(`${tag}：受击积满 5 层拒敌 → 谁敢杀我（飘字、减伤 ×0.7）`, r.got.includes(5) && r.shout && Math.abs(r.guard - .7) < 1e-6 && r.triggers >= 1, r);
    await sleep(150);
  } else {
    // 1) 布雷：敌人定身在远处，火雷布在来路上并累积
    const lay = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, foes = [];
      for (let i = 0; i < 3; i++) { const e = s.spawnEnemy('infantry', pl.x + 250, pl.y - 30 + i * 30, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; foes.push(e); } }
      const mines = () => s.children.list.filter(o => o.name === 'pangtong-mine' && o.active);
      const t0 = performance.now(); while (performance.now() - t0 < 9000 && mines().length < 4) await new Promise(r => setTimeout(r, 50));
      const m = mines(); return { mines: m.length, between: m.every(o => o.x > pl.x + 60 && o.x < pl.x + 220) };
    }, G);
    ck(`${tag}：火雷布在自己与敌人之间并累积（≥4 枚）`, lay.mines >= 4 && lay.between, lay);
    // 2) 连环：一名敌人踩上雷群 → 连锁 ≥3 枚 → 积 1 层计策
    const chain = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, sn0 = pl.passive.snapshot(s.combatNow), m = s.children.list.find(o => o.name === 'pangtong-mine' && o.active);
      const before = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length;
      const e = s.spawnEnemy('infantry', m.x, m.y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; }
      await new Promise(r => setTimeout(r, 1500));
      return { before, after: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length, stacks0: sn0.stacks, stacks: pl.passive.snapshot(s.combatNow).stacks, gains: pl.passive.snapshot(s.combatNow).gains, hurt: e ? e.maxHp - e.hp : 0 };
    }, G);
    ck(`${tag}：踩雷连锁引爆 ≥3 枚并积 1 层计策`, chain.before - chain.after >= 3 && chain.gains >= 1 && chain.hurt > 0, chain);
    // 3) 火烧连环：计策满 3 层后布下锁链环，踏入或 2 秒后齐爆
    const ring = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; while (pl.passive.snapshot(s.combatNow).stacks < 3) pl.passive.onMineChain(3);
      const t0 = performance.now(); let seen = false; while (performance.now() - t0 < 6000) { await new Promise(r => setTimeout(r, 40)); if (s.children.getByName('pangtong-ring')) { seen = true; break; } }
      const ringMines = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active && Math.abs(Math.hypot(o.x - pl.x, o.y - pl.y) - 110) < 6).length;
      await new Promise(r => setTimeout(r, 2600));
      return { seen, ringMines, gone: !s.children.getByName('pangtong-ring'), triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, G);
    ck(`${tag}：火烧连环——6 枚环形火雷以锁链相连，2 秒内齐爆`, ring.seen && ring.ringMines === 6 && ring.gone && ring.triggers >= 1, ring);
    // 4) 落凤坡伏兵
    const fp = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, n0 = s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length; pl.hp = Math.round(pl.maxHp * .2);
      const t0 = performance.now(); let text = false; while (performance.now() - t0 < 2000) { await new Promise(r => setTimeout(r, 30)); if (s.children.getByName('pangtong-fengpo')) { text = true; break; } }
      return { text, added: s.children.list.filter(o => o.name === 'pangtong-mine' && o.active).length - n0 };
    }, G);
    ck(`${tag}：生命 <30% 落凤坡伏兵，脚下布 4 枚火雷`, fp.text && fp.added >= 4, fp);
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
