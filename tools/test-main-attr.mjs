// 主属性加成（2026-11-17 用户：「属性点点武将的主属性，有更多加成或者有特殊加成」）：
// 主属性每点 ×1.5；主属性满 4 / 7 / 10 点解锁三档专精（力量 千钧 / 破阵 / 斩将，敏捷 轻骑 / 游刃 / 疾影，
// 智力 凝神 / 连珠 / 广域，统御 励军 / 募众 / 同袍）；加点面板主属性金边、「主属性 ×1.5」、三个菱形。电脑布局 1280×720。
// 用法：BASE=http://127.0.0.1:5195/ node tools/test-main-attr.mjs（默认 5173）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/main-attr';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 400) : '')); };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|Texture key already in use/.test(m.text())) errors.push('console ' + m.text()); });
await p.addInitScript(() => {
  window.__mod = async part => import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(part)) ?? ('/src/' + part.replace(/^\//, '')));
  if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('im_last_hero', 'guanyu'); sessionStorage.setItem('seeded', '1'); }
});
await p.goto(base + '?dev=1&autostart=1&stage=1&layout=desktop');
await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS, null, { timeout: 90000 });

// 1) 纯数值：用 RunGrowth 直接算
const v = await p.evaluate(async () => {
  const { RunGrowth } = await window.__mod('/src/systems/RunGrowth.ts');
  const mk = (hero, attrs) => { const g = new RunGrowth(hero); Object.assign(g.attributes, attrs); return g; };
  const o = {};
  // ×1.5：同样 4 点智力，诸葛亮（主属性）范围 +4.8%，关羽 +3.2%；同样 4 点力量，关羽生命 +18%，诸葛亮 +12%
  o.areaZhuge = mk('zhuge', { intellect: 4 }).areaMultiplier(); o.areaGuanyu = mk('guanyu', { intellect: 4 }).areaMultiplier();
  o.hpGuanyu = mk('guanyu', { strength: 4 }).bonusMaxHp(); o.hpZhuge = mk('zhuge', { strength: 4 }).bonusMaxHp();
  o.tiers = [3, 4, 6, 7, 9, 10].map(n => mk('guanyu', { strength: n }).primaryTier());
  o.tierNonPrimary = mk('guanyu', { agility: 10 }).primaryTier();
  // 力量·斩将
  o.bossMul = [mk('guanyu', { strength: 9 }).gearHitMultiplier('boss'), mk('guanyu', { strength: 10 }).gearHitMultiplier('boss'), mk('guanyu', { strength: 10 }).gearHitMultiplier('normal')];
  // 敏捷：轻骑 / 游刃 / 疾影
  o.move = [mk('zhaoyun', { agility: 3 }).movementMultiplier(), mk('zhaoyun', { agility: 4 }).movementMultiplier()];
  o.crit = [mk('zhaoyun', { agility: 6 }).criticalBonus(), mk('zhaoyun', { agility: 7 }).criticalBonus()];
  o.dodge = [mk('zhaoyun', { agility: 6 }).dodgeChance(), mk('zhaoyun', { agility: 7 }).dodgeChance(), mk('guanyu', { agility: 10 }).dodgeChance()];
  { const g = mk('zhaoyun', { agility: 10 }); const a0 = g.attackSpeedMultiplier(1000); g.hasteUntil = 3000; o.haste = [a0, g.attackSpeedMultiplier(1000), g.attackSpeedMultiplier(4000)]; }
  // 智力：凝神 / 连珠 / 广域
  o.cd = [mk('zhuge', { intellect: 3 }).attackSpeedMultiplier(0), mk('zhuge', { intellect: 4 }).attackSpeedMultiplier(0)];
  { const r = Math.random; Math.random = () => 0; o.echo = [mk('zhuge', { intellect: 6 }).spellEcho(), mk('zhuge', { intellect: 7 }).spellEcho()]; Math.random = () => .99; o.echoMiss = mk('zhuge', { intellect: 7 }).spellEcho(); Math.random = r; }
  o.area = [mk('zhuge', { intellect: 9 }).areaMultiplier(), mk('zhuge', { intellect: 10 }).areaMultiplier()];
  // 统御：励军 / 募众 / 同袍
  o.ally = [mk('liubei', { command: 3 }).allyDamageMultiplier(), mk('liubei', { command: 4 }).allyDamageMultiplier()];
  o.recruit = [mk('liubei', { command: 6 }).freeRecruitBonus(), mk('liubei', { command: 7 }).freeRecruitBonus()];
  o.revive = [mk('liubei', { command: 9 }).followerRevive(), mk('liubei', { command: 10 }).followerRevive()];
  return o;
});
ck('主属性每点 ×1.5：4 点智力，诸葛亮范围 ×1.048、关羽 ×1.032', near(v.areaZhuge, 1.048) && near(v.areaGuanyu, 1.032), [v.areaZhuge, v.areaGuanyu]);
ck('主属性每点 ×1.5：4 点力量，关羽生命 +18%、诸葛亮 +12%（基础 100）', v.hpGuanyu === 18 && v.hpZhuge === 12, [v.hpGuanyu, v.hpZhuge]);
ck('专精档位：主属性 3/4/6/7/9/10 点 → 0/1/1/2/2/3；非主属性加满不算', JSON.stringify(v.tiers) === '[0,1,1,2,2,3]' && v.tierNonPrimary === 0, [v.tiers, v.tierNonPrimary]);
ck('力量·斩将（满 10 点）：对首领伤害 ×1.2，对小兵不变', near(v.bossMul[0], 1) && near(v.bossMul[1], 1.2) && near(v.bossMul[2], 1), v.bossMul);
ck('敏捷·轻骑（满 4 点）：移速再 ×1.08', near(v.move[1] / (1 + .01 * 6), 1.08) && near(v.move[0], 1 + .01 * 4.5), v.move);
ck('敏捷·游刃（满 7 点）：暴击 +5%、闪避 10%；非主属性没有', near(v.crit[1] - Math.min(.1, .005 * 10.5), .05) && v.dodge[0] === 0 && v.dodge[1] === .1 && v.dodge[2] === 0, [v.crit, v.dodge]);
ck('敏捷·疾影（满 10 点）：暴击后 2 秒内攻速 ×1.2，过后恢复', near(v.haste[1] / v.haste[0], 1.2) && near(v.haste[2], v.haste[0]), v.haste);
ck('智力·凝神（满 4 点）：法术武器冷却 −10%（攻速 ×1/0.9）', near(v.cd[0], 1) && near(v.cd[1], 1 / .9), v.cd);
ck('智力·连珠（满 7 点）：法术伤害 15% 几率翻倍', v.echo[0] === 1 && v.echo[1] === 2 && v.echoMiss === 1, [v.echo, v.echoMiss]);
ck('智力·广域（满 10 点）：范围再 ×1.12', near(v.area[1], (1 + .008 * 15) * 1.12) && near(v.area[0], 1 + .008 * 13.5), v.area);
ck('统御·励军（满 4 点）：部曲伤害再 ×1.15', near(v.ally[1] / (1 + .03 * 6), 1.15) && near(v.ally[0], 1 + .03 * 4.5), v.ally);
ck('统御·募众（满 7 点）：免费招兵多 1 人', v.recruit[0] === 0 && v.recruit[1] === 1, v.recruit);
ck('统御·同袍（满 10 点）：救起时间 ×0.6、救起带 70% 生命', v.revive[0] === null && near(v.revive[1]?.secMul, .6) && v.revive[1]?.hp === .7, v.revive);

