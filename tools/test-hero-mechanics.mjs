// 武将机制改动（2026-11-18 平衡审查第 2、3 步，data/heroMechanics.ts）：黄忠神射命中积层、魏延被围积层、刘备统御自身减伤、诸葛亮前期。
// 电脑布局 1280×720；实战驱动（真实出手、真实挨打），全程无 pageerror / console error。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-hero-mechanics.mjs [huangzhong|weiyan|liubei|zhuge ...]
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 480) : '')); };
const ALL = ['huangzhong', 'weiyan', 'liubei', 'zhuge'], only = process.argv.slice(2), HEROES = ALL.filter(h => !only.length || only.includes(h));
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
    ck('黄忠：被贴身挨打时蓄势一次只掉 1 层、每 0.5 秒最多掉 1 层（2 秒内从 4 层掉到 0–1 层，不是一下清零）', r2.hurt > 0 && r2.after1 === 3 && r2.after2s >= 0 && r2.after2s <= 1, r2);
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
    // 1) 单发伤害（关暴击、单个定身步兵）：Lv1–5 逐级递增，Lv1 是旧值 ×1.4
    const r1 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0], crit0 = pl.stats.critChance; pl.damageImmune = true; pl.stats.critChance = -1;
      const { WEAPON_DEFS } = await import('/src/weapons/registry.ts'), out = [];
      for (const lv of [1, 2, 3, 4, 5]) {
        eval(C); w.level = lv; w.cooldownLeft = 1e9; await wait(80); const e = mk(pl.x + 120, pl.y); w.cooldownLeft = 0; const t0 = performance.now();
        while (e.hp === e.maxHp && performance.now() - t0 < 2500) await wait(20); w.cooldownLeft = 1e9; out.push(Math.round((e.maxHp - e.hp) * 10) / 10);
      }
      const old1 = WEAPON_DEFS.flame_banner.damage(1, pl.stats) * pl.growth.damageMultiplier(s.combatNow); pl.stats.critChance = crit0; w.level = 1; eval(C);
      return { perLevel: out, old1: Math.round(old1 * 10) / 10, ratio1: +(out[0] / old1).toFixed(3) };
    }, [G, MK, CLEAR]);
    ck('诸葛亮：战旗 Lv1 伤害 ×1.4（旧值对比），Lv1→5 升级不掉伤害（整数掉血相邻两级可能相同）', Math.abs(r1.ratio1 - 1.4) < .03 && r1.perLevel.every((v, i, a) => i === 0 || v >= a[i - 1]) && r1.perLevel[4] > r1.perLevel[0], r1);
    // 2) 1-1 首领：Lv1 诸葛亮站在首领身边 12 秒，首领要掉血
    const r2 = await p.evaluate(async ([G0, C]) => {
      const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; eval(C); pl.damageImmune = true; w.level = 1; w.cooldownLeft = 0;
      s.spawnBoss(); const boss = s.boss; if (!boss) return { boss: false }; boss.sprite.setPosition(pl.x + 150, pl.y); boss.stunUntil = 1e12; const hp0 = boss.hp, t0 = s.combatNow;
      while (s.combatNow - t0 < 12000 && boss.active) await wait(50);
      const lost = hp0 - boss.hp; return { boss: true, name: boss.def?.name ?? boss.kind, lostPct: +(lost / boss.maxHp * 100).toFixed(1), dps: Math.round(lost / ((s.combatNow - t0) / 1000)) };
    }, [G, CLEAR]);
    ck('诸葛亮：Lv1 打 1-1 首领 12 秒有明显伤害（审查基线 1-1 首领掉血 0%）', r2.boss && r2.lostPct >= 5, r2);
    // 3) 谋略满层 2：两次烧到 3 人以上的战旗后，下一面战旗强化（范围 +25%、灼烧）
    const r3 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; eval(C); await wait(300); for (const e of s.enemies) if (e.active && e.kind === 'boss') e.deactivate();
      pl.passive.reset('zhuge', s.combatNow); for (let i = 0; i < 5; i++) mk(pl.x + 100 + (i % 2) * 20, pl.y - 30 + i * 15);
      const max = pl.passive.snapshot(s.combatNow).maxStacks, tr0 = pl.passive.snapshot(s.combatNow).triggers, seen = [];
      for (let k = 0; k < 3; k++) { w.cooldownLeft = 0; await wait(700); seen.push(pl.passive.snapshot(s.combatNow).stacks); }
      return { max, seen, triggered: pl.passive.snapshot(s.combatNow).triggers - tr0, label: pl.passive.label(s.combatNow) };
    }, [G, MK, CLEAR]);
    ck('诸葛亮：谋略满 2 层（HUD 2/2），第三面战旗强化', r3.max === 2 && r3.seen[0] === 1 && r3.seen[1] === 2 && r3.triggered === 1, r3);
  }
  await p.close();
}
ck('无报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
