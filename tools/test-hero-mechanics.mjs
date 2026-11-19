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
  await p.evaluate(([G0, C]) => { const s = eval(G0); s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; eval(C); setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); /* 杀够兵会弹招募，combatNow 会停 */ }, 40); }, [G, CLEAR]);
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
      const Zt = window.__zgTuning, kb0 = Zt.eastWind.knockback.px; Zt.crowdStars = false; Zt.eastWind.knockback.px = 0; // 只量火龙伤害：关掉怪堆积层（第 4 发的星火焦土会烧到路上的兵）和击退（吹进天火溅射圈会多挨一下；击退另在 1e 测），测完恢复
      const boss = mk(pl.x + 330, pl.y, { kind: 'elite' }), lane = [mk(pl.x + 120, pl.y + 8), mk(pl.x + 220, pl.y - 8)], off = mk(pl.x + 150, pl.y + 140);
      const lane0 = []; for (let k = 1; k <= 4; k++) { w.cooldownLeft = 0; await wait(100); w.cooldownLeft = 1e9; await wait(900); lane0.push(lane.map(e => e.maxHp - e.hp)); }
      const one = TIANHUO_DEF.damage(w.level, pl.stats) * pl.growth.damageMultiplier(s.combatNow); pl.growth.masteries.wildfire = 0;
      Zt.crowdStars = true; Zt.eastWind.knockback.px = kb0; return { lane: lane0, off: off.maxHp - off.hp, expect: Math.round(one * .6), wind: lane0[3][0] - lane0[2][0] };
    }, [G, MK, CLEAR]);
    ck('诸葛亮·借东风：连续 4 发里恰好 1 发放出东风火龙，朝怪最密的直线扫过（各 60%），偏离直线的不挨打', (() => { const inc = r1.lane.map((v, i) => v.map((x, j) => x - (i ? r1.lane[i - 1][j] : 0))); const fired = inc.filter(v => v.some(x => x > 0)); return fired.length === 1 && fired[0].every(x => Math.abs(x - r1.expect) <= 2); })() && r1.off === 0 /* 连续 4 发里恰好 1 发放出火龙（第几发取决于之前打过几发） */, r1);
    // 1b) 借东风方向：朝怪最密的方向扫（精锐在东边单个，北边一排 5 个步兵：火龙扫北边那排）
    const r1b = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; pl.damageImmune = true; pl.stats.critChance = -1; eval(C);
      pl.growth.masteries.wildfire = 1; w.cooldownLeft = 1e9; await wait(100);
      const el = mk(pl.x + 300, pl.y, { kind: 'elite' }), north = [1, 2, 3, 4, 5].map(k => mk(pl.x + 6, pl.y - 50 * k));
      for (let k = 0; k < 4; k++) { w.cooldownLeft = 0; await wait(100); w.cooldownLeft = 1e9; await wait(900); }
      pl.growth.masteries.wildfire = 0; return { northHit: north.filter(e => e.hp < e.maxHp).length, el: el.maxHp - el.hp };
    }, [G, MK, CLEAR]);
    ck('诸葛亮·借东风：火龙朝怪最密的方向扫（天火打东边精锐，火龙扫北边一排 5 个）', r1b.northHit >= 4 && r1b.el > 0, r1b);
    // 1c) 清杂兵（2026-11-18 用户：「诸葛亮清小怪偏弱」）：天火余烬 + 没有首领 / 精锐时借东风每第 3 发。同一波杂兵改前 / 改后各打一遍比清怪用时
    const r1c = await p.evaluate(async ([G0, C]) => {
      const s = eval(G0), pl = s.player, wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; pl.damageImmune = true; pl.stats.critChance = -1; eval(C);
      const Z = window.__zgTuning; if (!Z) throw new Error('no __zgTuning'); // 游戏实际在用的那份（热更新后 import 拿到的是另一份）
      const cfg = { mul: Z.ember.mul, every: Z.eastWind.everyCrowd, kb: Z.eastWind.knockback.px };
      // 杀杂兵会升级 / 弹招募：面板一开 combatNow 就停（循环永远等不完）；直接关掉、不选卡，前后两遍构筑一样
      const noLevelUp = () => { if (s.mode === 'levelup') { s.pendingLevels = 0; s.militaryPending = 0; s.setMode('none'); } else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); };
      const wave = async () => { eval(C); w.level = 3; pl.growth.masteries.wildfire = 1; w.cooldownLeft = 1e9; await wait(150);
        const es = []; for (const [cx, cy] of [[230, 0], [-200, 90], [40, -230]]) for (let i = 0; i < 8; i++) { const e = s.spawnEnemy('infantry', pl.x + cx + (i % 3 - 1) * 32, pl.y + cy + (Math.floor(i / 3) - 1) * 28, 1, true); e.hp = e.maxHp = 260; es.push(e); } // 不定身：被东风吹开后会走回来重新扎堆（真实打法），主将免伤
        const t0 = s.combatNow, r0 = Date.now(); w.cooldownLeft = 0; while (es.some(e => e.active) && s.combatNow - t0 < 60000 && Date.now() - r0 < 120000) { noLevelUp(); await wait(50); }
        return { ms: Math.round(s.combatNow - t0), left: es.filter(e => e.active).length, embers: 0, mode: s.mode, realMs: Date.now() - r0 }; };
      Z.ember.mul = 0; Z.eastWind.everyCrowd = 4; Z.crowdStars = false; Z.eastWind.knockback.px = 0; const before = await wave();
      Z.ember.mul = cfg.mul; Z.eastWind.everyCrowd = cfg.every; Z.crowdStars = true; Z.eastWind.knockback.px = cfg.kb; let embers = 0; const watch = setInterval(() => { embers = Math.max(embers, s.children.list.filter(o => o.name === 'zhuge-ember').length); }, 60);
      const after = await wave(); clearInterval(watch);
      // 打首领：同样 12 秒，改前 / 改后首领掉血（余烬不烧首领，有首领时借东风仍每第 4 发）
      const bossRun = async () => { eval(C); w.cooldownLeft = 1e9; await wait(150); s.bossSpawned = false; /* 同一局第二次召首领 */ s.spawnBoss(); const b = s.boss; b.sprite.setPosition(pl.x + 220, pl.y); b.stunUntil = 1e12; b.hp = b.maxHp = 1e6;
        noLevelUp();
        pl.passive.reset('zhuge', s.combatNow); const t0 = s.combatNow, r0 = Date.now(); w.cooldownLeft = 0; while (s.combatNow - t0 < 12000 && Date.now() - r0 < 60000) { noLevelUp(); for (const e of s.enemies) if (e.active && e !== b && !e.isSupplySlot) e.deactivate(); b.sprite.setPosition(pl.x + 220, pl.y); await wait(50); } const d = 1e6 - b.hp; modes.push(s.mode + ' ' + Math.round(s.combatNow - t0) + 'ms/' + (Date.now() - r0) + 'real'); b.deactivate(); return Math.round(d); }; const modes = [];
      Z.ember.mul = 0; Z.eastWind.everyCrowd = 4; Z.crowdStars = false; Z.eastWind.knockback.px = 0; const bossBefore = await bossRun(); Z.ember.mul = cfg.mul; Z.eastWind.everyCrowd = cfg.every; Z.crowdStars = true; Z.eastWind.knockback.px = cfg.kb; const bossAfter = await bossRun();
      pl.growth.masteries.wildfire = 0;
      return { before, after: { ...after, embers }, speedup: +(before.ms / Math.max(1, after.ms)).toFixed(2), bossBefore, bossAfter, bossRatio: +(bossAfter / Math.max(1, bossBefore)).toFixed(3), modes };
    }, [G, CLEAR]);
    ck('诸葛亮·清杂兵：同一波 24 个杂兵，无首领时每发积星象（每第 4 发算无遗策 + 星火焦土）+ 借东风每第 3 发，清完快 1.6 倍以上', r1c.before.left === 0 && r1c.after.left === 0 && r1c.speedup >= 1.6, r1c);
    ck('诸葛亮·打首领：同样 12 秒首领掉血改后 / 改前在 0.9–1.15 倍（星火焦土也烧首领但按 bossMul；借东风有首领时仍每第 4 发）', r1c.bossRatio >= .9 && r1c.bossRatio <= 1.15, r1c);
    // 1d) 余烬只在算无遗策那一发留下（2026-11-18 晚 用户：「只有被动触发后才触发」「范围变大就好」）：半径 160、2 秒、每 0.5 秒 天火 ×25%，只烧杂兵；
    //     没有首领 / 精锐时天火每发都积星象，前三发不留、第 4 发留；借东风放火龙时下面卷起手绘东风 zhuge_wind
    const r1d = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0], Z = window.__zgTuning; pl.damageImmune = true; pl.stats.critChance = -1;
      const heap = cx => { const all = [mk(pl.x + cx, pl.y, { hp: 9000 })]; for (const [dx, dy] of [[30, 0], [-30, 0], [0, 26], [0, -26]]) all.push(mk(pl.x + cx + dx, pl.y + dy, { hp: 9000 })); return all; };
      const shoot = async () => { w.cooldownLeft = 0; await wait(120); w.cooldownLeft = 1e9; await wait(900); };
      const count = () => s.children.list.filter(o => o.name === 'zhuge-ember').length;
      eval(C); w.level = 3; pl.growth.masteries.wildfire = 0; w.cooldownLeft = 1e9; await wait(200); pl.passive.reset('zhuge', s.combatNow);
      // 没有首领 / 精锐：天火每发都积星象（2026-11-18 夜），前三发不留余烬，第 4 发算无遗策留星火焦土；
      // 圈里 150 像素的杂兵（怪堆溅射 90 够不着）挨烧、230 像素的不挨、精锐不挨
      heap(200); const inside = mk(pl.x + 200 + 150, pl.y + 20, { hp: 9000 }), outside = mk(pl.x + 200 + 230, pl.y - 40, { hp: 9000 });
      let plain = 0; for (let k = 0; k < Z.starNeed; k++) { await shoot(); plain = Math.max(plain, count()); }
      const marks3 = pl.passive.crowdStarMarks(s.combatNow), in0 = inside.hp, out0 = outside.hp;
      w.cooldownLeft = 0; await wait(120); w.cooldownLeft = 1e9; await wait(Z.delayMs + 120); const el = mk(pl.x + 200 - 110, pl.y + 40, { kind: 'elite', hp: 9000 }), elHp0 = el.hp; // 落地后才放精锐（有精锐时不按怪堆积层），测「精锐按 bossMul 烧」
      const burstEmber = count(), tex = s.children.list.find(o => o.name === 'zhuge-ember')?.texture?.key ?? null; await wait(Z.ember.ms + 300);
      const res = { plain, burstEmber, tex, marks3, inside: Math.round(in0 - inside.hp), outside: Math.round(out0 - outside.hp), elite: Math.round(elHp0 - el.hp), after: count(), radius: Z.ember.radius, ms: Z.ember.ms };
      // 借东风：没有首领 / 精锐时每第 3 发放火龙，下面卷起手绘东风
      eval(C); pl.growth.masteries.wildfire = 1; heap(200); let wind = 0, dragon = 0; const watch = setInterval(() => { wind = Math.max(wind, s.children.list.filter(o => o.name === 'zhuge-wind').length); dragon = Math.max(dragon, s.children.list.filter(o => o.name === 'zhuge-eastwind').length); }, 30);
      for (let k = 0; k < 3; k++) await shoot(); clearInterval(watch); pl.growth.masteries.wildfire = 0; eval(C);
      return { ...res, wind, dragon };
    }, [G, MK, CLEAR]);
    ck('诸葛亮·余烬：没有首领 / 精锐时天火每发都积星象，前三发不留余烬、第 4 发算无遗策留手绘星火焦土（zhuge_ember）', r1d.plain === 0 && r1d.marks3 === 3 && r1d.burstEmber > 0 && r1d.tex === 'zhuge_ember' && r1d.after === 0, r1d);
    ck('诸葛亮·余烬：谁都烧——半径 160 内的杂兵挨烧（溅射圈外 150 像素也烧到）、精锐也烧（按 bossMul）；圈外 230 像素不挨；烧满 4.5 秒后熄', r1d.inside > 0 && r1d.outside === 0 && r1d.elite > 0 && r1d.after === 0, r1d);
    ck('诸葛亮·借东风：火龙放出时下面卷起手绘东风（zhuge_wind）', r1d.wind > 0 && r1d.dragon > 0, r1d);
    // 1e) 借东风击退（2026-11-18 夜 用户：「借东风有吹风击退效果」）：顺着风向吹开——杂兵约 100、精锐 ×0.4、首领 / 不受控的不动
    const r1e = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0], Z = window.__zgTuning; pl.damageImmune = true; pl.stats.critChance = -1;
      eval(C); w.level = 3; pl.growth.masteries.wildfire = 1; w.cooldownLeft = 1e9; await wait(200); pl.passive.reset('zhuge', s.combatNow);
      // 东边一排（火龙朝怪最密的方向扫，就是东边）：杂兵、精锐、不受控的杂兵（与首领同一条判断）
      const inf = mk(pl.x + 120, pl.y, { hp: 9000 }), inf2 = mk(pl.x + 160, pl.y + 10, { hp: 9000 }), el = mk(pl.x + 200, pl.y - 8, { kind: 'elite', hp: 9000 }), im = mk(pl.x + 240, pl.y + 6, { hp: 9000 }); im.controlImmune = true;
      const list = [inf, inf2, el, im]; let out = null;
      for (let k = 0; k < 6 && !out; k++) {
        const before = list.map(e => e.x); let dragon = false; const watch = setInterval(() => { if (s.children.list.some(o => o.name === 'zhuge-eastwind')) dragon = true; }, 20);
        w.cooldownLeft = 0; await wait(120); w.cooldownLeft = 1e9; await wait(500); clearInterval(watch);
        if (dragon) out = list.map((e, i) => Math.round(e.x - before[i]));
      }
      pl.growth.masteries.wildfire = 0; eval(C);
      return { push: out, px: Z.eastWind.knockback.px, eliteMul: Z.eastWind.knockback.eliteMul };
    }, [G, MK, CLEAR]);
    const [kInf, kInf2, kEl, kIm] = r1e.push ?? [];
    ck('诸葛亮·借东风击退：火龙扫过把杂兵顺风吹开约 100（80–125）、精锐约 40（25–60）、不受控的不动（首领同理）', !!r1e.push && kInf >= 80 && kInf <= 125 && kInf2 >= 80 && kInf2 <= 125 && kEl >= 25 && kEl <= 60 && Math.abs(kIm) <= 3, r1e);
    // 2b) 八阵图伤害（2026-11-18 夜 用户：「八阵图也会造成伤害」）：阵内每 0.5 秒受天火 × bazhen.mul（首领 / 精锐 × bossMul），每跳阵纹亮一下；
    //     同一波杂兵 / 同样 12 秒首领，八阵图 3 级下「阵不伤人」与「阵伤人」各打一遍
    const r2b = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0], Z = window.__zgTuning; pl.damageImmune = true; pl.stats.critChance = -1; eval(C);
      const noLevelUp = () => { if (s.mode === 'levelup') { s.pendingLevels = 0; s.militaryPending = 0; s.setMode('none'); } else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); };
      const mul0 = [...Z.bazhen.mul], ember0 = Z.ember.mul, off = () => { Z.bazhen.mul = [0, 0, 0]; }, on = () => { Z.bazhen.mul = mul0; };
      // (a) 布阵后放进一个杂兵、一个精锐（溅射早已结算；关掉星火焦土只量阵）：都挨跳伤，精锐少；阵纹每跳提亮
      Z.ember.mul = 0; w.level = 3; pl.growth.masteries.eight_trigrams = 3; pl.growth.masteries.wildfire = 0; w.cooldownLeft = 1e9; await wait(150); pl.passive.reset('zhuge', s.combatNow);
      mk(pl.x + 220, pl.y, { hp: 99999 }); for (let k = 0; k < 4; k++) { w.cooldownLeft = 0; await wait(110); w.cooldownLeft = 1e9; await wait(k < 3 ? 900 : Z.delayMs + 120); }
      const zfx = s.children.list.find(o => o.name === 'zhuge-bazhen'); let a = null;
      if (zfx) { const zx = zfx.x, zy = zfx.y - 6, inf = mk(zx + 100, zy - 10, { hp: 99999 }), el = mk(zx - 100, zy + 10, { kind: 'elite', hp: 99999 }); let maxA = 0, minA = 1;
        const t0 = s.combatNow; while (s.combatNow - t0 < 3200) { if (zfx.active) { maxA = Math.max(maxA, zfx.alpha); minA = Math.min(minA, zfx.alpha); } await wait(30); }
        a = { inf: Math.round(inf.maxHp - inf.hp), el: Math.round(el.maxHp - el.hp), maxA: +maxA.toFixed(2), minA: +minA.toFixed(2) }; }
      Z.ember.mul = ember0; eval(C);
      // (b) 同一波 24 个杂兵（会走），八阵图 3 级 + 借东风 1 级
      const wave = async () => { eval(C); w.level = 3; pl.growth.masteries.wildfire = 1; pl.growth.masteries.eight_trigrams = 3; w.cooldownLeft = 1e9; await wait(150); pl.passive.reset('zhuge', s.combatNow);
        const es = []; for (const [cx, cy] of [[230, 0], [-200, 90], [40, -230]]) for (let i = 0; i < 8; i++) { const e = s.spawnEnemy('infantry', pl.x + cx + (i % 3 - 1) * 32, pl.y + cy + (Math.floor(i / 3) - 1) * 28, 1, true); e.hp = e.maxHp = 260; es.push(e); }
        const t0 = s.combatNow, r0 = Date.now(); w.cooldownLeft = 0; while (es.some(e => e.active) && s.combatNow - t0 < 60000 && Date.now() - r0 < 120000) { noLevelUp(); await wait(50); }
        return { ms: Math.round(s.combatNow - t0), left: es.filter(e => e.active).length }; };
      off(); const waveOff = await wave(); on(); const waveOn = await wave();
      // (c) 同样 12 秒首领（八阵图 3 级）
      const bossRun = async () => { eval(C); w.cooldownLeft = 1e9; pl.growth.masteries.wildfire = 1; pl.growth.masteries.eight_trigrams = 3; await wait(150); s.bossSpawned = false; s.spawnBoss(); const b = s.boss; b.sprite.setPosition(pl.x + 220, pl.y); b.stunUntil = 1e12; b.hp = b.maxHp = 1e6; noLevelUp();
        pl.passive.reset('zhuge', s.combatNow); const t0 = s.combatNow, r0 = Date.now(); w.cooldownLeft = 0;
        while (s.combatNow - t0 < 12000 && Date.now() - r0 < 60000) { noLevelUp(); for (const e of s.enemies) if (e.active && e !== b && !e.isSupplySlot) e.deactivate(); b.sprite.setPosition(pl.x + 220, pl.y); await wait(50); }
        const d = 1e6 - b.hp; b.deactivate(); return Math.round(d); };
      off(); const bossOff = await bossRun(); on(); const bossOn = await bossRun();
      pl.growth.masteries.wildfire = 0; pl.growth.masteries.eight_trigrams = 0; eval(C);
      return { zone: a, waveOff, waveOn, speedup: +(waveOff.ms / Math.max(1, waveOn.ms)).toFixed(2), bossOff, bossOn, bossRatio: +(bossOn / Math.max(1, bossOff)).toFixed(3), mul: mul0, bossMul: Z.bazhen.bossMul };
    }, [G, MK, CLEAR]);
    ck('诸葛亮·八阵图伤害：阵内杂兵、精锐都挨跳伤（精锐按 bossMul 更少），每跳手绘阵纹提亮', !!r2b.zone && r2b.zone.inf > 0 && r2b.zone.el > 0 && r2b.zone.el < r2b.zone.inf && r2b.zone.maxA >= .95 && r2b.zone.minA <= .8, r2b);
    ck('诸葛亮·八阵图伤害：同一波杂兵清得不比阵不伤人慢；同样 12 秒首领掉血 ≤ 1.1 倍', r2b.waveOff.left === 0 && r2b.waveOn.left === 0 && r2b.speedup >= 1 && r2b.bossRatio >= .95 && r2b.bossRatio <= 1.1, r2b);
    // 2) 八阵图 3 级：观星爆发处布阵——阵内步兵减速、受伤 +15%；阵内首领出招间隔 ×1.25（gapSlow）
    const r2 = await p.evaluate(async ([G0, MK0, C]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK0), wait = ms => new Promise(r => setTimeout(r, ms)), w = pl.weapons[0]; pl.damageImmune = true; pl.stats.critChance = -1; eval(C);
      pl.growth.masteries.eight_trigrams = 3; w.cooldownLeft = 1e9; await wait(100); pl.passive.reset('zhuge', s.combatNow);
      s.bossSpawned = false; s.spawnBoss(); const boss = s.boss; boss.sprite.setPosition(pl.x + 260, pl.y); boss.stunUntil = 1e12; boss.hp = boss.maxHp = 1e6;
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
