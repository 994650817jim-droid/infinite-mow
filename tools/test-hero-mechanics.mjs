// 武将机制改动（2026-11-18 平衡审查第 2、3 步，data/heroMechanics.ts）：黄忠神射命中积层、魏延被围积层、刘备统御自身减伤、诸葛亮重做（借东风 / 八阵图）、庞统火烧连环减速。
// 电脑布局 1280×720；实战驱动（真实出手、真实挨打），全程无 pageerror / console error。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-hero-mechanics.mjs [huangzhong|weiyan|liubei|zhuge ...]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
const ALL = ['huangzhong', 'weiyan', 'liubei', 'zhuge', 'pangtong'], only = process.argv.slice(2), HEROES = ALL.filter(h => !only.length || only.includes(h));
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 页面里 eval：(x, y, opts) 生成步兵；默认高血量、定身
const MK = "(x, y, o = {}) => { const e = s.spawnEnemy(o.kind ?? 'infantry', x, y, 1); if (e) { e.hp = e.maxHp = o.hp ?? 99999; if (o.stun !== false) e.stunUntil = 1e12; if (o.dmg !== undefined) e.def = { ...e.def, damage: o.dmg }; } return e; }";
const CLEAR = "for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();";

async function open(hero) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => errors.push(hero + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(hero + ' ' + m.text()); });
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 60000 });
  await sleep(1200);
  await p.evaluate(([G0, id]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, [G, hero]);
  await sleep(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 30000 });
  await p.evaluate(([G0, C]) => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; eval(C); setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40); }, [G, CLEAR]);
  await sleep(300);
  return p;
}