// 2) 实战：按武将重开战斗（存档里写好主属性 10 点）
async function startAs(hero, attrs) {
  await p.evaluate(async ([h, a]) => {
    localStorage.setItem('im_heroes_v1', JSON.stringify({ version: 1, migrated: true, attrSet: 3, heroes: { [h]: { level: 11, xp: 0, attributes: { strength: 0, agility: 0, intellect: 0, command: 0, ...a } } } }));
    (await window.__mod('/src/systems/HeroProgress.ts')).resetHeroCache();
    const s = window.__game.scene.getScene('GameScene'); s.registry.remove('campaignTransfer'); s.registry.set('runConfig', { character: h, chapter: 'huangjin', stage: 1 }); s.scene.start('GameScene');
  }, [hero, attrs]);
  await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.elapsed < 2; }, hero, { timeout: 30000 });
  await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); s.__DEV_ACTIONS?.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active) e.deactivate(); s.player.weapons.length = 0; if (s.mode !== 'none') s.setMode('none'); });
  await p.waitForTimeout(300);
}

// 关羽：千钧推开、破阵第 5 下 ×2 + 定身
await startAs('guanyu', { strength: 10 });
const gy = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, t = s.combatNow;
  const e = s.spawnEnemy('infantry', pl.x + 60, pl.y, 1, true); e.controlImmune = false;
  e.sprite.x = pl.x + 60; e.sprite.y = pl.y; e.hp = e.maxHp = 1e7;
  const r = Math.random; Math.random = () => .99; // 不暴击
  const dmg = []; let x1 = 0;
  for (let i = 0; i < 5; i++) { const before = e.hp; s.hitEnemy(e, 100, t + i * 10, 'melee', false, true); dmg.push(before - e.hp); if (i === 0) x1 = e.sprite.x; }
  Math.random = r;
  return { tier: pl.growth.primaryTier(), dmg, pushed: x1 - (pl.x + 60), stun: e.stunUntil - (t + 40), boss: e.kind };
});
ck('关羽主属性 10 点：三档全开', gy.tier === 3, gy.tier);
ck('力量·千钧：武器命中把小兵推开约 18 像素（同一敌人 0.5 秒一次）', gy.pushed > 15 && gy.pushed < 21, gy.pushed);
ck('力量·破阵：第 5 次武器命中伤害 ×2，并定身 0.5 秒', Math.abs(gy.dmg[4] / gy.dmg[3] - 2) < .05 && gy.dmg.slice(0, 4).every(d => Math.abs(d - gy.dmg[0]) <= 1) && Math.abs(gy.stun - 500) < 1, gy);

