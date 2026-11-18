// 新女将（2026-11-16 重做专属武器）：
//  孙尚香「弓腰姬飞刀」：环绕飞刀割伤贴身敌人 + 掷刀穿透远敌（不飞回、1.2 秒补刀）；被动「侍婢执刀」移动积疾步，满层召执刀侍婢护身。
//  貂蝉「双花扇」：回旋飞扇去回各打一次，命中积魅惑，满 3 层倒戈（离间）去撞同伴；被动满 5 层「闭月」舞带旋舞令圈内敌人倒戈。
// 每将：手机 390×844 与电脑 1280×720 两种布局进第 1 关；检查行走 / 动作图、立绘、本命武器、被动触发效果；
// 选将界面能翻到并选中新将；全程无 pageerror / console error。截图存 assets/review/new-heroes/。
// 需要开发服务器。用法：BASE=http://127.0.0.1:5191/ node tools/test-new-heroes.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/new-heroes';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const HEROES = { sunshangxiang: { name: '孙尚香', weapon: 'sun_knives', index: 10 }, diaochan: { name: '貂蝉', weapon: 'diaochan_fans', index: 11 } };
const LAYOUTS = Object.fromEntries(Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 720 } }).filter(([k]) => !process.env.LAYOUT || process.env.LAYOUT === k));
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const watch = (p, tag) => { p.on('pageerror', e => errors.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(tag + ' ' + m.text()); }); };

