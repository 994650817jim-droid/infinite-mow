// 诸葛亮「七星灯 · 天火」（2026-11-18 重做，用户选方案 A；原「烈焰战旗 · 火攻焚将」用例换掉）：
// 星位 → 0.8 秒后落下、星位跟着目标；单体约旧单发 2.5 倍；溅射打杂兵 90 内 40%、打首领 / 精锐 50 内 30%；
// 选靶（2026-11-18 用户「打不到集群的怪堆」后改）：首领 / 精锐单点，没有时打进怪堆中心（smartTarget 群怪规则）；观星第 4 发必暴击 ×2；智力每点天火 +1.5%。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5173/ node tools/test-zhuge-flame.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'zhuge', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'zhuge' && s.__DEV_ACTIONS; }, null, { timeout: 20000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms));
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; return e; };
  const { TIANHUO_DEF } = await import('/src/weapons/zhugeTianhuo.ts'); const Z = window.__zgTuning; if (!Z) throw new Error('no __zgTuning'); /* 游戏实际在用的那份（热更新后 import 拿到的是另一份） */
  Z.ember.mul = 0; // 天火余烬（2026-11-18）另在 test-hero-mechanics 1c 测；这里只量天火本身，免得上一发的余烬烧到下一发新刷的兵
  const one = () => TIANHUO_DEF.damage(w.level, pl.stats) * pl.growth.damageMultiplier(s.combatNow) * (1 + Z.intPerPoint * pl.growth.attributes.intellect);`;

// 1) 星位 → 0.8 秒后落下；单体伤害、溅射
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); pl.passive.reset('zhuge', s.combatNow); w.cooldownLeft = 1e9; await wait(150);
  const t = mk('infantry', pl.x + 240, pl.y), side = mk('infantry', pl.x + 270, pl.y + 10); const exp = one();
  w.cooldownLeft = 0; const t0 = s.combatNow; let markAt = -1, hitAt = -1;
  while (s.combatNow - t0 < 2000 && hitAt < 0) { await wait(15); if (markAt < 0 && s.children.getByName('zhuge-star-mark')) markAt = s.combatNow - t0; if (t.hp < t.maxHp) hitAt = s.combatNow - t0; }
  w.cooldownLeft = 1e9; await wait(80);
  return { name: TIANHUO_DEF.name, weapon: w.id, markAt: Math.round(markAt), hitAt: Math.round(hitAt), main: t.maxHp - t.hp, exp: Math.round(exp), splash: side.maxHp - side.hp, markGone: !s.children.getByName('zhuge-star-mark'), oldLv1: 22 };
})()`);
ck('天火：武器名「七星灯 · 天火」（id 仍为 flame_banner）', r1.name === '七星灯 · 天火' && r1.weapon === 'flame_banner', r1);
ck('天火：先在目标脚下标星位，约 0.8 秒后才落下（之前不掉血），落下后星位消失', r1.markAt >= 0 && r1.markAt < 200 && r1.hitAt >= 750 && r1.hitAt <= 1000 && r1.markGone, r1);
ck('天火：单体伤害与公式一致（基础 × 伤害倍率 × 智力）', Math.abs(r1.main - r1.exp) <= 1, r1);
const r1b = await p.evaluate(`(async () => { ${H} return { ratio: +(TIANHUO_DEF.damage(1, pl.stats) / (22 * pl.stats.damageMul * pl.stats.fireMul)).toFixed(3) }; })()`);
ck('天火：Lv1 基础伤害 = 旧烈焰战旗 Lv1 基础 ×2.5', Math.abs(r1b.ratio - 2.5) < .01, r1b);
ck('天火：打杂兵时溅射到身边敌人 40%（怪堆溅射）', Math.abs(r1.splash - Math.round(r1.exp * .4)) <= 1, r1);

