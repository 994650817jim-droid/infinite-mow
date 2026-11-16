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
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const near = mk(pl.x + 140, pl.y), far = mk(pl.x + 470, pl.y), side = mk(pl.x + 440, pl.y + 30);
      const x0 = far.x, y0 = far.y; const t0 = performance.now(); let first = null, pin = 0;
      while (performance.now() - t0 < 9000) {
        await new Promise(r => setTimeout(r, 30));
        if (!first && (near.hp < near.maxHp || far.hp < far.maxHp)) { first = { near: near.maxHp - near.hp, far: far.maxHp - far.hp, pushed: Math.round(far.x - x0) }; pin = setInterval(() => { far.sprite.x = x0; far.sprite.y = y0; }, 10); } // 量完击退后把目标钉回原位，好验证神射爆裂
        if (side.hp < side.maxHp) break;
      }
      clearInterval(pin);
      return { first, sideHurt: side.maxHp - side.hp, sharp: pl.passive.isSharpshooter(s.combatNow) };
    }, [G, mk]);
    ck(`${tag}：重箭先打最远的敌人（单体、击退），神射时命中处爆裂波及旁边`, r.first && r.first.far > 0 && r.first.near === 0 && r.first.pushed >= 20 && r.sideHurt > 0, r);
  } else if (hero === 'zhangfei') {
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const a = mk(pl.x + 110, pl.y), d0 = Math.hypot(a.x - pl.x, a.y - pl.y); let wave = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 30)); wave = wave || !!s.children.getByName('zhangfei-wave'); if (a.hp < a.maxHp) { await new Promise(r => setTimeout(r, 400)); break; } }
      return { wave, hurt: a.maxHp - a.hp, pushed: Math.round(Math.hypot(a.x - pl.x, a.y - pl.y) - d0) };
    }, [G, mk]);
    ck(`${tag}：声浪向前推进，伤害并把敌人推后`, r.wave && r.hurt > 0 && r.pushed >= 15, r);
    const br = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const ins = mk(pl.x - 60, pl.y + 20, false), far = mk(pl.x + 130, pl.y); pl.passive.stacks = 5; let bridge = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 30)); if (s.children.getByName('zhangfei-bridge')) { bridge = true; await new Promise(r => setTimeout(r, 400)); break; } }
      const bx = pl.x, by = pl.y; return { bridge, insideDist: Math.round(Math.hypot(ins.x - bx, ins.y - by)), stunned: ins.stunUntil > s.combatNow, triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, [G, mk]);
    ck(`${tag}：怒气满层「据水断桥」——震慑周围，断桥区把敌人挡在外面`, br.bridge && br.stunned && br.insideDist >= 140 && br.triggers >= 1, br);
  } else if (hero === 'machao') {
    await p.evaluate(([G0, MK]) => { const s = eval(G0), pl = s.player; const mk = eval(MK); window.__line = []; for (let i = 0; i < 6; i++) window.__line.push(mk(pl.x + 90 + i * 70, pl.y)); }, [G, mk]);
    await p.mouse.click(viewport.width / 2, 40).catch(() => {});
    await p.keyboard.down('KeyD'); await sleep(2900);
    const r = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player; let riders = 0; const t0 = performance.now();
      while (performance.now() - t0 < 1500) { await new Promise(r => setTimeout(r, 30)); riders = Math.max(riders, s.children.list.filter(o => o.name === 'machao-rider').length); if (riders >= 3) break; }
      return { hurt: window.__line.filter(e => e.hp < e.maxHp).length, riders, gains: pl.passive.snapshot(s.combatNow).gains, triggers: pl.passive.snapshot(s.combatNow).triggers }; }, G);
    await p.keyboard.up('KeyD');
    ck(`${tag}：边跑边用骑枪刺中沿路敌人；移动积满铁骑，召 3 名西凉骑兵冲阵`, r.hurt >= 3 && r.riders >= 3 && r.triggers >= 1, r);
    const stand = await p.evaluate(async ([G0, MK]) => { const s = eval(G0), pl = s.player; const mk = eval(MK); const e = mk(pl.x, pl.y + 70); const t0 = performance.now(); while (performance.now() - t0 < 3000 && e.hp === e.maxHp) await new Promise(r => setTimeout(r, 30)); return { hurt: e.maxHp - e.hp }; }, [G, mk]);
    ck(`${tag}：站定时向身边的敌人补一记短刺`, stand.hurt > 0, stand);
  } else {
    const r = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK);
      const l = mk(pl.x - 80, pl.y), rr = mk(pl.x + 80, pl.y); let cross = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 20)); cross = cross || !!s.children.getByName('liubei-cross'); if (l.hp < l.maxHp && rr.hp < rr.maxHp) break; }
      return { left: l.maxHp - l.hp, right: rr.maxHp - rr.hp, cross, stacks: pl.passive.snapshot(s.combatNow).stacks };
    }, [G, mk]);
    ck(`${tag}：双剑同时斩中左右两名敌人（「×」交叉斩），积仁德`, r.left > 0 && r.right > 0 && r.cross && r.stacks >= 1, r);
    const heal = await p.evaluate(async G0 => { const s = eval(G0), pl = s.player; pl.hp = Math.round(pl.maxHp * .5); const h0 = pl.hp; pl.passive.stacks = 4; const t0 = performance.now(); while (performance.now() - t0 < 3000 && pl.hp <= h0 + 1) await new Promise(r => setTimeout(r, 30)); return { healed: Math.round(pl.hp - h0), triggers: pl.passive.snapshot(s.combatNow).triggers }; }, G);
    ck(`${tag}：仁德满层，出剑时回复自身生命`, heal.healed > 0 && heal.triggers >= 1, heal);
  }
  await sleep(120);
  await p.screenshot({ path: `${out}/${hero}-battle-${layout}.png` });
  await p.close();
}
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