for (const [layout, viewport] of Object.entries(LAYOUTS)) for (const [hero, h] of Object.entries(HEROES)) {
  const tag = `${h.name}(${layout === 'mobile' ? '手机' : '电脑'})`;
  const p = await b.newPage({ viewport }); watch(p, tag);
  await p.goto(base + `?dev=1&autostart=1&stage=1&layout=${layout}`);
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 30000 });
  await p.waitForTimeout(1500); // 等首局后台素材（兵种立绘等）加载完再重启，避免重启打断加载
  await p.evaluate(([G0, id, w]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: w }); s.scene.restart(); }, [G, hero, h.weapon]);
  await p.waitForTimeout(400);
  await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS; }, hero, { timeout: 20000 });
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; }, G);
  await p.waitForTimeout(300);
  const st = await p.evaluate(([G0, id]) => { const s = eval(G0), pl = s.player; return { sheet: pl.sprite.texture.key, walk: pl.walkSheet, weapon: pl.weapons[0].id, passive: pl.passive.snapshot(s.combatNow).character, portrait: s.textures.exists(id + '_portrait'), actions: pl.hasActions, frameH: Math.round(pl.sprite.displayHeight), hpMax: pl.maxHp }; }, [G, hero]);
  ck(`${tag}：行走 / 动作图（正式高清）、立绘、本命武器、专属被动`, st.walk === hero + '_walk_sheet' && st.weapon === h.weapon && st.passive === hero && st.portrait && st.actions && st.frameH > 30, st);

  if (hero === 'sunshangxiang') {
    // 1) 环绕飞刀割贴身敌人；2) 掷刀打中远处一列敌人
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, mk = (x, y) => { const e = s.spawnEnemy('infantry', x, y, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } return e; };
      const near = mk(pl.x, pl.y + 52), far = [mk(pl.x + 220, pl.y), mk(pl.x + 250, pl.y), mk(pl.x + 280, pl.y)];
      let thrownSeen = 0; const t0 = performance.now();
      while (performance.now() - t0 < 5000) { await new Promise(r => setTimeout(r, 30)); thrownSeen = Math.max(thrownSeen, s.children.list.filter(o => o.name === 'sun-thrown-knife').length); if (near.hp < near.maxHp && far.filter(e => e.hp < e.maxHp).length >= 2) break; }
      return { orbit: s.children.list.filter(o => o.name === 'sun-orbit-knife').length, nearHurt: near.maxHp - near.hp, farHurt: far.map(e => e.maxHp - e.hp), thrownSeen };
    }, G);
    ck(`${tag}：环绕 2 把飞刀割伤贴身敌人，掷出的飞刀打中远处敌人`, r.orbit === 2 && r.nearHurt > 0 && r.farHurt.filter(n => n > 0).length >= 2 && r.thrownSeen >= 1, r);
    // 3) 走路积疾步，满 6 层召 2 名执刀侍婢
    await p.mouse.click(viewport.width / 2, 40).catch(() => {});
    // 疾步每 0.8 秒 1 层（2026-11-16 调整），满 6 层约需 4.8 秒移动
    await p.keyboard.down('KeyD'); await p.waitForTimeout(2700); await p.keyboard.up('KeyD');
    await p.keyboard.down('KeyA'); await p.waitForTimeout(2700); await p.keyboard.up('KeyA');
    const m = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, sn0 = pl.passive.snapshot(s.combatNow); let maids = 0; const t0 = performance.now();
      while (performance.now() - t0 < 6000) { await new Promise(r => setTimeout(r, 30)); maids = Math.max(maids, s.children.list.filter(o => o.name === 'sun-maid' && o.active).length); if (maids >= 2) break; }
      // 侍婢身边放一个定身敌人，看正式刀光（sun-maid-slash）
      const e = s.spawnEnemy('infantry', pl.x + 40, pl.y + 10, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } let slash = false; const t1 = performance.now();
      while (performance.now() - t1 < 3000 && !slash) { await new Promise(r => setTimeout(r, 20)); slash = !!s.children.getByName('sun-maid-slash'); }
      return { stacksAfterWalk: sn0.stacks, gains: pl.passive.snapshot(s.combatNow).gains, triggers: pl.passive.snapshot(s.combatNow).triggers, maids, slash, slashTex: s.textures.exists('sun_maid_slash'), shouts: s.passiveShout.count, shout: s.passiveShout.lastLine };
    }, G);
    ck(`${tag}：移动积满 6 层疾步，召出 2 名执刀侍婢`, m.gains >= 6 && m.triggers >= 1 && m.maids >= 2, m);
    ck(`${tag}：侍婢挥刀播正式刀光；疾步攒满时头顶喊一句台词`, m.slash && m.slashTex && m.shouts === 1 && ['侍婢何在，随我执刀！', '弓腰姬在此，谁敢近前！', '江东孙尚香，岂输男儿！'].includes(m.shout), m);
    // 成长：Lv5 一次掷出 3 把（飞向不同敌人）
    const lv5 = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0;
      await new Promise(r => setTimeout(r, 1500)); pl.weapons[0].level = 5;
      for (let i = 0; i < 4; i++) { const e = s.spawnEnemy('infantry', pl.x + 200 + i * 30, pl.y - 90 + i * 60, 1); if (e) { e.hp = e.maxHp = 99999; e.stunUntil = 1e12; } }
      let most = 0; const t0 = performance.now();
      while (performance.now() - t0 < 3000) { await new Promise(r => setTimeout(r, 15)); most = Math.max(most, s.children.list.filter(o => o.name === 'sun-thrown-knife').length); if (most >= 3) break; }
      return { most };
    }, G);
    ck(`${tag}：Lv5 一次掷出 3 把飞刀`, lv5.most >= 3, lv5);
    await p.waitForTimeout(150);
  } else {
    // 1) 回旋飞扇去回各打一次 → 魅惑满层（charmNeed）倒戈；2) 倒戈者去撞同伴
    const r = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player;
      const a = s.spawnEnemy('infantry', pl.x + 150, pl.y, 1); a.hp = a.maxHp = 99999;
      const b2 = s.spawnEnemy('infantry', pl.x + 150, pl.y + 130, 1); b2.hp = b2.maxHp = 99999; b2.stunUntil = 1e12;
      // 一柄飞扇去程、回程各中一次；魅惑层数达到 PASSIVE_RULES.charmNeed（平衡后为 2）即倒戈。记下倒戈前出现过几柄扇子、敌人挨了几下
      const { PASSIVE_RULES } = await import('/src/data/passives.ts'); const need = PASSIVE_RULES.charmNeed;
      const fans = new Set(); let hits = 0, hp = a.hp, turned = false; const t0 = performance.now();
      while (performance.now() - t0 < 8000) {
        await new Promise(r => setTimeout(r, 15));
        for (const o of s.children.list) if (o.name === 'diaochan-fan') fans.add(o);
        if (a.hp < hp) { hits++; hp = a.hp; }
        if (pl.passive.isTurned(a, s.combatNow)) { turned = true; break; }
      }
      const vul = pl.passive.vulnerability(a, s.combatNow), b0 = b2.hp; const t1 = performance.now();
      while (performance.now() - t1 < 3000 && b2.hp === b0) await new Promise(r => setTimeout(r, 30));
      return { need, fansBeforeTurn: fans.size, hitsBeforeTurn: hits, turned, vul, allyHurt: b0 - b2.hp, mark: !!s.children.getByName('diaochan-mark') };
    }, G);
    ck(`${tag}：飞扇去回各中一次，魅惑满层（${r.need} 层）倒戈、受伤 ×1.2，并去撞同伴`, r.turned && r.hitsBeforeTurn === r.need && r.fansBeforeTurn === Math.ceil(r.need / 2) && Math.abs(r.vul - 1.2) < 1e-6 && r.allyHurt > 0 && r.mark, r);
    // 3) 舞势满 5 层 → 闭月：舞带环身，圈内敌人倒戈
    const d = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player, foes = [];
      for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3, e = s.spawnEnemy('infantry', pl.x + Math.cos(ang) * 110, pl.y + Math.sin(ang) * 110, 1); if (e) { e.hp = e.maxHp = 99999; foes.push(e); } }
      pl.passive.stacks = 5; let moon = false; const t0 = performance.now();
      while (performance.now() - t0 < 5000) { await new Promise(r => setTimeout(r, 30)); if (s.children.getByName('diaochan-moon')) { moon = true; await new Promise(r => setTimeout(r, 500)); break; } }
      return { moon, turned: foes.filter(e => pl.passive.isTurned(e, s.combatNow)).length, triggers: pl.passive.snapshot(s.combatNow).triggers };
    }, G);
    ck(`${tag}：舞势满层「闭月」——舞带环身，圈内敌人倒戈（≥4 名）`, d.moon && d.turned >= 4 && d.triggers >= 1, d);
    // 3b) 闭月倒戈不叠层：闭月结束后层数没满，继续掷扇（修「满层后一直闭月、不再扔扇子」）
    const d2 = await p.evaluate(async G0 => {
      const s = eval(G0), pl = s.player; const t0 = performance.now();
      while (performance.now() - t0 < 3000 && s.children.getByName('diaochan-moon')) await new Promise(r => setTimeout(r, 30));
      const stacksAfter = pl.passive.stacks, trig0 = pl.passive.snapshot(s.combatNow).triggers;
      await new Promise(r => setTimeout(r, 1500));
      return { stacksAfter, moonAgain: pl.passive.snapshot(s.combatNow).triggers > trig0 || !!s.children.getByName('diaochan-moon') };
    }, G);
    ck(`${tag}：闭月造成的倒戈不叠层，闭月后层数 <5、1.5 秒内不再连放闭月`, d2.stacksAfter < 5 && !d2.moonAgain, d2);
    await p.waitForTimeout(100);
  }
  await p.screenshot({ path: `${out}/${hero}-battle-${layout}.png` });
  await p.close();
}

