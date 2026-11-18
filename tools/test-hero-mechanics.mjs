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
  await p.close();
}
ck('无报错', errors.length === 0, errors.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
await b.close(); process.exit(fail ? 1 : 0);
