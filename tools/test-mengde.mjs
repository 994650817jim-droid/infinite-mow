// P2 曹操（可玩 id mengde；other-factions-design.md §4）：倚天剑扇形剑斩、命中挂「军令」（受伤 +20%、部曲集火）；
// 被动「奸雄」部曲阵亡攒 1 点并回血，满 8 点召「虎豹骑」5 骑一线冲锋；分支「挟天子以令诸侯」（令旗阵地：部曲攻速、回血）/「虎豹骑」（5 点、眩晕、尘浪）；武艺「唯才是举」军令易伤 +8%。
// 电脑布局；关掉随机暴击。用法：BASE=http://127.0.0.1:5743/ node tools/test-mengde.mjs   SHOT=1 另存截图到 .tmp-md/
import { chromium } from 'playwright'; import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5743/';
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 460) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const G = "window.__game.scene.getScene('GameScene')";
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.__DEV_ACTIONS, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(G0 => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: 'mengde', weapon: undefined }); s.scene.restart(); }, G);
await p.waitForTimeout(500);
await p.waitForFunction(() => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === 'mengde' && s.__DEV_ACTIONS; }, null, { timeout: 20000 });
await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; s.player.stats.critChance = -1; setInterval(() => { if (s.mode === 'levelup') s.chooseUpgrade(0); else if (s.mode === 'recruit') s.__DEV_ACTIONS.closePopup?.(); }, 40); }, G);
const H = `const s = ${G}, pl = s.player, w = pl.weapons[0], wait = ms => new Promise(r => setTimeout(r, ms)), waitG = async ms => { const t0 = s.combatNow, r0 = Date.now(); while (s.combatNow - t0 < ms && Date.now() - r0 < ms * 6) await wait(20); };
  const { mengdeDebug } = await import('/src/weapons/mengdeWeapon.ts'); const D = () => mengdeDebug(pl);
  const clear = () => { for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.deactivate(); pl.passive.reset('mengde', s.combatNow); };
  const mk = (kind, x, y, hp = 99999) => { const e = s.spawnEnemy(kind, x, y, 1); e.hp = e.maxHp = hp; e.stunUntil = 1e12; e.controlImmune = false; return e; };
  const fire = async () => { const a0 = D().slashes; w.cooldownLeft = 0; const r0 = Date.now(); while (D().slashes === a0 && Date.now() - r0 < 3000) await wait(8); w.cooldownLeft = 1e9; await waitG(60); };
  const ally = async () => { s.legion.recruit('swordsman', 1, true); await waitG(60); return s.allies.filter(a => a.active).pop(); };
  const killAlly = async () => { const u = await ally(); u.hurtUntil = 0; s.legion.hurt(u, 99999, s.combatNow, undefined, 0, true); return !u.active; };`;

const r0 = await p.evaluate(`(async () => { ${H}
  return { weapon: w.id, name: pl.passive.label?.(s.combatNow), tex: ['fx_md_slash','fx_md_mark','fx_md_rider','fx_md_dust','fx_md_banner','fx_cast_mengde','mengde_walk_sheet','mengde_actions','mengde_portrait','icon_yitian','branch_icon_cc_xietianzi','branch_icon_cc_hubao','growth_icon_weicai','growth_icon_wangmei'].filter(k => !s.textures.exists(k)) };
})()`);
ck('曹操开局本命武器是倚天剑（yitian_jian）', r0.weapon === 'yitian_jian', r0);
ck('曹操的手绘特效 / 行走 / 动作 / 头像 / 图标全部载入', r0.tex.length === 0, r0);

