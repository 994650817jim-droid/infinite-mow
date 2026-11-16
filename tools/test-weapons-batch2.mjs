// 第二批专属武器（2026-11-16）：黄忠宝雕弓、张飞当阳喝断、马超虎头湛金枪、刘备双股剑。
// 手机 390×844 与电脑 1280×720 各跑一遍；检查武器机制与被动招牌技；全程无 pageerror / console error。截图 assets/review/weapons-batch2/。
// 用法：BASE=http://127.0.0.1:5173/ [LAYOUT=desktop|mobile] node tools/test-weapons-batch2.mjs [heroId...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/weapons-batch2';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 420) : '')); };
const ALL = { huangzhong: { name: '黄忠', weapon: 'baodiao_bow' }, zhangfei: { name: '张飞', weapon: 'dangyang_roar' }, machao: { name: '马超', weapon: 'zhanjin_lance' }, liubei: { name: '刘备', weapon: 'shuanggu_swords' } };
const only = process.argv.slice(2), HEROES = Object.fromEntries(Object.entries(ALL).filter(([k]) => !only.length || only.includes(k)));
const LAYOUTS = Object.fromEntries(Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 720 } }).filter(([k]) => !process.env.LAYOUT || process.env.LAYOUT === k));
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
    // 2026-11-16 方案 C「老当益壮」：静心缩短进入神射时间；3 级神射第一箭扇形三连重箭（像素爆裂）
    const jx = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK), calm = [];
      for (const lvl of [0, 1, 2, 3]) { pl.growth.masteries.jingxin = lvl; await new Promise(r => setTimeout(r, 120)); calm.push(pl.passive.sharpCalmMs); }
      for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      for (let i = 0; i < 5; i++) mk(pl.x + 320, pl.y - 80 + i * 40);
      pl.passive.onDamage(s.combatNow); pl.weapons[0].cooldownLeft = 0; await new Promise(r => setTimeout(r, 200));
      pl.passive.grantSharp(s.combatNow, 0); // 直接进入神射（等同不受伤满 3.5 秒）
      let most = 0, burst = false, enter = false; const t0 = performance.now();
      while (performance.now() - t0 < 3000) { await new Promise(r => setTimeout(r, 15)); most = Math.max(most, s.children.list.filter(o => o.name === 'huangzhong-heavy-arrow' && o.active).length); burst = burst || !!s.children.getByName('huangzhong-burst'); enter = enter || !!s.children.getByName('huangzhong-sharp-enter'); }
      return { calm, most, burst, enter, fx: s.textures.exists('huangzhong_fx') };
    }, [G, mk]);
    ck(`${tag}：静心——进入神射 5 → 4.5/4/3.5 秒；3 级神射第一箭扇形三连重箭，带像素爆裂与进入神射金光`, jx.calm.join() === '5000,4500,4000,3500' && jx.most >= 3 && (!jx.fx || (jx.burst && jx.enter)), jx);
    // 老骥伏枥（用户：「不靠残血触发」）：越战越勇——本关每击杀 10 名敌人射速 +2.5%（上限 15/20/25%）；残血不再加速。
    // 3 级「宝刀未老」：神射中射杀精锐 / 首领回复 4% 生命，2 秒内受伤不退出神射
    const lj = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK), w = pl.weapons[0]; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      const { PASSIVE_RULES: R, } = await import('/src/data/passives.ts'), { BAODIAO_DEF } = await import('/src/weapons/heroWeapons2.ts');
      // 射速：看出手后的冷却。先把击杀数归零看基础冷却，再用 passive.onKill 记 100 次击杀
      const cdAfterShot = async () => { mk(pl.x + 300, pl.y); w.cooldownLeft = 0; const t0 = performance.now(); while (performance.now() - t0 < 1500 && w.cooldownLeft <= 0) await new Promise(r => setTimeout(r, 10)); const cd = w.cooldownLeft; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); return cd; };
      pl.growth.masteries.laoji = 1; pl.hp = Math.round(pl.maxHp * .3); const lowHpNoKills = await cdAfterShot(); pl.growth.masteries.laoji = 0; const base = await cdAfterShot(); pl.hp = pl.maxHp;
      for (let i = 0; i < 100; i++) pl.passive.onKill('infantry', s.combatNow);
      const fast = []; for (const lvl of [1, 2, 3]) { pl.growth.masteries.laoji = lvl; fast.push(await cdAfterShot()); }
      // 宝刀未老：神射中射杀精锐
      pl.hp = Math.round(pl.maxHp * .5); const hp0 = pl.hp; pl.passive.grantSharp(s.combatNow, 0);
      const el = s.spawnEnemy('elite', pl.x + 200, pl.y, 1); if (el) { el.hp = 1; el.stunUntil = 1e12; } w.cooldownLeft = 0;
      const t0 = performance.now(); while (performance.now() - t0 < 3000 && el?.active) await new Promise(r => setTimeout(r, 20));
      await new Promise(r => setTimeout(r, 100)); const healed = pl.hp - hp0, text = !!s.children.getByName('huangzhong-laoji-text');
      pl.passive.onDamage(s.combatNow); const keptAfterHit = pl.passive.isSharpshooter(s.combatNow); pl.hp = pl.maxHp;
      return { base: +base.toFixed(3), lowHpNoKills: +lowHpNoKills.toFixed(3), fast: fast.map(v => +v.toFixed(3)), ratio: fast.map(v => +(base / v).toFixed(3)), killed: !el?.active, healed, text, keptAfterHit };
    }, [G, mk]);
    ck(`${tag}：老骥伏枥——残血不再加速；击杀 100 名后射速 +15/20/25%；3 级神射中射杀精锐回血、神射不因受伤退出`, Math.abs(lj.lowHpNoKills - lj.base) < .02 && Math.abs(lj.ratio[0] - 1.15) < .02 && Math.abs(lj.ratio[1] - 1.2) < .02 && Math.abs(lj.ratio[2] - 1.25) < .02 && lj.killed && lj.healed > 0 && lj.text && lj.keptAfterHit, lj);
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
      const t = mk(pl.x + 100, pl.y, false), side = mk(pl.x + 140, pl.y + 20); const y0 = t.sprite.y; let lifted = 0, land = false, arc = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 20)); lifted = Math.max(lifted, y0 - t.sprite.y); land = land || !!s.children.getByName('machao-land-fx'); arc = arc || !!s.children.getByName('machao-lift-fx') || !!s.children.getByName('machao-lift'); if (land && side.hp < side.maxHp) break; }
      return { lifted: Math.round(lifted), land, arc, fx: s.textures.exists('machao_fx'), targetHurt: t.maxHp - t.hp, sideHurt: side.maxHp - side.hp };
    }, [G, mk]);
    // 挑飞 / 落地改为像素特效（machao-lift-fx / machao-land-fx），不画程序圈
    ck(`${tag}：一枪挑飞目标（上挑弧光），落地砸出范围伤害与扬尘特效`, r.lifted >= 20 && r.land && r.arc && r.targetHurt > 0 && r.sideHurt > 0, r);
    // 西凉铁骑满层：下一枪朝头前冲锋（2026-11-16 用户：「马超被动是朝着头前冲锋」）。键盘先按 D 往右走，敌人放在身后（左边）
    await p.mouse.click(viewport.width / 2, 40).catch(() => {});
    await p.keyboard.down('KeyD'); await sleep(300); await p.keyboard.up('KeyD'); await sleep(100);
    const c = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player; const mk = eval(MK); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
      await new Promise(r => setTimeout(r, 1500)); mk(pl.x - 120, pl.y); const x0 = pl.x, shout0 = s.passiveShout.count; pl.passive.stacks = 6; let charge = false, moved = 0, shoutText = '', glow = false, ring = false, bigText = 0, wave = false; const t0 = performance.now();
      while (performance.now() - t0 < 4000) { await new Promise(r => setTimeout(r, 20)); charge = charge || !!s.children.getByName('machao-charge'); moved = Math.max(moved, pl.x - x0); shoutText = shoutText || (s.children.getByName('passive-shout') ? s.passiveShout.lastLine : ''); bigText = bigText || (s.children.getByName('passive-shout')?.list?.[0]?.list?.length ?? 0); wave = wave || !!s.children.getByName('warcry-wave'); glow = glow || !!s.children.getByName('passive-shout-glow'); ring = ring || !!s.children.getByName('passive-shout-ring'); if (charge && moved >= 120) break; }
      const shouts = s.passiveShout.count - shout0;
      // 紧接着再攒满一次：马超不设冷却，应再喊一次
      pl.passive.stacks = 6; await new Promise(r => setTimeout(r, 1200));
      return { charge, moved: Math.round(moved), triggers: pl.passive.snapshot(s.combatNow).triggers, shouts, shoutText, bigText, wave, waveTex: s.textures.exists('warcry_fx'), glow, ring, shoutsAfterRefill: s.passiveShout.count - shout0 };
    }, [G, mk]);
    ck(`${tag}：铁骑满层，下一枪朝头前冲锋（键盘往右走、敌人在左：仍向右突进 ≥120 像素）`, c.charge && c.moved >= 120 && c.triggers >= 1, c);
    // 手柄：模拟左摇杆向上推 0.3 秒，再满层 → 向上冲锋；带尘土拖影与枪尖破风
    const pad = await p.evaluate(async ([G0, MK]) => {
      const s = eval(G0), pl = s.player, mk = eval(MK); for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate();
      const real = navigator.getGamepads.bind(navigator), fake = { connected: true, id: 'test-pad', index: 0, mapping: 'standard', axes: [0, -1, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      navigator.getGamepads = () => [fake]; await new Promise(r => setTimeout(r, 300)); fake.axes = [0, 0, 0, 0]; await new Promise(r => setTimeout(r, 100)); navigator.getGamepads = real;
      const heading = { ...pl.heading }; mk(pl.x + 120, pl.y + 30); const y0 = pl.y; pl.weapons[0].cooldownLeft = 0; pl.passive.stacks = 6; let up = 0, dust = false, wind = false; const t0 = performance.now();
      while (performance.now() - t0 < 3000) { await new Promise(r => setTimeout(r, 20)); up = Math.max(up, y0 - pl.y); dust = dust || !!s.children.getByName('machao-charge-dust'); wind = wind || !!s.children.getByName('machao-charge-wind'); if (up >= 120 && dust) break; }
      return { heading: { x: +heading.x.toFixed(2), y: +heading.y.toFixed(2) }, up: Math.round(up), dust, wind, fx: s.textures.exists('machao_fx') };
    }, [G, mk]);
    ck(`${tag}：手柄左摇杆向上 → 满层冲锋也向上（≥120 像素），带尘土拖影与枪尖破风`, pad.heading.y < -.9 && pad.up >= 120 && (!pad.fx || (pad.dust && pad.wind)), pad);
    // 喊话冷却按武将配置：孙尚香走默认 60 秒（冷却内再攒满不喊，过后再满照喊；被动本身照常），马超为 0
    const cd = await p.evaluate(async () => {
      const { PassiveShout, PASSIVE_SHOUT_COOLDOWN_MS: CD, PASSIVE_FULL_SHOUTS } = await import('/src/ui/PassiveShout.ts'); const { CharacterPassives } = await import('/src/systems/CharacterPassives.ts');
      const s = window.__game.scene.getScene('GameScene'), sh = new PassiveShout(s), pa = new CharacterPassives('sunshangxiang', 0);
      const fill = t => { pa.stacks = 0; sh.update(pa, t, 0, 0, true); pa.stacks = 6; sh.update(pa, t + 1, 0, 0, true); return sh.count; };
      return { CD, first: fill(0), mid: fill(30000), justBefore: fill(CD - 10), after: fill(CD + 100), readyDuringCd: (pa.stacks = 6, pa.snapshot(30000).ready), sunCd: PASSIVE_FULL_SHOUTS.sunshangxiang?.cooldownMs ?? CD, machaoCd: PASSIVE_FULL_SHOUTS.machao?.cooldownMs ?? CD };
    });
    ck(`${tag}：喊话冷却按武将——孙尚香 60 秒（冷却内再攒满不喊，过了再满才喊，被动照常就绪），马超 0`, cd.CD === 60000 && cd.sunCd === 60000 && cd.machaoCd === 0 && cd.first === 1 && cd.mid === 1 && cd.justBefore === 1 && cd.after === 2 && cd.readyDuringCd, cd);
    ck(`${tag}：铁骑攒满时头顶喊一句台词、逐字砸出大字、像素声浪、身上闪金光、地上不画圈（马超不设冷却：紧接着再攒满也再喊一次）`, c.glow && !c.ring && c.bigText === [...c.shoutText].length && (!c.waveTex || c.wave) && c.shouts === 1 && c.shoutsAfterRefill === 2 && ['吾乃西凉马孟起！', '铁骑踏阵，片甲不留！', '锦马超在此，谁敢一战！'].includes(c.shoutText) , c);
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