// 2) 星位跟着目标走：标完后把目标挪开 120 像素，天火仍落在它身上
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); const t = mk('infantry', pl.x + 200, pl.y);
  w.cooldownLeft = 0; await wait(150); w.cooldownLeft = 1e9; t.sprite.y += 120; await wait(900);
  return { hit: t.maxHp - t.hp };
})()`);
ck('天火：星位跟着目标走（标记后目标走开 120 像素仍被命中）', r2.hit > 0, r2);

// 3) 选靶（2026-11-18 改）：有首领 / 精锐时单点；没有时打进怪堆中心（身边 80 内同伴最多），溅射 90 内 40% 覆盖整堆
const r3 = await p.evaluate(`(async () => { ${H}
  const shot = async (spec) => { clear(); w.cooldownLeft = 1e9; await wait(120); const es = spec.map(([k, dx, dy, hp]) => mk(k, pl.x + dx, pl.y + dy, hp));
    w.cooldownLeft = 0; await wait(150); w.cooldownLeft = 1e9; await wait(900); return es.map(e => e.maxHp - e.hp); };
  // 怪堆：离群的高血步兵（近）+ 7 个一堆（远，中心那个在 (300, 0)）
  const heap = [[0, 0], [40, 0], [-40, 0], [0, 40], [0, -40], [30, 30], [-30, -30]];
  const crowd = await shot([['infantry', 110, 0, 9000], ...heap.map(([x, y]) => ['infantry', 300 + x, 120 + y, 3000])]);
  // 同样的怪堆旁边加一个精锐：锁精锐，不打怪堆
  const withElite = await shot([['elite', 160, -120, 3000], ...heap.map(([x, y]) => ['infantry', 300 + x, 120 + y, 3000])]);
  return { lone: crowd[0], heap: crowd.slice(1), heapHit: crowd.slice(1).filter(v => v > 0).length, center: crowd[1], eliteHit: withElite[0], heapWithElite: withElite.slice(1).filter(v => v > 0).length, one: Math.round(one()) };
})()`);
ck('天火：没有首领 / 精锐时不打离群的高血兵，打进怪堆中心（中心那个吃整发）', r3.lone === 0 && Math.abs(r3.center - r3.one) <= 1, r3);
ck('天火：怪堆溅射（90 内 40%）覆盖整堆 7 个', r3.heapHit === 7 && r3.heap.slice(1).every(v => Math.abs(v - Math.round(r3.one * .4)) <= 1), r3);
ck('天火：有精锐时仍锁精锐单点，怪堆不挨打', r3.eliteHit > 0 && r3.heapWithElite === 0, r3);
// 打首领 / 精锐时溅射维持小范围（50 内 30%）：精锐身边 40 的步兵挨 30%，80 外的不挨
const r3b = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); const el = mk('elite', pl.x + 220, pl.y), near = mk('infantry', pl.x + 260, pl.y), far = mk('infantry', pl.x + 300, pl.y);
  w.cooldownLeft = 0; await wait(150); w.cooldownLeft = 1e9; await wait(900);
  return { el: el.maxHp - el.hp, near: near.maxHp - near.hp, far: far.maxHp - far.hp, ratio: +((near.maxHp - near.hp) / (el.maxHp - el.hp)).toFixed(2) };
})()`);
ck('天火：打精锐时溅射维持 50 内 30%（40 像素的步兵挨 30%，80 像素的不挨）', r3b.el > 0 && Math.abs(r3b.ratio - .3) < .03 && r3b.far === 0, r3b);

// 4) 观星：同一目标第 4 发必暴击 ×2
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); pl.passive.reset('zhuge', s.combatNow); w.cooldownLeft = 1e9; await wait(120); const { BALANCE } = await import('/src/config.ts');
  const t = mk('infantry', pl.x + 220, pl.y), hits = [], marks = [];
  for (let k = 0; k < 4; k++) { const h0 = t.hp; w.cooldownLeft = 0; await wait(100); w.cooldownLeft = 1e9; await wait(900); hits.push(h0 - t.hp); marks.push(pl.passive.starMarks(t, s.combatNow)); }
  return { hits, marks, ratio: +(hits[3] / hits[0]).toFixed(2), expect: 2 * BALANCE.critMultiplier, label: pl.passive.label(s.combatNow) };
})()`);
ck('观星：前三发逐层积星象 1/2/3，第 4 发算无遗策（必暴击 × 伤害 ×2）后清层', r4.marks.join() === '1,2,3,0' && Math.abs(r4.ratio - r4.expect) < .08, r4);

// 5) 智力：天火每点 +1.5%（另外法术伤害照常）
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120); const g = pl.growth;
  const shot = async () => { pl.passive.reset('zhuge', s.combatNow); const t = mk('infantry', pl.x + 220, pl.y); w.cooldownLeft = 0; await wait(100); w.cooldownLeft = 1e9; await wait(900); const d = t.maxHp - t.hp; t.deactivate(); return d; };
  const base = await shot(), m0 = g.damageMultiplier(s.combatNow), sp0 = g.spellWeaponMultiplier('flame_banner'); g.attributes.intellect = 10; const m10 = g.damageMultiplier(s.combatNow), sp10 = g.spellWeaponMultiplier('flame_banner'); const smart = await shot(); g.attributes.intellect = 0;
  return { base, smart, ratio: +(smart / base).toFixed(3), expect: +((m10 / m0) * (sp10 / sp0) * 1.15).toFixed(3), spell: +(sp10 / sp0).toFixed(3) };
})()`);
ck('天火：智力 10 点额外 +15%（与法术伤害加成相乘）', Math.abs(r5.smart - r5.base * r5.expect) <= 2 /* 掉血是整数，按绝对值比 */, r5);

ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
