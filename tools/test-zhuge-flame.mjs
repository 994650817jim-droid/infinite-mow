// 诸葛亮烈焰战旗「火攻焚将」（2026-11-16 用户批准加强方案 A）：爆炸对首领 / 精锐伤害 ×1.8，普通小兵不变。
// 电脑布局；关掉暴击，同一位置各放一名精锐、一名步兵，分别在倍率 1 与 1.8 下各炸一次，比较掉血。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-zhuge-flame.mjs
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
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
const r = await p.evaluate(async G0 => {
  const s = eval(G0), pl = s.player, w = pl.weapons[0]; pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; pl.stats.critChance = -1;
  const { PASSIVE_RULES: R } = await import('/src/data/passives.ts');
  const blast = async mul => {
    for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
    await new Promise(r => setTimeout(r, 100)); R.flameEliteMul = mul;
    const mk = (kind, dx) => { const e = s.spawnEnemy(kind, pl.x + 40 + dx, pl.y, 1); e.hp = e.maxHp = 99999; e.stunUntil = 1e12; return e; };
    const el = mk('elite', 0), inf = mk('infantry', 22); w.cooldownLeft = 0; const t0 = performance.now();
    while (performance.now() - t0 < 2500 && (el.hp === el.maxHp || inf.hp === inf.maxHp)) await new Promise(r => setTimeout(r, 15));
    await new Promise(r => setTimeout(r, 60)); w.cooldownLeft = 99; // 只看第一次爆炸
    return { el: el.maxHp - el.hp, inf: inf.maxHp - inf.hp, kind: el.kind };
  };
  const one = await blast(1), boosted = await blast(1.8); R.flameEliteMul = 1.8;
  return { weapon: w.id, one, boosted, eliteRatio: +(boosted.el / one.el).toFixed(3), infRatio: +(boosted.inf / one.inf).toFixed(3), mul: R.flameEliteMul };
}, G);
ck('烈焰战旗「火攻焚将」：精锐受爆炸伤害 ×1.8，普通步兵不变', r.weapon === 'flame_banner' && r.one.kind === 'elite' && Math.abs(r.eliteRatio - 1.8) < .05 && Math.abs(r.infRatio - 1) < .05 && r.mul === 1.8, r);
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