// 赵云：游刃闪避（掷骰 0 → 闪避，生命不变）
await startAs('zhaoyun', { agility: 10 });
const zy = await p.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene'), pl = s.player, r = Math.random; pl.invulnUntil = 0;
  Math.random = () => 0; const hp0 = pl.hp, a = pl.takeDamage(30, s.combatNow + 5000); const hp1 = pl.hp;
  Math.random = () => .99; const b2 = pl.takeDamage(30, s.combatNow + 9000); Math.random = r;
  return { dodged: !a && hp1 === hp0, hit: b2 && pl.hp < hp1 };
});
ck('敏捷·游刃：闪避时不掉血；没闪避照常受伤', zy.dodged && zy.hit, zy);

// 刘备：募众，开招兵时免费人数 +1
await startAs('liubei', { command: 10 });
const lb = await p.evaluate(() => { const s = window.__game.scene.getScene('GameScene'); const base = s.legion.freeRecruitCount; s.waveIndex = 1; s.recruitedWaves.clear(); s.openRecruit(); /* 招兵只在第 2 波起开 */ const n = s.legion.freeRecruitCount; s.__DEV_ACTIONS?.closePopup?.(); if (s.mode !== 'none') s.setMode('none'); return { base, n }; });
ck('统御·募众：开招兵时免费人数比基础多 1', lb.n === lb.base + 1, lb);

// 3) 加点面板（2026-11-18 改版）：主属性一行写「主属性：智力 · 每点效果 ×倍率」、专精三档（诸葛亮智力 7 点 → 亮两档，第三档写「再加 3 点」），悬停弹完整说明
await startAs('zhuge', { intellect: 7 });
const ui = await p.evaluate(async () => {
  const s = window.__game.scene.getScene('GameScene'); s.attributeReturn = 'none'; s.renderAttributePanel(); s.setMode('attributes'); await new Promise(r => setTimeout(r, 200));
  const mul = (await import('/src/data/attributes.ts')).PRIMARY_MUL;
  const all = s.attributePanel.list.flatMap(o => [o, ...(o.list ?? [])]);
  const head = all.find(o => o.name === 'attribute-primary-head')?.text;
  const chips = [1, 2, 3].map(k => all.find(o => o.name === 'attribute-perk-' + k)?.text);
  const chip = all.find(o => o.name === 'attribute-perk-2'); chip.emit('pointerover', { x: chip.x, y: chip.y, worldX: chip.x, worldY: chip.y });
  const tip = s.children.list.find(o => o.name === 'item-tooltip' && o.visible), title = tip?.getByName('info-tooltip-title')?.text, body = tip?.getByName('info-tooltip-body')?.text ?? '';
  chip.emit('pointerout'); const hidden = !s.children.list.some(o => o.name === 'item-tooltip' && o.visible);
  return { mul, head, chips, title, body, hidden, tier: s.player.growth.primaryTier() };
});
ck('加点面板：主属性一行写「主属性：智力 · 每点效果 ×' + ui.mul + '」，专精前两档点亮、第三档「再加 3 点」', ui.head === '主属性：智力 · 每点效果 ×' + ui.mul && ui.chips[0] === '◆ 凝神' && ui.chips[1] === '◆ 连珠' && ui.chips[2] === '◇ 广域 · 再加 3 点' && ui.tier === 2, ui);
ck('悬停专精：弹完整说明（主属性、每点效果、三档，已解锁 / 再加 X 点），移开隐藏', ui.title === '主属性：智力' && ui.body.includes('满 7 点「连珠」法术伤害 15% 几率翻倍（已解锁）') && ui.body.includes('满 10 点「广域」范围再 +12%（再加 3 点）') && ui.hidden, { title: ui.title, body: ui.body });
await p.screenshot({ path: `${out}/desktop-attr-panel.png` });

ck('没有页面错误', errors.length === 0, errors.slice(0, 3));
console.log(`\n${pass} 通过，${fail} 失败`);
await b.close();
process.exit(fail ? 1 : 0);