// 1) 倚天剑：身前一扇挨打、身后不挨打；命中挂军令（受伤 +20%），部曲集火这一剑的目标
const r1 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  const front = mk('infantry', pl.x + 70, pl.y), back = mk('infantry', pl.x - 110, pl.y + 4); await fire();
  return { front: front.maxHp - front.hp, back: back.maxHp - back.hp, marked: front.junlingUntil > s.combatNow, backMarked: back.junlingUntil > s.combatNow, vuln: +pl.passive.vulnerability(front, s.combatNow).toFixed(3), focus: s.legion.focus === front };
})()`);
ck('倚天剑：身前一扇挨打，身后的不挨打', r1.front > 0 && r1.back === 0, r1);
ck('军令：命中的敌兵挂标记，受伤 +20%', r1.marked && !r1.backMarked && r1.vuln === 1.2, r1);
ck('军令：部曲集火这一剑的目标', r1.focus, r1);

// 2) 奸雄：部曲阵亡攒 1 点、主将回血；满 8 点召虎豹骑 5 骑，沿途敌兵挨撞
const r2 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await wait(120);
  pl.hp = pl.maxHp * .5; const hp0 = pl.hp; const dead = await killAlly(); const st1 = pl.passive.snapshot(s.combatNow).stacks, healed = Math.round(pl.hp - hp0);
  const pack = []; for (let i = 0; i < 6; i++) pack.push(mk('infantry', pl.x + 160 + (i % 3) * 30, pl.y - 20 + Math.floor(i / 3) * 40));
  const c0 = D().charges, cast0 = s.heroCastFx?.stats.passive ?? 0;
  for (let i = 0; i < 7; i++) await killAlly();
  await waitG(80); const riders = D().riders; await waitG(800);
  return { dead, st1, healed, expectHeal: Math.round(pl.maxHp * .04), charges: D().charges - c0, riders, packHit: pack.filter(e => e.hp < e.maxHp).length, cast: (s.heroCastFx?.stats.passive ?? 0) - cast0 };
})()`);
ck('奸雄：部曲阵亡攒 1 点、主将回血 4%', r2.dead && r2.st1 === 1 && Math.abs(r2.healed - r2.expectHeal) <= 1, r2);
ck('奸雄满 8 点：召虎豹骑 5 骑、放起手特效', r2.charges === 1 && r2.riders === 5 && r2.cast >= 1, r2);
ck('虎豹骑：一线冲过，沿途敌兵挨撞', r2.packHit >= 4, r2);

// 3) 分支「虎豹骑」：5 点就召、冲撞眩晕、留尘浪
const r3 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; w.branch = 'cc_hubao'; w.over = 0; await waitG(80);
  const need = pl.passive.mdNeed; const v = mk('infantry', pl.x + 200, pl.y); v.stunUntil = 0; const c0 = D().charges;
  for (let i = 0; i < 5; i++) await killAlly();
  let stunned = false; const t0 = s.combatNow; while (s.combatNow - t0 < 900) { await wait(10); if (v.stunUntil > s.combatNow) stunned = true; }
  await waitG(100); const dust = !!s.children.list.find(o => o.name === 'md-dust' && o.alpha > 0);
  w.branch = undefined; return { need, charges: D().charges - c0, stunned, dust };
})()`);
ck('虎豹骑分支：奸雄只需 5 点', r3.need === 5 && r3.charges === 1, r3);
ck('虎豹骑分支：冲撞眩晕、冲过留下尘浪', r3.stunned && r3.dust, r3);

// 4) 分支「挟天子以令诸侯」：插令旗成阵地，阵内部曲攻速 + 回血
const r4 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; await waitG(60);
  const host = s.weaponHost; let hasted = 0, healed = 0; const oh = host.hasteAllies, ol = host.healAlliesIn; host.hasteAllies = (...a) => { hasted++; return oh(...a); }; host.healAlliesIn = (...a) => { healed++; return ol(...a); };
  const b0 = D().banners; w.branch = 'cc_xietianzi'; await waitG(300);
  const banner = !!s.children.list.find(o => o.name === 'md-banner'); host.hasteAllies = oh; host.healAlliesIn = ol; w.branch = undefined;
  return { banners: D().banners - b0, banner, hasted, healed };
})()`);
ck('挟天子以令诸侯：插令旗成阵地', r4.banners >= 1 && r4.banner, r4);
ck('挟天子以令诸侯：阵内部曲加攻速、回血', r4.hasted > 0 && r4.healed > 0, r4);

// 5) 武艺「唯才是举」：军令易伤再 +8%
const r5 = await p.evaluate(`(async () => { ${H}
  clear(); w.cooldownLeft = 1e9; pl.growth.masteries.weicai = 1; await waitG(60);
  const e = mk('infantry', pl.x + 70, pl.y); await fire(); const v = +pl.passive.vulnerability(e, s.combatNow).toFixed(3); pl.growth.masteries.weicai = 0; return { v };
})()`);
ck('唯才是举：军令易伤 20% → 28%', r5.v === 1.28, r5);

if (process.env.SHOT) {
  mkdirSync('.tmp-md', { recursive: true });
  await p.evaluate(`(async () => { ${H} clear(); w.branch = 'cc_hubao'; for (let i = 0; i < 12; i++) { const e = mk('infantry', pl.x + 120 + (i % 4) * 40, pl.y - 50 + Math.floor(i / 4) * 50); e.stunUntil = 0; } w.cooldownLeft = 0; await waitG(400); for (let i = 0; i < 5; i++) await killAlly(); })()`);
  await p.waitForTimeout(250); await p.screenshot({ path: '.tmp-md/mengde_hubao.png' });
  await p.waitForTimeout(700); await p.screenshot({ path: '.tmp-md/mengde_mark.png' });
}
ck('无报错', errors.length === 0, errors.slice(0, 5));
console.log(`\n${pass} pass / ${fail} fail`); await b.close(); process.exit(fail ? 1 : 0);