// 选将界面：两种布局都能翻到第 3 页并选中新将，确认后主页记住
for (const [layout, viewport] of Object.entries(LAYOUTS)) {
  const p = await b.newPage({ viewport }); watch(p, 'picker-' + layout);
  await p.goto(base + `?layout=${layout}`); await p.waitForFunction(() => window.__game?.scene.isActive('MenuScene'), null, { timeout: 30000 }); await p.waitForTimeout(600);
  const pg = await p.evaluate(async () => {
    const s = window.__game.scene.getScene('MenuScene'), hp = s.heroPicker; hp.open(10); await new Promise(r => setTimeout(r, 300));
    const vis = hp.cards.map((c, i) => c.root.visible ? i : -1).filter(i => i >= 0);
    const names = vis.map(i => hp.cards[i].name.text);
    const card = hp.root.getByName('pick-diaochan'); card?.emit('pointerdown');
    return { vis, names, candidate: hp.candidate, page: hp.pageText?.text };
  });
  ck(`选将(${layout})：第 3 页显示庞统、黄月英、孙尚香、貂蝉，可点选`, pg.vis.join() === '8,9,10,11' && pg.names.slice(2).join() === '孙尚香,貂蝉' && pg.candidate === 11, pg);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/picker-${layout}.png` });
  // 新存档开局择主公：「确认出战」要点两次（主公规则，2026-11-16）
  const conf = await p.evaluate(async () => { const s = window.__game.scene.getScene('MenuScene'), ok = s.heroPicker.root.getByName('hero-confirm'); ok.emit('pointerdown'); ok.emit('pointerdown'); await new Promise(r => setTimeout(r, 300)); const R = await import('/src/systems/RosterStore.ts'); return { saved: localStorage.getItem('im_last_hero'), sel: s.selectedChar, lord: R.lordHero() }; });
  ck(`选将(${layout})：确认出战（两次）后貂蝉定为主公并记住`, conf.saved === 'diaochan' && conf.sel === 11 && conf.lord === 'diaochan', conf);
  await p.waitForTimeout(400); await p.screenshot({ path: `${out}/home-${layout}.png` });
  await p.evaluate(() => localStorage.removeItem('im_last_hero'));
  await p.close();
}
// 可破坏道具（2026-11-17 用户：「为什么我现在使用貂蝉但是打障碍物没坏」）：12 名武将的本命武器都能打碎身边的酒罐。
// 酒罐放在主将右侧 60 像素，旁边再放一名定住的高血量敌人（多数武器要有敌人才出手，选靶仍跳过道具）。
{
  const p = await b.newPage({ viewport: LAYOUTS.desktop }); watch(p, 'props');
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 60000 }); await p.waitForTimeout(800);
  for (const hero of ['zhaoyun', 'guanyu', 'huangzhong', 'zhuge', 'zhangfei', 'machao', 'weiyan', 'liubei', 'pangtong', 'huangyueying', 'sunshangxiang', 'diaochan']) {
    await p.evaluate(id => { const s = window.__game.scene.getScene('GameScene'); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: id, weapon: undefined }); s.scene.restart(); }, hero);
    await p.waitForTimeout(400);
    await p.waitForFunction(id => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === id && s.__DEV_ACTIONS && s.supplies; }, hero, { timeout: 30000 });
    const r = await p.evaluate(async () => {
      const s = window.__game.scene.getScene('GameScene'), pl = s.player; pl.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.spawnGem = () => {};
      for (const e of s.enemies) if (e.active) e.deactivate();
      const lv = setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40);
      const jar = s.supplies.spawnHealForTest('wine', 60, 0); if (!jar) { clearInterval(lv); return { jar: false }; }
      const life = jar.spawnId, foe = s.spawnEnemy('infantry', pl.x + 88, pl.y + 12, 1); foe.hp = foe.maxHp = 1e7; foe.stunUntil = 1e12;
      const t0 = performance.now(); let broke = false;
      while (performance.now() - t0 < 9000) { await new Promise(r => setTimeout(r, 60)); if (!jar.active || jar.spawnId !== life) { broke = true; break; } }
      clearInterval(lv);
      return { jar: true, broke, ms: Math.round(performance.now() - t0), foeHurt: foe.maxHp - foe.hp > 0 };
    });
    ck(`道具(${hero})：本命武器能打碎身边的酒罐`, r.jar && r.broke, r);
  }
  await p.close();
}
ck('无 pageerror / console error', errors.length === 0, errors.slice(0, 5));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