for (const hero of HEROES) {
  const p = await open(hero);
  if (hero === 'huangzhong') {
    // 1) 不挨打、重箭命中 5 次进入神射（旧规则下「5 秒不受伤」也会进，这里先确认光站着不会进）
    const r1 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)); pl.damageImmune = true;
      eval(C); const w = pl.weapons[0]; w.cooldownLeft = 1e9; await wait(6000); const idleSharp = pl.passive.isSharpshooter(s.combatNow);
      mk(pl.x + 300, pl.y); w.cooldownLeft = 0; const seen = []; let enteredAt = -1, t0 = s.combatNow;
      while (s.combatNow - t0 < 15000) { await wait(40); const sn = pl.passive.snapshot(s.combatNow); if (seen[seen.length - 1] !== sn.stacks) seen.push(sn.stacks); if (sn.ready) { enteredAt = s.combatNow - t0; break; } }
      const label = pl.passive.label(s.combatNow), enterFx = !!s.children.getByName('huangzhong-sharp-enter');
      // 神射持续 6 秒，期间受伤不退出
      const t1 = s.combatNow; pl.passive.onDamage(s.combatNow); const keptAfterHurt = pl.passive.isSharpshooter(s.combatNow);
      w.cooldownLeft = 1e9; while (pl.passive.isSharpshooter(s.combatNow) && s.combatNow - t1 < 9000) await wait(50);
      return { idleSharp, seen, enteredAt: Math.round(enteredAt), label, enterFx, keptAfterHurt, sharpLasted: Math.round(s.combatNow - t1) };
    }, [G, MK, CLEAR]);
    ck('黄忠：光站着不挨打 6 秒不会进入神射（不再看不受伤时间）', r1.idleSharp === false, r1);
    ck('黄忠：重箭命中逐层积蓄势 1→5，满 5 层进入神射（金光、HUD 文案「神射 x秒」）', r1.enteredAt > 0 && [1, 2, 3, 4].every(k => r1.seen.includes(k)) && r1.enterFx && /神射 \d/.test(r1.label), r1);
    ck('黄忠：神射约 6 秒，期间受伤不退出', r1.keptAfterHurt && r1.sharpLasted >= 5600 && r1.sharpLasted <= 6500, r1);
    // 2) 真实挨打：受伤只掉 1 层（每 0.5 秒最多 1 层），不清零
    const r2 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)); eval(C);
      const w = pl.weapons[0]; w.cooldownLeft = 1e9; pl.passive.stacks = 4; pl.damageImmune = false; pl.hp = pl.maxHp = 1e6;
      const biter = mk(pl.x + 6, pl.y, { stun: false, dmg: 5 }); const t0 = s.combatNow; let after1 = -1;
      while (s.combatNow - t0 < 2000) { await wait(20); const st = pl.passive.snapshot(s.combatNow).stacks; if (st < 4 && after1 < 0) after1 = st; }
      const after2s = pl.passive.snapshot(s.combatNow).stacks; biter.deactivate(); pl.damageImmune = true;
      return { after1, after2s, hurt: 1e6 - pl.hp };
    }, [G, MK, CLEAR]);
    ck('黄忠：被贴身挨打时蓄势一次只掉 1 层（第一下 4 → 3，2 秒内逐层往下掉，不是一下清零）', r2.hurt > 0 && r2.after1 === 3 && r2.after2s >= 0 && r2.after2s <= 2, r2);
    // 3) 静心延长神射、宝刀未老延长 2 秒
    const r3 = await p.evaluate(async ([G0, C]) => {
      const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms)); eval(C);
      const out = []; for (const lv of [0, 1, 2, 3]) { pl.growth.masteries.jingxin = lv; await wait(80); out.push(pl.passive.sharpDurationMs); }
      pl.growth.masteries.jingxin = 0; await wait(80);
      pl.passive.grantSharp(s.combatNow, 0); const left0 = pl.passive.sharpLeft(s.combatNow); pl.passive.grantSharp(s.combatNow, 2000); const left1 = pl.passive.sharpLeft(s.combatNow);
      return { durations: out, extend: Math.round(left1 - left0) };
    }, [G, CLEAR]);
    ck('黄忠：静心神射 6/7/8/9 秒；宝刀未老神射中再延长 2 秒', r3.durations.join() === '6000,7000,8000,9000' && Math.abs(r3.extend - 2000) < 30, r3);
  }
  if (hero === 'weiyan') {
    // 1) 被围：身边 120 内 6 名敌人（不挨打）→ 每秒 2 层；2 名敌人 → 不积层
    const r1 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)); pl.damageImmune = true; eval(C);
      const w = pl.weapons[0]; w.cooldownLeft = 1e9; pl.passive.stacks = 0;
      const two = [mk(pl.x + 90, pl.y), mk(pl.x - 90, pl.y)]; await wait(2500); const withTwo = pl.passive.snapshot(s.combatNow).stacks;
      for (const e of two) e.deactivate(); await wait(100);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; mk(pl.x + Math.cos(a) * 80, pl.y + Math.sin(a) * 70); }
      const t0 = s.combatNow; await wait(1050); const after1s = pl.passive.snapshot(s.combatNow).stacks;
      while (pl.passive.snapshot(s.combatNow).stacks < 5 && s.combatNow - t0 < 6000) await wait(30);
      const fullMs = Math.round(s.combatNow - t0), hurt = pl.hp < pl.maxHp;
      // 满层后放开武器：下一刀化为「谁敢杀我」
      const trig0 = pl.passive.snapshot(s.combatNow).triggers; w.cooldownLeft = 0; await wait(600);
      return { withTwo, after1s, fullMs, hurt, triggered: pl.passive.snapshot(s.combatNow).triggers - trig0, guard: pl.passive.damageTakenMultiplier(s.combatNow) };
    }, [G, MK, CLEAR]);
    ck('魏延：身边只有 2 名敌人、不挨打时不积拒敌', r1.withTwo === 0, r1);
    ck('魏延：被 6 名敌人围住（不挨打）每秒积 2 层，约 2.5 秒满 5 层', !r1.hurt && r1.after1s >= 1 && r1.after1s <= 3 && r1.fullMs >= 2000 && r1.fullMs <= 3200, r1);
    ck('魏延：被围攒满后下一刀「谁敢杀我」（触发、3 秒减伤）', r1.triggered === 1 && r1.guard < 1, r1);
    // 2) 受伤积层仍在（1 名敌人贴身打，不够被围门槛）
    const r2 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)); eval(C); await wait(3200);
      const w = pl.weapons[0]; w.cooldownLeft = 1e9; pl.passive.stacks = 0; pl.damageImmune = false; pl.hp = pl.maxHp;
      const biter = mk(pl.x + 6, pl.y, { stun: false, dmg: 2 }); await wait(2500); const st = pl.passive.snapshot(s.combatNow).stacks; biter.deactivate(); pl.damageImmune = true; pl.hp = pl.maxHp;
      return { stacks: st };
    }, [G, MK, CLEAR]);
    ck('魏延：受伤积层照旧（单个敌人贴身打 2.5 秒积到层）', r2.stacks >= 1, r2);
    // 刘备的统御自保只给刘备：魏延加满统御，受伤倍率不变
    const r3 = await p.evaluate(G0 => { const s = eval(G0), g = s.player.growth, a = g.incomingDamageMultiplier(); g.attributes.command = 10; const b = g.incomingDamageMultiplier(); g.attributes.command = 0; return { a, b }; }, G);
    ck('魏延：加满统御受伤倍率不变（统御自保只给刘备）', r3.a === r3.b, r3);
  }
  if (hero === 'liubei') {
    // 统御 0 / 5 / 10 点：同一记 100 点伤害，实际掉血比
    const r1 = await p.evaluate(async ([G0, C]) => {
      const s = eval(G0), pl = s.player, g = pl.growth, wait = ms => new Promise(r => setTimeout(r, ms)); eval(C); pl.damageImmune = false;
      const hurt = async pts => { g.attributes.command = pts; await wait(100); pl.invulnUntil = 0; pl.hp = 1e6; const h0 = pl.hp; pl.takeDamage(1000, s.combatNow); const d = h0 - pl.hp; pl.hp = pl.maxHp; return d; };
      const d0 = await hurt(0), d5 = await hurt(5), d10 = await hurt(10); const mul10 = g.commandSelfGuard(); g.attributes.command = 0; pl.damageImmune = true;
      return { d0, d5, d10, r5: +(d5 / d0).toFixed(3), r10: +(d10 / d0).toFixed(3), mul10 };
    }, [G, CLEAR]);
    ck('刘备：统御每点本人受伤 −1%（5 点 ×0.95、10 点 ×0.90，真实受伤结算）', r1.d0 > 0 && Math.abs(r1.r5 - .95) < .02 && Math.abs(r1.r10 - .9) < .02 && Math.abs(r1.mul10 - .9) < 1e-9, r1);
    // 属性面板：刘备的统御一行多一句「刘备本人受伤 −1% / 点」
    const r2 = await p.evaluate(async G0 => {
      const s = eval(G0), wait = ms => new Promise(r => setTimeout(r, ms)); s.player.growth.attributePoints = Math.max(1, s.player.growth.attributePoints ?? 0);
      const open = () => { s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); };
      open(); await wait(400); const texts = []; const q = [...s.children.list]; while (q.length) { const o = q.shift(); if (o.text) texts.push(o.text); if (o.list) q.push(...o.list); }
      const line = texts.find(t => t.includes('刘备本人受伤')); return { open: true, line };
    }, G);
    await p.screenshot({ path: 'assets/review/hero-mechanics/liubei-command-panel.png' });
    await p.evaluate(G0 => { const s = eval(G0); s.attributePanel?.setVisible(false); if (s.mode === 'attributes') s.setMode('playing'); }, G);
    ck('刘备：属性面板统御一行写明「刘备本人受伤 −1% / 点」', r2.open && !!r2.line, r2);
  }
  if (hero === 'zhuge') {
    // 诸葛亮重做（2026-11-18 方案 A）：借东风、八阵图（天火本体与观星见 test-zhuge-flame）
    // 1) 借东风 1 级：每第 4 发天火同时放出东风火龙，朝目标方向直线扫过，路上的敌人吃 60%
    const r1 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; pl.damageImmune = true; pl.stats.critChance = -1; eval(C);
      const { TIANHUO_DEF } = await import('/src/weapons/zhugeTianhuo.ts');
      pl.growth.masteries.wildfire = 1; w.cooldownLeft = 1e9; await wait(100); pl.passive.reset('zhuge', s.combatNow);
      const boss = mk(pl.x + 330, pl.y, { kind: 'elite' }), lane = [mk(pl.x + 120, pl.y + 8), mk(pl.x + 220, pl.y - 8)], off = mk(pl.x + 150, pl.y + 140);
      const lane0 = []; for (let k = 1; k <= 4; k++) { w.cooldownLeft = 0; await wait(100); w.cooldownLeft = 1e9; await wait(900); lane0.push(lane.map(e => e.maxHp - e.hp)); }
      const one = TIANHUO_DEF.damage(w.level, pl.stats) * pl.growth.damageMultiplier(s.combatNow); pl.growth.masteries.wildfire = 0;
      return { lane: lane0, off: off.maxHp - off.hp, expect: Math.round(one * .6), wind: lane0[3][0] - lane0[2][0] };
    }, [G, MK, CLEAR]);
    ck('诸葛亮·借东风：前三发路上的敌人不挨打，第 4 发东风火龙直线扫过（各 60%），偏离直线的不挨打', r1.lane[2].every(v => v === 0) && r1.lane[3].every(v => Math.abs(v - r1.expect) <= 2) && r1.off === 0, r1);
    // 2) 八阵图 3 级：观星爆发处布阵——阵内步兵减速、受伤 +15%；阵内首领出招间隔 ×1.25（gapSlow）
    const r2 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; pl.damageImmune = true; pl.stats.critChance = -1; eval(C);
      pl.growth.masteries.eight_trigrams = 3; w.cooldownLeft = 1e9; await wait(100); pl.passive.reset('zhuge', s.combatNow);
      s.spawnBoss(); const boss = s.boss; boss.sprite.setPosition(pl.x + 260, pl.y); boss.stunUntil = 1e12; boss.hp = boss.maxHp = 1e6;
      const near = mk(pl.x + 290, pl.y + 30, { stun: false }); near.def = { ...near.def, speed: 40 };
      let casts = 0; const active = () => pl.passive.vulnerability(boss, s.combatNow) > 1; // 不读模块内部状态（热更新后测试拿到的是另一份模块）
      for (; casts < 7 && !active(); casts++) { for (const e of s.enemies) if (e.active && !e.isSupplySlot && e !== boss && e !== near) e.deactivate(); /* 首领召来的兵会抢走天火 */ boss.sprite.setPosition(pl.x + 260, pl.y); w.cooldownLeft = 0; await wait(100); w.cooldownLeft = 1e9; await wait(900); }
      await wait(60); const now = s.combatNow;
      const out = { casts, zones: active() ? 1 : 0, slow: near.martialSlowUntil > now ? +near.martialSlow.toFixed(2) : 1, vulnNear: +pl.passive.vulnerability(near, now).toFixed(2), vulnBoss: +pl.passive.vulnerability(boss, now).toFixed(2), gap: boss.gapSlowUntil > now ? boss.gapSlowMul : 1, fx: !!s.children.getByName('zhuge-bazhen') || !s.textures.exists('zhuge_tianhuo') };
      await wait(3200); out.after = { zones: active() ? 1 : 0, vuln: +pl.passive.vulnerability(boss, s.combatNow).toFixed(2) }; pl.growth.masteries.eight_trigrams = 0; boss.deactivate(); return out;
    }, [G, MK, CLEAR]);
    ck('诸葛亮·八阵图 3 级：观星爆发处布阵，阵内步兵减速 40%、敌人受伤 +15%、首领出招间隔 ×1.25；3 秒后散', r2.zones === 1 && r2.slow === .6 && r2.vulnNear === 1.15 && r2.vulnBoss === 1.15 && r2.gap === 1.25 && r2.fx && r2.after.zones === 0 && r2.after.vuln === 1, r2);
  }
  if (hero === 'pangtong') {
    // 庞统·火烧连环（2026-11-18 与诸葛亮分开、强调控场）：火环布下到落火结束，圈内敌人减速 20%（首领不减）
    const r1 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; pl.damageImmune = true; eval(C);
      const inside = mk(pl.x + 60, pl.y, { stun: false }), outside = mk(pl.x + 400, pl.y, { stun: false }); inside.def = { ...inside.def, speed: 30 }; outside.def = { ...outside.def, speed: 30 };
      pl.passive.stacks = 3; w.cooldownLeft = 0; await wait(300);
      const now = s.combatNow, ring = !!s.children.getByName('pangtong-ring');
      return { ring, inside: inside.martialSlowUntil > now ? +inside.martialSlow.toFixed(2) : 1, outside: outside.martialSlowUntil > now ? +outside.martialSlow.toFixed(2) : 1 };
    }, [G, MK, CLEAR]);
    ck('庞统·火烧连环：火环圈内敌人减速 20%，圈外不受影响', r1.ring && r1.inside <= .8 && r1.outside === 1, r1);
  }
  await p.close();
}
ck('无报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
