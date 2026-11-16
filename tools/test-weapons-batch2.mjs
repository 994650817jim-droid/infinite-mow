// 第二批专属武器（2026-11-16）：黄忠宝雕弓、张飞当阳喝断、马超虎头湛金枪、刘备双股剑。
// 手机 390×844 与电脑 1280×720 各跑一遍；检查武器机制与被动招牌技；全程无 pageerror / console error。截图 assets/review/weapons-batch2/。
// 用法：BASE=http://127.0.0.1:5173/ node tools/test-weapons-batch2.mjs [heroId...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/weapons-batch2';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const ALL = { huangzhong: { name: '黄忠', weapon: 'baodiao_bow' }, zhangfei: { name: '张飞', weapon: 'dangyang_roar' }, machao: { name: '马超', weapon: 'zhanjin_lance' }, liubei: { name: '刘备', weapon: 'shuanggu_swords' } };
const only = process.argv.slice(2), HEROES = Object.fromEntries(Object.entries(ALL).filter(([k]) => !only.length || only.includes(k)));
const LAYOUTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 720 } };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(tag + ' ' + m.text()); }); };

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
  const st = await p.evaluate(G0 => { const s = eval(G0), pl = s.player; return { weapon: pl.weapons[0].id, passive: pl.passive.snapshot(s.combatNow).character, actions: pl.hasActions }; }, G);
  ck(`${tag}：专属本命武器 ${h.weapon}、专属被动`, st.weapon === h.weapon && st.passive === hero && st.actions, st);
  // 在页面里 eval 成函数：(x, y, stun) 生成高血量步兵，默认定身
  const mk = "(x, y, stun = true) => { const e = s.spawnEnemy('infantry', x, y, 1); if (e) { e.hp = e.maxHp = 99999; if (stun) e.stunUntil = 1e12; } return e; }";

  if (hero === 'huangzhong') {
    // 统一索敌：近处落单的敌人不打，先打远处的敌群（首领 > 精锐 > 群怪 > 最近）；重箭单体、击退；神射（5 秒不受伤）时命中处爆裂波及同群
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const near = mk(pl.x + 140, pl.y), group = [mk(pl.x + 450, pl.y), mk(pl.x + 430, pl.y + 34), mk(pl.x + 430, pl.y - 34)];
      const pos = group.map(e => [e.x, e.y]); const t0 = performance.now(); let first = null, pins = [];
      while (performance.now() - t0 < 10000) {
        await new Promise(r => setTimeout(r, 30));
        const hit = group.findIndex(e => e.hp < e.maxHp);
        if (!first && (hit >= 0 || near.hp < near.maxHp)) { const e = group[hit]; first = { near: near.maxHp - near.hp, group: hit >= 0 ? e.maxHp - e.hp : 0, pushed: hit >= 0 ? Math.round(Math.hypot(e.x - pos[hit][0], e.y - pos[hit][1])) : 0 };
          pins = group.map((e, i) => setInterval(() => { e.sprite.x = pos[i][0]; e.sprite.y = pos[i][1]; }, 10)); } // 量完击退后钉回原位，验证神射爆裂
        if (group.filter(e => e.hp < e.maxHp).length >= 2) break;
      }
      pins.forEach(clearInterval);
      return { first, groupHurt: group.filter(e => e.hp < e.maxHp).length, sharp: pl.passive.isSharpshooter(s.combatNow) };
    }, [G, mk]);
    ck(`${tag}：重箭先打远处敌群而不是近处落单的（单体、击退），神射时爆裂波及同群`, r.first && r.first.near === 0 && r.first.group > 0 && r.first.pushed >= 20 && r.groupHurt >= 2, r);
  } else if (hero === 'zhangfei') {
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const a = mk(pl.x + 110, pl.y), d0 = Math.hypot(a.x - pl.x, a.y - pl.y); let wave = false, spear = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 30)); wave = wave || !!s.children.getByName('zhangfei-wave'); spear = spear || !!s.children.getByName('zhangfei-spear'); if (a.hp < a.maxHp) { await new Promise(r => setTimeout(r, 400)); break; } }
      return { wave, spear, hurt: a.maxHp - a.hp, pushed: Math.round(Math.hypot(a.x - pl.x, a.y - pl.y) - d0) };
    }, [G, mk]);
    ck(`${tag}：挥蛇矛（矛影）打出声浪，向前推进、伤害并把敌人推后`, r.wave && r.spear && r.hurt > 0 && r.pushed >= 15, r);
    const br = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const ins = mk(pl.x - 60, pl.y + 20, false), far = mk(pl.x + 130, pl.y); pl.passive.stacks = 5; let bridge = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 30)); if (s.children.getByName('zhangfei-bridge')) { bridge = true; await new Promise(r => setTimeout(r, 400)); break; } }
      const bx = pl.x, by = pl.y; return { bridge, insideDist: Math.round(Math.hypot(ins.x - bx, ins.y - by)), stunned: ins.stunUntil > s.combatNow, triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, [G, mk]);
    ck(`${tag}：怒气满层「据水断桥」——震慑周围，断桥区把敌人挡在外面`, br.bridge && br.stunned && br.insideDist >= 140 && br.triggers >= 1, br);
  } else if (hero === 'machao') {
    // 枪挑：目标被挑飞（定身 + 上浮），落地砸出范围伤害波及旁边
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const t = mk(pl.x + 100, pl.y, false), side = mk(pl.x + 140, pl.y + 20); const y0 = t.sprite.y; let lifted = 0, land = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 20)); lifted = Math.max(lifted, y0 - t.sprite.y); land = land || !!s.children.getByName('machao-land'); if (land && side.hp < side.maxHp) break; }
      return { lifted: Math.round(lifted), land, targetHurt: t.maxHp - t.hp, sideHurt: side.maxHp - side.hp };
    }, [G, mk]);
    ck(`${tag}：一枪挑飞目标，落地砸出范围伤害`, r.lifted >= 20 && r.land && r.targetHurt > 0 && r.sideHurt > 0, r);
    // 西凉铁骑满层：下一枪化为向前冲锋（主将突进）
    const c = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
      await new Promise(r => setTimeout(r, 1500)); mk(pl.x + 120, pl.y); const x0 = pl.x; pl.passive.stacks = 6; let charge = false, moved = 0; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 20)); charge = charge || !!s.children.getByName('machao-charge'); moved = Math.max(moved, pl.x - x0); if (charge && moved >= 120) break; }
      return { charge, moved: Math.round(moved), triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, [G, mk]);
    ck(`${tag}：铁骑满层，下一枪化为锦马冲锋（向前突进 ≥120 像素）`, c.charge && c.moved >= 120 && c.triggers >= 1, c);
  } else {
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const l = mk(pl.x - 80, pl.y), rr = mk(pl.x + 80, pl.y); let cross = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 20)); cross = cross || !!s.children.getByName('liubei-cross') || !!s.children.getByName('hero-fx-crossSlash'); if (l.hp < l.maxHp && rr.hp < rr.maxHp) break; }
      return { left: l.maxHp - l.hp, right: rr.maxHp - rr.hp, cross, stacks: pl.passive.snapshot(s.combatNow).stacks };
    }, [G, mk]);
    ck(`${tag}：双剑同时斩中左右两名敌人（「×」交叉斩），积仁德`, r.left > 0 && r.right > 0 && r.cross && r.stacks >= 1, r);
    const heal = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player; pl.hp = Math.round(pl.maxHp * .5); const h0 = pl.hp; pl.passive.stacks = 4; let haste = false; const t0 = performance.now(); while (performance.now() - t0 < 3000 && pl.hp <= h0 + 1) await new Promise(r => setTimeout(r, 20)); await new Promise(r => setTimeout(r, 30)); haste = !!s.children.getByName('liubei-haste'); const cd = pl.weapons[0].cooldownLeft; return { healed: Math.round(pl.hp - h0), triggers: pl.passive.snapshot(s.combatNow).triggers, haste, cd: +cd.toFixed(2) }; }, G);
    ck(`${tag}：仁德满层，出剑时回复自身并攻速 +30%（间隔 ≤0.8 秒）`, heal.healed > 0 && heal.triggers >= 1 && heal.haste && heal.cd <= .8, heal);
  }
  await sleep(120);
  await p.screenshot({ path: `${out}/${hero}-battle-${layout}.png` });
  await p.close();
}
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
