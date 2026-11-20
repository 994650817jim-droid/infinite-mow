// 1-2 下曲阳 · 张宝「护法符柱」（2026-11-19 用户：军情「先打掉护法符柱，张宝才会受伤。」——「这个玩法要应用到这一关」）：
// 出场四周立 4 根手绘符柱（同 1-3 张角 zj_pillar）；符柱没全碎时张宝受伤 ×0.15、血条小字「护法符柱 x/4」；自动索敌先打符柱；
// 碎完正常受伤；二阶段「妖术护体」再立一轮。截图 assets/review/zhangbao-wards/（符柱立着 / 碎完）。
// 用法：BASE=http://127.0.0.1:5743/ node tools/test-zhangbao-wards.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/', OUT = 'assets/review/zhangbao-wards';
mkdirSync(OUT, { recursive: true });
const rows = []; const ck = (n, ok, info) => { rows.push(!!ok); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : JSON.stringify(info).slice(0, 900)); };
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(BASE + '?dev=1&autostart=1&stage=2&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 90000 }); await p.waitForTimeout(1000);
const r1 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)), pl = s.player;
  s.__DEV_ACTIONS.closePopup?.(); setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); }, 40); /* 开局升级三选一会暂停战斗 */ pl.damageImmune = true; s.spawnTimer = s.eliteTimer = 1e9; for (const w of pl.weapons) w.cooldownLeft = 1e9;
  for (const e of s.enemies) if (e.active && e.kind !== 'boss' && !e.isSupplySlot) e.deactivate();
  if (!s.boss?.active) s.spawnBoss();
  await wait(900);
  const boss = s.boss, mv = s.moveset; pl.sprite.setPosition(boss.x - 230, boss.y + 30); /* 主将走到张宝身边（符柱立在张宝出场处四周） */ boss.stunUntil = 1e12; boss.hp = boss.maxHp = 20000;
  await wait(300);
  const wards = s.enemies.filter(e => e.active && e.ward), imgs = s.children.list.filter(o => o.name === 'boss-ward').length;
  const hit = raw => { const h0 = boss.hp; boss.invulnerable = false; s.hitEnemy(boss, raw, s.combatNow, 'melee', false, false); return h0 - boss.hp; };
  const dmgUp = hit(1000), label = mv.label, tgt = s.priorityWeaponTarget(3000);
  return { wards: wards.length, imgs, dmgUp, label, bar: s.hudTexts.bossEnergy.text, tgtWard: !!tgt?.ward, tex: s.textures.exists('bossfx_zj_pillar') || s.children.list.some(o => o.name === 'boss-ward' && o.texture?.key !== '__MISSING') };
});
await p.screenshot({ path: `${OUT}/wards-up-1280x720.png` });
ck('张宝出场：四周立 4 根手绘护法符柱，血条小字「护法符柱 4/4」', r1.wards === 4 && r1.imgs === 4 && /护法符柱 4\/4/.test(r1.label ?? '') && /护法符柱 4\/4/.test(r1.bar ?? ''), r1);
ck('自动索敌：射程内有符柱时先打符柱', r1.tgtWard, r1);
const r2 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)), boss = s.boss, mv = s.moveset;
  for (const e of s.enemies.filter(e => e.active && e.ward)) s.hitEnemy(e, 99999, s.combatNow, 'melee', false, false);
  await wait(700);
  const hit = raw => { const h0 = boss.hp; boss.invulnerable = false; s.hitEnemy(boss, raw, s.combatNow, 'melee', false, false); return h0 - boss.hp; };
  return { left: mv.wardsLeft, dmgDown: hit(1000), label: mv.label, rubble: s.children.list.filter(o => o.name === 'boss-ward').length };
});
await p.screenshot({ path: `${OUT}/wards-broken-1280x720.png` });
ck(`符柱立着时张宝几乎不掉血（${r1.dmgUp}），碎完正常掉血（${r2.dmgDown}），比值约 0.15`, r2.left === 0 && r1.dmgUp > 0 && r1.dmgUp / r2.dmgDown < .25 && r1.dmgUp / r2.dmgDown > .08 && !/护法符柱/.test(r2.label), { r1, r2 });
ck('碎了的符柱留残骸（手绘碎裂帧），不消失', r2.rubble === 4, r2);
const r3 = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'), wait = ms => new Promise(r => setTimeout(r, ms)), boss = s.boss, mv = s.moveset;
  boss.stunUntil = 0; boss.hp = Math.round(boss.maxHp * .45); s.hitEnemy(boss, 1, s.combatNow, 'melee', false, false);
  for (let k = 0; k < 60 && mv.phase !== 2; k++) await wait(100);
  await wait(800);
  return { phase: mv.phase, wards: s.enemies.filter(e => e.active && e.ward).length, label: mv.label, guards: mv.snapshot?.().guards };
});
ck('二阶段「妖术护体」：再立一轮 4 根符柱（代替原来的道兵护体）', r3.phase === 2 && r3.wards === 4 && /护法符柱 4\/4/.test(r3.label ?? '') && !r3.guards, r3);
ck('无页面报错', errs.length === 0, errs.slice(0, 3));
await b.close();
const pass = rows.filter(Boolean).length; console.log(`\n${pass}/${rows.length} 通过`); process.exit(pass === rows.length ? 0 : 1);
