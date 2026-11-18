// 武将动作层（HERO_ACTIONS_PLAN.md · A1–A3）：四武将正式动作图集——待机、三向普攻与朝左镜像、招牌技（实战触发）、受伤、
// 动作结束复位、优先级、胜利 / 倒地定格。需要开发服务器 5173。用法：node tools/test-hero-actions.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/', out = 'assets/review/hero-actions';
mkdirSync(out, { recursive: true });
let pass = 0, fail = 0; const errors = [];
const ck = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const b = await chromium.launch({ channel: 'chrome', headless: true });
const G = "window.__game.scene.getScene('GameScene')";
const HEROES = { zhaoyun: { name: '赵云', weapon: 'spear_orbit' }, guanyu: { name: '关羽', weapon: 'guandao' }, huangzhong: { name: '黄忠', weapon: 'crossbow' }, zhuge: { name: '诸葛亮', weapon: 'flame_banner' } };
const battle = async hero => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  p.on('pageerror', e => errors.push(hero + ' ' + e.message));
  await p.goto(base + '?dev=1&autostart=1&stage=1&layout=mobile');
  await p.waitForFunction(() => window.__game?.scene.getScene('GameScene')?.player && window.__game.scene.getScene('GameScene').__DEV_ACTIONS);
  if (hero !== 'zhaoyun') {
    await p.evaluate(([G0, hero, weapon]) => { const s = eval(G0); s.registry.set('runConfig', { ...s.registry.get('runConfig'), character: hero, weapon }); s.scene.restart(); }, [G, hero, HEROES[hero].weapon]);
    await p.waitForTimeout(400);
    await p.waitForFunction(h => { const s = window.__game.scene.getScene('GameScene'); return s?.player && s.runConfig?.character === h && s.__DEV_ACTIONS; }, hero);
  }
  // 手动检查期间冻结本命武器（自动开火会插入普攻 / 招牌技）；实战触发检查会重置冷却
  await p.evaluate(G0 => { const s = eval(G0); s.player.damageImmune = true; s.__DEV_ACTIONS.closePopup?.(); s.spawnTimer = s.eliteTimer = 1e9; for (const e of s.enemies) if (e.active && !e.isSupplySlot) e.hp = 0; s.player.weapons[0].cooldownLeft = 1e9; }, G);
  await p.waitForTimeout(300);
  return p;
};
const state = p => p.evaluate(async G0 => { const s = eval(G0), pl = s.player; const m = await import(performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/src/systems/SpriteMetrics.ts'))); const key = pl.sprite.texture.key, med = m.sheetFigureHeight(s, key) ?? pl.sprite.frame.height; return { action: pl.currentAction, tex: key, frame: String(pl.sprite.frame.name), flip: pl.sprite.flipX, h: Math.round(pl.sprite.scaleY * med) }; }, G);
const shot = (p, file) => p.screenshot({ path: `${out}/${file}`, clip: { x: 130, y: 360, width: 130, height: 130 } });

// 普攻按时长占比换帧（刀将举刀仅 16ms），取样时可能已到本行后续帧：只检查落在对应方向那一行
const inRow = (f, first) => +f >= first && +f < first + 4;
for (const hero of Object.keys(HEROES)) {
  const N = HEROES[hero].name, p = await battle(hero), z = {};
  z.has = await p.evaluate(G0 => eval(G0).player.hasActions, G);
  const walk = await state(p);
  await p.evaluate(G0 => { eval(G0).player.direction = 'down'; }, G); await p.waitForTimeout(700);
  const idle = []; for (let i = 0; i < 6; i++) { idle.push((await state(p)).frame); await p.waitForTimeout(130); }
  for (const dir of ['down', 'right', 'up', 'left']) { await p.evaluate(([G0, d]) => eval(G0).player.faceDirection(d, 200), [G, dir]); z[dir] = await state(p); if (dir === 'right') await shot(p, `${hero}-attack-right.png`); await p.waitForTimeout(450); }
  const after = await state(p);
  await p.evaluate(G0 => eval(G0).player.playAction('skill', 'right'), G); z.skill0 = await state(p); await p.waitForTimeout(330); z.skill1 = await state(p); await shot(p, `${hero}-skill.png`); await p.waitForTimeout(500);
  await p.evaluate(G0 => { const s = eval(G0), pl = s.player; pl.damageImmune = false; pl.invulnUntil = 0; pl.takeDamage(3, s.combatNow); pl.damageImmune = true; }, G); z.hurt = await state(p); await p.waitForTimeout(400);
  ck(`${N}：正式动作图集 ${hero}_actions`, z.has && z.down.tex.includes(hero + '_actions'), { has: z.has, tex: z.down.tex });
  // 2026-11-17：v2 行走图带 <方向>_stand 站立帧的武将（如诸葛亮）停步用站立帧，不播待机循环
  const standIdle = idle.every(f => /_stand$/.test(f));
  ck(`${N}：站立待机（动作图 0–3 循环，或 v2 站立帧）`, standIdle || (new Set(idle).size >= 2 && idle.every(f => ['0', '1', '2', '3'].includes(f))), [...new Set(idle)]);
  ck(`${N}：普攻 朝下 4 / 朝右 8 / 朝上 12 / 朝左镜像 8`, inRow(z.down.frame, 4) && inRow(z.right.frame, 8) && !z.right.flip && inRow(z.up.frame, 12) && inRow(z.left.frame, 8) && z.left.flip, { d: z.down.frame, r: z.right.frame, u: z.up.frame, l: [z.left.frame, z.left.flip] });
  // 站立帧在行走图、出手在动作图时两张图集的「中位身高」口径不同（实测截图同高），只比同一图集
  ck(`${N}：出手人物身高与行走一致（±12%）`, walk.tex !== z.right.tex && standIdle || Math.abs(z.right.h - walk.h) / walk.h < .12, { walk: walk.h, attack: z.right.h, walkTex: walk.tex });
  ck(`${N}：动作播完回到行走 / 待机`, after.action === null && !after.tex.includes('_actions') || after.action === null && ['0', '1', '2', '3'].includes(after.frame), after);
  ck(`${N}：招牌技 16→19 逐帧推进、朝右不镜像`, z.skill0.action === 'skill' && z.skill0.frame === '16' && Number(z.skill1.frame) > 16 && Number(z.skill1.frame) <= 19 && !z.skill0.flip, { a: z.skill0.frame, b: z.skill1.frame, flip: z.skill0.flip });
  ck(`${N}：受伤 20–21`, z.hurt.action === 'hurt' && ['20', '21'].includes(z.hurt.frame), z.hurt);
  // 招牌技实战触发
  const real = await p.evaluate(async ([G0, hero]) => {
    const s = eval(G0), pl = s.player; const e = s.spawnEnemy('infantry', pl.x + 110, pl.y, 1); e.hp = e.maxHp = 1e6; e.speed = 0;
    if (hero === 'huangzhong') { pl.passive.lastDamage = -1e9; pl.nextSkillAction = 0; } else pl.passive.stacks = pl.passive.maxStacks;
    pl.weapons[0].cooldownLeft = 0; const seen = new Set();
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 25)); if (pl.currentAction) seen.add(pl.currentAction); }
    return [...seen];
  }, [G, hero]);
  ck(`${N}：实战中招牌技触发（${hero === 'huangzhong' ? '神射状态出手' : '被动蓄满的强化一击'}）`, real.includes('skill'), real);
  // 优先级：招牌技播放中不被普攻 / 受伤打断
  await p.waitForTimeout(700);
  const pri = await p.evaluate(G0 => { const pl = eval(G0).player; pl.nextSkillAction = 1e12; const s1 = pl.playAction('skill', 'right'); const a1 = pl.playAction('attack', 'down'); const h1 = pl.playAction('hurt'); return { s1, a1, h1, cur: pl.currentAction }; }, G);
  ck(`${N}：招牌技不被普攻、受伤打断`, pri.s1 && !pri.a1 && !pri.h1 && pri.cur === 'skill', pri);
  if (hero === 'zhaoyun') {
    await p.waitForTimeout(800);
    const win = await p.evaluate(async G0 => { const s = eval(G0); s.finish(true, 'boss'); await new Promise(r => setTimeout(r, 1000)); return { action: s.player.currentAction, frame: String(s.player.sprite.frame.name) }; }, G);
    ck('胜利：定格在 23 号帧（结算后计时器暂停仍能播完）', win.action === 'win' && win.frame === '23', win);
  }
  await p.close();
  if (hero === 'huangzhong') {
    const q = await battle(hero);
    const die = await q.evaluate(async G0 => { const s = eval(G0), pl = s.player; pl.damageImmune = false; pl.invulnUntil = 0; pl.hp = 1; pl.takeDamage(50, s.combatNow); await new Promise(r => setTimeout(r, 1000)); return { alive: pl.alive, action: pl.currentAction, frame: String(pl.sprite.frame.name) }; }, G);
    ck('阵亡：倒地定格在 27 号帧', !die.alive && die.action === 'die' && die.frame === '27', die);
    await q.close();
  }
}
// 动作截图拼图：四武将 × 普攻朝右 / 招牌技
{
  const { readFileSync } = await import('node:fs');
  const cells = Object.keys(HEROES).flatMap(h => ['attack-right', 'skill'].map(k => ({ label: HEROES[h].name + ' ' + (k === 'skill' ? '招牌技' : '普攻'), src: 'data:image/png;base64,' + readFileSync(`${out}/${h}-${k}.png`).toString('base64') })));
  const p = await b.newPage({ viewport: { width: 4 * 2 * 150 + 40, height: 200 } });
  await p.setContent(`<body style="margin:0;background:#222;display:flex;gap:4px;padding:6px;font:13px sans-serif;color:#eee">${cells.map(c => `<div style="text-align:center"><img src="${c.src}" style="width:146px;height:146px"><div>${c.label}</div></div>`).join('')}</body>`);
  await p.waitForTimeout(200); await p.screenshot({ path: `${out}/a3-battle-montage.png` }); await p.close();
}
ck('无 pageerror', errors.length === 0, errors.slice(0, 3));
console.log(`${pass}/${pass + fail} 通过`); await b.close(); process.exit(fail ? 1 : 0);
